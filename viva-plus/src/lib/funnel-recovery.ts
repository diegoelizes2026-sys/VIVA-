import { sendEmail, emailConfigured, SITE } from "@/lib/email";
import { sendWebPush } from "@/lib/web-push";
import { AREA_LABEL, FUNNEL_PRICE_BRL, FUNNEL_REGULAR_BRL, PLAN, brl, type Area } from "@/lib/life-diagnostic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;
const FIRST_AFTER_MS = 20 * 60_000;      // 1º lembrete: ~20 min depois de ver o pagamento (ainda dentro da promoção)
const SECOND_AFTER_MS = 22 * 3600_000;   // 2º lembrete: no dia seguinte, preço normal
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/**
 * Lembra quem criou a conta no funil e não assinou: até 2 e-mails (e push, se ativou), nunca depois de pagar.
 * Respeita quem desligou e-mails. Roda junto com a recuperação de Pix (a cada 15 min).
 */
export async function runFunnelRecovery(admin: Admin) {
  const now = Date.now();
  const { data: rows } = await admin.from("viva_funnel_checkouts").select("user_id,first_view_at,offer_until,worst_area,reminders")
    .is("paid_at", null).lt("reminders", 2).lt("first_view_at", new Date(now - FIRST_AFTER_MS).toISOString())
    .gt("first_view_at", new Date(now - 3 * 86400_000).toISOString()).order("first_view_at", { ascending: true }).limit(40);
  let sent = 0;
  for (const r of rows || []) {
    const age = now - new Date(r.first_view_at).getTime();
    if (r.reminders === 1 && age < SECOND_AFTER_MS) continue;
    const { data: paid } = await admin.from("viva_subscriptions").select("id").eq("user_id", r.user_id).eq("status", "active").neq("plan_id", "free")
      .neq("gateway", "trial").gt("current_period_end", new Date().toISOString()).limit(1).maybeSingle();
    if (paid) { await admin.from("viva_funnel_checkouts").update({ paid_at: new Date().toISOString() }).eq("user_id", r.user_id); continue; }
    // Marca antes de enviar: duas execuções ao mesmo tempo não mandam em dobro.
    const { data: claimed } = await admin.from("viva_funnel_checkouts").update({ reminders: r.reminders + 1, last_reminder_at: new Date().toISOString() })
      .eq("user_id", r.user_id).eq("reminders", r.reminders).select("user_id").maybeSingle();
    if (!claimed) continue;
    const promoOpen = r.reminders === 0 && r.offer_until && new Date(r.offer_until).getTime() > now;
    const area = (r.worst_area && r.worst_area in AREA_LABEL ? r.worst_area : null) as Area | null;
    const areaName = area ? AREA_LABEL[area].toLowerCase() : null;
    const title = promoOpen ? `Sua promoção de ${brl(FUNNEL_PRICE_BRL)} termina às ${hhmm(r.offer_until)}` : areaName ? `Seu plano para ${areaName} continua guardado` : "Seu Pro do VIVA+ está te esperando";
    const pushBody = promoOpen ? "Seu diagnóstico completo está a 1 passo. Garantia de 7 dias." : "Assine o Pro e libere seu diagnóstico completo. Garantia de 7 dias.";
    const { data: u } = await admin.auth.admin.getUserById(r.user_id);
    const email = u?.user?.email as string | undefined;
    const first = String(u?.user?.user_metadata?.full_name || "").trim().split(/\s+/)[0] || "";
    const { data: settings } = await admin.from("viva_notification_settings").select("email_enabled").eq("user_id", r.user_id).maybeSingle();
    if (email && emailConfigured() && settings?.email_enabled !== false) {
      const ok = await sendEmail(email, {
        subject: title,
        preheader: promoOpen ? "Depois desse horário o Pro volta para o preço normal." : "Seu diagnóstico completo está pronto para liberar.",
        title: `${first ? first + ", s" : "S"}eu diagnóstico completo está a 1 passo`,
        paragraphs: [
          area ? `No seu diagnóstico, o ponto mais desequilibrado foi ${areaName}. O primeiro passo do seu plano é: "${PLAN[area][0].title}".` : "Seu diagnóstico ficou guardado na sua conta.",
          "Com o Pro você libera as notas das 5 áreas, o plano passo a passo de cada uma e a VIVA no seu WhatsApp para te lembrar todos os dias.",
          "Garantia de 7 dias: se não gostar, devolvemos 100% do valor, sem perguntas.",
        ],
        highlight: promoOpen ? { label: `Promoção até ${hhmm(r.offer_until)}`, value: `${brl(FUNNEL_PRICE_BRL)}/mês` } : { label: "Plano Pro", value: `${brl(FUNNEL_REGULAR_BRL)}/mês` },
        cta: { label: "Liberar meu diagnóstico", url: `${SITE}/oferta-pro` },
      }, r.user_id);
      if (ok) sent++;
    }
    const { data: subs } = await admin.from("viva_push_subscriptions").select("id,endpoint,p256dh,auth_key").eq("user_id", r.user_id);
    for (const s of subs || []) { try { await sendWebPush(s, { title, body: pushBody, targetUrl: "/oferta-pro", tag: "funnel-" + r.user_id, notificationType: "billing" }); sent++; } catch { /* aparelho sem push */ } }
  }
  return sent;
}
