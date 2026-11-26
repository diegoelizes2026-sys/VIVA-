// Idioma da conversa (português ou inglês), descoberto pelas palavras da própria mensagem.
export type Lang = "pt" | "en";

const EN = new Set("the i i'm im you your my me is are am was were how much many what when where why who spent spend paid pay bought buy today tomorrow yesterday can could should have had has ate eat drank drink ran run walked walk of for and to with please help undo report weekly monthly calories calorie water lunch dinner breakfast snack hi hello hey thanks thank yes no left still money bill bills salary got received income expense week month this that it on in at".split(" ").filter(w => w !== "no"));
const PT = new Set("o os as eu você voce vc meu minha meus minhas é e são sao foi quanto quanta quantos quantas gastei gastar paguei pagar comprei comprar hoje amanhã amanha ontem posso pode tenho tive comi comer bebi beber corri correr caminhei de do da dos das para pra pro com por no na nos nas um uma oi olá ola obrigado obrigada sim não nao ajuda desfazer relatório relatorio semana mês mes calorias água agua almoço almoco jantar café cafe lanche dinheiro conta contas salário salario recebi entrada gasto que isso esse essa".split(" "));

/** Diz se o texto está em inglês ou português. Sem pistas suficientes, devolve `fallback`. */
export function detectLang(text: string, fallback: Lang = "pt"): Lang {
  const t = (text || "").toLowerCase();
  if (!t.trim()) return fallback;
  const words = t.match(/[a-zà-ú']+/g) || [];
  let en = 0, pt = 0;
  for (const w of words) { if (EN.has(w)) en++; if (PT.has(w)) pt++; }
  if (/[ãõçáéíóúâêô]/.test(t)) pt += 2;
  if (en === 0 && pt === 0) return fallback;
  if (en > pt) return "en";
  if (pt > en) return "pt";
  return fallback;
}

export const locale = (lang: Lang) => (lang === "en" ? "en-US" : "pt-BR");
