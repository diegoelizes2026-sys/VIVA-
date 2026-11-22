import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Configuração em 1 minuto do "número do dia": quanto recebe por mês e em que dia.
const Body = z.object({
  monthly_income: z.coerce.number().positive().max(10000000),
  pay_day: z.coerce.number().int().min(1).max(31).nullable().default(null), // null = sem dia fixo
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Informe quanto você recebe por mês." }, { status: 400 });
  const { monthly_income, pay_day } = parsed.data;
  const row = {
    user_id: user.id,
    monthly_income: Math.round(monthly_income * 100) / 100,
    pay_frequency: pay_day ? "monthly" : "irregular",
    pay_days: pay_day ? [pay_day] : [],
    pay_business_day: false,
    pay_weekday: null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("viva_finance_profiles").upsert(row, { onConflict: "user_id" });
  if (error) { console.error("VIVA today setup", error); return NextResponse.json({ error: "Não foi possível salvar. Tente de novo." }, { status: 500 }); }
  return NextResponse.json({ ok: true });
}
