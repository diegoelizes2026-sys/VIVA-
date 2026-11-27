import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDiagFollowup } from "@/lib/diag-followup";

export const runtime = "nodejs";
export const maxDuration = 60;

// Chamado a cada 15 minutos pelo agendador do banco. Não envia nada enquanto a pausa geral estiver ligada.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== "Bearer " + secret) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try { return NextResponse.json({ ok: true, ...(await runDiagFollowup(createAdminClient())) }); }
  catch (e) { console.error("VIVA diag followup", e); return NextResponse.json({ error: "Falha no acompanhamento." }, { status: 500 }); }
}
