"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LockKeyhole, Mail, Eye, EyeOff, ArrowRight, CalendarDays, ShieldCheck, Receipt, BadgeDollarSign, CalendarClock, ShoppingCart, MapPin, Mic } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { InviteStore } from "@/components/growth";

export default function AuthForm({ mode }: { mode: "login" | "signup" | "reset" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsAttempted, setTermsAttempted] = useState(false);
  const termsRef = useRef<HTMLInputElement>(null);
  const signupFieldsValid = name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && password.length >= 8;

  async function submit(e: FormEvent) {
    e.preventDefault(); setMessage("");
    if (mode === "signup" && !termsAccepted) { setTermsAttempted(true); setMessage("Marque para continuar"); termsRef.current?.focus(); return; }
    setBusy(true);
    try {
      const supabase = createClient(mode === "login" ? remember : true);
      if (mode === "signup") {
        const acceptedAt = new Date().toISOString();
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: {
            full_name: name.trim(), app_source: "viva_plus",
            terms_and_privacy_accepted: true,
            terms_of_use_version: "2026-11-15-v1",
            privacy_policy_version: "2026-11-15-v1",
            terms_accepted_at: acceptedAt
          }, emailRedirectTo: location.origin + "/auth/callback?next=/meu-dia" }
        });
        if (error) {
          const normalized = error.message.toLowerCase();
          if (normalized.includes("already registered") || normalized.includes("already exists") || normalized.includes("user_already_exists")) {
            setMessage("Este e-mail já está cadastrado. Entre com sua conta ou recupere sua senha.");
            return;
          }
          throw error;
        }
        if (data.user && data.user.identities?.length === 0) {
          setMessage("Este e-mail já está cadastrado. Entre com sua conta ou recupere sua senha.");
          return;
        }
        if (data.session) {
          router.replace("/meu-dia");
          router.refresh();
          return;
        }
        const { error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (!loginError) {
          router.replace("/meu-dia");
          router.refresh();
          return;
        }
        const loginReason = loginError.message.toLowerCase();
        if (loginReason.includes("email_not_confirmed") || loginReason.includes("email not confirmed")) {
          setMessage("Sua conta foi criada. Para liberar o primeiro acesso, confirme o e-mail enviado pelo VIVA+ e abra o link recebido. Depois disso, você entrará diretamente na conversa com a VIVA.");
          return;
        }
        throw new Error("Sua conta foi criada, mas não foi possível iniciar a sessão: " + loginError.message);
      } else if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        if (data.user) {
          const { data: vivaProfile, error: profileError } = await supabase
            .from("viva_profiles")
            .select("id")
            .eq("id", data.user.id)
            .maybeSingle();

          if (profileError) {
            await supabase.auth.signOut();
            throw new Error("Não foi possível validar seu cadastro no VIVA+. Tente novamente.");
          }

          if (!vivaProfile) {
            await supabase.auth.signOut();
            setMessage("Este e-mail existe no acesso compartilhado do Meniuza, mas ainda não tem cadastro no VIVA+. Para criar seu espaço VIVA+, use um e-mail que ainda não esteja cadastrado nesse acesso.");
            return;
          }
        }
        const requestedNext = params.get("next") || "/meu-dia";
        const safeNext = requestedNext.startsWith("/") && !requestedNext.startsWith("//") && !requestedNext.includes("\\") ? requestedNext : "/meu-dia";
        router.replace(safeNext); router.refresh();
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback?next=/alterar-senha` });
        if (error) throw error;
        setMessage("Se o endereço estiver cadastrado, você receberá as instruções de recuperação.");
      }
    } catch (err) { const raw = err instanceof Error ? err.message : ""; const normalized = raw.toLowerCase(); setMessage(normalized.includes("invalid login credentials") || normalized.includes("invalid_credentials") ? "E-mail ou senha incorretos. Se você já criou sua conta e não lembra a senha, clique em “Esqueci a senha” para receber um link de recuperação." : raw || "Não foi possível concluir. Tente novamente."); }
    finally { setBusy(false); }
  }

  const title = mode === "signup" ? "Crie sua conta" : mode === "reset" ? "Recuperar senha" : "Que bom ter você de volta";
  return <main className="auth-page grid min-h-[100svh] place-items-center bg-white px-4 py-8"><InviteStore />
    <div className="grid w-full max-w-5xl overflow-hidden rounded-[28px] border bg-white shadow-[0_24px_80px_rgba(25,21,31,.08)] md:grid-cols-[.9fr_1.1fr]" style={{ borderColor: "var(--color-gray)" }}><div className="auth-mobile-hero md:hidden"><div className="am-top"><span className="am-word">VIVA<span>+</span></span>{mode === "login" ? <Link href="/cadastro" className="am-switch">Criar conta</Link> : <Link href="/login" className="am-switch">Entrar</Link>}</div><h2>{mode === "signup" ? "Bora organizar sua vida financeira?" : mode === "reset" ? "Vamos recuperar seu acesso." : "Olá! Que bom te ver de novo."}</h2><p>{mode === "signup" ? "Leva 2 minutos. A VIVA te ajuda a sair das dívidas e a juntar dinheiro." : mode === "reset" ? "Recupere seu acesso com segurança e continue de onde parou." : "Seu dinheiro em dia, sem planilha."}</p><div className="am-bubbles" aria-hidden="true"><span className="am-b"><i className="ap-orb" />Anotado: R$ 35,90 em Farmácia ✅</span><span className="am-b pay"><BadgeDollarSign size={16} />Dia de pagamento! Já caiu?</span></div></div>
      <section className="auth-brand-panel ap relative hidden min-h-[680px] flex-col justify-between overflow-hidden p-10 md:flex">
        <Link href="/" className="auth-wordmark relative"><span className="auth-wordmark-main">VIVA<span>+</span></span><small>UM JEITO MAIS LEVE DE VIVER</small></Link>
        <div className="ap-copy">
          <h2>{mode === "signup" ? "Comece hoje a sair do aperto." : mode === "reset" ? "Seu acesso de volta em minutos." : "Seu dinheiro em dia, sem planilha."}</h2>
          <p>Converse com a VIVA, registre gastos em segundos e saiba quanto pode gastar até o próximo pagamento.</p>
        </div>
        {/* Prévia ilustrativa do app (valores de exemplo). */}
        <div className="ap-stage" aria-hidden="true">
          <div className="ap-phone"><span className="ap-notch" />
            <div className="ap-screen">
              <div className="ap-bar"><b>VIVA<span>+</span></b></div>
              <div className="ap-card"><b>Oi, Ana!</b><small>O que vamos resolver hoje?</small><em>Saldo do mês</em><strong>R$ 2.076,70</strong><i>2 contas na semana · R$ 248,80</i></div>
              <div className="ap-tiles">{([["Lancei um gasto", <Receipt key="a" />], ["Recebi dinheiro", <BadgeDollarSign key="b" />], ["Contas", <CalendarClock key="c" />], ["Lista de compras", <ShoppingCart key="d" />], ["Meu dia", <CalendarDays key="e" />], ["Perto de mim", <MapPin key="f" />]] as const).map(([t, ic]) => <span key={t}><i>{ic}</i>{t}</span>)}</div>
              <div className="ap-input">Converse com a VIVA…<span><Mic size={13} /></span></div>
            </div>
          </div>
          <div className="ap-bubble b1"><span className="ap-orb" />Anotado: R$ 35,90 em Farmácia ✅</div>
          <div className="ap-bubble b2"><BadgeDollarSign size={18} />Dia de pagamento! Já caiu?</div>
        </div>
        <p className="ap-trust"><ShieldCheck size={16} /> Seus dados são só seus · conexão protegida</p>
      </section>
      <section className="auth-form-panel p-6 sm:p-10 md:p-14">
        <Link href="/" className="auth-back inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 hover:text-neutral-900"><ArrowLeft size={16}/> Voltar ao início</Link>
        <div className="auth-heading mt-9 md:mt-12"><span className="auth-eyebrow">{mode === "signup" ? "COMECE POR VOCÊ" : mode === "reset" ? "ACESSO SEGURO" : "SEU ESPAÇO VIVA+"}</span><h1 className="mt-3 text-3xl font-black tracking-tight text-neutral-900">{mode === "login" ? "Acesse sua conta" : mode === "signup" ? "Crie sua conta grátis" : title}</h1><p className="mt-2 text-sm leading-6 text-neutral-500">{mode === "login" ? "Use o e-mail e a senha do seu cadastro." : mode === "signup" ? "Grátis e sem cartão. Você já começa com 20 créditos para usar a VIVA." : "Informe seu e-mail para receber o link de recuperação."}</p></div>
        <form onSubmit={submit} onKeyDown={e => { if (mode === "signup" && e.key === "Enter" && !termsAccepted) { e.preventDefault(); setTermsAttempted(true); setMessage("Marque para continuar"); termsRef.current?.focus(); } }} className="auth-form mt-8 space-y-5">
          {mode === "signup" && <label className="auth-field-label block text-sm font-semibold text-neutral-800">Como podemos chamar você?<input className="field mt-2" autoComplete="name" required value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome completo"/></label>}
          <label className="auth-field-label block text-sm font-semibold text-neutral-800">Seu e-mail<span className="relative mt-2 block"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={17}/><input className="field pl-10" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="maria@email.com"/></span></label>
          {mode !== "reset" && <label className="auth-field-label block text-sm font-semibold text-neutral-800">Sua senha<span className="relative mt-2 block"><LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={17}/><input className="field auth-password-input pl-10 pr-12" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo de 8 caracteres"/>{mode === "login" && <button type="button" className="auth-password-toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} title={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button>}</span></label>}
          {mode === "signup" && <div className="rounded-xl border p-3" style={{borderColor: termsAttempted && !termsAccepted ? "#fca5a5" : "#e9d5ff", background: termsAttempted && !termsAccepted ? "#fef2f2" : "#fff"}}>
            <label htmlFor="viva-terms-accept" className="flex min-h-11 cursor-pointer items-center gap-3 text-sm leading-6 text-neutral-800">
              <input ref={termsRef} id="viva-terms-accept" type="checkbox" checked={termsAccepted} onChange={e => { setTermsAccepted(e.target.checked); if (e.target.checked) { setTermsAttempted(false); if (message === "Marque para continuar") setMessage(""); } }} aria-invalid={termsAttempted && !termsAccepted} aria-describedby={termsAttempted && !termsAccepted ? "viva-terms-error" : undefined} className="h-5 w-5 shrink-0 accent-[#6410C9]"/>
              <span>Li e aceito os <a href="/termos" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="font-semibold text-[#6410C9] underline">Termos de Uso</a> e a <a href="/privacidade" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="font-semibold text-[#6410C9] underline">Política de Privacidade</a></span>
            </label>
            {termsAttempted && !termsAccepted && <p id="viva-terms-error" role="alert" className="mt-1 text-sm font-medium text-red-600">Marque para continuar</p>}
          </div>}
          {mode === "signup" && <p className="auth-privacy-note"><ShieldCheck size={15}/> Seus dados são pessoais e protegidos.</p>}{mode === "login" && <div className="auth-options"><label className="auth-remember"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}/> <span>Lembrar de mim</span></label><Link href="/recuperar-senha">Esqueci a senha</Link></div>}<button className="btn-primary auth-submit mt-2 w-full disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500 disabled:shadow-none" disabled={busy || (mode === "signup" && (!termsAccepted || !signupFieldsValid))}>{busy ? "Aguarde..." : mode === "signup" ? "Criar conta" : mode === "reset" ? "Enviar instruções" : <><span>Entrar</span><ArrowRight size={20}/></>}</button>
          {message && <p role={message === "Marque para continuar" ? "alert" : "status"} className={`rounded-xl border p-3 text-sm leading-6 ${message === "Marque para continuar" ? "border-red-200 bg-red-50 text-red-700" : "border-[var(--color-gray)] bg-neutral-50 text-neutral-700"}`}>{message}</p>}
        </form>
        <div className="auth-alternatives mt-7 flex flex-wrap justify-between gap-3 text-sm font-medium text-neutral-500">
          {mode === "login" ? <><span>Novo por aqui? <Link className="font-bold text-[var(--color-primary)]" href="/cadastro">Criar conta</Link></span></> : <Link className="hover:text-[var(--color-primary)]" href="/login">Voltar ao login</Link>}
        </div>
      </section>
      {mode === "login" && <Link href="/admin" className="viva-admin-mascot" aria-label="Acesso administrativo" title="Acesso administrativo">
        <svg viewBox="0 0 40 40" role="img" aria-hidden="true">
          <circle cx="20" cy="20" r="17" fill="#6410C9"/>
          <path d="M11 14.5c1.8-4 5-6 9-6s7.2 2 9 6" fill="none" stroke="#B98AF0" strokeWidth="2" strokeLinecap="round"/>
          <ellipse cx="14.5" cy="18" rx="1.7" ry="2.2" fill="#fff"/>
          <ellipse cx="25.5" cy="18" rx="1.7" ry="2.2" fill="#fff"/>
          <path d="M15.5 24c2.8 3 6.2 3 9 0" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
          <path d="M20 27.5v7m-3.5-3.5h7" stroke="#FFD43B" strokeWidth="2.4" strokeLinecap="round"/>
        </svg>
      </Link>}
    </div>
  </main>;
}