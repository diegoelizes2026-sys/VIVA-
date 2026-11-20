import { after, NextResponse } from "next/server";
import { validSignature, whatsappConfigured } from "@/lib/whatsapp/cloud";
import { handleInbound, type Inbound } from "@/lib/whatsapp/handler";

export const runtime = "nodejs";
export const maxDuration = 60;

// Verificação do webhook feita pela Meta ao cadastrar a URL.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) return new Response(challenge || "", { status: 200 });
  return new Response("forbidden", { status: 403 });
}

type ChangeValue = {
  contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
  messages?: Array<Omit<Inbound, "profileName">>;
};

export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) return new Response("invalid signature", { status: 401 });
  if (!whatsappConfigured()) return NextResponse.json({ ok: true, skipped: "not_configured" });

  let payload: { entry?: Array<{ changes?: Array<{ field?: string; value?: ChangeValue }> }> };
  try { payload = JSON.parse(raw); } catch { return new Response("bad request", { status: 400 }); }

  const inbound: Inbound[] = [];
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (change.field !== "messages" || !value?.messages) continue;
      for (const m of value.messages) {
        if (!m?.id || !m?.from) continue;
        const name = value.contacts?.find(c => c.wa_id === m.from)?.profile?.name;
        inbound.push({ ...m, profileName: name });
      }
    }
  }

  // Responde 200 na hora para a Meta e processa depois (a IA pode levar alguns segundos).
  if (inbound.length) {
    after(async () => {
      for (const m of inbound) {
        try { await handleInbound(m); } catch (error) { console.error("VIVA WhatsApp inbound failed", error); }
      }
    });
  }
  return NextResponse.json({ ok: true });
}
