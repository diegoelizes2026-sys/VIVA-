import crypto from "node:crypto";

// Cliente mínimo da WhatsApp Cloud API (API oficial da Meta).
const GRAPH = () => `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION || "v23.0"}`;

export function whatsappConfigured() {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export function whatsappNumber() {
  return (process.env.WHATSAPP_DISPLAY_NUMBER || "").replace(/\D/g, "");
}

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://vivamaiss.app.br").replace(/\/$/, "");
}

async function graph(path: string, body: unknown) {
  const res = await fetch(`${GRAPH()}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`WhatsApp API ${res.status}: ${detail.slice(0, 400)}`);
  }
  return res.json();
}

export async function sendText(to: string, text: string) {
  const body = text.length > 4000 ? text.slice(0, 3990) + "…" : text;
  return graph(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body, preview_url: true },
  });
}

export type Button = { id: string; title: string };

export async function sendButtons(to: string, text: string, buttons: Button[]) {
  const body = text.length > 1024 ? text.slice(0, 1020) + "…" : text;
  return graph(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: { buttons: buttons.slice(0, 3).map(b => ({ type: "reply", reply: { id: b.id, title: b.title.slice(0, 20) } })) },
    },
  });
}

export async function markRead(messageId: string) {
  return graph(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    messaging_product: "whatsapp",
    status: "read",
    message_id: messageId,
  });
}

export async function downloadMedia(mediaId: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const auth = { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` };
  const meta = await fetch(`${GRAPH()}/${mediaId}`, { headers: auth });
  if (!meta.ok) throw new Error(`WhatsApp media ${meta.status}`);
  const info = (await meta.json()) as { url?: string; mime_type?: string; file_size?: number };
  if (!info.url) throw new Error("WhatsApp media sem URL");
  if (info.file_size && info.file_size > 5 * 1024 * 1024) throw new Error("too_large");
  const file = await fetch(info.url, { headers: auth });
  if (!file.ok) throw new Error(`WhatsApp media download ${file.status}`);
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > 5 * 1024 * 1024) throw new Error("too_large");
  return { buffer, mimeType: String(info.mime_type || "").split(";")[0].trim().toLowerCase() };
}

// Confere a assinatura X-Hub-Signature-256 enviada pela Meta.
export function validSignature(rawBody: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const given = header.slice(7);
  if (given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given, "hex"), Buffer.from(expected, "hex"));
}
