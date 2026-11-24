import { createHmac, timingSafeEqual } from "node:crypto";

// E-mails da VIVA pelo Resend (https://resend.com). Sem a chave RESEND_API_KEY, nada é enviado (só registra no log).
// Remetente: EMAIL_FROM (padrão "VIVA+ <ola@vivamaiss.app.br>"); o domínio precisa estar verificado no Resend.

export const SITE = "https://www.vivamaiss.app.br";
const FROM = process.env.EMAIL_FROM || "VIVA+ <ola@vivamaiss.app.br>";
const REPLY_TO = process.env.EMAIL_REPLY_TO || "vivamais597@gmail.com";

export function emailConfigured() { return Boolean(process.env.RESEND_API_KEY); }

// Link de "parar de receber e-mails" assinado (não precisa estar logado para usar).
function unsubSignature(userId: string) {
  return createHmac("sha256", process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "viva").update("unsub:" + userId).digest("base64url").slice(0, 32);
}
export function unsubscribeUrl(userId: string) { return `${SITE}/api/email/unsubscribe?u=${userId}&t=${unsubSignature(userId)}`; }
export function validUnsubscribe(userId: string, token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !token) return false;
  const a = Buffer.from(unsubSignature(userId)), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** **negrito** → <b>, quebras de linha → <br>. */
const rich = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");

export type EmailContent = { subject: string; preheader?: string; title: string; paragraphs: string[]; highlight?: { label: string; value: string }; cta?: { label: string; url: string }; ps?: string };

export function renderEmail(c: EmailContent, userId?: string) {
  const unsub = userId ? unsubscribeUrl(userId) : `${SITE}/configuracoes/notificacoes`;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(c.subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f1f8;font-family:Arial,Helvetica,sans-serif;color:#20162b">
<span style="display:none!important;opacity:0;color:transparent;max-height:0;overflow:hidden">${esc(c.preheader || "")}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1f8;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:22px;overflow:hidden">
<tr><td style="background:#6410C9;background:linear-gradient(150deg,#3d0a86,#6410C9 60%,#8b3de8);padding:26px 28px">
<span style="font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-1px">VIVA<span style="color:#FFD43B">+</span></span></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 14px;font-size:23px;line-height:1.25;color:#20162b">${rich(c.title)}</h1>
${c.highlight ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;background:#f3ebfd;border-radius:16px"><tr><td style="padding:16px 18px"><span style="font-size:13px;color:#6f6578">${esc(c.highlight.label)}</span><br><span style="font-size:30px;font-weight:900;color:#6410C9">${esc(c.highlight.value)}</span></td></tr></table>` : ""}
${c.paragraphs.map(p => `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#3d3449">${rich(p)}</p>`).join("")}
${c.cta ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 6px"><tr><td style="border-radius:999px;background:#6410C9"><a href="${esc(c.cta.url)}" style="display:inline-block;padding:14px 26px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;border-radius:999px">${esc(c.cta.label)}</a></td></tr></table>` : ""}
${c.ps ? `<p style="margin:18px 0 0;font-size:14px;line-height:1.5;color:#6f6578">${rich(c.ps)}</p>` : ""}
</td></tr>
<tr><td style="padding:18px 28px 24px;border-top:1px solid #eee8f4;font-size:12px;line-height:1.5;color:#8a8191">
VIVA+ (Vivamais) · Rua Tibúrcio Targino, 389, Centro, Aquiraz – CE · CNPJ 70.254.525/0001-39<br>
Você recebe este e-mail porque tem conta no VIVA+. <a href="${esc(unsub)}" style="color:#6410C9">Não quero mais receber e-mails</a>
</td></tr></table></td></tr></table></body></html>`;
  const text = [c.title.replace(/\*\*/g, ""), ...c.paragraphs.map(p => p.replace(/\*\*/g, "")), c.highlight ? `${c.highlight.label}: ${c.highlight.value}` : "", c.cta ? `${c.cta.label}: ${c.cta.url}` : "", c.ps ? c.ps.replace(/\*\*/g, "") : "", "", `Parar de receber e-mails: ${unsub}`].filter(Boolean).join("\n\n");
  return { html, text, unsub };
}

export async function sendEmail(to: string, c: EmailContent, userId?: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.warn("VIVA email: RESEND_API_KEY não configurada; e-mail não enviado", { subject: c.subject }); return false; }
  const { html, text, unsub } = renderEmail(c, userId);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject: c.subject, html, text, headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }),
    });
    if (!res.ok) { console.error("VIVA email send failed", res.status, (await res.text()).slice(0, 300)); return false; }
    return true;
  } catch (e) { console.error("VIVA email send error", e); return false; }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = { from: (t: string) => any; auth: { admin: { getUserById: (id: string) => Promise<{ data: { user: { email?: string | null; user_metadata?: Record<string, unknown> } | null } }> } } };

/**
 * Envia um e-mail uma única vez por chave (registra em viva_notification_deliveries), respeitando
 * a preferência de e-mail da pessoa. Nunca lança erro.
 */
export async function emailOnce(admin: Admin, userId: string, key: string, type: "activation" | "report" | "trial", build: (firstName: string) => EmailContent | null) {
  if (!emailConfigured()) return false;
  try {
    const dedupe = key + ":email";
    const { data: seen } = await admin.from("viva_notification_deliveries").select("id").eq("dedupe_key", dedupe).maybeSingle();
    if (seen) return false;
    const { data: settings } = await admin.from("viva_notification_settings").select("email_enabled").eq("user_id", userId).maybeSingle();
    if (settings && settings.email_enabled === false) return false;
    const { data } = await admin.auth.admin.getUserById(userId);
    const email = data?.user?.email;
    if (!email) return false;
    const first = String(data.user?.user_metadata?.full_name || "").trim().split(/\s+/)[0] || "";
    const content = build(first);
    if (!content) return false;
    // Marca antes de enviar: se dois agendamentos rodarem juntos, só um envia.
    const { error: markError } = await admin.from("viva_notification_deliveries").insert({ user_id: userId, notification_type: type, dedupe_key: dedupe, scheduled_for: new Date().toISOString(), title: content.subject, body: content.title, target_url: content.cta?.url || "/meu-dia", payload: { channel: "email" }, status: "sent" });
    if (markError) return false;
    const ok = await sendEmail(email, content, userId);
    if (!ok) await admin.from("viva_notification_deliveries").update({ status: "failed" }).eq("dedupe_key", dedupe);
    return ok;
  } catch (e) { console.error("VIVA emailOnce", e); return false; }
}
