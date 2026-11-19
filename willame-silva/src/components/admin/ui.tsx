"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { enviarArquivo } from "./api";
import type { Temperatura } from "@/lib/types";

export function Campo({
  label,
  dica,
  children,
  className = "",
}: {
  label: string;
  dica?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[12.5px] font-semibold text-ink/70">{label}</span>
      {children}
      {dica && <span className="mt-1 block text-[11.5px] text-ink/45">{dica}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-ink/12 bg-white px-3.5 py-2.5 text-[14.5px] transition focus:border-lagoa focus:outline-none focus:ring-4 focus:ring-lagoa/10";

export function Toggle({ ligado, onChange, label }: { ligado: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!ligado)} className="flex items-center gap-3 text-[14px] font-medium">
      <span className={`relative h-6 w-11 rounded-full transition ${ligado ? "bg-lagoa" : "bg-ink/20"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${ligado ? "left-[22px]" : "left-0.5"}`} />
      </span>
      {label}
    </button>
  );
}

export function Botao({
  children,
  variante = "escuro",
  className = "",
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "escuro" | "claro" | "perigo" | "zap" }) {
  const v = {
    escuro: "bg-ink text-osso hover:bg-lagoa",
    claro: "border border-ink/15 bg-white text-ink hover:border-ink",
    perigo: "border border-coral/30 bg-white text-coral hover:bg-coral hover:text-white",
    zap: "bg-zap text-white hover:brightness-110",
  }[variante];
  return (
    <button
      {...p}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[13.5px] font-semibold transition disabled:opacity-50 ${v} ${className}`}
    >
      {children}
    </button>
  );
}

export function SeletorImagem({ valor, onChange, rotulo = "Imagem" }: { valor: string; onChange: (v: string) => void; rotulo?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  return (
    <div>
      <span className="mb-1.5 block text-[12.5px] font-semibold text-ink/70">{rotulo}</span>
      <div className="flex gap-3">
        <div className="foto-fallback relative h-20 w-28 shrink-0 overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {valor && <img src={valor} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="flex-1 space-y-2">
          <input className={inputCls} value={valor} onChange={(e) => onChange(e.target.value)} placeholder="Cole o link da imagem ou envie um arquivo" />
          <button
            type="button"
            onClick={() => ref.current?.click()}
            className="inline-flex items-center gap-2 text-[13px] font-semibold text-lagoa hover:underline"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Enviar do computador/celular
          </button>
          {erro && <p className="text-[12px] text-coral">{erro}</p>}
          <input
            ref={ref}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setEnviando(true);
              setErro("");
              try {
                onChange(await enviarArquivo(f));
              } catch (err) {
                setErro(err instanceof Error ? err.message : "Falha");
              } finally {
                setEnviando(false);
                e.target.value = "";
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function ListaImagens({ valor, onChange }: { valor: string[]; onChange: (v: string[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [novo, setNovo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const mover = (i: number, d: number) => {
    const a = [...valor];
    const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    onChange(a);
  };
  return (
    <div>
      <span className="mb-1.5 block text-[12.5px] font-semibold text-ink/70">Galeria de fotos ({valor.length})</span>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {valor.map((src, i) => (
          <div key={src + i} className="foto-fallback group relative aspect-square overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-0 transition group-hover:opacity-100">
              <span className="flex gap-1">
                <button type="button" onClick={() => mover(i, -1)} className="grid h-7 w-7 place-items-center rounded-full bg-white/90"><ArrowUp className="h-3.5 w-3.5 -rotate-90" /></button>
                <button type="button" onClick={() => mover(i, 1)} className="grid h-7 w-7 place-items-center rounded-full bg-white/90"><ArrowDown className="h-3.5 w-3.5 -rotate-90" /></button>
              </span>
              <button type="button" onClick={() => onChange(valor.filter((_, k) => k !== i))} className="grid h-7 w-7 place-items-center rounded-full bg-coral text-white">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {i === 0 && <span className="absolute left-1 top-1 rounded-full bg-sol px-2 py-0.5 text-[10px] font-bold">1ª</span>}
          </div>
        ))}
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-ink/15 text-ink/50 hover:border-lagoa hover:text-lagoa"
        >
          {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
        </button>
      </div>
      <div className="mt-2 flex gap-2">
        <input className={inputCls} value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="…ou cole o link de uma foto" />
        <Botao
          type="button"
          variante="claro"
          onClick={() => {
            if (novo.trim()) onChange([...valor, novo.trim()]);
            setNovo("");
          }}
        >
          Adicionar
        </Botao>
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          if (!files.length) return;
          setEnviando(true);
          const urls: string[] = [];
          for (const f of files) {
            try {
              urls.push(await enviarArquivo(f));
            } catch (err) {
              alert(err instanceof Error ? err.message : "Falha no envio");
              break;
            }
          }
          onChange([...valor, ...urls]);
          setEnviando(false);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function PontoTemperatura({ t, comTexto = false }: { t: Temperatura; comTexto?: boolean }) {
  const cor = { quente: "bg-coral", morno: "bg-sol", frio: "bg-espuma" }[t] ?? "bg-espuma";
  const nome = { quente: "Quente", morno: "Morno", frio: "Frio" }[t] ?? t;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold">
      <span className={`h-2.5 w-2.5 rounded-full ${cor} ${t === "quente" ? "shadow-[0_0_0_3px_rgba(226,100,60,.2)]" : ""}`} />
      {comTexto && nome}
    </span>
  );
}

export function Vazio({ titulo, texto, children }: { titulo: string; texto: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-ink/15 bg-white/50 px-6 py-16 text-center">
      <p className="font-display text-3xl">{titulo}</p>
      <p className="mx-auto mt-2 max-w-md text-[14.5px] text-ink/55">{texto}</p>
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}
