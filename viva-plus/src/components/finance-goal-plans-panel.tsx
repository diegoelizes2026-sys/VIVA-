"use client";
import {useEffect,useState} from "react";
type Goal={id:string;title:string;target_amount:number;current_amount:number;target_date:string|null};
type Step={title:string;detail:string;done:boolean};
type Plan={id:string;goal_id:string;monthly_target:number;weekly_target:number;remaining_amount:number;months_remaining:number;steps:Step[];status:"active"|"completed"|"paused";updated_at:string};
const money=(v:number)=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export default function FinanceGoalPlansPanel(){
 const [goals,setGoals]=useState<Goal[]>([]);
 const [plans,setPlans]=useState<Plan[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState("");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [contributions,setContributions]=useState<Record<string,string>>({});
 async function load(){
  setLoading(true);setError("");
  try{const r=await fetch("/api/finance-ai/goals",{cache:"no-store"});const d=await r.json();if(!r.ok){if(r.status===403||r.status===401){setGoals([]);setPlans([]);return}throw new Error(d.error||"Não foi possível carregar suas metas.")}setGoals(d.goals||[]);setPlans(d.plans||[])}
  catch(e){setError(e instanceof Error?e.message:"Falha ao carregar metas.")}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[]);
 useEffect(()=>{const refresh=()=>{void load()};window.addEventListener("viva:goals-updated",refresh);return()=>window.removeEventListener("viva:goals-updated",refresh)},[]);
 async function create(goal:Goal){
  setBusy(goal.id);setError("");setNotice("");
  try{const r=await fetch("/api/finance-ai/goals",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({goal_id:goal.id})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Não foi possível criar o plano.");setPlans(old=>[d.plan,...old.filter(p=>p.goal_id!==goal.id)]);setNotice(d.explanation||d.message||"Plano criado com sucesso.")}
  catch(e){setError(e instanceof Error?e.message:"Não foi possível criar o plano.")}
  finally{setBusy("")}
 }
 async function contribute(plan:Plan){
  const amount=Number(contributions[plan.id]||0);
  if(!Number.isFinite(amount)||amount<=0){setError("Informe um valor de aporte maior que zero.");return}
  setBusy(plan.id);setError("");setNotice("");
  try{
   const r=await fetch("/api/finance-ai/goals",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({plan_id:plan.id,contribution_amount:amount})});
   const d=await r.json();if(!r.ok)throw new Error(d.error||"Não foi possível registrar o aporte.");
   setGoals(old=>old.map(g=>g.id===d.goal.id?d.goal:g));
   setPlans(old=>old.map(p=>p.id===plan.id?d.plan:p));
   setContributions(old=>({...old,[plan.id]:""}));setNotice(d.message||"Aporte registrado.");
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível registrar o aporte.")}
  finally{setBusy("")}
 }
 async function toggle(plan:Plan,index:number,done:boolean){
  setBusy(plan.id+":"+index);setError("");
  const previous=plans;
  setPlans(old=>old.map(p=>p.id===plan.id?{...p,steps:p.steps.map((s,i)=>i===index?{...s,done}:s)}:p));
  try{const r=await fetch("/api/finance-ai/goals",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({plan_id:plan.id,step_index:index,done})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Não foi possível atualizar a etapa.");setPlans(old=>old.map(p=>p.id===plan.id?{...p,steps:d.plan.steps}:p))}
  catch(e){setPlans(previous);setError(e instanceof Error?e.message:"Não foi possível atualizar a etapa.")}
  finally{setBusy("")}
 }
 if(loading)return <div className="mx-1 my-3 rounded-2xl border p-4 text-sm text-neutral-500" style={{borderColor:"var(--line)"}}>Carregando suas metas e planos…</div>;
 if(!goals.length)return null;
 return <section className="mx-1 my-3 min-w-0 overflow-hidden rounded-2xl border p-4 sm:p-5" style={{borderColor:"var(--line)",background:"var(--surface)"}} aria-label="Planos de ação das metas">
  <div className="flex items-start justify-between gap-3">
   <div className="min-w-0"><span className="text-[10px] font-black tracking-[.16em]" style={{color:"#8B45D7"}}>VIVA+ · PLANEJAMENTO</span><h2 className="mt-1 text-base font-extrabold" style={{color:"var(--text)"}}>Transforme metas em conquistas</h2><p className="mt-1 text-xs leading-relaxed text-neutral-500">Planos calculados com base no valor guardado e no prazo da sua meta.</p></div>
   <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{background:"#F2E9FC",color:"#6410C9"}} aria-hidden="true">✦</span>
  </div>
  {notice&&<p role="status" className="mt-3 rounded-xl p-3 text-xs font-semibold" style={{background:"#ECF8F0",color:"#176B42"}}>{notice}</p>}
  {error&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}
  <div className="mt-3 grid gap-3">
   {goals.map(goal=>{
    const plan=plans.find(p=>p.goal_id===goal.id);
    const target=Number(goal.target_amount),current=Number(goal.current_amount||0);
    const progress=target>0?Math.min(100,Math.max(0,current/target*100)):0;
    const completed=plan?.steps.filter(s=>s.done).length||0;
    return <article key={goal.id} className="min-w-0 rounded-xl border p-3 sm:p-4" style={{borderColor:"var(--line)",background:"var(--background, #fff)"}}>
     <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><b className="block break-words text-sm" style={{color:"var(--text)"}}>{goal.title}</b><p className="mt-1 text-xs text-neutral-500">{money(current)} guardados de {money(target)}</p></div><span className="shrink-0 text-xs font-bold" style={{color:"#6410C9"}}>{Math.round(progress)}%</span></div>
     <div className="mt-2 h-2 overflow-hidden rounded-full" style={{background:"#EEE7F5"}}><div className="h-full rounded-full" style={{width:progress+"%",background:"linear-gradient(90deg,#6410C9,#A76BEA)"}}/></div>
     {plan?<div className="mt-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold" style={{color:"var(--text)"}}>Seu plano de ação</span><span className="text-[11px] text-neutral-500">{completed}/{plan.steps.length} etapas concluídas</span></div>
      <div className="mt-2 grid grid-cols-2 gap-2">
       <div className="rounded-lg p-2" style={{background:"#F4EDFC"}}><span className="block text-[10px] text-neutral-500">Guardar por mês</span><b className="text-sm" style={{color:"#6410C9"}}>{money(Number(plan.monthly_target))}</b></div>
       <div className="rounded-lg p-2" style={{background:"#F4EDFC"}}><span className="block text-[10px] text-neutral-500">Guardar por semana</span><b className="text-sm" style={{color:"#6410C9"}}>{money(Number(plan.weekly_target))}</b></div>
      </div>
      <div className="mt-3 rounded-xl border p-3" style={{borderColor:"var(--line)"}}>
       <label className="block text-xs font-semibold" style={{color:"var(--text)"}}>Atualizar o valor acumulado da meta</label>
       <div className="mt-2 flex gap-2"><input type="number" min="0.01" step="0.01" inputMode="decimal" value={contributions[plan.id]||""} onChange={e=>setContributions(old=>({...old,[plan.id]:e.target.value}))} placeholder="Valor em reais" className="field min-w-0 flex-1" aria-label={"Valor do aporte para "+goal.title}/><button type="button" disabled={busy===plan.id||!Number(contributions[plan.id])||Number(contributions[plan.id])<=0} onClick={()=>void contribute(plan)} className="shrink-0 rounded-lg px-3 text-xs font-bold text-white disabled:opacity-50" style={{background:"#6410C9"}}>{busy===plan.id?"Salvando…":"Registrar"}</button></div>
      </div>
      <div className="mt-3 grid gap-2">{plan.steps.map((step,index)=><label key={index} className="flex min-w-0 cursor-pointer items-start gap-2.5 rounded-lg p-2" style={{background:step.done?"#F0F8F2":"transparent"}}><input type="checkbox" checked={step.done} disabled={busy===plan.id+":"+index} onChange={e=>void toggle(plan,index,e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-purple-700"/><span className="min-w-0"><b className="block text-xs" style={{color:"var(--text)",textDecoration:step.done?"line-through":"none"}}>{step.title}</b><small className="mt-0.5 block text-[11px] leading-relaxed text-neutral-500">{step.detail}</small></span></label>)}</div>
     </div>:<div className="mt-3"><p className="text-xs leading-relaxed text-neutral-500">A VIVA pode montar um plano com valores semanais e mensais para você chegar nessa meta.</p><button type="button" disabled={Boolean(busy)} onClick={()=>void create(goal)} className="mt-3 min-h-10 w-full rounded-xl px-4 text-xs font-bold text-white disabled:opacity-60" style={{background:"#6410C9"}}>{busy===goal.id?"Calculando seu plano…":"Criar meu plano de ação"}</button></div>}
    </article>
   })}
  </div>
  <p className="mt-3 text-[10px] leading-relaxed text-neutral-400">Os valores são calculados pelo VIVA+ a partir da meta cadastrada. Atualizar o acumulado da meta não cria uma movimentação no extrato; registre a transação separadamente se necessário.</p>
 </section>
}
