"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock } from "lucide-react";
import { Logo } from "@/components/marca";

export default function Login() {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro("");
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senha }),
    });
    const d = await r.json().catch(() => ({}));
    setCarregando(false);
    if (!r.ok) return setErro(d.erro || "Não foi possível entrar.");
    router.replace("/admin");
    router.refresh();
  }

  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <div className="foto-fallback grao relative hidden flex-col justify-between overflow-hidden p-12 text-osso lg:flex">
        <Logo claro />
        <p className="font-display relative max-w-md text-6xl font-light leading-[0.95]">
          Cada lead, <em className="text-sol">uma família</em> esperando a resposta certa.
        </p>
        <p className="rotulo relative text-osso/50">Painel do corretor</p>
      </div>
      <div className="flex items-center justify-center px-4 py-16">
        <form onSubmit={entrar} className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Logo />
          </div>
          <span className="grid h-12 w-12 place-items-center rounded-full bg-ink text-osso">
            <Lock className="h-5 w-5" />
          </span>
          <h1 className="font-display mt-6 text-5xl font-light">Entrar no painel</h1>
          <p className="mt-2 text-ink/60">Leads, CRM, empreendimentos e carrossel do site.</p>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha"
            autoFocus
            className="mt-8 w-full rounded-2xl border border-ink/15 bg-white px-4 py-4 text-[16px] focus:border-lagoa focus:outline-none"
          />
          {erro && <p className="mt-3 text-[14px] text-coral">{erro}</p>}
          <button
            disabled={carregando || !senha}
            className="mt-4 flex w-full items-center justify-between rounded-full bg-ink py-2 pl-6 pr-2 font-semibold text-osso transition hover:bg-lagoa disabled:opacity-50"
          >
            {carregando ? "Entrando…" : "Entrar"}
            <span className="grid h-10 w-10 place-items-center rounded-full bg-osso text-ink">
              <ArrowRight className="h-4 w-4" />
            </span>
          </button>
        </form>
      </div>
    </main>
  );
}
