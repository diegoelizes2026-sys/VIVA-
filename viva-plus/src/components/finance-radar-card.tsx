"use client";
type Alert={code:string;severity:"high"|"medium"|"low";title:string;value:number|null;detail:string};
export default function FinanceRadarCard({radar}:{radar:{alerts:Alert[];explanation:string;data_insufficient:boolean;checked_at:string}}){
 const money=(n:number)=>n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
 const high=radar.alerts.filter(a=>a.severity==="high").length;
 const label=(severity:Alert["severity"])=>severity==="high"?"Prioridade alta":severity==="medium"?"Atenção":"Informativo";
 const tone=(severity:Alert["severity"])=>severity==="high"?{background:"#FFF0F0",border:"#F7D4D4",ink:"#A12C35",dot:"#D94752"}:severity==="medium"?{background:"#FFF8E8",border:"#F4E5BC",ink:"#94600A",dot:"#D99A24"}:{background:"#F3F0FA",border:"#E5DDF1",ink:"#70558F",dot:"#9674B8"};
 return <section aria-label="Radar financeiro" className="mt-4 w-full min-w-0 max-w-full overflow-hidden rounded-2xl border p-3 sm:p-4" style={{borderColor:"var(--line)",background:"var(--surface)"}}>
  <div className="flex min-w-0 items-center justify-between gap-3">
   <div className="flex min-w-0 items-center gap-2">
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{background:"#F1E7FC",color:"#6410C9"}}>
     <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3v3M21 12h-3M12 21v-3M3 12h3M12 12l4-4"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/></svg>
    </span>
    <div className="min-w-0">
     <strong className="block truncate text-sm" style={{color:"var(--text)"}}>Radar financeiro</strong>
     <span className="block text-xs text-neutral-500">Sua revisão preventiva</span>
    </div>
   </div>
   <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold" style={{background:high?"#FEE8E8":"#EAF8F1",color:high?"#A12C35":"#18794E"}}>{high?high+" urgente"+(high>1?"s":""):"Em acompanhamento"}</span>
  </div>
  <p className="mt-3 text-sm leading-relaxed" style={{color:"var(--text)"}}>{radar.explanation}</p>
  <div className="mt-3 grid min-w-0 gap-2.5">
   {radar.alerts.map(alert=>{const t=tone(alert.severity);return <article key={alert.code} className="min-w-0 rounded-xl border p-3" style={{background:t.background,borderColor:t.border}}>
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
     <div className="flex min-w-0 flex-1 items-start gap-2">
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{background:t.dot}}/>
      <b className="min-w-0 break-words text-sm leading-snug" style={{color:"#3F3548"}}>{alert.title}</b>
     </div>
     <span className="shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold" style={{background:"#FFFFFFB8",color:t.ink}}>{label(alert.severity)}</span>
    </div>
    <p className="mt-2 break-words text-sm leading-relaxed" style={{color:"#655B6D"}}>{alert.detail}</p>
    {alert.value!==null&&<p className="mt-2 break-words text-sm font-bold tabular-nums" style={{color:t.ink}}>{money(alert.value)}</p>}
   </article>})}
  </div>
  {radar.data_insufficient&&<div className="mt-3 flex min-w-0 gap-2 rounded-xl p-3" style={{background:"#F3EBFD",color:"#5D3287"}}>
   <span className="mt-0.5 shrink-0" aria-hidden="true">ⓘ</span>
   <p className="min-w-0 text-xs leading-relaxed">Ainda faltam alguns dados para uma análise mais precisa. Continue registrando sua renda, gastos e contas a pagar.</p>
  </div>}
  <p className="mt-3 text-[11px] leading-relaxed text-neutral-400">Análise baseada nos registros disponíveis. Confira os dados antes de tomar decisões.</p>
 </section>
}
