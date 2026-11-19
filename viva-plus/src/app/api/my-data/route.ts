import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { PROFILE_CERT_KEY, diagnose, profileToAnswers, toFinanceProfile } from "@/lib/onboarding/flows";

const FIELDS = {
  monthly_income: "money", income_min: "money", income_max: "money", other_income_amount: "money", monthly_expenses: "money",
  housing_cost: "money", food_cost: "money", transport_cost: "money", debt_total: "money", debt_payment_capacity: "money", purchase_amount: "money",
  has_debts: "bool", has_overdue: "bool", has_other_income: "bool", income_type: "text", work_type: "text", main_difficulty: "text", purchase_goal: "text",
} as const;
type Field = keyof typeof FIELDS;

// Meus dados: consultar, corrigir e excluir as informações pessoais usadas pela VIVA e pelo Personal.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const [finance, health, onboarding] = await Promise.all([
    supabase.from("viva_finance_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("viva_health_profiles").select("goal,trainer,weekly_workouts,session_minutes,experience_level,train_location,practices_exercise,limitations,personal_onboarded_at").eq("user_id", user.id).maybeSingle(),
    supabase.from("viva_onboarding").select("kind,status,consent_at,completed_at").eq("user_id", user.id),
  ]);
  return NextResponse.json({ finance: finance.data, health: health.data, onboarding: onboarding.data || [] });
}

const patchSchema = z.object({ field: z.string(), value: z.union([z.number(), z.string(), z.boolean(), z.null()]), certainty: z.enum(["confirmed", "estimated"]).default("confirmed") });

// Atualização de um campo (usada em Meus dados e quando o usuário confirma uma mudança pelo chat).
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !(parsed.data.field in FIELDS)) return NextResponse.json({ error: "Campo inválido." }, { status: 400 });
  const field = parsed.data.field as Field; const kind = FIELDS[field]; let value = parsed.data.value;
  if (value !== null) {
    if (kind === "money") { const n = Number(value); if (!Number.isFinite(n) || n < 0 || n > 100000000) return NextResponse.json({ error: "Valor inválido." }, { status: 400 }); value = Math.round(n * 100) / 100; }
    if (kind === "bool" && typeof value !== "boolean") return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
    if (kind === "text") value = String(value).slice(0, 300);
  }
  const { data: current } = await supabase.from("viva_finance_profiles").select("*").eq("user_id", user.id).maybeSingle();
  const certKey = PROFILE_CERT_KEY[field] || field;
  const certainty = { ...((current?.certainty as Record<string, string>) || {}), [certKey]: value === null ? "unknown" : parsed.data.certainty };
  const patch: Record<string, unknown> = { user_id: user.id, [field]: value, certainty, updated_at: new Date().toISOString() };
  const debtsPaid = (field === "has_debts" && value === false) || (field === "debt_total" && value === 0);
  if (debtsPaid) Object.assign(patch, { has_debts: false, debt_total: 0, has_overdue: false, debt_payment_capacity: null });
  // Recalcula foco e diagnóstico com a informação nova (o painel e a VIVA passam a usar o perfil atualizado).
  const merged = { ...(current || {}), ...patch } as Record<string, unknown>;
  const recalculated = toFinanceProfile(profileToAnswers(merged), diagnose(profileToAnswers(merged)));
  Object.assign(patch, { focus: recalculated.focus, diagnosis: recalculated.diagnosis });
  const { error } = await supabase.from("viva_finance_profiles").upsert(patch, { onConflict: "user_id" });
  if (error) { console.error("VIVA my-data patch", error); return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 }); }
  // Dívida quitada: a meta "Sair das dívidas" criada no diagnóstico é marcada como alcançada.
  if (debtsPaid) {
    const { data: goal } = await supabase.from("viva_financial_goals").select("id,target_amount").eq("user_id", user.id).eq("title", "Sair das dívidas").maybeSingle();
    if (goal) await supabase.from("viva_financial_goals").update({ current_amount: goal.target_amount }).eq("id", goal.id).eq("user_id", user.id);
  }
  return NextResponse.json({ ok: true, focus: recalculated.focus });
}

// Exclusão: perfil financeiro ou dados do Personal (lançamentos, metas e registros de saúde não são apagados).
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const scope = new URL(request.url).searchParams.get("scope");
  if (scope === "finance") {
    const a = await supabase.from("viva_finance_profiles").delete().eq("user_id", user.id);
    const b = await supabase.from("viva_onboarding").delete().eq("user_id", user.id).eq("kind", "finance");
    if (a.error || b.error) return NextResponse.json({ error: "Não foi possível excluir." }, { status: 500 });
    await supabase.from("viva_onboarding").insert({ user_id: user.id, kind: "finance", status: "skipped", legacy: true });
    return NextResponse.json({ ok: true });
  }
  if (scope === "personal") {
    const a = await supabase.from("viva_health_profiles").update({ practices_exercise: null, experience_level: null, train_location: null, session_minutes: null, limitations: null, personal_onboarded_at: null, updated_at: new Date().toISOString() }).eq("user_id", user.id);
    const b = await supabase.from("viva_onboarding").delete().eq("user_id", user.id).eq("kind", "personal");
    if (a.error || b.error) return NextResponse.json({ error: "Não foi possível excluir." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Escolha o que excluir." }, { status: 400 });
}
