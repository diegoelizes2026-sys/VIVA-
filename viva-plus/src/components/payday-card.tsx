"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PaySchedule } from "@/lib/payday";
import { BadgeDollarSign, CalendarClock } from "lucide-react";

type Status = {
  configured: boolean; schedule: PaySchedule; label: string | null; today: string; next: string | null; last: string | null;
  daysToNext: number | null; expected: number | null; due: boolean; received: { amount: number; date: string } | null;
  split: { housing: number | null; debts: number | null };
};
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dm = (iso: string) => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };
const when = (n: number | null) => (n == null ? "" : n === 0 ? "hoje" : n === 1 ? "amanhã" : `em ${n} dias`);
const parseMoney = (t: string) => { const n = Number(t.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")); return Number.isFinite(n) ? n : NaN; };

export default function PaydayCard() {
  const router = useRouter();
  const [s, setS] = useState<Status | null>(null);
  const [setup, setSetup] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const load = useCallback(() => fetch("/api/payday").then(r => (r.ok ? r.json() : null)).then(setS).catch(() => setS(null)), []);
  useEffect(() => { load(); }, [load]);
  // Atalho "Recebi" da tela inicial abre o registro (ou a configuração, se ainda não disse quando recebe).
  useEffect(() => {
    const open = () => { if (s?.configured) setReceiving(true); else setSetup(true); };
    window.addEventListener("viva:open-receive", open);
    return () => window.removeEventListener("viva:open-receive", open);
  }, [s?.configured]);
  if (!s) return null;

  const done = (next: Status) => { setS(next); router.refresh(); };

  let body: React.ReactNode;
  if (!s.configured) body = <>
    <div className="pd-text"><b>Quando você recebe?</b><span>Eu te lembro no dia e você registra o pagamento com um toque.</span></div>
    <button className="pd-btn" onClick={() => setSetup(true)}>Configurar</button>
  </>;
  else if (s.received && !s.due) body = <>
    <div className="pd-text"><b>{s.next ? `Próximo pagamento ${when(s.daysToNext)}` : "Pagamento registrado"}</b><span>✓ Último: {brl(s.received.amount)} em {dm(s.received.date)}{s.next ? ` · ${dm(s.next)}` : ""}</span></div>
    <button className="pd-link" onClick={() => setReceiving(true)}>Recebi outro valor</button>
  </>;
  else if (s.due) body = <>
    <div className="pd-text"><b>Dia de pagamento! Já caiu?</b><span>{s.label}{s.expected ? ` · esperado ${brl(s.expected)}` : ""}</span></div>
    <button className="pd-btn hot" onClick={() => setReceiving(true)}>Recebi meu pagamento</button>
  </>;
  else if (s.schedule.frequency === "irregular") body = <>
    <div className="pd-text"><b>Entrou algum dinheiro?</b><span>Registre sempre que receber, para o VIVA calcular quanto você pode gastar.</span></div>
    <button className="pd-btn" onClick={() => setReceiving(true)}>Recebi dinheiro</button>
  </>;
  else body = <>
    <div className="pd-text"><b>Próximo pagamento {when(s.daysToNext)}</b><span>{s.next ? dm(s.next) : ""} · {s.label}{s.expected ? ` · ${brl(s.expected)}` : ""}</span></div>
    <button className="pd-btn ghost" onClick={() => setReceiving(true)}>Já recebi</button>
  </>;

  return <section className={"pd-card" + (s.due ? " due" : "")} aria-label="Pagamento">
    <span className="pd-ico" aria-hidden>{s.due ? <BadgeDollarSign size={24} /> : <CalendarClock size={22} />}</span>
    {body}
    {s.configured && <button className="pd-edit" onClick={() => setSetup(true)} aria-label="Mudar quando recebo">Mudar</button>}
    {setup && <SetupSheet current={s.schedule} onClose={() => setSetup(false)} onSaved={st => { setSetup(false); done(st); }} />}
    {receiving && <ReceiveSheet status={s} onClose={() => setReceiving(false)} onSaved={st => done(st)} />}
  </section>;
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="vc-sheet-layer" role="dialog" aria-modal="true" aria-label={title}><button className="vc-sheet-backdrop" aria-label="Fechar" onClick={onClose} /><div className="vc-sheet sl-sheet"><div className="md-head"><h2>{title}</h2><button className="ob-link" onClick={onClose}>Fechar</button></div>{children}</div></div>;
}

const FREQ: { v: PaySchedule["frequency"]; l: string }[] = [{ v: "monthly", l: "Todo mês" }, { v: "biweekly", l: "A cada 15 dias" }, { v: "weekly", l: "Toda semana" }, { v: "irregular", l: "Sem data certa" }];
const MONTH_DAYS: { l: string; days: number[]; b?: boolean }[] = [{ l: "Dia 5", days: [5] }, { l: "5º dia útil", days: [5], b: true }, { l: "Dia 10", days: [10] }, { l: "Dia 15", days: [15] }, { l: "Dia 20", days: [20] }, { l: "Último dia", days: [31] }];
const BI_DAYS: { l: string; days: number[] }[] = [{ l: "5 e 20", days: [5, 20] }, { l: "15 e 30", days: [15, 30] }, { l: "1 e 15", days: [1, 15] }, { l: "10 e 25", days: [10, 25] }];
const WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function SetupSheet({ current, onClose, onSaved }: { current: PaySchedule; onClose: () => void; onSaved: (s: Status) => void }) {
  const [freq, setFreq] = useState<PaySchedule["frequency"]>(current.frequency || "monthly");
  const [days, setDays] = useState<number[]>(current.days.length ? current.days : []);
  const [business, setBusiness] = useState(current.businessDay);
  const [weekday, setWeekday] = useState<number | null>(current.weekday);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const save = async () => {
    let d = days;
    if (custom.trim()) { const nums = [...custom.matchAll(/\d{1,2}/g)].map(m => Number(m[0])).filter(n => n >= 1 && n <= 31); d = nums.slice(0, freq === "biweekly" ? 2 : 1); }
    setBusy(true); setErr("");
    const r = await fetch("/api/payday", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ frequency: freq, days: d, businessDay: business && !custom.trim(), weekday }) });
    const j = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) { setErr(j.error || "Não consegui salvar."); return; } onSaved(j);
  };
  const pick = (o: { days: number[]; b?: boolean }) => { setDays(o.days); setBusiness(Boolean(o.b)); setCustom(""); };
  const on = (o: { days: number[]; b?: boolean }) => !custom && days.join() === o.days.join() && business === Boolean(o.b);
  return <Sheet title="Quando você recebe?" onClose={onClose}>
    <div className="vh-form">
      <div className="vh-pick">{FREQ.map(f => <button key={f.v} type="button" className={freq === f.v ? "sel" : ""} onClick={() => { setFreq(f.v); setDays([]); setBusiness(false); }}>{f.l}</button>)}</div>
      {freq === "monthly" && <><p>Em que dia do mês costuma cair?</p><div className="vh-pick">{MONTH_DAYS.map(o => <button key={o.l} type="button" className={on(o) ? "sel" : ""} onClick={() => pick(o)}>{o.l}</button>)}</div>
        <label>Outro dia<input inputMode="numeric" value={custom} placeholder="Ex.: 7" onChange={e => setCustom(e.target.value)} /></label></>}
      {freq === "biweekly" && <><p>Em quais dias?</p><div className="vh-pick">{BI_DAYS.map(o => <button key={o.l} type="button" className={on(o) ? "sel" : ""} onClick={() => pick(o)}>{o.l}</button>)}</div>
        <label>Outros dias<input value={custom} placeholder="Ex.: 7 e 22" onChange={e => setCustom(e.target.value)} /></label></>}
      {freq === "weekly" && <><p>Em que dia da semana?</p><div className="vh-pick">{WEEK.map((w, i) => <button key={w} type="button" className={weekday === i ? "sel" : ""} onClick={() => setWeekday(i)}>{w}</button>)}</div></>}
      {freq === "irregular" && <p>Sem problema: o VIVA vai mostrar um botão para você registrar sempre que entrar dinheiro.</p>}
      {err && <p className="sl-error">{err}</p>}
      <button className="vh-cta" disabled={busy} onClick={save}>{busy ? "Salvando…" : "Salvar"}</button>
    </div>
  </Sheet>;
}

