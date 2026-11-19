"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { IconeWhatsapp } from "./marca";

export function FormContato({
  empreendimento,
  escuro = false,
  compacto = false,
}: {
  empreendimento?: string;
  escuro?: boolean;
  compacto?: boolean;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [zap, setZap] = useState<string | null>(null);
  const [objetivo, setObjetivo] = useState("Morar");

  async function enviar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setErro("");
    setEnviando(true);
    const f = new FormData(ev.currentTarget);
    const r = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...Object.fromEntries(f), objetivo, empreendimento }),
    });
    const d = await r.json().catch(() => ({}));
    setEnviando(false);
    if (!r.ok) return setErro(d.erro || "Não foi possível enviar.");
    setZap(d.whatsapp);
    window.open(d.whatsapp, "_blank", "noopener");
  }

  const campo = `w-full rounded-2xl border px-4 py-3.5 text-[15px] transition focus:outline-none ${
    escuro
      ? "border-osso/15 bg-osso/5 text-osso placeholder:text-osso/40 focus:border-sol"
      : "border-ink/12 bg-white placeholder:text-ink/40 focus:border-lagoa"
  }`;

  if (zap) {
    return (
      <div className={`rounded-3xl p-6 ${escuro ? "bg-osso/5 text-osso" : "bg-white"}`}>
        <span className="grid h-12 w-12 place-items-center rounded-full bg-zap text-white">
          <Check />
        </span>
        <p className="font-display mt-4 text-3xl">Recebido!</p>
        <p className={`mt-2 text-[15px] ${escuro ? "text-osso/70" : "text-ink/65"}`}>
          Seu contato já está com o Willame. Se o WhatsApp não abriu sozinho, toque abaixo.
        </p>
        <a href={zap} target="_blank" rel="noopener" className="mt-5 inline-flex items-center gap-2 rounded-full bg-zap px-5 py-3 font-semibold text-white">
          <IconeWhatsapp className="h-4 w-4" /> Abrir WhatsApp
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      {!compacto && (
        <div className="flex gap-2">
          {["Morar", "Investir", "Os dois"].map((o) => (
            <button
              type="button"
              key={o}
              onClick={() => setObjetivo(o)}
              className={`flex-1 rounded-full border py-2.5 text-[13.5px] font-medium transition ${
                objetivo === o
                  ? escuro
                    ? "border-sol bg-sol text-ink"
                    : "border-ink bg-ink text-osso"
                  : escuro
                    ? "border-osso/20 text-osso/75"
                    : "border-ink/15 text-ink/70"
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      )}
      <input name="nome" required placeholder="Seu nome" className={campo} autoComplete="name" />
      <input name="telefone" required placeholder="WhatsApp com DDD" inputMode="tel" className={campo} autoComplete="tel" />
      {!compacto && <textarea name="mensagem" rows={3} placeholder="O que você procura? (opcional)" className={campo} />}
      {erro && <p className="text-[13.5px] text-coral">{erro}</p>}
      <button
        disabled={enviando}
        className={`group flex w-full items-center justify-between rounded-full py-2 pl-6 pr-2 text-[15px] font-semibold transition disabled:opacity-60 ${
          escuro ? "bg-sol text-ink hover:bg-osso" : "bg-ink text-osso hover:bg-lagoa"
        }`}
      >
        {enviando ? "Enviando…" : empreendimento ? "Quero receber a tabela" : "Quero ser atendido"}
        <span className={`grid h-10 w-10 place-items-center rounded-full transition group-hover:translate-x-0.5 ${escuro ? "bg-ink text-osso" : "bg-osso text-ink"}`}>
          <ArrowRight className="h-4 w-4" />
        </span>
      </button>
      <p className={`text-[11.5px] ${escuro ? "text-osso/45" : "text-ink/45"}`}>
        Ao enviar, você concorda em ser contatado pelo corretor. Sem spam.
      </p>
    </form>
  );
}
