import { redirect } from "next/navigation";
import AppShell from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

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
  if(profileError || !profile?.terms_of_use_version || !profile?.privacy_policy_version || !profile?.terms_accepted_at) redirect("/aceite-termos");

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
