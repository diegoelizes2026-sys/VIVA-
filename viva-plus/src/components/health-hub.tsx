"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import {Activity,ArrowDown,ArrowUp,Check, Droplets,HeartPulse, Moon, Scale, Sparkles, Target} from "lucide-react";

type Profile={age:number;sex:"female"|"male"|"other";height_cm:number;current_weight_kg:number;goal_weight_kg:number|null;activity_level:"sedentary"|"light"|"moderate"|"high";water_goal_ml:number};
type WaterLog={id:string;amount_ml:number;created_at:string};
type WeightLog={id:string;weight_kg:number;logged_on:string};
type SleepLog={id:string;sleep_hours:number;sleep_date:string};
type Payload={profile:Profile|null;water:WaterLog[];weights:WeightLog[];sleep:SleepLog[];today:string};
const blank:Profile={age:30,sex:"female",height_cm:165,current_weight_kg:70,goal_weight_kg:null,activity_level:"light",water_goal_ml:2000};
const money=(n:number)=>Math.round(n).toLocaleString("pt-BR");
const activityFactor={sedentary:1.2,light:1.375,moderate:1.55,high:1.725};
const activityLabel={sedentary:"Pouco ativo",light:"Levemente ativo",moderate:"Moderadamente ativo",high:"Muito ativo"};

