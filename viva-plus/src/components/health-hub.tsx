"use client";

import {useCallback,useEffect,useMemo,useState} from "react";

function VivaPersonalMark({large=false}:{large?:boolean}){
 return <svg width={large?112:54} height={large?112:54} viewBox="0 0 100 100" fill="none" aria-label="Símbolo exclusivo VIVA+ Personal" role="img" className="shrink-0">
  <defs><linearGradient id="viva-mark-gradient" x1="8" y1="8" x2="92" y2="92"><stop stopColor="#F0ABFC"/><stop offset=".52" stopColor="#A855F7"/><stop offset="1" stopColor="#6D28D9"/></linearGradient></defs>
  <path d="M50 4 91 27v46L50 96 9 73V27L50 4Z" stroke="url(#viva-mark-gradient)" strokeWidth="3"/>
  <path d="m25 35 13 31h7l5-13 5 13h7l13-31H64L59 50l-5-15h-8l-5 15-5-15H25Z" fill="url(#viva-mark-gradient)"/>
  <path d="M18 50h8m48 0h8M50 15v8m0 54v8" stroke="#F5D0FE" strokeWidth="3" strokeLinecap="round"/>
  <circle cx="50" cy="50" r="42" stroke="#F5D0FE" strokeOpacity=".3" strokeDasharray="2 7"/>
 </svg>;
}
function DumbbellGlyph(){
 return <svg width="48" height="36" viewBox="0 0 48 36" fill="none" aria-hidden="true"><path d="M8 10v16M3 14v8m42-12v16m-5-12v8M8 18h32" stroke="#E9D5FF" strokeWidth="3.5" strokeLinecap="round"/><path d="M17 7 24 3l7 4v22l-7 4-7-4V7Z" fill="#A855F7" fillOpacity=".28" stroke="#E879F9" strokeWidth="1.5"/></svg>;
}

import {Activity,ArrowDownRight,ArrowUpRight,Brain,Check,ChevronRight,Droplets,HeartPulse,MessageCircle,Moon,Plus,Scale,Sparkles,Target,TrendingUp,Utensils,Weight} from "lucide-react";

