// Diagnóstico da Vida (funil do tráfego pago): perguntas sobre rotina, notas por área e o resultado parcial.
// Roda no navegador. A oferta do Pro (preço e prazo) é conferida de novo no servidor (src/lib/funnel-offer.ts).

export type Area = "dinheiro" | "tempo" | "organizacao" | "saude" | "energia";
export type Option = { id: string; label: string; score: number; hours?: number };
export type Question = { id: string; area: Area | "foco"; title: string; help?: string; options: Option[] };
export type LifeAnswers = Record<string, string>;
export type AreaScore = { area: Area; score: number };
export type LifeResult = {
  index: number;            // 0 a 100: equilíbrio geral
  areas: AreaScore[];       // da pior para a melhor
  worst: Area;
  second: Area;
  headline: string;         // frase concreta do ponto mais desequilibrado
  detail: string;           // explicação com números calculados das respostas
  phoneHoursWeek: number;   // horas por semana no celular sem objetivo
  focus: Area;              // o que a pessoa quer mudar primeiro
};

export const AREA_LABEL: Record<Area, string> = {
  dinheiro: "Dinheiro", tempo: "Tempo e foco", organizacao: "Organização da rotina", saude: "Alimentação e corpo", energia: "Sono e energia",
};

export const QUESTIONS: Question[] = [
  { id: "fim_mes", area: "dinheiro", title: "Como você chega no fim do mês?", options: [
    { id: "sobra", label: "Sempre sobra dinheiro", score: 3 }, { id: "zero", label: "Fico no zero a zero", score: 1.5 }, { id: "falta", label: "Falta antes do mês acabar", score: 0 }] },
  { id: "gastos", area: "dinheiro", title: "Você sabe quanto gastou na última semana?", options: [
    { id: "sei", label: "Sei certinho", score: 3 }, { id: "mais_menos", label: "Mais ou menos", score: 1.5 }, { id: "nao", label: "Não faço ideia", score: 0 }] },
  { id: "celular", area: "tempo", title: "Quanto tempo por dia você passa no celular sem um objetivo?", help: "Redes sociais, vídeos, rolar o feed. Vale um chute honesto.", options: [
    { id: "menos1", label: "Menos de 1 hora", score: 3, hours: 0.5 }, { id: "1a2", label: "De 1 a 2 horas", score: 2, hours: 1.5 },
    { id: "2a4", label: "De 2 a 4 horas", score: 1, hours: 3 }, { id: "mais4", label: "Mais de 4 horas", score: 0, hours: 5 }] },
  { id: "dia_passou", area: "tempo", title: "Com que frequência o dia acaba e você não fez o que queria?", options: [
    { id: "raro", label: "Raramente", score: 3 }, { id: "as_vezes", label: "Algumas vezes por semana", score: 1.5 }, { id: "quase_todo", label: "Quase todo dia", score: 0 }] },
  { id: "compromissos", area: "organizacao", title: "Como você controla compromissos, contas e tarefas?", options: [
    { id: "agenda", label: "Anoto tudo numa agenda ou app", score: 3 }, { id: "cabeca", label: "Guardo de cabeça", score: 1 }, { id: "esqueco", label: "Vivo esquecendo coisas importantes", score: 0 }] },
  { id: "alimentacao", area: "saude", title: "Como é sua alimentação na maioria dos dias?", options: [
    { id: "equilibrada", label: "Equilibrada, com comida de verdade", score: 3 }, { id: "o_que_da", label: "Como o que dá, na correria", score: 1.5 }, { id: "besteira", label: "Muito delivery, lanche e besteira", score: 0 }] },
  { id: "exercicio", area: "saude", title: "Quantos dias por semana você se exercita?", options: [
    { id: "3mais", label: "3 dias ou mais", score: 3 }, { id: "1a2", label: "1 ou 2 dias", score: 1.5 }, { id: "nenhum", label: "Nenhum", score: 0 }] },
  { id: "sono", area: "energia", title: "Quantas horas você dorme por noite?", options: [
    { id: "7mais", label: "7 horas ou mais", score: 3, hours: 7.5 }, { id: "6a7", label: "Entre 6 e 7 horas", score: 1.5, hours: 6.5 }, { id: "menos6", label: "Menos de 6 horas", score: 0, hours: 5.5 }] },
  { id: "foco", area: "foco", title: "O que você mais quer mudar agora?", options: [
    { id: "dinheiro", label: "Parar de ficar sem dinheiro", score: 0 }, { id: "tempo", label: "Ter tempo para o que importa", score: 0 },
    { id: "saude", label: "Cuidar da saúde e do corpo", score: 0 }, { id: "organizacao", label: "Organizar a rotina", score: 0 }] },
];

