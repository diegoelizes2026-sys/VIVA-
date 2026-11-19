"use client";
import { ShoppingCart, House, Bus, Pill, GraduationCap, PartyPopper, ShoppingBag, Receipt, BadgeDollarSign, Circle } from "lucide-react";
import { useHiddenValues, brl } from "@/components/money-hero";

export type Tx = { id: string; kind: string; amount: number | string; description: string; category: string | null; occurred_on: string; payment_method?: string | null; source?: string | null };
const ICON: Record<string, React.ReactNode> = {
  "Alimentação": <ShoppingCart />, Moradia: <House />, Transporte: <Bus />, "Saúde": <Pill />, "Educação": <GraduationCap />,
  Lazer: <PartyPopper />, Compras: <ShoppingBag />, Contas: <Receipt />, Renda: <BadgeDollarSign />,
};
const day = (iso: string) => {
  const d = new Date(iso + "T12:00:00");
  const t = new Date(); t.setHours(12, 0, 0, 0);
  const diff = Math.round((t.getTime() - d.getTime()) / 86400000);
  return diff === 0 ? "Hoje" : diff === 1 ? "Ontem" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
};

export default function TxList({ rows, empty = "Nenhum lançamento ainda." }: { rows: Tx[]; empty?: string }) {
  const { hidden } = useHiddenValues();
  if (!rows.length) return <p className="vx-empty">{empty}</p>;
  return <ul className="vx-tx">
    {rows.map(x => {
      const income = x.kind === "income";
      return <li key={x.id}>
        <span className={"vx-tx-ico" + (income ? " in" : "")} aria-hidden>{ICON[x.category || ""] || <Circle />}</span>
        <div className="vx-tx-text"><b>{x.description}</b><small>{x.category || "Outros"} · {day(x.occurred_on)}{x.payment_method ? ` · ${x.payment_method}` : ""}{x.source === "viva" ? " · via VIVA" : ""}</small></div>
        <strong className={income ? "in" : ""}>{hidden ? "••••" : (income ? "+" : "−") + brl(Number(x.amount))}</strong>
      </li>;
    })}
  </ul>;
}
