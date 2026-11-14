import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import AdminPanel from "@/components/admin-panel";
export default async function AdminPage(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const {data:isAdmin}=await supabase.rpc("viva_is_admin");if(!isAdmin)return <div className="viva-admin-denied"><h1>Acesso restrito</h1><p>Seu usuário ainda não está autorizado como administrador da VIVA+.</p></div>;
 const [{data:plans},{data:settings},{data:logs}]=await Promise.all([
  supabase.from("viva_plans").select("*").order("monthly_price_brl"),
  supabase.from("viva_admin_settings").select("*").eq("id",true).single(),
  supabase.from("viva_usage_log").select("user_id,cost_brl,created_at").gte("created_at",new Date(Date.now()-31*86400000).toISOString()).limit(10000)
 ]);
 const todayKey=new Date().toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"});
 const today=(logs||[]).filter(x=>new Date(x.created_at).toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"})===todayKey);
 const stats={today:today.reduce((a,x)=>a+Number(x.cost_brl),0),month:(logs||[]).reduce((a,x)=>a+Number(x.cost_brl),0),messages:(logs||[]).length,users:new Set((logs||[]).map(x=>x.user_id)).size};
 return <AdminPanel plans={plans||[]} settings={settings||{ai_paused:false,automatic_mode:true,global_daily_budget_brl:50,usd_brl_rate:6.5,alert_threshold_percent:70,extra_credit_price_brl:4.90,extra_credit_amount:100}} stats={stats}/>;
}
