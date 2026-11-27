// Saúde do WhatsApp (Meta): confere se o token e o número respondem na API oficial.
// Foi o que quebrou em 27/11/2026: o token ficou bloqueado ("API access blocked", erro 200) e a VIVA parou de responder.
import type { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, SITE } from "@/lib/email";
import { SUPPORT_EMAIL } from "@/lib/support";

type Admin = ReturnType<typeof createAdminClient>;
const GRAPH = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
export type WaHealth = { ok: boolean; error: string | null; code: number | null; verifiedName: string | null; nameStatus: string | null; quality: string | null; phone: string | null; lastInbound: string | null; checkedAt: string };

/** Pergunta à Meta pelo número de telefone usando o token configurado (não envia mensagem nenhuma). */
export async function checkWhatsapp(admin: Admin): Promise<WaHealth> {
  const token = process.env.WHATSAPP_TOKEN, phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const { data: last } = await admin.from("viva_whatsapp_inbound").select("received_at").order("received_at", { ascending: false }).limit(1).maybeSingle();
  const base = { verifiedName: null, nameStatus: null, quality: null, phone: null, lastInbound: (last?.received_at as string) ?? null, checkedAt: new Date().toISOString() };
  if (!token || !phoneId) return { ...base, ok: false, code: null, error: "WHATSAPP_TOKEN ou WHATSAPP_PHONE_NUMBER_ID não configurado na Vercel." };
  const ask = async (fields: string) => {
    const res = await fetch(`https://graph.facebook.com/${GRAPH}/${phoneId}?fields=${fields}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(10000) });
    const j = await res.json().catch(() => ({})) as Record<string, unknown> & { error?: { message?: string; code?: number } };
    return { res, j };
  };
  try {
    let { res, j } = await ask("verified_name,display_phone_number,quality_rating,name_status");
    if (!res.ok && j.error?.code === 100) ({ res, j } = await ask("verified_name,display_phone_number")); // campo indisponível nesta versão
    if (!res.ok) return { ...base, ok: false, code: j.error?.code ?? res.status, error: `${j.error?.code ?? res.status}: ${j.error?.message ?? "erro da Meta"}`.slice(0, 480) };
    return { ...base, ok: true, code: null, error: null, verifiedName: (j.verified_name as string) ?? null, nameStatus: (j.name_status as string) ?? null, quality: (j.quality_rating as string) ?? null, phone: (j.display_phone_number as string) ?? null };
  } catch (e) {
    return { ...base, ok: false, code: null, error: "Sem resposta da Meta: " + (e instanceof Error ? e.message : "falha de rede").slice(0, 300) };
  }
}

const ALERT_TO = () => process.env.ALERT_EMAIL || SUPPORT_EMAIL;
const REMIND_MS = 6 * 3600 * 1000;

/** Roda a checagem, guarda o estado e manda e-mail quando cai (e a cada 6 h enquanto continuar fora) e quando volta. */
export async function runWhatsappHealth(admin: Admin) {
  const h = await checkWhatsapp(admin);
  const now = new Date();
  const { data: prev } = await admin.from("viva_ops_status").select("ok,since,alerted_at").eq("key", "whatsapp").maybeSingle();
  const changed = !prev || prev.ok !== h.ok;
  const since = changed ? now.toISOString() : String(prev.since);
  let alertedAt: string | null = changed ? null : (prev?.alerted_at as string | null) ?? null;
  const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  if (!h.ok && (!alertedAt || now.getTime() - new Date(alertedAt).getTime() > REMIND_MS)) {
    const sent = await sendEmail(ALERT_TO(), {
      subject: "🚨 VIVA+ fora do ar no WhatsApp",
      preheader: "A Meta recusou o acesso. A VIVA pode não estar respondendo.",
      title: "A VIVA pode não estar respondendo no WhatsApp",
      paragraphs: [
        `Desde ${fmt(since)} a Meta está recusando o acesso da VIVA à API do WhatsApp.`,
        `Resposta da Meta: ${h.error}`,
        "O que mais resolve: gerar um token novo do usuário do sistema (validade Nunca, permissões whatsapp_business_messaging e whatsapp_business_management), colocar em WHATSAPP_TOKEN na Vercel e fazer Redeploy.",
        h.lastInbound ? `Última mensagem recebida: ${fmt(h.lastInbound)}.` : "",
      ].filter(Boolean),
      cta: { label: "Abrir o Painel administrativo", url: `${SITE}/admin` },
      transactional: true,
    });
    if (sent) alertedAt = now.toISOString();
  }
  if (h.ok && prev && prev.ok === false && prev.alerted_at) {
    await sendEmail(ALERT_TO(), { subject: "✅ VIVA+ voltou no WhatsApp", title: "A VIVA voltou a funcionar no WhatsApp", paragraphs: [`A Meta voltou a aceitar o acesso em ${fmt(now.toISOString())}. Ficou fora desde ${fmt(String(prev.since))}.`], cta: { label: "Abrir o Painel administrativo", url: `${SITE}/admin` }, transactional: true });
  }
  await admin.from("viva_ops_status").upsert({ key: "whatsapp", ok: h.ok, error: h.error, detail: h, since, checked_at: now.toISOString(), alerted_at: alertedAt });
  return { ...h, since };
}
