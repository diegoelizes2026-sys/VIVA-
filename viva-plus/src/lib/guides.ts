// Guias públicos de finanças pessoais (páginas para o Google em /guia/[slug]).
// Para criar um guia novo basta adicionar um item nesta lista: a página, o sitemap e o índice se atualizam sozinhos.
export type GuideSection = { h: string; p?: string[]; list?: string[] };
export type Guide = {
  slug: string;
  title: string;        // título que aparece no Google (até ~60 letras)
  h1: string;
  description: string;  // resumo do Google (até ~160 letras)
  keywords: string[];
  published: string;    // AAAA-MM-DD
  updated: string;
  lead: string;
  sections: GuideSection[];
  faq: { q: string; a: string }[];
};

export const GUIDES: Guide[] = [
  {
    slug: "como-fazer-o-salario-durar-o-mes-todo",
    title: "Como fazer o salário durar o mês todo: 7 passos simples",
    h1: "Como fazer o salário durar o mês todo",
    description: "O dinheiro acaba antes do fim do mês? Veja 7 passos práticos para fazer o salário durar até o próximo pagamento, sem planilha complicada.",
    keywords: ["como fazer o salário durar", "dinheiro acaba antes do fim do mês", "salário não dá", "organizar o salário"],
    published: "2026-11-28", updated: "2026-11-28",
    lead: "Se o seu dinheiro some antes do próximo pagamento, você não está sozinho. Quase sempre o problema não é só quanto se ganha, e sim não saber quanto dá para gastar a cada dia. Estes passos resolvem isso.",
    sections: [
      { h: "1. Pague primeiro o que tem data", p: ["Assim que o salário cair, separe o dinheiro de aluguel, luz, água, internet, fatura do cartão e parcelas. Esse dinheiro já tem dono. O que sobra é o que você realmente tem para viver até o próximo pagamento."] },
      { h: "2. Separe um valor para guardar logo no começo", p: ["Guardar o que sobra no fim do mês não funciona, porque quase nunca sobra. Escolha um valor pequeno, mesmo R$ 20 ou R$ 50, e separe no dia do pagamento. Com o tempo isso vira uma reserva para emergências."] },
      { h: "3. Transforme o resto em um número por dia", p: ["Divida o que sobrou pelo número de dias até o próximo salário. Esse é o seu limite diário. É muito mais fácil decidir um gasto pensando “hoje posso gastar R$ 40” do que olhando o saldo da conta.", "Faça a conta na nossa calculadora de quanto posso gastar por dia, que é grátis e não pede cadastro."] },
      { h: "4. Anote todo gasto, até os pequenos", p: ["Cafezinho, lanche, corrida de aplicativo e taxa de entrega parecem pouco, mas somados pesam no mês. Anotar na hora, nem que seja por uma mensagem, mostra para onde o dinheiro está indo."] },
      { h: "5. Cuidado com o cartão de crédito", p: ["O cartão faz o gasto de hoje aparecer só no mês que vem. Considere cada compra no crédito como dinheiro que já saiu e desconte do seu valor do dia."] },
      { h: "6. Corte vazamentos, não a vida toda", list: ["Assinaturas que você não usa", "Pedidos de comida por aplicativo várias vezes na semana", "Compras por impulso em promoções", "Tarifas de banco que dá para zerar"] },
      { h: "7. Revise toda semana", p: ["Uma vez por semana, olhe quanto gastou e quanto ainda falta até o pagamento. Se passou do limite, os próximos dias ficam um pouco menores. Se economizou, sobra mais. Ajustar cedo evita o aperto no fim do mês."] },
    ],
    faq: [
      { q: "Por que meu salário acaba antes do fim do mês?", a: "Na maioria das vezes porque os gastos pequenos do dia a dia não são acompanhados e as contas fixas não foram separadas logo que o dinheiro entrou. Definir um valor por dia resolve boa parte do problema." },
      { q: "Quanto devo guardar do salário?", a: "Uma referência comum é guardar 20% do que entra, mas o importante é começar. Mesmo um valor pequeno separado todo mês cria o hábito e uma reserva para imprevistos." },
    ],
  },
  {
    slug: "como-dividir-o-salario-regra-50-30-20",
    title: "Como dividir o salário: regra 50-30-20 com exemplo",
    h1: "Como dividir o salário com a regra 50-30-20",
    description: "Entenda a regra 50-30-20 para dividir o salário entre necessidades, desejos e futuro, com exemplo em reais e como adaptar quando o dinheiro é curto.",
    keywords: ["regra 50 30 20", "como dividir o salário", "orçamento pessoal", "como organizar o salário"],
    published: "2026-11-28", updated: "2026-11-28",
    lead: "A regra 50-30-20 é um jeito simples de dividir o que você ganha em três partes. Ela serve de ponto de partida para quem nunca fez um orçamento.",
    sections: [
      { h: "O que é a regra 50-30-20", list: ["50% para necessidades: moradia, contas da casa, mercado, transporte, saúde.", "30% para desejos: lazer, roupas, delivery, assinaturas, presentes.", "20% para o futuro: reserva de emergência, pagar dívidas, investir."] },
      { h: "Exemplo com salário de R$ 2.500", list: ["Necessidades: R$ 1.250", "Desejos: R$ 750", "Futuro: R$ 500"], p: ["Se os R$ 750 de desejos forem usados ao longo de 30 dias, isso dá cerca de R$ 25 por dia para gastos livres."] },
      { h: "E quando o dinheiro é curto?", p: ["Para muita gente, só as necessidades já passam de 50%. Tudo bem: a regra é uma referência, não uma lei. Uma divisão possível é 70-20-10 ou até 80-15-5. O que importa é ter uma parte, mesmo pequena, separada para o futuro e um limite claro para os gastos livres."] },
      { h: "Tenho dívidas. E agora?", p: ["Se você paga juros altos, como no rotativo do cartão ou no cheque especial, use a parte do futuro para quitar essas dívidas primeiro. Os juros que você deixa de pagar valem mais do que qualquer rendimento."] },
      { h: "Como seguir a divisão no dia a dia", p: ["O difícil não é dividir no papel, é respeitar a divisão no meio do mês. O jeito mais prático é transformar a parte dos gastos livres em um valor por dia e acompanhar cada gasto. É exatamente isso que a VIVA+ faz pelo WhatsApp."] },
    ],
    faq: [
      { q: "A regra 50-30-20 vale para salário mínimo?", a: "Vale como referência, mas geralmente precisa ser adaptada, porque as necessidades costumam passar de 50%. Divisões como 70-20-10 ou 80-15-5 são mais realistas nesse caso." },
      { q: "A regra é sobre o salário bruto ou líquido?", a: "Use o valor que realmente cai na conta, ou seja, o salário líquido, depois dos descontos." },
    ],
  },
  {
    slug: "controle-de-gastos-pelo-whatsapp",
    title: "Controle de gastos pelo WhatsApp: como funciona",
    h1: "Controle de gastos pelo WhatsApp",
    description: "Anote seus gastos mandando uma mensagem, áudio ou foto no WhatsApp e saiba quanto pode gastar por dia. Veja como funciona e por que é mais fácil que planilha.",
    keywords: ["controle de gastos pelo whatsapp", "anotar gastos no whatsapp", "assistente financeiro whatsapp", "controle financeiro whatsapp"],
    published: "2026-11-28", updated: "2026-11-28",
    lead: "A maioria das pessoas desiste do controle de gastos porque abrir uma planilha ou um aplicativo toda vez dá preguiça. No WhatsApp, que você já abre o dia inteiro, anotar um gasto leva segundos.",
    sections: [
      { h: "Como funciona", list: ["Você manda uma mensagem como “gastei 25 no almoço” ou um áudio.", "A assistente entende o valor, a categoria e a forma de pagamento.", "O seu valor do dia é recalculado na hora.", "Todo dia de manhã você recebe quanto pode gastar até o salário."] },
      { h: "Por que é mais fácil do que planilha", p: ["Planilha exige sentar no computador, lembrar de tudo e fazer fórmula. No WhatsApp o registro acontece na hora do gasto, então nada se perde. E em vez de uma tabela cheia de números, você recebe uma resposta simples: quanto ainda dá para gastar hoje."] },
      { h: "Preciso ligar minha conta do banco?", p: ["Na VIVA+ não. Você conta o que quiser e ela organiza. Não pedimos senha de banco nem acesso à sua conta."] },
      { h: "O que dá para perguntar", list: ["“Quanto posso gastar hoje?”", "“Quanto gastei com mercado este mês?”", "“Me lembra de pagar a luz dia 10.”", "“Dá para comprar um tênis de 200 reais?”"] },
      { h: "Como começar", p: ["Crie sua conta grátis, conte quanto ganha e quais são suas contas em uma conversa de 2 minutos e conecte o WhatsApp. A VIVA no WhatsApp já funciona no plano grátis."] },
    ],
    faq: [
      { q: "Controle de gastos pelo WhatsApp é seguro?", a: "Na VIVA+ você não informa senha de banco nem dá acesso à sua conta. Seus dados ficam protegidos e você pode ver, corrigir ou apagar tudo quando quiser." },
      { q: "É grátis?", a: "Sim, dá para começar grátis e sem cartão. Ao criar a conta você ganha 7 dias do plano Pro e depois pode continuar no plano grátis." },
    ],
  },
  {
    slug: "como-sair-das-dividas",
    title: "Como sair das dívidas: passo a passo para começar hoje",
    h1: "Como sair das dívidas",
    description: "Passo a passo para sair das dívidas: liste o que deve, ataque os juros mais altos, negocie e pare de criar dívida nova com um limite de gasto por dia.",
    keywords: ["como sair das dívidas", "como pagar dívidas", "nome sujo como limpar", "negociar dívidas"],
    published: "2026-11-28", updated: "2026-11-28",
    lead: "Sair das dívidas começa com saber exatamente quanto se deve e parar de criar dívidas novas. Depois é questão de ordem e constância.",
    sections: [
      { h: "1. Liste tudo o que você deve", p: ["Anote cada dívida com o valor total, a parcela, os juros por mês e quantas parcelas faltam. Ver tudo junto assusta no começo, mas é o que permite escolher por onde começar."] },
      { h: "2. Ataque primeiro os juros mais altos", p: ["Rotativo do cartão e cheque especial costumam ter os juros mais altos do mercado. Priorize essas dívidas. Se tiver dívidas pequenas, quitar uma delas rápido também ajuda a ganhar ânimo."] },
      { h: "3. Negocie", p: ["Bancos e lojas costumam oferecer descontos grandes para pagamento à vista ou parcelamento com juros menores, principalmente em mutirões e feirões de renegociação. Antes de fechar, confira se a parcela cabe no seu mês."] },
      { h: "4. Troque dívida cara por dívida barata", p: ["Em alguns casos vale trocar o rotativo do cartão por um empréstimo com juros menores, como o consignado. Só faça isso se tiver certeza de que não vai voltar a usar o limite do cartão."] },
      { h: "5. Pare de criar dívida nova", p: ["Nada adianta pagar as dívidas antigas se o mês continua fechando no vermelho. Defina quanto pode gastar por dia depois de separar as parcelas e acompanhe cada gasto. Assim o dinheiro passa a sobrar no fim do mês."] },
      { h: "6. Monte uma reserva pequena", p: ["Mesmo pagando dívidas, guarde um pouco todo mês. Sem reserva, qualquer imprevisto vira uma dívida nova."] },
    ],
    faq: [
      { q: "Qual dívida devo pagar primeiro?", a: "Em geral, a que tem os juros mais altos, como o rotativo do cartão e o cheque especial. Dívidas com risco de perder um bem, como o financiamento da casa, também merecem atenção." },
      { q: "Vale a pena pegar empréstimo para pagar dívida?", a: "Pode valer quando o novo empréstimo tem juros bem menores que a dívida atual e você não volta a usar o crédito caro. Compare o custo total antes de decidir." },
    ],
  },
];

export const guideBySlug = (slug: string) => GUIDES.find(g => g.slug === slug);
