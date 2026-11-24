"use client";
import { useState, type FormEvent } from "react";

// Fim do cadastro: a pessoa anota o primeiro gasto e vê o número do dia mudar na hora.
// É o momento em que a VIVA "faz sentido" — quem anota logo no começo volta muito mais.
const CHIPS = [
  { emoji: "☕", label: "Café", category: "Alimentação" },
  { emoji: "🍔", label: "Lanche", category: "Alimentação" },
  { emoji: "🛒", label: "Mercado", category: "Mercado" },
  { emoji: "🚌", label: "Transporte", category: "Transporte" },
  { emoji: "💊", label: "Farmácia", category: "Saúde" },
  { emoji: "⛽", label: "Gasolina", category: "Transporte" },
];
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
type DayNumber = { mode: string; allowance?: number; remaining?: number; spentToday?: number };

export default function FirstExpense() {
  const [chip, setChip] = useState<(typeof CHIPS)[number] | null>(null);
  const [other, setOther] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ value: number; what: string; day: DayNumber | null } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = Number(amount.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, ""));
    const what = (chip?.label || other).trim();
    if (!(value > 0)) { setError("Quanto foi? Escreva só o valor, por exemplo 12,50."); return; }
    if (!what) { setError("Com o quê? Toque numa opção ou escreva."); return; }
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "expense", amount: value, description: what, category: chip?.category, occurred_on: todayIso(), source: "manual" }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Não consegui anotar agora.");
      const day = (await fetch("/api/today/number", { cache: "no-store" }).then(x => (x.ok ? x.json() : null)).catch(() => null)) as DayNumber | null;
      setDone({ value, what, day });
    } catch (err) { setError(err instanceof Error ? err.message : "Não consegui anotar agora."); }
    finally { setBusy(false); }
  }

  if (done) {
    const day = done.day && done.day.mode !== "setup" ? done.day : null;
    return <section className="fx fx-done" aria-live="polite">
      <span className="fx-badge">Anotado ✅</span>
      <p className="fx-line">{brl(done.value)} · {done.what}</p>
      {day ? <>
        <small>Hoje você ainda pode gastar</small>
        <strong className={(day.remaining ?? 0) < 0 ? "neg" : ""}>{brl(Math.max(0, day.remaining ?? 0))}</strong>
        <p className="fx-hint">{(day.remaining ?? 0) < 0 ? "Passou um pouco hoje. Tudo bem: amanhã o valor se ajusta sozinho." : "É assim todo dia: você anota, e a VIVA recalcula quanto dá pra gastar sem faltar até o salário."}</p>
      </> : <p className="fx-hint">A cada gasto que você anota, a VIVA ajusta quanto dá pra gastar por dia sem faltar até o salário.</p>}
    </section>;
  }

  return <form className="fx" onSubmit={submit}>
    <b className="fx-title">Agora o mais importante: me conta um gasto de hoje 👇</b>
    <p className="fx-sub">Pode ser um café, um lanche, a passagem… Leva 5 segundos.</p>
    <div className="fx-chips">
      {CHIPS.map(c => <button key={c.label} type="button" className={chip?.label === c.label ? "on" : ""} aria-pressed={chip?.label === c.label} onClick={() => { setChip(chip?.label === c.label ? null : c); setOther(""); }}>{c.emoji} {c.label}</button>)}
    </div>
    {!chip && <input className="fx-input" placeholder="Ou escreva: pão, Uber, cinema…" value={other} onChange={e => setOther(e.target.value)} maxLength={60} aria-label="Com o quê" />}
    <div className="fx-row">
      <label className="fx-money"><span>R$</span><input inputMode="decimal" placeholder="0,00" value={amount} onChange={e => setAmount(e.target.value)} maxLength={12} aria-label="Valor" /></label>
      <button className="ob-cta" type="submit" disabled={busy}>{busy ? "Anotando…" : "Anotar"}</button>
    </div>
    {error && <p className="ob-error" role="alert">{error}</p>}
  </form>;
}
