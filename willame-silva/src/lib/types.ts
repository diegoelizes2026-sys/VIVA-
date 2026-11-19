export type StatusEmpreendimento =
  | "Lançamento"
  | "Pré-lançamento"
  | "Em obras"
  | "Pronto para morar"
  | "Últimas unidades"
  | "100% vendido";

export const STATUS_OPCOES: StatusEmpreendimento[] = [
  "Pré-lançamento",
  "Lançamento",
  "Em obras",
  "Pronto para morar",
  "Últimas unidades",
  "100% vendido",
];

export const TIPO_OPCOES = [
  "Casa",
  "Apartamento",
  "Terreno",
  "Lotes",
  "Casas em condomínio",
  "Apartamentos",
  "Resort / Segunda moradia",
  "Bairro planejado",
  "Comercial",
];

export const FINALIDADE_OPCOES = ["Venda", "Locação", "Venda e locação"];

export type Empreendimento = {
  id: string;
  slug: string;
  nome: string;
  chamada: string;
  descricao: string;
  cidade: string;
  bairro: string;
  tipo: string;
  status: StatusEmpreendimento;
  preco_a_partir: number | null;
  area_min: number | null;
  area_max: number | null;
  quartos: string;
  banheiros: string;
  vagas: string;
  finalidade: string;
  diferenciais: string[];
  capa: string;
  imagens: string[];
  video_url: string;
  endereco_mapa: string;
  construtora: string;
  destaque: boolean;
  publicado: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export type Slide = {
  id: string;
  sobretitulo: string;
  titulo: string;
  subtitulo: string;
  imagem: string;
  cta_texto: string;
  cta_link: string;
  ordem: number;
  ativo: boolean;
  created_at: string;
};

export const ETAPAS = [
  { id: "novo", nome: "Novo lead" },
  { id: "atendimento", nome: "Em atendimento" },
  { id: "visita", nome: "Visita agendada" },
  { id: "proposta", nome: "Proposta" },
  { id: "fechado", nome: "Fechado" },
  { id: "perdido", nome: "Perdido" },
] as const;

export type Etapa = (typeof ETAPAS)[number]["id"];
export type Temperatura = "quente" | "morno" | "frio";

export type MensagemConversa = { role: "user" | "assistant"; content: string; at?: string };

export type Lead = {
  id: string;
  session_id: string | null;
  nome: string;
  telefone: string;
  email: string;
  busca: string;
  objetivo: string;
  tipo_imovel: string;
  regiao: string;
  empreendimento_interesse: string;
  orcamento: string;
  prazo: string;
  forma_pagamento: string;
  temperatura: Temperatura;
  pontuacao: number;
  etapa: Etapa;
  origem: string;
  conversa: MensagemConversa[];
  notas: string;
  encaminhado_whatsapp: boolean;
  created_at: string;
  updated_at: string;
};

export type Configuracoes = {
  id: number;
  corretor_nome: string;
  creci: string;
  whatsapp: string;
  instagram: string;
  email: string;
  regiao_atuacao: string;
  bio: string;
  foto: string;
  manifesto: string;
  anos_mercado: string;
  familias_atendidas: string;
  vgv_negociado: string;
  agente_nome: string;
  agente_boas_vindas: string;
  updated_at: string;
};
