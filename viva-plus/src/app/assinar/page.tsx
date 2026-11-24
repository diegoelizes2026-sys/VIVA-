import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureWelcomeTrial } from "@/lib/welcome-trial";
export const metadata = { title: "Bem-vindo", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Logo depois de criar a conta: a pessoa já ganha 7 dias do Pro (sem cartão) e vai direto
// para a conversa de boas-vindas, que termina no primeiro gasto anotado.
// Quem já tem plano ativo segue direto para o app.
export default async function SignupWelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const toPartners = next === "/parceiros";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fassinar");
  const { data: current } = await supabase.from("viva_subscriptions").select("plan_id").eq("user_id", user.id)
    .in("status", ["active", "trialing"]).neq("plan_id", "free").gt("current_period_end", new Date().toISOString()).limit(1).maybeSingle();
  if (current) redirect(toPartners ? "/parceiros#cadastro" : "/boas-vindas");
  await ensureWelcomeTrial(supabase, user.id);
  redirect(toPartners ? "/parceiros#cadastro" : "/boas-vindas?presente=pro");
}
