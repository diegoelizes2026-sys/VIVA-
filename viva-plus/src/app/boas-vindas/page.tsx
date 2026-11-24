import { redirect } from "next/navigation";
import OnboardingChat from "@/components/onboarding-chat";
import { InviteClaim } from "@/components/growth";
import { createClient } from "@/lib/supabase/server";
export const metadata = { title: "Boas-vindas", robots: { index: false, follow: false } };

// Primeiro acesso: conversa de diagnóstico (fora do layout do app, em tela cheia).
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ presente?: string }> }) {
  const { presente } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fboas-vindas");
  const { data: profile } = await supabase.from("viva_profiles").select("terms_accepted_at").eq("id", user.id).maybeSingle();
  if (!profile?.terms_accepted_at) redirect("/aceite-termos");
  return <main id="conteudo" className="ob-page">
    <header className="ob-page-head"><span className="viva-wordmark">VIVA<span>+</span></span></header>
    {presente === "pro" && <p className="ob-gift" role="status">🎁 <b>Presente de boas-vindas:</b> 7 dias do VIVA+ Pro grátis, já ativados. Sem cartão e sem cobrança.</p>}
    <InviteClaim />
    <OnboardingChat kind="finance" />
  </main>;
}
