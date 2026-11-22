import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Painel de uso (somente admin): ativos, retenção e telas/ações mais usadas.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("viva_is_admin");
  if (!isAdmin) return NextResponse.json({ error: "Acesso restrito ao administrador VIVA+." }, { status: 403 });
  const { data, error } = await supabase.rpc("viva_admin_usage");
  if (error) {
    console.error("VIVA admin usage", error);
    const missing = error.code === "PGRST202" || error.code === "42883";
    return NextResponse.json({ error: missing ? "O painel de uso precisa da migração 0023 no banco." : "Não foi possível carregar o uso." }, { status: missing ? 503 : 500 });
  }
  return NextResponse.json(data);
}
