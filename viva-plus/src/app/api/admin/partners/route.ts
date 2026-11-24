import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Parceiros (influenciadores): código próprio, valor por assinante e limite mensal.
async function adminClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  const { data: isAdmin, error } = await supabase.rpc("viva_is_admin");
  if (error || !isAdmin) return { response: NextResponse.json({ error: "Acesso restrito." }, { status: 403 }) };
  return { supabase };
}

export async function GET() {
  const auth = await adminClient();
  if ("response" in auth) return auth.response;
  const { data, error } = await auth.supabase.rpc("viva_admin_partners");
  if (error) { console.error("VIVA admin partners", error); return NextResponse.json({ error: "Não foi possível carregar os parceiros." }, { status: 500 }); }
  return NextResponse.json({ partners: data || [] });
}

const Body = z.object({
  user_id: z.string().uuid(),
  code: z.string().trim().regex(/^[A-Za-z0-9]{4,12}$/, "O código precisa ter de 4 a 12 letras ou números, sem espaço."),
  reward_brl: z.coerce.number().min(0).max(1000),
  monthly_limit_brl: z.coerce.number().min(0).max(1000000).nullable(),
  active: z.boolean().default(true),
  note: z.string().max(300).optional(),
});

export async function POST(request: NextRequest) {
  const auth = await adminClient();
  if ("response" in auth) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Confira os dados do parceiro." }, { status: 400 });
  const v = parsed.data;
  const { data, error } = await auth.supabase.rpc("viva_admin_set_partner", {
    p_user_id: v.user_id, p_code: v.code, p_reward_cents: Math.round(v.reward_brl * 100),
    p_monthly_limit_cents: v.monthly_limit_brl === null ? null : Math.round(v.monthly_limit_brl * 100), p_active: v.active, p_note: v.note ?? null,
  });
  if (error) {
    const msg = /code_taken/.test(error.message) ? "Esse código já é de outra pessoa. Escolha outro." : /invalid_code/.test(error.message) ? "Código inválido." : "Não foi possível salvar o parceiro.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json(data);
}
