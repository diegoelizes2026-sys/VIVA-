"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CreditMeter, ProOffer, shortDate, type Wallet } from "@/components/credit-ui";

type Entry = { id: string; kind: string; amount: number; balance_after: number; operation_key: string | null; operation_label: string | null; description: string | null; created_at: string };
type Operation = { key: string; label: string; credits: number; pro_only: boolean };

const KIND_LABEL: Record<string, string> = {
  signup_bonus: "Boas-vindas", monthly_renewal: "Renovação mensal", plan_renewal: "Créditos do plano", consumption: "Uso de IA",
  expiration: "Créditos expirados", admin_grant: "Créditos adicionados", admin_revoke: "Créditos removidos", extra_purchase: "Créditos extras", adjustment: "Ajuste",
};
const received = (e: Entry) => e.amount > 0;
const dateTime = (v: string) => new Date(v).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export default function CreditsCenter() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [tab, setTab] = useState<"used" | "received">("used");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(true);

  const load = useCallback(async (offset = 0) => {
    try {
      const r = await fetch(`/api/credits?limit=50&offset=${offset}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Não foi possível carregar seus créditos.");
      setWallet(d.wallet); setOperations((d.operations || []).filter((o: Operation) => o.credits > 0));
      setHistory(h => offset ? [...h, ...(d.history || [])] : (d.history || []));
      setMore((d.history || []).length === 50); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível carregar seus créditos."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const used = history.filter(e => e.kind === "consumption" && e.amount < 0);
  const got = history.filter(received);
  const list = tab === "used" ? used : got;

  return <div className="vc-page">
    <header className="vc-head">
      <div><span className="vc-eyebrow">MEUS CRÉDITOS</span><h1>Seus créditos de IA</h1><p>Os mesmos créditos valem para a VIVA e para o Personal.</p></div>
      {wallet && <span className={"vc-plan" + (wallet.is_free ? "" : " pro")}>Plano {wallet.plan_name || wallet.plan_id}</span>}
    </header>
    {error && <p role="alert" className="vc-error">{error}</p>}
    {loading && !wallet && <p className="vc-muted">Carregando…</p>}

    {wallet && <section className="vc-card vc-balance">
      <div className="vc-balance-main"><span>Saldo disponível</span><strong>{wallet.available}</strong><em>{wallet.available === 1 ? "crédito" : "créditos"}</em></div>
      <CreditMeter wallet={wallet} />
      <dl className="vc-stats">
        <div><dt>Usados neste ciclo</dt><dd>{wallet.cycle_used}</dd></div>
        <div><dt>Recebidos neste ciclo</dt><dd>{wallet.cycle_granted}</dd></div>
        <div><dt>Próxima renovação</dt><dd>{wallet.next_renewal_at ? shortDate(wallet.next_renewal_at) : "—"}</dd></div>
        <div><dt>Créditos por mês</dt><dd>{wallet.monthly_credits ?? "—"}</dd></div>
      </dl>
      {wallet.is_free && <p className="vc-muted">No plano Free, créditos que sobram não acumulam: na renovação você recebe {wallet.monthly_credits} créditos novos.</p>}
    </section>}

    <div className="vc-grid">
      <section className="vc-card">
        <div className="vc-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "used"} className={tab === "used" ? "on" : ""} onClick={() => setTab("used")}>Consumo</button>
          <button role="tab" aria-selected={tab === "received"} className={tab === "received" ? "on" : ""} onClick={() => setTab("received")}>Créditos recebidos</button>
        </div>
        {list.length ? <ul className="vc-history">{list.map(e => <li key={e.id}>
          <div><b>{e.kind === "consumption" ? (e.operation_label || e.description || "Uso de IA") : (KIND_LABEL[e.kind] || e.kind)}</b><span>{dateTime(e.created_at)}{e.kind !== "consumption" && e.description ? " · " + e.description : ""}</span></div>
          <strong className={e.amount > 0 ? "plus" : "minus"}>{e.amount > 0 ? "+" : ""}{e.amount}</strong>
        </li>)}</ul> : <p className="vc-muted">{loading ? "Carregando…" : tab === "used" ? "Você ainda não usou créditos neste período." : "Nenhum crédito recebido neste período."}</p>}
        {more && history.length > 0 && <button className="vc-btn ghost vc-more" onClick={() => load(history.length)}>Carregar mais</button>}
        {wallet?.history_days && <p className="vc-muted">Histórico dos últimos {wallet.history_days} dias.{wallet.is_free ? " O histórico completo faz parte do Pro." : ""}</p>}
      </section>

      <aside className="vc-side">
        {wallet?.is_free && <section className="vc-card"><ProOffer title="Quer mais créditos?" text="Assine o Pro e receba mais créditos todo mês, além do assistente e do Personal completos." /></section>}
        <section className="vc-card">
          <h2>Quanto custa cada uso</h2>
          <ul className="vc-costs">{operations.map(o => <li key={o.key}><span>{o.label}{o.pro_only && <small>Pro</small>}</span><b>{o.credits} {o.credits === 1 ? "crédito" : "créditos"}</b></li>)}</ul>
          <p className="vc-muted">Abrir uma conversa não consome créditos. O desconto só acontece quando a IA entrega uma resposta.</p>
        </section>
        {wallet && !wallet.is_free && <p className="vc-muted">Os créditos do Pro renovam a cada ciclo pago da assinatura. <Link href="/planos">Gerenciar plano</Link></p>}
      </aside>
    </div>
  </div>;
}
