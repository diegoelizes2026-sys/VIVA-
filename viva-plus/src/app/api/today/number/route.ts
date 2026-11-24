import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadTodayBudget } from "@/lib/daily-budget-load";
import { todayBR } from "@/lib/payday";

// Número do dia (quanto ainda dá para gastar hoje), para mostrar logo depois do primeiro gasto.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try {
    const { budget } = await loadTodayBudget(supabase, user.id, todayBR());
    if (budget.mode === "setup") return NextResponse.json({ mode: "setup" });
    return NextResponse.json({ mode: budget.mode, allowance: budget.allowance, remaining: budget.remaining, spentToday: budget.spentToday, status: budget.status });
  } catch (e) {
    console.error("VIVA today number", e);
    return NextResponse.json({ mode: "setup" });
  }
}
