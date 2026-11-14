"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AlterarSenhaPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (password.length < 8) {
      setMessage("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setMessage("As senhas não são iguais. Confira e tente novamente.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.auth.signOut();
      setMessage("Senha alterada com sucesso. Entre novamente com sua nova senha.");
      setTimeout(() => router.replace("/login"), 1200);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível alterar a senha. Solicite um novo link de recuperação.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page grid min-h-[100svh] place-items-center bg-white px-4 py-8">
      <section className="auth-form-panel w-full max-w-lg rounded-[28px] border bg-white p-6 shadow-xl sm:p-10">
        <Link href="/login" className="auth-back text-sm font-semibold text-neutral-500">Voltar ao login</Link>
        <span className="auth-eyebrow mt-10 block">ACESSO SEGURO · VIVA+</span>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-neutral-900">Criar nova senha</h1>
        <p className="mt-2 text-sm leading-6 text-neutral-500">Defina uma nova senha para continuar usando seu espaço VIVA+.</p>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <label className="auth-field-label block text-sm font-semibold text-neutral-800">
            Nova senha
            <input className="field mt-2" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} placeholder="Mínimo de 8 caracteres" />
          </label>
          <label className="auth-field-label block text-sm font-semibold text-neutral-800">
            Confirmar nova senha
            <input className="field mt-2" type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={event => setConfirm(event.target.value)} placeholder="Digite a senha novamente" />
          </label>
          <button className="btn-primary auth-submit w-full" disabled={busy}>{busy ? "Salvando..." : "Alterar senha"}</button>
          {message && <p role="status" className="rounded-xl border border-[var(--color-gray)] bg-neutral-50 p-3 text-sm leading-6 text-neutral-700">{message}</p>}
        </form>
      </section>
    </main>
  );
}
