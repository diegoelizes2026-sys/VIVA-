import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Teste grátis do Pro: 7 dias, uma vez por conta, sem cartão (regras no banco: viva_start_pro_trial).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { data, error } = await supabase.rpc("viva_trial_status");
  if (error) { console.error("VIVA trial status", error); return NextResponse.json({ eligible: false, active: false }); }
  return NextResponse.json(data);
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login para testar o Pro." }, { status: 401 });
  const { data, error } = await supabase.rpc("viva_start_pro_trial");
  if (error) {
    if (/trial_unavailable/.test(error.message)) return NextResponse.json({ error: "O teste grátis já foi usado nesta conta." }, { status: 409 });
    console.error("VIVA trial start", error);
    return NextResponse.json({ error: "Não consegui ativar o teste agora. Tente de novo." }, { status: 500 });
  }
  // Sincroniza a carteira para o app já mostrar o Pro.
  await supabase.rpc("viva_get_ai_quota").then(() => null, () => null);
  return NextResponse.json(data);
}
