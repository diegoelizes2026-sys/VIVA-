"use client";
type Alert={code:string;severity:"high"|"medium"|"low";title:string;value:number|null;detail:string};
export default function FinanceRadarCard({radar}:{radar:{alerts:Alert[];explanation:string;data_insufficient:boolean;checked_at:string}}){
 const money=(n:number)=>n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
 return <section className="mt-3 rounded-2xl border p-4" style={{borderColor:"var(--line)",background:"var(--surface)"}}>
  <div className="flex items-center justify-between gap-3"><strong className="text-sm" style={{color:"var(--accent)"}}>RADAR FINANCEIRO VIVA+</strong><span className="text-xs text-neutral-500">Verificação preventiva</span></div>
  <p className="mt-2 text-sm">{radar.explanation}</p>
  <div className="mt-3 grid gap-2">{radar.alerts.map(alert=><div key={alert.code} className="rounded-xl p-3" style={{background:"var(--surface-muted, #F7F4FC)"}}><div className="flex items-start justify-between gap-3"><b className="text-sm">{alert.title}</b><span className="shrink-0 rounded-full px-2 py-1 text-xs" style={{background:alert.severity==="high"?"#FEE2E2": "#FEF3C7",color:alert.severity==="high"?"#991B1B":"#92400E"}}>{alert.severity==="high"?"Prioridade alta":"Atenção"}</span></div><p className="mt-1 text-sm text-neutral-600">{alert.detail}</p>{alert.value!==null&&<p className="mt-1 text-sm font-semibold">{money(alert.value)}</p>}</div>)}</div>
  {radar.data_insufficient&&<p className="mt-3 text-xs text-neutral-500">Ainda há poucos dados para uma leitura completa. Mantenha seus lançamentos e contas atualizados.</p>}
  <p className="mt-3 text-xs text-neutral-400">Análise baseada nos registros disponíveis. Confira os dados antes de tomar decisões.</p>
 </section>
}
