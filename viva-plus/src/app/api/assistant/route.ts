import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { parseTransactionIntent } from "@/lib/finance-intent";

const normalizeModelId=(value:string)=>value.trim().toLowerCase().replace(/-\d{4}-\d{2}-\d{2}$/,"").trim();

const schema=z.object({
 message:z.string().trim().min(1).max(4000),
 history:z.array(z.object({role:z.enum(["user","assistant"]),content:z.string().max(4000)})).max(12).optional(),
 feature:z.enum(["chat","voice","photo","radar"]).optional(),
 imageDataUrl:z.string().max(4_200_000).optional(),
});

export async function GET(){
 try{
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Não autenticado."},{status:401});
  const {data,error}=await supabase.rpc("viva_get_ai_quota");
  if(error)throw error;
  return NextResponse.json(data);
 }catch(error){
  console.error("VIVA quota status error",error);
  return NextResponse.json({error:"Não foi possível consultar seus créditos."},{status:500});
 }
}

export async function POST(request:Request){
 let supabase:Awaited<ReturnType<typeof createClient>>|null=null;
 let reservationId:string|null=null;
 try{
  supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Faça login para conversar com a VIVA+."},{status:401});
  const parsed=schema.safeParse(await request.json());
  if(!parsed.success)return NextResponse.json({error:"Mensagem inválida. Use até 4.000 caracteres."},{status:400});
  const message=parsed.data.message;
  const imageDataUrl=parsed.data.imageDataUrl;
  if(imageDataUrl&&!/^data:image\/(png|jpeg|webp);base64,/i.test(imageDataUrl))return NextResponse.json({error:"Envie uma imagem JPG, PNG ou WebP válida."},{status:400});
  const lower=message.toLocaleLowerCase("pt-BR");
  const asksBills=/\\b(o que vence|contas? (?:a pagar|vencem)|quanto tenho a pagar|minhas contas|vencimentos)\\b/.test(lower);
  if(asksBills){
   const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
   const week=/semana/.test(lower);const end=new Date(today+"T12:00:00Z");end.setUTCDate(end.getUTCDate()+(week?7:30));
   const {data,error}=await supabase.from("viva_bills").select("name,amount,due_date,status").eq("user_id",user.id).neq("status","paid").lte("due_date",end.toISOString().slice(0,10)).order("due_date").limit(100);
   if(error)throw error;
   const bills=data||[];const sum=bills.reduce((n,b)=>n+Number(b.amount),0);
   const money=(n:number)=>n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
   const answer=bills.length?("Você tem "+money(sum)+" em contas a pagar"+(week?" nesta semana":" nos próximos 30 dias")+":\\n"+bills.map(b=>"- "+b.name+" · "+money(Number(b.amount))+" · "+new Date(b.due_date+"T12:00:00").toLocaleDateString("pt-BR")).join("\\n")):"Não encontrei contas em aberto nesse período.";
   return NextResponse.json({answer});
  }
  const billAmount=message.match(/(?:r\\$\\s*)?(\\d{1,3}(?:\\.\\d{3})*(?:,\\d{1,2})?|\\d+(?:,\\d{1,2})?)/i);
  const billDay=message.match(/\\bdia\\s+(\\d{1,2})\\b/i);
  if(/\\b(tenho que pagar|preciso pagar|pagar|vence)\\b/i.test(message)&&billAmount&&billDay){
   const amount=Number(billAmount[1].replace(/\\./g,"").replace(",","."));
   const day=Number(billDay[1]);const now=new Date();const due=new Date(Date.UTC(now.getFullYear(),now.getMonth(),day,12));
   if(due<new Date(Date.UTC(now.getFullYear(),now.getMonth(),new Date().getDate(),0)))due.setUTCMonth(due.getUTCMonth()+1);
   const name=message.replace(/tenho que pagar|preciso pagar|pagar|vence/ig,"").replace(billDay[0],"").replace(billAmount[0],"").replace(/[,.]/g," ").trim()||"Conta";
   if(amount>0&&day>=1&&day<=31)return NextResponse.json({billDraft:{name:name[0].toUpperCase()+name.slice(1),amount,due_date:due.toISOString().slice(0,10),recurrence:"once",installments:1,category:"Contas"}});
  }
  const financialIntent=parseTransactionIntent(message);
  if(financialIntent){
   if("clarification" in financialIntent)return NextResponse.json({clarification:true,amount:financialIntent.amount});
   return NextResponse.json(financialIntent);
  }
  if(!process.env.OPENAI_API_KEY)return NextResponse.json({error:"Assistente temporariamente indisponível."},{status:503});
  const isRadarRequest=/\b(menor preço|pesquise.*preço|radar de preço|compare preços|onde está mais barato)\b/i.test(message);
  const feature=parsed.data.feature==="photo"?"photo":parsed.data.feature==="voice"?"voice":isRadarRequest?"radar":"chat";
  const estimatedInputTokens=Math.ceil((message.length+(parsed.data.history||[]).slice(-8).reduce((sum,item)=>sum+item.content.length,0)+900)/4);
  const preferCheap=/\b(gastei|recebi|saldo|quanto sobra|quanto posso gastar|marca.*(hoje|amanhã)|compromisso|lembrete|anota.*(gasto|receita)|bom dia|boa tarde|boa noite|olá|ola)\b/i.test(message);
  const {data:guard,error:guardError}=await supabase.rpc("viva_reserve_ai_credits",{p_feature:feature,p_estimated_input_tokens:estimatedInputTokens,p_prefer_cheap:preferCheap});
  if(guardError){console.error("VIVA quota reservation failed",guardError);return NextResponse.json({error:"Não foi possível validar seus créditos. Tente novamente."},{status:503});}
  if(!guard?.allowed){
   const reason=guard?.reason||"daily_limit";
   const status=reason==="unauthenticated"?401:reason==="rate_limit"?429:reason==="feature_not_in_plan"?403:reason==="model_pricing_not_configured"?503:200;
   return NextResponse.json({state:reason==="daily_limit"?"limit_reached":"blocked",reason,used_credits:guard?.used_credits??0,daily_credits:guard?.daily_credits??0,extra_credits:guard?.extra_credits??0,reset_at:guard?.reset_at??null,required_plan:guard?.required_plan??null,message:reason==="daily_limit"?"Você usou seus créditos de hoje. Eles voltam à meia-noite, ou faça upgrade para continuar agora.":reason==="feature_not_in_plan"?"Esse recurso está disponível em um plano superior.":reason==="paused_global"||reason==="paused_user"?"A VIVA está temporariamente pausada.":reason==="global_budget"?"O limite diário de operação foi atingido. Tente novamente amanhã.":"Não foi possível liberar esta solicitação."},{status});
  }
  reservationId=guard.reservation_id;
  const modelKey=String(guard.model_key||"cheap");
  const envKey=modelKey==="balanced"?"OPENAI_MODEL_BALANCED":"OPENAI_MODEL_CHEAP";
  const configuredModel=process.env[envKey]||"";
  const normalizedConfigured=normalizeModelId(configuredModel);
  const normalizedPriced=normalizeModelId(String(guard.model_id||""));
  if(!normalizedConfigured||!normalizedPriced||normalizedConfigured!==normalizedPriced){
   const detail=`modelo sem preço cadastrado: ${configuredModel||"(variável ausente)"}; tamanho=${configuredModel.length}; variável=${envKey}; chave=${modelKey}; modelo_precificado=${String(guard.model_id||"(não encontrado)")}; tamanho_precificado=${String(guard.model_id||"").length}`;
   console.error("VIVA model/pricing mismatch",{configuredModel:`"${configuredModel}"`,configuredLength:configuredModel.length,pricedModel:`"${String(guard.model_id||"")}"`,pricedLength:String(guard.model_id||"").length,modelKey});
   try{await supabase.rpc("viva_log_admin_alert",{p_alert_type:"model_pricing_mismatch",p_detail:detail});}catch(alertError){console.error("VIVA admin alert failed",alertError);}
   await supabase.rpc("viva_release_ai_reservation",{p_reservation_id:reservationId});
   reservationId=null;
   return NextResponse.json({error:"A VIVA está em manutenção rápida. Tente novamente em instantes."},{status:503});
  }
  const history=(parsed.data.history||[]).slice(-Math.max(1,Math.min(8,Number(guard.history_messages)||8))).map(item=>({role:item.role,content:item.content}));
  const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
  const response=await client.responses.create({
   model:configuredModel.trim(),
   instructions:imageDataUrl?"Analise a foto de comprovante, nota fiscal ou recibo. Extraia apenas dados visíveis. Responda APENAS com JSON válido contendo os campos kind (expense ou income), amount (número), description (texto), occurred_on (data YYYY-MM-DD), category, payment_method e confidence (high, medium ou low). Não adivinhe campos ilegíveis; se não for comprovante, retorne amount 0 e confidence low.":"Você é VIVA+, uma assistente pessoal acolhedora e prática. Responda em português brasileiro. Ajude a organizar agenda, hábitos, finanças pessoais e compras. Nunca invente dados nem afirme que registrou algo sem confirmação explícita. Antes de qualquer lançamento financeiro ou compromisso, apresente os dados para confirmação do usuário. Não afirme que pesquisou preços sem uma pesquisa real. Você não substitui consultoria financeira profissional.",
   input:imageDataUrl?[...(history.length?history.slice(0,-1):[]),{role:"user",content:[{type:"input_text",text:message||"Extraia os dados financeiros desta imagem."},{type:"input_image",image_url:imageDataUrl,detail:"auto"}]}]:(history.length?history:[{role:"user",content:message}]),
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
  if(imageDataUrl){
   let extracted:Record<string,unknown>|null=null;
   try{extracted=JSON.parse(response.output_text||"{}");}catch(parseError){console.error("VIVA receipt extraction parse failed",parseError);}
   if(extracted&&Number(extracted.amount)>0&&/^\d{4}-\d{2}-\d{2}$/.test(String(extracted.occurred_on||""))){
    return NextResponse.json({transactionDraft:{kind:extracted.kind==="income"?"income":"expense",amount:Number(extracted.amount),description:String(extracted.description||"Comprovante").slice(0,240),occurred_on:String(extracted.occurred_on),category:String(extracted.category||"Outros"),payment_method:String(extracted.payment_method||"Outro")},answer:"Identifiquei os dados da imagem. Confira e confirme antes de registrar.",usage:{credits:guard.credits_cost,daily_used:guard.daily_used,daily_limit:guard.daily_limit,warning_80:guard.warning_80,tokens_in:tokensIn,tokens_out:tokensOut}});
   }
   return NextResponse.json({answer:"Não consegui extrair um valor confiável dessa imagem. Você pode digitar os dados ou enviar uma foto mais nítida.",usage:{credits:guard.credits_cost,daily_used:guard.daily_used,daily_limit:guard.daily_limit,warning_80:guard.warning_80,tokens_in:tokensIn,tokens_out:tokensOut}});
  }
  return NextResponse.json({answer:response.output_text||"Estou aqui com você. Pode me contar mais.",usage:{credits:guard.credits_cost,daily_used:guard.daily_used,daily_limit:guard.daily_limit,warning_80:guard.warning_80,tokens_in:tokensIn,tokens_out:tokensOut}});
 }catch(error){
  console.error("VIVA assistant error",error);
  if(supabase&&reservationId){try{await supabase.rpc("viva_release_ai_reservation",{p_reservation_id:reservationId});}catch(releaseError){console.error("VIVA reservation release failed",releaseError);}}
  return NextResponse.json({error:"Não foi possível responder agora. Tente novamente."},{status:500});
 }
}
