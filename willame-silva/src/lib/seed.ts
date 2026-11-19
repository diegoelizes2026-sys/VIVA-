import type { Configuracoes, Empreendimento, Slide } from "./types";

// Fotos de demonstração (troque pelas fotos oficiais no painel /admin).
const u = (id: string, w = 1800) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const agora = new Date().toISOString();

function emp(p: Partial<Empreendimento> & Pick<Empreendimento, "nome" | "slug">): Empreendimento {
  return {
    id: p.slug,
    chamada: "",
    descricao: "",
    cidade: "",
    bairro: "",
    tipo: "Lotes",
    status: "Lançamento",
    preco_a_partir: null,
    area_min: null,
    area_max: null,
    quartos: "",
    banheiros: "",
    vagas: "",
    finalidade: "Venda",
    diferenciais: [],
    capa: "",
    imagens: [],
    video_url: "",
    endereco_mapa: "",
    construtora: "",
    destaque: false,
    publicado: true,
    ordem: 0,
    created_at: agora,
    updated_at: agora,
    ...p,
  };
}

export const SEED_EMPREENDIMENTOS: Empreendimento[] = [
  emp({
    slug: "lagoar",
    nome: "Lagoar",
    chamada: "A vida à beira da lagoa, com alma de resort.",
    descricao:
      "Um empreendimento pensado para quem quer acordar com a lagoa na janela. Lazer de resort, natureza preservada e uma comunidade planejada para viver o fim de semana todos os dias. Fale com o Willame para receber o material completo, a tabela atualizada e as condições de lançamento.",
    cidade: "Ceará",
    bairro: "Beira-lagoa",
    tipo: "Resort / Segunda moradia",
    status: "Lançamento",
    diferenciais: [
      "Frente para a lagoa",
      "Lazer completo estilo resort",
      "Piscinas com borda infinita",
      "Área verde preservada",
      "Segurança 24h",
      "Ideal para morar ou investir",
    ],
    capa: u("photo-1571896349842-33c89424de2d"),
    imagens: [
      u("photo-1571896349842-33c89424de2d"),
      u("photo-1520250497591-112f2f40a3f4"),
      u("photo-1566073771259-6a8506099945"),
      u("photo-1582268611958-ebfd161ef9cf"),
    ],
    endereco_mapa: "Ceará, Brasil",
    destaque: true,
    ordem: 1,
  }),
  emp({
    slug: "moradas",
    nome: "Moradas",
    chamada: "Seu lote em um bairro que já nasce completo.",
    descricao:
      "Lotes em condomínio com infraestrutura completa, áreas de convivência e um projeto urbanístico feito para famílias. Uma escolha segura para construir a casa dos sonhos ou ver o seu patrimônio valorizar.",
    cidade: "Ceará",
    bairro: "",
    tipo: "Lotes",
    status: "Em obras",
    diferenciais: [
      "Infraestrutura completa",
      "Clube e áreas de lazer",
      "Portaria e controle de acesso",
      "Parcelamento facilitado",
    ],
    capa: u("photo-1600596542815-ffad4c1539a9"),
    imagens: [
      u("photo-1600596542815-ffad4c1539a9"),
      u("photo-1564013799919-ab600027ffc6"),
      u("photo-1600585154340-be6161a56a0c"),
    ],
    endereco_mapa: "Ceará, Brasil",
    destaque: true,
    ordem: 2,
  }),
  emp({
    slug: "terra-brasilis",
    nome: "Terra Brasilis",
    chamada: "Urbanismo que vende rápido porque é bem feito.",
    descricao:
      "Bairro planejado com ruas largas, verde por toda parte e localização estratégica na Região Metropolitana de Fortaleza. Etapas anteriores esgotaram em poucos dias — entre na lista de prioridade para as próximas fases.",
    cidade: "Caucaia · CE",
    bairro: "",
    tipo: "Bairro planejado",
    status: "100% vendido",
    construtora: "Terra Brasilis Urbanismo",
    diferenciais: [
      "Bairro planejado",
      "Áreas verdes e praças",
      "Ótima valorização",
      "Lista de prioridade para novas fases",
    ],
    capa: u("photo-1500382017468-9049fed747ef"),
    imagens: [u("photo-1500382017468-9049fed747ef"), u("photo-1449844908441-8829872d2607")],
    endereco_mapa: "Caucaia, Ceará",
    ordem: 3,
  }),
  emp({
    slug: "eco-residencial",
    nome: "Eco Residencial",
    chamada: "Eco-friendly de verdade: natureza, família e tempo livre.",
    descricao:
      "Casas em condomínio com conceito sustentável, trilhas, pomar e espaços para as crianças crescerem ao ar livre.",
    cidade: "Ceará",
    tipo: "Casas em condomínio",
    status: "Pré-lançamento",
    quartos: "3 a 4 suítes",
    diferenciais: ["Conceito sustentável", "Trilhas e pomar", "Espaço kids", "Energia solar"],
    capa: u("photo-1613490493576-7fde63acd811"),
    imagens: [u("photo-1613490493576-7fde63acd811"), u("photo-1600607687939-ce8a6c25118c")],
    endereco_mapa: "Ceará, Brasil",
    ordem: 4,
  }),
];

