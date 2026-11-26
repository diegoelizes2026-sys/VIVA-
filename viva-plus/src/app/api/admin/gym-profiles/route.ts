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
  const { data, error } = await a.supabase.rpc("viva_admin_gym_profiles");
  if (error) { console.error("VIVA admin gym profiles", error); return NextResponse.json({ error: "Não foi possível carregar." }, { status: 500 }); }
  return NextResponse.json({ gyms: data || [] });
}

const Body = z.object({ owner_id: z.string().uuid(), decision: z.enum(["approved", "rejected"]), note: z.string().max(300).optional() });
export async function POST(request: Request) {
  const a = await admin(); if ("res" in a) return a.res;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const { data, error } = await a.supabase.rpc("viva_admin_decide_gym", { p_owner_id: parsed.data.owner_id, p_decision: parsed.data.decision, p_note: parsed.data.note || null });
  if (error) return NextResponse.json({ error: "Não foi possível salvar." }, { status: 400 });
  return NextResponse.json(data);
}
