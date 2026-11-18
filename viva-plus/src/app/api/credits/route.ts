import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Saldo, extrato e tabela de custos do próprio usuário (somente leitura; tudo validado no banco).
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    const url = new URL(request.url);
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 50)));
    const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
    const [quota, history, plans] = await Promise.all([
      supabase.rpc("viva_get_ai_quota"),
      supabase.rpc("viva_get_credit_history", { p_limit: limit, p_offset: offset }),
      supabase.rpc("viva_get_public_plans"),
    ]);
    if (quota.error || history.error) throw quota.error || history.error;
    const payload = (plans.data || {}) as { plans?: unknown[]; operations?: unknown[] };
    return NextResponse.json({ wallet: quota.data, history: history.data || [], operations: payload.operations || [], plans: payload.plans || [] });
  } catch (error) {
    console.error("VIVA credits read failed", error);
    return NextResponse.json({ error: "Não foi possível carregar seus créditos." }, { status: 500 });
  }
}
