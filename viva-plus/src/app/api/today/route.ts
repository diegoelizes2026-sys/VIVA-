import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { addDays, todayBR } from "@/lib/payday";

// Resumo rápido para o topo do chat: saldo do mês e contas que vencem nos próximos 7 dias.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const today = todayBR();
  const [{ data: tx }, { data: bills }] = await Promise.all([
    supabase.from("viva_transactions").select("kind,amount").eq("user_id", user.id).gte("occurred_on", today.slice(0, 7) + "-01").limit(2000),
    supabase.from("viva_bills").select("amount,due_date").eq("user_id", user.id).eq("status", "pending").lte("due_date", addDays(today, 7)).limit(200),
  ]);
  const sum = (k: string) => (tx || []).filter(x => x.kind === k).reduce((a, x) => a + Number(x.amount), 0);
  const overdue = (bills || []).filter(b => b.due_date < today);
  const week = (bills || []).filter(b => b.due_date >= today);
  const name = String(user.user_metadata?.full_name || "").trim().split(" ")[0] || null;
  return NextResponse.json({
    name, today, income: sum("income"), expense: sum("expense"), balance: sum("income") - sum("expense"),
    bills: { overdue: overdue.length, week: week.length, total: [...overdue, ...week].reduce((a, b) => a + Number(b.amount || 0), 0), dueToday: week.filter(b => b.due_date === today).length },
  });
}
