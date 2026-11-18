import PlansInteractive from "./plans-interactive";
import {createClient} from "@/lib/supabase/server";
type PublicPlan={id:string;name:string;monthly_price_brl:number;daily_credits:number;monthly_credits:number;signup_credits:number;history_days:number|null;history_messages:number;radar_enabled:boolean;voice_enabled:boolean;photo_enabled:boolean;annual_price_brl:number};
export default async function PlansPage(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return null;
 const {data,error}=await supabase.rpc("viva_get_public_plans");
 const payload=data as {plans?:PublicPlan[];extra_credits?:{amount:number;price_brl:number}}|null;
 const plans=payload?.plans??[];const extra=payload?.extra_credits??{amount:100,price_brl:4.90};
 const {data:current}=await supabase.from("viva_subscriptions").select("plan_id").eq("user_id",user.id).in("status",["active","trialing"]).gt("current_period_end",new Date().toISOString()).order("current_period_end",{ascending:false}).limit(1).maybeSingle();
 return <div className="viva-plans"><span className="viva-eyebrow">PLANOS VIVA+</span><h1>Escolha como quer cuidar da sua rotina</h1><p>Os créditos valem para a VIVA e para o Personal. O Pro é ativado só depois da confirmação do pagamento.</p>{error&&<p>Não foi possível carregar os planos agora.</p>}<PlansInteractive plans={plans} currentPlanId={current?.plan_id??"free"}/><section className="viva-extra-credit"><div><b>Precisa de mais conversas?</b><p>Pacote extra de {extra.amount} créditos por {Number(extra.price_brl).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}.</p></div><button disabled>Compra de créditos em ativação</button></section><p className="viva-plans-note">A VIVA+ é uma assistente de organização e não substitui consultoria financeira profissional. Você pode solicitar a exclusão dos seus dados nas configurações da conta.</p></div>;
}