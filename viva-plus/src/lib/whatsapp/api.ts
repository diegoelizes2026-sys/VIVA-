import { createHmac, timingSafeEqual } from "node:crypto";

// Dois provedores com o MESMO formato de mensagem (API de Nuvem do WhatsApp):
// - 360dialog (parceiro oficial da Meta): basta D360_API_KEY
// - Meta direto: WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID
const D360_BASE = "https://waba-v2.360dialog.io";
const GRAPH = "https://graph.facebook.com/" + (process.env.WHATSAPP_GRAPH_VERSION || "v21.0");

export const using360dialog = () => Boolean(process.env.D360_API_KEY);

function sendEndpoint(): { url: string; headers: Record<string, string> } {
  const d360 = process.env.D360_API_KEY;
  if (d360) return { url: `${D360_BASE}/messages`, headers: { "D360-API-KEY": d360 } };
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) throw new Error("WhatsApp não configurado (D360_API_KEY ou WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID).");
  return { url: `${GRAPH}/${phoneNumberId}/messages`, headers: { Authorization: `Bearer ${token}` } };
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Confere se a chamada do webhook é legítima.
 * 360dialog: cabeçalho secreto que nós mesmos cadastramos (x-viva-webhook-secret).
 * Meta direto: assinatura X-Hub-Signature-256 com a chave secreta do app.
 */
export function verifyWebhook(rawBody: string, headers: Headers): boolean {
  if (using360dialog()) {
    const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
    const received = headers.get("x-viva-webhook-secret");
    return Boolean(secret && received && safeEqual(received, secret));
  }
  const secret = process.env.WHATSAPP_APP_SECRET;
  const header = headers.get("x-hub-signature-256");
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return safeEqual(header.slice(7), expected);
}

async function post(payload: Record<string, unknown>) {
  const { url, headers } = sendEndpoint();
  const res = await fetch(url, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });
  if (!res.ok) console.error("VIVA WhatsApp send failed", res.status, await res.text().catch(() => ""));
  return res.ok;
}

const clip = (text: string, max: number) => (text.length > max ? text.slice(0, max - 1) + "…" : text);

export function sendText(to: string, body: string) {
  return post({ recipient_type: "individual", to, type: "text", text: { body: clip(body || "…", 4096), preview_url: true } });
}

export type ReplyButton = { id: string; title: string };

/** Até 3 botões de resposta rápida (título com até 20 caracteres). */
export function sendButtons(to: string, body: string, buttons: ReplyButton[]) {
  return post({
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: clip(body, 1024) },
      action: { buttons: buttons.slice(0, 3).map(b => ({ type: "reply", reply: { id: b.id, title: clip(b.title, 20) } })) },
    },
  });
}

export function markRead(messageId: string) {
  return post({ status: "read", message_id: messageId }).catch(() => false);
}

/** Baixa uma mídia (áudio, foto, PDF) recebida pelo WhatsApp. */
export async function downloadMedia(mediaId: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const d360 = process.env.D360_API_KEY;
  const auth: Record<string, string> = d360 ? { "D360-API-KEY": d360 } : { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN || ""}` };
  const metaRes = await fetch(`${d360 ? D360_BASE : GRAPH}/${encodeURIComponent(mediaId)}`, { headers: auth });
  if (!metaRes.ok) throw new Error("Não consegui localizar a mídia no WhatsApp.");
  const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
  if (!meta.url) throw new Error("Mídia sem URL.");
  // Na 360dialog o arquivo é baixado pelo próprio domínio dela, com a mesma chave.
  const fileUrl = d360 ? meta.url.replace(/^https:\/\/lookaside\.fbsbx\.com/, D360_BASE) : meta.url;
  const fileRes = await fetch(fileUrl, { headers: auth });
  if (!fileRes.ok) throw new Error("Não consegui baixar a mídia do WhatsApp.");
  return { buffer: Buffer.from(await fileRes.arrayBuffer()), mimeType: String(meta.mime_type || fileRes.headers.get("content-type") || "") };
}

/** Cadastra na 360dialog o endereço do webhook com o cabeçalho secreto. */
export async function register360Webhook(webhookUrl: string) {
  const d360 = process.env.D360_API_KEY;
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (!d360 || !secret) throw new Error("Configure D360_API_KEY e WHATSAPP_WEBHOOK_SECRET na Vercel.");
  const res = await fetch(`${D360_BASE}/v1/configs/webhook`, {
    method: "POST",
    headers: { "D360-API-KEY": d360, "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl, headers: { "x-viva-webhook-secret": secret } }),
  });
  const text = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body: text.slice(0, 500) };
}

export function appUrl(path = "") {
  const base = (process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? "https://" + process.env.VERCEL_PROJECT_PRODUCTION_URL : "")).replace(/\/$/, "");
  return base ? base + path : "";
}
