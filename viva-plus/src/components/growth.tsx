"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Gift, Copy, Share2, Check, Sparkles, Banknote, Clock3, Wallet } from "lucide-react";

// ---------------------------------------------------------------- Teste grátis do Pro
type Trial = { eligible: boolean; active: boolean; ends_at: string | null; minutes?: number; days?: number; credits: number };
const hm = (iso: string) => { const d = new Date(iso); return d.getTime() - Date.now() > 86400000 ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); };
const trialLength = (t: Trial) => (t.minutes ? `${t.minutes} minutos` : `${t.days ?? 7} dias`);
const dm = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

/** Botão/cartão "Testar o Pro grátis por 7 dias". Some se a conta já usou o teste ou já é paga. */
export function TrialOffer({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [t, setT] = useState<Trial | null>(null);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  useEffect(() => { fetch("/api/trial").then(r => (r.ok ? r.json() : null)).then(setT).catch(() => setT(null)); }, []);
  if (!t) return null;
  if (t.active && t.ends_at) return <div className="gr-trial on"><Sparkles size={18} aria-hidden /><span><b>Você está testando o Pro</b> até {hm(t.ends_at)}. Quando acabar, é só escolher seu plano para continuar.</span></div>;
  if (!t.eligible) return null;
  const start = async () => {
    setBusy(true); setErr("");
    const r = await fetch("/api/trial", { method: "POST" });
    const j = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) { setErr(j.error || "Não consegui ativar agora."); return; }
    setMsg(`Pronto! O Pro está ativo até ${hm(j.ends_at)} com ${j.credits} créditos. Aproveite!`);
    setT({ ...t, eligible: false, active: true, ends_at: j.ends_at });
    window.dispatchEvent(new Event("viva:credits-updated"));
    window.dispatchEvent(new Event("viva:trial-started"));
    router.refresh();
  };
  return <div className={"gr-trial" + (compact ? " compact" : "")}>
    <div><b>Teste o Pro grátis por {trialLength(t)}</b><span>{t.credits} créditos, respostas mais completas, voz, foto de comprovante e VIVA no WhatsApp. Sem cartão e sem cobrança: no fim, você escolhe seu plano.</span></div>
    <button className="gr-trial-btn" disabled={busy} onClick={start}>{busy ? "Ativando…" : "Testar grátis"}</button>
    {msg && <p className="gr-ok">{msg}</p>}{err && <p className="sl-error">{err}</p>}
  </div>;
}

// ---------------------------------------------------------------- Fim do teste grátis
type Followup = { started_at: string; ends_at: string; expenses: number; conversations: number };
/** Aviso dentro do app nos 2 últimos dias do teste do Pro e nos 5 dias depois que ele acaba (uma vez por dia). */
export function TrialFollowup() {
  const [f, setF] = useState<Followup | null>(null);
  const [hidden, setHidden] = useState(true);
  useEffect(() => { fetch("/api/trial").then(r => (r.ok ? r.json() : null)).then(d => setF(d?.followup ?? null)).catch(() => setF(null)); }, []);
  const now = Date.now(); const ends = f ? new Date(f.ends_at).getTime() : 0;
  // Teste curto (minutos): o aviso de "acabando" não faz sentido; o fim abre os planos (TrialEndOffer).
  const shortTrial = f ? ends - new Date(f.started_at).getTime() < 86400000 : false;
  const stage = !f ? null : ends > now ? (!shortTrial && ends - now <= 2 * 86400000 ? "ending" : null) : (now - ends <= 5 * 86400000 ? "ended" : null);
  const key = stage ? `viva-trial-followup:${stage}:${new Date().toISOString().slice(0, 10)}` : "";
  useEffect(() => { if (!key) return; try { setHidden(localStorage.getItem(key) === "1"); } catch { setHidden(false); } }, [key]);
  if (!f || !stage || hidden) return null;
  const close = () => { try { localStorage.setItem(key, "1"); } catch { /* sem armazenamento */ } setHidden(true); };
  const hours = Math.max(1, Math.ceil((ends - now) / 3600000));
  const when = hours <= 24 ? "em menos de 24 horas" : `em ${Math.ceil(hours / 24)} dias`;
  const did = [f.expenses > 0 ? `${f.expenses} ${f.expenses === 1 ? "gasto anotado" : "gastos anotados"}` : "", f.conversations > 0 ? `${f.conversations} ${f.conversations === 1 ? "conversa" : "conversas"} com a VIVA` : ""].filter(Boolean).join(" e ");
  return <section className="gr-follow" role="status">
    <div>
      <b>{stage === "ending" ? `Seu teste do Pro acaba ${when} (${dm(f.ends_at)})` : "Seu teste do Pro terminou"}</b>
      <span>{stage === "ending"
        ? (did ? `Desde que começou: ${did}. ` : "Ainda dá tempo de aproveitar: anote um gasto ou pergunte quanto pode gastar hoje. ") + "Depois ele volta ao Free sozinho, sem cobrança."
        : (did ? `No teste foram ${did}. ` : "") + "Você voltou ao plano Free. Para continuar com mais créditos, voz e foto de comprovante, escolha o Essencial ou o Pro."}</span>
    </div>
    <div className="gr-follow-actions">
      <a className="gr-trial-btn" href="/planos">{stage === "ending" ? "Continuar com o Pro" : "Ver planos"}</a>
      <button type="button" className="gr-follow-close" onClick={close}>Agora não</button>
    </div>
  </section>;
}

