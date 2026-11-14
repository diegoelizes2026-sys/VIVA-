import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema=z.object({
 message:z.string().trim().min(1).max(4000),
 history:z.array(z.object({role:z.enum(["user","assistant"]),content:z.string().max(4000)})).max(12).optional(),
 feature:z.enum(["chat","voice","photo","radar"]).optional(),
});

export async function GET(){\n try{const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Não autenticado."},{status:401});const {data,error}=await supabase.rpc("viva_get_ai_quota");if(error)throw error;return NextResponse.json(data);}catch(error){console.error("VIVA quota status error",error);return NextResponse.json({error:"Não foi possível consultar seus créditos."},{status:500});}\n}\n\nexport async function POST(request:Request){
 let supabase:Awaited<ReturnType<typeof createClient>>|null=null;
 let reservationId:string|null=null;
 try{
  supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Faça login para conversar com a VIVA+."},{status:401});
  const parsed=schema.safeParse(await request.json());
  if(!parsed.success)return NextResponse.json({error:"Mensagem inválida. Use até 4.000 caracteres."},{status:400});
  if(!process.env.OPENAI_API_KEY)return NextResponse.json({error:"Assistente temporariamente indisponível."},{status:503});

  const message=parsed.data.message;
  const feature=parsed.data.feature??(/\b(menor preço|pesquise.*preço|radar de preço|compare preços|onde está mais barato)\b/i.test(message)?"radar":"chat");
  const estimatedInputTokens=Math.ceil((message.length+(parsed.data.history||[]).slice(-8).reduce((sum,item)=>sum+item.content.length,0)+900)/4);\n  const {data:guard,error:guardError}=await supabase.rpc("viva_reserve_ai_credits",{p_feature:feature,p_estimated_input_tokens:estimatedInputTokens});
  if(guardError){console.error("VIVA quota reservation failed",guardError);return NextResponse.json({error:"Não foi possível validar seus créditos. Tente novamente."},{status:503});}
  if(!guard?.allowed){
   const reason=guard?.reason||"daily_limit";
   const status=reason==="unauthenticated"?401:reason==="rate_limit"?429:reason==="feature_not_in_plan"?403:reason==="model_pricing_not_configured"?503:200;
   return NextResponse.json({state:reason==="daily_limit"?"limit_reached":"blocked",reason,used_credits:guard?.used_credits??0,daily_credits:guard?.daily_credits??0,extra_credits:guard?.extra_credits??0,reset_at:guard?.reset_at??null,required_plan:guard?.required_plan??null,message:reason==="daily_limit"?"Você usou seus créditos de hoje. Eles voltam à meia-noite, ou faça upgrade para continuar agora.":reason==="feature_not_in_plan"?"Esse recurso está disponível em um plano superior.":reason==="paused_global"||reason==="paused_user"?"A VIVA está temporariamente pausada.":reason==="global_budget"?"O limite diário de operação foi atingido. Tente novamente amanhã.":"Não foi possível liberar esta solicitação."},{status});
  }
  reservationId=guard.reservation_id;
  const modelKey=String(guard.model_key||"cheap");
  const configuredModel=modelKey==="balanced"?(process.env.OPENAI_MODEL_BALANCED||"gpt-6.1-terra"):(process.env.OPENAI_MODEL_CHEAP||"gpt-6-luna");
  if(configuredModel!==guard.model_id){
   await supabase.rpc("viva_release_ai_reservation",{p_reservation_id:reservationId});
   reservationId=null;
   return NextResponse.json({error:"O modelo configurado no servidor não corresponde ao preço cadastrado. Atualize OPENAI_MODEL_CHEAP/OPENAI_MODEL_BALANCED e o cadastro de preços antes de liberar a IA."},{status:503});
  }
  const history=(parsed.data.history||[]).slice(-Math.max(1,Math.min(8,Number(guard.history_messages)||8))).map(item=>({role:item.role,content:item.content}));
  const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
  const response=await client.responses.create({
   model:configuredModel,
   instructions:"Você é VIVA+, uma assistente pessoal acolhedora e prática. Responda em português brasileiro. Ajude a organizar agenda, hábitos, finanças pessoais e compras. Nunca invente dados nem afirme que registrou algo sem confirmação explícita. Antes de qualquer lançamento financeiro ou compromisso, apresente os dados para confirmação do usuário. Não afirme que pesquisou preços sem uma pesquisa real. Você não substitui consultoria financeira profissional.",
   input:history.length?history:[{role:"user",content:message}],
   max_output_tokens:Math.max(64,Math.min(16000,Number(guard.max_output_tokens)||300)),
  });
  const tokensIn=response.usage?.input_tokens??0;
  const tokensOut=response.usage?.output_tokens??0;
  const costUsd=(tokensIn*Number(guard.input_usd_per_million)+tokensOut*Number(guard.output_usd_per_million))/1_000_000;
  const costBrl=costUsd*Number(guard.usd_brl_rate||6.5)*1.25;
  const {error:settleError}=await supabase.rpc("viva_settle_ai_usage",{
   p_reservation_id:reservationId,p_model:configuredModel,p_tokens_in:tokensIn,p_tokens_out:tokensOut,p_cost_usd:costUsd,p_cost_brl:costBrl,
  });
  if(settleError){console.error("VIVA usage settlement failed",settleError);return NextResponse.json({error:"A resposta foi gerada, mas não foi possível fechar o registro de consumo. Tente novamente mais tarde."},{status:503});}
  reservationId=null;
  return NextResponse.json({answer:response.output_text||"Estou aqui com você. Pode me contar mais.",usage:{credits:guard.credits_cost,daily_used:guard.daily_used,daily_limit:guard.daily_limit,warning_80:guard.warning_80,tokens_in:tokensIn,tokens_out:tokensOut}});
 }catch(error){
  console.error("VIVA assistant error",error);
  if(supabase&&reservationId){try{await supabase.rpc("viva_release_ai_reservation",{p_reservation_id:reservationId});}catch(releaseError){console.error("VIVA reservation release failed",releaseError);}}
  return NextResponse.json({error:"Não foi possível responder agora. Tente novamente."},{status:500});
 }
}