export default function HealthHub(){
 const [data,setData]=useState<Payload|null>(null);
 const [profile,setProfile]=useState<Profile>(blank);
 const [weight,setWeight]=useState("70");
 const [sleepHours,setSleepHours]=useState("8");
 const [sleepDate,setSleepDate]=useState("");
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState("");
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{const response=await fetch("/api/health",{cache:"no-store"});const json=await response.json();if(!response.ok)throw new Error(json.error||"Falha ao carregar.");setData(json);if(json.profile){setProfile(json.profile);setWeight(String(json.profile.current_weight_kg));}setSleepDate(json.today);}
  catch(e){setError(e instanceof Error?e.message:"Não foi possível carregar seus dados.");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 const waterTotal=useMemo(()=>data?.water.reduce((sum,row)=>sum+row.amount_ml,0)||0,[data]);
 const bmi=profile.height_cm>0?profile.current_weight_kg/Math.pow(profile.height_cm/100,2):0;
 const bmr=profile.sex==="other"?null:(10*profile.current_weight_kg+6.25*profile.height_cm-5*profile.age+(profile.sex==="male"?5:-161));
 const tdee=bmr?bmr*activityFactor[profile.activity_level]:null;
 const waterPercent=Math.min(100,Math.round(waterTotal/Math.max(500,profile.water_goal_ml)*100));
 async function save(body:Record<string,unknown>,key:string){
  setSaving(key);setMessage("");setError("");
  try{const response=await fetch("/api/health",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const json=await response.json();if(!response.ok)throw new Error(json.error||"Não foi possível salvar.");setMessage(json.message||"Salvo com sucesso.");await load();}
  catch(e){setError(e instanceof Error?e.message:"Não foi possível salvar.");}
  finally{setSaving("");}
 }
 function patch<K extends keyof Profile>(key:K,value:Profile[K]){setProfile(current=>({...current,[key]:value}));}
 const latestWeight=data?.weights[0];
 return <div className="mx-auto w-full max-w-5xl pb-10">
  <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between"><div><div className="mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold" style={{background:"var(--color-primary-soft)",color:"var(--color-primary)"}}><HeartPulse size={14}/> SAÚDE E BEM-ESTAR</div><h1 className="text-3xl font-black tracking-tight md:text-4xl">Cuide de você, um dia de cada vez.</h1><p className="mt-2 text-sm text-muted">Acompanhe hábitos e metas pessoais em um só lugar.</p></div><span className="text-xs text-muted">Seus registros são privados.</span></div>
  {(message||error)&&<div role={error?"alert":"status"} className="mb-4 rounded-2xl border p-3 text-sm" style={{borderColor:error?"#FECACA":"#BBF7D0",background:error?"#FEF2F2":"#F0FDF4",color:error?"#B91C1C":"#166534"}}>{error||message}</div>}
  {loading?<div className="card p-6 text-sm text-muted">Carregando seu painel de bem-estar...</div>:<>
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <div className="card p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted">IMC estimado</span><Scale size={19} style={{color:"var(--color-primary)"}}/></div><p className="mt-3 text-2xl font-black">{bmi.toFixed(1).replace(".",",")}</p><p className="mt-1 text-xs text-muted">Indicador geral, não diagnóstico</p></div>
    <div className="card p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted">Metabolismo basal</span><Activity size={19} style={{color:"var(--color-primary)"}}/></div><p className="mt-3 text-2xl font-black">{bmr?money(bmr):"—"} <small className="text-xs font-semibold">kcal/dia</small></p><p className="mt-1 text-xs text-muted">Estimativa pela fórmula Mifflin-St Jeor</p></div>
    <div className="card p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted">Gasto diário estimado</span><Sparkles size={19} style={{color:"var(--color-primary)"}}/></div><p className="mt-3 text-2xl font-black">{tdee?money(tdee):"—"} <small className="text-xs font-semibold">kcal</small></p><p className="mt-1 text-xs text-muted">Inclui nível de atividade informado</p></div>
    <div className="card p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted">Último peso</span><Target size={19} style={{color:"var(--color-primary)"}}/></div><p className="mt-3 text-2xl font-black">{latestWeight?Number(latestWeight.weight_kg).toLocaleString("pt-BR")+" kg":profile.current_weight_kg+" kg"}</p><p className="mt-1 text-xs text-muted">{latestWeight?"Último registro":"Peso do seu perfil"}</p></div>
   </div>
   <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
    <section className="card p-5 md:p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-extrabold">Minha hidratação</h2><p className="mt-1 text-sm text-muted">Registre a água que você bebeu hoje.</p></div><span className="icon-surface h-11 w-11"><Droplets size={21}/></span></div>
     <div className="mt-5 flex items-end justify-between gap-3"><p className="text-3xl font-black">{(waterTotal/1000).toLocaleString("pt-BR",{maximumFractionDigits:2})} <small className="text-base font-semibold">L</small></p><p className="text-sm text-muted">Meta: {(profile.water_goal_ml/1000).toLocaleString("pt-BR")} L</p></div>
     <div className="mt-3 h-3 overflow-hidden rounded-full" style={{background:"var(--color-gray)"}}><div className="h-full rounded-full transition-all" style={{width:waterPercent+"%",background:"var(--color-primary)"}}/></div><p className="mt-2 text-xs text-muted">{waterPercent}% da meta diária registrada</p>
     <div className="mt-5 grid grid-cols-3 gap-2">{[150,250,500].map(amount=><button key={amount} disabled={!!saving} onClick={()=>void save({kind:"water",amount_ml:amount},"water")} className="rounded-xl border px-2 py-3 text-sm font-bold transition hover:border-purple-400 hover:bg-purple-50 disabled:opacity-50" style={{borderColor:"var(--color-border)"}}>+ {amount} ml</button>)}</div>
    </section>
    <section className="card p-5 md:p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-extrabold">Sono</h2><p className="mt-1 text-sm text-muted">Registre quanto dormiu.</p></div><span className="icon-surface h-11 w-11"><Moon size={21}/></span></div>
     <label className="mt-5 block text-sm font-semibold">Horas dormidas<input className="field mt-2" type="number" min="0.5" max="24" step="0.5" value={sleepHours} onChange={e=>setSleepHours(e.target.value)}/></label>
     <label className="mt-3 block text-sm font-semibold">Data<input className="field mt-2" type="date" value={sleepDate} onChange={e=>setSleepDate(e.target.value)}/></label>
     <button disabled={!!saving||!sleepDate} onClick={()=>void save({kind:"sleep",sleep_hours:Number(sleepHours),sleep_date:sleepDate},"sleep")} className="btn-primary mt-4 w-full">{saving==="sleep"?"Salvando...":"Salvar sono"}</button>
     {data?.sleep[0]&&<p className="mt-3 text-xs text-muted">Último registro: {Number(data.sleep[0].sleep_hours).toLocaleString("pt-BR")} h em {new Date(data.sleep[0].sleep_date+"T12:00:00").toLocaleDateString("pt-BR")}</p>}
    </section>
   </div>
   <section className="card mt-4 p-5 md:p-6"><div className="mb-5"><h2 className="text-lg font-extrabold">Meu perfil e minhas metas</h2><p className="mt-1 text-sm text-muted">Essas informações ajudam a calcular indicadores aproximados.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
     <label className="text-sm font-semibold">Idade<input className="field mt-2" type="number" min="13" max="110" value={profile.age} onChange={e=>patch("age",Number(e.target.value))}/></label>
     <label className="text-sm font-semibold">Sexo usado na fórmula<select className="field mt-2" value={profile.sex} onChange={e=>patch("sex",e.target.value as Profile["sex"])}><option value="female">Feminino</option><option value="male">Masculino</option><option value="other">Prefiro não informar</option></select></label>
     <label className="text-sm font-semibold">Altura (cm)<input className="field mt-2" type="number" min="100" max="250" value={profile.height_cm} onChange={e=>patch("height_cm",Number(e.target.value))}/></label>
     <label className="text-sm font-semibold">Peso atual (kg)<input className="field mt-2" type="number" min="25" max="350" step="0.1" value={profile.current_weight_kg} onChange={e=>patch("current_weight_kg",Number(e.target.value))}/></label>
     <label className="text-sm font-semibold">Meta de peso (kg)<input className="field mt-2" type="number" min="25" max="350" step="0.1" value={profile.goal_weight_kg??""} placeholder="Opcional" onChange={e=>patch("goal_weight_kg",e.target.value?Number(e.target.value):null)}/></label>
     <label className="text-sm font-semibold">Nível de atividade<select className="field mt-2" value={profile.activity_level} onChange={e=>patch("activity_level",e.target.value as Profile["activity_level"])}>{Object.entries(activityLabel).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
     <label className="text-sm font-semibold sm:col-span-2 lg:col-span-1">Meta de água (ml/dia)<input className="field mt-2" type="number" min="500" max="8000" step="250" value={profile.water_goal_ml} onChange={e=>patch("water_goal_ml",Number(e.target.value))}/></label>
    </div>
    <button disabled={!!saving} onClick={()=>void save({kind:"profile",...profile},"profile")} className="btn-primary mt-5 w-full sm:w-auto">{saving==="profile"?"Salvando...":"Salvar meu perfil"}</button>
   </section>
   <section className="card mt-4 p-5 md:p-6"><h2 className="text-lg font-extrabold">Histórico de peso</h2><p className="mt-1 text-sm text-muted">Acompanhe seus registros ao longo do tempo.</p><div className="mt-4 flex flex-col gap-3 sm:flex-row"><input className="field" aria-label="Peso em quilogramas" type="number" min="25" max="350" step="0.1" value={weight} onChange={e=>setWeight(e.target.value)}/><button disabled={!!saving} onClick={()=>void save({kind:"weight",weight_kg:Number(weight)},"weight")} className="btn-primary shrink-0">{saving==="weight"?"Salvando...":"Registrar peso"}</button></div>
    {data?.weights.length?<div className="mt-4 divide-y" style={{borderColor:"var(--color-border)"}}>{data.weights.map(row=><div key={row.id} className="flex items-center justify-between py-3 text-sm"><span className="text-muted">{new Date(row.logged_on+"T12:00:00").toLocaleDateString("pt-BR")}</span><strong>{Number(row.weight_kg).toLocaleString("pt-BR")} kg</strong></div>)}</div>:<p className="mt-4 text-sm text-muted">Seus registros aparecerão aqui.</p>}
   </section>
   <p className="mt-5 rounded-2xl p-4 text-xs leading-6 text-muted" style={{background:"var(--color-primary-soft)"}}>Os cálculos são estimativas educativas e não substituem avaliação médica ou nutricional. IMC, metabolismo basal, gasto energético e metas de hidratação variam conforme cada pessoa. Não use esses números para iniciar dietas ou tratamentos sem orientação profissional.</p>
  </>}
 </div>;
}
