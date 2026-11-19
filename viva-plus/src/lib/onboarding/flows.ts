// Motor das conversas de primeiro acesso (financeiro e Personal).
// Código puro, usado no navegador (fluxo da conversa) e no servidor (validação e diagnóstico).
// As perguntas se adaptam às respostas anteriores e nada é inventado: o que não foi respondido fica "desconhecido".
import { extractMoneyAmount } from "@/lib/finance-intent";
import { decodeDays, encodeDays, parsePayDays, parseWeekday } from "@/lib/payday";

export type Certainty = "confirmed" | "estimated" | "unknown";
export type AnswerValue = number | string | string[] | boolean | null;
export type Answer = { value: AnswerValue; certainty: Certainty; raw?: string; skipped?: boolean; inferred?: boolean };
export type Answers = Record<string, Answer>;
export type Option = { value: string; label: string };
export type QType = "money" | "choice" | "multi" | "yesno" | "text" | "days";
export type Question = {
  id: string; block: string; type: QType; ask: (a: Answers) => string; hint?: (a: Answers) => string | null;
  options?: Option[] | ((a: Answers) => Option[]); quick?: { label: string; value: AnswerValue }[];
  when?: (a: Answers) => boolean; placeholder?: string;
};

export const val = (a: Answers, id: string) => (a[id] && !a[id].skipped ? a[id].value : null);
export const num = (a: Answers, id: string) => { const v = val(a, id); return typeof v === "number" && Number.isFinite(v) ? v : null; };
export const yes = (a: Answers, id: string) => val(a, id) === true;
export const has = (a: Answers, id: string, opt: string) => { const v = val(a, id); return Array.isArray(v) ? v.includes(opt) : v === opt; };
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// ---------------------------------------------------------------- leitura de respostas livres
const ESTIMATE = /\b(uns|umas|cerca|aprox|aproximadamente|mais ou menos|por volta|em torno|uns?\s+\d|tipo|talvez|acho que|m[ée]dia|~)\b|~/i;
const UNKNOWN = /^(n[ãa]o sei|sei l[áa]|n[ãa]o fa[çc]o ideia|prefiro n[ãa]o (?:dizer|informar|responder)|pular|depois)\b/i;

export function readMoney(text: string): { value: number | null; certainty: Certainty } {
  const t = text.trim();
  if (!t || UNKNOWN.test(t)) return { value: null, certainty: "unknown" };
  if (/^(nada|zero|nenhum|nenhuma|n[ãa]o (?:pago|tenho|gasto))\b/i.test(t)) return { value: 0, certainty: "confirmed" };
  let v = extractMoneyAmount(t.replace(/(\d)\s*k\b/i, "$1 mil"));
  if (v == null) return { value: null, certainty: "unknown" };
  const rest = t.match(/mil\s+e\s+(\d{1,3})\b/i); // "3 mil e 500"
  if (rest && v % 1000 === 0) v += Number(rest[1]);
  return { value: Math.round(v * 100) / 100, certainty: ESTIMATE.test(t) ? "estimated" : "confirmed" };
}

export function readYesNo(text: string): boolean | null {
  const t = text.trim().toLowerCase();
  if (/^(sim|s|tenho|tem|possuo|claro|uhum|aham|isso|j[áa]|pratico|faço|sim,)/.test(t)) return true;
  if (/^(n[ãa]o|nao|n|nenhuma?|nunca|zero)\b/.test(t)) return false;
  return null;
}

function matchOptions(text: string, options: Option[]): string[] {
  const t = text.toLowerCase();
  return options.filter(o => {
    const words = (o.label + " " + o.value).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter(w => w.length > 3);
    const plain = t.normalize("NFD").replace(/[̀-ͯ]/g, "");
    return words.some(w => plain.includes(w));
  }).map(o => o.value);
}

