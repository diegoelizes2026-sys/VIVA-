"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Gift, Copy, Share2, Check, Sparkles } from "lucide-react";

// ---------------------------------------------------------------- Teste grátis do Pro
type Trial = { eligible: boolean; active: boolean; ends_at: string | null; days: number; credits: number };
const dm = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

/** Botão/cartão "Testar o Pro grátis por 7 dias". Some se a conta já usou o teste ou já é paga. */
export function TrialOffer({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [t, setT] = useState<Trial | null>(null);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  useEffect(() => { fetch("/api/trial").then(r => (r.ok ? r.json() : null)).then(setT).catch(() => setT(null)); }, []);
  if (!t) return null;
  if (t.active && t.ends_at) return <div className="gr-trial on"><Sparkles size={18} aria-hidden /><span><b>Você está testando o Pro</b> até {dm(t.ends_at)}. Depois volta ao Free sozinho, sem cobrança.</span></div>;
  if (!t.eligible) return null;
  const start = async () => {
    setBusy(true); setErr("");
    const r = await fetch("/api/trial", { method: "POST" });
    const j = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) { setErr(j.error || "Não consegui ativar agora."); return; }
    setMsg(`Pronto! O Pro está ativo até ${dm(j.ends_at)} com ${j.credits} créditos.`);
    setT({ ...t, eligible: false, active: true, ends_at: j.ends_at });
    window.dispatchEvent(new Event("viva:credits-updated"));
    router.refresh();
  };
  return <div className={"gr-trial" + (compact ? " compact" : "")}>
    <div><b>Teste o Pro grátis por {t.days} dias</b><span>{t.credits} créditos, respostas mais completas, voz e foto de comprovante. Sem cartão e sem cobrança: no fim, volta ao Free sozinho.</span></div>
    <button className="gr-trial-btn" disabled={busy} onClick={start}>{busy ? "Ativando…" : "Testar grátis"}</button>
    {msg && <p className="gr-ok">{msg}</p>}{err && <p className="sl-error">{err}</p>}
  </div>;
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
      <p>Convide quem também quer sair do aperto. Quando seu amigo terminar a primeira conversa com a VIVA, <b>você ganha {r?.reward_referrer ?? 20} créditos</b> e <b>ele ganha {r?.reward_friend ?? 10}</b>.</p>
    </section>
    {err && <p className="sl-error">{err}</p>}
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
        <ol><li>Envie seu link para um amigo.</li><li>Ele cria a conta grátis pelo link.</li><li>Quando ele terminar a primeira conversa com a VIVA, os créditos caem para os dois.</li></ol>
        <small>Vale para contas novas. Até {r.monthly_limit} recompensas por mês. Os créditos seguem as regras do seu plano.</small>
      </section>
    </>}
  </div>;
}
