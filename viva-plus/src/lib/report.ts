import { addDays, todayBR } from "@/lib/payday";

// Relatório semanal e mensal: montado por código (sem IA e sem gastar créditos).
// Usado pela tela /relatorio, pela notificação de domingo à noite e pela do dia 1º.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };

export type ReportPeriod = "semana" | "semana-passada" | "mes" | "mes-passado";
export const REPORT_PERIODS: { id: ReportPeriod; label: string }[] = [
  { id: "semana", label: "Esta semana" },
  { id: "semana-passada", label: "Semana passada" },
  { id: "mes", label: "Este mês" },
  { id: "mes-passado", label: "Mês passado" },
];

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
export const monthName = (d: string) => MONTHS[Number(d.slice(5, 7)) - 1];

/** Segunda-feira da semana de `date` (AAAA-MM-DD). */
export function weekStart(date: string) {
  const dow = new Date(date + "T12:00:00Z").getUTCDay(); // 0 = domingo
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}
function monthStart(date: string) { return date.slice(0, 8) + "01"; }
function prevMonthStart(date: string) { const [y, m] = date.split("-").map(Number); return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`; }
function monthEnd(start: string) { const [y, m] = start.split("-").map(Number); return addDays(m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`, -1); }

export type ReportRange = { period: ReportPeriod; kind: "semana" | "mes"; from: string; to: string; until: string; prevFrom: string; prevTo: string; title: string; subtitle: string; prevLabel: string };

/** Datas do período. `until` é o último dia já vivido (hoje, num período em andamento). */
export function reportRange(period: ReportPeriod, today = todayBR()): ReportRange {
  if (period === "semana" || period === "semana-passada") {
    const from = period === "semana" ? weekStart(today) : addDays(weekStart(today), -7);
    const to = addDays(from, 6);
    const until = to < today ? to : today;
    const elapsed = Math.round((Date.parse(until) - Date.parse(from)) / 86400000);
    return { period, kind: "semana", from, to, until, prevFrom: addDays(from, -7), prevTo: addDays(from, -7 + elapsed), title: period === "semana" ? "Sua semana" : "Semana passada", subtitle: `${dm(from)} a ${dm(to)}`, prevLabel: "a semana anterior" };
  }
  const from = period === "mes" ? monthStart(today) : prevMonthStart(today);
  const to = monthEnd(from);
  const until = to < today ? to : today;
  const prevFrom = prevMonthStart(from);
  const prevTo = period === "mes-passado" ? monthEnd(prevFrom) : (() => { const day = Math.min(Number(until.slice(8, 10)), Number(monthEnd(prevFrom).slice(8, 10))); return prevFrom.slice(0, 8) + String(day).padStart(2, "0"); })();
  const name = monthName(from);
  return { period, kind: "mes", from, to, until, prevFrom, prevTo, title: name[0].toUpperCase() + name.slice(1), subtitle: period === "mes" ? `1º a ${dm(until)}` : `mês completo`, prevLabel: period === "mes" ? `o mesmo período de ${monthName(prevFrom)}` : monthName(prevFrom) };
}

export type CategoryRow = { name: string; amount: number; share: number };
export type Report = {
  range: ReportRange;
  spent: number; income: number; balance: number;
  count: number; days: number; avgPerDay: number; daysWithoutSpending: number;
  prevSpent: number; changePct: number | null;
  categories: CategoryRow[];
  biggest: { description: string; amount: number; date: string } | null;
  billsPaid: { count: number; amount: number };
  billsNext7: { count: number; amount: number };
};

type TxRow = { kind: string; amount: number | string; category: string | null; description: string | null; occurred_on: string };

