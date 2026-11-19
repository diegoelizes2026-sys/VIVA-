import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Configuracoes, Empreendimento, Lead, MensagemConversa, Temperatura } from "./types";
import { moeda, soDigitos } from "./format";

export type DadosLead = {
  nome: string;
  telefone: string;
  objetivo: string;
  tipo_imovel: string;
  regiao: string;
  empreendimento_interesse: string;
  orcamento: string;
  prazo: string;
  forma_pagamento: string;
  busca: string;
};

export type RespostaAgente = {
  resposta: string;
  sugestoes: string[];
  dados: DadosLead;
  temperatura: Temperatura;
  pontuacao: number;
  pronto_para_corretor: boolean;
  empreendimentos_citados: string[];
};

const CAMPOS: (keyof DadosLead)[] = [
  "nome",
  "telefone",
  "objetivo",
  "tipo_imovel",
  "regiao",
  "empreendimento_interesse",
  "orcamento",
  "prazo",
  "forma_pagamento",
  "busca",
];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "resposta",
    "sugestoes",
    "dados",
    "temperatura",
    "pontuacao",
    "pronto_para_corretor",
    "empreendimentos_citados",
  ],
  properties: {
    resposta: { type: "string", description: "Mensagem para o cliente, em português do Brasil." },
    sugestoes: {
      type: "array",
      items: { type: "string" },
      description: "De 0 a 3 respostas rápidas curtas que o cliente pode tocar.",
    },
    dados: {
      type: "object",
      additionalProperties: false,
      required: CAMPOS,
      properties: Object.fromEntries(CAMPOS.map((c) => [c, { type: "string" }])),
    },
    temperatura: { type: "string", enum: ["quente", "morno", "frio"] },
    pontuacao: { type: "integer", description: "0 a 100: chance de compra." },
    pronto_para_corretor: { type: "boolean" },
    empreendimentos_citados: {
      type: "array",
      items: { type: "string" },
      description: "Slugs dos empreendimentos mencionados nesta resposta.",
    },
  },
} as const;

