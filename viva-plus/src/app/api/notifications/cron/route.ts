import {NextResponse} from "next/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {createDelivery,sendDelivery,logDeliveryFailure} from "@/lib/notifications";
import {loadTodayBudget} from "@/lib/daily-budget-load";
import {SITE_URL,sendWhatsappText,sendWhatsappTemplate} from "@/lib/whatsapp";
import {buildReport,monthName,reportMessage,reportRange,type ReportPeriod} from "@/lib/report";
import {emailConfigured,emailOnce} from "@/lib/email";
import {activationEmail,reportEmail,trialEndingEmail,winbackEmail} from "@/lib/email-messages";
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
 // Partes soltas para o "bom dia" do WhatsApp (que monta o próprio texto).
 const value=b&&b.mode!=="setup"?money(Math.max(0,b.remaining)):null;
 const extras:string[]=[];
 if(b&&b.mode==="dynamic"&&b.forecast?.kind==="runs_out"&&b.forecast.daysEarly>0)extras.push("⚠️ No ritmo atual, o dinheiro acaba "+b.forecast.daysEarly+" dias antes de "+b.horizonLabel+".");
 if(appointments.length)extras.push("📅 Agenda: "+appointments.join(" · "));
 if((bills.data||[]).length)extras.push("🧾 Vence amanhã: "+(bills.data||[]).map(x=>x.name+" "+money(Number(x.amount))).join(" · "));
 return {body:sections.join(" "),fullName,today,name,value,dot,streak:day?.streak||0,extras};
}
async function enqueueMorning(admin:ReturnType<typeof createAdminClient>,now:Date){
 const {data:profiles}=await admin.from("viva_profiles").select("id").limit(5000);if(profiles?.length)await admin.from("viva_notification_settings").upsert(profiles.map(p=>({user_id:p.id})),{onConflict:"user_id",ignoreDuplicates:true});
 const {data:settings,error}=await admin.from("viva_notification_settings").select("*").eq("morning_enabled",true);if(error)throw error;const {data:subs}=await admin.from("viva_push_subscriptions").select("user_id");const subscribed=new Set((subs||[]).map(x=>x.user_id));let count=0;
 for(const raw of settings||[]){const s=raw as Settings;if(!subscribed.has(s.user_id))continue;const tz=s.timezone||"America/Sao_Paulo";const today=localDate(now,tz);const scheduled=zonedUtc(today,s.morning_time,tz);if(now.getTime()<scheduled.getTime()||now.getTime()>scheduled.getTime()+60*60000)continue;const summary=await buildMorning(admin,s,now);const delivery=await createDelivery({user_id:s.user_id,notification_type:"morning",dedupe_key:"morning:"+s.user_id+":"+today,scheduled_for:scheduled.toISOString(),title:"Bom dia"+(summary.fullName?", "+summary.name:"")+"! ☀️",body:summary.body,target_url:"/meu-dia",payload:{type:"morning",date:today}});if(delivery)count++}
 return count;
}
// Liga o valor do dia ao objetivo nº 1 de quem usa o VIVA: sair das dívidas.
// Usa só o que a pessoa contou no onboarding (total, quanto consegue pagar por mês, tipos) e o progresso da meta.
async function debtLine(admin:ReturnType<typeof createAdminClient>,userId:string,today:string){
 const [{data:fp},{data:goal}]=await Promise.all([
  admin.from("viva_finance_profiles").select("has_debts,debt_total,debt_payment_capacity,debt_types").eq("user_id",userId).maybeSingle(),
  admin.from("viva_financial_goals").select("target_amount,current_amount").eq("user_id",userId).ilike("title","%dívida%").order("created_at",{ascending:false}).limit(1).maybeSingle()
 ]);
 if(!fp?.has_debts)return null;
 const total=Number(goal?.target_amount??fp.debt_total??0);const paid=Math.max(0,Number(goal?.current_amount??0));
 const left=Math.max(0,total-paid);const per=Number(fp.debt_payment_capacity??0);
 const lines:string[]=[];
 if(total>0&&left===0)lines.push("🎉 Sua meta de sair das dívidas está quitada no VIVA. Agora o que sobrar pode virar reserva!");
 else if(left>0&&per>0){const months=Math.ceil(left/per);lines.push("🎯 *Sair das dívidas:* faltam "+money(left)+". Separando "+money(per)+" por mês, você fica livre em "+months+(months===1?" mês":" meses")+". Ficar dentro do valor de hoje é o que garante essa parcela.")}
 else if(left>0)lines.push("🎯 *Sair das dívidas:* faltam "+money(left)+". Cada dia dentro do valor é dinheiro que sobra pra ela.");
 else lines.push("🎯 Cada dia dentro do valor é dinheiro que sobra pra sair das dívidas.");
 // Uma vez por semana (segunda), a dica de qual dívida atacar primeiro.
 const monday=new Date(today+"T12:00:00Z").getUTCDay()===1;
 const types=Array.isArray(fp.debt_types)?(fp.debt_types as string[]):[];
 if(monday&&(types.includes("cartao")||types.includes("cheque_especial")))lines.push("💡 Dica da semana: comece por "+(types.includes("cartao")?"cartão":"cheque especial")+", que tem os juros mais altos. Me pergunte \"como negociar minha dívida\" que eu te ajudo.");
 return lines.join("\n");
}