const opt = (a: LifeAnswers, q: string) => QUESTIONS.find(x => x.id === q)?.options.find(o => o.id === a[q]);
const fmtH = (h: number) => (Number.isInteger(h) ? String(h) : h.toLocaleString("pt-BR", { maximumFractionDigits: 1 }));

export function computeLife(a: LifeAnswers): LifeResult {
  const sums: Record<Area, { s: number; n: number }> = { dinheiro: { s: 0, n: 0 }, tempo: { s: 0, n: 0 }, organizacao: { s: 0, n: 0 }, saude: { s: 0, n: 0 }, energia: { s: 0, n: 0 } };
  for (const q of QUESTIONS) { if (q.area === "foco") continue; const o = opt(a, q.id); sums[q.area].s += o?.score ?? 0; sums[q.area].n += 1; }
  const areas = (Object.keys(sums) as Area[]).map(area => ({ area, score: Math.round((sums[area].s / (sums[area].n * 3)) * 100) }));
  // Empate: o que a pessoa disse que quer mudar vem primeiro (fica mais "a cara dela").
  const focus = (["dinheiro", "tempo", "saude", "organizacao"].includes(a.foco) ? a.foco : "dinheiro") as Area;
  areas.sort((x, y) => x.score - y.score || (x.area === focus ? -1 : y.area === focus ? 1 : 0));
  const index = Math.round(areas.reduce((t, x) => t + x.score, 0) / areas.length);
  const phoneHoursWeek = Math.round((opt(a, "celular")?.hours ?? 1.5) * 7 * 10) / 10;
  const worst = areas[0].area, second = areas[1].area;
  const { headline, detail } = insight(worst, a, phoneHoursWeek);
  return { index, areas, worst, second, headline, detail, phoneHoursWeek, focus };
}

function insight(area: Area, a: LifeAnswers, phoneWeek: number): { headline: string; detail: string } {
  if (area === "tempo") {
    const month = Math.round(phoneWeek * 4.3);
    return { headline: `Você está perdendo cerca de ${fmtH(phoneWeek)} horas por semana no celular sem perceber`,
      detail: `São mais ou menos ${month} horas por mês, o equivalente a ${Math.max(1, Math.round(month / 16))} dias inteiros acordado.${a.dia_passou === "quase_todo" ? " E você contou que quase todo dia ele acaba sem você fazer o que queria: o tempo está indo embora antes das suas prioridades." : " Esse é o tempo que falta para o que você vive adiando."}` };
  }
  if (area === "dinheiro") {
    const blind = a.gastos === "nao" ? "você não sabe quanto gastou na última semana" : a.gastos === "mais_menos" ? "você só sabe mais ou menos quanto gastou na última semana" : "mesmo acompanhando os gastos";
    const end = a.fim_mes === "falta" ? "o dinheiro acaba antes do mês" : a.fim_mes === "zero" ? "o mês fecha no zero a zero, sem sobrar nada" : "ainda há pontos para ajustar";
    return { headline: "Seu dinheiro está escapando sem você ver para onde", detail: `Hoje ${blind} e ${end}. Quando os gastos pequenos não aparecem, eles somam no fim do mês e viram aperto.` };
  }
  if (area === "saude") {
    const food = a.alimentacao === "besteira" ? "a alimentação está apoiada em delivery e lanche" : a.alimentacao === "o_que_da" ? "você come o que dá, na correria" : "a alimentação está ok";
    const move = a.exercicio === "nenhum" ? "o corpo está parado: nenhum dia de exercício na semana" : a.exercicio === "1a2" ? "o exercício aparece só 1 ou 2 dias por semana" : "você já se mexe";
    return { headline: "Sua rotina está cobrando a conta do seu corpo", detail: `Hoje ${food} e ${move}. Essa combinação costuma aparecer como cansaço, falta de disposição e peso que não sai.` };
  }
  if (area === "energia") {
    const h = opt(a, "sono")?.hours ?? 6.5; const debt = Math.max(0, Math.round((7.5 - h) * 7));
    return { headline: debt ? `Você está deixando de dormir cerca de ${debt} horas por semana` : "Seu sono está segurando o resto da rotina",
      detail: debt ? `Dormindo ${a.sono === "menos6" ? "menos de 6 horas" : "entre 6 e 7 horas"} por noite, você acumula essa diferença em relação a uma noite de 7h30. Sono curto derruba foco, humor e vontade de cuidar do resto.` : "Você dorme bem, mas as outras áreas estão puxando a sua energia para baixo." };
  }
  return { headline: "Sua rotina está funcionando no improviso",
    detail: a.compromissos === "esqueco" ? "Você contou que vive esquecendo coisas importantes. Conta que vence, compromisso que passa e tarefa que fica para depois custam dinheiro e tranquilidade." : "Guardar tudo de cabeça funciona até o dia em que não funciona: é aí que vencem as contas e escapam os compromissos." };
}

