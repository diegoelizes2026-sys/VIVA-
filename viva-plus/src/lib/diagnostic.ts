// Diagnóstico Financeiro Grátis: perguntas, cálculo do resultado e dicas. Usado na página e no servidor
// (o servidor recalcula o resultado; nunca confia no que veio do navegador).

export type Debts = "nao" | "poucas" | "muitas";
export type Control = "sempre" | "as_vezes" | "quase_nunca";
export type Goal = "dividas" | "reserva" | "comprar" | "organizar";
export type Health = "sim" | "talvez" | "nao";
export type Answers = { income: number; payday: number; fixed: number; debts: Debts; control: Control; goal: Goal; health: Health };
export type Level = "atencao" | "construcao" | "caminho";
export type Result = { daily: number | null; leftover: number; leftoverPct: number; daysToPay: number; nextPayday: string; level: Level; negative: boolean; tips: string[] };

export const DEBTS: [Debts, string][] = [["nao", "Não"], ["poucas", "Sim, poucas"], ["muitas", "Sim, muitas"]];
export const CONTROL: [Control, string][] = [["sempre", "Sempre"], ["as_vezes", "Às vezes"], ["quase_nunca", "Quase nunca"]];
export const GOALS: [Goal, string][] = [["dividas", "Sair das dívidas"], ["reserva", "Criar uma reserva"], ["comprar", "Comprar algo"], ["organizar", "Só organizar a vida"]];
export const HEALTH: [Health, string][] = [["sim", "Sim"], ["talvez", "Talvez depois"], ["nao", "Não"]];
export const LEVEL_LABEL: Record<Level, string> = { atencao: "Atenção", construcao: "Em construção", caminho: "No caminho certo" };

const TZ = "America/Fortaleza";
export function todayParts(now = new Date()) {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Dias até o próximo pagamento (mínimo 1). Se o dia não existe no mês (ex.: 31), usa o último dia do mês. */
export function daysUntilPayday(payday: number, now = new Date()) {
  const { y, m, d } = todayParts(now);
  let ty = y, tm = m;
  let target = Math.min(payday, lastDay(ty, tm));
  if (d >= target) { tm += 1; if (tm > 12) { tm = 1; ty += 1; } target = Math.min(payday, lastDay(ty, tm)); }
  const days = Math.round((Date.UTC(ty, tm - 1, target) - Date.UTC(y, m - 1, d)) / 86400000);
  return { days: Math.max(1, days), date: `${ty}-${String(tm).padStart(2, "0")}-${String(target).padStart(2, "0")}` };
}

export function computeResult(a: Answers, now = new Date()): Result {
  const leftover = Math.round((a.income - a.fixed) * 100) / 100;
  const negative = leftover <= 0;
  const leftoverPct = a.income > 0 ? Math.round((leftover / a.income) * 100) : 0;
  const { days, date } = daysUntilPayday(a.payday, now);
  const daily = negative ? null : Math.floor((leftover / days) * 100) / 100;
  // Faixa: sobra, dívidas e controle (0 a 6 pontos).
  const pts = (negative ? 0 : leftoverPct >= 20 ? 2 : leftoverPct >= 10 ? 1 : 0)
    + (a.debts === "nao" ? 2 : a.debts === "poucas" ? 1 : 0)
    + (a.control === "sempre" ? 2 : a.control === "as_vezes" ? 1 : 0);
  const level: Level = negative || pts <= 2 ? "atencao" : pts <= 4 ? "construcao" : "caminho";
  return { daily, leftover, leftoverPct, daysToPay: days, nextPayday: date, level, negative, tips: pickTips(a, negative, leftoverPct) };
}

function pickTips(a: Answers, negative: boolean, pct: number): string[] {
  const out: string[] = [];
  const add = (t: string) => { if (!out.includes(t) && out.length < 3) out.push(t); };
  if (negative) add("Comece listando as contas fixas e veja quais dá para renegociar, trocar por uma opção mais barata ou pausar por um tempo. Pequenos ajustes já fazem diferença no mês.");
  if (a.debts === "muitas") add("Anote todas as dívidas com valor e juros. Priorize as de juros mais altos, como cartão e cheque especial, e procure o credor para negociar uma parcela que caiba no mês.");
  if (a.debts === "poucas") add("Organize as parcelas atrasadas por data e juros. Quitar primeiro a de juros mais altos costuma aliviar mais rápido.");
  if (a.control === "quase_nunca") add("Por 7 dias, anote cada gasto, até os pequenos. Ver para onde o dinheiro vai é o primeiro passo para decidir o que manter.");
  if (a.control === "as_vezes") add("Escolha um momento do dia para revisar os gastos, como antes de dormir. Leva 2 minutos e evita surpresas no fim do mês.");
  if (a.goal === "dividas") add("Antes de assumir uma nova parcela, confira se ela cabe no seu número do dia. Isso ajuda a não criar outra dívida enquanto paga as atuais.");
  if (a.goal === "reserva") add("Separe um valor para a reserva assim que o dinheiro cair, mesmo que pequeno. Guardar primeiro e gastar depois funciona melhor do que esperar sobrar.");
  if (a.goal === "comprar") add("Defina o preço e o prazo da compra e divida pelo número de meses. Assim você sabe quanto guardar por mês e evita parcelar com juros.");
  if (a.goal === "organizar") add("Use o seu número do dia como limite: se um dia gastar menos, a sobra ajuda nos dias seguintes.");
  if (!negative && pct < 10) add("Gastos pequenos e frequentes, como lanches e aplicativos, somam muito no mês. Vale olhar para eles primeiro.");
  if (!negative && pct >= 20) add("Você já tem uma boa sobra depois das contas. Decida um destino para ela antes que ela suma nos gastos do dia a dia.");
  add("Revise as contas fixas uma vez por ano: internet, celular e assinaturas costumam ter planos mais baratos.");
  return out;
}

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
/** "1.234,56" ou "1234,56" ou "1234.56" -> 1234.56. Inválido -> NaN. */
export function parseMoney(s: string) {
  const t = String(s).replace(/[^\d,.]/g, "");
  if (!t) return NaN;
  const norm = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : /\.\d{3}(\.|$)/.test(t) ? t.replace(/\./g, "") : t;
  const n = Number(norm);
  return Number.isFinite(n) ? n : NaN;
}

/** Celular brasileiro: aceita (85) 99999-0000, +55..., e devolve 55 + DDD + número, ou null. */
export function normalizeWhatsapp(s: string) {
  let d = String(s).replace(/\D/g, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length !== 11 || !/^[1-9][1-9]9/.test(d)) return null; // celular: DDD + 9 + 8 dígitos
  return "55" + d;
}

/** Número oficial da VIVA no WhatsApp (o mesmo do resto do site). */
export const VIVA_WHATSAPP = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "558588252048").replace(/\D/g, "");
export const CONSENT_TEXT = "Quero receber mensagens e novidades do VIVA+ no WhatsApp. Posso sair quando quiser.";
