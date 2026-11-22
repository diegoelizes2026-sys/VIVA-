import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Administração dos saques da indicação paga: lista (GET) e marcar como pago/recusado (POST).
async function admin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, res: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  const { data: isAdmin } = await supabase.rpc("viva_is_admin");
  if (!isAdmin) return { supabase, res: NextResponse.json({ error: "Acesso restrito." }, { status: 403 }) };
  return { supabase, res: null };
}

export async function GET(request: NextRequest) {
  const { supabase, res } = await admin(); if (res) return res;
  const s = request.nextUrl.searchParams.get("status");
  const status = s === "paid" || s === "rejected" ? s : s === "all" ? null : "requested";
  const { data, error } = await supabase.rpc("viva_admin_referral_payouts", { p_status: status });
  if (error) { console.error("VIVA admin payouts", error); return NextResponse.json({ error: "Não foi possível carregar os saques." }, { status: 500 }); }
  return NextResponse.json({ payouts: data || [] });
}

const Decide = z.object({ id: z.string().uuid(), decision: z.enum(["paid", "rejected"]), note: z.string().trim().max(300).optional() });
export async function POST(request: Request) {
  const { supabase, res } = await admin(); if (res) return res;
  const parsed = Decide.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const { error } = await supabase.rpc("viva_admin_decide_payout", { p_id: parsed.data.id, p_decision: parsed.data.decision, p_note: parsed.data.note || null });
  if (error) {
    if (error.message?.includes("payout_not_open")) return NextResponse.json({ error: "Esse saque já foi decidido." }, { status: 409 });
    console.error("VIVA admin payout decide", error);
    return NextResponse.json({ error: "Não consegui salvar a decisão." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
