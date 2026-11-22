"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, ChevronRight } from "lucide-react";
import type { TodayBudget } from "@/lib/daily-budget";

// Faixa roxa do topo: saudação, o "número do dia" (quanto dá para gastar hoje),
// o saldo do mês e o botão de esconder os valores (lembrado no aparelho).
const KEY = "viva-hide-values";
export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function useHiddenValues() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try { setHidden(localStorage.getItem(KEY) === "1"); } catch { /* navegação privada */ }
    const on = () => { try { setHidden(localStorage.getItem(KEY) === "1"); } catch { /* */ } };
    window.addEventListener("viva:hide-values", on);
    return () => window.removeEventListener("viva:hide-values", on);
  }, []);
  const toggle = () => {
    const next = !hidden; setHidden(next);
    try { localStorage.setItem(KEY, next ? "1" : "0"); } catch { /* */ }
    window.dispatchEvent(new Event("viva:hide-values"));
  };
  return { hidden, toggle };
}

export function Money({ value, className }: { value: number; className?: string }) {
  const { hidden } = useHiddenValues();
  return <span className={className}>{hidden ? "R$ ••••" : brl(value)}</span>;
}

/** Configuração em 1 minuto: duas perguntas e o número aparece na hora. */
function QuickSetup() {
  const router = useRouter();
  const [income, setIncome] = useState("");
  const [day, setDay] = useState("");
  const [noFixedDay, setNoFixedDay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    const value = Number(income.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    const payDay = noFixedDay ? null : Number(day);
    if (!Number.isFinite(value) || value <= 0) { setError("Quanto entra por mês? Ex.: 2500"); return; }
    if (!noFixedDay && !(Number.isInteger(payDay) && payDay! >= 1 && payDay! <= 31)) { setError("Que dia o dinheiro cai? De 1 a 31."); return; }
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/today/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ monthly_income: value, pay_day: payDay }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar.");
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar."); setBusy(false); }
  }
  return <form className="vx-today vx-setup" onSubmit={save}>
    <span className="vx-hero-label">Quanto você pode gastar hoje?</span>
    <p className="vx-today-setup">Responda 2 perguntas e a VIVA calcula seu valor do dia. Leva 1 minuto.</p>
    <div className="vx-setup-row">
      <label>Quanto recebe por mês<input inputMode="decimal" placeholder="R$ 2.500" value={income} onChange={e => setIncome(e.target.value)} maxLength={14} /></label>
      {!noFixedDay && <label>Dia que cai<input inputMode="numeric" placeholder="Dia 5" value={day} onChange={e => setDay(e.target.value.replace(/\D/g, "").slice(0, 2))} /></label>}
    </div>
    <label className="vx-setup-check"><input type="checkbox" checked={noFixedDay} onChange={e => setNoFixedDay(e.target.checked)} /> Não tenho dia fixo (renda varia)</label>
    {error && <p role="alert" className="vx-setup-err">{error}</p>}
    <button type="submit" className="vx-today-cta" disabled={busy}>{busy ? "Calculando…" : "Ver meu valor do dia"}</button>
  </form>;
}

const STATUS_TEXT = { green: "Tranquilo", amber: "Vai com calma", red: "Segura a mão hoje" } as const;

function TodayNumber({ t, show, streak }: { t: TodayBudget; show: (n: number) => string; streak: number }) {
  if (t.mode === "setup") return <QuickSetup />;
  const over = t.remaining < 0;
  return <Link href="/financas" className="vx-today">
    <span className="vx-hero-label">Hoje você pode gastar<ChevronRight size={16} aria-hidden /></span>
    <strong className="vx-today-num">{show(Math.max(0, t.remaining))}</strong>
    <span className="vx-today-pills">
      <span className={"vx-today-pill " + t.status}><i aria-hidden />{STATUS_TEXT[t.status]}</span>
      {streak >= 2 && !over && <span className="vx-streak" title="Dias seguidos dentro do valor do dia">🔥 {streak} dias seguidos</span>}
      {streak >= 2 && over && <span className="vx-streak off">Eram {streak} dias seguidos. Amanhã começa de novo 💪</span>}
    </span>
    <small className="vx-today-sub">
      {over ? <>Você passou {show(-t.remaining)} do valor de hoje.</> : t.spentToday > 0 ? <>Já gastou {show(t.spentToday)} de {show(t.allowance)} hoje.</> : null}
      {" "}{t.mode === "limit" ? "Seu limite diário." : `${show(t.allowance)} por dia até ${t.horizonLabel} (${t.daysLeft} ${t.daysLeft === 1 ? "dia" : "dias"}).`}
      {t.estimatedIncome ? " Usei a renda do seu perfil: registre quando receber para ficar exato." : ""}
    </small>
  </Link>;
}

export default function MoneyHero({ greeting, subtitle, label, balance, income, expense, href, initials, today, streak = 0 }: {
  greeting: string; subtitle?: string; label: string; balance: number; income: number; expense: number; href?: string; initials?: string; today?: TodayBudget; streak?: number;
}) {
  const { hidden, toggle } = useHiddenValues();
  const show = (n: number) => (hidden ? "R$ ••••" : brl(n));
  const month = today
    ? <span className="vx-hero-month"><b>{label}: {show(balance)}</b><i className="in">↓ {show(income)}</i><i className="out">↑ {show(expense)}</i></span>
    : <>
      <span className="vx-hero-label">{label}{href && <ChevronRight size={16} aria-hidden />}</span>
      <strong className={"vx-hero-balance" + (balance < 0 ? " neg" : "")}>{show(balance)}</strong>
      <span className="vx-hero-flow"><i className="in">↓ Entrou {show(income)}</i><i className="out">↑ Saiu {show(expense)}</i></span>
    </>;
  return <section className="vx-hero" aria-label={today ? "Seu dia" : "Resumo do mês"}>
    <div className="vx-hero-top">
      <div className="vx-hero-hi">{initials && <span className="vx-avatar" aria-hidden>{initials}</span>}<div><b>{greeting}</b>{subtitle && <small>{subtitle}</small>}</div></div>
      <button className="vx-eye" onClick={toggle} aria-label={hidden ? "Mostrar valores" : "Esconder valores"} aria-pressed={hidden}>{hidden ? <EyeOff size={22} /> : <Eye size={22} />}</button>
    </div>
    {today && <TodayNumber t={today} show={show} streak={streak} />}
    {href ? <Link href={href} className="vx-hero-money">{month}</Link> : <div className="vx-hero-money">{month}</div>}
  </section>;
}