// Informações extras ditas espontaneamente: evitam perguntar o que a pessoa já contou.
export function inferExtras(text: string): Answers {
  const t = text.toLowerCase(); const out: Answers = {};
  const set = (id: string, value: AnswerValue) => { out[id] = { value, certainty: "confirmed", raw: text, inferred: true }; };
  if (/\b(renda|sal[áa]rio)?\s*(fixa|fixo|todo m[êe]s o mesmo)\b/.test(t)) set("income_type", "fixed");
  else if (/\b(vari[áa]vel|varia|depende do m[êe]s|comiss[ãa]o)\b/.test(t)) set("income_type", "variable");
  if (/\b(carteira assinada|clt|registrad[oa])\b/.test(t)) set("work_type", "clt");
  else if (/\b(servidor|concursad[oa]|p[úu]blico)\b/.test(t)) set("work_type", "servidor");
  else if (/\b(aut[ôo]nom[oa]|freela|freelancer|bico|por conta)\b/.test(t)) set("work_type", "autonomo");
  else if (/\b(empreendedor|empres[áa]ri[oa]|meu neg[óo]cio|minha empresa|mei)\b/.test(t)) set("work_type", "empreendedor");
  else if (/\b(aposentad[oa])\b/.test(t)) set("work_type", "aposentado");
  else if (/\b(desempregad[oa]|sem emprego)\b/.test(t)) set("work_type", "desempregado");
  if (/\bn[ãa]o tenho (nenhuma )?d[íi]vidas?\b|\bsem d[íi]vidas?\b/.test(t)) set("has_debts", false);
  else if (/\b(tenho|estou com|t[ôo] com) (uma |umas |algumas |muitas )?d[íi]vidas?\b|\bendividad[oa]\b/.test(t)) set("has_debts", true);
  return out;
}

export function readAnswer(q: Question, text: string, a: Answers): Answer | null {
  const raw = text.trim();
  if (!raw) return null;
  if (UNKNOWN.test(raw)) return { value: null, certainty: "unknown", raw, skipped: true };
  if (q.type === "money") { const m = readMoney(raw); return m.value == null ? null : { value: m.value, certainty: m.certainty, raw }; }
  if (q.type === "yesno") { const y = readYesNo(raw); return y == null ? null : { value: y, certainty: "confirmed", raw }; }
  if (q.type === "days") { const d = parsePayDays(raw, q.id === "pay_days2" ? 2 : 1); return d ? { value: encodeDays(d.days, d.business), certainty: "confirmed", raw } : null; }
  const opts = typeof q.options === "function" ? q.options(a) : q.options || [];
  if (q.type === "choice" && q.id === "pay_weekday") { const w = parseWeekday(raw); return w == null ? null : { value: String(w), certainty: "confirmed", raw }; }
  if (q.type === "choice") { const m = matchOptions(raw, opts); return { value: m[0] || raw.slice(0, 200), certainty: "confirmed", raw }; }
  if (q.type === "multi") { const m = matchOptions(raw, opts); return { value: m.length ? m : [raw.slice(0, 120)], certainty: "confirmed", raw }; }
  return { value: raw.slice(0, 300), certainty: "confirmed", raw };
}

// ---------------------------------------------------------------- conversa financeira
const VARIABLE = (a: Answers) => has(a, "income_type", "variable") || has(a, "income_type", "mixed");
const DEBTS = (a: Answers) => yes(a, "has_debts");

export const DEBT_TYPES: Option[] = [
  { value: "cartao", label: "Cartão de crédito" }, { value: "cheque_especial", label: "Cheque especial" }, { value: "emprestimo", label: "Empréstimo pessoal" },
  { value: "consignado", label: "Consignado" }, { value: "financiamento", label: "Financiamento" }, { value: "contas_atrasadas", label: "Contas atrasadas" },
  { value: "familia", label: "Família ou amigos" }, { value: "outra", label: "Outra" },
];
export const GOAL_OPTIONS: Option[] = [
  { value: "sair_dividas", label: "Sair das dívidas" }, { value: "economizar", label: "Economizar todo mês" },
  { value: "reserva", label: "Montar uma reserva de emergência" }, { value: "comprar_bem", label: "Comprar um bem" },
  { value: "organizar", label: "Organizar minhas contas" },
];

