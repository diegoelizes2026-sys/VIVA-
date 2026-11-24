"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Eye, EyeOff, Check, LockKeyhole } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Criar nova senha: aberta pelo link do e-mail "Crie sua nova senha da VIVA+" (sessão de recuperação já aberta).
export default function AlterarSenhaPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [session, setSession] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => setSession(data.session ? "ok" : "missing")).catch(() => setSession("missing"));
  }, []);

  const rules = [
    { ok: password.length >= 8, label: "Pelo menos 8 caracteres" },
    { ok: /\d/.test(password), label: "Pelo menos 1 número" },
    { ok: password.length > 0 && password === confirm, label: "As duas senhas iguais" },
  ];

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 8) { setError("A nova senha precisa ter pelo menos 8 caracteres."); return; }
    if (password !== confirm) { setError("As senhas não são iguais. Confira e tente de novo."); return; }
    setBusy(true);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) {
        const m = error.message.toLowerCase();
        throw new Error(m.includes("same") ? "A nova senha precisa ser diferente da antiga." : m.includes("session") || m.includes("auth") ? "Seu link expirou. Peça um novo para trocar a senha." : "Não foi possível alterar a senha agora. Tente de novo.");
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível alterar a senha agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="np-page">
      <section className="np-card">
        <header className="np-head">
          <span className="np-logo">VIVA<span>+</span></span>
          <span className="np-icon" aria-hidden><LockKeyhole size={26} /></span>
        </header>
        <div className="np-body">
          {session === "loading" ? <p className="np-muted">Carregando…</p>
          : done ? <>
            <span className="np-ok" aria-hidden><Check size={30} /></span>
            <h1>Senha alterada ✅</h1>
            <p className="np-muted">Pronto! Da próxima vez, entre com a sua nova senha.</p>
            <Link className="np-btn" href="/meu-dia">Ir para o meu dia</Link>
          </>
          : session === "missing" ? <>
            <h1>Esse link expirou</h1>
            <p className="np-muted">Por segurança, o link para trocar a senha vale por 1 hora e só pode ser usado uma vez. Peça um novo, leva 1 minuto.</p>
            <Link className="np-btn" href="/recuperar-senha">Pedir um novo link</Link>
            <Link className="np-link" href="/login">Voltar ao login</Link>
          </>
          : <>
            <span className="np-eyebrow">ACESSO SEGURO</span>
            <h1>Crie sua nova senha</h1>
            <p className="np-muted">Escolha uma senha que você não usa em outros sites.</p>
            <form onSubmit={submit} className="np-form">
              <label>Nova senha
                <span className="np-input">
                  <input type={show ? "text" : "password"} autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" />
                  <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? "Esconder senha" : "Mostrar senha"}>{show ? <EyeOff size={19} /> : <Eye size={19} />}</button>
                </span>
              </label>
              <label>Confirme a nova senha
                <span className="np-input">
                  <input type={show ? "text" : "password"} autoComplete="new-password" minLength={8} required value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Digite de novo" />
                </span>
              </label>
              <ul className="np-rules">{rules.map(r => <li key={r.label} className={r.ok ? "ok" : ""}><Check size={15} aria-hidden /> {r.label}</li>)}</ul>
              {error && <p className="np-error" role="alert">{error}</p>}
              <button className="np-btn" disabled={busy}>{busy ? "Salvando…" : "Salvar nova senha"}</button>
            </form>
          </>}
        </div>
      </section>
      <p className="np-foot">VIVA+ · seus dados protegidos · <Link href="/privacidade">Privacidade</Link></p>
    </main>
  );
}
