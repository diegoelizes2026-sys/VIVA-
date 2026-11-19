import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createTransaction } from "@/lib/transactions";
import { addDays, daysBetween, expectedPayment, hasSchedule, lastPayday, nextPayday, scheduleFromProfile, scheduleLabel, todayBR } from "@/lib/payday";

// "Recebi meu pagamento": quando a pessoa recebe, se já registrou o pagamento deste ciclo e quanto separar.
const PROFILE_COLS = "monthly_income,income_type,income_min,pay_frequency,pay_days,pay_weekday,pay_business_day,housing_cost,debt_payment_capacity,has_debts";

async function status(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: p } = await supabase.from("viva_finance_profiles").select(PROFILE_COLS).eq("user_id", userId).maybeSingle();
  const s = scheduleFromProfile(p);
  const today = todayBR();
  const configured = hasSchedule(s);
  const regular = configured && s.frequency !== "irregular";
  const next = regular ? nextPayday(s, today) : null;
  const last = regular ? lastPayday(s, today) : null;
  // Renda variável: o planejamento usa o mês fraco.
  const monthly = p?.income_type === "variable" || p?.income_type === "mixed" ? Number(p?.income_min) || Number(p?.monthly_income) || null : Number(p?.monthly_income) || null;
  const expected = expectedPayment(monthly, s);
  // Pagamento deste ciclo: receita de "Renda" a partir de 3 dias antes do último dia de pagamento (às vezes cai antes).
  const since = last ? addDays(last, -3) : addDays(today, -6);
  const { data: incomes } = await supabase.from("viva_transactions").select("id,amount,occurred_on,description").eq("user_id", userId)
    .eq("kind", "income").eq("category", "Renda").gte("occurred_on", since).order("occurred_on", { ascending: false }).limit(5);
  const received = incomes?.[0] || null;
  const daysToNext = next ? daysBetween(today, next) : null;
  const sinceLast = last ? daysBetween(last, today) : null;
  const perPayment = (v: unknown) => (Number(v) > 0 && s.frequency ? Math.round((Number(v) / (s.frequency === "weekly" ? 52 / 12 : s.frequency === "biweekly" ? 2 : 1)) * 100) / 100 : null);
  return {
    configured, schedule: s, label: scheduleLabel(s), today, next, last, daysToNext, expected,
    // Dia do pagamento (ou até 2 dias depois) e ainda não registrado: o cartão vira "Caiu seu pagamento?".
    due: Boolean(regular && sinceLast != null && sinceLast <= 2 && !received),
    received: received ? { amount: Number(received.amount), date: received.occurred_on } : null,
    split: { housing: perPayment(p?.housing_cost), debts: p?.has_debts ? perPayment(p?.debt_payment_capacity) : null },
  };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  return NextResponse.json(await status(supabase, user.id));
}

const Schedule = z.object({
  frequency: z.enum(["monthly", "biweekly", "weekly", "irregular"]),
  days: z.array(z.number().int().min(1).max(31)).max(2).default([]),
  businessDay: z.boolean().default(false),
  weekday: z.number().int().min(0).max(6).nullable().default(null),
});

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = Schedule.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Informe quando você recebe." }, { status: 400 });
  const v = parsed.data;
  const usesDays = v.frequency === "monthly" || v.frequency === "biweekly";
  if (usesDays && !v.days.length) return NextResponse.json({ error: "Escolha o dia do pagamento." }, { status: 400 });
  if (v.frequency === "weekly" && v.weekday == null) return NextResponse.json({ error: "Escolha o dia da semana." }, { status: 400 });
  if (v.businessDay && v.days.some(d => d > 23)) return NextResponse.json({ error: "Dia útil inválido." }, { status: 400 });
  const row = {
    user_id: user.id, pay_frequency: v.frequency,
    pay_days: usesDays ? [...new Set(v.days)].sort((a, b) => a - b).slice(0, v.frequency === "monthly" ? 1 : 2) : [],
    pay_business_day: usesDays ? v.businessDay : false, pay_weekday: v.frequency === "weekly" ? v.weekday : null, updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("viva_finance_profiles").upsert(row, { onConflict: "user_id" });
  if (error) { console.error("VIVA payday patch", error); return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 }); }
  return NextResponse.json(await status(supabase, user.id));
}

const Received = z.object({
  amount: z.coerce.number().positive().max(100000000),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  payment_method: z.enum(["Pix", "Transferência", "Dinheiro", "Outro"]).default("Pix"),
  description: z.string().trim().min(1).max(80).default("Pagamento recebido"),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = Received.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Informe quanto você recebeu." }, { status: 400 });
  const today = todayBR();
  const date = parsed.data.occurred_on && parsed.data.occurred_on <= today && daysBetween(parsed.data.occurred_on, today) <= 60 ? parsed.data.occurred_on : today;
  const amount = Math.round(parsed.data.amount * 100) / 100;
  // Toque duplo / reenvio: o mesmo valor no mesmo dia vira o mesmo lançamento.
  const { data: dup } = await supabase.from("viva_transactions").select("id").eq("user_id", user.id).eq("kind", "income").eq("category", "Renda").eq("occurred_on", date).eq("amount", amount).limit(1);
  if (!dup?.length) {
    try {
      await createTransaction(supabase, user.id, { kind: "income", amount, description: parsed.data.description, occurred_on: date, category: "Renda", payment_method: parsed.data.payment_method, source: "manual" });
    } catch (e) { console.error("VIVA payday received", e); return NextResponse.json({ error: "Não consegui registrar agora. Tente de novo." }, { status: 500 }); }
  }
  return NextResponse.json({ ok: true, duplicate: Boolean(dup?.length), ...(await status(supabase, user.id)) });
}
