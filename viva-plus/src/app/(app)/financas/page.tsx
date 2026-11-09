import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import RecordForm from "@/components/record-form";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase.from("transactions").select("*").order("occurred_on",{ascending:false}).limit(60);
  const rows=data||[];
  const sum=(kind:string)=>rows.filter(x=>x.kind===kind).reduce((a,x)=>a+Number(x.amount),0);
  const income=sum("income"), expense=sum("expense"), balance=income-expense;
  const money=(n:number)=>n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  return <div>
    <p className="page-eyebrow">CONTROLE FINANCEIRO</p><h1 className="page-title">Seu dinheiro, com clareza.</h1><p className="page-description">Acompanhe o que entra e sai e mantenha seus registros organizados.</p>
    <section className="mt-7 grid gap-3 sm:grid-cols-3">
      <div className="rounded-[20px] bg-[#6410C9] p-5 text-white sm:col-span-1"><div className="flex items-center gap-2 text-xs font-semibold text-white/70"><Wallet size={15}/> SALDO REGISTRADO</div><p className="mt-5 text-3xl font-bold tracking-tight">{money(balance)}</p><p className="mt-2 text-[11px] text-white/65">Com base nos lançamentos exibidos</p></div>
      <div className="card p-5"><div className="flex items-center gap-2 text-xs font-semibold text-neutral-400"><ArrowDownLeft size={16} className="text-emerald-600"/> RECEITAS</div><p className="mt-5 text-2xl font-bold tracking-tight text-neutral-900">{money(income)}</p></div>
      <div className="card p-5"><div className="flex items-center gap-2 text-xs font-semibold text-neutral-400"><ArrowUpRight size={16} className="text-rose-500"/> DESPESAS</div><p className="mt-5 text-2xl font-bold tracking-tight text-neutral-900">{money(expense)}</p></div>
    </section>
    <div className="mt-5 grid items-start gap-5 lg:grid-cols-[1fr_360px]">
      <section className="card p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Movimentações</h2><p className="mt-1 text-xs text-neutral-400">Até 60 registros mais recentes</p></div></div>
        {rows.length?<div className="mt-4 divide-y" style={{borderColor:"var(--viva-line)"}}>{rows.map(x=><div key={x.id} className="flex items-center justify-between gap-3 py-3"><div className="flex min-w-0 items-center gap-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${x.kind==="income"?"bg-emerald-50 text-emerald-700":"bg-neutral-100 text-neutral-600"}`}>{x.kind==="income"?<ArrowDownLeft size={17}/>:<ArrowUpRight size={17}/>}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-neutral-800">{x.description}</p><p className="mt-1 text-xs text-neutral-400">{x.category||"Sem categoria"} · {new Date(x.occurred_on+"T12:00:00").toLocaleDateString("pt-BR")}</p></div></div><strong className={`shrink-0 text-sm ${x.kind==="income"?"text-emerald-700":"text-neutral-900"}`}>{x.kind==="income"?"+":"−"}{money(Number(x.amount))}</strong></div>)}</div>:<div className="py-14 text-center"><Wallet size={28} className="mx-auto text-neutral-300"/><p className="mt-3 font-semibold text-neutral-800">Nenhum lançamento ainda</p><p className="mt-1 text-sm text-neutral-500">Adicione sua primeira receita ou despesa.</p></div>}
      </section>
      <section className="card p-5 sm:p-6"><p className="page-eyebrow">NOVO REGISTRO</p><h2 className="mb-5 mt-1 text-lg font-bold">Adicionar movimentação</h2><RecordForm table="transactions" fields={[{name:"kind",label:"Tipo",options:["income","expense"],required:true},{name:"description",label:"Descrição",required:true},{name:"amount",label:"Valor (R$)",type:"number",required:true},{name:"occurred_on",label:"Data",type:"date",required:true},{name:"category",label:"Categoria",options:["Alimentação","Moradia","Transporte","Saúde","Educação","Lazer","Compras","Contas","Outros"]},{name:"payment_method",label:"Forma de pagamento",options:["Pix","Dinheiro","Débito","Crédito","Transferência","Outro"]}]}/></section>
    </div>
  </div>;
}
