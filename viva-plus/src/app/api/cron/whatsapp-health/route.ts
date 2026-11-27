import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runWhatsappHealth } from "@/lib/whatsapp-health";

export const runtime = "nodejs";

// A cada 15 minutos (agendador do banco): confere o acesso à API do WhatsApp e avisa por e-mail se cair.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== "Bearer " + secret) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try { const h = await runWhatsappHealth(createAdminClient()); return NextResponse.json({ ok: true, whatsapp: h.ok, error: h.error }); }
  catch (e) { console.error("VIVA whatsapp health", e); return NextResponse.json({ error: "Falha na checagem." }, { status: 500 }); }
}