export const FINANCE_FLOW: Question[] = [
  { id: "income", block: "Renda", type: "money", placeholder: "Ex.: uns 3 mil",
    ask: () => "Para começar: quanto você ganha por mês, mais ou menos? Pode ser um valor aproximado.",
    quick: [{ label: "Prefiro não dizer agora", value: null }] },
  { id: "income_type", block: "Renda", type: "choice", ask: () => "Sua renda é fixa todo mês ou varia?",
    options: [{ value: "fixed", label: "Fixa" }, { value: "variable", label: "Varia bastante" }, { value: "mixed", label: "Uma parte fixa, outra varia" }] },
  { id: "income_min", block: "Renda", type: "money", when: VARIABLE, placeholder: "Ex.: 1.800",
    ask: () => "Entendi. Num mês mais fraco, quanto costuma entrar?", hint: () => "Vou planejar pelo mês mais fraco, para você não ficar no aperto." },
  { id: "income_max", block: "Renda", type: "money", when: VARIABLE, ask: () => "E num mês bom?" },
  { id: "pay_frequency", block: "Renda", type: "choice", ask: () => "E de quanto em quanto tempo você recebe?",
    hint: () => "Assim eu te lembro no dia do pagamento e ajudo a dividir o dinheiro.",
    options: [{ value: "monthly", label: "Todo mês" }, { value: "biweekly", label: "A cada 15 dias" }, { value: "weekly", label: "Toda semana" }, { value: "irregular", label: "Sem data certa" }] },
  { id: "pay_days", block: "Renda", type: "days", when: a => has(a, "pay_frequency", "monthly"), placeholder: "Ex.: dia 5",
    ask: () => "Em que dia do mês o dinheiro costuma cair?",
    quick: [{ label: "Dia 5", value: "5" }, { label: "5º dia útil", value: "5u" }, { label: "Dia 10", value: "10" }, { label: "Dia 15", value: "15" }, { label: "Dia 20", value: "20" }, { label: "Último dia", value: "31" }] },
  { id: "pay_days2", block: "Renda", type: "days", when: a => has(a, "pay_frequency", "biweekly"), placeholder: "Ex.: 5 e 20",
    ask: () => "Em quais dias você recebe?",
    quick: [{ label: "Dias 5 e 20", value: "5,20" }, { label: "Dias 15 e 30", value: "15,30" }, { label: "Dias 1 e 15", value: "1,15" }, { label: "Dias 10 e 25", value: "10,25" }] },
  { id: "pay_weekday", block: "Renda", type: "choice", when: a => has(a, "pay_frequency", "weekly"), ask: () => "Em que dia da semana?",
    options: [{ value: "1", label: "Segunda" }, { value: "2", label: "Terça" }, { value: "3", label: "Quarta" }, { value: "4", label: "Quinta" }, { value: "5", label: "Sexta" }, { value: "6", label: "Sábado" }, { value: "0", label: "Domingo" }] },
  { id: "work_type", block: "Renda", type: "choice", ask: () => "Como você trabalha hoje?",
    options: [{ value: "clt", label: "Carteira assinada" }, { value: "servidor", label: "Servidor público" }, { value: "autonomo", label: "Autônomo(a)" },
      { value: "empreendedor", label: "Tenho meu negócio" }, { value: "aposentado", label: "Aposentado(a)" }, { value: "estudante", label: "Estudante" },
      { value: "desempregado", label: "Sem trabalho no momento" }, { value: "outro", label: "Outro" }] },
  { id: "other_income", block: "Renda", type: "yesno", ask: () => "Você tem outra fonte de renda? Aluguel, bico, pensão, vendas…" },
  { id: "other_income_amount", block: "Renda", type: "money", when: a => yes(a, "other_income"), ask: () => "Quanto ela rende por mês, mais ou menos?" },

  { id: "expenses", block: "Despesas", type: "money", placeholder: "Ex.: 2.500",
    ask: a => num(a, "income") ? "Agora os gastos. Quanto você costuma gastar por mês, somando tudo?" : "Agora os gastos. Quanto você costuma gastar por mês, somando tudo?",
    quick: [{ label: "Não faço ideia", value: null }] },
  { id: "housing", block: "Despesas", type: "money", ask: () => "Quanto vai para moradia? Aluguel, financiamento ou condomínio.",
    quick: [{ label: "Não pago moradia", value: 0 }] },
  { id: "food", block: "Despesas", type: "money", ask: () => "E com alimentação, contando mercado e delivery?" },
  { id: "transport", block: "Despesas", type: "money", ask: () => "Quanto gasta com transporte? Combustível, app, ônibus…", quick: [{ label: "Quase nada", value: 0 }] },
  { id: "main_expenses", block: "Despesas", type: "multi", ask: () => "Quais são suas principais despesas? Pode marcar mais de uma.",
    options: [{ value: "moradia", label: "Moradia" }, { value: "alimentacao", label: "Alimentação" }, { value: "transporte", label: "Transporte" },
      { value: "cartao", label: "Cartão de crédito" }, { value: "saude", label: "Saúde" }, { value: "educacao", label: "Educação" },
      { value: "filhos", label: "Filhos" }, { value: "lazer", label: "Lazer" }, { value: "assinaturas", label: "Assinaturas" }, { value: "outros", label: "Outros" }] },

  { id: "has_debts", block: "Dívidas", type: "yesno", ask: () => "Você tem alguma dívida hoje? Cartão, empréstimo, financiamento ou contas atrasadas." },
  { id: "debt_total", block: "Dívidas", type: "money", when: DEBTS, ask: () => "Somando tudo, quanto você deve, mais ou menos?", quick: [{ label: "Não sei o total", value: null }] },
  { id: "has_overdue", block: "Dívidas", type: "yesno", when: DEBTS, ask: () => "Alguma parcela está atrasada?" },
  { id: "debt_types", block: "Dívidas", type: "multi", when: DEBTS, options: DEBT_TYPES, ask: () => "Quais são essas dívidas?" },
  { id: "debt_capacity", block: "Dívidas", type: "money", when: DEBTS,
    ask: () => "Quanto você consegue separar por mês para pagar as dívidas?",
    hint: a => { const left = leftover(a); return left != null && left > 0 ? `Pelas suas respostas, sobram cerca de ${brl(left)} por mês.` : null; },
    quick: [{ label: "Nada por enquanto", value: 0 }] },

  { id: "difficulty", block: "Objetivos", type: "choice", ask: () => "Qual é a sua maior dificuldade com dinheiro hoje?",
    options: [{ value: "Não consigo economizar", label: "Não consigo economizar" }, { value: "Gasto mais do que ganho", label: "Gasto mais do que ganho" },
      { value: "Tenho muitas dívidas", label: "Tenho muitas dívidas" }, { value: "Não sei para onde vai meu dinheiro", label: "Não sei para onde vai o dinheiro" },
      { value: "Minha renda é instável", label: "Minha renda é instável" }] },
  { id: "goals", block: "Objetivos", type: "multi", ask: () => "E o que você mais quer conquistar? Pode marcar mais de uma.",
    options: a => GOAL_OPTIONS.filter(o => o.value !== "sair_dividas" || val(a, "has_debts") !== false) },
  { id: "purchase_goal", block: "Objetivos", type: "text", when: a => has(a, "goals", "comprar_bem"), placeholder: "Ex.: uma moto", ask: () => "Que bem você quer comprar?" },
  { id: "purchase_amount", block: "Objetivos", type: "money", when: a => has(a, "goals", "comprar_bem") && !!val(a, "purchase_goal"), ask: a => `Quanto custa ${String(val(a, "purchase_goal") || "esse bem")}, mais ou menos?` },
];

