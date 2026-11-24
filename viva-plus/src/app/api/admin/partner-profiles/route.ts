import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

async function admin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { res: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  const { data: ok } = await supabase.rpc("viva_is_admin");
  if (!ok) return { res: NextResponse.json({ error: "Acesso restrito." }, { status: 403 }) };
  return { supabase };
}

export async function GET() {
  const a = await admin(); if ("res" in a) return a.res;
  const { data, error } = await a.supabase.rpc("viva_admin_partner_profiles", { p_status: null });
  if (error) { console.error("VIVA admin partner profiles", error); return NextResponse.json({ error: "Não foi possível carregar." }, { status: 500 }); }
  return NextResponse.json({ profiles: data || [] });
}

const Body = z.object({ user_id: z.string().uuid(), decision: z.enum(["approved", "rejected"]), code: z.string().trim().max(12).optional(), reviewer: z.boolean().optional(), note: z.string().max(300).optional() });
export async function POST(request: Request) {
  const a = await admin(); if ("res" in a) return a.res;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const v = parsed.data;
  const { data, error } = await a.supabase.rpc("viva_admin_decide_partner", { p_user_id: v.user_id, p_decision: v.decision, p_code: v.code || null, p_reviewer: v.reviewer ?? false, p_note: v.note || null });
  if (error) return NextResponse.json({ error: /code_taken/.test(error.message) ? "Esse código já é de outra pessoa. Escolha outro." : /invalid_code/.test(error.message) ? "Código inválido (4 a 12 letras ou números)." : "Não foi possível salvar." }, { status: 400 });
  return NextResponse.json(data);
}
