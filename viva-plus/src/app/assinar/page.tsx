import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureWelcomeTrial } from "@/lib/welcome-trial";
export const metadata = { title: "Bem-vindo · VIVA+" };
export const dynamic = "force-dynamic";

// Logo depois de criar a conta: a pessoa já ganha 7 dias do Pro (sem cartão) e vai direto
// para a conversa de boas-vindas, que termina no primeiro gasto anotado.
// Quem já tem plano ativo segue direto para o app.
export default async function SignupWelcomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fassinar");
  const { data: current } = await supabase.from("viva_subscriptions").select("plan_id").eq("user_id", user.id)
    .in("status", ["active", "trialing"]).neq("plan_id", "free").gt("current_period_end", new Date().toISOString()).limit(1).maybeSingle();
  if (current) redirect("/boas-vindas");
  await ensureWelcomeTrial(supabase, user.id);
  redirect("/boas-vindas?presente=pro");
}