// ---------------------------------------------------------------- conversa do Personal (saúde — separada do financeiro)
export const PERSONAL_FLOW: Question[] = [
  { id: "p_goal", block: "Objetivo", type: "choice", ask: () => "Qual é o seu objetivo físico agora?",
    options: [{ value: "emagrecimento", label: "Perder peso" }, { value: "hipertrofia", label: "Ganhar massa" }, { value: "condicionamento", label: "Ganhar condicionamento" }, { value: "saude", label: "Saúde e bem-estar" }] },
  { id: "p_practices", block: "Experiência", type: "yesno", ask: () => "Você já pratica exercícios?" },
  { id: "p_level", block: "Experiência", type: "choice", when: a => yes(a, "p_practices"), ask: () => "Como você descreve seu nível hoje?",
    options: [{ value: "iniciante", label: "Iniciante" }, { value: "intermediario", label: "Intermediário" }, { value: "avancado", label: "Avançado" }] },
  { id: "p_location", block: "Rotina", type: "choice", ask: () => "Você vai treinar em casa ou na academia?",
    options: [{ value: "casa", label: "Em casa" }, { value: "academia", label: "Academia" }, { value: "ar_livre", label: "Ao ar livre" }, { value: "misto", label: "Um pouco de cada" }] },
  { id: "p_days", block: "Rotina", type: "choice", ask: () => "Quantos dias por semana você consegue treinar?",
    options: ["2", "3", "4", "5", "6"].map(d => ({ value: d, label: `${d} dias` })) },
  { id: "p_minutes", block: "Rotina", type: "choice", ask: () => "Quanto tempo você tem por treino?",
    options: ["20", "30", "45", "60", "90"].map(m => ({ value: m, label: `${m} min` })) },
  { id: "p_limitations", block: "Segurança", type: "text", placeholder: "Ex.: dor no joelho, orientação médica…",
    ask: () => "Tem alguma limitação, lesão ou orientação de um profissional que eu deva considerar?", quick: [{ label: "Nenhuma", value: "Nenhuma" }] },
];

