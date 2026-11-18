import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { FINANCE_FLOW, PERSONAL_FLOW, sanitizeAnswers } from "@/lib/onboarding/flows";

const kindSchema = z.enum(["finance", "personal"]);

// Lê a sessão de onboarding do usuário autenticado (para continuar de onde parou).
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const kind = kindSchema.safeParse(new URL(request.url).searchParams.get("kind") || "finance");
  if (!kind.success) return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
  const { data, error } = await supabase.from("viva_onboarding").select("kind,status,step,answers,skipped_questions,summary,consent_at,started_at,completed_at,applied_at,pro_offer_shown_at,legacy").eq("user_id", user.id).eq("kind", kind.data).maybeSingle();
  if (error) return NextResponse.json({ error: "Não foi possível carregar sua conversa." }, { status: 500 });
  return NextResponse.json({ session: data });
}

const putSchema = z.object({
  kind: kindSchema,
  answers: z.record(z.string(), z.unknown()).optional(),
  step: z.string().max(60).nullable().optional(),
  skipped_questions: z.array(z.string().max(60)).max(60).optional(),
  consent: z.boolean().optional(),
  status: z.enum(["in_progress", "skipped"]).optional(),
  restart: z.boolean().optional(),
});

// Salvamento automático a cada resposta. Só aceita perguntas conhecidas e valores válidos.
export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const { kind, answers, step, skipped_questions, consent, status, restart } = parsed.data;
  const flow = kind === "finance" ? FINANCE_FLOW : PERSONAL_FLOW;
  const { data: current } = await supabase.from("viva_onboarding").select("status,consent_at,started_at,legacy").eq("user_id", user.id).eq("kind", kind).maybeSingle();
  const now = new Date().toISOString();
  const row: Record<string, unknown> = { user_id: user.id, kind, updated_at: now };
  if (answers) row.answers = sanitizeAnswers(flow, answers);
  if (step !== undefined) row.step = step;
  if (skipped_questions) row.skipped_questions = skipped_questions.filter(id => flow.some(q => q.id === id));
  if (consent && !current?.consent_at) row.consent_at = now;
  if (restart) Object.assign(row, { status: "in_progress", answers: {}, skipped_questions: [], summary: {}, completed_at: null, applied_at: null, started_at: now, legacy: false, step: null });
  else if (status) row.status = status;
  else if (!current) row.status = "in_progress";
  if (!current || current.legacy) { row.started_at = now; row.legacy = false; }
  const { error } = await supabase.from("viva_onboarding").upsert(row, { onConflict: "user_id,kind" });
  if (error) { console.error("VIVA onboarding save", error); return NextResponse.json({ error: "Não foi possível salvar sua resposta." }, { status: 500 }); }
  return NextResponse.json({ ok: true, saved_at: now });
}
