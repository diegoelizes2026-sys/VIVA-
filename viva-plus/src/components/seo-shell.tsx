import Link from "next/link";
import { companyLine } from "@/lib/legal";

const LINKS = [
  { href: "/quanto-posso-gastar-por-dia", label: "Calculadora do dia" },
  { href: "/guia", label: "Guias de dinheiro" },
  { href: "/diagnostico", label: "Diagnóstico grátis" },
];

/** Moldura das páginas públicas de conteúdo (calculadora e guias): bom para o Google e com chamada para o cadastro. */
export default function SeoShell({ kicker, title, lead, meta, children }: { kicker: string; title: string; lead?: string; meta?: string; children: React.ReactNode }) {
  return <main id="conteudo" className="legal-page">
    <article className="legal-doc seo-doc">
      <nav className="seo-top" aria-label="Navegação">
        <Link href="/" className="lp-logo">VIVA<span>+</span></Link>
        <Link href="/cadastro" className="lp-btn sm">Criar conta grátis</Link>
      </nav>
      <header>
        <p className="legal-kicker">{kicker}</p>
        <h1>{title}</h1>
        {meta && <p className="legal-meta">{meta}</p>}
        {lead && <p className="seo-lead">{lead}</p>}
      </header>
      {children}
      <aside className="seo-cta">
        <p><b>Chega de o mês acabar antes do salário.</b> Todo dia a VIVA+ te diz pelo WhatsApp quanto você pode gastar. Anote gastos por mensagem, áudio ou foto. Começar é grátis.</p>
        <Link href="/cadastro" className="lp-btn">Começar grátis</Link>
      </aside>
      <footer className="legal-foot">
        <nav className="legal-nav" aria-label="Mais conteúdo">{LINKS.map(l => <Link key={l.href} href={l.href}>{l.label}</Link>)}<Link href="/">Conheça a VIVA+</Link></nav>
        <p>{companyLine()}</p>
        <p>Conteúdo educativo. Não substitui a orientação de um profissional de finanças.</p>
      </footer>
    </article>
  </main>;
}
