import { CalendarDays, Wallet, CheckCircle2, Sparkles, ArrowRight, Clock3 } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const first = (user?.user_metadata?.full_name || user?.email || "").split(" ")[0] || "bem-vindo";
  const today = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const [{ data: events }, { data: tasks }, { data: tx }] = await Promise.all([
    supabase.from("events").select("id,title,start_at").gte("start_at", new Date(new Date().setHours(0,0,0,0)).toISOString()).lte("start_at", new Date(new Date().setHours(23,59,59,999)).toISOString()).order("start_at").limit(4),
    supabase.from("tasks").select("id,title,due_at,is_done").eq("is_done", false).order("due_at", { ascending: true }).limit(5),
    supabase.from("transactions").select("kind,amount").gte("occurred_on", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10))
  ]);
  const income = (tx || []).filter(x => x.kind === "income").reduce((a,x) => a + Number(x.amount), 0);
  const expense = (tx || []).filter(x => x.kind === "expense").reduce((a,x) => a + Number(x.amount), 0);
  const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return <div>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold capitalize text-neutral-500">{today}</p><h1 className="mt-2 text-3xl font-black tracking-tight text-neutral-950 md:text-4xl">Olá, {first}!</h1><p className="mt-2 text-sm text-neutral-500">Vamos organizar seu dia?</p></div><Link href="/agenda" className="btn-primary">Novo compromisso <ArrowRight size={16}/></Link></div>

    <div className="mt-8 grid gap-4 md:grid-cols-3">
      <div className="rounded-2xl p-5 text-white shadow-[0_12px_30px_rgba(100,16,201,.16)]" style={{ background: "var(--color-primary)" }}><div className="flex items-center justify-between"><span className="text-sm text-white/75">Saldo do mês</span><Wallet size={20}/></div><p className="mt-5 text-3xl font-black">{brl(income-expense)}</p><p className="mt-2 text-xs text-white/75">Receitas menos despesas registradas</p></div>
      <div className="card p-5"><p className="text-sm text-neutral-500">Receitas do mês</p><p className="mt-5 text-2xl font-extrabold text-neutral-900">{brl(income)}</p><p className="mt-2 text-xs text-emerald-700">Dados dos seus lançamentos</p></div>
      <div className="card p-5"><p className="text-sm text-neutral-500">Despesas do mês</p><p className="mt-5 text-2xl font-extrabold text-neutral-900">{brl(expense)}</p><p className="mt-2 text-xs text-neutral-500">Dados dos seus lançamentos</p></div>
    </div>

    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <section className="card p-5 md:p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-extrabold text-neutral-900">Agenda de hoje</h2><span className="icon-surface h-10 w-10"><CalendarDays size={19}/></span></div>
        {events?.length ? events.map(e => <div key={e.id} className="mt-4 flex gap-3 border-t pt-4" style={{ borderColor: "var(--color-gray)" }}><Clock3 size={17} style={{ color: "var(--color-primary)" }}/><div><p className="font-semibold text-neutral-800">{e.title}</p><p className="text-xs text-neutral-500">{new Date(e.start_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p></div></div>) : <p className="mt-6 text-sm text-neutral-500">Nenhum compromisso cadastrado para hoje. <Link className="font-bold" style={{ color: "var(--color-primary)" }} href="/agenda">Adicionar agora</Link></p>}
      </section>
      <section className="card p-5 md:p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-extrabold text-neutral-900">Tarefas pendentes</h2><span className="icon-surface h-10 w-10"><CheckCircle2 size={19}/></span></div>
        {tasks?.length ? tasks.map(t => <div key={t.id} className="mt-4 border-t pt-4" style={{ borderColor: "var(--color-gray)" }}><p className="font-semibold text-neutral-800">{t.title}</p>{t.due_at && <p className="mt-1 text-xs text-neutral-500">Prazo: {new Date(t.due_at).toLocaleDateString("pt-BR")}</p>}</div>) : <p className="mt-6 text-sm text-neutral-500">Você não tem tarefas pendentes.</p>}
      </section>
    </div>

    <section className="card mt-5 flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between md:p-6"><div className="flex gap-3"><span className="icon-surface h-11 w-11 shrink-0"><Sparkles size={21}/></span><div><h2 className="font-extrabold text-neutral-900">Assistente VIVA+</h2><p className="mt-1 text-sm text-neutral-500">Converse sobre sua rotina e seus objetivos.</p></div></div><Link href="/assistente" className="btn-primary">Conversar com IA <ArrowRight size={16}/></Link></section>
  </div>;
}