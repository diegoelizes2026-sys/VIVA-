"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, PartyPopper, ShoppingBag, ArrowRight } from "lucide-react";
import type { TodayBudget } from "@/lib/daily-budget";
import { useHiddenValues, brl } from "@/components/money-hero";

const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const dm = (iso: string) => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };

/** "A VIVA te avisa": até quando o dinheiro dura no ritmo atual. */
export function ForecastCard({ today }: { today: TodayBudget }) {
  const { hidden } = useHiddenValues();
  if (today.mode !== "dynamic" || !today.forecast) return null;
  const f = today.forecast;
  const show = (n: number) => (hidden ? "R$ ••••" : brl(n));
  if (f.kind === "runs_out") return <section className="vx-alert warn" role="status">
    <span className="vx-alert-ico" aria-hidden><AlertTriangle size={22} /></span>
    <div>
      <b>{f.daysEarly <= 0 ? "Seu dinheiro está no limite" : f.date <= todayIso() ? "Atenção: o dinheiro deste ciclo já está no fim" : `No ritmo atual, seu dinheiro acaba dia ${dm(f.date)}`}</b>
      <p>{f.daysEarly > 0 ? `São ${f.daysEarly} ${f.daysEarly === 1 ? "dia" : "dias"} antes de ${today.horizonLabel}. ` : ""}Se segurar no valor do dia, você chega lá. Quer ajuda para cortar gastos?</p>
      <a href={"/assistente?pergunta=" + encodeURIComponent("Meu dinheiro vai acabar antes do pagamento. Onde posso cortar gastos?")}>Pedir ajuda à VIVA <ArrowRight size={15} aria-hidden /></a>
    </div>
  </section>;
  if (f.amount <= 0) return null;
  return <section className="vx-alert ok" role="status">
    <span className="vx-alert-ico" aria-hidden><PartyPopper size={22} /></span>
    <div>
      <b>Mandando bem! No ritmo atual, sobram {show(f.amount)}</b>
      <p>até {today.horizonLabel}. Que tal guardar uma parte numa meta?</p>
      <a href="/planejamento">Criar uma meta <ArrowRight size={15} aria-hidden /></a>
    </div>
  </section>;
}

/** "Posso comprar?": valor + o que é → a VIVA responde com base nas suas contas. */
export function CanIBuyCard() {
  const router = useRouter();
  const [what, setWhat] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");
  function ask(e: FormEvent) {
    e.preventDefault();
    const value = Number(price.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) { setError("Digite o valor, por exemplo 250 ou 89,90."); return; }
    setError("");
    const label = what.trim().slice(0, 80);
    const valueText = value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const q = `Posso comprar ${label ? label + " " : "isso "}de R$ ${valueText}?`;
    router.push("/assistente?pergunta=" + encodeURIComponent(q));
  }
  return <section className="vx-card vx-buy">
    <div className="vx-card-head"><h2><ShoppingBag size={19} aria-hidden /> Posso comprar?</h2></div>
    <p className="vx-buy-sub">Antes de comprar, pergunte. A VIVA olha suas contas e diz se cabe, e se vale parcelar.</p>
    <form onSubmit={ask} className="vx-buy-form">
      <input aria-label="O que você quer comprar" placeholder="Ex.: tênis, celular, jantar" value={what} onChange={e => setWhat(e.target.value)} maxLength={80} />
      <input aria-label="Valor" placeholder="R$ 0,00" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} maxLength={14} />
      <button type="submit">Perguntar</button>
    </form>
    {error && <p role="alert" className="vx-buy-err">{error}</p>}
  </section>;
}
