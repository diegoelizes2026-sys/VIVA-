"use client";
import { useEffect, useState } from "react";
import { AlarmClock } from "lucide-react";
import { brl, clock, FUNNEL_PRICE_BRL, FUNNEL_REGULAR_BRL } from "@/lib/life-diagnostic";

/** Relógio da promoção: "Promoção especial até 15:42" e a contagem regressiva. O prazo vem do servidor. */
export default function OfferCountdown({ expiresAt, onExpire, regular = FUNNEL_REGULAR_BRL }: { expiresAt: string; onExpire?: () => void; regular?: number }) {
  const end = new Date(expiresAt).getTime();
  const [left, setLeft] = useState(() => Math.max(0, end - Date.now()));
  useEffect(() => {
    const tick = () => { const l = Math.max(0, end - Date.now()); setLeft(l); if (l === 0) onExpire?.(); return l; };
    if (tick() === 0) return;
    const id = setInterval(() => { if (tick() === 0) clearInterval(id); }, 1000);
    return () => clearInterval(id);
  }, [end, onExpire]);
  if (left === 0) return <div className="lv-clock is-over" role="status"><AlarmClock aria-hidden /><div><b>A promoção especial terminou às {clock(expiresAt)}</b><span>O Pro segue disponível pelo preço normal de {brl(regular)}/mês.</span></div></div>;
  const h = Math.floor(left / 3600000), m = Math.floor((left % 3600000) / 60000), s = Math.floor((left % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return <div className="lv-clock" role="timer" aria-live="off">
    <AlarmClock aria-hidden />
    <div><b>Promoção especial até {clock(expiresAt)}. Aproveite!</b><span>Pro de <s>{brl(regular)}</s> por <strong>{brl(FUNNEL_PRICE_BRL)}</strong></span></div>
    <time aria-label={`Faltam ${h ? h + " horas, " : ""}${m} minutos e ${s} segundos`}>{h ? pad(h) + ":" : ""}{pad(m)}:{pad(s)}</time>
  </div>;
}
