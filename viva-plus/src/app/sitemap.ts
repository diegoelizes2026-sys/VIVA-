import type { MetadataRoute } from "next";
import { GUIDES } from "@/lib/guides";
import { SITE_URL } from "@/lib/seo";

// Mapa do site para o Google (só páginas públicas).
export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE_URL;
  const now = new Date();
  const legal = new Date("2026-11-24");
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/quanto-posso-gastar-por-dia`, lastModified: new Date("2026-11-28"), changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/guia`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    ...GUIDES.map(g => ({ url: `${base}/guia/${g.slug}`, lastModified: new Date(g.updated), changeFrequency: "monthly" as const, priority: 0.7 })),
    { url: `${base}/diagnostico`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/cadastro`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/parceiros`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/academias`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/termos`, lastModified: legal, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/privacidade`, lastModified: legal, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/reembolso`, lastModified: legal, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/cookies`, lastModified: legal, changeFrequency: "yearly", priority: 0.1 },
  ];
}
