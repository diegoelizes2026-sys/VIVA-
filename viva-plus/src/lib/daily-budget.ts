import { addDays, daysBetween } from "@/lib/payday";

// "Número do dia": quanto a pessoa pode gastar hoje sem comprometer as contas
// até o próximo pagamento (ou o fim do mês). Conta simples, sem IA e sem créditos.
//
// Ciclo: do último pagamento até a véspera do próximo (se a pessoa informou quando recebe);
// senão, o mês do calendário.

export type DayTx = { kind: string; amount: number | string; occurred_on: string };
export type DayBill = { amount: number | string; due_date: string };
export type BudgetStatus = "green" | "amber" | "red";
export type Forecast = { kind: "runs_out"; date: string; daysEarly: number } | { kind: "leftover"; amount: number } | null;

export type TodayBudget =
  | { mode: "setup" }
  | {
      mode: "dynamic" | "limit";
      allowance: number;        // quanto dá para gastar hoje (calculado no começo do dia)
      spentToday: number;
      remaining: number;        // allowance - spentToday (negativo = passou)
      status: BudgetStatus;
      daysLeft: number;         // dias até a véspera do próximo pagamento / fim do mês (inclui hoje)
      horizonLabel: string;     // "o próximo pagamento" | "o fim do mês"
      estimatedIncome: boolean; // usou a renda informada no perfil (ainda sem receita lançada no ciclo)
      forecast: Forecast;
    };

const round = (n: number) => Math.round(n * 100) / 100;
export function lastDayOfMonth(today: string) {
  const [y, m] = today.split("-").map(Number);
  return `${today.slice(0, 7)}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
}

/** Define o ciclo atual a partir do último e do próximo pagamento (quando conhecidos). */
export function currentCycle(today: string, lastPayday: string | null, nextPayday: string | null) {
  const regular = Boolean(lastPayday && nextPayday && lastPayday <= today && nextPayday > today && daysBetween(lastPayday, nextPayday) <= 45);
  if (regular) return { start: lastPayday!, end: addDays(nextPayday!, -1), horizonLabel: "o próximo pagamento" };
  return { start: today.slice(0, 8) + "01", end: lastDayOfMonth(today), horizonLabel: "o fim do mês" };
}

export function computeTodayBudget(input: {
  today: string;
  cycle: { start: string; end: string; horizonLabel: string };
  tx: DayTx[];                  // lançamentos de pelo menos o ciclo inteiro
  bills: DayBill[];             // contas não pagas a partir de hoje
  dailyLimit: number | null;
  expectedCycleIncome: number | null; // renda do perfil para um ciclo, usada só se nada entrou ainda
}): TodayBudget {
  const { today, cycle, bills, dailyLimit, expectedCycleIncome } = input;
  const tx = input.tx.filter(x => x.occurred_on >= cycle.start && x.occurred_on <= today);
  const sum = (rows: { amount: number | string }[]) => rows.reduce((a, x) => a + Number(x.amount || 0), 0);
  const incomeTx = sum(tx.filter(x => x.kind === "income"));
  const expenses = tx.filter(x => x.kind === "expense");
  const spentToday = round(sum(expenses.filter(x => x.occurred_on === today)));
  const spentBefore = sum(expenses.filter(x => x.occurred_on < today));
  const spentCycle = spentBefore + spentToday;

  const estimatedIncome = incomeTx <= 0 && !!expectedCycleIncome && expectedCycleIncome > 0;
  const income = incomeTx > 0 ? incomeTx : estimatedIncome ? Number(expectedCycleIncome) : 0;
  const daysLeft = Math.max(1, daysBetween(today, cycle.end) + 1);
  const billsDue = sum(bills.filter(b => b.due_date >= today && b.due_date <= cycle.end));
  const base = { spentToday, daysLeft, horizonLabel: cycle.horizonLabel };

  if (income <= 0) {
    if (!dailyLimit || dailyLimit <= 0) return { mode: "setup" };
    const allowance = round(dailyLimit);
    const remaining = round(allowance - spentToday);
    return { mode: "limit", allowance, remaining, status: remaining <= 0 ? "red" : remaining < allowance * 0.35 ? "amber" : "green", estimatedIncome: false, forecast: null, ...base };
  }

  // Calculado com o que havia no começo do dia, para o número não "fugir" a cada gasto de hoje.
  const availableAtStart = income - spentBefore - billsDue;
  let allowance = Math.max(0, availableAtStart / daysLeft);
  if (dailyLimit && dailyLimit > 0) allowance = Math.min(allowance, dailyLimit);
  allowance = Math.floor(allowance * 100) / 100;
  const remaining = round(allowance - spentToday);

  // Previsão: no ritmo de gasto do ciclo, até quando o dinheiro dura?
  const daysElapsed = daysBetween(cycle.start, today) + 1;
  const pace = daysElapsed >= 3 ? spentCycle / daysElapsed : 0;
  const leftNow = income - spentCycle - billsDue;
  let forecast: Forecast = null;
  if (pace > 0) {
    if (leftNow <= 0) forecast = { kind: "runs_out", date: today, daysEarly: daysBetween(today, cycle.end) };
    else {
      const runOut = addDays(today, Math.floor(leftNow / pace));
      forecast = runOut < cycle.end
        ? { kind: "runs_out", date: runOut, daysEarly: daysBetween(runOut, cycle.end) }
        : { kind: "leftover", amount: Math.max(0, round(leftNow - pace * (daysLeft - 1))) };
    }
  }

  // Referência de um dia "normal" do ciclo, para perceber quando o valor de hoje está apertado.
  const cycleDays = Math.max(1, daysBetween(cycle.start, cycle.end) + 1);
  const normalDay = income / cycleDays;
  const status: BudgetStatus = allowance <= 0 || remaining <= 0 ? "red"
    : remaining < allowance * 0.35 || forecast?.kind === "runs_out" || allowance < normalDay * 0.4 ? "amber" : "green";

  return { mode: "dynamic", allowance, remaining, status, estimatedIncome, forecast, ...base };
}
