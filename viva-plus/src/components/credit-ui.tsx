"use client";
import Link from "next/link";
import { TrialOffer } from "@/components/growth";
import { useEffect, useState } from "react";

// Componentes visuais do sistema de créditos (usados no chat da VIVA, no Personal e em Meus créditos).
export type Wallet = {
  plan_id: string; plan_name?: string; is_free: boolean; balance: number; reserved?: number; available: number; extra_credits: number;
  cycle_granted: number; cycle_used: number; percent_used: number; warning_level: number;
  next_renewal_at: string | null; last_renewal_at?: string | null; monthly_credits?: number; total_used?: number; total_received?: number; history_days?: number | null;
};
type ProPlan = { id: string; name: string; monthly_price_brl: number; monthly_credits: number };

export const money = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const shortDate = (v?: string | null) => v ? new Date(v).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }).replace(".", "") : "";

// Lê o plano Pro configurado no admin (preço e créditos nunca ficam fixos no código).
export function useProPlan() {
  const [plan, setPlan] = useState<ProPlan | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/credits?limit=1").then(r => r.ok ? r.json() : null).then(d => {
      const pro = (d?.plans || []).find((p: ProPlan) => p.id === "pro");
      if (alive && pro) setPlan(pro);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return plan;
}

export function CreditMeter({ wallet, compact = false }: { wallet: Wallet; compact?: boolean }) {
  const pct = Math.max(0, Math.min(100, wallet.percent_used));
  const tone = wallet.warning_level >= 100 ? "empty" : wallet.warning_level >= 90 ? "low" : wallet.warning_level >= 70 ? "mid" : "ok";
  return <div className={"vc-meter vc-" + tone + (compact ? " compact" : "")}>
    <div className="vc-meter-top">
      <span><b>{wallet.available}</b> {wallet.available === 1 ? "crédito disponível" : "créditos disponíveis"}{wallet.extra_credits > 0 ? ` + ${wallet.extra_credits} extras` : ""}</span>
      {wallet.next_renewal_at && <span>Renova em {shortDate(wallet.next_renewal_at)}</span>}
    </div>
    <div className="vc-track" role="progressbar" aria-label="Créditos utilizados" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: pct + "%" }} /></div>
  </div>;
}

// Avisos de 70% e 90% (o de 100% é o bloqueio, tratado em OutOfCredits).
export function CreditNotice({ wallet }: { wallet: Wallet | null }) {
  if (!wallet || wallet.warning_level < 70 || wallet.warning_level >= 100) return null;
  const strong = wallet.warning_level >= 90;
  return <div className={"vc-notice" + (strong ? " strong" : "")} role="status">
    <p>{strong ? <><b>Seus créditos estão acabando.</b> Restam {wallet.available} até {shortDate(wallet.next_renewal_at)}.</> : <>Você já usou {wallet.percent_used}% dos créditos deste ciclo.</>}</p>
    {wallet.is_free ? <Link href="/planos">Conhecer o Pro</Link> : <Link href="/creditos">Ver detalhes</Link>}
  </div>;
}

export function ProBenefits() {
  return <ul className="vc-benefits">
    <li>Mais créditos de IA todo mês</li>
    <li>Assistente financeiro completo</li>
    <li>Personal com IA completo</li>
    <li>Planejamento avançado e análises personalizadas</li>
    <li>Histórico completo</li>
  </ul>;
}

export function ProOffer({ title, text, onClose }: { title?: string; text?: string; onClose?: () => void }) {
  const pro = useProPlan();
  return <div className="vc-pro">
    <span className="vc-pro-tag">VIVA+ PRO</span>
    <h3>{title || "Continue com o VIVA+ Pro"}</h3>
    {text && <p className="vc-pro-text">{text}</p>}
    <p className="vc-pro-price">{pro ? <><b>{money(pro.monthly_price_brl)}</b>/mês · {pro.monthly_credits} créditos por mês</> : "Carregando valores…"}</p>
    <ProBenefits />
    <TrialOffer compact />
    <div className="vc-pro-actions">
      <Link className="vc-btn" href="/planos">Assinar o Pro</Link>
      {onClose && <button type="button" className="vc-btn ghost" onClick={onClose}>Agora não</button>}
    </div>
    <small>O Pro é ativado somente depois da confirmação do pagamento.</small>
  </div>;
}

export function UpgradeSheet({ open, title, text, onClose }: { open: boolean; title?: string; text?: string; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return <div className="vc-sheet-layer" role="dialog" aria-modal="true" aria-label="Conheça o VIVA+ Pro">
    <button type="button" className="vc-sheet-backdrop" aria-label="Fechar" onClick={onClose} />
    <div className="vc-sheet"><ProOffer title={title} text={text} onClose={onClose} /></div>
  </div>;
}

// Bloqueio ao chegar a 0: nunca interrompe uma resposta já em andamento (a reserva é feita antes de chamar a IA).
export function OutOfCredits({ wallet }: { wallet: Wallet | null }) {
  const renew = wallet?.next_renewal_at ? shortDate(wallet.next_renewal_at) : null;
  if (!wallet || wallet.is_free) {
    return <div className="vc-out"><ProOffer title="Seus créditos gratuitos acabaram" text={`${renew ? `Eles renovam em ${renew}. ` : ""}Para continuar agora, conheça o VIVA+ Pro.`} /></div>;
  }
  return <div className="vc-out"><div className="vc-pro">
    <span className="vc-pro-tag">CRÉDITOS DO CICLO</span>
    <h3>Seus créditos deste ciclo acabaram</h3>
    <p className="vc-pro-text">{renew ? `Eles renovam automaticamente em ${renew}.` : "Eles renovam no próximo ciclo da assinatura."}</p>
    <div className="vc-pro-actions"><Link className="vc-btn" href="/creditos">Ver meus créditos</Link></div>
  </div></div>;
}

// Chave de idempotência: a mesma mensagem reenviada logo após uma falha reaproveita a chave e nunca é cobrada duas vezes.
export function makeRequestKey(ref: { current: { text: string; id: string; at: number } | null }, text: string) {
  const prev = ref.current;
  if (prev && prev.text === text && Date.now() - prev.at < 120000) return prev.id;
  const id = (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/[^A-Za-z0-9_-]/g, "");
  ref.current = { text, id, at: Date.now() };
  return id;
}
