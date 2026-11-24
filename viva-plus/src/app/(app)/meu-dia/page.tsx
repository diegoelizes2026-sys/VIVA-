import { CalendarDays, CheckCircle2, Sparkles, ArrowRight, Clock3, ChevronRight } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PaydayCard from "@/components/payday-card";
import WhatsappConnect from "@/components/whatsapp-connect";
import MoneyHero from "@/components/money-hero";
import QuickActions from "@/components/quick-actions";
import TxList, { type Tx } from "@/components/tx-list";
import { loadTodayBudget } from "@/lib/daily-budget-load";
import { BillsDueCard, CanIBuyCard, ForecastCard, OneTapExpenses, VictoryCard, type DueBill } from "@/components/today-cards";
import { topQuickPicks } from "@/lib/quick-picks";
import { addDays, todayBR } from "@/lib/payday";
import { ensureWelcomeTrial } from "@/lib/welcome-trial";

// Tela inicial: o "número do dia" (quanto dá para gastar hoje) na faixa roxa, o aviso de até quando
// o dinheiro dura, "Posso comprar?", atalhos, pagamento, últimos lançamentos, agenda e tarefas.
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
  // Quem tem conta e nunca testou o Pro ganha os 7 dias ao abrir o app (uma vez por conta).
  const gift = uid ? await ensureWelcomeTrial(supabase, uid) : false;
  const { budget: todayBudget, streak, cycleTx } = await loadTodayBudget(supabase, uid, today);
  const [{ data: recent }, { data: events }, { data: tasks }, { data: history }, { data: dueBills }, { data: paidBillTx }] = await Promise.all([
    supabase.from("viva_transactions").select("id,kind,amount,description,category,occurred_on,payment_method,source").eq("user_id", uid).order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(5),
    supabase.from("viva_events").select("id,title,start_at").eq("user_id", uid).gte("start_at", `${today}T00:00:00-03:00`).lte("start_at", `${today}T23:59:59-03:00`).order("start_at").limit(4),
    supabase.from("viva_tasks").select("id,title,due_at").eq("user_id", uid).eq("is_done", false).order("due_at", { ascending: true, nullsFirst: false }).limit(5),
    supabase.from("viva_transactions").select("id,description,category,payment_method,amount,occurred_on").eq("user_id", uid).eq("kind", "expense").gte("occurred_on", addDays(today, -60)).order("occurred_on", { ascending: false }).limit(600),
    supabase.from("viva_bills").select("id,name,amount,due_date").eq("user_id", uid).neq("status", "paid").gte("due_date", addDays(today, -30)).lte("due_date", addDays(today, 1)).order("due_date").limit(4),
    supabase.from("viva_bills").select("paid_transaction_id").eq("user_id", uid).eq("status", "paid").not("paid_transaction_id", "is", null).gte("updated_at", addDays(today, -62)).limit(500),
  ]);
  // Pagamentos de contas cadastradas não viram atalho de 1 toque.
  const billTxIds = new Set((paidBillTx || []).map(b => String(b.paid_transaction_id)));
  const picks = topQuickPicks((history || []).filter(h => !billTxIds.has(String(h.id))));
  const monthTx = cycleTx.filter(x => x.occurred_on >= monthStart);
  const income = (monthTx || []).filter(x => x.kind === "income").reduce((a, x) => a + Number(x.amount), 0);
  const expense = (monthTx || []).filter(x => x.kind === "expense").reduce((a, x) => a + Number(x.amount), 0);

  return <div className="vx-page">
    {gift && <p className="ob-gift" role="status">🎁 <b>Presente pra você:</b> 7 dias do VIVA+ Pro grátis, já ativados. VIVA no WhatsApp sem limite, voz e foto de comprovante. Sem cartão e sem cobrança.</p>}
    <MoneyHero greeting={`${hello}, ${first}`} subtitle={dateLabel} initials={initials} label="Saldo do mês" balance={income - expense} income={income} expense={expense} href="/financas" today={todayBudget} streak={streak} />
    <WhatsappConnect variant="home" />
    <ForecastCard today={todayBudget} />
    <BillsDueCard today={today} bills={(dueBills || []).map(b => ({ ...b, amount: Number(b.amount) })) as DueBill[]} />
    <VictoryCard today={todayBudget} streak={streak} />
    <OneTapExpenses picks={picks} />
    <CanIBuyCard />
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
