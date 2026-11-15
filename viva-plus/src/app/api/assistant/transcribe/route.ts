import OpenAI from "openai";
import {toFile} from "openai/uploads";
import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
export const runtime="nodejs";
export async function POST(req:Request){
 let supabase:Awaited<ReturnType<typeof createClient>>|null=null;let reservationId:string|null=null;
 try{
  supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Faça login para usar a voz."},{status:401});
  const form=await req.formData();const file=form.get("audio");const durationSeconds=Number(form.get("duration_seconds"));
  if(!(file instanceof File))return NextResponse.json({error:"Não recebi a gravação. Tente novamente."},{status:400});
  if(!Number.isFinite(durationSeconds)||durationSeconds<1||durationSeconds>60)return NextResponse.json({error:"A gravação deve ter entre 1 e 60 segundos."},{status:400});
  if(file.size<1||file.size>5*1024*1024)return NextResponse.json({error:"A gravação deve ter até 5 MB."},{status:413});
  const mimeType=file.type.split(";")[0].toLowerCase();const allowed=["audio/webm","audio/mp4","audio/ogg","audio/mpeg","audio/mp3","audio/wav","audio/x-m4a","audio/mpga"];
  if(!allowed.includes(mimeType))return NextResponse.json({error:"Formato de áudio não suportado neste navegador."},{status:415});
  if(!process.env.OPENAI_API_KEY)return NextResponse.json({error:"A transcrição por voz está temporariamente indisponível."},{status:503});
  const estimate=Math.min(20000,Math.max(500,Math.ceil(durationSeconds*333.34)));
  const {data:guard,error:guardError}=await supabase.rpc("viva_reserve_ai_credits",{p_feature:"voice",p_estimated_input_tokens:estimate,p_prefer_cheap:true});
  if(guardError){console.error("VIVA voice quota reservation failed",guardError);return NextResponse.json({error:"Não foi possível validar seus créditos de voz."},{status:503})}
  if(!guard?.allowed){const reason=guard?.reason||"daily_limit";const status=reason==="rate_limit"?429:reason==="feature_not_in_plan"?403:reason==="daily_limit"?200:503;const message=reason==="feature_not_in_plan"?"A transcrição de voz está disponível nos planos com Voz. Veja as opções em /planos.":reason==="daily_limit"?"Você atingiu o limite de créditos de hoje.":"A transcrição está temporariamente indisponível.";return NextResponse.json({state:reason==="daily_limit"?"limit_reached":"blocked",reason,message,used_credits:guard?.used_credits??0,daily_credits:guard?.daily_credits??0,extra_credits:guard?.extra_credits??0,required_plan:guard?.required_plan??null},{status})}
  reservationId=guard.reservation_id;const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
  const upload=await toFile(Buffer.from(await file.arrayBuffer()),file.name||"viva-voice.webm",{type:mimeType});
  const result=await client.audio.transcriptions.create({model:"gpt-transcribe",file:upload,language:"pt",prompt:"Português brasileiro. Preserve valores em reais, números, datas, nomes próprios e termos financeiros como VIVA+, Pix, despesa, receita, cartão e fatura."});
  const transcript=String(result.text||"").trim();const costUsd=(durationSeconds/60)*0.0045;const costBrl=costUsd*Number(guard.usd_brl_rate||6.5)*1.25;
  const {error:settleError}=await supabase.rpc("viva_settle_ai_usage",{p_reservation_id:reservationId,p_model:"gpt-transcribe",p_tokens_in:0,p_tokens_out:0,p_cost_usd:costUsd,p_cost_brl:costBrl});
  if(settleError){console.error("VIVA voice usage settlement failed",settleError);await supabase.rpc("viva_release_ai_reservation",{p_reservation_id:reservationId});reservationId=null;return NextResponse.json({error:"Não foi possível fechar o consumo da transcrição."},{status:503})}reservationId=null;
  const {data:quota}=await supabase.rpc("viva_get_ai_quota");
  if(!transcript)return NextResponse.json({error:"Não consegui entender o áudio. Fale mais perto do microfone e tente novamente.",usage:{credits:guard.credits_cost,daily_used:quota?.used_credits??guard.daily_used,daily_limit:quota?.daily_credits??guard.daily_credits,warning_80:quota?.warning_80??false}},{status:422});
  return NextResponse.json({text:transcript,usage:{credits:guard.credits_cost,daily_used:quota?.used_credits??guard.daily_used,daily_limit:quota?.daily_credits??guard.daily_credits,warning_80:quota?.warning_80??false}});
 }catch(error){console.error("VIVA audio transcription failed",error);if(supabase&&reservationId){try{await supabase.rpc("viva_release_ai_reservation",{p_reservation_id:reservationId})}catch(releaseError){console.error("VIVA voice reservation release failed",releaseError)}}return NextResponse.json({error:"Não consegui transcrever o áudio. Verifique o microfone e tente novamente."},{status:502})}
}
