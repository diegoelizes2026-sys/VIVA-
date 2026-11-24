import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, CalendarCheck2, Flame, MessageCircle, Receipt, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { REPORT_PERIODS, brl, buildReport, changeText, reportRange, type ReportPeriod } from "@/lib/report";

export const metadata = { title: "Relatórios · VIVA+" };
export const dynamic = "force-dynamic";

// Relatório semanal e mensal: quanto entrou, quanto saiu, onde o dinheiro foi e como foi frente ao período anterior.
export default async function Page({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const period: ReportPeriod = REPORT_PERIODS.some(x => x.id === p) ? (p as ReportPeriod) : "semana";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const range = reportRange(period);
  let r: Awaited<ReturnType<typeof buildReport>> | null = null;
  try { r = await buildReport(supabase, user?.id || "", range); } catch (e) { console.error("VIVA report", e); }

  const change = r ? changeText(r) : null;
  const down = (r?.changePct ?? 0) < 0;
  return <div className="rp">
    <span className="viva-eyebrow">RELATÓRIOS</span>
    <h1 className="rp-title">Para onde foi seu dinheiro</h1>
    <nav className="rp-tabs" aria-label="Período">
      {REPORT_PERIODS.map(t => <Link key={t.id} href={`/relatorio?p=${t.id}`} className={t.id === period ? "on" : ""} aria-current={t.id === period ? "page" : undefined}>{t.label}</Link>)}
    </nav>

    {!r ? <p className="rp-empty">Não consegui montar o relatório agora. Tente de novo em instantes.</p> : <>
      <section className="rp-hero">
        <span className="rp-hero-label">{range.title} · {range.subtitle}</span>
        <span className="rp-hero-k">Você gastou</span>
        <strong>{brl(r.spent)}</strong>
        {change && <span className={"rp-chip " + (down ? "good" : "bad")}>{down ? <ArrowDownRight size={15} aria-hidden /> : <ArrowUpRight size={15} aria-hidden />}{change}</span>}
        <div className="rp-hero-row">
          <div><small>Entrou</small><b>{brl(r.income)}</b></div>
          <div><small>{r.balance >= 0 ? "Sobrou" : "Faltou"}</small><b>{brl(Math.abs(r.balance))}</b></div>
          <div><small>Média por dia</small><b>{brl(r.avgPerDay)}</b></div>
        </div>
      </section>

      {r.count === 0 ? <section className="rp-card rp-empty">
        <b>Nenhum gasto anotado neste período.</b>
        <p>Anote seus gastos (ou mande no WhatsApp: “gastei 20 no lanche”) e aqui aparece para onde foi cada real.</p>
        <Link className="rp-btn" href="/assistente"><MessageCircle size={17} aria-hidden /> Anotar um gasto</Link>
      </section> : <>
        <section className="rp-card">
          <h2>Onde você mais gastou</h2>
          <ul className="rp-cats">
            {r.categories.slice(0, 6).map((c, i) => <li key={c.name}>
              <div className="rp-cat-top"><span>{c.name}</span><b>{brl(c.amount)}</b></div>
              <div className="rp-bar" aria-hidden><i style={{ width: `${Math.max(3, Math.round(c.share * 100))}%`, opacity: 1 - i * 0.12 }} /></div>
              <small>{Math.round(c.share * 100)}% do total</small>
            </li>)}
          </ul>
        </section>

        <div className="rp-grid">
          {r.biggest && <section className="rp-card rp-mini"><Trophy size={20} aria-hidden /><small>Maior gasto</small><b>{brl(r.biggest.amount)}</b><span>{r.biggest.description} · {r.biggest.date.slice(8, 10)}/{r.biggest.date.slice(5, 7)}</span></section>}
          <section className="rp-card rp-mini"><Flame size={20} aria-hidden /><small>Dias sem gastar</small><b>{r.daysWithoutSpending} de {r.days}</b><span>{r.count} {r.count === 1 ? "gasto anotado" : "gastos anotados"}</span></section>
          <section className="rp-card rp-mini"><CalendarCheck2 size={20} aria-hidden /><small>Contas pagas</small><b>{r.billsPaid.count}</b><span>{r.billsPaid.count ? brl(r.billsPaid.amount) : "nenhuma no período"}</span></section>
          <section className="rp-card rp-mini"><Receipt size={20} aria-hidden /><small>Vencem em 7 dias</small><b>{r.billsNext7.count}</b><span>{r.billsNext7.count ? brl(r.billsNext7.amount) : "nada por vir"}</span></section>
        </div>
      </>}

      <section className="rp-card rp-ask">
        <div><b>Quer entender melhor?</b><p>Pergunte à VIVA: “onde posso cortar gastos?” ou “como fechar o mês no azul?”.</p></div>
        <Link className="rp-btn" href="/assistente"><MessageCircle size={17} aria-hidden /> Perguntar à VIVA</Link>
      </section>
      <p className="rp-foot">Você recebe o resumo da semana no domingo à noite e o do mês no dia 1º. Ajuste em <Link href="/configuracoes/notificacoes">Notificações</Link>.</p>
    </>}
  </div>;
}
