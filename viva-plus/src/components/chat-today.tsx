"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, ChevronRight, Receipt, BadgeDollarSign, CalendarClock, ShoppingCart, CalendarDays, MapPin } from "lucide-react";
import PaydayCard from "@/components/payday-card";
import { brl, useHiddenValues } from "@/components/money-hero";

type Today = { name: string | null; balance: number; income: number; expense: number; bills: { overdue: number; week: number; total: number; dueToday: number } };

// Topo do chat (tela principal): o dia em um olhar + atalhos do dia a dia. Some quando a conversa começa.
export default function ChatToday({ busy }: { busy?: boolean }) {
  const [t, setT] = useState<Today | null>(null);
  const { hidden, toggle } = useHiddenValues();
  const load = () => fetch("/api/today").then(r => (r.ok ? r.json() : null)).then(setT).catch(() => setT(null));
  useEffect(() => {
    load();
    const on = () => load();
    window.addEventListener("viva:transactions-updated", on);
    return () => window.removeEventListener("viva:transactions-updated", on);
  }, []);
  const show = (n: number) => (hidden ? "R$ ••••" : brl(n));
  const b = t?.bills;
  const billsLine = !b ? null
    : b.overdue ? { cls: "warn", text: `${b.overdue} ${b.overdue === 1 ? "conta atrasada" : "contas atrasadas"}${b.week ? ` · ${b.week} vencendo` : ""}` }
    : b.dueToday ? { cls: "warn", text: `${b.dueToday === 1 ? "1 conta vence hoje" : `${b.dueToday} contas vencem hoje`}` }
    : b.week ? { cls: "", text: `${b.week} ${b.week === 1 ? "conta vence" : "contas vencem"} esta semana` }
    : { cls: "ok", text: "Nenhuma conta para esta semana" };

  const tiles: { label: string; icon: React.ReactNode; onClick?: () => void; href?: string }[] = [
    { label: "Lancei um gasto", icon: <Receipt />, onClick: () => window.dispatchEvent(new Event("viva:open-expense")) },
    { label: "Recebi dinheiro", icon: <BadgeDollarSign />, onClick: () => window.dispatchEvent(new Event("viva:open-receive")) },
    { label: "Contas", icon: <CalendarClock />, href: "/contas" },
    { label: "Lista de compras", icon: <ShoppingCart />, href: "/lista-de-compras" },
    { label: "Meu dia", icon: <CalendarDays />, href: "/meu-dia" },
    { label: "Perto de mim", icon: <MapPin />, href: "/perto" },
  ];

  return <section className="ct" aria-label="Seu dia">
    <div className="ct-card">
      <div className="ct-top">
        <b>{t?.name ? `Oi, ${t.name}!` : "Oi!"} <span>O que vamos resolver hoje?</span></b>
        <button className="ct-eye" onClick={toggle} aria-label={hidden ? "Mostrar valores" : "Esconder valores"} aria-pressed={hidden}>{hidden ? <EyeOff size={20} /> : <Eye size={20} />}</button>
      </div>
      <Link href="/meu-dia" className="ct-money">
        <span>Saldo do mês <ChevronRight size={15} aria-hidden /></span>
        <strong className={t && t.balance < 0 ? "neg" : ""}>{t ? show(t.balance) : "…"}</strong>
      </Link>
      {billsLine && <Link href="/contas" className={"ct-bills " + billsLine.cls}>{billsLine.text}{b && b.total > 0 && !hidden ? ` · ${brl(b.total)}` : ""}<ChevronRight size={15} aria-hidden /></Link>}
    </div>
    <PaydayCard compact />
    <div className="ct-tiles">
      {tiles.map(x => {
        const inner = <><span className="ct-ico" aria-hidden>{x.icon}</span><span>{x.label}</span></>;
        return x.href ? <Link key={x.label} href={x.href} className="ct-tile">{inner}</Link>
          : <button key={x.label} type="button" className="ct-tile" onClick={x.onClick} disabled={busy}>{inner}</button>;
      })}
    </div>
  </section>;
}
