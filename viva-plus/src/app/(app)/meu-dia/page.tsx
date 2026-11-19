import { CalendarDays, CheckCircle2, Sparkles, ArrowRight, Clock3, ChevronRight } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PaydayCard from "@/components/payday-card";
import MoneyHero from "@/components/money-hero";
import QuickActions from "@/components/quick-actions";
import TxList, { type Tx } from "@/components/tx-list";
import { todayBR } from "@/lib/payday";

// Tela inicial: resumo do mês na faixa roxa, atalhos, pagamento, últimos lançamentos, agenda e tarefas.
export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const name = String(user?.user_metadata?.full_name || "").trim();
  const first = name.split(" ")[0] || "bem-vindo";
  const initials = (name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("") || first[0] || "V").toUpperCase();
  const today = todayBR();
  const monthStart = today.slice(0, 7) + "-01";
  const dateLabel = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" }).format(new Date()).replace(/^./, c => c.toUpperCase());
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hourCycle: "h23" }).format(new Date()));
  const hello = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const uid = user?.id || "";
  const [{ data: monthTx }, { data: recent }, { data: events }, { data: tasks }] = await Promise.all([
    supabase.from("viva_transactions").select("kind,amount").eq("user_id", uid).gte("occurred_on", monthStart).limit(2000),
    supabase.from("viva_transactions").select("id,kind,amount,description,category,occurred_on,payment_method,source").eq("user_id", uid).order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(5),
    supabase.from("viva_events").select("id,title,start_at").eq("user_id", uid).gte("start_at", `${today}T00:00:00-03:00`).lte("start_at", `${today}T23:59:59-03:00`).order("start_at").limit(4),
    supabase.from("viva_tasks").select("id,title,due_at").eq("user_id", uid).eq("is_done", false).order("due_at", { ascending: true, nullsFirst: false }).limit(5),
  ]);
  const income = (monthTx || []).filter(x => x.kind === "income").reduce((a, x) => a + Number(x.amount), 0);
  const expense = (monthTx || []).filter(x => x.kind === "expense").reduce((a, x) => a + Number(x.amount), 0);

  return <div className="vx-page">
    <MoneyHero greeting={`${hello}, ${first}`} subtitle={dateLabel} initials={initials} label="Saldo do mês" balance={income - expense} income={income} expense={expense} href="/financas" />
    <QuickActions />
    <PaydayCard />

    <section className="vx-card">
      <Link href="/financas" className="vx-card-head"><h2>Últimos lançamentos</h2><ChevronRight size={20} aria-hidden /></Link>
      <TxList rows={(recent || []) as Tx[]} empty="Nenhum lançamento ainda. Toque em “Lançar gasto” ou fale com a VIVA." />
    </section>

    <div className="vx-two">
      <section className="vx-card">
        <Link href="/agenda" className="vx-card-head"><h2><CalendarDays size={19} aria-hidden /> Agenda de hoje</h2><ChevronRight size={20} aria-hidden /></Link>
        {events?.length ? <ul className="vx-rows">{events.map(e => <li key={e.id}><Clock3 size={17} aria-hidden /><b>{e.title}</b><small>{new Date(e.start_at).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}</small></li>)}</ul>
          : <p className="vx-empty">Nada marcado para hoje. <Link href="/agenda">Adicionar compromisso</Link></p>}
      </section>
      <section className="vx-card">
        <div className="vx-card-head"><h2><CheckCircle2 size={19} aria-hidden /> Tarefas pendentes</h2></div>
        {tasks?.length ? <ul className="vx-rows">{tasks.map(t => <li key={t.id}><span className="vx-dot" aria-hidden /><b>{t.title}</b>{t.due_at && <small>{new Date(t.due_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</small>}</li>)}</ul>
          : <p className="vx-empty">Você não tem tarefas pendentes.</p>}
      </section>
    </div>

    <Link href="/assistente" className="vx-banner">
      <span className="vx-banner-ico" aria-hidden><Sparkles size={22} /></span>
      <span><b>Fale com a VIVA</b><small>Pergunte sobre seu dinheiro, sua rotina ou peça para lançar um gasto.</small></span>
      <ArrowRight size={20} aria-hidden />
    </Link>
  </div>;
}
