import type { Metadata } from "next";
import Link from "next/link";
import DailyCalculator from "@/components/daily-calculator";
import SeoShell from "@/components/seo-shell";
import { SITE_URL, breadcrumbLd, faqLd, ldJson } from "@/lib/seo";

const PATH = "/quanto-posso-gastar-por-dia";
const TITLE = "Quanto posso gastar por dia? Calculadora grátis até o salário";
const DESCRIPTION = "Calculadora grátis: descubra quanto você pode gastar por dia sem faltar dinheiro até o próximo salário. Desconta as contas, separa o que quer guardar e mostra o valor por dia e por semana.";

export const metadata: Metadata = {
  title: { absolute: TITLE + " · VIVA+" },
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { title: TITLE, description: DESCRIPTION, url: PATH, type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const faq = [
  { q: "Como calcular quanto posso gastar por dia?", a: "Pegue o dinheiro que você tem hoje, tire as contas que ainda vão vencer até o próximo pagamento e o valor que quer guardar. Divida o que sobrar pelo número de dias até o salário cair. O resultado é quanto você pode gastar por dia." },
  { q: "O que entra nas contas que ainda vencem?", a: "Tudo o que tem data para pagar antes do próximo salário: aluguel, luz, água, internet, fatura do cartão, parcelas, escola e mensalidades." },
  { q: "E se o resultado der negativo?", a: "Quer dizer que o dinheiro de hoje não cobre as contas até o pagamento. O primeiro passo é cortar o que não é essencial e ver quais contas dá para negociar, parcelar sem juros ou mudar a data de vencimento." },
  { q: "Preciso refazer a conta todo dia?", a: "O ideal é sim, porque cada gasto muda o valor dos próximos dias. A VIVA+ faz isso sozinha: você anota o gasto pelo WhatsApp e ela recalcula o seu número do dia." },
];

export default function Page() {
  const ld = [
    { "@context": "https://schema.org", "@type": "WebApplication", name: "Calculadora: quanto posso gastar por dia", url: SITE_URL + PATH, applicationCategory: "FinanceApplication", operatingSystem: "Web", inLanguage: "pt-BR", isAccessibleForFree: true, offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" }, publisher: { "@id": SITE_URL + "/#org" } },
    faqLd(faq),
    breadcrumbLd([{ name: "Início", path: "/" }, { name: "Quanto posso gastar por dia", path: PATH }]),
  ];
  return <SeoShell kicker="Calculadora grátis" title="Quanto posso gastar por dia até o salário?" lead="Coloque quanto você tem hoje, as contas que ainda vão vencer e o dia em que recebe. A conta é feita na hora, aqui mesmo, sem cadastro.">
    <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(ld)} />
    <DailyCalculator />

    <section className="legal-sec">
      <h2>Como a conta é feita</h2>
      <p><b>Valor por dia = (dinheiro de hoje − contas até o pagamento − quanto quer guardar) ÷ dias até o pagamento.</b></p>
      <p>Exemplo: você tem R$ 1.200, ainda vai pagar R$ 450 de contas, quer guardar R$ 100 e faltam 13 dias para o salário. Sobram R$ 650, que divididos por 13 dão <b>R$ 50 por dia</b>. Se num dia você gasta só R$ 30, os R$ 20 que sobraram engordam os próximos dias.</p>
    </section>
    <section className="legal-sec">
      <h2>Por que pensar em valor por dia funciona</h2>
      <p>Olhar o saldo da conta engana: no começo do mês parece que tem muito dinheiro e no fim falta. Um número por dia é fácil de lembrar na hora de decidir um lanche, uma corrida de aplicativo ou uma compra por impulso. É a forma mais simples de fazer o salário durar até o próximo pagamento.</p>
      <p>Quer aprofundar? Leia <Link href="/guia/como-fazer-o-salario-durar-o-mes-todo">como fazer o salário durar o mês todo</Link> e <Link href="/guia/como-dividir-o-salario-regra-50-30-20">como dividir o salário com a regra 50-30-20</Link>.</p>
    </section>
    <section className="legal-sec">
      <h2>Perguntas frequentes</h2>
      {faq.map(f => <div key={f.q}><h3 className="seo-h3">{f.q}</h3><p>{f.a}</p></div>)}
    </section>
  </SeoShell>;
}
