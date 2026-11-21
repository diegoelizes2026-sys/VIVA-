import { createHmac, timingSafeEqual } from "node:crypto";

const GRAPH = "https://graph.facebook.com/" + (process.env.WHATSAPP_GRAPH_VERSION || "v21.0");

function config() {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) throw new Error("WhatsApp não configurado (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID).");
  return { token, phoneNumberId };
}

/** Confere o cabeçalho X-Hub-Signature-256 enviado pela Meta. */
export function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const received = header.slice(7);
  if (received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
}

async function post(payload: Record<string, unknown>) {
  const { token, phoneNumberId } = config();
  const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });
  if (!res.ok) console.error("VIVA WhatsApp send failed", res.status, await res.text().catch(() => ""));
  return res.ok;
}

const clip = (text: string, max: number) => (text.length > max ? text.slice(0, max - 1) + "…" : text);

export function sendText(to: string, body: string) {
  return post({ to, type: "text", text: { body: clip(body || "…", 4096), preview_url: true } });
}

export type ReplyButton = { id: string; title: string };

/** Até 3 botões de resposta rápida (título com até 20 caracteres). */
export function sendButtons(to: string, body: string, buttons: ReplyButton[]) {
  return post({
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
  const { token } = config();
  const metaRes = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!metaRes.ok) throw new Error("Não consegui localizar a mídia no WhatsApp.");
  const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
  if (!meta.url) throw new Error("Mídia sem URL.");
  const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
  if (!fileRes.ok) throw new Error("Não consegui baixar a mídia do WhatsApp.");
  return { buffer: Buffer.from(await fileRes.arrayBuffer()), mimeType: String(meta.mime_type || fileRes.headers.get("content-type") || "") };
}

export function appUrl(path = "") {
  const base = (process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? "https://" + process.env.VERCEL_PROJECT_PRODUCTION_URL : "")).replace(/\/$/, "");
  return base ? base + path : "";
}