// Oferta do funil: Pro por R$19,90 até um horário (o servidor confere o prazo e o preço).
export const FUNNEL_OFFER = "pro1990";
export const FUNNEL_PRICE_BRL = 19.9;
export const FUNNEL_REGULAR_BRL = 29.9;
export const FUNNEL_OFFER_MINUTES = 60;
export const LIFE_KEY = "viva-vida-v1";
export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const clock = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

// Plano de ação por área (entregue no diagnóstico completo, depois da assinatura). Cada passo usa uma função do app.
export type PlanStep = { title: string; text: string; href: string; cta: string };
export const PLAN: Record<Area, PlanStep[]> = {
  dinheiro: [
    { title: "Descubra para onde o dinheiro vai", text: "Por 7 dias, anote cada gasto na hora, até o cafezinho. Mande no WhatsApp da VIVA: \"gastei 12 no lanche\". Ela organiza por categoria para você.", href: "/financas", cta: "Abrir finanças" },
    { title: "Use o seu número do dia", text: "A VIVA calcula quanto você pode gastar por dia até o salário. Gastou menos hoje? A sobra passa para amanhã. Gastou mais? Ela avisa antes de faltar.", href: "/meu-dia", cta: "Ver meu número do dia" },
    { title: "Corte o vazamento invisível", text: "Cadastre as contas fixas e assinaturas. A VIVA te avisa antes de vencer (adeus multa e juros) e mostra o que pode ser cancelado.", href: "/contas", cta: "Cadastrar contas" },
  ],
  tempo: [
    { title: "Escolha 3 prioridades por dia", text: "Toda manhã, diga à VIVA as 3 coisas que precisam acontecer hoje. Ela lembra você na hora certa e cobra no fim do dia.", href: "/agenda", cta: "Abrir agenda" },
    { title: "Troque rolagem por blocos de foco", text: "Marque na agenda 2 blocos de 50 minutos sem celular. O lembrete da VIVA toca no início e no fim de cada bloco.", href: "/agenda", cta: "Criar bloco de foco" },
    { title: "Revise o dia em 2 minutos", text: "À noite a VIVA pergunta como foi o dia. Você vê o que fez, o que ficou e já deixa o amanhã pronto.", href: "/meu-dia", cta: "Ver meu dia" },
  ],
  organizacao: [
    { title: "Tire tudo da cabeça", text: "Mande para a VIVA cada compromisso, conta e tarefa assim que lembrar, por texto ou áudio no WhatsApp. Ela guarda e organiza.", href: "/agenda", cta: "Abrir agenda" },
    { title: "Nunca mais perca um vencimento", text: "Cadastre as contas do mês uma vez. A VIVA avisa alguns dias antes e no dia do vencimento.", href: "/contas", cta: "Cadastrar contas" },
    { title: "Lista de compras que se organiza sozinha", text: "Fale os itens como lembrar. A VIVA monta a lista e compara preços perto de você.", href: "/lista-de-compras", cta: "Abrir lista" },
  ],
  saude: [
    { title: "Saiba o que está comendo", text: "Tire foto do prato e a VIVA calcula calorias e macros na hora. Em uma semana você enxerga o padrão que está te atrapalhando.", href: "/saude", cta: "Abrir diário de saúde" },
    { title: "Comece com 3 treinos curtos", text: "Registre 3 treinos de 20 minutos na semana. Pode ser caminhada. A VIVA soma o gasto e mostra sua evolução.", href: "/saude", cta: "Registrar treino" },
    { title: "Água e meta diária", text: "A VIVA calcula sua meta de calorias e de água e lembra você ao longo do dia.", href: "/saude", cta: "Ver minha meta" },
  ],
  energia: [
    { title: "Horário fixo para dormir", text: "Defina a hora de deitar e um lembrete 30 minutos antes para largar o celular. Constância vale mais que dormir muito no fim de semana.", href: "/agenda", cta: "Criar lembrete" },
    { title: "Proteja a primeira hora do dia", text: "Nada de redes sociais ao acordar. Use esse tempo para as 3 prioridades do dia que a VIVA te mostra de manhã.", href: "/meu-dia", cta: "Ver meu dia" },
    { title: "Energia vem da rotina inteira", text: "Alimentação e movimento mexem direto no sono. Use o diário de saúde para ajustar os dois juntos.", href: "/saude", cta: "Abrir saúde" },
  ],
};
export const pricePerDay = (monthly: number) => (Math.floor((monthly / 30) * 100) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
