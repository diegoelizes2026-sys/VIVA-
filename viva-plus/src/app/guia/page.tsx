import Link from "next/link";
import SeoShell from "@/components/seo-shell";
import { GUIDES } from "@/lib/guides";
import { breadcrumbLd, ldJson } from "@/lib/seo";

export const metadata = {
  title: { absolute: "Guias de dinheiro: organizar o salário, gastos e dívidas · VIVA+" },
  description: "Guias práticos e grátis para organizar o salário, controlar gastos pelo WhatsApp, dividir o dinheiro com a regra 50-30-20 e sair das dívidas.",
  alternates: { canonical: "/guia" },
};

export default function Page() {
  return <SeoShell kicker="Guias VIVA+" title="Guias para o dinheiro durar até o salário" lead="Conteúdo direto ao ponto, em português simples, para organizar o seu mês.">
    <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumbLd([{ name: "Início", path: "/" }, { name: "Guias", path: "/guia" }]))} />
    <section className="legal-sec">
      <h2><Link href="/quanto-posso-gastar-por-dia">Calculadora: quanto posso gastar por dia?</Link></h2>
      <p>Descubra seu limite diário até o próximo pagamento, grátis e sem cadastro.</p>
    </section>
    {GUIDES.map(g => <section key={g.slug} className="legal-sec">
      <h2><Link href={`/guia/${g.slug}`}>{g.h1}</Link></h2>
      <p>{g.description}</p>
    </section>)}
  </SeoShell>;
}
