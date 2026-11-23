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
  return true;
}

export function brl(value: number) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
