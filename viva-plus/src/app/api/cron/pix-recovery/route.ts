import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runFunnelRecovery } from "@/lib/funnel-recovery";
import { sendWebPush } from "@/lib/web-push";
import { sendWhatsappText, SITE_URL, brl } from "@/lib/whatsapp";
export const runtime = "nodejs";
export const maxDuration = 60;

// Recupera Pix gerado e não pago: até 2 lembretes por pedido (≈45 min depois e ≈4 h antes de vencer).
// WhatsApp só quando a pessoa falou com a VIVA nas últimas 24 h (janela em que a Meta permite mensagem livre).
const FIRST_AFTER_MS = 45 * 60000;
const LAST_BEFORE_EXPIRY_MS = 4 * 3600000;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== "Bearer " + secret) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    const admin = createAdminClient();
    const now = Date.now();
    const { data: rows, error } = await admin.from("viva_payments")
      .select("id,user_id,amount_brl,pix_expires_at,created_at,metadata")
      .eq("payment_method", "pix").eq("status", "pending")
      .gt("pix_expires_at", new Date(now + 15 * 60000).toISOString())
      .lt("created_at", new Date(now - FIRST_AFTER_MS).toISOString())
      .order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    const seenUsers = new Set<string>();
    let sent = 0;
    for (const row of rows || []) {
      if (seenUsers.has(row.user_id)) continue; // um lembrete por pessoa (o Pix mais recente)
      seenUsers.add(row.user_id);
      const meta = (row.metadata || {}) as Record<string, unknown>;
      const reminders = Number(meta.recovery_reminders || 0);
      const msLeft = new Date(row.pix_expires_at).getTime() - now;
      const due = reminders === 0 || (reminders === 1 && msLeft <= LAST_BEFORE_EXPIRY_MS);
      if (!due || reminders >= 2) continue;
      const { data: active } = await admin.from("viva_subscriptions").select("id").eq("user_id", row.user_id).eq("status", "active")
        .gt("current_period_end", new Date().toISOString()).limit(1).maybeSingle();
      if (active) continue;
      // Marca antes de enviar: se o envio falhar, não repete em seguida.
      const { data: claimed } = await admin.from("viva_payments").update({ metadata: { ...meta, recovery_reminders: reminders + 1, recovery_last_at: new Date().toISOString() } })
        .eq("id", row.id).eq("status", "pending").select("id").maybeSingle();
      if (!claimed) continue;
      const plan = String(meta.plan_name || "VIVA+");
      const link = `${SITE_URL}/planos?pix=retomar`;
      const last = reminders === 1;
      const title = last ? `Seu Pix do ${plan} vence em poucas horas ⏳` : `Seu Pix do plano ${plan} está te esperando 💜`;
      const body = last ? "Depois disso o código expira. Leva 1 minuto: copie e cole no app do banco." : `Falta só pagar ${brl(Number(row.amount_brl))} para liberar tudo. O código continua guardado no app.`;
      const { data: subs } = await admin.from("viva_push_subscriptions").select("id,endpoint,p256dh,auth_key").eq("user_id", row.user_id);
      for (const s of subs || []) {
        try { await sendWebPush(s, { title, body, targetUrl: "/planos?pix=retomar", tag: "pix-recovery-" + row.id, notificationType: "billing" }); sent++; }
        catch (e) { console.error("VIVA pix recovery push", e instanceof Error ? e.message : e); }
      }
      const { data: wa } = await admin.from("viva_whatsapp_links").select("wa_id,last_inbound_at").eq("user_id", row.user_id).not("wa_id", "is", null).maybeSingle();
      if (wa?.wa_id && wa.last_inbound_at && now - new Date(wa.last_inbound_at).getTime() < 23.5 * 3600000) {
        const text = `${last ? "⏳" : "💜"} *${title}*\n\n${body}\n\nToque aqui para pagar:\n${link}`;
        if (await sendWhatsappText(wa.wa_id, text)) sent++;
      }
    }
    // Funil do tráfego pago: quem criou a conta e não assinou.
    let funnel = 0; try { funnel = await runFunnelRecovery(admin); } catch (e) { console.error("VIVA funnel recovery", e); }
    return NextResponse.json({ ok: true, checked: rows?.length || 0, sent, funnel });
  } catch (e) { console.error("VIVA pix recovery failed", e); return NextResponse.json({ error: "Falha na recuperação de Pix." }, { status: 500 }); }
}
