import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Relatório agregado do primeiro acesso (sem dados individuais de finanças ou saúde).
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("viva_is_admin");
  if (!isAdmin) return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });
  const days = Math.min(3650, Math.max(1, Number(request.nextUrl.searchParams.get("days") || 30)));
  const { data, error } = await supabase.rpc("viva_admin_onboarding_overview", { p_days: days });
  if (error) { console.error("VIVA admin onboarding", error); return NextResponse.json({ error: "Não foi possível carregar o relatório." }, { status: 500 }); }
  return NextResponse.json(data);
}
