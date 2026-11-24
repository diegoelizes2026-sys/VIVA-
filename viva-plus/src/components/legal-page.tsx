import Link from "next/link";
import { COMPANY, LEGAL_LINKS, LEGAL_UPDATED_AT, companyLine } from "@/lib/legal";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP_DISPLAY, supportEmailUrl, supportWhatsAppUrl } from "@/lib/support";

/** Moldura comum das páginas legais: título, versão, índice, conteúdo e dados da empresa. */
export default function LegalPage({ title, version, current, children }: { title: string; version?: string; current: string; children: React.ReactNode }) {
  return <main id="conteudo" className="legal-page">
    <article className="legal-doc">
      <Link href="/" className="legal-back">← Voltar ao início</Link>
      <header>
        <p className="legal-kicker">{COMPANY.product}</p>
        <h1>{title}</h1>
        <p className="legal-meta">Atualizado em {LEGAL_UPDATED_AT}{version ? ` · Versão ${version}` : ""}</p>
      </header>
      <nav className="legal-nav" aria-label="Documentos legais">
        {LEGAL_LINKS.map(l => <Link key={l.href} href={l.href} aria-current={l.href === current ? "page" : undefined}>{l.label}</Link>)}
      </nav>
      {children}
      <footer className="legal-foot">
        <p>{companyLine()}</p>
        <p>Atendimento: <a href={supportEmailUrl()}>{SUPPORT_EMAIL}</a> · WhatsApp <a href={supportWhatsAppUrl()} target="_blank" rel="noopener noreferrer">{SUPPORT_WHATSAPP_DISPLAY}</a></p>
      </footer>
    </article>
  </main>;
}

export function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return <section id={id} className="legal-sec"><h2>{title}</h2>{children}</section>;
}