// ---------------------------------------------------------------- Convite (Indique e ganhe)
const KEY = "viva-invite-code";
/** Na página de cadastro/login: guarda o código do link ?convite=XXXXXX para usar depois do cadastro. */
export function InviteStore() {
  useEffect(() => {
    try {
      const c = new URL(window.location.href).searchParams.get("convite");
      if (c && /^[A-Za-z0-9]{6}$/.test(c)) localStorage.setItem(KEY, c.toUpperCase());
    } catch { /* navegação privada */ }
  }, []);
  return null;
}
export function inviteCodeFromStorage() { try { return localStorage.getItem(KEY); } catch { return null; } }

/** Dentro do app: se a pessoa chegou por convite, registra (uma vez) e mostra um aviso curto. */
export function InviteClaim() {
  const [note, setNote] = useState("");
  useEffect(() => {
    const code = inviteCodeFromStorage(); if (!code) return;
    fetch("/api/referral", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) })
      .then(async r => {
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.ok) setNote("Convite aceito! Ao terminar sua primeira conversa com a VIVA, você ganha 10 créditos extras. 🎁");
        if (r.ok || r.status === 409 || r.status === 400) { try { localStorage.removeItem(KEY); } catch { /* */ } }
      }).catch(() => {});
  }, []);
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(""), 7000); return () => clearTimeout(t); }, [note]);
  return note ? <div className="gr-toast" role="status">{note}</div> : null;
}

type Ref = { code: string; invited: number; rewarded: number; pending: number; credits_earned: number; reward_referrer: number; reward_friend: number; monthly_limit: number };