export const SEED_SLIDES: Slide[] = [
  {
    id: "s1",
    sobretitulo: "Seu imóvel, nosso compromisso.",
    titulo: "Willame Negócios *Imobiliário*",
    subtitulo: "Compra, venda e locação de imóveis com segurança, transparência e atendimento personalizado.",
    imagem: u("photo-1600596542815-ffad4c1539a9", 2400),
    cta_texto: "Ver Imóveis",
    cta_link: "/empreendimentos",
    ordem: 1,
    ativo: true,
    created_at: agora,
  },
  {
    id: "s2",
    sobretitulo: "Lançamento Lagoar",
    titulo: "Viva onde os outros *passam férias*",
    subtitulo: "Lazer de resort à beira da lagoa. Condições especiais de lançamento.",
    imagem: u("photo-1571896349842-33c89424de2d", 2400),
    cta_texto: "Conhecer o Lagoar",
    cta_link: "/empreendimentos/lagoar",
    ordem: 2,
    ativo: true,
    created_at: agora,
  },
  {
    id: "s3",
    sobretitulo: "Lotes Moradas",
    titulo: "O lote certo muda *a história* da família",
    subtitulo: "Infraestrutura completa e parcelamento facilitado.",
    imagem: u("photo-1564013799919-ab600027ffc6", 2400),
    cta_texto: "Ver lotes disponíveis",
    cta_link: "/empreendimentos/moradas",
    ordem: 3,
    ativo: true,
    created_at: agora,
  },
];

export const SEED_CONFIG: Configuracoes = {
  id: 1,
  corretor_nome: "Willame Silva",
  creci: "",
  whatsapp: "",
  instagram: "williamesilvacorretor",
  email: "",
  regiao_atuacao: "Fortaleza e Região Metropolitana · CE",
  bio: "Corretor de imóveis especializado em lançamentos, lotes e empreendimentos de alto padrão no Ceará. Meu trabalho é simples: entender o que você busca, filtrar o mercado e te levar só ao que faz sentido — com transparência em cada etapa.",
  foto: "",
  manifesto:
    "Não vendo metro quadrado. Ajudo famílias e investidores a tomarem a melhor decisão patrimonial da vida.",
  anos_mercado: "",
  familias_atendidas: "",
  vgv_negociado: "",
  agente_nome: "Agente 24h",
  agente_boas_vindas:
    "Oi! Eu sou o Agente 24h do Willame Silva. Te ajudo a encontrar o imóvel ideal agora mesmo — está buscando para morar ou para investir?",
  updated_at: agora,
};