export async function buildReport(db: Db, userId: string, range: ReportRange, today = todayBR()): Promise<Report> {
  const [cur, prev, paid, next] = await Promise.all([
    db.from("viva_transactions").select("kind,amount,category,description,occurred_on").eq("user_id", userId).gte("occurred_on", range.from).lte("occurred_on", range.until).limit(5000),
    db.from("viva_transactions").select("amount").eq("user_id", userId).eq("kind", "expense").gte("occurred_on", range.prevFrom).lte("occurred_on", range.prevTo).limit(5000),
    db.from("viva_bills").select("amount").eq("user_id", userId).eq("status", "paid").gte("updated_at", range.from + "T00:00:00-03:00").lte("updated_at", range.until + "T23:59:59-03:00").limit(500),
    db.from("viva_bills").select("amount").eq("user_id", userId).neq("status", "paid").gte("due_date", today).lte("due_date", addDays(today, 7)).limit(200),
  ]);
  for (const r of [cur, prev]) if (r.error) throw r.error;
  const rows = (cur.data || []) as TxRow[];
  const expenses = rows.filter(r => r.kind === "expense");
  const sum = (xs: { amount: number | string }[]) => Math.round(xs.reduce((s, x) => s + Number(x.amount || 0), 0) * 100) / 100;
  const spent = sum(expenses);
  const income = sum(rows.filter(r => r.kind === "income"));
  const prevSpent = sum((prev.data || []) as { amount: number }[]);

  const byCat = new Map<string, number>();
  for (const e of expenses) { const k = (e.category || "Outros").trim() || "Outros"; byCat.set(k, (byCat.get(k) || 0) + Number(e.amount || 0)); }
  const categories = [...byCat].map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100, share: spent > 0 ? amount / spent : 0 })).sort((a, b) => b.amount - a.amount);

  const top = expenses.reduce<TxRow | null>((best, e) => (!best || Number(e.amount) > Number(best.amount) ? e : best), null);
  const days = Math.round((Date.parse(range.until) - Date.parse(range.from)) / 86400000) + 1;
  const spendDays = new Set(expenses.map(e => e.occurred_on)).size;
  const paidRows = (paid.error ? [] : paid.data || []) as { amount: number }[];
  const nextRows = (next.error ? [] : next.data || []) as { amount: number }[];

  return {
    range, spent, income, balance: Math.round((income - spent) * 100) / 100,
    count: expenses.length, days, avgPerDay: days > 0 ? spent / days : 0, daysWithoutSpending: Math.max(0, days - spendDays),
    prevSpent, changePct: prevSpent > 0 ? (spent - prevSpent) / prevSpent : null,
    categories,
    biggest: top ? { description: String(top.description || top.category || "Gasto"), amount: Number(top.amount), date: top.occurred_on } : null,
    billsPaid: { count: paidRows.length, amount: sum(paidRows) },
    billsNext7: { count: nextRows.length, amount: sum(nextRows) },
  };
}

export const brl = (n: number) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Frase curta de comparação ("12% a menos que a semana anterior"). */
export function changeText(r: Report) {
  if (r.changePct === null) return null;
  const pct = Math.round(Math.abs(r.changePct) * 100);
  if (pct < 3) return `quase igual a ${r.range.prevLabel}`;
  return `${pct}% a ${r.changePct < 0 ? "menos" : "mais"} que ${r.range.prevLabel}`;
}

/** Texto da notificação / mensagem do WhatsApp. */
export function reportMessage(r: Report, whatsapp = false) {
  const b = (s: string) => (whatsapp ? `*${s}*` : s);
  const parts: string[] = [];
  if (r.range.kind === "semana") {
    parts.push(`Você gastou ${b(brl(r.spent))} ${r.range.period === "semana" ? "nesta semana" : "na semana passada"}${changeText(r) ? ` (${changeText(r)})` : ""}.`);
  } else {
    parts.push(`Em ${monthName(r.range.from)}${r.range.period === "mes" ? " (até agora)" : ""} entrou ${b(brl(r.income))} e saiu ${b(brl(r.spent))}${r.income > 0 ? (r.balance >= 0 ? `: sobrou ${b(brl(r.balance))} 🎉` : `: faltou ${b(brl(-r.balance))}`) : ""}.`);
  }
  const top = r.categories[0];
  if (top) parts.push(`Onde mais foi: ${top.name} (${Math.round(top.share * 100)}%).`);
  if (r.daysWithoutSpending > 0 && r.range.kind === "semana") parts.push(`${r.daysWithoutSpending} ${r.daysWithoutSpending === 1 ? "dia" : "dias"} sem gastar 💪`);
  if (r.billsNext7.count > 0) parts.push(`${r.billsNext7.count} ${r.billsNext7.count === 1 ? "conta vence" : "contas vencem"} nos próximos 7 dias.`);
  return parts.join(" ");
}
