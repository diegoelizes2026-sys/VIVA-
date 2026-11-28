import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SeoShell from "@/components/seo-shell";
import { GUIDES, guideBySlug } from "@/lib/guides";
import { SITE_URL, breadcrumbLd, faqLd, ldJson } from "@/lib/seo";

export const dynamicParams = false;
export function generateStaticParams() { return GUIDES.map(g => ({ slug: g.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const g = guideBySlug((await params).slug);
  if (!g) return {};
  const path = `/guia/${g.slug}`;
  return {
    title: { absolute: `${g.title} · VIVA+` },
    description: g.description,
    keywords: g.keywords,
    alternates: { canonical: path },
    openGraph: { type: "article", title: g.title, description: g.description, url: path, publishedTime: g.published, modifiedTime: g.updated },
    twitter: { card: "summary_large_image", title: g.title, description: g.description },
  };
}

const date = (iso: string) => iso.split("-").reverse().join("/");

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const g = guideBySlug((await params).slug);
  if (!g) notFound();
  const path = `/guia/${g.slug}`;
  const ld = [
    { "@context": "https://schema.org", "@type": "Article", headline: g.h1, description: g.description, inLanguage: "pt-BR", datePublished: g.published, dateModified: g.updated, mainEntityOfPage: SITE_URL + path, image: SITE_URL + "/opengraph-image", author: { "@id": SITE_URL + "/#org" }, publisher: { "@id": SITE_URL + "/#org" } },
    faqLd(g.faq),
    breadcrumbLd([{ name: "Início", path: "/" }, { name: "Guias", path: "/guia" }, { name: g.h1, path }]),
  ];
  const others = GUIDES.filter(o => o.slug !== g.slug);
  return <SeoShell kicker="Guia VIVA+" title={g.h1} lead={g.lead} meta={`Atualizado em ${date(g.updated)}`}>
    <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(ld)} />
    {g.sections.map(s => <section key={s.h} className="legal-sec">
      <h2>{s.h}</h2>
      {s.p?.map((t, i) => <p key={i}>{t}</p>)}
      {s.list && <ul>{s.list.map(t => <li key={t}>{t}</li>)}</ul>}
    </section>)}
    <section className="legal-sec">
      <h2>Faça a conta agora</h2>
      <p>Descubra em segundos <Link href="/quanto-posso-gastar-por-dia">quanto você pode gastar por dia até o salário</Link> com a nossa calculadora grátis.</p>
    </section>
    <section className="legal-sec">
      <h2>Perguntas frequentes</h2>
      {g.faq.map(f => <div key={f.q}><h3 className="seo-h3">{f.q}</h3><p>{f.a}</p></div>)}
    </section>
    <section className="legal-sec">
      <h2>Leia também</h2>
      <ul>{others.map(o => <li key={o.slug}><Link href={`/guia/${o.slug}`}>{o.h1}</Link></li>)}</ul>
    </section>
  </SeoShell>;
}
