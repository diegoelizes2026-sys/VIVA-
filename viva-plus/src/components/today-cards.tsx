"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, PartyPopper, ShoppingBag, ArrowRight, Zap, Plus } from "lucide-react";
import QuickExpense from "@/components/quick-expense";
import type { QuickPick } from "@/lib/quick-picks";
import { trackAction } from "@/lib/track";
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
    trackAction("posso-comprar");
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

/** Cartão de vitória (ou do número do dia, enquanto não há vitória): gera a imagem e abre o compartilhar do celular (WhatsApp, Instagram…). */
export function VictoryCard({ today, streak }: { today: TodayBudget; streak: number }) {
  const { hidden } = useHiddenValues();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const leftover = today.mode === "dynamic" && today.forecast?.kind === "leftover" ? today.forecast.amount : 0;
  if (today.mode === "setup") return null;
  // Sem vitória ainda: compartilha o número do dia (bom para o Status do WhatsApp).
  const victory = streak >= 3 || leftover > 0;
  const title = streak >= 3 ? `🔥 ${streak} dias seguidos no seu valor do dia!` : leftover > 0 ? `🎉 No ritmo atual, vai sobrar ${hidden ? "dinheiro" : brl(leftover)}!` : `💜 Hoje você pode gastar ${hidden ? "R$ ••" : brl(Math.max(0, today.allowance))}`;
  async function share() {
    setBusy(true); setMsg(""); trackAction(victory ? "vitoria" : "numero-do-dia");
    try {
      const [img, ref] = await Promise.all([
        fetch(`/api/share/vitoria?valores=${hidden ? 0 : 1}${victory ? "" : "&tipo=dia"}`).then(r => { if (!r.ok) throw new Error(); return r.blob(); }),
        fetch("/api/referral").then(r => (r.ok ? r.json() : null)).catch(() => null) as Promise<{ code?: string } | null>,
      ]);
      const link = ref?.code ? `${location.origin}/cadastro?convite=${ref.code}` : location.origin;
      const text = `A VIVA+ me diz quanto posso gastar por dia 💜 Testa aí: ${link}`;
      const file = new File([img], victory ? "minha-vitoria-viva.png" : "meu-numero-do-dia-viva.png", { type: "image/png" });
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text });
      } else {
        const url = URL.createObjectURL(img);
        const a = document.createElement("a"); a.href = url; a.download = file.name; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        try { await navigator.clipboard.writeText(text); setMsg("Imagem baixada e convite copiado. É só postar!"); } catch { setMsg("Imagem baixada. É só postar!"); }
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setMsg("Não consegui gerar a imagem agora. Tente de novo.");
    } finally { setBusy(false); }
  }
  return <section className="vx-victory">
    <div>
      <b>{title}</b>
      <p>{victory ? "Mostre pros amigos." : "Poste no Status do WhatsApp."} Quem entrar com seu convite e assinar o Pro te rende R$ 10 no Pix.</p>
    </div>
    <button type="button" onClick={share} disabled={busy}>{busy ? "Gerando…" : victory ? "Compartilhar" : "Postar no Status"}</button>
    {msg && <small role="status">{msg}</small>}
  </section>;
}

/** Gastos de 1 toque: os gastos que a pessoa mais repete viram botões. Com "Desfazer". */
export function OneTapExpenses({ picks }: { picks: QuickPick[] }) {
  const router = useRouter();
  const { hidden } = useHiddenValues();
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; undoId?: string } | null>(null);
  const show = (n: number) => (hidden ? "R$ ••" : brl(n));
  async function tap(p: QuickPick) {
    if (busy) return;
    setBusy(p.description); setToast(null); trackAction("1-toque");
    try {
      const res = await fetch("/api/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "expense", amount: p.amount, description: p.description, occurred_on: todayIso(), category: p.category, payment_method: p.payment_method, source: "manual" }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não consegui lançar.");
      setToast({ text: `${p.emoji} ${p.description} ${show(p.amount)} lançado!`, undoId: data.transaction?.id });
      router.refresh();
      setTimeout(() => setToast(t => (t?.undoId === data.transaction?.id ? null : t)), 9000);
    } catch (e) { setToast({ text: e instanceof Error ? e.message : "Não consegui lançar." }); }
    finally { setBusy(null); }
  }
  async function undo(id: string) {
    setToast(null);
    const res = await fetch("/api/transactions?id=" + encodeURIComponent(id), { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setToast({ text: res.ok ? "Desfeito." : data.error || "Não consegui desfazer." });
    if (res.ok) router.refresh();
    setTimeout(() => setToast(null), 4000);
  }
  return <section className="vx-card vx-onetap">
    <div className="vx-card-head"><h2><Zap size={19} aria-hidden /> Lançar em 1 toque</h2></div>
    {!picks.length && <p className="vx-buy-sub">Seus gastos repetidos (padaria, Uber, almoço…) vão virar botões aqui. Lance pelo menos duas vezes.</p>}
    <div className="vx-chips">
      {picks.map(p => <button key={p.description} type="button" className="vx-chip" disabled={!!busy} onClick={() => tap(p)} aria-label={`Lançar ${p.description} de ${brl(p.amount)}`}>
        <span aria-hidden>{p.emoji}</span><b>{p.description}</b><small>{show(p.amount)}</small>
      </button>)}
      <button type="button" className="vx-chip add" onClick={() => window.dispatchEvent(new Event("viva:open-expense"))}><Plus size={17} aria-hidden /><b>Outro gasto</b></button>
    </div>
    {toast && <p className="vx-toast" role="status">{toast.text}{toast.undoId && <button type="button" onClick={() => undo(toast.undoId!)}>Desfazer</button>}</p>}
    <QuickExpense onSaved={() => router.refresh()} />
  </section>;
}

export type DueBill = { id: string; name: string; amount: number; due_date: string };

/** Contas atrasadas, de hoje e de amanhã, com "Já paguei" (registra a despesa e ajusta o número do dia). */
export function BillsDueCard({ bills, today }: { bills: DueBill[]; today: string }) {
  const router = useRouter();
  const { hidden } = useHiddenValues();
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const list = bills.filter(b => !done.includes(b.id));
  if (!list.length && !msg) return null;
  const when = (d: string) => (d < today ? `atrasada desde ${dm(d)}` : d === today ? "vence hoje" : "vence amanhã");
  async function pay(b: DueBill) {
    setBusy(b.id); setMsg(""); trackAction("conta-paga");
    try {
      const res = await fetch("/api/bills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "paid", id: b.id }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não consegui marcar como paga.");
      setDone(d => [...d, b.id]); setMsg(`✓ ${b.name} paga. Seu valor do dia continua certo.`);
      router.refresh();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Não consegui marcar como paga."); }
    finally { setBusy(null); }
  }
  return <section className="vx-card vx-bills">
    <a href="/contas" className="vx-card-head"><h2>🧾 Contas para pagar</h2><ArrowRight size={18} aria-hidden /></a>
    <ul>
      {list.map(b => <li key={b.id} className={b.due_date < today ? "late" : ""}>
        <div><b>{b.name}</b><small>{when(b.due_date)} · {hidden ? "R$ ••••" : brl(b.amount)}</small></div>
        <button type="button" onClick={() => pay(b)} disabled={!!busy}>{busy === b.id ? "…" : "Já paguei"}</button>
      </li>)}
    </ul>
    {msg && <p className="vx-bills-msg" role="status">{msg}</p>}
  </section>;
}
