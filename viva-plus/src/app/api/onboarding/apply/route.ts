import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { diagnose, sanitizeAnswers, toFinanceProfile, FINANCE_FLOW, PERSONAL_FLOW, val, num, yes } from "@/lib/onboarding/flows";

const schema = z.object({ kind: z.enum(["finance", "personal"]), actions: z.array(z.string().max(40)).max(20).default([]) });

// Confirmação do resumo: salva o perfil e configura o painel SOMENTE com o que o usuário marcou.
// Os valores são recalculados no servidor a partir das respostas salvas (nada vem pronto do navegador).
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const { kind, actions } = parsed.data;
  const { data: session } = await supabase.from("viva_onboarding").select("answers,pro_offer_shown_at,summary").eq("user_id", user.id).eq("kind", kind).maybeSingle();
  if (!session) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  const now = new Date().toISOString();

  if (kind === "personal") {
    const a = sanitizeAnswers(PERSONAL_FLOW, session.answers);
    const practices = typeof val(a, "p_practices") === "boolean" ? (val(a, "p_practices") as boolean) : null;
    const goal = String(val(a, "p_goal") || "");
    const location = String(val(a, "p_location") || "");
    const level = String(val(a, "p_level") || (practices === false ? "iniciante" : ""));
    const limitations = val(a, "p_limitations") ? String(val(a, "p_limitations")).slice(0, 500) : null;
    const patch: Record<string, unknown> = {
      user_id: user.id, practices_exercise: practices, personal_onboarded_at: now, updated_at: now,
      limitations: limitations && !/^nenhuma?$/i.test(limitations.trim()) ? limitations : null,
    };
    if (["hipertrofia", "emagrecimento", "condicionamento", "saude"].includes(goal)) patch.goal = goal;
    if (["casa", "academia", "ar_livre", "misto"].includes(location)) patch.train_location = location;
    if (["iniciante", "intermediario", "avancado"].includes(level)) patch.experience_level = level;
    const days = Number(val(a, "p_days")); if (days >= 1 && days <= 7) patch.weekly_workouts = days;
    const minutes = Number(val(a, "p_minutes")); if (minutes >= 10 && minutes <= 240) { patch.session_minutes = minutes; if (days) patch.weekly_activity_min = Math.min(2000, Math.max(10, days * minutes)); }
    const { error } = await supabase.from("viva_health_profiles").upsert(patch, { onConflict: "user_id" });
    if (error) { console.error("VIVA personal onboarding apply", error); return NextResponse.json({ error: "Não foi possível salvar seu perfil do Personal." }, { status: 500 }); }
    await supabase.from("viva_onboarding").update({ status: "completed", completed_at: now, applied_at: now, step: "done", summary: { applied: Object.keys(patch) }, updated_at: now }).eq("user_id", user.id).eq("kind", "personal");
    return NextResponse.json({ ok: true });
  }

  const a = sanitizeAnswers(FINANCE_FLOW, session.answers);
  const d = diagnose(a);
  const profile = toFinanceProfile(a, d);
  const { error: profileError } = await supabase.from("viva_finance_profiles").upsert({ user_id: user.id, ...profile, updated_at: now }, { onConflict: "user_id" });
  if (profileError) { console.error("VIVA finance profile save", profileError); return NextResponse.json({ error: "Não foi possível salvar seu perfil financeiro." }, { status: 500 }); }

  const applied: string[] = []; const failed: string[] = [];
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(new Date()) + "-01";
  for (const action of d.actions.filter(x => actions.includes(x.id))) {
    let error: unknown = null;
    if (action.kind === "budget") ({ error } = await supabase.from("viva_budgets").upsert({ user_id: user.id, category: action.category, monthly_limit: action.amount, month }, { onConflict: "user_id,category,month" }));
    if (action.kind === "daily_limit") ({ error } = await supabase.from("viva_daily_limits").upsert({ user_id: user.id, limit_amount: action.amount, is_active: true, updated_at: now }, { onConflict: "user_id" }));
    if (action.kind === "goal") {
      const { data: exists } = await supabase.from("viva_financial_goals").select("id").eq("user_id", user.id).ilike("title", action.title || "").limit(1);
      if (!exists?.length) ({ error } = await supabase.from("viva_financial_goals").insert({ user_id: user.id, title: action.title, target_amount: action.amount, current_amount: 0 }));
    }
    if (error) { console.error("VIVA onboarding action", action.id, error); failed.push(action.id); } else applied.push(action.id);
  }
  const { data: wallet } = await supabase.from("viva_credit_wallets").select("plan_id").eq("user_id", user.id).maybeSingle();
  const offerPro = (wallet?.plan_id ?? "free") === "free" && !session.pro_offer_shown_at;
  await supabase.from("viva_onboarding").update({
    status: "completed", completed_at: now, applied_at: now, step: "done", updated_at: now,
    summary: { ...(session.summary || {}), applied, failed, focus: d.focus }, ...(offerPro ? { pro_offer_shown_at: now } : {}),
  }).eq("user_id", user.id).eq("kind", "finance");
  return NextResponse.json({ ok: true, applied, failed, focus: d.focus, offerPro, hasDebts: yes(a, "has_debts"), income: num(a, "income") });
}