// ---------------------------------------------------------------- navegação
export function applicable(flow: Question[], a: Answers) { return flow.filter(q => !q.when || q.when(a)); }
export function nextQuestion(flow: Question[], a: Answers): Question | null { return applicable(flow, a).find(q => !(q.id in a)) || null; }
export function progress(flow: Question[], a: Answers) {
  const list = applicable(flow, a); const done = list.filter(q => q.id in a).length;
  return { done, total: list.length, pct: list.length ? Math.round((done / list.length) * 100) : 0 };
}
export function optionsOf(q: Question, a: Answers): Option[] { return typeof q.options === "function" ? q.options(a) : q.options || []; }
export function labelOf(q: Question, a: Answers, v: AnswerValue): string {
  if (v == null) return "Pulei";
  if (q.type === "money") return brl(Number(v));
  if (q.type === "yesno") return v ? "Sim" : "Não";
  if (q.type === "days") { const d = decodeDays(v); if (!d) return String(v); return d.business ? `${d.days.join("º e ")}º dia útil` : d.days.length > 1 ? `Dias ${d.days.join(" e ")}` : d.days[0] === 31 ? "Último dia do mês" : `Dia ${d.days[0]}`; }
  const opts = optionsOf(q, a);
  if (Array.isArray(v)) return v.map(x => opts.find(o => o.value === x)?.label || x).join(", ");
  return opts.find(o => o.value === v)?.label || String(v);
}

// Respostas aceitas pelo servidor: só ids conhecidos e tipos coerentes (nada vindo do navegador é aceito às cegas).
export function sanitizeAnswers(flow: Question[], input: unknown): Answers {
  const out: Answers = {}; if (!input || typeof input !== "object") return out;
  for (const q of flow) {
    const a = (input as Record<string, unknown>)[q.id] as Partial<Answer> | undefined; if (!a || typeof a !== "object") continue;
    const certainty: Certainty = a.certainty === "estimated" || a.certainty === "unknown" ? a.certainty : "confirmed";
    const raw = typeof a.raw === "string" ? a.raw.slice(0, 300) : undefined;
    if (a.skipped || a.value == null) { out[q.id] = { value: null, certainty: "unknown", skipped: true, raw }; continue; }
    let v: AnswerValue = null;
    if (q.type === "money") { const n = Number(a.value); if (Number.isFinite(n) && n >= 0 && n <= 100000000) v = Math.round(n * 100) / 100; }
    else if (q.type === "yesno") { if (typeof a.value === "boolean") v = a.value; }
    else if (q.type === "days") { const d = decodeDays(a.value); if (d) v = encodeDays(d.days, d.business); }
    else if (q.type === "multi") { if (Array.isArray(a.value)) v = a.value.filter(x => typeof x === "string").slice(0, 12).map(x => x.slice(0, 120)); }
    else if (typeof a.value === "string") v = a.value.trim().slice(0, 300);
    if (v === null || (Array.isArray(v) && !v.length) || v === "") continue;
    out[q.id] = { value: v, certainty, raw, inferred: Boolean(a.inferred) };
  }
  return out;
}

// ---------------------------------------------------------------- diagnóstico (determinístico)
export function incomeBase(a: Answers) {
  const main = VARIABLE(a) ? (num(a, "income_min") ?? num(a, "income")) : num(a, "income");
  if (main == null) return null;
  return main + (yes(a, "other_income") ? (num(a, "other_income_amount") ?? 0) : 0);
}
export function totalExpenses(a: Answers) {
  const total = num(a, "expenses"); const parts = ["housing", "food", "transport"].map(k => num(a, k)).filter((x): x is number => x != null);
  const sumParts = parts.reduce((s, x) => s + x, 0);
  if (total == null && !parts.length) return null;
  return Math.max(total ?? 0, sumParts);
}
export function leftover(a: Answers) { const i = incomeBase(a); const e = totalExpenses(a); return i == null || e == null ? null : i - e; }