type Profile={age:number;sex:"female"|"male"|"other";height_cm:number;current_weight_kg:number;goal_weight_kg:number|null;activity_level:"sedentary"|"light"|"moderate"|"high";water_goal_ml:number};
type WaterLog={id:string;amount_ml:number;created_at:string};
type WeightLog={id:string;weight_kg:number;logged_on:string};
type SleepLog={id:string;sleep_hours:number;sleep_date:string};
type FoodLog={id:string;meal_type:string;food_name:string;quantity:string;calories:number|null;protein_g:number|null;carbs_g:number|null;fat_g:number|null;fiber_g:number|null;logged_at:string};
type ActivityLog={id:string;activity_type:string;duration_minutes:number;intensity:string;notes:string|null;logged_at:string;logged_on:string};
type Payload={profile:Profile|null;water:WaterLog[];weights:WeightLog[];sleep:SleepLog[];foods:FoodLog[];activities:ActivityLog[];today:string};
const blank:Profile={age:0,sex:"other",height_cm:0,current_weight_kg:0,goal_weight_kg:null,activity_level:"light",water_goal_ml:2000};
const activityFactor={sedentary:1.2,light:1.375,moderate:1.55,high:1.725};
const activityLabel={sedentary:"Pouco ativo",light:"Levemente ativo",moderate:"Moderadamente ativo",high:"Muito ativo"};
const number=(n:number)=>Math.round(n).toLocaleString("pt-BR");
const dateLabel=(date:string)=>new Date(date+"T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"short"});
const panel="rounded-[26px] border border-[var(--color-border)] bg-[var(--color-card)] shadow-[0_12px_35px_rgba(28,15,48,.045)]";

export default function HealthHub(){
 const [data,setData]=useState<Payload|null>(null);
 const [profile,setProfile]=useState<Profile>(blank);
 const [weight,setWeight]=useState("");
 const [sleepHours,setSleepHours]=useState("8");
 const [sleepDate,setSleepDate]=useState("");
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState("");
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const [insight,setInsight]=useState("");
 const [aiLoading,setAiLoading]=useState(false);
 const [showProfile,setShowProfile]=useState(false);
 const [foodName,setFoodName]=useState("");
 const [foodQuantity,setFoodQuantity]=useState("1 porção");
 const [mealType,setMealType]=useState<"breakfast"|"lunch"|"dinner"|"snack">("breakfast");
 const [foodCalories,setFoodCalories]=useState("");
 const [foodProtein,setFoodProtein]=useState("");
 const [foodCarbs,setFoodCarbs]=useState("");
 const [foodFat,setFoodFat]=useState("");
 const [foodFiber,setFoodFiber]=useState("");
 const [activityType,setActivityType]=useState<"walking"|"running"|"gym"|"cycling"|"sports"|"yoga"|"other">("walking");
 const [activityMinutes,setActivityMinutes]=useState("30");
 const [activityIntensity,setActivityIntensity]=useState<"light"|"moderate"|"vigorous">("moderate");
 const [activityNotes,setActivityNotes]=useState("");
 const [trainerGoal,setTrainerGoal]=useState("condicionamento");
 const [trainerLevel,setTrainerLevel]=useState("iniciante");
 const [trainerDays,setTrainerDays]=useState("3");
 const [trainerEquipment,setTrainerEquipment]=useState("academia");
 const [trainerLimitations,setTrainerLimitations]=useState("");
 const [trainerPlan,setTrainerPlan]=useState("");
 const [trainerLoading,setTrainerLoading]=useState(false);
 const [trainerMessage,setTrainerMessage]=useState("");
 const [trainerGender,setTrainerGender]=useState<"female"|"male">("female");
 const [trainerChat,setTrainerChat]=useState<{role:"user"|"assistant";text:string}[]>([]);
 const [trainerChatLoading,setTrainerChatLoading]=useState(false);
 const [trainerListening,setTrainerListening]=useState(false);
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{const response=await fetch("/api/health",{cache:"no-store"});const json=await response.json();if(!response.ok)throw new Error(json.error||"Falha ao carregar.");setData(json);if(json.profile){setProfile(json.profile);setWeight(String(json.profile.current_weight_kg));}setSleepDate(json.today);}
  catch(e){setError(e instanceof Error?e.message:"Não foi possível carregar seus dados.");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 const waterTotal=useMemo(()=>data?.water.reduce((sum,row)=>sum+row.amount_ml,0)||0,[data]);
 const profileReady=profile.age>=13&&profile.height_cm>=100&&profile.current_weight_kg>=25;
 const bmi=profileReady?profile.current_weight_kg/Math.pow(profile.height_cm/100,2):0;
 const bmr=!profileReady||profile.sex==="other"?null:(10*profile.current_weight_kg+6.25*profile.height_cm-5*profile.age+(profile.sex==="male"?5:-161));
 const tdee=bmr?bmr*activityFactor[profile.activity_level]:null;
 const waterPercent=Math.min(100,Math.round(waterTotal/Math.max(500,profile.water_goal_ml)*100));
 const latestWeight=data?.weights[0];
 const latestSleep=data?.sleep[0];
 const foodTotals=useMemo(()=>({calories:(data?.foods||[]).reduce((n,x)=>n+Number(x.calories||0),0),protein:(data?.foods||[]).reduce((n,x)=>n+Number(x.protein_g||0),0),carbs:(data?.foods||[]).reduce((n,x)=>n+Number(x.carbs_g||0),0),fat:(data?.foods||[]).reduce((n,x)=>n+Number(x.fat_g||0),0),fiber:(data?.foods||[]).reduce((n,x)=>n+Number(x.fiber_g||0),0)}),[data?.foods]);
 const activityMinutesTotal=(data?.activities||[]).reduce((n,x)=>n+x.duration_minutes,0);
 const weightDelta=data?.weights.length&&data.weights.length>1?Number(data.weights[0].weight_kg)-Number(data.weights[data.weights.length-1].weight_kg):null;
 const greeting=(()=>{const h=new Date().getHours();return h<12?"Bom dia":h<18?"Boa tarde":"Boa noite";})();
 const focus=waterPercent<50?"Que tal fazer uma pausa para beber água?":!latestSleep?"Registre como foi seu sono para acompanhar sua rotina.":latestSleep.sleep_hours<7?"Seu sono merece atenção hoje.": "Você está construindo uma rotina. Continue no seu ritmo.";
 async function save(body:Record<string,unknown>,key:string){
  setSaving(key);setMessage("");setError("");
  try{const response=await fetch("/api/health",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const json=await response.json();if(!response.ok)throw new Error(json.error||"Não foi possível salvar.");setMessage(json.message||"Salvo com sucesso.");await load();}
  catch(e){setError(e instanceof Error?e.message:"Não foi possível salvar.");}
  finally{setSaving("");}
 }
 function patch<K extends keyof Profile>(key:K,value:Profile[K]){setProfile(current=>({...current,[key]:value}));}
 async function generateTrainerPlan(){
  setTrainerLoading(true);setError("");setTrainerPlan("");
  const prompt=[
   "VIVA_PERSONAL_PLAN: Crie uma proposta de planejamento semanal de atividade física. Personal escolhido: "+(trainerGender==="female"?"mulher":"homem")+". Mantenha linguagem acolhedora e coerente com essa escolha.",
   "Objetivo: "+trainerGoal+".",
   "Experiência: "+trainerLevel+".",
   "Dias disponíveis por semana: "+trainerDays+".",
   "Equipamentos: "+trainerEquipment+".",
   "Limitações, dores ou condições informadas: "+(trainerLimitations.trim()||"Não informado; pergunte se isso for essencial antes de sugerir exercícios específicos.")+".",
   "Perfil disponível: "+(profileReady?JSON.stringify({idade:profile.age,altura_cm:profile.height_cm,peso_kg:profile.current_weight_kg,nivel_atividade:activityLabel[profile.activity_level]}):"perfil físico não preenchido")+".",
   "Crie a ficha por dias, com exercício, séries, repetições ou tempo, descanso e dica técnica. Inclua aquecimento e recuperação. Não invente dados de saúde. Faça perguntas se faltar informação essencial."
  ].join("\\n");
  try{
   const response=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:prompt,feature:"chat"})});
   const json=await response.json();
   if(!response.ok)throw new Error(json.error||json.message||"Não foi possível montar seu treino agora.");
   if(json.state==="limit_reached"||json.state==="blocked"){setTrainerPlan(json.message||"O treinador está temporariamente indisponível para sua conta.");return;}
   setTrainerPlan(json.answer||json.message||"A VIVA não retornou um plano. Tente novamente.");
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível montar seu treino.");}
  finally{setTrainerLoading(false);}
 }
 async function sendTrainerMessage(textOverride?:string){
  const textToSend=(textOverride??trainerMessage).trim();if(!textToSend||trainerChatLoading)return;
  setTrainerMessage("");setTrainerChat(items=>[...items,{role:"user",text:textToSend}]);setTrainerChatLoading(true);setError("");
  try{
   const context="Você é "+(trainerGender==="female"?"a Personal Virtual VIVA+":"o Personal Virtual VIVA+")+", um treinador acolhedor e motivador. Converse em português brasileiro, com respostas curtas, práticas e humanas. Ajude com rotina, exercícios e dúvidas gerais. Antes de sugerir treino, considere objetivo, experiência, dias disponíveis e limitações informadas. Não diagnostique, não prescreva tratamento, não incentive treinar com dor ou ignorar sintomas. Em sinais de alerta, oriente interromper e procurar profissional de saúde. Dados do aluno: objetivo "+trainerGoal+", experiência "+trainerLevel+", dias por semana "+trainerDays+", local/equipamentos "+trainerEquipment+", limitações: "+(trainerLimitations||"não informadas")+".";
   const history=trainerChat.slice(-8).map(item=>(item.role==="user"?"Aluno: ":"Personal: ")+item.text).join("\n");
   const response=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:context+"\n\nConversa anterior:\n"+history+"\nAluno: "+textToSend+"\nPersonal:"})});
   const json=await response.json();if(!response.ok)throw new Error(json.error||"Não consegui responder agora.");
   const answer=json.answer||json.message||"Vamos tentar novamente?";setTrainerChat(items=>[...items,{role:"assistant",text:answer}]);
  }catch(e){setError(e instanceof Error?e.message:"Falha ao conversar com o Personal.");}
  finally{setTrainerChatLoading(false);}
 }
 function startTrainerVoice(){
  const w=window as Window&{SpeechRecognition?:new()=>{lang:string;interimResults:boolean;onresult:((event:{results:{[index:number]:{[index:number]:{transcript:string}}}})=>void)|null;onerror:(()=>void)|null;onend:(()=>void)|null;start:()=>void;stop:()=>void};webkitSpeechRecognition?:new()=>{lang:string;interimResults:boolean;onresult:((event:{results:{[index:number]:{[index:number]:{transcript:string}}}})=>void)|null;onerror:(()=>void)|null;onend:(()=>void)|null;start:()=>void;stop:()=>void}};
  const Recognition=w.SpeechRecognition||w.webkitSpeechRecognition;
  if(!Recognition){setError("Seu navegador não oferece reconhecimento de voz. Você pode conversar digitando.");return;}
  const recognition=new Recognition();recognition.lang="pt-BR";recognition.interimResults=false;setTrainerListening(true);
  recognition.onresult=(event)=>{const spoken=event.results[0][0].transcript;setTrainerMessage(spoken);void sendTrainerMessage(spoken);};
  recognition.onerror=()=>{setTrainerListening(false);setError("Não consegui ouvir. Confira a permissão do microfone e tente novamente.");};
  recognition.onend=()=>setTrainerListening(false);recognition.start();
 }
 function speakTrainer(text:string){
  if(typeof window==="undefined"||!("speechSynthesis" in window))return;
  window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang="pt-BR";utterance.rate=.96;window.speechSynthesis.speak(utterance);
 }
 async function askAI(){
  setAiLoading(true);setError("");setInsight("");
  const summary=[
   "Quero uma leitura do meu painel VIVA+ Saúde e Bem-estar. Atue como orientador de hábitos, acolhedor e responsável. Analise apenas os dados abaixo, não diagnostique, não prescreva dieta, suplementos ou tratamento. Aponte padrões e proponha no máximo 3 ações simples e seguras. Se faltarem dados, diga o que falta. Responda em português brasileiro, com linguagem humana, sem julgamentos.",
   "Data local: "+(data?.today||"não disponível"),
   "Perfil: "+(profileReady?JSON.stringify({idade:profile.age,sexo_formula:profile.sex,altura_cm:profile.height_cm,peso_kg:profile.current_weight_kg,meta_peso_kg:profile.goal_weight_kg,atividade:activityLabel[profile.activity_level],meta_agua_ml:profile.water_goal_ml}):"perfil incompleto"),
   "Água registrada hoje: "+waterTotal+" ml de "+profile.water_goal_ml+" ml.",
   "Sono mais recente: "+(latestSleep?latestSleep.sleep_hours+" horas em "+latestSleep.sleep_date:"sem registro"),
   "Alimentação de hoje: "+((data?.foods||[]).map(x=>x.food_name+" ("+x.quantity+", "+x.meal_type+", "+(x.calories??"calorias não informadas")+" kcal)").join("; ")||"sem registros")+". Totais informados: "+foodTotals.calories+" kcal, proteínas "+foodTotals.protein+" g, carboidratos "+foodTotals.carbs+" g, gorduras "+foodTotals.fat+" g, fibras "+foodTotals.fiber+" g.",
   "Atividades registradas: "+((data?.activities||[]).map(x=>x.activity_type+" por "+x.duration_minutes+" min, intensidade "+x.intensity).join("; ")||"sem registros")+".",
   "Histórico de peso: "+(data?.weights.slice(0,6).map(x=>x.weight_kg+" kg em "+x.logged_on).join("; ")||"sem registros"),
   "IMC estimado: "+(profileReady?bmi.toFixed(1):"indisponível")+". Metabolismo basal estimado: "+(bmr?Math.round(bmr)+" kcal/dia":"indisponível")+"."
  ].join("\n");
  try{const response=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:summary,feature:"chat"})});const json=await response.json();if(!response.ok)throw new Error(json.error||json.message||"A VIVA não conseguiu analisar agora.");if(json.state==="limit_reached"||json.state==="blocked"){setInsight(json.message||"A análise está temporariamente indisponível para sua conta.");return;}setInsight(json.answer||json.message||json.error||"A VIVA não retornou uma análise. Tente novamente.");}
  catch(e){setError(e instanceof Error?e.message:"Não foi possível conversar com a VIVA.");}
  finally{setAiLoading(false);}
 }
 return <div className="mx-auto w-full max-w-6xl pb-12">
  <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold" style={{background:"var(--color-primary-soft)",color:"var(--color-primary)"}}><HeartPulse size={14}/> VIVA+ • SEU BEM-ESTAR</div><span className="text-xs text-muted">Seus registros são privados</span></div>
  {(message||error)&&<div role={error?"alert":"status"} className="mb-4 rounded-2xl border p-3 text-sm" style={{borderColor:error?"#FECACA":"#BBF7D0",background:error?"#FEF2F2":"#F0FDF4",color:error?"#B91C1C":"#166534"}}>{error||message}</div>}
  {loading?<div className={panel+" p-8 text-sm text-muted"}>Preparando seu espaço de bem-estar...</div>:<>
   <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-black uppercase tracking-[.22em] text-purple-600">Seu treinador começa aqui</p><p className="mt-1 text-sm text-muted">Conheça o VIVA+ Personal e monte uma rotina no seu ritmo.</p></div><a href="#personal" className="rounded-full bg-purple-100 px-3 py-2 text-xs font-extrabold text-purple-800">Acessar meu treinador ↓</a></div>
   <section id="personal" className="relative mb-5 overflow-hidden rounded-[30px] border border-purple-200 bg-[#170b2b] p-5 text-white shadow-[0_20px_55px_rgba(42,12,76,.18)] md:p-7">
    <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border-[30px] border-fuchsia-400/10"/><div className="pointer-events-none absolute bottom-0 right-1/3 h-40 w-40 rounded-full bg-purple-600/20 blur-3xl"/>
    <div className="relative">
     <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3"><VivaPersonalMark/><div><p className="text-[10px] font-black uppercase tracking-[.28em] text-fuchsia-300">Treinador inteligente</p><h2 className="text-2xl font-black tracking-tight md:text-3xl">VIVA+ <span className="text-fuchsia-300">PERSONAL</span></h2><p className="mt-1 text-sm text-white/65">Seu ritmo. Seu treino. Sua evolução.</p></div></div>
      <span className="rounded-full border border-fuchsia-300/25 bg-fuchsia-300/10 px-3 py-1.5 text-xs font-bold text-fuchsia-200">EXCLUSIVO VIVA+</span>
     </div>
     <div className="relative mt-5 grid overflow-hidden rounded-[26px] border border-fuchsia-300/30 bg-gradient-to-r from-[#10071f] via-[#21103c] to-[#3b0872] shadow-[0_18px_50px_rgba(90,20,160,.28)] md:grid-cols-[.9fr_1.1fr]">
      <div className="relative min-h-[250px] overflow-hidden md:min-h-[340px]"><img src="/trainer-personal.jpg" alt="Personal Virtual VIVA+ em uma academia" className="absolute inset-0 h-full w-full object-cover object-left"/><div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#1b0c30]/90 md:bg-gradient-to-r md:from-transparent md:via-[#1b0c30]/15 md:to-[#1b0c30]"/><div className="absolute bottom-4 left-4 rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-xs font-black tracking-wide text-white backdrop-blur">VIVA+ PERSONAL</div></div>
      <div className="flex flex-col justify-center p-5 md:p-7"><p className="text-xs font-black uppercase tracking-[.22em] text-fuchsia-300">Seu treinador virtual com IA</p><h3 className="mt-2 text-2xl font-black leading-tight md:text-3xl">Olá! Vamos evoluir juntos?</h3><p className="mt-3 max-w-md text-sm leading-6 text-white/75">Eu sou seu Personal VIVA+. Posso ajudar a organizar seus treinos, acompanhar sua evolução e responder às suas dúvidas no seu ritmo.</p><div className="mt-5 grid grid-cols-3 gap-2 text-center text-[11px] font-bold text-white/90"><div className="rounded-xl border border-white/10 bg-white/[.07] p-3"><span className="block text-xl text-fuchsia-300">✦</span>Treino personalizado</div><div className="rounded-xl border border-white/10 bg-white/[.07] p-3"><span className="block text-xl text-fuchsia-300">↗</span>Acompanhe evolução</div><div className="rounded-xl border border-white/10 bg-white/[.07] p-3"><span className="block text-xl text-fuchsia-300">♡</span>Bem-estar diário</div></div><a href="#personal-chat" className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-purple-950/40">▶ Falar com meu Personal</a></div>
     </div>
     <div className="mt-6 grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
      <div className="rounded-2xl border border-white/10 bg-white/[.06] p-4 md:p-5">
       <div className="flex items-center gap-2 text-sm font-bold"><Target size={17} className="text-fuchsia-300"/> Configure seu treinador</div>
       <p className="mt-1 text-xs leading-5 text-white/55">A VIVA usa suas respostas para preparar uma sugestão inicial. Quanto mais completas, melhor a adaptação.</p>
       <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <label className="text-xs font-bold text-white/75">Objetivo<select className="field mt-1.5 !border-white/10 !bg-[#26143d] !text-white" value={trainerGoal} onChange={e=>setTrainerGoal(e.target.value)}><option value="condicionamento">Melhorar condicionamento</option><option value="forca">Ganhar força</option><option value="hipertrofia">Hipertrofia / massa muscular</option><option value="mobilidade">Mobilidade e flexibilidade</option><option value="bem-estar">Saúde e bem-estar geral</option></select></label>
        <label className="text-xs font-bold text-white/75">Experiência<select className="field mt-1.5 !border-white/10 !bg-[#26143d] !text-white" value={trainerLevel} onChange={e=>setTrainerLevel(e.target.value)}><option value="iniciante">Iniciante</option><option value="intermediario">Intermediário</option><option value="avancado">Avançado</option></select></label>
        <label className="text-xs font-bold text-white/75">Dias por semana<select className="field mt-1.5 !border-white/10 !bg-[#26143d] !text-white" value={trainerDays} onChange={e=>setTrainerDays(e.target.value)}><option value="2">2 dias</option><option value="3">3 dias</option><option value="4">4 dias</option><option value="5">5 dias</option><option value="6">6 dias</option></select></label>
        <label className="text-xs font-bold text-white/75">Onde vai treinar?<select className="field mt-1.5 !border-white/10 !bg-[#26143d] !text-white" value={trainerEquipment} onChange={e=>setTrainerEquipment(e.target.value)}><option value="academia">Academia completa</option><option value="casa com equipamentos">Casa com equipamentos</option><option value="casa sem equipamentos">Casa sem equipamentos</option><option value="ar livre">Ao ar livre</option></select></label>
       </div>
       <details className="mt-3 rounded-xl border border-white/10 p-3"><summary className="cursor-pointer text-xs font-bold text-fuchsia-200">Informar lesões, dores ou limitações (importante)</summary><textarea className="mt-3 min-h-20 w-full rounded-xl border border-white/10 bg-[#26143d] p-3 text-sm text-white outline-none placeholder:text-white/35" placeholder="Conte se existe alguma limitação ou orientação profissional..." value={trainerLimitations} onChange={e=>setTrainerLimitations(e.target.value)}/></details>
       <button onClick={()=>void generateTrainerPlan()} disabled={trainerLoading} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-purple-950/30 transition hover:brightness-110 disabled:opacity-60"><Sparkles size={17}/>{trainerLoading?"Montando seu planejamento...":"GERAR MEU TREINO"}</button>
       <p className="mt-2 text-[10px] leading-4 text-white/40">A IA pode consumir créditos do assistente VIVA+. O plano é uma orientação educativa, não substitui avaliação profissional.</p>
      </div>
      <div className="relative min-h-[300px] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#2b1450] via-[#21103d] to-[#12091f] p-4 md:p-5">
       <div className="absolute right-0 top-0 opacity-30"><VivaPersonalMark large/></div>
       <div className="relative flex items-center justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-fuchsia-300">Seu Personal está aqui</p><h3 className="mt-1 text-lg font-extrabold">Vamos conversar?</h3></div><span className="rounded-full bg-emerald-400/15 px-3 py-1 text-[10px] font-bold text-emerald-200">● ONLINE</span></div>
       <div className="relative mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.06] p-3">
        <img src="/trainer-personal.jpg" alt={trainerGender==="female"?"Personal mulher VIVA+":"Personal homem VIVA+"} className="h-20 w-24 shrink-0 rounded-xl object-cover object-left"/>
        <div className="min-w-0 flex-1"><p className="text-sm font-extrabold">Olá! Eu sou {trainerGender==="female"?"sua Personal":"seu Personal"} VIVA+ 💜</p><p className="mt-1 text-xs leading-5 text-white/65">Escolha quem vai acompanhar você. Pode conversar por voz ou mensagem.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={()=>setTrainerGender("female")} aria-pressed={trainerGender==="female"} className={trainerGender==="female"?"rounded-full border border-fuchsia-300 bg-fuchsia-500 px-4 py-2 text-xs font-extrabold text-white":"rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-bold text-white/70"}>♀ Mulher</button><button type="button" onClick={()=>setTrainerGender("male")} aria-pressed={trainerGender==="male"} className={trainerGender==="male"?"rounded-full border border-fuchsia-300 bg-fuchsia-500 px-4 py-2 text-xs font-extrabold text-white":"rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-bold text-white/70"}>♂ Homem</button></div></div>
       </div>
       <div id="personal-chat" className="relative mt-3 max-h-64 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="mr-5 rounded-2xl rounded-tl-sm bg-white/10 p-3 text-xs leading-5 text-white/90">👋 O que você gostaria de melhorar hoje: força, disposição, condicionamento ou criar o hábito de treinar?</div>
        {trainerChat.map((item,index)=><div key={index} className={item.role==="user"?"ml-5 rounded-2xl rounded-tr-sm bg-fuchsia-600/35 p-3 text-xs leading-5 text-white":"mr-5 rounded-2xl rounded-tl-sm bg-white/10 p-3 text-xs leading-5 text-white/90"}>{item.text}{item.role==="assistant"&&<button onClick={()=>speakTrainer(item.text)} className="ml-2 inline-flex items-center gap-1 text-fuchsia-200 underline">🔊 Ouvir</button>}</div>)}
        {trainerChatLoading&&<p className="text-xs text-fuchsia-200">Seu Personal está pensando...</p>}
        {trainerPlan&&<div className="rounded-xl border border-fuchsia-300/20 bg-fuchsia-500/10 p-3"><p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-fuchsia-200">Seu plano de treino</p><p className="whitespace-pre-wrap text-xs leading-5 text-white/90">{trainerPlan}</p></div>}
       </div>
       <form className="relative mt-3 flex items-center gap-2 rounded-2xl border border-fuchsia-300/40 bg-[#26143d] p-2 shadow-[0_0_22px_rgba(168,85,247,.16)]" onSubmit={e=>{e.preventDefault();void sendTrainerMessage();}}>
        <button type="button" onClick={startTrainerVoice} className={trainerListening?"rounded-xl bg-fuchsia-500 p-3 text-white animate-pulse":"rounded-xl bg-white/10 p-3 text-fuchsia-200"} aria-label="Falar com o Personal">🎙️</button>
        <input value={trainerMessage} onChange={e=>setTrainerMessage(e.target.value)} placeholder={trainerListening?"Estou ouvindo você...":"Digite sua mensagem para o Personal..."} className="min-w-0 flex-1 bg-transparent px-1 py-3 text-sm text-white outline-none placeholder:text-white/40"/>
        <button type="submit" disabled={!trainerMessage.trim()||trainerChatLoading} className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-500 px-4 py-3 text-sm font-black text-white disabled:opacity-40">Enviar ➤</button>
       </form>
       <p className="relative mt-2 text-[10px] leading-4 text-white/45">Use o microfone para falar (permita o acesso no navegador) ou digite pelo teclado. A voz depende do suporte do seu aparelho.</p>
       {trainerPlan&&<button onClick={()=>speakTrainer(trainerPlan)} className="relative mt-2 rounded-full border border-fuchsia-300/30 px-3 py-2 text-xs font-bold text-fuchsia-200">🔊 Ouvir meu treino</button>}
      </div>
     </div>
    </div>
   </section>
   <section className="relative mb-5 overflow-hidden rounded-[30px] p-6 text-white md:p-8" style={{background:"linear-gradient(120deg,#32105f 0%,#6410c9 55%,#9b5de5 100%)"}}>
    <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border-[35px] border-white/10"/><div className="pointer-events-none absolute bottom-[-90px] right-[22%] h-48 w-48 rounded-full bg-fuchsia-300/10 blur-2xl"/>
    <div className="relative grid gap-6 md:grid-cols-[1.3fr_.7fr] md:items-end">
     <div><p className="text-sm font-semibold text-white/75">{greeting}, seu próximo passo começa agora.</p><h1 className="mt-2 max-w-xl text-3xl font-black leading-tight tracking-tight md:text-4xl">Seu bem-estar. Seu ritmo. Sua evolução.</h1><p className="mt-3 max-w-lg text-sm leading-6 text-white/80">Um espaço para entender seus hábitos, acompanhar suas metas e receber apoio inteligente da VIVA.</p><button onClick={()=>void askAI()} disabled={aiLoading} className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-extrabold text-purple-800 shadow-lg transition hover:-translate-y-0.5 disabled:opacity-60"><Sparkles size={17}/>{aiLoading?"A VIVA está analisando...":"Conversar com minha VIVA"}<ChevronRight size={16}/></button></div>
     <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm"><div className="flex items-center gap-2 text-sm font-bold"><Target size={17}/> Seu foco de hoje</div><p className="mt-3 text-lg font-semibold leading-snug">{focus}</p><p className="mt-2 text-xs text-white/65">Sugestão baseada nos registros disponíveis. Você escolhe o que faz sentido.</p></div>
    </div>
   </section>
   <nav aria-label="Atalhos do bem-estar" className="sticky top-16 z-20 mb-4 -mx-1 flex gap-2 overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]/95 p-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-[var(--color-card)]/85">{[{id:"agua",label:"Água",icon:"💧"},{id:"sono",label:"Sono",icon:"🌙"},{id:"peso",label:"Peso",icon:"⚖️"},{id:"alimentacao",label:"Alimentação",icon:"🥗"},{id:"atividade",label:"Atividade",icon:"🏃"},{id:"perfil",label:"Perfil",icon:"👤"}].map(item=><a key={item.id} href={"#"+item.id} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-bold text-[var(--color-foreground)] transition hover:bg-purple-50 hover:text-purple-700">{item.icon} {item.label}</a>)}</nav>
   <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <div className={panel+" p-4"}><div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted">Hidratação de hoje</span><Droplets size={18} className="text-purple-600"/></div><div className="mt-3 flex items-baseline gap-1"><strong className="text-3xl">{(waterTotal/1000).toLocaleString("pt-BR",{maximumFractionDigits:2})}</strong><span className="text-sm text-muted">/ {(profile.water_goal_ml/1000).toLocaleString("pt-BR")} L</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-gray)]"><div className="h-full rounded-full bg-purple-600 transition-all duration-500" style={{width:waterPercent+"%"}}/></div><p className="mt-2 text-xs text-muted">{waterPercent}% da sua meta diária</p></div>
    <div className={panel+" p-4"}><div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted">Último sono</span><Moon size={18} className="text-purple-600"/></div><div className="mt-3 flex items-baseline gap-1"><strong className="text-3xl">{latestSleep?Number(latestSleep.sleep_hours).toLocaleString("pt-BR"):"—"}</strong><span className="text-sm text-muted">horas</span></div><p className="mt-4 text-xs text-muted">{latestSleep?"Registro de "+dateLabel(latestSleep.sleep_date):"Registre sua noite de sono"}</p></div>
    <div className={panel+" p-4"}><div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted">Peso acompanhado</span><Scale size={18} className="text-purple-600"/></div><div className="mt-3 flex items-baseline gap-1"><strong className="text-3xl">{latestWeight?Number(latestWeight.weight_kg).toLocaleString("pt-BR"):"—"}</strong><span className="text-sm text-muted">{latestWeight?"kg":"sem registro"}</span></div><p className="mt-4 flex items-center gap-1 text-xs text-muted">{weightDelta===null?"Sua evolução aparece com novos registros":<>{weightDelta>0?<ArrowUpRight size={14}/>:weightDelta<0?<ArrowDownRight size={14}/>:<TrendingUp size={14}/>} Variação no histórico: {Math.abs(weightDelta).toLocaleString("pt-BR")} kg</>}</p></div>
    <div className={panel+" p-4"}><div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted">Seu indicador IMC</span><Activity size={18} className="text-purple-600"/></div><div className="mt-3 flex items-baseline gap-1"><strong className="text-3xl">{profileReady?bmi.toFixed(1).replace(".",","):"—"}</strong><span className="text-sm text-muted">estimado</span></div><p className="mt-4 text-xs text-muted">{profileReady?"Indicador geral, não diagnóstico":"Complete seu perfil para estimar"}</p></div>
   </div>
   <div className="mb-5 grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
    <section id="agua" className={panel+" scroll-mt-36 p-5 md:p-6"}><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Droplets className="text-purple-600" size={20}/><h2 className="text-lg font-extrabold">Hidratação</h2></div><p className="mt-1 text-sm text-muted">Cada copo conta. Registre ao longo do dia.</p></div><span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">{waterPercent}%</span></div>
     <div className="mt-5 flex items-end justify-between"><div><strong className="text-4xl">{waterTotal.toLocaleString("pt-BR")}</strong><span className="ml-1 text-sm text-muted">ml registrados</span></div><span className="text-sm text-muted">Meta {(profile.water_goal_ml).toLocaleString("pt-BR")} ml</span></div><div className="mt-3 h-3 overflow-hidden rounded-full bg-[var(--color-gray)]"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-700 transition-all duration-500" style={{width:waterPercent+"%"}}/></div>
     <div className="mt-5 grid grid-cols-3 gap-2">{[150,250,500].map(amount=><button key={amount} disabled={!!saving} onClick={()=>void save({kind:"water",amount_ml:amount},"water")} className="flex min-h-12 items-center justify-center gap-1 rounded-xl border border-[var(--color-border)] text-sm font-bold transition hover:border-purple-400 hover:bg-purple-50 disabled:opacity-50"><Plus size={14}/>{amount} ml</button>)}</div>
     {data?.water.length?<p className="mt-3 text-xs text-muted">{data.water.length} registro(s) hoje • Último copo há {Math.max(0,Math.round((Date.now()-new Date(data.water[0].created_at).getTime())/60000))} min</p>:<p className="mt-3 text-xs text-muted">Seu primeiro registro de hoje começa com um toque.</p>}
    </section>
    <section id="sono" className={panel+" scroll-mt-36 p-5 md:p-6"}><div className="flex items-center gap-2"><Moon className="text-purple-600" size={20}/><h2 className="text-lg font-extrabold">Como foi seu descanso?</h2></div><p className="mt-1 text-sm text-muted">Acompanhe seu sono sem pressão por perfeição.</p><label className="mt-5 block text-sm font-semibold">Horas dormidas<input className="field mt-2" type="number" min="0.5" max="24" step="0.5" value={sleepHours} onChange={e=>setSleepHours(e.target.value)}/></label><label className="mt-3 block text-sm font-semibold">Data<input className="field mt-2" type="date" value={sleepDate} onChange={e=>setSleepDate(e.target.value)}/></label><button disabled={!!saving||!sleepDate||Number(sleepHours)<.5||Number(sleepHours)>24} onClick={()=>void save({kind:"sleep",sleep_hours:Number(sleepHours),sleep_date:sleepDate},"sleep")} className="btn-primary mt-4 w-full">{saving==="sleep"?"Salvando seu registro...":"Registrar meu sono"}</button></section>
   </div>
   <section className="mb-5 overflow-hidden rounded-[26px] border border-purple-200 bg-gradient-to-br from-purple-50 to-white p-5 md:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-purple-800"><Brain size={21}/><h2 className="text-lg font-extrabold">VIVA inteligência • sua leitura pessoal</h2></div><p className="mt-1 text-sm text-purple-900/65">A IA conecta seus registros e ajuda você a enxergar o próximo passo.</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-purple-700">Assistente VIVA+</span></div>
    {insight?<div className="mt-4 rounded-2xl border border-purple-100 bg-white p-4 text-sm leading-7 text-[var(--color-foreground)] whitespace-pre-wrap">{insight}</div>:<div className="mt-4 rounded-2xl border border-dashed border-purple-200 bg-white/70 p-4"><p className="text-sm text-muted">Peça uma análise para receber observações sobre hidratação, sono, peso e metas com base no que você registrou.</p><button onClick={()=>void askAI()} disabled={aiLoading} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-purple-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-purple-800 disabled:opacity-60"><MessageCircle size={16}/>{aiLoading?"Analisando seus registros...":"Gerar minha análise inteligente"}</button></div>}
    <p className="mt-3 text-xs text-purple-900/55">A análise compartilha com a IA apenas o resumo necessário quando você solicita. Respostas educativas, não substituem profissionais de saúde.</p>
   </section>
   <section id="peso" className={panel+" mb-5 scroll-mt-36 p-5 md:p-6"}><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><Weight size={20} className="text-purple-600"/><h2 className="text-lg font-extrabold">Evolução do seu peso</h2></div><p className="mt-1 text-sm text-muted">Olhe para tendências, não para um único número.</p></div><span className="text-xs text-muted">{data?.weights.length||0} registros</span></div><div className="mt-4 flex flex-col gap-3 sm:flex-row"><input className="field" aria-label="Peso em quilogramas" type="number" min="25" max="350" step="0.1" placeholder="Ex.: 72,5 kg" value={weight} onChange={e=>setWeight(e.target.value)}/><button disabled={!!saving||Number(weight)<25||Number(weight)>350} onClick={()=>void save({kind:"weight",weight_kg:Number(weight)},"weight")} className="btn-primary shrink-0">{saving==="weight"?"Salvando...":"Registrar peso"}</button></div>
    {data?.weights.length?<div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{data.weights.slice(0,6).map((row,index)=><div key={row.id} className="flex items-center justify-between rounded-xl bg-[var(--color-gray)]/50 px-3 py-3"><div><p className="text-xs text-muted">{dateLabel(row.logged_on)}</p><strong>{Number(row.weight_kg).toLocaleString("pt-BR")} kg</strong></div>{index===0&&<span className="rounded-full bg-purple-100 px-2 py-1 text-[10px] font-bold text-purple-700">Mais recente</span>}</div>)}</div>:<p className="mt-4 rounded-xl bg-[var(--color-gray)]/50 p-4 text-sm text-muted">Seus registros vão aparecer aqui para mostrar sua evolução ao longo do tempo.</p>}
   </section>
   <section id="perfil" className={panel+" mb-5 scroll-mt-36 p-5 md:p-6"}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold">Seu perfil e suas metas</h2><p className="mt-1 text-sm text-muted">Ajuste suas informações para personalizar os indicadores.</p></div><button onClick={()=>setShowProfile(v=>!v)} className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-bold text-purple-700">{showProfile?"Fechar edição":"Editar perfil"}</button></div>
    {profileReady&&!showProfile?<div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-[var(--color-gray)]/50 p-3"><p className="text-xs text-muted">Idade</p><strong>{profile.age} anos</strong></div><div className="rounded-xl bg-[var(--color-gray)]/50 p-3"><p className="text-xs text-muted">Altura</p><strong>{profile.height_cm} cm</strong></div><div className="rounded-xl bg-[var(--color-gray)]/50 p-3"><p className="text-xs text-muted">Atividade</p><strong>{activityLabel[profile.activity_level]}</strong></div></div>:null}
    {(showProfile||!profileReady)&&<><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><label className="text-sm font-semibold">Idade<input className="field mt-2" type="number" min="13" max="110" value={profile.age||""} onChange={e=>patch("age",Number(e.target.value))}/></label><label className="text-sm font-semibold">Sexo usado na fórmula<select className="field mt-2" value={profile.sex} onChange={e=>patch("sex",e.target.value as Profile["sex"])}><option value="female">Feminino</option><option value="male">Masculino</option><option value="other">Prefiro não informar</option></select></label><label className="text-sm font-semibold">Altura (cm)<input className="field mt-2" type="number" min="100" max="250" value={profile.height_cm||""} onChange={e=>patch("height_cm",Number(e.target.value))}/></label><label className="text-sm font-semibold">Peso atual (kg)<input className="field mt-2" type="number" min="25" max="350" step="0.1" value={profile.current_weight_kg||""} onChange={e=>patch("current_weight_kg",Number(e.target.value))}/></label><label className="text-sm font-semibold">Meta de peso (kg)<input className="field mt-2" type="number" min="25" max="350" step="0.1" value={profile.goal_weight_kg??""} placeholder="Opcional" onChange={e=>patch("goal_weight_kg",e.target.value?Number(e.target.value):null)}/></label><label className="text-sm font-semibold">Nível de atividade<select className="field mt-2" value={profile.activity_level} onChange={e=>patch("activity_level",e.target.value as Profile["activity_level"])}>{Object.entries(activityLabel).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm font-semibold sm:col-span-2 lg:col-span-1">Meta de água (ml/dia)<input className="field mt-2" type="number" min="500" max="8000" step="250" value={profile.water_goal_ml} onChange={e=>patch("water_goal_ml",Number(e.target.value))}/></label></div><button disabled={!!saving||profile.age<13||profile.height_cm<100||profile.current_weight_kg<25} onClick={()=>void save({kind:"profile",...profile},"profile")} className="btn-primary mt-5">{saving==="profile"?"Salvando...":"Salvar meu perfil"}</button></>}
   </section>
   <section id="alimentacao" className={panel+" mb-5 scroll-mt-36 p-5 md:p-6"}>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><Utensils size={20} className="text-purple-600"/><h2 className="text-lg font-extrabold">Diário alimentar</h2></div><p className="mt-1 text-sm text-muted">Registre o que comeu e os nutrientes que souber. Campos nutricionais são opcionais.</p></div><span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">{(data?.foods||[]).length} registros hoje</span></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
     <label className="text-sm font-semibold">Refeição<select className="field mt-2" value={mealType} onChange={e=>setMealType(e.target.value as typeof mealType)}><option value="breakfast">Café da manhã</option><option value="lunch">Almoço</option><option value="dinner">Jantar</option><option value="snack">Lanche</option></select></label>
     <label className="text-sm font-semibold sm:col-span-1 lg:col-span-2">Alimento<input className="field mt-2" placeholder="Ex.: arroz, feijão e frango" value={foodName} onChange={e=>setFoodName(e.target.value)}/></label>
     <label className="text-sm font-semibold">Quantidade<input className="field mt-2" placeholder="Ex.: 1 prato" value={foodQuantity} onChange={e=>setFoodQuantity(e.target.value)}/></label>
    </div>
    <details className="mt-3 rounded-xl border border-[var(--color-border)] p-3"><summary className="cursor-pointer text-sm font-bold text-purple-700">Adicionar informações nutricionais (opcional)</summary><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">{[["Calorias (kcal)",foodCalories,setFoodCalories],["Proteínas (g)",foodProtein,setFoodProtein],["Carboidratos (g)",foodCarbs,setFoodCarbs],["Gorduras (g)",foodFat,setFoodFat],["Fibras (g)",foodFiber,setFoodFiber]].map(([label,value,setter])=><label key={String(label)} className="text-xs font-semibold">{String(label)}<input className="field mt-2" type="number" min="0" step="0.1" value={String(value)} onChange={e=>(setter as (v:string)=>void)(e.target.value)}/></label>)}</div></details>
    <button disabled={!!saving||foodName.trim().length<2||!foodQuantity.trim()} onClick={()=>void save({kind:"food",meal_type:mealType,food_name:foodName.trim(),quantity:foodQuantity.trim(),calories:foodCalories===""?null:Number(foodCalories),protein_g:foodProtein===""?null:Number(foodProtein),carbs_g:foodCarbs===""?null:Number(foodCarbs),fat_g:foodFat===""?null:Number(foodFat),fiber_g:foodFiber===""?null:Number(foodFiber)},"food")} className="btn-primary mt-3">{saving==="food"?"Registrando...":"Adicionar alimento"}</button>
    <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">{[["Energia",foodTotals.calories,"kcal"],["Proteínas",foodTotals.protein,"g"],["Carboidratos",foodTotals.carbs,"g"],["Gorduras",foodTotals.fat,"g"],["Fibras",foodTotals.fiber,"g"]].map(([label,value,unit])=><div key={String(label)} className="rounded-xl bg-purple-50 p-3"><p className="text-xs text-purple-800">{String(label)}</p><strong className="mt-1 block text-lg text-purple-950">{Number(value).toLocaleString("pt-BR",{maximumFractionDigits:1})} <span className="text-xs font-normal">{String(unit)}</span></strong></div>)}</div>
    {(data?.foods||[]).length>0&&<div className="mt-4 space-y-2">{data!.foods.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--color-gray)]/50 px-3 py-2"><div><p className="text-sm font-bold">{item.food_name}</p><p className="text-xs text-muted">{item.quantity} • {({breakfast:"Café da manhã",lunch:"Almoço",dinner:"Jantar",snack:"Lanche"} as Record<string,string>)[item.meal_type]||item.meal_type}</p></div><span className="text-xs text-muted">{item.calories===null?"Calorias não informadas":Number(item.calories).toLocaleString("pt-BR")+" kcal"}</span></div>)}</div>}
   </section>
   <section id="atividade" className={panel+" mb-5 scroll-mt-36 p-5 md:p-6"}>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><Activity size={20} className="text-purple-600"/><h2 className="text-lg font-extrabold">Movimento e atividade física</h2></div><p className="mt-1 text-sm text-muted">Acompanhe suas atividades sem precisar competir com ninguém.</p></div><span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">{activityMinutesTotal} min registrados</span></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
     <label className="text-sm font-semibold">Atividade<select className="field mt-2" value={activityType} onChange={e=>setActivityType(e.target.value as typeof activityType)}><option value="walking">Caminhada</option><option value="running">Corrida</option><option value="gym">Musculação</option><option value="cycling">Bicicleta</option><option value="sports">Esporte</option><option value="yoga">Yoga / alongamento</option><option value="other">Outra</option></select></label>
     <div>
      <label className="block text-sm font-semibold">Duração (minutos)<input className="field mt-2" type="number" min="1" max="1440" value={activityMinutes} onChange={e=>setActivityMinutes(e.target.value)}/></label>
      <div className="mt-2 flex flex-wrap gap-1.5">{[15,30,45,60].map(minutes=><button type="button" key={minutes} onClick={()=>setActivityMinutes(String(minutes))} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${Number(activityMinutes)===minutes?"border-purple-500 bg-purple-50 text-purple-700":"border-[var(--color-border)] text-muted hover:border-purple-300"}`}>{minutes} min</button>)}</div>
     </div>
     <label className="text-sm font-semibold">Intensidade<select className="field mt-2" value={activityIntensity} onChange={e=>setActivityIntensity(e.target.value as typeof activityIntensity)}><option value="light">Leve</option><option value="moderate">Moderada</option><option value="vigorous">Intensa</option></select></label>
     <div className="sm:col-span-2 lg:col-span-4"><details className="rounded-xl border border-[var(--color-border)] p-3"><summary className="cursor-pointer text-sm font-bold text-purple-700">Adicionar observação (opcional)</summary><input className="field mt-3" maxLength={240} placeholder="Ex.: caminhada no parque" value={activityNotes} onChange={e=>setActivityNotes(e.target.value)}/></details></div>
    </div>
    <button disabled={!!saving||Number(activityMinutes)<1||Number(activityMinutes)>1440} onClick={()=>void save({kind:"activity",activity_type:activityType,duration_minutes:Number(activityMinutes),intensity:activityIntensity,notes:activityNotes.trim()||null},"activity")} className="btn-primary mt-3">{saving==="activity"?"Registrando...":"Registrar atividade"}</button>
    {(data?.activities||[]).length>0?<div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{data!.activities.slice(0,6).map(item=><div key={item.id} className="rounded-xl bg-[var(--color-gray)]/50 p-3"><p className="text-sm font-bold">{({walking:"Caminhada",running:"Corrida",gym:"Musculação",cycling:"Bicicleta",sports:"Esporte",yoga:"Yoga / alongamento",other:"Outra"} as Record<string,string>)[item.activity_type]||item.activity_type}</p><p className="mt-1 text-xs text-muted">{item.duration_minutes} min • {({light:"Leve",moderate:"Moderada",vigorous:"Intensa"} as Record<string,string>)[item.intensity]||item.intensity} • {dateLabel(item.logged_on)}</p>{item.notes&&<p className="mt-1 text-xs text-muted">{item.notes}</p>}</div>)}</div>:<p className="mt-4 text-sm text-muted">Suas atividades registradas aparecerão aqui.</p>}
   </section>

   <section className={panel+" mb-5 p-5 md:p-6"}><div className="flex items-center gap-2"><Utensils size={20} className="text-purple-600"/><h2 className="text-lg font-extrabold">Energia e alimentação</h2></div><p className="mt-1 text-sm text-muted">Estimativas educativas para entender seu corpo — não são metas alimentares prescritas.</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-purple-50 p-4"><p className="text-xs text-purple-800">Metabolismo basal estimado</p><strong className="mt-1 block text-2xl text-purple-950">{bmr?number(bmr):"—"}</strong><span className="text-xs text-purple-800/70">kcal/dia</span></div><div className="rounded-2xl bg-purple-50 p-4"><p className="text-xs text-purple-800">Gasto diário estimado</p><strong className="mt-1 block text-2xl text-purple-950">{tdee?number(tdee):"—"}</strong><span className="text-xs text-purple-800/70">kcal/dia</span></div><div className="rounded-2xl bg-purple-50 p-4"><p className="text-xs text-purple-800">IMC estimado</p><strong className="mt-1 block text-2xl text-purple-950">{profileReady?bmi.toFixed(1).replace(".",","):"—"}</strong><span className="text-xs text-purple-800/70">indicador geral, não diagnóstico</span></div></div><div className="mt-4 rounded-xl border border-[var(--color-border)] p-4 text-sm text-muted">Depois de registrar sua alimentação e atividade física, a VIVA poderá cruzar esses hábitos com seu sono, hidratação e metas. Não usamos uma divisão fixa de macronutrientes como prescrição individual.</div></section>
   <p className="px-1 text-xs leading-6 text-muted">Seus indicadores são aproximações educativas e não substituem avaliação médica ou nutricional. A IA não diagnostica nem prescreve tratamentos. Registre apenas informações que deseja acompanhar.</p>
  </>}
 </div>;
}