function ReceiveSheet({ status, onClose, onSaved }: { status: Status; onClose: () => void; onSaved: (s: Status) => void }) {
  const [amount, setAmount] = useState(status.expected ? status.expected.toFixed(2).replace(".", ",") : "");
  const [method, setMethod] = useState<"Pix" | "Transferência" | "Dinheiro" | "Outro">("Pix");
  const [date, setDate] = useState(status.today);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [result, setResult] = useState<{ amount: number; st: Status } | null>(null);
  const submit = async () => {
    const n = parseMoney(amount);
    if (!(n > 0)) { setErr("Informe quanto caiu."); return; }
    setBusy(true); setErr("");
    const r = await fetch("/api/payday", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: n, occurred_on: date, payment_method: method, description: status.schedule.frequency === "irregular" ? "Dinheiro recebido" : "Pagamento recebido" }) });
    const j = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) { setErr(j.error || "Não consegui registrar."); return; }
    setResult({ amount: n, st: j });
  };
  if (result) {
    const { housing, debts } = result.st.split;
    const rest = result.amount - (housing || 0) - (debts || 0);
    return <Sheet title="Pagamento registrado!" onClose={() => { onSaved(result.st); onClose(); }}>
      <div className="vh-form">
        <p><b>{brl(result.amount)}</b> entrou em Meu dinheiro como <b>Renda</b>.</p>
        {(housing || debts) ? <div className="pd-split">
          <b>Sugestão do VIVA para este pagamento</b>
          {housing ? <p><span>🏠 Moradia</span><b>{brl(housing)}</b></p> : null}
          {debts ? <p><span>💳 Dívidas</span><b>{brl(debts)}</b></p> : null}
          <p className={rest < 0 ? "neg" : ""}><span>🧾 Para o resto até o próximo pagamento</span><b>{brl(rest)}</b></p>
          <small>Separe primeiro o que é fixo. Assim o dinheiro do dia a dia não engole as contas.</small>
        </div> : <p className="vc-muted">Dica: separe primeiro as contas fixas e só depois o dia a dia.</p>}
        <button className="vh-cta" onClick={() => { onSaved(result.st); onClose(); }}>Fechar</button>
      </div>
    </Sheet>;
  }
  return <Sheet title="Quanto caiu?" onClose={onClose}>
    <div className="vh-form">
      <label>Valor recebido<input inputMode="decimal" value={amount} placeholder="Ex.: 2.500,00" onChange={e => setAmount(e.target.value)} autoFocus /></label>
      {status.expected ? <small className="vc-muted">Preenchi com o valor esperado. Se veio diferente, é só corrigir.</small> : null}
      <div className="vh-pick">{(["Pix", "Transferência", "Dinheiro", "Outro"] as const).map(m => <button key={m} type="button" className={method === m ? "sel" : ""} onClick={() => setMethod(m)}>{m}</button>)}</div>
      <label>Data<input type="date" value={date} max={status.today} onChange={e => setDate(e.target.value || status.today)} /></label>
      {err && <p className="sl-error">{err}</p>}
      <button className="vh-cta" disabled={busy} onClick={submit}>{busy ? "Registrando…" : "Registrar pagamento"}</button>
    </div>
  </Sheet>;
}
