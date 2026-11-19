"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeftRight, ChevronDown, Coins, House, MapPin, Search } from "lucide-react";

export const FAIXAS = [
  { id: "", nome: "Qualquer valor" },
  { id: "0-300000", nome: "Até R$ 300 mil" },
  { id: "300000-700000", nome: "R$ 300 a 700 mil" },
  { id: "700000-1500000", nome: "R$ 700 mil a 1,5 mi" },
  { id: "1500000-", nome: "Acima de R$ 1,5 mi" },
  { id: "aluguel-0-3000", nome: "Aluguel até R$ 3 mil" },
  { id: "aluguel-3000-", nome: "Aluguel acima de R$ 3 mil" },
];

export type Filtros = { tipo: string; finalidade: string; cidade: string; preco: string };

function Seletor({
  icone: Icone,
  rotulo,
  valor,
  onChange,
  opcoes,
}: {
  icone: React.ElementType;
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  opcoes: { id: string; nome: string }[];
}) {
  return (
    <label className="relative flex min-w-0 flex-1 items-center gap-3 px-4 py-3 lg:py-1">
      <Icone className="h-7 w-7 shrink-0 text-sol-2" strokeWidth={1.6} />
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-semibold text-ink/80">{rotulo}</span>
        <select
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className="w-full cursor-pointer appearance-none truncate bg-transparent pr-6 text-[15.5px] text-ink focus:outline-none"
        >
          {opcoes.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </select>
      </span>
      <ChevronDown className="pointer-events-none absolute right-4 h-5 w-5 text-ink/70" />
    </label>
  );
}

export function BuscaImoveis({
  tipos,
  cidades,
  inicial,
  onBuscar,
}: {
  tipos: string[];
  cidades: string[];
  inicial?: Partial<Filtros>;
  onBuscar?: (f: Filtros) => void;
}) {
  const router = useRouter();
  const [f, setF] = useState<Filtros>({ tipo: "", finalidade: "", cidade: "", preco: "", ...inicial });
  const set = (k: keyof Filtros) => (v: string) => {
    const novo = { ...f, [k]: v };
    setF(novo);
    onBuscar?.(novo);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (onBuscar) return onBuscar(f);
        const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
        router.push(`/empreendimentos${q.size ? `?${q}` : ""}#lista`);
      }}
      className="grid rounded-2xl bg-white p-2 shadow-[0_18px_50px_-15px_rgba(15,26,44,.35)] ring-1 ring-ink/5 max-lg:divide-y max-lg:divide-ink/10 lg:flex lg:items-center lg:divide-x lg:divide-ink/12"
    >
      <Seletor icone={House} rotulo="Tipo de imóvel" valor={f.tipo} onChange={set("tipo")} opcoes={[{ id: "", nome: "Todos" }, ...tipos.map((t) => ({ id: t, nome: t }))]} />
      <Seletor
        icone={ArrowLeftRight}
        rotulo="Finalidade"
        valor={f.finalidade}
        onChange={set("finalidade")}
        opcoes={[
          { id: "", nome: "Comprar, Alugar, ..." },
          { id: "Venda", nome: "Comprar" },
          { id: "Locação", nome: "Alugar" },
        ]}
      />
      <Seletor icone={MapPin} rotulo="Cidade" valor={f.cidade} onChange={set("cidade")} opcoes={[{ id: "", nome: "Selecione a cidade" }, ...cidades.map((c) => ({ id: c, nome: c }))]} />
      <Seletor icone={Coins} rotulo="Faixa de preço" valor={f.preco} onChange={set("preco")} opcoes={FAIXAS} />
      <div className="p-2 lg:pl-4">
        <button className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-gradient-to-b from-[#e7bd55] to-sol-2 px-7 py-3.5 text-[16px] font-bold text-ink transition hover:brightness-110 lg:w-auto">
          <Search className="h-5 w-5" /> Buscar Imóveis
        </button>
      </div>
    </form>
  );
}
