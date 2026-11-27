import type { MetadataRoute } from "next";

// Mapa do site para o Google (só páginas públicas).
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.vivamaiss.app.br";
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/cadastro`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/parceiros`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/academias`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/diagnostico`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/termos`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/privacidade`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/reembolso`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/cookies`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
