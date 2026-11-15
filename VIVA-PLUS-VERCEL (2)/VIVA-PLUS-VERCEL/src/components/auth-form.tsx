"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LockKeyhole, Mail, Sparkles, Eye, EyeOff, Fingerprint, ArrowRight } from "lucide-react";
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
  const [termsAccepted, setTermsAccepted] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setMessage("");
    if (mode === "signup" && !termsAccepted) { setMessage("Para criar sua conta, confirme que leu e aceita os Termos de Responsabilidade."); return; }
    setBusy(true);
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name, responsibility_terms_accepted: true, responsibility_terms_version: "1.0-2026-11-15", responsibility_terms_accepted_at: new Date().toISOString() }, emailRedirectTo: `${location.origin}/auth/callback` } });
        if (error) throw error;
        if (data.session) {
          router.replace("/meu-dia");
          router.refresh();
        } else {
          setMessage("Cadastro criado. Para proteger sua conta, confirme seu e-mail e depois entre no VIVA+.");
        }
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(params.get("next") || "/meu-dia"); router.refresh();
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/login` });
        if (error) throw error;
        setMessage("Se o endereço estiver cadastrado, você receberá as instruções de recuperação.");
      }
    } catch (err) { setMessage(err instanceof Error ? err.message : "Não foi possível concluir."); }
    finally { setBusy(false); }
  }

  const title = mode === "signup" ? "Crie sua conta" : mode === "reset" ? "Recuperar senha" : "Que bom ter você de volta";
  return <main className="auth-page grid min-h-[100svh] place-items-center bg-white px-4 py-8">
    <div className="grid w-full max-w-5xl overflow-hidden rounded-[28px] border bg-white shadow-[0_24px_80px_rgba(25,21,31,.08)] md:grid-cols-[.9fr_1.1fr]" style={{ borderColor: "var(--color-gray)" }}><div className="auth-mobile-hero md:hidden"><div className="auth-mobile-orbit"/><div className="auth-mobile-brand"><span className="auth-mobile-emblem">V<sup>+</sup></span><span><strong>VIVA</strong><small>ASSISTENTE FINANCEIRA</small></span></div><h2>Bem-vinda de volta</h2><p>Entre para acompanhar suas finanças e agenda.</p></div>
      <section className="relative hidden min-h-[620px] flex-col justify-between overflow-hidden p-10 text-white md:flex" style={{ background: "var(--color-primary)" }}>
        <div className="absolute -right-28 -top-20 h-80 w-80 rounded-full border border-white/15"/><div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full border border-white/15"/>
        <Link href="/" className="relative text-3xl font-black tracking-tight">VIVA<span className="text-white/70">+</span></Link>
        <div className="relative"><span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-2 text-xs font-semibold"><Sparkles size={14}/> SUA VIDA, EM HARMONIA</span><h2 className="mt-6 text-4xl font-black leading-tight">Mais clareza para viver. Mais leveza para escolher.</h2><p className="mt-5 max-w-sm leading-7 text-white/75">Sua rotina, seus objetivos e suas finanças em um só espaço.</p></div>
        <p className="relative text-xs text-white/60">VIVA+ · Sua vida mais inteligente.</p>
      </section>
      <section className="auth-form-panel p-6 sm:p-10 md:p-14">
        <Link href="/" className="auth-back inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 hover:text-neutral-900"><ArrowLeft size={16}/> Voltar ao início</Link>
        <div className="auth-heading mt-9 md:mt-12"><h1 className="mt-5 text-3xl font-black tracking-tight text-neutral-900">{mode === "login" ? "Bem-vinda de volta" : title}</h1><p className="mt-2 text-sm leading-6 text-neutral-500">{mode === "login" ? "Entre para acompanhar suas finanças e agenda." : "Sua vida mais organizada. Seu dinheiro mais inteligente."}</p></div>
        <form onSubmit={submit} className="auth-form mt-8 space-y-5">
          {mode === "signup" && <label className="block text-sm font-semibold text-neutral-800">Nome completo<input className="field mt-2" required value={name} onChange={e => setName(e.target.value)} placeholder="Como podemos chamar você?"/></label>}
          <label className="block text-sm font-semibold text-neutral-800">E-mail<span className="relative mt-2 block"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={17}/><input className="field pl-10" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="maria@email.com"/></span></label>
          {mode !== "reset" && <label className="block text-sm font-semibold text-neutral-800">Senha<span className="relative mt-2 block"><LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={17}/><input className="field auth-password-input pl-10 pr-12" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••••"/>{mode === "login" && <button type="button" className="auth-password-toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button>}</span></label>}
          {mode === "signup" && <div className="rounded-xl border border-[var(--color-gray)] bg-neutral-50 p-4 text-sm text-neutral-700"><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" className="mt-1" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} required/><span>Li e aceito os <Link className="font-bold text-[var(--color-primary)] underline" href="/termos-de-responsabilidade" target="_blank">Termos de Responsabilidade</Link>. Entendo que o VIVA+ é uma ferramenta de apoio à organização pessoal e financeira, não substitui orientação profissional e que sou responsável por conferir as informações e decisões que tomar.</span></label></div>}
          {mode === "login" && <div className="auth-options"><label><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}/> <span>Lembrar de mim</span></label><Link href="/recuperar-senha">Esqueci a senha</Link></div>}<button className="btn-primary auth-submit mt-2 w-full" disabled={busy || (mode === "signup" && !termsAccepted)}>{busy ? "Aguarde..." : mode === "signup" ? "Criar conta" : mode === "reset" ? "Enviar instruções" : <><span>Entrar</span><ArrowRight size={20}/></>}</button>
          {message && <p role="status" className="rounded-xl border border-[var(--color-gray)] bg-neutral-50 p-3 text-sm leading-6 text-neutral-700">{message}</p>}
        </form>
        <div className="auth-alternatives mt-7 flex flex-wrap justify-between gap-3 text-sm font-medium text-neutral-500">
          {mode === "login" ? <><span>Novo por aqui? <Link className="font-bold text-[var(--color-primary)]" href="/cadastro">Criar conta</Link></span></> : <Link className="hover:text-[var(--color-primary)]" href="/login">Voltar ao login</Link>}
        </div>
      </section>
    </div>
  </main>;
}