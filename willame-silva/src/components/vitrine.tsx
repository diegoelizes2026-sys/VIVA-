"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bath, BedDouble, Car, Heart, MapPin, Maximize2 } from "lucide-react";
import type { Empreendimento } from "@/lib/types";
import { moeda } from "@/lib/format";
import { BuscaImoveis, type Filtros } from "./busca-imoveis";

export const ehLocacao = (e: Empreendimento) => /loca/i.test(e.finalidade || "") && !/venda/i.test(e.finalidade || "");

function Favorito({ id }: { id: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    try {
      setOn((JSON.parse(localStorage.getItem("favoritos") || "[]") as string[]).includes(id));
    } catch {}
  }, [id]);
  return (
    <button
      type="button"
      aria-label={on ? "Remover dos favoritos" : "Favoritar"}
      onClick={(ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        try {
          const l = new Set(JSON.parse(localStorage.getItem("favoritos") || "[]") as string[]);
          if (l.has(id)) l.delete(id);
          else l.add(id);
          localStorage.setItem("favoritos", JSON.stringify([...l]));
        } catch {}
        setOn((v) => !v);
      }}
      className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full text-white drop-shadow-[0_1px_3px_rgba(0,0,0,.6)] transition hover:scale-110"
    >
      <Heart className={`h-7 w-7 ${on ? "fill-coral text-coral" : ""}`} strokeWidth={1.8} />
    </button>
  );
}

export function precoTexto(e: Empreendimento) {
  if (e.status === "100% vendido") return { v: "Vendido", s: "" };
  if (!e.preco_a_partir) return { v: "Sob consulta", s: "" };
  return { v: moeda(e.preco_a_partir), s: ehLocacao(e) ? "/mês" : "" };
}

export function CardEmpreendimento({ e }: { e: Empreendimento; grande?: boolean; n?: number }) {
  const local = [e.bairro, e.cidade].filter(Boolean).join(", ");
  const loc = ehLocacao(e);
  const p = precoTexto(e);
  const area = e.area_min ? `${e.area_min}${e.area_max && e.area_max !== e.area_min ? `–${e.area_max}` : ""} m²` : "";
  const specs = [
    e.quartos && { i: BedDouble, t: /^\d+$/.test(e.quartos) ? `${e.quartos} quarto${e.quartos === "1" ? "" : "s"}` : e.quartos },
    e.banheiros && { i: Bath, t: /^\d+$/.test(e.banheiros) ? `${e.banheiros} banheiro${e.banheiros === "1" ? "" : "s"}` : e.banheiros },
    e.vagas && { i: Car, t: /^\d+$/.test(e.vagas) ? `${e.vagas} vaga${e.vagas === "1" ? "" : "s"}` : e.vagas },
    area && { i: Maximize2, t: area },
  ].filter(Boolean) as { i: React.ElementType; t: string }[];

  return (
    <Link
      href={`/empreendimentos/${e.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-ink/10 bg-white shadow-[0_6px_24px_-12px_rgba(15,26,44,.25)] transition hover:-translate-y-1 hover:shadow-[0_18px_40px_-16px_rgba(15,26,44,.35)]"
    >
      <div className="foto-fallback relative aspect-[16/9] overflow-hidden">
        {e.capa && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={e.capa}
            alt={e.nome}
            loading="lazy"
            onError={(ev) => (ev.currentTarget.style.display = "none")}
            className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          />
        )}
        <span
          className={`absolute left-4 top-3 rounded-md px-3.5 py-1.5 text-[14px] font-bold shadow ${
            loc ? "bg-ink text-white" : "bg-gradient-to-b from-[#e7bd55] to-sol-2 text-white"
          }`}
        >
          {loc ? "Locação" : e.finalidade === "Venda e locação" ? "Venda · Locação" : "Venda"}
        </span>
        {e.status && e.status !== "Pronto para morar" && (
          <span className={`absolute bottom-3 left-4 rounded-md px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wide ${e.status === "100% vendido" ? "bg-coral text-white" : "bg-white/95 text-ink"}`}>
            {e.status}
          </span>
        )}
        <Favorito id={e.id} />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-[19px] font-bold leading-tight text-ink">{e.nome}</h3>
        <p className="mt-1.5 flex items-center gap-1.5 text-[14.5px] text-ink/75">
          <MapPin className="h-4 w-4 shrink-0" /> <span className="truncate">{local || "Ceará"}</span>
        </p>
        {specs.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-ink/75">
            {specs.map((s, k) => (
              <span key={k} className={`flex items-center gap-1.5 ${k > 0 ? "border-l border-ink/15 pl-3" : ""}`}>
                <s.i className="h-4 w-4" strokeWidth={1.6} /> {s.t}
              </span>
            ))}
          </div>
        )}
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <p className="font-display text-[22px] font-bold leading-none text-sol-2">
            {p.v}
            {p.s && <span className="ml-1 text-[14px] font-semibold text-ink/70">{p.s}</span>}
          </p>
          <span className="shrink-0 rounded-md border-2 border-sol px-4 py-1.5 text-[13.5px] font-semibold text-ink transition group-hover:bg-sol">
            Ver Detalhes
          </span>
        </div>
      </div>
    </Link>
  );
}

export function filtrar(lista: Empreendimento[], f: Partial<Filtros>) {
  return lista.filter((e) => {
    if (f.tipo && e.tipo !== f.tipo) return false;
    if (f.cidade && e.cidade !== f.cidade) return false;
    if (f.finalidade === "Venda" && ehLocacao(e)) return false;
    if (f.finalidade === "Locação" && !/loca/i.test(e.finalidade || "")) return false;
    if (f.preco) {
      const aluguel = f.preco.startsWith("aluguel-");
      const [min, max] = f.preco.replace("aluguel-", "").split("-").map((x) => (x ? Number(x) : null));
      if (aluguel !== ehLocacao(e)) return false;
      if (e.preco_a_partir == null) return false;
      if (min != null && e.preco_a_partir < min) return false;
      if (max != null && e.preco_a_partir > max) return false;
    }
    return true;
  });
}

export function Vitrine({ empreendimentos, inicial }: { empreendimentos: Empreendimento[]; inicial?: Partial<Filtros> }) {
  const [f, setF] = useState<Partial<Filtros>>(inicial ?? {});
  const lista = useMemo(() => filtrar(empreendimentos, f), [empreendimentos, f]);
  const tipos = [...new Set(empreendimentos.map((e) => e.tipo).filter(Boolean))];
  const cidades = [...new Set(empreendimentos.map((e) => e.cidade).filter(Boolean))];

  return (
    <div>
      <BuscaImoveis tipos={tipos} cidades={cidades} inicial={inicial} onBuscar={setF} />
      <p className="mb-6 mt-8 text-[14.5px] text-ink/60">
        {lista.length} {lista.length === 1 ? "imóvel encontrado" : "imóveis encontrados"}
      </p>
      {lista.length ? (
        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((e) => (
            <CardEmpreendimento key={e.id} e={e} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-ink/20 bg-white px-6 py-16 text-center">
          <p className="font-display text-xl font-bold">Nenhum imóvel com esses filtros agora</p>
          <p className="mt-2 text-ink/60">Fale com o Agente 24h: ele avisa o corretor do que você procura.</p>
        </div>
      )}
    </div>
  );
}