// "Bom dia" pelo WhatsApp com o número do dia, no horário da manhã da pessoa (padrão 7h30).
// É o ritual que traz a pessoa de volta todo dia sem ela precisar lembrar de abrir o app.
// Regra da Meta: texto comum só chega para quem falou com a VIVA nas últimas 24h. Fora dessa janela,
// só vai se existir um modelo aprovado (variável WHATSAPP_TEMPLATE_BOM_DIA, com {{1}} = valor do dia).
// A resposta da pessoa ("café 8") reabre a janela, então quem responde continua recebendo por texto.
async function enqueueMorningWhatsapp(admin:ReturnType<typeof createAdminClient>,now:Date){
 try{
  const {data:links,error}=await admin.from("viva_whatsapp_links").select("user_id,wa_id,last_inbound_at,history").not("wa_id","is",null).limit(5000);if(error)throw error;
  if(!links?.length)return 0;
  const {data:settingsRows}=await admin.from("viva_notification_settings").select("*").in("user_id",links.map(l=>l.user_id));
  const byUser=new Map((settingsRows||[]).map(r=>[r.user_id as string,r as Settings] as const));
  const template=(process.env.WHATSAPP_TEMPLATE_BOM_DIA||"").trim();
  const templateLang=(process.env.WHATSAPP_TEMPLATE_BOM_DIA_LANG||"pt_BR").trim();
  let count=0;
  for(const l of links){
   const s=byUser.get(l.user_id)||{user_id:l.user_id,timezone:"America/Sao_Paulo",morning_enabled:true,morning_time:"07:30",agenda_enabled:true,bills_enabled:true,silent_start:null,silent_end:null};
   if(s.morning_enabled===false)continue;
   const tz=s.timezone||"America/Sao_Paulo";const today=localDate(now,tz);const scheduled=zonedUtc(today,String(s.morning_time||"07:30"),tz);
   if(now.getTime()<scheduled.getTime()||now.getTime()>scheduled.getTime()+60*60000)continue;
   const inWindow=!!l.last_inbound_at&&now.getTime()-new Date(l.last_inbound_at).getTime()<23*3600000;
   if(!inWindow&&!template)continue;
   const key="morning:wa:"+l.user_id+":"+today;
   // Reserva antes de enviar: se o cron rodar duas vezes, só um envia.
   const {data:claimed,error:claimError}=await admin.from("viva_notification_deliveries").insert({user_id:l.user_id,notification_type:"morning",dedupe_key:key,scheduled_for:scheduled.toISOString(),title:"Bom dia (WhatsApp)",body:"",target_url:"/meu-dia",payload:{type:"morning",channel:"whatsapp",date:today,template:!inWindow},status:"processing"}).select("id").maybeSingle();
   if(claimError){if(claimError.code==="23505")continue;throw claimError}
   if(!claimed)continue;
   const m=await buildMorning(admin,s,now).catch(()=>null);
   const en=Array.isArray(l.history)&&[...(l.history as {role?:string;lang?:string}[])].reverse().find(h=>h.role==="user"&&h.lang)?.lang==="en";
   let text="";let ok=false;
   if(inWindow){
    const debt=!en&&m?.value?await debtLine(admin,l.user_id,m.today).catch(()=>null):null;
    const hi=m&&m.fullName?", "+m.name:"";
    if(m?.value){
     text=en
      ?"☀️ Good morning"+hi+"!\n\n*Today you can spend "+m.value+"* "+m.dot+(m.streak>=2?" · 🔥 "+m.streak+" days in a row":"")+"\n\nSend me today's expenses here (e.g. *coffee 8*) and I'll keep it updated 💜\n\n_To stop these messages, reply *parar bom dia*._"
      :"☀️ Bom dia"+hi+"!\n\n*Hoje você pode gastar "+m.value+"* "+m.dot+(m.streak>=2?" · 🔥 "+m.streak+" dias seguidos":"")+(debt?"\n\n"+debt:"")+(m.extras.length?"\n\n"+m.extras.join("\n"):"")+"\n\nMe manda os gastos do dia por aqui (ex.: *café 8*) que eu vou atualizando 💜\n\n_Para não receber mais, responda *parar bom dia*._";
    }else{
     text=en
      ?"☀️ Good morning"+hi+"! I still don't know how much you can spend per day. Finish your 3-minute setup and I'll tell you every morning: "+SITE_URL+"/boas-vindas"
      :"☀️ Bom dia"+hi+"! Ainda não sei quanto você pode gastar por dia. Termine seu planejamento (leva 3 minutos) e eu passo a te dizer toda manhã: "+SITE_URL+"/boas-vindas\n\n_Para não receber mais, responda *parar bom dia*._";
    }
    ok=await sendWhatsappText(l.wa_id as string,text);
   }else if(m?.value){
    text="[modelo "+template+"] "+m.value;
    ok=await sendWhatsappTemplate(l.wa_id as string,template,[m.value],templateLang);
   }
   await admin.from("viva_notification_deliveries").update({status:ok?"sent":text?"failed":"cancelled",body:text.slice(0,1000),sent_at:ok?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq("id",claimed.id);
   if(ok)count++;
  }
  return count;
 }catch(e){console.error("VIVA morning WhatsApp skipped",e);return 0}
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
// Teste grátis do Pro: no 5º dia (faltando 2 dias) mostra o que a VIVA já fez e convida a continuar.
// Vai por push e, se a pessoa falou com a VIVA no WhatsApp nas últimas 24h (janela da Meta), também por lá.
async function enqueueTrialReminder(admin:ReturnType<typeof createAdminClient>,now:Date){
 try{
  const {data:trials,error}=await admin.from("viva_subscriptions").select("user_id,current_period_start,current_period_end").eq("gateway","trial").eq("status","trialing").gt("current_period_end",new Date(now.getTime()+24*3600000).toISOString()).lte("current_period_end",new Date(now.getTime()+48*3600000).toISOString()).limit(1000);if(error)throw error;
  let count=0;
  for(const t of trials||[]){
   const {data:paid}=await admin.from("viva_subscriptions").select("id").eq("user_id",t.user_id).neq("gateway","trial").eq("status","active").gt("current_period_end",now.toISOString()).limit(1).maybeSingle();if(paid)continue;
   const [tx,conv]=await Promise.all([
    admin.from("viva_transactions").select("id",{count:"exact",head:true}).eq("user_id",t.user_id).gte("created_at",t.current_period_start),
    admin.from("viva_ai_reservations").select("id",{count:"exact",head:true}).eq("user_id",t.user_id).eq("status","settled").gte("created_at",t.current_period_start)
   ]);
   const did=[(tx.count??0)>0?(tx.count+" "+((tx.count??0)===1?"gasto anotado":"gastos anotados")):"",(conv.count??0)>0?(conv.count+" "+((conv.count??0)===1?"conversa":"conversas")+" com a VIVA"):""].filter(Boolean).join(" e ");
   const body=(did?"Em 5 dias de teste: "+did+". ":"Ainda dá tempo: pergunte quanto pode gastar hoje. ")+"Seu Pro grátis acaba em 2 dias. Continue com a VIVA no WhatsApp sem limite.";
   const delivery=await createDelivery({user_id:t.user_id,notification_type:"trial",dedupe_key:"trial:day5:"+t.user_id+":"+String(t.current_period_end).slice(0,10),title:"Faltam 2 dias do seu Pro grátis 💜",body,target_url:"/planos",payload:{type:"trial"}});
   if(delivery)count++;
   await emailOnce(admin,t.user_id,"trial:day5:"+t.user_id+":"+String(t.current_period_end).slice(0,10),"trial",first=>trialEndingEmail(did,first));
   const {data:link}=await admin.from("viva_whatsapp_links").select("wa_id,last_inbound_at,trial_reminder_sent_at").eq("user_id",t.user_id).maybeSingle();
   if(link?.wa_id&&!link.trial_reminder_sent_at&&link.last_inbound_at&&now.getTime()-new Date(link.last_inbound_at).getTime()<23*3600000){
    const ok=await sendWhatsappText(link.wa_id,"Faltam *2 dias* do seu Pro grátis. 💜\n\n"+(did?"Até agora: "+did+".\n\n":"")+"Para continuar comigo aqui sem limite, escolha seu plano (Pix ou cartão):\n"+SITE_URL+"/planos");
    if(ok)await admin.from("viva_whatsapp_links").update({trial_reminder_sent_at:now.toISOString()}).eq("user_id",t.user_id);
   }
  }
  return count;
 }catch(e){console.error("VIVA trial reminder skipped",e);return 0}
}
// Relatórios: semana no domingo às 19h e mês anterior no dia 1º às 9h (horário de Brasília).
// Vai por push (quem ativou) e pelo WhatsApp para quem falou com a VIVA nas últimas 24h (janela da Meta).
async function enqueueReports(admin:ReturnType<typeof createAdminClient>,now:Date){
 try{
  const tz="America/Sao_Paulo";const today=localDate(now,tz);const hour=Number(parts(now,tz).hour);const dow=new Date(today+"T12:00:00Z").getUTCDay();
  const jobs:ReportPeriod[]=[];if(dow===0&&hour===19)jobs.push("semana");if(today.slice(8,10)==="01"&&hour===9)jobs.push("mes-passado");
  if(!jobs.length)return 0;
  const [{data:subs},{data:links},settingsRes,{data:allProfiles}]=await Promise.all([
   admin.from("viva_push_subscriptions").select("user_id"),
   admin.from("viva_whatsapp_links").select("user_id,wa_id,last_inbound_at,last_report_key").not("wa_id","is",null).gt("last_inbound_at",new Date(now.getTime()-23*3600000).toISOString()).limit(5000),
   admin.from("viva_notification_settings").select("user_id,reports_enabled").eq("reports_enabled",false),
   emailConfigured()?admin.from("viva_profiles").select("id").limit(10000):Promise.resolve({data:[] as {id:string}[]})
  ]);
  const emailUsers=new Set((allProfiles||[]).map((p:{id:string})=>p.id));
  const off=new Set(settingsRes.error?[]:(settingsRes.data||[]).map((x:{user_id:string})=>x.user_id));
  const pushUsers=new Set((subs||[]).map(x=>x.user_id));const waByUser=new Map((links||[]).map(l=>[l.user_id,l] as const));
  let count=0;
  for(const job of jobs){
   const range=reportRange(job,today);const key="report:"+range.kind+":"+range.from;const target="/relatorio?p="+job;
   const {data:done}=await admin.from("viva_notification_deliveries").select("user_id,dedupe_key").like("dedupe_key",key+":%").limit(20000);
   const pushed=new Set((done||[]).filter(d=>!String(d.dedupe_key).endsWith(":email")).map(d=>d.user_id));
   const emailed=new Set((done||[]).filter(d=>String(d.dedupe_key).endsWith(":email")).map(d=>d.user_id));
   const users=[...new Set([...pushUsers,...waByUser.keys(),...emailUsers])].filter(u=>!off.has(u)&&((pushUsers.has(u)&&!pushed.has(u))||(waByUser.has(u)&&waByUser.get(u)!.last_report_key!==key)||(emailUsers.has(u)&&!emailed.has(u)))).slice(0,150);
   for(const userId of users){
    const r=await buildReport(admin,userId,range,today).catch(()=>null);if(!r)continue;
    const empty=r.count===0&&r.income===0;
    const title=range.kind==="semana"?"Seu resumo da semana 📊":"Seu mês de "+monthName(range.from)+" 📊";
    const body=empty?"Nenhum gasto anotado "+(range.kind==="semana"?"nesta semana":"no mês")+". Anote seus gastos e a VIVA mostra para onde foi seu dinheiro.":reportMessage(r);
    if(pushUsers.has(userId)&&!pushed.has(userId)){const d=await createDelivery({user_id:userId,notification_type:"report",dedupe_key:key+":"+userId,title,body,target_url:target,payload:{type:"report",period:job}});if(d)count++}
    if(emailUsers.has(userId)&&!emailed.has(userId))await emailOnce(admin,userId,key+":"+userId,"report",first=>reportEmail(r,first));
    const link=waByUser.get(userId);
    if(link?.wa_id&&link.last_report_key!==key){
     const text=title.replace(/^(.*?) 📊$/,"📊 *$1*")+"\n\n"+(empty?body:reportMessage(r,true))+"\n\nVeja o relatório completo: "+SITE_URL+target;
     const ok=await sendWhatsappText(link.wa_id,text);
     if(ok)await admin.from("viva_whatsapp_links").update({last_report_key:key}).eq("user_id",userId);
    }
   }
  }
  return count;
 }catch(e){console.error("VIVA reports skipped",e);return 0}
}
// Ativação (todo dia às 12h, horário de Brasília):
// - dias 1, 2 e 3 depois do cadastro, para quem anotou menos de 3 gastos;
// - resgate: quem já usou e está há 3+ dias sem anotar (uma vez por pausa, até 30 dias).
// Vai por push e, dentro da janela de 24h da Meta, pelo WhatsApp.
async function enqueueActivation(admin:ReturnType<typeof createAdminClient>,now:Date){
 try{
  const tz="America/Sao_Paulo";const hm=parts(now,tz);if(Number(hm.hour)!==12||Number(hm.minute)>=10)return 0;const today=localDate(now,tz);
  const [{data:subs},{data:links},{data:profiles},{data:recentTx}]=await Promise.all([
   admin.from("viva_push_subscriptions").select("user_id"),
   admin.from("viva_whatsapp_links").select("user_id,wa_id,last_inbound_at").not("wa_id","is",null).gt("last_inbound_at",new Date(now.getTime()-23*3600000).toISOString()).limit(5000),
   admin.from("viva_profiles").select("id,full_name,created_at,account_status").gt("created_at",new Date(now.getTime()-4*86400000).toISOString()).limit(5000),
   admin.from("viva_transactions").select("user_id,created_at").gt("created_at",new Date(now.getTime()-33*86400000).toISOString()).order("created_at",{ascending:false}).limit(50000)
  ]);
  const push=new Set((subs||[]).map(x=>x.user_id));const wa=new Map((links||[]).map(l=>[l.user_id,l.wa_id as string] as const));
  const txCount=new Map<string,number>();const lastTx=new Map<string,string>();
  for(const t of recentTx||[]){txCount.set(t.user_id,(txCount.get(t.user_id)||0)+1);if(!lastTx.has(t.user_id))lastTx.set(t.user_id,t.created_at)}
  const jobs:{user:string;key:string;title:string;body:string;wa:string;mail:(first:string)=>ReturnType<typeof winbackEmail>}[]=[];
  const first=(n:unknown)=>String(n||"").trim().split(/\s+/)[0]||"";
  for(const p of profiles||[]){
   if(p.account_status&&p.account_status!=="active")continue;
   const day=Math.floor((Date.parse(today+"T12:00:00Z")-Date.parse(localDate(new Date(p.created_at),tz)+"T12:00:00Z"))/86400000);
   if(day<1||day>3||(txCount.get(p.id)||0)>=3)continue;
   const name=first(p.full_name);const hi=name?name+", ":"";
   const m=day===1?{title:"Seu número do dia está esperando ☀️",body:hi+"anote o primeiro gasto de hoje (ex.: café 8) e veja quanto ainda pode gastar sem faltar até o salário.",wa:"Oi"+(name?" "+name:"")+"! ☀️ Me manda um gasto de hoje, tipo *gastei 8 no café*, que eu te digo quanto ainda dá pra gastar."}
    :day===2?{title:"Leva 5 segundos 💜",body:hi+"o que você gastou ontem e hoje? Anote e a VIVA recalcula seu valor do dia na hora.",wa:"Bora manter o controle? 💜 Me conta o que você gastou hoje (ex.: *uber 15*)."}
    :{title:"Seu Pro grátis está rolando 🎁",body:hi+"mande “gastei 20 no lanche” no WhatsApp e a VIVA anota pra você. Sem planilha.",wa:"Seu Pro grátis está ativo 🎁 Pode me mandar seus gastos por aqui que eu anoto tudo."};
   jobs.push({user:p.id,key:"activation:d"+day+":"+p.id,...m,mail:first=>activationEmail(day as 1|2|3,first)});
  }
  const newIds=new Set((profiles||[]).map(p=>p.id));
  for(const [user,last] of lastTx){
   if(newIds.has(user))continue;const days=Math.floor((now.getTime()-Date.parse(last))/86400000);if(days<3||days>30)continue;
   jobs.push({user,key:"activation:winback:"+user+":"+String(last).slice(0,10),title:"Sentimos sua falta 💜",body:"Faz "+days+" dias que você não anota nada. Lance os gastos de hoje e veja seu valor do dia atualizado.",wa:"Oi! Faz "+days+" dias que a gente não se fala 💜 Me manda os gastos de hoje que eu atualizo quanto você pode gastar.",mail:first=>winbackEmail(days,first)});
  }
  let count=0;
  for(const j of jobs){
   await emailOnce(admin,j.user,j.key,"activation",j.mail);
   if(push.has(j.user)){const d=await createDelivery({user_id:j.user,notification_type:"activation",dedupe_key:j.key,title:j.title,body:j.body,target_url:"/meu-dia",payload:{type:"activation"}});if(d)count++}
   else if(wa.has(j.user)){
    const {data:seen}=await admin.from("viva_notification_deliveries").select("id").eq("dedupe_key",j.key+":wa").maybeSingle();if(seen)continue;
    // Já recebeu o "bom dia" com o valor do dia hoje pelo WhatsApp: não manda outra mensagem no mesmo dia.
    const {data:morning}=await admin.from("viva_notification_deliveries").select("id").eq("dedupe_key","morning:wa:"+j.user+":"+today).eq("status","sent").maybeSingle();if(morning)continue;
    if(await sendWhatsappText(wa.get(j.user)!,j.wa))await admin.from("viva_notification_deliveries").insert({user_id:j.user,notification_type:"activation",dedupe_key:j.key+":wa",scheduled_for:now.toISOString(),title:j.title,body:j.wa,target_url:"/meu-dia",payload:{type:"activation",channel:"whatsapp"},status:"sent"});
   }
  }
  return count;
 }catch(e){console.error("VIVA activation skipped",e);return 0}
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
async function runCron(req:Request){try{const secret=process.env.CRON_SECRET;if(!secret||req.headers.get("authorization")!=="Bearer "+secret)return NextResponse.json({error:"Não autorizado."},{status:401});const admin=createAdminClient();const now=new Date();const [morningQueued,agendaQueued,billsQueued,eveningQueued,trialQueued,reportsQueued,activationQueued,morningWhatsapp]=await Promise.all([enqueueMorning(admin,now),enqueueAgenda(admin,now),enqueueBills(admin,now),enqueueEvening(admin,now),enqueueTrialReminder(admin,now),enqueueReports(admin,now),enqueueActivation(admin,now),enqueueMorningWhatsapp(admin,now)]);const {data:due,error}=await admin.from("viva_notification_deliveries").select("*").eq("status","pending").lte("scheduled_for",now.toISOString()).order("scheduled_for").limit(100);if(error)throw error;let sent=0,failed=0,skipped=0;for(const item of due||[]){const {data:claimed,error:claimError}=await admin.from("viva_notification_deliveries").update({status:"processing",attempts:Number(item.attempts||0)+1,updated_at:now.toISOString()}).eq("id",item.id).eq("status","pending").select("*").maybeSingle();if(claimError)throw claimError;if(!claimed)continue;const {data:settings}=await admin.from("viva_notification_settings").select("*").eq("user_id",item.user_id).maybeSingle();const s=(settings||{user_id:item.user_id,timezone:"America/Sao_Paulo",morning_enabled:true,agenda_enabled:true,bills_enabled:true}) as Settings;if(item.notification_type==="bill"&&item.payload?.billId){const {data:bill,error:billError}=await admin.from("viva_bills").select("status").eq("id",String(item.payload.billId)).eq("user_id",item.user_id).maybeSingle();if(billError)throw billError;if(!bill||bill.status==="paid"){await admin.from("viva_notification_deliveries").update({status:"cancelled",updated_at:now.toISOString()}).eq("id",item.id);skipped++;continue}}const enabled=item.notification_type==="morning"?s.morning_enabled:item.notification_type==="agenda"?s.agenda_enabled:item.notification_type==="bill"?s.bills_enabled:true;if(!enabled){await admin.from("viva_notification_deliveries").update({status:"cancelled",updated_at:now.toISOString()}).eq("id",item.id);skipped++;continue}if(isSilent(now,s)){await admin.from("viva_notification_deliveries").update({status:"pending",scheduled_for:nextAllowed(now,s),updated_at:now.toISOString()}).eq("id",item.id);skipped++;continue}try{await sendDelivery(claimed as Parameters<typeof sendDelivery>[0]);sent++}catch(e){await logDeliveryFailure(claimed as Parameters<typeof logDeliveryFailure>[0],e);failed++}}return NextResponse.json({ok:true,morningQueued,agendaQueued,billsQueued,eveningQueued,trialQueued,reportsQueued,activationQueued,morningWhatsapp,processed:(due||[]).length,sent,failed,skipped,at:now.toISOString()})}catch(e){console.error("VIVA notification cron failed",e);return NextResponse.json({error:e instanceof Error?e.message:"Falha no agendador."},{status:500})}}

export async function GET(req:Request){return runCron(req)}
export async function POST(req:Request){return runCron(req)}
