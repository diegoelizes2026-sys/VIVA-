"use client";
import { useEffect, useState } from "react";
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

const STATUS_TEXT = { green: "Tranquilo", amber: "Vai com calma", red: "Segura a mão hoje" } as const;

function TodayNumber({ t, show }: { t: TodayBudget; show: (n: number) => string }) {
  if (t.mode === "setup") return <div className="vx-today">
    <span className="vx-hero-label">Quanto você pode gastar hoje?</span>
    <p className="vx-today-setup">Diga quando recebe e quanto entra. A VIVA calcula seu valor do dia e avisa antes de o dinheiro acabar.</p>
    <button type="button" className="vx-today-cta" onClick={() => window.dispatchEvent(new Event("viva:open-receive"))}>Descobrir meu valor do dia</button>
  </div>;
  const over = t.remaining < 0;
  return <Link href="/financas" className="vx-today">
    <span className="vx-hero-label">Hoje você pode gastar<ChevronRight size={16} aria-hidden /></span>
    <strong className="vx-today-num">{show(Math.max(0, t.remaining))}</strong>
    <span className={"vx-today-pill " + t.status}><i aria-hidden />{STATUS_TEXT[t.status]}</span>
    <small className="vx-today-sub">
      {over ? <>Você passou {show(-t.remaining)} do valor de hoje.</> : t.spentToday > 0 ? <>Já gastou {show(t.spentToday)} de {show(t.allowance)} hoje.</> : null}
      {" "}{t.mode === "limit" ? "Seu limite diário." : `${show(t.allowance)} por dia até ${t.horizonLabel} (${t.daysLeft} ${t.daysLeft === 1 ? "dia" : "dias"}).`}
      {t.estimatedIncome ? " Usei a renda do seu perfil: registre quando receber para ficar exato." : ""}
    </small>
  </Link>;
}

export default function MoneyHero({ greeting, subtitle, label, balance, income, expense, href, initials, today }: {
  greeting: string; subtitle?: string; label: string; balance: number; income: number; expense: number; href?: string; initials?: string; today?: TodayBudget;
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
    {today && <TodayNumber t={today} show={show} />}
    {href ? <Link href={href} className="vx-hero-money">{month}</Link> : <div className="vx-hero-money">{month}</div>}
  </section>;
}