function catalogo(emps: Empreendimento[]) {
  return emps
    .map((e) =>
      [
        `- ${e.nome} (slug: ${e.slug})`,
        `  Finalidade: ${e.finalidade || "Venda"} · Tipo: ${e.tipo} · Status: ${e.status} · Local: ${[e.bairro, e.cidade].filter(Boolean).join(", ") || "consultar"}`,
        e.preco_a_partir ? `  ${/loca/i.test(e.finalidade) ? "Aluguel" : "A partir de"} ${moeda(e.preco_a_partir)}${/loca/i.test(e.finalidade) ? "/mês" : ""}` : `  Preço: sob consulta com o corretor`,
        e.area_min ? `  Área: ${e.area_min}${e.area_max ? `–${e.area_max}` : ""} m²` : "",
        e.quartos ? `  Quartos: ${e.quartos}` : "",
        e.banheiros ? `  Banheiros: ${e.banheiros}` : "",
        e.vagas ? `  Vagas: ${e.vagas}` : "",
        e.chamada ? `  Resumo: ${e.chamada}` : "",
        e.diferenciais.length ? `  Diferenciais: ${e.diferenciais.join("; ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");
}

function systemPrompt(cfg: Configuracoes, emps: Empreendimento[]) {
  return `Você é o ${cfg.agente_nome || "Agente 24h"}, assistente virtual do corretor de imóveis ${cfg.corretor_nome}${cfg.creci ? ` (CRECI ${cfg.creci})` : ""}, que atua em ${cfg.regiao_atuacao}. Você atende visitantes do site a qualquer hora.

Seu trabalho, nesta ordem de prioridade:
1. Acolher e entender o que a pessoa busca (comprar, alugar ou investir; morar ou investir; tipo de imóvel, região, faixa de investimento, prazo, forma de pagamento — à vista, financiamento, FGTS, consórcio, parcelamento direto).
2. Indicar os empreendimentos do catálogo que combinam com o perfil, explicando em uma ou duas frases por que combinam.
3. Coletar nome e WhatsApp para que o ${cfg.corretor_nome} continue o atendimento pessoalmente.

Como conversar:
- Português do Brasil, tom caloroso, seguro e direto, como um bom corretor do Ceará. Mensagens curtas (2 a 4 frases). No máximo um emoji, quando fizer sentido.
- Faça uma pergunta por vez. Não peça todos os dados de uma vez e não pareça um formulário.
- Peça o nome cedo, de forma natural. Peça o WhatsApp quando já houver interesse ("posso pedir para o Willame te mandar o material e a tabela?").
- Use apenas as informações do catálogo abaixo. Nunca invente preços, metragens, prazos de entrega, taxas ou condições: diga que o ${cfg.corretor_nome} envia a tabela atualizada.
- Empreendimento "100% vendido": diga que está esgotado e ofereça entrar na lista de prioridade de próximas fases ou opções parecidas.
- Se perguntarem algo fora de imóveis, responda com gentileza em uma frase e volte ao assunto.
- Não prometa valorização garantida nem dê conselho jurídico ou financeiro definitivo.

Preenchimento do campo "dados" (é o que vai para o CRM do corretor):
- Repita sempre tudo o que já se sabe da conversa inteira, não só desta mensagem. Use "" para o que ainda não foi dito.
- "telefone": apenas dígitos, com DDD, quando a pessoa informar.
- "busca": um resumo de uma linha, escrito para o corretor, do que a pessoa procura (ex.: "Lote em condomínio p/ construir, até R$ 250 mil, financiamento, quer visitar este mês").
- "empreendimento_interesse": nome(s) do catálogo que a pessoa demonstrou interesse.

Qualificação:
- temperatura "quente": quer comprar em até 3 meses, ou pediu visita/tabela, ou tem orçamento compatível e deu contato. "morno": interesse real mas prazo maior ou indefinido. "frio": só curiosidade.
- pontuacao: 0 a 100.
- pronto_para_corretor = true quando você já tem nome + WhatsApp + uma ideia clara do que a pessoa busca, ou quando ela pedir para falar com o corretor. Nesse momento, diga que o ${cfg.corretor_nome} vai continuar pelo WhatsApp e que ela pode tocar no botão verde para chamar agora.

"sugestoes": até 3 respostas rápidas curtas (máx. 28 caracteres cada) que façam sentido para a próxima resposta do cliente. Lista vazia quando pedir um dado livre como nome ou telefone.

Catálogo atual de empreendimentos:
${catalogo(emps) || "(nenhum cadastrado no momento — colete o perfil e encaminhe ao corretor)"}`;
}

let _client: Anthropic | null = null;
const client = () => (_client ??= new Anthropic());

export const agenteComIA = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

export async function responderComClaude(
  conversa: MensagemConversa[],
  cfg: Configuracoes,
  emps: Empreendimento[],
  conhecido: Partial<Lead> | null,
): Promise<RespostaAgente> {
  const messages: Anthropic.Beta.BetaMessageParam[] = conversa.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  // A conversa precisa começar pelo usuário: a saudação inicial vai como contexto.
  while (messages.length && messages[0].role === "assistant") messages.shift();
  if (!messages.length) messages.push({ role: "user", content: "Olá" });

  const contexto = conhecido
    ? `\n\nDados já registrados deste visitante no CRM (mantenha e complete): ${JSON.stringify(
        Object.fromEntries(CAMPOS.map((c) => [c, (conhecido as Record<string, unknown>)[c] ?? ""])),
      )}`
    : "";

  const res = await client().beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> },
    },
    system: [
      { type: "text", text: systemPrompt(cfg, emps), cache_control: { type: "ephemeral" } },
      ...(contexto ? [{ type: "text" as const, text: contexto }] : []),
    ],
    messages,
  });

  if (res.stop_reason === "refusal") throw new Error("refusal");
  const texto = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const r = JSON.parse(texto) as RespostaAgente;
  r.dados.telefone = soDigitos(r.dados.telefone);
  r.pontuacao = Math.max(0, Math.min(100, Math.round(r.pontuacao || 0)));
  r.sugestoes = (r.sugestoes || []).slice(0, 3);
  return r;
}

// ---------------------------------------------------------------------------
// Modo roteiro: funciona sem chave de IA. Conduz a mesma qualificação passo a passo.
// ---------------------------------------------------------------------------
const PASSOS = ["objetivo", "tipo_imovel", "regiao", "orcamento", "prazo", "forma_pagamento", "nome", "telefone"] as const;

export function responderComRoteiro(
  conversa: MensagemConversa[],
  cfg: Configuracoes,
  emps: Empreendimento[],
  conhecido: Partial<Lead> | null,
): RespostaAgente {
  const dados: DadosLead = Object.fromEntries(
    CAMPOS.map((c) => [c, String((conhecido as Record<string, unknown> | null)?.[c] ?? "")]),
  ) as DadosLead;

  const ultima = [...conversa].reverse().find((m) => m.role === "user")?.content.trim() ?? "";
  const perguntasFeitas = conversa.filter((m) => m.role === "assistant").length;
  // Qual passo estava pendente na última pergunta?
  const pendente = PASSOS.find((p) => !dados[p]);
  if (ultima && pendente && perguntasFeitas > 0) {
    if (pendente === "telefone") {
      const d = soDigitos(ultima);
      if (d.length >= 10) dados.telefone = d;
    } else if (pendente === "nome") {
      dados.nome = ultima.replace(/^(meu nome é|me chamo|sou o|sou a|sou)\s+/i, "").split(/[,.!]/)[0].slice(0, 60);
    } else {
      dados[pendente] = ultima.slice(0, 120);
    }
  }
  const mencionado = emps.find((e) => ultima.toLowerCase().includes(e.nome.toLowerCase()));
  if (mencionado && !dados.empreendimento_interesse.includes(mencionado.nome)) {
    dados.empreendimento_interesse = [dados.empreendimento_interesse, mencionado.nome].filter(Boolean).join(", ");
  }

  const prox = PASSOS.find((p) => !dados[p]);
  const nome = dados.nome ? dados.nome.split(" ")[0] : "";
  const recomend = emps
    .filter((e) => e.status !== "100% vendido")
    .filter((e) => !dados.tipo_imovel || e.tipo.toLowerCase().includes(dados.tipo_imovel.toLowerCase().slice(0, 4)))
    .slice(0, 2);

  const perguntas: Record<(typeof PASSOS)[number], { t: string; s: string[] }> = {
    objetivo: { t: cfg.agente_boas_vindas, s: ["Para morar", "Para investir", "Os dois"] },
    tipo_imovel: { t: "Perfeito! Que tipo de imóvel você tem em mente?", s: ["Lote", "Casa em condomínio", "Apartamento"] },
    regiao: { t: "Tem alguma região ou cidade preferida?", s: ["Fortaleza", "Litoral", "Tanto faz"] },
    orcamento: {
      t: "E qual faixa de investimento fica confortável para você?",
      s: ["Até R$ 300 mil", "R$ 300–700 mil", "Acima de R$ 700 mil"],
    },
    prazo: { t: "Para quando você pretende fechar negócio?", s: ["Agora / este mês", "Em até 6 meses", "Só pesquisando"] },
    forma_pagamento: { t: "Pensa em pagar como?", s: ["À vista", "Financiamento", "Parcelado direto"] },
    nome: {
      t: `Ótimo, já tenho uma boa ideia do seu perfil${
        recomend.length ? ` — ${recomend.map((e) => e.nome).join(" e ")} combinam bastante com o que você busca` : ""
      }. Como posso te chamar?`,
      s: [],
    },
    telefone: {
      t: `Prazer, ${nome}! Qual o seu WhatsApp com DDD? Assim o ${cfg.corretor_nome} te manda o material e a tabela atualizada.`,
      s: [],
    },
  };

  const temperatura: Temperatura = /agora|mês|mes|imediat|urgente/i.test(dados.prazo)
    ? "quente"
    : /pesquis|curios/i.test(dados.prazo)
      ? "frio"
      : "morno";
  const preenchidos = PASSOS.filter((p) => dados[p]).length;
  dados.busca = [
    dados.tipo_imovel,
    dados.objetivo && `p/ ${dados.objetivo.toLowerCase()}`,
    dados.regiao && `em ${dados.regiao}`,
    dados.orcamento,
    dados.forma_pagamento,
    dados.prazo && `prazo: ${dados.prazo}`,
  ]
    .filter(Boolean)
    .join(" · ");

  if (!prox) {
    return {
      resposta: `Prontinho, ${nome}! Já passei o seu perfil para o ${cfg.corretor_nome}. Toque no botão verde para chamar ele agora no WhatsApp — ele já vai saber o que você procura.`,
      sugestoes: [],
      dados,
      temperatura,
      pontuacao: temperatura === "quente" ? 85 : temperatura === "morno" ? 60 : 35,
      pronto_para_corretor: true,
      empreendimentos_citados: recomend.map((e) => e.slug),
    };
  }
  if (prox === "telefone" && ultima && perguntasFeitas > 0 && pendente === "telefone") {
    perguntas.telefone.t = "Hmm, não consegui ler o número. Pode mandar com DDD? Ex.: 85 99999-9999";
  }
  return {
    resposta: perguntas[prox].t,
    sugestoes: perguntas[prox].s,
    dados,
    temperatura,
    pontuacao: Math.round((preenchidos / PASSOS.length) * 60),
    pronto_para_corretor: false,
    empreendimentos_citados: prox === "nome" ? recomend.map((e) => e.slug) : [],
  };
}
