import type { Metadata } from "next";
import { Cabecalho } from "@/components/cabecalho";
import { Vitrine } from "@/components/vitrine";
import { lerConfig, listarEmpreendimentos } from "@/lib/db";

export const metadata: Metadata = { title: "Imóveis" };

type P = { searchParams: Promise<Record<string, string | undefined>> };

export default async function Pagina({ searchParams }: P) {
  const sp = await searchParams;
  const [cfg, emps] = await Promise.all([lerConfig(), listarEmpreendimentos()]);
  return (
    <main className="bg-osso">
      <Cabecalho whatsapp={cfg.whatsapp} creci={cfg.creci} />
      <section className="bg-ink pb-24 pt-[140px] text-white">
        <div className="mx-auto max-w-[1320px] px-4 sm:px-8">
          <p className="font-display text-[14px] font-bold uppercase tracking-[0.16em] text-sol">Portfólio</p>
          <h1 className="font-display mt-2 text-[clamp(32px,4.4vw,52px)] font-extrabold leading-tight">
            Encontre o seu <span className="text-sol">imóvel ideal</span>
          </h1>
          <p className="mt-3 max-w-xl text-[16.5px] text-white/80">Casas, apartamentos, terrenos e lançamentos para comprar ou alugar.</p>
        </div>
      </section>
      <section id="lista" className="mx-auto -mt-14 max-w-[1320px] px-4 pb-24 sm:px-8">
        <Vitrine
          empreendimentos={emps}
          inicial={{ tipo: sp.tipo ?? "", finalidade: sp.finalidade ?? "", cidade: sp.cidade ?? "", preco: sp.preco ?? "" }}
        />
      </section>
    </main>
  );
}
