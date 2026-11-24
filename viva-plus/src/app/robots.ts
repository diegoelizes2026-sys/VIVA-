import type { MetadataRoute } from "next";

// Regras para o Google: páginas públicas liberadas; área logada, API e telas internas fora da busca.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/meu-dia", "/assistente", "/financas", "/agenda", "/contas", "/planejamento", "/relatorio", "/perfil", "/configuracoes", "/creditos", "/indique", "/meus-dados", "/saude", "/perto", "/economizar", "/lista-de-compras", "/planos", "/assinar", "/boas-vindas", "/aceite-termos", "/alterar-senha", "/conta-suspensa", "/auth/", "/whatsapp/"],
    }],
    sitemap: "https://www.vivamaiss.app.br/sitemap.xml",
    host: "https://www.vivamaiss.app.br",
  };
}
