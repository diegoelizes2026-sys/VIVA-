"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// "Lancei um gasto": registro rápido, sem IA e sem gastar créditos. Abre pelo evento "viva:open-expense".
const WHAT: { label: string; category: string }[] = [
  { label: "Mercado", category: "Alimentação" }, { label: "Lanche / delivery", category: "Alimentação" }, { label: "Transporte", category: "Transporte" },
  { label: "Farmácia", category: "Saúde" }, { label: "Conta da casa", category: "Contas" }, { label: "Compras", category: "Compras" }, { label: "Lazer", category: "Lazer" }, { label: "Outro", category: "Outros" },
];
const METHODS = ["Pix", "Débito", "Crédito", "Dinheiro"];
const parseMoney = (t: string) => { const n = Number(t.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")); return Number.isFinite(n) ? n : NaN; };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function QuickExpense({ onSaved }: { onSaved?: (msg: string) => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [what, setWhat] = useState(WHAT[0]);
  const [note, setNote] = useState("");
  const [method, setMethod] = useState("Pix");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const on = () => { setOpen(true); setErr(""); setTimeout(() => ref.current?.focus(), 60); };
    window.addEventListener("viva:open-expense", on);
    return () => window.removeEventListener("viva:open-expense", on);
  }, []);
  if (!open) return null;
  const close = () => { setOpen(false); setAmount(""); setNote(""); setWhat(WHAT[0]); };
  const save = async () => {
    const n = parseMoney(amount);
    if (!(n > 0)) { setErr("Quanto foi?"); return; }
    setBusy(true); setErr("");
    const description = (note.trim() || what.label).slice(0, 120);
    const r = await fetch("/api/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "expense", amount: n, description, occurred_on: today(), category: what.category, payment_method: method }) });
    const j = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) { setErr(j.error || "Não consegui salvar. Tente de novo."); return; }
    window.dispatchEvent(new Event("viva:transactions-updated"));
    onSaved?.(`Anotado: ${brl(n)} em ${description} (${what.category}, ${method}). ✅`);
    close();
  };
  return createPortal(<div className="vc-sheet-layer" role="dialog" aria-modal="true" aria-label="Lancei um gasto">
    <button className="vc-sheet-backdrop" aria-label="Fechar" onClick={close} />
    <div className="vc-sheet sl-sheet">
      <div className="md-head"><h2>Lancei um gasto</h2><button className="ob-link" onClick={close}>Fechar</button></div>
      <div className="vh-form">
        <label>Quanto foi?<input ref={ref} inputMode="decimal" value={amount} placeholder="Ex.: 35,90" onChange={e => setAmount(e.target.value)} onKeyDown={e => { if (e.key === "Enter") save(); }} /></label>
        <p>Com o quê?</p>
        <div className="vh-pick">{WHAT.map(w => <button key={w.label} type="button" className={what.label === w.label ? "sel" : ""} onClick={() => setWhat(w)}>{w.label}</button>)}</div>
        <label>Detalhe (opcional)<input value={note} maxLength={120} placeholder="Ex.: padaria, Uber, remédio" onChange={e => setNote(e.target.value)} /></label>
        <div className="vh-pick">{METHODS.map(m => <button key={m} type="button" className={method === m ? "sel" : ""} onClick={() => setMethod(m)}>{m}</button>)}</div>
        {err && <p className="sl-error">{err}</p>}
        <button className="vh-cta" disabled={busy} onClick={save}>{busy ? "Salvando…" : "Salvar gasto"}</button>
        <small className="vc-muted">Registro direto, sem usar créditos. Para algo mais detalhado, é só contar para a VIVA no chat.</small>
      </div>
    </div>
  </div>, document.body);
}
