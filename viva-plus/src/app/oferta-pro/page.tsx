import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OFFER_COOKIE, offerDeadline, offerOpen } from "@/lib/funnel-offer";
import { FUNNEL_OFFER, FUNNEL_REGULAR_BRL } from "@/lib/life-diagnostic";
import ProOfferCheckout from "@/components/pro-offer-checkout";

export const metadata = { title: "Assine o Pro", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Tela de pagamento do funil do tráfego pago: gancho, preço de R$19,90 com o relógio da promoção e garantia de 7 dias.
// Quem chega aqui pelo funil não ganha o teste grátis de 7 dias: paga logo no cadastro.
export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/cadastro?origem=" + FUNNEL_OFFER);
  const { data: current } = await supabase.from("viva_subscriptions").select("plan_id,gateway").eq("user_id", user.id)
    .eq("status", "active").neq("plan_id", "free").neq("gateway", "trial").gt("current_period_end", new Date().toISOString()).limit(1).maybeSingle();
  if (current) redirect("/meu-dia");
  const deadline = offerDeadline((await cookies()).get(OFFER_COOKIE)?.value, user.user_metadata?.funnel_offer_token);
  const { data: plan } = await supabase.from("viva_plans").select("monthly_price_brl").eq("id", "pro").maybeSingle();
  const regular = Number(plan?.monthly_price_brl) > 0 ? Number(plan!.monthly_price_brl) : FUNNEL_REGULAR_BRL;
  const firstName = String(user.user_metadata?.full_name || "").trim().split(" ")[0] || "";
  return <ProOfferCheckout deadline={offerOpen(deadline) ? deadline : null} expiredAt={deadline && !offerOpen(deadline) ? deadline : null} regular={regular} firstName={firstName} />;
}
