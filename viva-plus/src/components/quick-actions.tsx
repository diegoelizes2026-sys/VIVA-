"use client";
import Link from "next/link";
import { BadgeDollarSign, Receipt, CalendarClock, ShoppingCart, MapPin, Target, MessageCircleHeart, HeartPulse } from "lucide-react";

// Fileira de atalhos redondos (rola para o lado no celular).
type Action = { label: string; href?: string; event?: string; icon: React.ReactNode };
const ACTIONS: Action[] = [
  { label: "Recebi", event: "viva:open-receive", icon: <BadgeDollarSign /> },
  { label: "Lançar gasto", href: "/financas#novo-lancamento", icon: <Receipt /> },
  { label: "Contas", href: "/contas", icon: <CalendarClock /> },
  { label: "Compras", href: "/lista-de-compras", icon: <ShoppingCart /> },
  { label: "Perto de mim", href: "/perto", icon: <MapPin /> },
  { label: "Metas", href: "/planejamento", icon: <Target /> },
  { label: "Falar com a VIVA", href: "/assistente", icon: <MessageCircleHeart /> },
  { label: "Saúde", href: "/saude", icon: <HeartPulse /> },
];

export default function QuickActions({ exclude = [], extra }: { exclude?: string[]; extra?: Action[] }) {
  const list = [...(extra || []), ...ACTIONS.filter(a => !exclude.includes(a.label))];
  return <nav className="vx-actions" aria-label="Atalhos">
    {list.map(a => {
      const inner = <><span className="vx-action-ico" aria-hidden>{a.icon}</span><span className="vx-action-label">{a.label}</span></>;
      return a.href
        ? <Link key={a.label} href={a.href} className="vx-action">{inner}</Link>
        : <button key={a.label} type="button" className="vx-action" onClick={() => window.dispatchEvent(new Event(a.event || ""))}>{inner}</button>;
    })}
  </nav>;
}
