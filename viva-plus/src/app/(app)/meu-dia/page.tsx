import { CalendarDays, Wallet, CheckCircle2, Sparkles, ArrowUpRight, Clock3, Search, ArrowRight, CirclePlus } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const supabase = await createClient();
  const {data:{user}} = await supabase.auth.getUser();
  const first = (user?.user_metadata?.full_name || user?.email || "").split(" ")[0] || "bem-vindo";
  const today = new Intl.DateTimeFormat("pt-BR",{weekday:"long",day:"numeric",month:"long"}).format(new Date());
  const start = new Date(); start.setHours(0,0,0,0);
  const end = new Date(); end.setHours(23,59,59,999);
  const monthStart = new Date(); monthStart.setDate(1);
  const [{data:events},{data:tasks},{data:tx}] = await Promise.all([
    supabase.from("viva_events").select("id,title,start_at").gte("start_at",start.toISOString()).lte("start_at",end.toISOString()).order("start_at").limit(4),
    supabase.from("viva_tasks").select("id,title,due_at,is_done").eq("is_done",false).order("due_at",{ascending:true}).limit(4),
    supabase.from("viva_transactions").select("kind,amount,description,occurred_on").gte("occurred_on",monthStart.toISOString().slice(0,10)).order("occurred_on",{ascending:false}).limit(5)
  ]);
  const income=(tx||[]).filter(x=>x.kind==="income").reduce((a,x)=>a+Number(x.amount),0);
  const expense=(tx||[]).filter(x=>x.kind==="expense").reduce((a,x)=>a+Number(x.amount),0);
  const money=(n:number)=>n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  return <div className="space-y-7">
    <section className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="page-eyebrow capitalize">{today}</p><h1 className="page-title">Olá, {first}.</h1><p className="page-description">Um pouco mais de clareza para o seu dia começar bem.</p></div>
      <Link href="/agenda" className="btn-secondary"><CirclePlus size={16}/> Novo compromisso</Link>
    </section>
    <Link href="/economizar" className="group flex min-h-[62px] items-center gap-3 rounded-2xl border bg-white px-4 shadow-sm transition-all hover:border-[#D9C9EB] hover:shadow-md sm:px-5" style={{borderColor:"var(--viva-line)"}}>
      <span className="icon-surface h-9 w-9"><Search size={18}/></span>
      <span className="min-w-0 flex-1 text-sm text-neutral-400">O que você está procurando hoje?</span>
      <span className="text-xs font-bold text-[var(--viva-purple)]">Buscar <ArrowRight size={14} className="ml-1 inline"/></span>
    </Link>
    <section className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
      <div className="relative overflow-hidden rounded-[22px] bg-[#6410C9] p-6 text-white sm:p-8">
        <div className="relative z-10">
          <p className="text-xs font-semibold tracking-wide text-white/70">VISÃO FINANCEIRA · ESTE MÊS</p>
          <p className="mt-5 text-[clamp(30px,5vw,42px)] font-bold tracking-[-.05em]">{money(income-expense)}</p>
          <p className="mt-2 text-sm text-white/75">Saldo calculado a partir dos seus lançamentos</p>
          <div className="mt-7 flex flex-wrap gap-8 border-t border-white/15 pt-5">
            <div><p className="text-[11px] text-white/65">Receitas</p><p className="mt-1 text-base font-semibold">{money(income)}</p></div>
            <div><p className="text-[11px] text-white/65">Despesas</p><p className="mt-1 text-base font-semibold">{money(expense)}</p></div>
          </div>
        </div>
        <div className="absolute -right-12 -top-24 h-64 w-64 rounded-full border border-white/10"/><div className="absolute -bottom-36 right-16 h-72 w-72 rounded-full border border-white/10"/>
        <Link href="/financas" className="absolute right-5 top-5 rounded-full bg-white/12 p-2 text-white transition-colors hover:bg-white/20" aria-label="Abrir finanças"><ArrowUpRight size={18}/></Link>
      </div>
      <div className="card flex flex-col justify-between p-6">
        <div><span className="icon-surface h-10 w-10"><CalendarDays size={19}/></span><p className="mt-5 text-sm font-semibold text-neutral-500">Compromissos de hoje</p><p className="mt-1 text-3xl font-bold tracking-tight text-neutral-900">{events?.length||0}</p><p className="mt-1 text-xs text-neutral-400">Na sua agenda</p></div>
        <Link href="/agenda" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[var(--viva-purple)]">Ver agenda <ArrowRight size={15}/></Link>
      </div>
    </section>
    <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <div className="card p-5 sm:p-6">
        <div className="flex items-center justify-between"><div><p className="page-eyebrow">SEU DIA</p><h2 className="mt-1 text-lg font-bold tracking-tight">Próximos compromissos</h2></div><span className="icon-surface h-9 w-9"><Clock3 size={17}/></span></div>
        {events?.length? <div className="mt-4 divide-y" style={{borderColor:"var(--viva-line)"}}>{events.map(e=><div key={e.id} className="flex items-center gap-3 py-3"><div className="w-12 shrink-0 rounded-xl bg-[var(--viva-purple-soft)] py-2 text-center text-xs font-bold text-[var(--viva-purple)]">{new Date(e.start_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div><p className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-800">{e.title}</p></div>)}</div>:<div className="py-8 text-center"><p className="text-sm text-neutral-500">Seu dia está livre por enquanto.</p><Link href="/agenda" className="mt-3 inline-flex text-sm font-bold text-[var(--viva-purple)]">Adicionar compromisso <ArrowRight size={14} className="ml-1"/></Link></div>}
      </div>
      <div className="card p-5 sm:p-6">
        <div className="flex items-center justify-between"><div><p className="page-eyebrow">ORGANIZAÇÃO</p><h2 className="mt-1 text-lg font-bold tracking-tight">Tarefas pendentes</h2></div><span className="icon-surface h-9 w-9"><CheckCircle2 size={18}/></span></div>
        {tasks?.length?<div className="mt-4 divide-y" style={{borderColor:"var(--viva-line)"}}>{tasks.map(t=><div key={t.id} className="flex items-center gap-3 py-3"><span className="h-2 w-2 shrink-0 rounded-full bg-[var(--viva-purple)]"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-neutral-800">{t.title}</p>{t.due_at&&<p className="mt-1 text-xs text-neutral-400">Até {new Date(t.due_at).toLocaleDateString("pt-BR")}</p>}</div></div>)}</div>:<p className="py-8 text-center text-sm text-neutral-500">Nenhuma tarefa pendente.</p>}
      </div>
    </section>
    <section className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex items-center gap-3"><span className="icon-surface h-11 w-11"><Sparkles size={20}/></span><div><p className="text-sm font-bold text-neutral-900">Uma ideia para hoje</p><p className="mt-1 text-sm text-neutral-500">Converse com o Assistente VIVA+ para organizar seus próximos passos.</p></div></div>
      <Link href="/assistente" className="btn-primary shrink-0">Falar com o Assistente <ArrowRight size={15}/></Link>
    </section>
    <section className="pb-2"><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-bold text-neutral-900">Movimentações recentes</h2><Link href="/financas" className="text-xs font-bold text-[var(--viva-purple)]">Ver tudo</Link></div>
      {tx?.length?<div className="card divide-y px-5" style={{borderColor:"var(--viva-line)"}}>{tx.map((x,i)=><div key={i} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-neutral-800">{x.description}</p><p className="mt-1 text-xs text-neutral-400">{new Date(x.occurred_on+"T12:00:00").toLocaleDateString("pt-BR")}</p></div><p className={`shrink-0 text-sm font-bold ${x.kind==="income"?"text-emerald-700":"text-neutral-900"}`}>{x.kind==="income"?"+":"−"}{money(Number(x.amount))}</p></div>)}</div>:<p className="text-sm text-neutral-400">Seus lançamentos aparecerão aqui.</p>}
    </section>
  </div>;
}
