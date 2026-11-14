import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function adminClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  const { data: isAdmin, error } = await supabase.rpc("viva_is_admin");
  if (error || !isAdmin) return { response: NextResponse.json({ error: "Acesso restrito." }, { status: 403 }) };
  return { supabase };
}
export async function GET(request: NextRequest) {
  const auth = await adminClient();
  if ("response" in auth) return auth.response;
  const params = request.nextUrl.searchParams;
  const { data, error } = await auth.supabase.rpc("viva_admin_users_page", {
    p_search: params.get("q") || null, p_plan: params.get("plan") || null,
    p_status: params.get("status") || null, p_limit: Math.min(100, Math.max(1, Number(params.get("limit") || 25))),
    p_offset: Math.max(0, Number(params.get("offset") || 0)),
  });
  if (error) return NextResponse.json({ error: "Não foi possível carregar os usuários." }, { status: 500 });
  return NextResponse.json({ users: data || [], total: Number(data?.[0]?.total_count || 0) });
}
export async function POST(request: NextRequest) {
  const auth = await adminClient();
  if ("response" in auth) return auth.response;
  const body = await request.json().catch(() => null);
  if (!body?.user_id || !["active", "suspended"].includes(body.status)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const { error } = await auth.supabase.rpc("viva_admin_set_account_status", {
    p_user_id: body.user_id, p_status: body.status, p_reason: typeof body.reason === "string" ? body.reason : "",
  });
  if (error) {
    const forbidden = error.code === "42501" || /self_protection|cannot_change_admin|forbidden/.test(error.message || "");
    return NextResponse.json({ error: forbidden ? "Ação não permitida para esta conta." : "Não foi possível atualizar o acesso." }, { status: forbidden ? 403 : 400 });
  }
  return NextResponse.json({ success: true });
}
