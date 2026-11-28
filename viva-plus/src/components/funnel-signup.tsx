"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Lock, ShieldCheck, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { FUNNEL_OFFER } from "@/lib/life-diagnostic";

/**
 * Cadastro dentro do funil (folha que abre por cima do resultado): a pessoa não sai da página.
 * Depois de criar a conta vai direto para o pagamento do Pro (/oferta-pro).
 */
export default function FunnelSignup({ open, onClose, lifeAnswers, leadId, headline }: { open: boolean; onClose: () => void; lifeAnswers?: Record<string, string>; leadId?: string | null; headline: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; login?: boolean } | null>(null);
  const first = useRef<HTMLInputElement | null>(null);

  useEffect(() => { if (open) setTimeout(() => first.current?.focus(), 80); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault(); setMsg(null);
    if (name.trim().length < 2) return setMsg({ text: "Digite seu nome." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setMsg({ text: "Confira o seu e-mail." });
    if (password.length < 8) return setMsg({ text: "A senha precisa ter pelo menos 8 caracteres." });
    if (!terms) return setMsg({ text: "Marque que aceita os Termos e a Política de Privacidade." });
    setBusy(true);
    try {
      const supabase = createClient(true);
      const offerToken = await fetch("/api/funnel/offer", { cache: "no-store" }).then(r => r.json()).then(d => (typeof d.token === "string" ? d.token : null)).catch(() => null);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(), password,
        options: {
          data: {
            full_name: name.trim(), app_source: "viva_plus", terms_and_privacy_accepted: true,
            terms_of_use_version: TERMS_VERSION, privacy_policy_version: PRIVACY_VERSION, terms_accepted_at: new Date().toISOString(),
            funnel: FUNNEL_OFFER, ...(offerToken ? { funnel_offer_token: offerToken } : {}),
            ...(lifeAnswers ? { life_answers: lifeAnswers } : {}),
            ...(leadId && /^[0-9a-f-]{36}$/.test(leadId) ? { diag_lead_id: leadId } : {}),
          },
          emailRedirectTo: location.origin + "/auth/callback?next=" + encodeURIComponent("/oferta-pro"),
        },
      });
      const exists = (m: string) => /already registered|already exists|user_already_exists/i.test(m);
      if (error) { if (exists(error.message)) return setMsg({ text: "Este e-mail já tem conta no VIVA+.", login: true }); throw error; }
      if (data.user && data.user.identities?.length === 0) return setMsg({ text: "Este e-mail já tem conta no VIVA+.", login: true });
      if (!data.session) {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (loginError) {
          if (/email.?not.?confirmed/i.test(loginError.message)) return setMsg({ text: "Conta criada! Abra o e-mail que o VIVA+ te mandou e toque no link para continuar a assinatura do Pro." });
          throw loginError;
        }
      }
      window.location.assign("/oferta-pro");
    } catch (err) { setMsg({ text: err instanceof Error && err.message ? "Não foi possível criar a conta: " + err.message : "Não foi possível criar a conta. Tente de novo." }); }
    finally { setBusy(false); }
  }

  if (!open) return null;
  return <div className="fs-layer" role="dialog" aria-modal="true" aria-labelledby="fs-title">
    <button type="button" className="fs-backdrop" aria-label="Fechar" onClick={onClose} />
    <form className="fs-sheet" onSubmit={submit} noValidate>
      <button type="button" className="fs-close" onClick={onClose} aria-label="Fechar"><X aria-hidden /></button>
      <span className="fs-step">Passo 1 de 2 · leva 20 segundos</span>
      <h2 id="fs-title">{headline}</h2>
      <p className="fs-sub">Crie seu acesso. No próximo passo você assina o Pro e o diagnóstico completo é liberado na hora.</p>
      <label className="dq-field">Seu nome<input ref={first} autoComplete="given-name" maxLength={60} value={name} onChange={e => setName(e.target.value)} placeholder="Como podemos te chamar" /></label>
      <label className="dq-field">Seu e-mail<input type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" /></label>
      <label className="dq-field">Crie uma senha<span className="fs-pass"><input type={show ? "text" : "password"} autoComplete="new-password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" /><button type="button" onClick={() => setShow(v => !v)} aria-label={show ? "Ocultar senha" : "Mostrar senha"}>{show ? <EyeOff aria-hidden /> : <Eye aria-hidden />}</button></span></label>
      <label className="dq-check"><input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} /><span>Li e aceito os <a href="/termos" target="_blank" rel="noopener noreferrer">Termos de Uso</a> e a <a href="/privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade</a></span></label>
      {msg && <p className="dq-err" role="alert">{msg.text}{msg.login && <> <Link href="/login?next=/oferta-pro">Entrar com minha conta</Link></>}</p>}
      <button className="dq-btn" disabled={busy}>{busy ? "Criando sua conta…" : <>Continuar para o Pro <ArrowRight aria-hidden /></>}</button>
      <p className="fs-trust"><Lock aria-hidden />Seus dados ficam protegidos <ShieldCheck aria-hidden />Garantia de 7 dias no Pro</p>
    </form>
  </div>;
}
