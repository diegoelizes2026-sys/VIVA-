import { createHmac, createHash, timingSafeEqual } from "node:crypto";

// Número oficial da VIVA no WhatsApp (só dígitos, com DDI). Pode ser trocado pela variável de ambiente.
export const WHATSAPP_PUBLIC_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "558588252048").replace(/\D/g, "");
export const SITE_URL = "https://www.vivamaiss.app.br";
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";

export function whatsappLinkUrl(code: string) {
  return `https://wa.me/${WHATSAPP_PUBLIC_NUMBER}?text=${encodeURIComponent(`Conectar VIVA ${code}`)}`;
}

/** Confere a assinatura X-Hub-Signature-256 que a Meta manda em cada webhook. */
export function validSignature(rawBody: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = Buffer.from("sha256=" + createHmac("sha256", secret).update(rawBody, "utf8").digest("hex"));
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/** Chave de idempotência aceita pela VIVA (letras, números, _ e -). */
export function requestKeyFor(messageId: string) {
  return "wa_" + createHash("sha256").update(messageId).digest("hex").slice(0, 40);
}

/** Markdown do app (**negrito**) para o formato do WhatsApp (*negrito*), dentro do limite de tamanho. */
export function toWhatsappText(text: string) {
  return text.replace(/\*\*(.+?)\*\*/g, "*$1*").replace(/^#{1,6}\s*/gm, "").trim().slice(0, 4000);
}

export async function sendWhatsappText(to: string, body: string) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) { console.error("VIVA WhatsApp: WHATSAPP_TOKEN ou WHATSAPP_PHONE_NUMBER_ID não configurado"); return false; }
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: true, body: toWhatsappText(body) } }),
  });
  if (!res.ok) { console.error("VIVA WhatsApp send failed", res.status, (await res.text()).slice(0, 500)); return false; }
  console.log("VIVA WhatsApp: resposta enviada");
  return true;
}

// Link de conexão com um toque, enviado pela VIVA no próprio WhatsApp (assinado, vale 1 hora).
const CONNECT_TTL_MS = 60 * 60 * 1000;
function connectSignature(payload: string) {
  return createHmac("sha256", process.env.WHATSAPP_APP_SECRET || "").update("connect:" + payload).digest("base64url").slice(0, 32);
}
export function connectUrlFor(waId: string) {
  const payload = `${waId.replace(/\D/g, "")}.${Date.now() + CONNECT_TTL_MS}`;
  return `${SITE_URL}/whatsapp/conectar?t=${payload}.${connectSignature(payload)}`;
}
export function readConnectToken(token: string | null | undefined) {
  const match = /^(\d{8,15})\.(\d{13})\.([A-Za-z0-9_-]{32})$/.exec(token || "");
  if (!match || !process.env.WHATSAPP_APP_SECRET) return null;
  const expected = Buffer.from(connectSignature(`${match[1]}.${match[2]}`));
  const received = Buffer.from(match[3]);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  if (Number(match[2]) < Date.now()) return null;
  return match[1];
}

export const LINKED_MESSAGE = "Pronto! ✅ Seu WhatsApp está conectado à sua conta VIVA+.\n\nAgora é só falar comigo por aqui, do mesmo jeito que no app. Por exemplo:\n• gastei 35 na farmácia\n• quanto posso gastar hoje?\n• o que vence essa semana?\n\nPara desconectar, mande *desconectar*.";

type AdminClient = { from: (table: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
/** Liga o número de WhatsApp à conta (um número só pode estar ligado a uma conta). */
export async function linkWhatsapp(admin: AdminClient, userId: string, waId: string) {
  const now = new Date().toISOString();
  await admin.from("viva_whatsapp_links").update({ wa_id: null, linked_at: null, history: [], updated_at: now }).eq("wa_id", waId).neq("user_id", userId);
  const { error } = await admin.from("viva_whatsapp_links").upsert({ user_id: userId, wa_id: waId, linked_at: now, link_code: null, code_expires_at: null, history: [], updated_at: now }, { onConflict: "user_id" });
  if (error) throw error;
}

export function brl(value: number) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
