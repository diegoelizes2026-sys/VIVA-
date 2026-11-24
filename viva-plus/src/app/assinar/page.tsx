import Link from "next/link";
import { redirect } from "next/navigation";
import PlansInteractive from "@/app/(app)/planos/plans-interactive";
import { TrialOffer } from "@/components/growth";
import { createClient } from "@/lib/supabase/server";
export const metadata = { title: "Escolha seu plano · VIVA+" };

type PublicPlan = { id: string; name: string; monthly_price_brl: number; annual_price_brl: number; daily_credits: number; monthly_credits: number; signup_credits: number; history_days: number | null; history_messages: number; radar_enabled: boolean; voice_enabled: boolean; photo_enabled: boolean };

// Logo depois de criar a conta: a pessoa já escolhe e assina o plano (a VIVA no WhatsApp é só para assinantes).
// Quem já tem plano ativo segue direto para o app.
export default async function SignupPlansPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fassinar");
  const { data: current } = await supabase.from("viva_subscriptions").select("plan_id").eq("user_id", user.id)
    .in("status", ["active", "trialing"]).neq("plan_id", "free").gt("current_period_end", new Date().toISOString()).limit(1).maybeSingle();
  if (current) redirect("/meu-dia");
  const { data } = await supabase.rpc("viva_get_public_plans");
  const plans = (data as { plans?: PublicPlan[] } | null)?.plans ?? [];

  return <main className="ob-page">
    <header className="ob-page-head"><span className="viva-wordmark">VIVA<span>+</span></span></header>
    <div className="viva-plans viva-signup-plans">
      <span className="viva-eyebrow">CONTA CRIADA ✅</span>
      <h1>Agora escolha seu plano</h1>
      <ol className="viva-signup-steps" aria-label="Etapas">
        <li className="done">1. Conta criada</li>
        <li className="now">2. Assinar o plano</li>
        <li>3. Falar com a VIVA no WhatsApp</li>
      </ol>
      <p>Com um plano ativo você libera a <b>VIVA no WhatsApp</b>: anote gastos, veja quanto pode gastar hoje, acompanhe contas e dívidas e planeje suas metas — tudo por mensagem. Pague com Pix ou cartão; o plano ativa assim que o pagamento é confirmado.</p>
      <TrialOffer />
      <PlansInteractive plans={plans.filter(p => p.id !== "free" && Number(p.monthly_price_brl) > 0)} currentPlanId="free" />
      <Link className="viva-signup-skip" href="/boas-vindas">Continuar no plano grátis por enquanto (sem WhatsApp)</Link>
    </div>
  </main>;
}
