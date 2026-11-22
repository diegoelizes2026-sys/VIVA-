import { after, NextResponse } from "next/server";
import { verifyWebhook } from "@/lib/whatsapp/api";
import { handleIncoming, type IncomingMessage } from "@/lib/whatsapp/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Verificação do webhook pela Meta (feita uma vez, ao cadastrar a URL).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge") || "";
  if (mode === "subscribe" && process.env.WHATSAPP_VERIFY_TOKEN && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

type WebhookBody = {
  object?: string;
  entry?: Array<{ changes?: Array<{ field?: string; value?: { messages?: IncomingMessage[] } }> }>;
};

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyWebhook(raw, request.headers)) {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
  }
  let body: WebhookBody;
  try { body = JSON.parse(raw) as WebhookBody; } catch { return NextResponse.json({ ok: true }); }

  const messages = (body.entry || []).flatMap(e => (e.changes || []).flatMap(c => (c.field === "messages" ? c.value?.messages || [] : [])));
  // Responde 200 na hora (a Meta reenvia se demorar) e processa em seguida.
  if (messages.length) {
    after(async () => {
      for (const msg of messages) {
        try { await handleIncoming(msg); }
        catch (error) { console.error("VIVA WhatsApp message failed", msg.id, error); }
      }
    });
  }
  return NextResponse.json({ ok: true });
}
