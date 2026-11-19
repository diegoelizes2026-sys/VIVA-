"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, MapPin } from "lucide-react";
import type { Empreendimento } from "@/lib/types";
import { corStatus, moeda } from "@/lib/format";

const FILTROS = [
  { id: "todos", nome: "Todos", f: () => true },
  { id: "lanc", nome: "Lançamentos", f: (e: Empreendimento) => /lançamento/i.test(e.status) },
  { id: "obras", nome: "Em obras", f: (e: Empreendimento) => e.status === "Em obras" },
  { id: "prontos", nome: "Prontos", f: (e: Empreendimento) => /pronto|últimas/i.test(e.status) },
  { id: "vendidos", nome: "Cases vendidos", f: (e: Empreendimento) => e.status === "100% vendido" },
];

export function CardEmpreendimento({ e, grande = false, n }: { e: Empreendimento; grande?: boolean; n?: number }) {
  const local = [e.bairro, e.cidade].filter(Boolean).join(" · ");
  return (
    <Link href={`/empreendimentos/${e.slug}`} className="group block">
      <div className={`foto-fallback relative overflow-hidden rounded-[22px] ${grande ? "aspect-[4/5] lg:aspect-[16/12]" : "aspect-[4/5]"}`}>
        {e.capa && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={e.capa}
            alt={e.nome}
            loading="lazy"
            onError={(ev) => (ev.currentTarget.style.display = "none")}
            className={`h-full w-full object-cover transition duration-[1200ms] ease-out group-hover:scale-[1.06] ${e.status === "100% vendido" ? "saturate-[.7]" : ""}`}
          />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,31,30,.25),transparent_30%,transparent_55%,rgba(11,31,30,.85))]" />
        <div className="absolute left-4 right-4 top-4 flex items-start justify-between">
          <span className={`rounded-full px-3 py-1.5 text-[11.5px] font-bold uppercase tracking-wider ${corStatus(e.status)}`}>{e.status}</span>
          {n != null && <span className="font-display text-sm italic text-osso/80">nº {String(n).padStart(2, "0")}</span>}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5 text-osso sm:p-6">
          <p className="rotulo mb-2 text-osso/70">{e.tipo}</p>
          <h3 className={`font-display font-light leading-[0.95] ${grande ? "text-5xl sm:text-6xl" : "text-4xl"}`}>{e.nome}</h3>
          {e.chamada && <p className={`mt-3 max-w-md text-[14.5px] leading-snug text-osso/80 ${grande ? "" : "line-clamp-2"}`}>{e.chamada}</p>}
        </div>
        <span className="absolute bottom-5 right-5 grid h-12 w-12 translate-y-2 place-items-center rounded-full bg-osso text-ink opacity-0 transition duration-500 group-hover:translate-y-0 group-hover:opacity-100">
          <ArrowUpRight className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 px-1 text-[13.5px]">
        <span className="flex min-w-0 items-center gap-1.5 text-ink/60">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{local || "Ceará"}</span>
        </span>
        <span className="shrink-0 font-semibold">
          {e.status === "100% vendido" ? "Esgotado" : e.preco_a_partir ? `a partir de ${moeda(e.preco_a_partir)}` : "Valores sob consulta"}
        </span>
      </div>
    </Link>
  );
}

export function Vitrine({ empreendimentos }: { empreendimentos: Empreendimento[] }) {
  const [filtro, setFiltro] = useState("todos");
  const lista = useMemo(() => {
    const f = FILTROS.find((x) => x.id === filtro)!.f;
    return empreendimentos.filter(f);
  }, [filtro, empreendimentos]);

  const contagem = (id: string) => empreendimentos.filter(FILTROS.find((x) => x.id === id)!.f).length;
  const [primeiro, ...resto] = lista;

  return (
    <div>
      <div className="sem-barra -mx-4 mb-10 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {FILTROS.map((f) => {
          const c = contagem(f.id);
          if (!c && f.id !== "todos") return null;
          return (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-5 py-2.5 text-[14px] font-medium transition ${
                filtro === f.id ? "border-ink bg-ink text-osso" : "border-ink/15 hover:border-ink"
              }`}
            >
              {f.nome}
              <sup className={`text-[10px] ${filtro === f.id ? "text-sol" : "text-ink/45"}`}>{c}</sup>
            </button>
          );
        })}
      </div>

      {!lista.length && <p className="py-16 text-center text-ink/55">Nenhum empreendimento nesta categoria no momento.</p>}

      {primeiro && (
        <div className="grid gap-x-6 gap-y-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <CardEmpreendimento e={primeiro} grande n={1} />
          </div>
          <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
            {resto.slice(0, 1).map((e) => (
              <CardEmpreendimento key={e.id} e={e} n={2} />
            ))}
          </div>
          {resto.slice(1).map((e, k, arr) => (
            <div key={e.id} className={arr.length % 3 === 2 && k >= arr.length - 2 ? "lg:col-span-6" : arr.length % 3 === 1 && k === arr.length - 1 ? "lg:col-span-12" : "lg:col-span-4"}>
              <CardEmpreendimento e={e} n={k + 3} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
