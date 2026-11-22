import {NextResponse} from "next/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {createDelivery,sendDelivery,logDeliveryFailure} from "@/lib/notifications";
import {loadTodayBudget} from "@/lib/daily-budget-load";
export const runtime="nodejs";
type Settings={user_id:string;timezone:string;morning_enabled:boolean;morning_time:string;evening_enabled?:boolean;evening_time?:string;agenda_enabled:boolean;bills_enabled:boolean;silent_start:string|null;silent_end:string|null};
function parts(date:Date,timeZone:string){const p=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(date);return Object.fromEntries(p.filter(x=>x.type!=="literal").map(x=>[x.type,x.value])) as Record<string,string>}
function localDate(date:Date,tz:string){const p=parts(date,tz);return p.year+"-"+p.month+"-"+p.day}
function zonedUtc(date:string,time:string,tz:string){const [y,m,d]=date.split("-").map(Number);const [hh,mm]=time.slice(0,5).split(":").map(Number);const guess=Date.UTC(y,m-1,d,hh,mm,0);const p=parts(new Date(guess),tz);const asUtc=Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute),Number(p.second));return new Date(guess-(asUtc-guess))}
function addDays(date:string,n:number){const [y,m,d]=date.split("-").map(Number);return new Date(Date.UTC(y,m-1,d+n)).toISOString().slice(0,10)}
function hhmm(date:Date,tz:string){const p=parts(date,tz);return p.hour+":"+p.minute}
function money(value:number){return value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
function isSilent(now:Date,s:Settings){if(!s.silent_start||!s.silent_end)return false;const t=hhmm(now,s.timezone);const a=s.silent_start.slice(0,5),b=s.silent_end.slice(0,5);return a===b?false:a<b?t>=a&&t<b:t>=a||t<b}
function nextAllowed(now:Date,s:Settings){const end=s.silent_end!.slice(0,5);const today=localDate(now,s.timezone);const current=hhmm(now,s.timezone);const start=s.silent_start!.slice(0,5);const nextDate=start>end&&current>=start?addDays(today,1):today;return zonedUtc(nextDate,end,s.timezone).toISOString()}
async function buildMorning(admin:ReturnType<typeof createAdminClient>,s:Settings,now:Date){
 const tz=s.timezone||"America/Sao_Paulo";const today=localDate(now,tz);const tomorrow=addDays(today,1);const start=zonedUtc(today,"00:00",tz).toISOString();const end=zonedUtc(addDays(today,1),"00:00",tz).toISOString();
 const [profile,events,bills,day]=await Promise.all([
  admin.from("viva_profiles").select("full_name").eq("id",s.user_id).maybeSingle(),
  admin.from("viva_events").select("title,start_at").eq("user_id",s.user_id).gte("start_at",start).lt("start_at",end).order("start_at").limit(20),
  s.bills_enabled?admin.from("viva_bills").select("name,amount").eq("user_id",s.user_id).eq("due_date",tomorrow).eq("status","pending").limit(20):Promise.resolve({data:[],error:null}),
  loadTodayBudget(admin,s.user_id,today).catch(()=>null)
 ]);
 for(const r of [profile,events,bills])if(r.error)throw r.error;
 const fullName=String(profile.data?.full_name||"").trim();const name=fullName.split(/\s+/)[0]||"tudo bem";
 const appointments=(events.data||[]).map(e=>new Intl.DateTimeFormat("pt-BR",{timeZone:tz,hour:"2-digit",minute:"2-digit"}).format(new Date(e.start_at))+" "+e.title);
 // Número do dia: a mesma conta da tela inicial (ciclo de pagamento, contas a vencer e limite diário).
 const b=day?.budget;const dot=b&&b.mode!=="setup"?{green:"🟢",amber:"🟡",red:"🔴"}[b.status]:"";
 const headline=b&&b.mode!=="setup"?"Hoje você pode gastar "+money(Math.max(0,b.remaining))+" "+dot+(day!.streak>=2?" · 🔥 "+day!.streak+" dias seguidos":"")+".":null;
 const sections:string[]=[];if(headline)sections.push(headline);
 if(b&&b.mode==="dynamic"&&b.forecast?.kind==="runs_out"&&b.forecast.daysEarly>0)sections.push("Atenção: no ritmo atual, o dinheiro acaba "+b.forecast.daysEarly+" dias antes de "+b.horizonLabel+".");
 sections.push(appointments.length?"Agenda: "+appointments.join(" · "):"Dia livre na agenda.");
 if((bills.data||[]).length)sections.push("Vence amanhã: "+(bills.data||[]).map(b=>b.name+" "+money(Number(b.amount))).join(" · "));
 return {body:sections.join(" "),fullName,today,name};
}
async function enqueueMorning(admin:ReturnType<typeof createAdminClient>,now:Date){
 const {data:profiles}=await admin.from("viva_profiles").select("id").limit(5000);if(profiles?.length)await admin.from("viva_notification_settings").upsert(profiles.map(p=>({user_id:p.id})),{onConflict:"user_id",ignoreDuplicates:true});
 const {data:settings,error}=await admin.from("viva_notification_settings").select("*").eq("morning_enabled",true);if(error)throw error;const {data:subs}=await admin.from("viva_push_subscriptions").select("user_id");const subscribed=new Set((subs||[]).map(x=>x.user_id));let count=0;
 for(const raw of settings||[]){const s=raw as Settings;if(!subscribed.has(s.user_id))continue;const tz=s.timezone||"America/Sao_Paulo";const today=localDate(now,tz);const scheduled=zonedUtc(today,s.morning_time,tz);if(now.getTime()<scheduled.getTime()||now.getTime()>scheduled.getTime()+60*60000)continue;const summary=await buildMorning(admin,s,now);const delivery=await createDelivery({user_id:s.user_id,notification_type:"morning",dedupe_key:"morning:"+s.user_id+":"+today,scheduled_for:scheduled.toISOString(),title:"Bom dia"+(summary.fullName?", "+summary.name:"")+"! ☀️",body:summary.body,target_url:"/meu-dia",payload:{type:"morning",date:today}});if(delivery)count++}
 return count;
}
// Lembrete da noite: quanto gastou hoje frente ao valor do dia + "esqueceu de lançar algo?".
// Só roda depois da migração 0023 (evening_enabled precisa existir e ser true); falhas não derrubam o resto do cron.
async function enqueueEvening(admin:ReturnType<typeof createAdminClient>,now:Date){
 try{
  const {data:settings,error}=await admin.from("viva_notification_settings").select("*");if(error)throw error;
  const {data:subs}=await admin.from("viva_push_subscriptions").select("user_id");const subscribed=new Set((subs||[]).map(x=>x.user_id));let count=0;
  for(const raw of settings||[]){
   const s=raw as Settings;if(s.evening_enabled!==true||!subscribed.has(s.user_id))continue;
   const tz=s.timezone||"America/Sao_Paulo";const today=localDate(now,tz);const scheduled=zonedUtc(today,String(s.evening_time||"20:00"),tz);
   if(now.getTime()<scheduled.getTime()||now.getTime()>scheduled.getTime()+60*60000)continue;
   const day=await loadTodayBudget(admin,s.user_id,today).catch(()=>null);const b=day?.budget;if(!b||b.mode==="setup")continue;
   const dot={green:"🟢",amber:"🟡",red:"🔴"}[b.status];
   let body=b.spentToday<=0?"Não vi nenhum gasto hoje. Gastou alguma coisa? Lance agora para o valor de amanhã ficar certo."
    :b.remaining<0?"Hoje passou "+money(-b.remaining)+" do valor do dia. Tudo bem: amanhã o valor se ajusta. Esqueceu de lançar algo?"
    :"Hoje você gastou "+money(b.spentToday)+" de "+money(b.allowance)+" "+dot+". Esqueceu de lançar alguma coisa?";
   if(day!.streak>=2&&b.remaining>=0)body+=" 🔥 "+day!.streak+" dias seguidos, continue assim!";
   const delivery=await createDelivery({user_id:s.user_id,notification_type:"evening",dedupe_key:"evening:"+s.user_id+":"+today,scheduled_for:scheduled.toISOString(),title:"Como foi o seu dia? 🌙",body,target_url:"/meu-dia",payload:{type:"evening",date:today}});
   if(delivery)count++;
  }
  return count;
 }catch(e){console.error("VIVA evening reminder skipped",e);return 0}
}
async function enqueueAgenda(admin:ReturnType<typeof createAdminClient>,now:Date){
 const {data:subs}=await admin.from("viva_push_subscriptions").select("user_id");const subscribed=new Set((subs||[]).map(x=>x.user_id));const {data:events,error}=await admin.from("viva_events").select("id,user_id,title,start_at,reminder_enabled,reminder_before_minutes,reminder_at_start").eq("reminder_enabled",true).gte("start_at",new Date(now.getTime()-15*60000).toISOString()).lte("start_at",new Date(now.getTime()+25*60*60*1000).toISOString()).limit(500);if(error)throw error;const userIds=[...new Set((events||[]).map(e=>e.user_id))];const {data:userSettings}=userIds.length?await admin.from("viva_notification_settings").select("user_id,timezone").in("user_id",userIds):{data:[]};const timezoneByUser=new Map((userSettings||[]).map(s=>[s.user_id,s.timezone||"America/Sao_Paulo"] as [string,string]));let count=0;
 for(const event of events||[]){if(!subscribed.has(event.user_id))continue;const start=new Date(event.start_at);const startText=hhmm(start,timezoneByUser.get(event.user_id)||"America/Sao_Paulo");const common={user_id:event.user_id,event_id:event.id,notification_type:"agenda" as const,title:"Lembrete: "+event.title,body:"Seu compromisso começa "+(start<=now?"agora.":"às "+startText+".")+" Toque em Estou ciente para parar os avisos.",target_url:"/agenda?alarme="+event.id,payload:{type:"agenda",eventId:event.id,eventTitle:event.title,startAt:event.start_at}};
  if(Number(event.reminder_before_minutes)>0){const scheduled=new Date(start.getTime()-Number(event.reminder_before_minutes)*60000);const delivery=await createDelivery({...common,group_key:"agenda:"+event.id+":before:"+start.toISOString(),dedupe_key:"agenda:"+event.id+":before:"+start.toISOString(),scheduled_for:scheduled.toISOString()});if(delivery)count++}
  if(event.reminder_at_start){const delivery=await createDelivery({...common,group_key:"agenda:"+event.id+":start:"+start.toISOString(),dedupe_key:"agenda:"+event.id+":start:"+start.toISOString(),scheduled_for:start.toISOString()});if(delivery)count++}
 }
 return count;
}
async function enqueueBills(admin:ReturnType<typeof createAdminClient>,now:Date){
 const {data:subs}=await admin.from("viva_push_subscriptions").select("user_id");const subscribed=new Set((subs||[]).map(x=>x.user_id));if(!subscribed.size)return 0;
 const {data:settings,error:settingsError}=await admin.from("viva_notification_settings").select("user_id,timezone,bills_enabled").in("user_id",[...subscribed]);if(settingsError)throw settingsError;
 const settingsByUser=new Map((settings||[]).map(s=>[s.user_id,s] as const));
 const defaultTz="America/Sao_Paulo";const today=localDate(now,defaultTz);const until=addDays(today,1);
 const {data:bills,error}=await admin.from("viva_bills").select("id,user_id,name,amount,due_date,status,reminder_snoozed_until").in("status",["pending","overdue"]).lte("due_date",until).limit(1000);if(error)throw error;
 let count=0;
 for(const bill of bills||[]){if(!subscribed.has(bill.user_id))continue;const setting=settingsByUser.get(bill.user_id);if(setting?.bills_enabled===false)continue;const tz=setting?.timezone||defaultTz;const localToday=localDate(now,tz);const due=String(bill.due_date);const snoozed=String(bill.reminder_snoozed_until||"");if(snoozed&&snoozed>localToday)continue;
  const moneyLabel=money(Number(bill.amount));const common={user_id:bill.user_id,notification_type:"bill" as const,title:due<localToday?"Conta em atraso":"Conta a vencer",body:due<localToday?bill.name+" está em atraso. Valor: "+moneyLabel+". Abra o VIVA+ para regularizar.":bill.name+" vence "+(due===localToday?"hoje":"amanhã")+". Valor: "+moneyLabel+".",target_url:"/contas",payload:{type:"bill",billId:bill.id,billName:bill.name,dueDate:due,amount:Number(bill.amount)}};
  if(due>=localToday){const dueAt=zonedUtc(due,"08:00",tz);const delivery=await createDelivery({...common,group_key:"bill:"+bill.id+":due",dedupe_key:"bill:"+bill.id+":due",scheduled_for:dueAt.toISOString()});if(delivery)count++}
  else{const overdueAt=zonedUtc(addDays(due,1),"08:00",tz);const delivery=await createDelivery({...common,group_key:"bill:"+bill.id+":overdue",dedupe_key:"bill:"+bill.id+":overdue",scheduled_for:overdueAt.toISOString()});if(delivery)count++}
 }
 return count;
}
async function runCron(req:Request){try{const secret=process.env.CRON_SECRET;if(!secret||req.headers.get("authorization")!=="Bearer "+secret)return NextResponse.json({error:"Não autorizado."},{status:401});const admin=createAdminClient();const now=new Date();const [morningQueued,agendaQueued,billsQueued,eveningQueued]=await Promise.all([enqueueMorning(admin,now),enqueueAgenda(admin,now),enqueueBills(admin,now),enqueueEvening(admin,now)]);const {data:due,error}=await admin.from("viva_notification_deliveries").select("*").eq("status","pending").lte("scheduled_for",now.toISOString()).order("scheduled_for").limit(100);if(error)throw error;let sent=0,failed=0,skipped=0;for(const item of due||[]){const {data:claimed,error:claimError}=await admin.from("viva_notification_deliveries").update({status:"processing",attempts:Number(item.attempts||0)+1,updated_at:now.toISOString()}).eq("id",item.id).eq("status","pending").select("*").maybeSingle();if(claimError)throw claimError;if(!claimed)continue;const {data:settings}=await admin.from("viva_notification_settings").select("*").eq("user_id",item.user_id).maybeSingle();const s=(settings||{user_id:item.user_id,timezone:"America/Sao_Paulo",morning_enabled:true,agenda_enabled:true,bills_enabled:true}) as Settings;if(item.notification_type==="bill"&&item.payload?.billId){const {data:bill,error:billError}=await admin.from("viva_bills").select("status").eq("id",String(item.payload.billId)).eq("user_id",item.user_id).maybeSingle();if(billError)throw billError;if(!bill||bill.status==="paid"){await admin.from("viva_notification_deliveries").update({status:"cancelled",updated_at:now.toISOString()}).eq("id",item.id);skipped++;continue}}const enabled=item.notification_type==="morning"?s.morning_enabled:item.notification_type==="agenda"?s.agenda_enabled:item.notification_type==="bill"?s.bills_enabled:true;if(!enabled){await admin.from("viva_notification_deliveries").update({status:"cancelled",updated_at:now.toISOString()}).eq("id",item.id);skipped++;continue}if(isSilent(now,s)){await admin.from("viva_notification_deliveries").update({status:"pending",scheduled_for:nextAllowed(now,s),updated_at:now.toISOString()}).eq("id",item.id);skipped++;continue}try{await sendDelivery(claimed as Parameters<typeof sendDelivery>[0]);sent++}catch(e){await logDeliveryFailure(claimed as Parameters<typeof logDeliveryFailure>[0],e);failed++}}return NextResponse.json({ok:true,morningQueued,agendaQueued,billsQueued,eveningQueued,processed:(due||[]).length,sent,failed,skipped,at:now.toISOString()})}catch(e){console.error("VIVA notification cron failed",e);return NextResponse.json({error:e instanceof Error?e.message:"Falha no agendador."},{status:500})}}

export async function GET(req:Request){return runCron(req)}
export async function POST(req:Request){return runCron(req)}