export type PlanAction = { id: string; kind: "budget" | "daily_limit" | "goal"; label: string; detail: string; amount: number; certainty: Certainty; category?: string; title?: string; monthly?: number };
export type Diagnosis = {
  focus: "debts" | "spending" | "variable" | "saving" | "organize"; focusTitle: string;
  income: number | null; incomeCertainty: Certainty; expenses: number | null; expensesCertainty: Certainty; leftover: number | null;
  commitmentPct: number | null; debtTotal: number | null; debtMonthsToPay: number | null;
  flags: { id: string; text: string; severity: "high" | "medium" | "info" }[]; recommendations: string[]; actions: PlanAction[];
  unknown: string[]; goals: string[];
};

const certOf = (a: Answers, ...ids: string[]): Certainty => {
  const cs = ids.map(id => a[id]).filter(Boolean).filter(x => !x.skipped).map(x => x.certainty);
  if (!cs.length) return "unknown"; return cs.includes("estimated") ? "estimated" : "confirmed";
};

export function diagnose(a: Answers): Diagnosis {
  // Sem o total informado, a soma das categorias é só um piso: nunca é tratada como valor confirmado.
  const expCert: Certainty = a.expenses && !a.expenses.skipped ? certOf(a, "expenses", "housing", "food", "transport") : (["housing", "food", "transport"].some(k => num(a, k) != null) ? "estimated" : "unknown");
  const income = incomeBase(a); const expenses = totalExpenses(a); const left = income != null && expenses != null ? income - expenses : null;
  const debtTotal = DEBTS(a) ? num(a, "debt_total") : null; const capacity = DEBTS(a) ? num(a, "debt_capacity") : null;
  const housing = num(a, "housing"); const goals = (val(a, "goals") as string[] | null) || [];
  const flags: Diagnosis["flags"] = [];
  const commitmentPct = income && expenses != null ? Math.round((expenses / income) * 100) : null;
  if (left != null && left < 0) flags.push({ id: "deficit", severity: "high", text: `Os gastos informados passam a renda em ${brl(-left)} por mês.` });
  else if (commitmentPct != null && commitmentPct >= 90) flags.push({ id: "tight", severity: "medium", text: `Os gastos consomem ${commitmentPct}% da renda: sobra pouco para imprevistos.` });
  if (housing != null && income && housing / income > 0.35) flags.push({ id: "housing", severity: "medium", text: `Moradia leva ${Math.round((housing / income) * 100)}% da renda (o ideal é até cerca de 30%).` });
  if (yes(a, "has_overdue")) flags.push({ id: "overdue", severity: "high", text: "Há parcelas atrasadas: elas costumam gerar juros e multa todo mês." });
  if (debtTotal && income && debtTotal > income * 3) flags.push({ id: "debt_heavy", severity: "high", text: "As dívidas somam mais de 3 meses de renda." });
  if (has(a, "debt_types", "cartao") || has(a, "debt_types", "cheque_especial")) flags.push({ id: "expensive_debt", severity: "medium", text: "Cartão e cheque especial têm os juros mais altos: vale priorizá-los." });
  if (VARIABLE(a)) flags.push({ id: "variable", severity: "info", text: "Como a renda varia, o planejamento usa o valor de um mês fraco." });
  if (income == null) flags.push({ id: "no_income", severity: "info", text: "A renda ficou em aberto: o planejamento fica mais preciso quando você informar." });

  const focus: Diagnosis["focus"] = DEBTS(a) && (yes(a, "has_overdue") || goals.includes("sair_dividas") || has(a, "difficulty", "Tenho muitas dívidas")) ? "debts"
    : (left != null && left < 0) || has(a, "difficulty", "Não consigo economizar") || has(a, "difficulty", "Gasto mais do que ganho") || has(a, "difficulty", "Não sei para onde vai meu dinheiro") ? "spending"
    : VARIABLE(a) ? "variable" : goals.includes("reserva") || goals.includes("economizar") || goals.includes("comprar_bem") ? "saving" : "organize";
  const focusTitle = { debts: "Sair das dívidas", spending: "Controlar os gastos", variable: "Planejar com renda variável", saving: "Guardar dinheiro", organize: "Organizar a vida financeira" }[focus];

  const recommendations: string[] = [];
  if (focus === "debts") { recommendations.push("Liste cada dívida com valor e juros e comece pelas mais caras (cartão e cheque especial)."); if (yes(a, "has_overdue")) recommendations.push("Negocie primeiro as parcelas atrasadas: muitos credores oferecem desconto para quitar."); }
  if (left != null && left < 0) recommendations.push("Corte primeiro o que não é essencial até os gastos caberem na renda.");
  if (focus === "spending" || has(a, "difficulty", "Não sei para onde vai meu dinheiro")) recommendations.push("Registre cada gasto na VIVA por 30 dias para descobrir para onde vai o dinheiro.");
  if (VARIABLE(a)) recommendations.push("Nos meses bons, guarde a diferença para cobrir os meses fracos.");
  if (goals.includes("reserva") || focus === "saving") recommendations.push("Separe um valor fixo logo que o dinheiro entrar, antes de gastar.");
  if (!recommendations.length) recommendations.push("Acompanhe seus gastos semanalmente e revise o orçamento no fim do mês.");

  const actions: PlanAction[] = [];
  const budget = (id: string, category: string, key: string) => { const v = num(a, key); if (v != null && v > 0) actions.push({ id, kind: "budget", category, label: `Orçamento de ${category}`, detail: `Limite mensal de ${brl(v)}`, amount: v, certainty: a[key].certainty }); };
  budget("budget_moradia", "Moradia", "housing"); budget("budget_alimentacao", "Alimentação", "food"); budget("budget_transporte", "Transporte", "transport");
  if (income != null && housing != null) {
    const saving = left != null && left > 0 ? Math.round(Math.min(left * 0.5, income * 0.1)) : 0;
    const daily = Math.floor((income - housing - (capacity ?? 0) - saving) / 30);
    if (daily > 0) actions.push({ id: "daily_limit", kind: "daily_limit", label: "Limite de gasto diário", detail: `Até ${brl(daily)} por dia no dia a dia`, amount: daily, certainty: certOf(a, "income", "income_min", "housing", "debt_capacity") });
  }
  if (DEBTS(a) && debtTotal && debtTotal > 0) {
    const monthly = capacity && capacity > 0 ? capacity : undefined;
    actions.push({ id: "goal_dividas", kind: "goal", title: "Sair das dívidas", label: "Meta: sair das dívidas", detail: `Quitar ${brl(debtTotal)}${monthly ? ` pagando ${brl(monthly)} por mês` : ""}`, amount: debtTotal, monthly, certainty: a.debt_total.certainty });
  }
  if ((goals.includes("reserva") || goals.includes("economizar")) && expenses && expenses > 0) {
    const target = Math.round(expenses * 3);
    actions.push({ id: "goal_reserva", kind: "goal", title: "Reserva de emergência", label: "Meta: reserva de emergência", detail: `Juntar ${brl(target)} (3 meses dos seus gastos)`, amount: target, certainty: expCert });
  }
  const pAmount = num(a, "purchase_amount"); const pGoal = val(a, "purchase_goal");
  if (goals.includes("comprar_bem") && pAmount && pGoal) actions.push({ id: "goal_compra", kind: "goal", title: String(pGoal).slice(0, 100), label: `Meta: ${String(pGoal)}`, detail: `Juntar ${brl(pAmount)}`, amount: pAmount, certainty: a.purchase_amount.certainty });

  const debtMonthsToPay = debtTotal && capacity && capacity > 0 ? Math.ceil(debtTotal / capacity) : null;
  const unknown = FINANCE_FLOW.filter(q => (!q.when || q.when(a)) && (!(q.id in a) || a[q.id].skipped)).map(q => q.ask(a));
  return { focus, focusTitle, income, incomeCertainty: certOf(a, "income", "income_min"), expenses, expensesCertainty: expCert,
    leftover: left, commitmentPct, debtTotal, debtMonthsToPay, flags, recommendations: recommendations.slice(0, 4), actions, unknown, goals };
}

