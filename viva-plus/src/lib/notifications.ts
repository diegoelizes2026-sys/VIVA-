import {createAdminClient} from "@/lib/supabase/admin";
import {sendWebPush} from "@/lib/web-push";
type Delivery={id:string;user_id:string;event_id:string|null;notification_type:string;group_key:string|null;dedupe_key:string;scheduled_for:string;title:string;body:string;target_url:string;payload:Record<string,unknown>;attempt_index:number;attempts:number;status:string};
async function log(admin:ReturnType<typeof createAdminClient>,row:{user_id:string;delivery_id:string|null;notification_type:string;status:"sent"|"failed"|"opened"|"acknowledged"|"snoozed";title?:string;detail?:string}){await admin.from("viva_notification_logs").insert(row)}
export async function sendDelivery(input:Delivery){
 const admin=createAdminClient();let delivery=input;
 if(delivery.status==="pending"){
  const {data:claimed,error}=await admin.from("viva_notification_deliveries").update({status:"processing",attempts:Number(delivery.attempts||0)+1,updated_at:new Date().toISOString()}).eq("id",delivery.id).eq("status","pending").select("*").maybeSingle();
  if(error)throw error;if(!claimed)throw new Error("Este envio já foi processado.");delivery=claimed as Delivery;
 }
 if(delivery.status!=="processing")throw new Error("Este envio não está pendente.");
 const {data:subscriptions,error}=await admin.from("viva_push_subscriptions").select("id,endpoint,p256dh,auth_key").eq("user_id",delivery.user_id);
 if(error)throw error;if(!subscriptions?.length)throw new Error("Nenhum aparelho ativado para receber notificações.");
 const pushPayload={...delivery.payload,title:delivery.title,body:delivery.body,targetUrl:delivery.target_url,deliveryId:delivery.id,groupKey:delivery.group_key,eventId:delivery.event_id,notificationType:delivery.notification_type,tag:delivery.group_key||delivery.dedupe_key,requireInteraction:delivery.notification_type==="agenda",renotify:delivery.notification_type==="agenda",vibrate:delivery.notification_type==="agenda"?[300,100,300,100,600]:[120,60,120],actions:delivery.notification_type==="agenda"?[{action:"ack",title:"Estou ciente"},{action:"snooze",title:"Adiar 10 min"}]:[{action:"open",title:"Abrir"}]};
 let sent=0;const failures:string[]=[];
 for(const subscription of subscriptions){try{await sendWebPush(subscription,pushPayload);sent++;await admin.from("viva_push_subscriptions").update({last_success_at:new Date().toISOString()}).eq("id",subscription.id)}catch(error){const detail=error instanceof Error?error.message:"Falha desconhecida";failures.push(detail);if(/Push HTTP (404|410)/.test(detail))await admin.from("viva_push_subscriptions").delete().eq("id",subscription.id)}}
 if(!sent)throw new Error(failures[0]||"Nenhum aparelho recebeu o push.");
 await log(admin,{user_id:delivery.user_id,delivery_id:delivery.id,notification_type:delivery.notification_type,status:"sent",title:delivery.title,detail:sent+" aparelho(s) receberam o envio."});
 const now=new Date().toISOString();
 const {data:updated,error:updateError}=await admin.from("viva_notification_deliveries").update({status:"sent",sent_at:now,attempts:Math.max(1,delivery.attempts),last_error:failures.length?failures.join(" | ").slice(0,500):null,updated_at:now}).eq("id",delivery.id).eq("status","processing").select("id").maybeSingle();
 if(updateError)throw updateError;
 if(!updated)return {sent,failed:failures.length};
 if(delivery.notification_type==="agenda"&&delivery.group_key&&delivery.attempt_index===0){
  const rows=[5,10].map((minutes,index)=>({user_id:delivery.user_id,event_id:delivery.event_id,notification_type:"agenda",group_key:delivery.group_key,dedupe_key:delivery.group_key+":repeat:"+(index+1),scheduled_for:new Date(Date.now()+minutes*60000).toISOString(),title:delivery.title,body:delivery.body+" (lembrete "+(index+2)+"/3)",target_url:delivery.target_url,payload:delivery.payload,status:"pending",attempt_index:index+1}));
  const {error:repeatError}=await admin.from("viva_notification_deliveries").upsert(rows,{onConflict:"dedupe_key",ignoreDuplicates:true});if(repeatError)console.error("VIVA alarm repeats enqueue failed",repeatError);
  const {data:latest}=await admin.from("viva_notification_deliveries").select("status").eq("id",delivery.id).maybeSingle();
  if(latest?.status==="acknowledged"||latest?.status==="cancelled")await admin.from("viva_notification_deliveries").update({status:latest.status}).eq("group_key",delivery.group_key).eq("status","pending");
 }
 return {sent,failed:failures.length};
}
export async function logDeliveryFailure(delivery:Delivery,error:unknown){
 const admin=createAdminClient();const detail=error instanceof Error?error.message:"Falha desconhecida";const now=new Date().toISOString();
 await admin.from("viva_notification_deliveries").update({status:"failed",attempts:Math.max(1,delivery.attempts),last_error:detail.slice(0,500),updated_at:now}).eq("id",delivery.id).eq("status","processing");
 await log(admin,{user_id:delivery.user_id,delivery_id:delivery.id,notification_type:delivery.notification_type,status:"failed",title:delivery.title,detail:detail.slice(0,500)});
}
export async function createDelivery(input:{user_id:string;event_id?:string|null;notification_type:"morning"|"agenda"|"bill"|"test"|"evening"|"trial"|"report"|"activation";group_key?:string|null;dedupe_key:string;scheduled_for?:string;title:string;body:string;target_url?:string;payload?:Record<string,unknown>}){
 const admin=createAdminClient();
 const {data,error}=await admin.from("viva_notification_deliveries").upsert({user_id:input.user_id,event_id:input.event_id||null,notification_type:input.notification_type,group_key:input.group_key||null,dedupe_key:input.dedupe_key,scheduled_for:input.scheduled_for||new Date().toISOString(),title:input.title,body:input.body,target_url:input.target_url||"/assistente",payload:input.payload||{},status:"pending"},{onConflict:"dedupe_key",ignoreDuplicates:true}).select().maybeSingle();
 if(error)throw error;if(data)return data;
 const existing=await admin.from("viva_notification_deliveries").select("*").eq("dedupe_key",input.dedupe_key).maybeSingle();if(existing.error)throw existing.error;return existing.data;
}
