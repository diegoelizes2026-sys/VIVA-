import { SITE, type EmailContent } from "@/lib/email";
import { brl, changeText, monthName, type Report } from "@/lib/report";

// Textos dos e-mails da VIVA (curtos, no tom da VIVA, com um botão só).
const hi = (n: string) => (n ? `Oi, ${n}!` : "Oi!");

export function welcomeEmail(first: string): EmailContent {
  return {
    subject: "🎁 Seus 7 dias de VIVA+ Pro já começaram",
    preheader: "Anote o primeiro gasto e veja quanto pode gastar hoje.",
    title: `${hi(first)} Bem-vinda(o) à VIVA+ 💜`,
    paragraphs: [
      "Você ganhou **7 dias do Pro grátis**, sem cartão e sem cobrança. No fim, volta sozinho para o plano grátis.",
      "Funciona assim: você me conta seus gastos (\"gastei 20 no lanche\") e eu te digo **quanto ainda pode gastar por dia** sem faltar dinheiro até o próximo salário.",
      "O jeito mais fácil é pelo **WhatsApp**: manda texto, áudio ou foto do comprovante que eu anoto.",
    ],
    cta: { label: "Anotar meu primeiro gasto", url: `${SITE}/meu-dia` },
    ps: "Dica: conecte o WhatsApp em Meu dia, leva 10 segundos.",
  };
}

export function activationEmail(day: 1 | 2 | 3, first: string): EmailContent {
  if (day === 1) return {
    subject: "Seu número do dia está esperando ☀️",
    preheader: "Leva 5 segundos.",
    title: `${hi(first)} Quanto você pode gastar hoje?`,
    paragraphs: ["Anote um gasto de hoje (um café, a passagem, um lanche) e eu calculo na hora **quanto ainda dá pra gastar** sem faltar até o salário."],
    cta: { label: "Ver meu número do dia", url: `${SITE}/meu-dia` },
  };
  if (day === 2) return {
    subject: "2 minutos pra organizar seu mês 💜",
    preheader: "O que você gastou ontem e hoje?",
    title: "Bora manter o controle?",
    paragraphs: [`${hi(first)} Anote o que você gastou ontem e hoje. A cada gasto, seu valor do dia se ajusta sozinho.`, "Sem planilha, sem conta de cabeça."],
    cta: { label: "Anotar meus gastos", url: `${SITE}/meu-dia` },
  };
  return {
    subject: "Seu Pro grátis está rolando 🎁",
    preheader: "Use a VIVA pelo WhatsApp: texto, áudio ou foto.",
    title: "Já testou pelo WhatsApp?",
    paragraphs: [`${hi(first)} Manda **"gastei 20 no lanche"**, um **áudio** ou a **foto do comprovante** pra VIVA no WhatsApp que ela anota pra você.`, "Ela ainda avisa antes das contas vencerem."],
    cta: { label: "Conectar meu WhatsApp", url: `${SITE}/meu-dia` },
  };
}

export function winbackEmail(days: number, first: string): EmailContent {
  return {
    subject: "Sentimos sua falta 💜",
    preheader: "Seu valor do dia ainda está aqui.",
    title: `${hi(first)} Faz ${days} dias que a gente não se fala`,
    paragraphs: ["Anote os gastos de hoje e veja seu **valor do dia atualizado**. Leva menos de 1 minuto pra colocar tudo em dia."],
    cta: { label: "Voltar pra VIVA", url: `${SITE}/meu-dia` },
  };
}

export function trialEndingEmail(did: string, first: string): EmailContent {
  return {
    subject: "Faltam 2 dias do seu Pro grátis",
    preheader: "Continue com a VIVA no WhatsApp sem limite.",
    title: `${hi(first)} Seu Pro grátis acaba em 2 dias`,
    paragraphs: [did ? `Até agora: **${did}**. 🎉` : "Ainda dá tempo de aproveitar: pergunte quanto pode gastar hoje.", "Com o Pro você continua com **WhatsApp sem limite**, áudio, foto de comprovante e relatórios. Pix ou cartão, e cancela quando quiser."],
    cta: { label: "Continuar com o Pro", url: `${SITE}/planos` },
    ps: "Se não assinar, sua conta volta sozinha para o plano grátis, sem cobrança.",
  };
}

export function reportEmail(r: Report, first: string): EmailContent {
  const week = r.range.kind === "semana";
  const top = r.categories[0];
  const empty = r.count === 0 && r.income === 0;
  const period = week ? "da semana" : `de ${monthName(r.range.from)}`;
  if (empty) return {
    subject: `Seu resumo ${period} 📊`,
    title: `${hi(first)} Nenhum gasto anotado ${week ? "nesta semana" : "no mês"}`,
    paragraphs: ["Anote seus gastos e a VIVA mostra para onde foi cada real, com o quanto sobrou e onde dá pra economizar."],
    cta: { label: "Anotar meus gastos", url: `${SITE}/meu-dia` },
  };
  const change = changeText(r);
  return {
    subject: `Seu resumo ${period} 📊`,
    preheader: top ? `Onde mais foi: ${top.name}` : undefined,
    title: `${hi(first)} Seu resumo ${period}`,
    highlight: { label: week ? "Você gastou nesta semana" : `Você gastou em ${monthName(r.range.from)}`, value: brl(r.spent) },
    paragraphs: [
      ...(change ? [`Foi **${change}**.`] : []),
      ...(!week && r.income > 0 ? [`Entrou **${brl(r.income)}** e ${r.balance >= 0 ? `sobrou **${brl(r.balance)}** 🎉` : `faltou **${brl(-r.balance)}**`}.`] : []),
      ...(top ? [`Onde mais foi: **${top.name}** (${Math.round(top.share * 100)}% do total).`] : []),
      ...(r.billsNext7.count ? [`🔔 ${r.billsNext7.count} ${r.billsNext7.count === 1 ? "conta vence" : "contas vencem"} nos próximos 7 dias (${brl(r.billsNext7.amount)}).`] : []),
    ],
    cta: { label: "Ver relatório completo", url: `${SITE}/relatorio?p=${week ? "semana" : "mes-passado"}` },
  };
}

export function passwordResetEmail(first: string, link: string): EmailContent {
  return {
    subject: "🔐 Crie sua nova senha da VIVA+",
    preheader: "O link vale por 1 hora.",
    title: `${hi(first)} Vamos criar sua nova senha`,
    paragraphs: ["Recebemos um pedido para trocar a senha da sua conta VIVA+. Toque no botão abaixo para escolher uma nova.", "O link vale por **1 hora** e só pode ser usado uma vez."],
    cta: { label: "Criar nova senha", url: link },
    ps: "Não foi você? É só ignorar este e-mail: sua senha continua a mesma e ninguém entra na sua conta sem ela.",
    transactional: true,
  };
}