// Converte as respostas no perfil financeiro salvo (somente o que foi respondido).
export function toFinanceProfile(a: Answers, d: Diagnosis) {
  const certainty: Record<string, Certainty> = {};
  for (const q of FINANCE_FLOW) if (a[q.id]) certainty[q.id] = a[q.id].skipped ? "unknown" : a[q.id].certainty;
  const arr = (id: string) => (Array.isArray(val(a, id)) ? (val(a, id) as string[]) : []);
  const typeVal = val(a, "income_type"); const workVal = val(a, "work_type");
  return {
    monthly_income: num(a, "income"), income_type: ["fixed", "variable", "mixed"].includes(String(typeVal)) ? String(typeVal) : null,
    income_min: num(a, "income_min"), income_max: num(a, "income_max"),
    work_type: ["clt", "servidor", "autonomo", "empreendedor", "desempregado", "aposentado", "estudante", "outro"].includes(String(workVal)) ? String(workVal) : (workVal ? "outro" : null),
    has_other_income: typeof val(a, "other_income") === "boolean" ? (val(a, "other_income") as boolean) : null, other_income_amount: num(a, "other_income_amount"),
    monthly_expenses: num(a, "expenses"), housing_cost: num(a, "housing"), food_cost: num(a, "food"), transport_cost: num(a, "transport"), main_expenses: arr("main_expenses"),
    has_debts: typeof val(a, "has_debts") === "boolean" ? (val(a, "has_debts") as boolean) : null, debt_total: num(a, "debt_total"),
    has_overdue: typeof val(a, "has_overdue") === "boolean" ? (val(a, "has_overdue") as boolean) : null, debt_types: arr("debt_types"), debt_payment_capacity: num(a, "debt_capacity"),
    main_difficulty: val(a, "difficulty") ? String(val(a, "difficulty")).slice(0, 300) : null, goals: arr("goals"),
    purchase_goal: val(a, "purchase_goal") ? String(val(a, "purchase_goal")).slice(0, 120) : null, purchase_amount: num(a, "purchase_amount") || null,
    ...paySchedule(a),
    certainty, focus: d.focus,
    diagnosis: { focusTitle: d.focusTitle, flags: d.flags, recommendations: d.recommendations, leftover: d.leftover, commitmentPct: d.commitmentPct, debtMonthsToPay: d.debtMonthsToPay },
  };
}

