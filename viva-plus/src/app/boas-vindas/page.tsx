import { redirect } from "next/navigation";
import OnboardingChat from "@/components/onboarding-chat";
import { InviteClaim } from "@/components/growth";
import { createClient } from "@/lib/supabase/server";
export const metadata = { title: "Boas-vindas · VIVA+" };

// Primeiro acesso: conversa de diagnóstico (fora do layout do app, em tela cheia).
export default async function WelcomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fboas-vindas");
  const { data: profile } = await supabase.from("viva_profiles").select("terms_accepted_at").eq("id", user.id).maybeSingle();
  if (!profile?.terms_accepted_at) redirect("/aceite-termos");
  return <main className="ob-page">
    <header className="ob-page-head"><span className="viva-wordmark">VIVA<span>+</span></span></header>
    <InviteClaim />
    <OnboardingChat kind="finance" />
  </main>;
}
