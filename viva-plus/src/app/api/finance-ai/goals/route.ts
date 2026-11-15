import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

export const runtime="nodejs";
type Goal={id:string;title:string;target_amount:number;current_amount:number;target_date:string|null};
type Step={title:string;detail:string;done:boolean};
const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
const monthsBetween=(date:string|null)=>{
 if(!date)return 12;
 const now=new Date();
 const target=new Date(date+"T12:00:00");
 if(Number.isNaN(target.getTime()))return 12;
 return Math.max(1,Math.ceil((target.getFullYear()-now.getFullYear())*12+target.getMonth()-now.getMonth()+(target.getDate()-now.getDate())/30));
};
async function authorize(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return {supabase,user:null,response:NextResponse.json({error:"Faça login para acessar suas metas."},{status:401})};
 const [flag,access,admin]=await Promise.all([
  supabase.from("viva_finance_ai_feature_flags").select("enabled").eq("flag_key","goal_plans").maybeSingle(),
  supabase.from("viva_finance_ai_user_access").select("enabled").eq("user_id",user.id).maybeSingle(),
  supabase.rpc("viva_is_admin")
 ]);
 if(!flag.data?.enabled||(!access.data?.enabled&&!admin.data))return {supabase,user,response:NextResponse.json({error:"O plano de metas está em liberação gradual."},{status:403})};
 return {supabase,user,response:null};
}
export async function GET(){
 try{
  const {supabase,user,response}=await authorize();
  if(response)return response;
  if(!user)return NextResponse.json({error:"Faça login para acessar suas metas."},{status:401});
  const [goals,plans]=await Promise.all([
   supabase.from("viva_financial_goals").select("id,title,target_amount,current_amount,target_date").eq("user_id",user.id).order("created_at",{ascending:false}).limit(30),
   supabase.from("viva_financial_goal_plans").select("id,goal_id,monthly_target,weekly_target,remaining_amount,months_remaining,steps,status,updated_at").eq("user_id",user.id).order("updated_at",{ascending:false}).limit(30)
  ]);
  if(goals.error||plans.error)throw new Error("Não foi possível carregar suas metas.");
  return NextResponse.json({enabled:true,goals:goals.data||[],plans:plans.data||[]});
 }catch(error){console.error("VIVA goal plans GET",error);return NextResponse.json({error:"Não foi possível carregar seus planos agora."},{status:500})}
}
export async function POST(request:NextRequest){
 try{
  const {supabase,user,response}=await authorize();
  if(response||!user)return response;
  const body=await request.json().catch(()=>({}));
  const goalId=String(body.goal_id||"");
  if(!/^[0-9a-f-]{36}$/i.test(goalId))return NextResponse.json({error:"Selecione uma meta válida."},{status:400});
  const {data:goal,error:goalError}=await supabase.from("viva_financial_goals").select("id,title,target_amount,current_amount,target_date").eq("id",goalId).eq("user_id",user.id).maybeSingle();
  if(goalError||!goal)return NextResponse.json({error:"Meta não encontrada."},{status:404});
  const target=Number(goal.target_amount),current=Number(goal.current_amount||0);
  if(!Number.isFinite(target)||target<=0||!Number.isFinite(current)||current<0)return NextResponse.json({error:"Confira os valores cadastrados nessa meta."},{status:400});
  const remaining=round(Math.max(0,target-current));
  const months=monthsBetween(goal.target_date);
  const monthly=round(remaining/months);
  const weekly=round(remaining/(months*52/12));
  const steps:Step[]=[
   {title:"Defina o dia de guardar",detail:"Escolha um dia fixo da semana ou do mês para separar o valor planejado.",done:false},
   {title:"Separe sua contribuição",detail:"Reserve "+weekly.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})+" por semana, ou o equivalente mensal, conforme seu fluxo de renda.",done:false},
   {title:"Acompanhe sua evolução",detail:"Atualize o valor já guardado sempre que fizer um novo aporte.",done:false},
   {title:"Revise o plano todo mês",detail:"Confira se o ritmo continua confortável e ajuste o prazo se sua realidade mudar.",done:false}
  ];
  const status=remaining===0?"completed":"active";
  const {data:plan,error}=await supabase.from("viva_financial_goal_plans").upsert({
   user_id:user.id,goal_id:goal.id,monthly_target:monthly,weekly_target:weekly,remaining_amount:remaining,months_remaining:months,steps,status,updated_at:new Date().toISOString()
  },{onConflict:"user_id,goal_id"}).select("id,goal_id,monthly_target,weekly_target,remaining_amount,months_remaining,steps,status,updated_at").single();
  if(error||!plan)throw new Error("Não foi possível salvar o plano.");
  return NextResponse.json({plan,goal,progress_percent:Math.min(100,round(current/target*100)),message:remaining===0?"Parabéns! Essa meta já foi alcançada.": "Seu plano de ação foi calculado e salvo."});
 }catch(error){console.error("VIVA goal plans POST",error);return NextResponse.json({error:error instanceof Error?error.message:"Não foi possível criar seu plano."},{status:500})}
}
export async function PATCH(request:NextRequest){
 try{
  const {supabase,user,response}=await authorize();
  if(response||!user)return response;
  const body=await request.json().catch(()=>({}));
  const planId=String(body.plan_id||"");
  const stepIndex=Number(body.step_index);
  const done=body.done;
  if(!/^[0-9a-f-]{36}$/i.test(planId)||!Number.isInteger(stepIndex)||typeof done!=="boolean")return NextResponse.json({error:"Atualização inválida."},{status:400});
  const {data:plan,error}=await supabase.from("viva_financial_goal_plans").select("id,steps").eq("id",planId).eq("user_id",user.id).maybeSingle();
  if(error||!plan)return NextResponse.json({error:"Plano não encontrado."},{status:404});
  const steps=Array.isArray(plan.steps)?plan.steps as Step[]:[];
  if(stepIndex<0||stepIndex>=steps.length)return NextResponse.json({error:"Etapa não encontrada."},{status:404});
  steps[stepIndex]={...steps[stepIndex],done};
  const {data:updated,error:updateError}=await supabase.from("viva_financial_goal_plans").update({steps,updated_at:new Date().toISOString()}).eq("id",planId).eq("user_id",user.id).select("id,steps,status,updated_at").single();
  if(updateError||!updated)throw new Error("Não foi possível atualizar a etapa.");
  return NextResponse.json({plan:updated});
 }catch(error){console.error("VIVA goal plans PATCH",error);return NextResponse.json({error:"Não foi possível atualizar essa etapa."},{status:500})}
}
