import OpenAI from "openai";
import {NextResponse} from "next/server";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {blockedResponse,classifyPersonalOperation,readRequestKey} from "@/lib/credits";
export const runtime="nodejs";

const normalizeModelId=(value:string)=>value.trim().toLowerCase().replace(/-\d{4}-\d{2}-\d{2}$/,"").trim();
const schema=z.object({
 message:z.string().trim().min(1).max(2000),
 history:z.array(z.object({role:z.enum(["user","assistant"]),content:z.string().max(4000)})).max(12).optional(),
 requestId:z.string().max(80).optional()
});
const GOAL_LABEL:Record<string,string>={hipertrofia:"ganhar massa muscular (hipertrofia)",emagrecimento:"perder peso (emagrecimento)",condicionamento:"melhorar o condicionamento físico",saude:"saúde geral e bem-estar"};
type Row=Record<string,unknown>;

const INSTRUCTIONS=`Você é o VIVA+ Personal, um personal trainer virtual acolhedor, motivador e prático do app VIVA+. Responda sempre em português brasileiro, de forma curta e organizada (use listas quando montar treinos).
Você pode: montar treinos com exercícios, séries, repetições e descanso; explicar a execução correta; sugerir progressão; dar orientações gerais de hidratação, sono e alimentação equilibrada; motivar o usuário com base nos registros dele.
Regras de segurança: suas orientações são educativas e não substituem médico, nutricionista ou profissional de educação física. Não prescreva medicamentos, suplementos em doses, dietas restritivas ou com menos de 1.200 kcal. Se o usuário relatar dor no peito, falta de ar, desmaio, lesão, gravidez, doença cardíaca ou outra condição de saúde, oriente a parar e procurar um profissional de saúde antes de treinar. Sempre inclua aquecimento quando montar um treino. Nunca invente registros do usuário nem diga que salvou algo.`;

