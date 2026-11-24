import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyWhatsappPlanActive } from "@/lib/whatsapp";

// Teste grátis do Pro: 7 dias, uma vez por conta, sem cartão (regras no banco: viva_start_pro_trial).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { data, error } = await supabase.rpc("viva_trial_status");
  if (error) { console.error("VIVA trial status", error); return NextResponse.json({ eligible: false, active: false }); }
  return NextResponse.json({ ...(data as Record<string, unknown>), followup: await trialFollowup(supabase, user.id) });
}

// Acompanhamento do teste: datas do último teste e o que a pessoa fez com a VIVA desde que começou.
// Só para quem ainda não assinou um plano pago (quem assinou não precisa do aviso de fim do teste).
async function trialFollowup(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  try {
    const { data: trial } = await supabase.from("viva_subscriptions").select("current_period_start,current_period_end")
      .eq("user_id", userId).eq("gateway", "trial").order("current_period_end", { ascending: false }).limit(1).maybeSingle();
    if (!trial?.current_period_start || !trial.current_period_end) return null;
    const { data: paid } = await supabase.from("viva_subscriptions").select("id").eq("user_id", userId).neq("gateway", "trial")
      .eq("status", "active").gt("current_period_end", new Date().toISOString()).limit(1).maybeSingle();
    if (paid) return null;
    const since = trial.current_period_start;
    const [expenses, conversations] = await Promise.all([
      supabase.from("viva_transactions").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since),
      supabase.from("viva_ai_reservations").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "settled").gte("created_at", since),
    ]);
    return { started_at: since, ends_at: trial.current_period_end, expenses: expenses.count ?? 0, conversations: conversations.count ?? 0 };
  } catch (e) { console.error("VIVA trial followup", e); return null; }
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
  // Teste do Pro também libera a VIVA no WhatsApp: avisa por lá se o número já estiver conectado.
  await notifyWhatsappPlanActive(createAdminClient(), user.id);
  return NextResponse.json(data);
}
