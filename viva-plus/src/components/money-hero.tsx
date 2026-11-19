"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, ChevronRight } from "lucide-react";

// Faixa roxa do topo: saudação, saldo do mês e botão de esconder os valores (lembrado no aparelho).
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

export default function MoneyHero({ greeting, subtitle, label, balance, income, expense, href, initials }: {
  greeting: string; subtitle?: string; label: string; balance: number; income: number; expense: number; href?: string; initials?: string;
}) {
  const { hidden, toggle } = useHiddenValues();
  const show = (n: number) => (hidden ? "R$ ••••" : brl(n));
  const Inner = <>
    <span className="vx-hero-label">{label}{href && <ChevronRight size={16} aria-hidden />}</span>
    <strong className={"vx-hero-balance" + (balance < 0 ? " neg" : "")}>{show(balance)}</strong>
    <span className="vx-hero-flow"><i className="in">↓ Entrou {show(income)}</i><i className="out">↑ Saiu {show(expense)}</i></span>
  </>;
  return <section className="vx-hero" aria-label="Resumo do mês">
    <div className="vx-hero-top">
      <div className="vx-hero-hi">{initials && <span className="vx-avatar" aria-hidden>{initials}</span>}<div><b>{greeting}</b>{subtitle && <small>{subtitle}</small>}</div></div>
      <button className="vx-eye" onClick={toggle} aria-label={hidden ? "Mostrar valores" : "Esconder valores"} aria-pressed={hidden}>{hidden ? <EyeOff size={22} /> : <Eye size={22} />}</button>
    </div>
    {href ? <Link href={href} className="vx-hero-money">{Inner}</Link> : <div className="vx-hero-money">{Inner}</div>}
  </section>;
}
