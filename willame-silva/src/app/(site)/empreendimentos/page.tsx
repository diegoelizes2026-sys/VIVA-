import type { Metadata } from "next";
import { Cabecalho } from "@/components/cabecalho";
import { Vitrine } from "@/components/vitrine";
import { lerConfig, listarEmpreendimentos } from "@/lib/db";

export const metadata: Metadata = { title: "Empreendimentos" };

export default async function Pagina() {
  const [cfg, emps] = await Promise.all([lerConfig(), listarEmpreendimentos()]);
  return (
    <main>
      <Cabecalho whatsapp={cfg.whatsapp} creci={cfg.creci} sobreFoto={false} />
      <section className="mx-auto max-w-[1400px] px-4 pb-28 pt-40 sm:px-8">
        <p className="rotulo mb-5 text-lagoa-2">Portfólio</p>
        <h1 className="font-display mb-14 max-w-4xl text-[clamp(44px,6.5vw,96px)] font-light leading-[0.95]">
          Todos os <em className="text-lagoa-2">empreendimentos</em>
        </h1>
        <Vitrine empreendimentos={emps} />
      </section>
    </main>
  );
}
