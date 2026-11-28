import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureWelcomeTrial } from "@/lib/welcome-trial";
import { createAdminClient } from "@/lib/supabase/admin";
import { markLeadConverted } from "@/lib/diag-chat";
import { FUNNEL_OFFER } from "@/lib/life-diagnostic";
export const metadata = { title: "Bem-vindo", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Logo depois de criar a conta: a pessoa já ganha 7 dias do Pro (sem cartão) e vai direto
// para a conversa de boas-vindas, que termina no primeiro gasto anotado.
// Quem já tem plano ativo segue direto para o app.
export default async function SignupWelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // Personal e dono de academia voltam direto para o formulário de cadastro deles.
  const proPage = next === "/parceiros" ? "/parceiros#cadastro" : next === "/academias" ? "/academias#cadastro" : null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=" + encodeURIComponent(proPage ? "/assinar?next=" + encodeURIComponent(next!) : "/assinar"));
  // Criou a conta pelo Diagnóstico Financeiro: para os convites automáticos.
  const leadId = String(user.user_metadata?.diag_lead_id || "");
  if (/^[0-9a-f-]{36}$/.test(leadId)) { try { await markLeadConverted(createAdminClient(), { leadId, userId: user.id }); } catch (e) { console.error("VIVA diag convert", e); } }
  const { data: current } = await supabase.from("viva_subscriptions").select("plan_id").eq("user_id", user.id)
    .in("status", ["active", "trialing"]).neq("plan_id", "free").gt("current_period_end", new Date().toISOString()).limit(1).maybeSingle();
  if (current) redirect(proPage ?? "/boas-vindas");
  // Funil do tráfego pago: em vez do teste grátis de 7 dias, vai para o pagamento do Pro por R$19,90.
  if (!proPage && user.user_metadata?.funnel === FUNNEL_OFFER) redirect("/oferta-pro");
  await ensureWelcomeTrial(supabase, user.id);
  redirect(proPage ?? "/boas-vindas?presente=pro");
}