export function ReferralPage() {
  const [r, setR] = useState<Ref | null>(null); const [err, setErr] = useState(""); const [copied, setCopied] = useState(false);
  useEffect(() => {
    fetch("/api/referral").then(async x => { const j = await x.json().catch(() => ({})); if (!x.ok) throw new Error(j.error); return j; })
      .then(setR).catch(e => setErr(e instanceof Error && e.message ? e.message : "Não foi possível carregar seu convite."));
  }, []);
  const link = r && typeof window !== "undefined" ? `${window.location.origin}/cadastro?convite=${r.code}` : "";
  const text = r ? `Tô usando a VIVA+ pra organizar meu dinheiro: ela lembra do pagamento, das contas e diz quanto dá pra gastar. Cria sua conta grátis com meu convite e ganha ${r.reward_friend} créditos: ${link}` : "";
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* */ } };
  const share = async () => {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) { try { await nav.share({ title: "VIVA+", text }); return; } catch { /* cancelado */ } }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };
  return <div className="gr-page">
    <section className="gr-hero">
      <span className="gr-gift" aria-hidden><Gift size={30} /></span>
      <h1>Indique e ganhe</h1>
      <p>Convide quem também quer sair do aperto. Quando seu amigo terminar a primeira conversa com a VIVA, <b>você ganha {r?.reward_referrer ?? 20} créditos</b> e <b>ele ganha {r?.reward_friend ?? 10}</b>. E se ele assinar o Pro, <b>você ganha R$ 10 no Pix</b>.</p>
    </section>
    {err && <p className="sl-error">{err}</p>}
    <ReferralCash />
    {r && <>
      <section className="gr-card">
        <span className="gr-label">Seu código</span>
        <strong className="gr-code">{r.code}</strong>
        <div className="gr-link"><span>{link.replace(/^https?:\/\//, "")}</span><button onClick={copy} aria-label="Copiar link">{copied ? <Check size={18} /> : <Copy size={18} />}</button></div>
        <button className="gr-share" onClick={share}><Share2 size={18} /> Convidar pelo WhatsApp</button>
      </section>
      <section className="gr-stats">
        <div><b>{r.invited}</b><span>{r.invited === 1 ? "amigo entrou" : "amigos entraram"}</span></div>
        <div><b>{r.pending}</b><span>começando</span></div>
        <div><b>+{r.credits_earned}</b><span>créditos ganhos</span></div>
      </section>
      <section className="gr-card gr-how">
        <h2>Como funciona</h2>
        <ol><li>Envie seu link para um amigo.</li><li>Ele cria a conta grátis pelo link.</li><li>Quando ele terminar a primeira conversa com a VIVA, os créditos caem para os dois.</li><li>Se ele assinar o Pro, você ganha R$ 10. O valor é liberado 30 dias depois do pagamento dele e você saca por Pix.</li></ol>
        <small>Vale para contas novas. Até {r.monthly_limit} recompensas em créditos por mês. Os créditos seguem as regras do seu plano. Dinheiro: R$ 10 por amigo que pagar o plano Pro (o teste grátis não conta), uma vez por amigo, até R$ 200 por mês; se o pagamento for estornado, o valor é cancelado. Saque a partir de R$ 30, conferido e pago pela equipe da VIVA em até 5 dias úteis. Veja os <a href="/termos#indicacao">Termos</a>.</small>
      </section>
    </>}
  </div>;
}

// ---------------------------------------------------------------- Indicação paga (R$ 10 por amigo que assina o Pro)
type Cash = { pending_cents: number; available_cents: number; requested_cents: number; paid_cents: number; paying_friends: number; next_release: string | null;
  open_payout: { amount_cents: number; created_at: string } | null; last_payout: { status: string; amount_cents: number; decided_at: string | null; note: string | null } | null;
  reward_cents: number; min_payout_cents: number; monthly_limit_cents: number; hold_days: number };
const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const PIX: { id: "cpf" | "email" | "phone" | "random"; label: string; ph: string; mode: "numeric" | "email" | "tel" | "text" }[] = [
  { id: "cpf", label: "CPF", ph: "000.000.000-00", mode: "numeric" }, { id: "phone", label: "Celular", ph: "(11) 98888-7777", mode: "tel" },
  { id: "email", label: "E-mail", ph: "voce@email.com", mode: "email" }, { id: "random", label: "Aleatória", ph: "Chave aleatória", mode: "text" },
];

export function ReferralCash() {
  const [c, setC] = useState<Cash | null>(null); const [open, setOpen] = useState(false);
  const [type, setType] = useState(PIX[0]); const [key, setKey] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [ok, setOk] = useState("");
  const load = () => fetch("/api/referral/cash").then(r => (r.ok ? r.json() : null)).then(setC).catch(() => setC(null));
  useEffect(() => { load(); }, []);
  if (!c) return null;
  const canWithdraw = c.available_cents >= c.min_payout_cents && !c.open_payout;
  const missing = Math.max(0, c.min_payout_cents - c.available_cents);
  const submit = async () => {
    if (key.trim().length < 5) { setErr("Informe sua chave Pix."); return; }
    setBusy(true); setErr("");
    const r = await fetch("/api/referral/cash", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pix_key_type: type.id, pix_key: key }) });
    const j = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) { setErr(j.error || "Não consegui pedir o saque."); return; }
    setOpen(false); setKey(""); setOk(`Pedido de saque de ${reais(j.amount_cents)} enviado! A equipe confere e paga no seu Pix em até 5 dias úteis.`);
    load();
  };
  return <section className="gr-card gr-cash">
    <div className="gr-cash-head"><span className="gr-cash-ic" aria-hidden><Banknote size={20} /></span><div><b>Ganhe R$ 10 por amigo no Pro</b><small>Seu amigo assinou o Pro? R$ 10 para você, no Pix.</small></div></div>
    <div className="gr-cash-grid">
      <div><Clock3 size={16} aria-hidden /><span>A liberar</span><b>{reais(c.pending_cents)}</b></div>
      <div className="hot"><Wallet size={16} aria-hidden /><span>Disponível</span><b>{reais(c.available_cents)}</b></div>
      <div><Check size={16} aria-hidden /><span>Já recebido</span><b>{reais(c.paid_cents)}</b></div>
    </div>
    {c.next_release && <p className="gr-cash-note">Próxima liberação em {new Date(c.next_release).toLocaleDateString("pt-BR")}.</p>}
    {c.open_payout ? <p className="gr-cash-status">Saque de <b>{reais(c.open_payout.amount_cents)}</b> em análise, pedido em {new Date(c.open_payout.created_at).toLocaleDateString("pt-BR")}. Pagamento em até 5 dias úteis.</p>
      : c.last_payout?.status === "rejected" ? <p className="gr-cash-status warn">Seu último saque não foi pago{c.last_payout.note ? `: ${c.last_payout.note}` : ""}. O valor voltou para o disponível; confira a chave e peça de novo.</p>
      : c.last_payout?.status === "paid" ? <p className="gr-cash-status ok">Último saque de {reais(c.last_payout.amount_cents)} pago{c.last_payout.decided_at ? ` em ${new Date(c.last_payout.decided_at).toLocaleDateString("pt-BR")}` : ""}. 🎉</p> : null}
    {ok && <p className="gr-ok">{ok}</p>}
    <button className="gr-share" disabled={!canWithdraw} onClick={() => { setOpen(true); setErr(""); }}>{canWithdraw ? `Sacar ${reais(c.available_cents)} via Pix` : c.open_payout ? "Saque em análise" : `Saque a partir de ${reais(c.min_payout_cents)} · faltam ${reais(missing)}`}</button>
    {open && createPortal(<div className="vc-sheet-layer" role="dialog" aria-modal="true" aria-label="Sacar via Pix">
      <button className="vc-sheet-backdrop" aria-label="Fechar" onClick={() => setOpen(false)} />
      <div className="vc-sheet sl-sheet">
        <div className="md-head"><h2>Sacar {reais(c.available_cents)}</h2><button className="ob-link" onClick={() => setOpen(false)}>Fechar</button></div>
        <div className="vh-form">
          <p>Tipo da chave Pix</p>
          <div className="vh-pick">{PIX.map(p => <button key={p.id} type="button" className={type.id === p.id ? "sel" : ""} onClick={() => { setType(p); setErr(""); }}>{p.label}</button>)}</div>
          <label>Sua chave Pix<input value={key} inputMode={type.mode} maxLength={120} placeholder={type.ph} autoComplete="off" onChange={e => { setKey(e.target.value); setErr(""); }} onKeyDown={e => { if (e.key === "Enter") submit(); }} /></label>
          {err && <p className="sl-error">{err}</p>}
          <button className="vh-cta" disabled={busy} onClick={submit}>{busy ? "Enviando…" : "Pedir saque"}</button>
          <small className="vc-muted">A chave precisa estar no seu nome. A equipe da VIVA confere as indicações e faz o Pix em até 5 dias úteis.</small>
        </div>
      </div>
    </div>, document.body)}
  </section>;
}
