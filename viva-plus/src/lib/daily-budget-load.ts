/* eslint-disable @typescript-eslint/no-explicit-any */
import { addDays, expectedPayment, hasSchedule, lastPayday, nextPayday, scheduleFromProfile } from "@/lib/payday";
import { computeStreak, computeTodayBudget, currentCycle, type DayTx, type TodayBudget } from "@/lib/daily-budget";

type Db = any; // cliente do usuário (tela) ou admin (notificação da manhã)

export type TodayBudgetBundle = { budget: TodayBudget; streak: number; cycleTx: DayTx[]; monthStart: string };

/** Busca o que a conta do "número do dia" precisa e devolve o valor de hoje + a sequência. */
export async function loadTodayBudget(db: Db, userId: string, today: string): Promise<TodayBudgetBundle> {
  const monthStart = today.slice(0, 8) + "01";
  const { data: fp } = await db.from("viva_finance_profiles")
    .select("monthly_income,income_type,income_min,pay_frequency,pay_days,pay_weekday,pay_business_day")
    .eq("user_id", userId).maybeSingle();
  const schedule = scheduleFromProfile(fp);
  const regular = hasSchedule(schedule) && schedule.frequency !== "irregular";
  const cycle = currentCycle(today, regular ? lastPayday(schedule, today) : null, regular ? nextPayday(schedule, today) : null);
  const since = cycle.start < monthStart ? cycle.start : monthStart;
  const [{ data: tx }, { data: bills }, { data: limits }] = await Promise.all([
    db.from("viva_transactions").select("kind,amount,occurred_on").eq("user_id", userId).gte("occurred_on", since).lte("occurred_on", today).limit(3000),
    db.from("viva_bills").select("amount,due_date,status").eq("user_id", userId).neq("status", "paid").gte("due_date", today).lte("due_date", addDays(today, 45)).limit(200),
    db.from("viva_daily_limits").select("limit_amount").eq("user_id", userId).eq("is_active", true).order("updated_at", { ascending: false }).limit(1),
  ]);
  // Renda variável: usa o mês fraco. Sem dia de pagamento: a renda do mês inteiro.
  const monthly = fp?.income_type === "variable" || fp?.income_type === "mixed"
    ? Number(fp?.income_min) || Number(fp?.monthly_income) || null
    : Number(fp?.monthly_income) || null;
  const input = {
    today, cycle, tx: (tx || []) as DayTx[], bills: bills || [],
    dailyLimit: limits?.[0] ? Number(limits[0].limit_amount) : null,
    expectedCycleIncome: regular ? expectedPayment(monthly, schedule) : monthly,
  };
  const budget = computeTodayBudget(input);
  return { budget, streak: computeStreak(input, budget), cycleTx: input.tx, monthStart };
}
