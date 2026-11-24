import { redirect } from "next/navigation";
import AppShell from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";

type PublicPlan = {
  id: string;
  name: string;
  monthly_price_brl: number;
  annual_price_brl: number;
  daily_credits: number;
  history_messages: number;
  radar_enabled: boolean;
  voice_enabled: boolean;
  photo_enabled: boolean;
};

export default async function ProtectedLayout({children}:{children:React.ReactNode}) {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");

  const {data:profile,error:profileError}=await supabase
    .from("viva_profiles")
    .select("terms_of_use_version,privacy_policy_version,terms_accepted_at")
    .eq("id",user.id)
    .maybeSingle();
  if(profileError || profile?.terms_of_use_version!==TERMS_VERSION || profile?.privacy_policy_version!==PRIVACY_VERSION || !profile?.terms_accepted_at) redirect("/aceite-termos");

  // Primeiro acesso: quem ainda não tem conversa de boas-vindas começa por ela (nunca cai num painel vazio).
  // Quem pulou ou concluiu segue normalmente; contas antigas foram marcadas na migração e não são redirecionadas.
  const {data:onboarding}=await supabase.from("viva_onboarding").select("status").eq("user_id",user.id).eq("kind","finance").maybeSingle();
  if(!onboarding || onboarding.status==="in_progress") redirect("/boas-vindas");

  const [{data:isAdmin},{data:planPayload},{data:subscription}] = await Promise.all([
    supabase.rpc("viva_is_admin"),
    supabase.rpc("viva_get_public_plans"),
    supabase.from("viva_subscriptions")
      .select("plan_id")
      .eq("user_id",user.id)
      .in("status",["active","trialing"])
      .gt("current_period_end",new Date().toISOString())
      .order("current_period_end",{ascending:false})
      .limit(1)
      .maybeSingle()
  ]);

  const plans=((planPayload as {plans?:PublicPlan[]}|null)?.plans??[]);
  const currentPlanId=subscription?.plan_id??"free";

  return <AppShell
    email={user.email||"Minha conta"}
    isAdmin={Boolean(isAdmin)}
    entryOfferPlans={plans}
    currentPlanId={currentPlanId}
  >{children}</AppShell>;
}