function paySchedule(a: Answers) {
  const f = val(a, "pay_frequency");
  const freq = ["monthly", "biweekly", "weekly", "irregular"].includes(String(f)) ? String(f) : null;
  const d = decodeDays(val(a, freq === "biweekly" ? "pay_days2" : "pay_days"));
  const w = Number(val(a, "pay_weekday"));
  return {
    pay_frequency: freq,
    pay_days: (freq === "monthly" || freq === "biweekly") && d ? d.days : [],
    pay_business_day: (freq === "monthly" || freq === "biweekly") && d ? d.business : false,
    pay_weekday: freq === "weekly" && Number.isInteger(w) && w >= 0 && w <= 6 ? w : null,
  };
}

// Reconstrói as respostas a partir do perfil salvo (para recalcular o diagnóstico após uma atualização).
export const PROFILE_CERT_KEY: Record<string, string> = {
  monthly_income: "income", monthly_expenses: "expenses", housing_cost: "housing", food_cost: "food", transport_cost: "transport",
  debt_payment_capacity: "debt_capacity", main_difficulty: "difficulty", has_other_income: "other_income", income_type: "income_type",
  income_min: "income_min", income_max: "income_max", work_type: "work_type", other_income_amount: "other_income_amount", has_debts: "has_debts",
  debt_total: "debt_total", has_overdue: "has_overdue", purchase_goal: "purchase_goal", purchase_amount: "purchase_amount",
};
export function profileToAnswers(p: Record<string, unknown>): Answers {
  const c = (p.certainty || {}) as Record<string, Certainty>; const out: Answers = {};
  const put = (id: string, v: unknown) => { if (v === null || v === undefined || (Array.isArray(v) && !v.length)) return; out[id] = { value: (typeof v === "string" && /^\d+(\.\d+)?$/.test(v) ? Number(v) : v) as AnswerValue, certainty: c[id] === "estimated" ? "estimated" : "confirmed" }; };
  for (const [col, id] of Object.entries(PROFILE_CERT_KEY)) put(id, p[col]);
  put("main_expenses", p.main_expenses); put("debt_types", p.debt_types); put("goals", p.goals);
  return out;
}