function today(){return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Fortaleza",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}

export async function POST(request:Request){
 let supabase:Awaited<ReturnType<typeof createClient>>|null=null;let reservationId:string|null=null;
 try{
  supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Faça login para falar com o seu Personal."},{status:401});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:"Mensagem inválida. Use até 2.000 caracteres."},{status:400});
  if(!process.env.OPENAI_API_KEY)return NextResponse.json({error:"O Personal está temporariamente indisponível."},{status:503});

  const since=new Date(today()+"T12:00:00Z");since.setUTCDate(since.getUTCDate()-6);
  const from=since.toISOString().slice(0,10);
  const [{data:profile},water,sleep,weight,food,activity,workout]=await Promise.all([
   supabase.from("viva_health_profiles").select("*").eq("user_id",user.id).maybeSingle(),
   supabase.from("viva_water_logs").select("amount_ml,logged_on").eq("user_id",user.id).gte("logged_on",from).limit(100),
   supabase.from("viva_sleep_logs").select("sleep_hours,sleep_date").eq("user_id",user.id).gte("sleep_date",from).limit(10),
   supabase.from("viva_weight_logs").select("weight_kg,logged_on").eq("user_id",user.id).order("logged_on",{ascending:false}).limit(5),
   supabase.from("viva_food_logs").select("meal_type,food_name,calories,logged_on").eq("user_id",user.id).gte("logged_on",from).limit(30),
   supabase.from("viva_activity_logs").select("activity_type,duration_minutes,intensity,logged_on").eq("user_id",user.id).gte("logged_on",from).limit(30),
   supabase.from("viva_workout_logs").select("focus,duration_minutes,logged_on").eq("user_id",user.id).gte("logged_on",from).limit(14)
  ]);
  const p=(profile||{}) as Row;
  const rows=(r:{data:unknown}|null)=>((r?.data as Row[]|null)||[]);
  const waterByDay=new Map<string,number>();rows(water).forEach(r=>waterByDay.set(String(r.logged_on),(waterByDay.get(String(r.logged_on))||0)+Number(r.amount_ml)));
  const lines=[
   ...[...waterByDay].map(([d,ml])=>`- ${d}: água ${ml} ml`),
   ...rows(sleep).map(r=>`- ${r.sleep_date}: sono ${Number(r.sleep_hours)} h`),
   ...rows(weight).map(r=>`- ${r.logged_on}: peso ${Number(r.weight_kg)} kg`),
   ...rows(food).map(r=>`- ${r.logged_on}: refeição (${r.meal_type}) ${String(r.food_name).slice(0,60)}${r.calories?`, ${Number(r.calories)} kcal`:""}`),
   ...rows(activity).map(r=>`- ${r.logged_on}: atividade ${r.activity_type} ${r.duration_minutes} min (${r.intensity})`),
   ...rows(workout).map(r=>`- ${r.logged_on}: treino concluído "${String(r.focus).slice(0,60)}" ${r.duration_minutes} min`)
  ];
  const context=[
   "Objetivo do usuário: "+(GOAL_LABEL[String(p.goal||"saude")]||GOAL_LABEL.saude)+".",
   p.age?`Idade: ${p.age} anos.`:"",p.height_cm?`Altura: ${Number(p.height_cm)} cm.`:"",
   p.goal_weight_kg?"Peso desejado: "+Number(p.goal_weight_kg)+" kg.":"",
   p.experience_level?`Nível de experiência: ${p.experience_level}.`:"",
   p.train_location?`Treina: ${({casa:"em casa (sem aparelhos de academia)",academia:"na academia",ar_livre:"ao ar livre",misto:"em casa e na academia"} as Record<string,string>)[String(p.train_location)]||p.train_location}.`:"",
   p.session_minutes?`Tempo por treino: ${p.session_minutes} minutos.`:"",
   p.limitations?`ATENÇÃO — limitações/orientações informadas pelo usuário: ${String(p.limitations).slice(0,300)}. Adapte os exercícios e recomende acompanhamento profissional.`:"",
   "Metas: "+(Number(p.water_goal_ml)||2000)+" ml de água/dia, "+(Number(p.weekly_workouts)||5)+" treinos/semana, "+(Number(p.weekly_activity_min)||150)+" min de atividade/semana.",
   lines.length?"Registros dos últimos 7 dias:\n"+lines.slice(0,60).join("\n"):"Ainda não há registros de saúde nos últimos 7 dias."
  ].filter(Boolean).join("\n");

  const history=(parsed.data.history||[]).slice(-8);
  const message=parsed.data.message;
  const estimatedInputTokens=Math.ceil((message.length+context.length+INSTRUCTIONS.length+history.reduce((s,i)=>s+i.content.length,0))/4);
  const operation=classifyPersonalOperation(message);
  const {data:guard,error:guardError}=await supabase.rpc("viva_reserve_ai_credits",{p_feature:"chat",p_estimated_input_tokens:estimatedInputTokens,p_prefer_cheap:false,p_operation:operation,p_request_key:readRequestKey(parsed.data.requestId)});
  if(guardError){console.error("VIVA personal quota reservation failed",guardError);return NextResponse.json({error:"Não foi possível validar seus créditos. Tente novamente."},{status:503})}
  if(!guard?.allowed){const blocked=blockedResponse(guard,"Personal");return NextResponse.json(blocked.body,{status:blocked.status})}
  reservationId=guard.reservation_id;
  const modelKey=String(guard.model_key||"cheap");const envKey=modelKey==="balanced"?"OPENAI_MODEL_BALANCED":"OPENAI_MODEL_CHEAP";const configuredModel=process.env[envKey]||"";
  if(!normalizeModelId(configuredModel)||normalizeModelId(configuredModel)!==normalizeModelId(String(guard.model_id||""))){console.error("VIVA personal model/pricing mismatch",{configuredModel,priced:guard.model_id,modelKey});await supabase.rpc("viva_release_ai_reservation",{p_reservation_id:reservationId});reservationId=null;return NextResponse.json({error:"O Personal está em manutenção rápida. Tente novamente em instantes."},{status:503})}

  const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
  const response=await client.responses.create({
   model:configuredModel.trim(),
   instructions:INSTRUCTIONS+(String(p.trainer)==="homem"?"\nVocê é o Personal VIVA+ (fale no masculino ao se referir a si mesmo).":"\nVocê é a Personal VIVA+ (fale no feminino ao se referir a si mesma).")+"\n\nDados do usuário (use apenas como contexto, não repita tudo):\n"+context,
   input:[...history,{role:"user" as const,content:message}],
   max_output_tokens:Math.max(400,Math.min(1600,Number(guard.max_output_tokens)||900))
  });
  const answer=(response.output_text||"").trim();
  // Sem resposta válida da IA: devolve a reserva, nada é descontado.
  if(!answer){await supabase.rpc("viva_release_ai_reservation",{p_reservation_id:reservationId});reservationId=null;return NextResponse.json({error:"O Personal não conseguiu responder agora. Nenhum crédito foi descontado."},{status:502})}
  const tokensIn=response.usage?.input_tokens??0;const tokensOut=response.usage?.output_tokens??0;
  const costUsd=(tokensIn*Number(guard.input_usd_per_million)+tokensOut*Number(guard.output_usd_per_million))/1_000_000;const costBrl=costUsd*Number(guard.usd_brl_rate||6.5)*1.25;
  const {data:settled,error:settleError}=await supabase.rpc("viva_settle_ai_usage",{p_reservation_id:reservationId,p_model:configuredModel,p_tokens_in:tokensIn,p_tokens_out:tokensOut,p_cost_usd:costUsd,p_cost_brl:costBrl,p_response_text:answer});
  if(settleError){console.error("VIVA personal settlement failed",settleError);await supabase.rpc("viva_release_ai_reservation",{p_reservation_id:reservationId});reservationId=null;return NextResponse.json({error:"Não foi possível registrar o consumo. Tente novamente."},{status:503})}
  reservationId=null;
  return NextResponse.json({answer,usage:{credits:Number(guard.credits_cost||0),operation:guard.operation_label||operation},wallet:settled?.wallet??null});
 }catch(error){
  console.error("VIVA personal error",error);
  if(supabase&&reservationId){try{await supabase.rpc("viva_release_ai_reservation",{p_reservation_id:reservationId})}catch(releaseError){console.error("VIVA personal release failed",releaseError)}}
  return NextResponse.json({error:"O Personal não conseguiu responder agora. Nenhum crédito foi descontado."},{status:500});
 }
}
