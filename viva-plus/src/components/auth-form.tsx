"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LockKeyhole, Mail, Sparkles, Eye, EyeOff, ArrowRight, CalendarDays, Wallet, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim(), app_source: "viva_plus" }, emailRedirectTo: `${location.origin}/auth/callback` } });
        if (error) {
          if (error.message.toLowerCase().includes("already registered") || error.message.toLowerCase().includes("already exists") || error.message.toLowerCase().includes("user_already_exists")) {
            setMessage("Este e-mail já está cadastrado no acesso compartilhado do Meniuza. Se você já possui perfil no VIVA+, entre pelo login; caso contrário, use outro e-mail para criar sua conta VIVA+.");
            return;
          }
          throw error;
        }
        if (data.user && data.user.identities?.length === 0) {
          setMessage("Este e-mail já está cadastrado no acesso compartilhado do Meniuza. Se você já possui perfil no VIVA+, entre pelo login; caso contrário, use outro e-mail para criar sua conta VIVA+.");
          return;
        }
        setMessage("Cadastro recebido! Confira seu e-mail para confirmar a conta. Seu perfil será criado automaticamente no VIVA+.");
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
        router.replace(params.get("next") || "/assistente"); router.refresh();
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback?next=/alterar-senha` });
        if (error) throw error;
        setMessage("Se o endereço estiver cadastrado, você receberá as instruções de recuperação.");
      }
    } catch (err) { const raw = err instanceof Error ? err.message : ""; const normalized = raw.toLowerCase(); setMessage(normalized.includes("invalid login credentials") || normalized.includes("invalid_credentials") ? "E-mail ou senha incorretos. Se você já criou sua conta e não lembra a senha, clique em “Esqueci a senha” para receber um link de recuperação." : raw || "Não foi possível concluir. Tente novamente."); }
    finally { setBusy(false); }
  }

  const title = mode === "signup" ? "Crie sua conta" : mode === "reset" ? "Recuperar senha" : "Que bom ter você de volta";
  return <main className="auth-page grid min-h-[100svh] place-items-center bg-white px-4 py-8">
    <div className="grid w-full max-w-5xl overflow-hidden rounded-[28px] border bg-white shadow-[0_24px_80px_rgba(25,21,31,.08)] md:grid-cols-[.9fr_1.1fr]" style={{ borderColor: "var(--color-gray)" }}><div className="auth-mobile-hero md:hidden"><div className="auth-mobile-orbit"/><div className="auth-mobile-brand"><span className="auth-mobile-emblem">V<sup>+</sup></span><span><strong>VIVA</strong><small>VIDA EM MOVIMENTO</small></span></div><h2>{mode === "signup" ? "Seu próximo capítulo começa aqui." : mode === "reset" ? "Vamos recuperar seu acesso." : "Que bom ter você de volta."}</h2><p>{mode === "signup" ? "Um espaço só seu para organizar escolhas, planos e conquistas." : mode === "reset" ? "Recupere seu acesso com segurança e continue de onde parou." : "Sua rotina e seus planos esperam por você."}</p></div>
      <section className="auth-brand-panel relative hidden min-h-[680px] flex-col justify-between overflow-hidden p-10 md:flex">
        <div className="auth-brand-grid" aria-hidden="true"/>
        <Link href="/" className="auth-wordmark relative"><span className="auth-wordmark-main">VIVA<span>+</span></span><small>UM JEITO MAIS LEVE DE VIVER</small></Link>
        <div className="auth-brand-story relative">
          <span className="auth-kicker"><Sparkles size={14}/> SEU ESPAÇO. SEU RITMO.</span>
          <h2>{mode === "signup" ? <>Sua vida não cabe em uma planilha.<br/><em>Ela merece um lugar inteiro.</em></> : mode === "reset" ? <>Seu caminho continua.<br/><em>Vamos abrir a próxima porta.</em></> : <>Tudo o que importa,<br/><em>mais perto de você.</em></>}</h2>
          <p>{mode === "signup" ? "Organize compromissos, acompanhe seu dinheiro e transforme planos em pequenas conquistas diárias." : "Uma visão mais clara da sua rotina, das suas finanças e das escolhas que fazem sentido para você."}</p>
        </div>
        <div className="auth-brand-stats relative">
          <span><CalendarDays size={17}/> ROTINA COM INTENÇÃO</span>
          <span><Wallet size={17}/> FINANÇAS COM CLAREZA</span>
          <span><ShieldCheck size={17}/> SEU ESPAÇO PESSOAL</span>
        </div>
        <span className="auth-brand-index" aria-hidden="true">V+ / 01</span>
      </section>
      <section className="auth-form-panel p-6 sm:p-10 md:p-14">
        <Link href="/" className="auth-back inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 hover:text-neutral-900"><ArrowLeft size={16}/> Voltar ao início</Link>
        <div className="auth-heading mt-9 md:mt-12"><span className="auth-eyebrow">{mode === "signup" ? "COMECE POR VOCÊ" : mode === "reset" ? "ACESSO SEGURO" : "SEU ESPAÇO VIVA+"}</span><h1 className="mt-3 text-3xl font-black tracking-tight text-neutral-900">{mode === "login" ? "Entre no seu espaço." : mode === "signup" ? "Crie seu espaço." : title}</h1><p className="mt-2 text-sm leading-6 text-neutral-500">{mode === "login" ? "Continue seus planos de onde parou." : mode === "signup" ? "Poucos passos para começar a organizar o que importa." : "Informe seu e-mail para receber o link de recuperação."}</p></div>
        <form onSubmit={submit} className="auth-form mt-8 space-y-5">
          {mode === "signup" && <label className="auth-field-label block text-sm font-semibold text-neutral-800">Como podemos chamar você?<input className="field mt-2" autoComplete="name" required value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome completo"/></label>}
          <label className="auth-field-label block text-sm font-semibold text-neutral-800">Seu e-mail<span className="relative mt-2 block"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={17}/><input className="field pl-10" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="maria@email.com"/></span></label>
          {mode !== "reset" && <label className="auth-field-label block text-sm font-semibold text-neutral-800">Sua senha<span className="relative mt-2 block"><LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={17}/><input className="field auth-password-input pl-10 pr-12" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo de 8 caracteres"/>{mode === "login" && <button type="button" className="auth-password-toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} title={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button>}</span></label>}
          {mode === "signup" && <p className="auth-privacy-note"><ShieldCheck size={15}/> Seus dados são pessoais e protegidos.</p>}{mode === "login" && <div className="auth-options"><label className="auth-remember"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}/> <span>Lembrar de mim</span></label><Link href="/recuperar-senha">Esqueci a senha</Link></div>}<button className="btn-primary auth-submit mt-2 w-full" disabled={busy}>{busy ? "Aguarde..." : mode === "signup" ? "Criar conta" : mode === "reset" ? "Enviar instruções" : <><span>Entrar</span><ArrowRight size={20}/></>}</button>
          {message && <p role="status" className="rounded-xl border border-[var(--color-gray)] bg-neutral-50 p-3 text-sm leading-6 text-neutral-700">{message}</p>}
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