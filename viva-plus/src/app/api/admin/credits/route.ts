import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

async function adminClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  const { data: isAdmin, error } = await supabase.rpc("viva_is_admin");
  if (error || !isAdmin) return { response: NextResponse.json({ error: "Acesso restrito ao administrador VIVA+." }, { status: 403 }) };
  return { supabase };
}

export async function GET(request: NextRequest) {
  const auth = await adminClient();
  if ("response" in auth) return auth.response;
  const p = request.nextUrl.searchParams;
  const view = p.get("view") || "overview";
  if (view === "overview") {
    const { data, error } = await auth.supabase.rpc("viva_admin_credit_overview");
    if (error) return NextResponse.json({ error: "Não foi possível carregar os indicadores." }, { status: 500 });
    return NextResponse.json(data);
  }
  if (view === "users") {
    const { data, error } = await auth.supabase.rpc("viva_admin_credit_users", {
      p_search: p.get("q") || null, p_plan: p.get("plan") || null, p_sort: p.get("sort") || "cost",
      p_limit: Math.min(100, Math.max(1, Number(p.get("limit") || 25))), p_offset: Math.max(0, Number(p.get("offset") || 0)),
    });
    if (error) return NextResponse.json({ error: "Não foi possível carregar os usuários." }, { status: 500 });
    return NextResponse.json({ users: data || [], total: Number(data?.[0]?.total_count || 0) });
  }
  if (view === "ledger") {
    const userId = z.string().uuid().safeParse(p.get("user_id"));
    if (!userId.success) return NextResponse.json({ error: "Usuário inválido." }, { status: 400 });
    const { data, error } = await auth.supabase.rpc("viva_admin_user_ledger", { p_user_id: userId.data, p_limit: 100 });
    if (error) return NextResponse.json({ error: "Não foi possível carregar o histórico." }, { status: 500 });
    return NextResponse.json(data);
  }
  return NextResponse.json({ error: "Visão inválida." }, { status: 400 });
}

const adjustSchema = z.object({
  user_id: z.string().uuid(),
  amount: z.number().int().refine(v => v !== 0 && Math.abs(v) <= 100000, "Quantidade inválida."),
  reason: z.string().trim().min(3).max(240),
  idempotency_key: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/),
});

// Adicionar ou retirar créditos manualmente (idempotente pela chave enviada pelo painel).
export async function POST(request: NextRequest) {
  const auth = await adminClient();
  if ("response" in auth) return auth.response;
  const parsed = adjustSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Informe a quantidade e o motivo (mínimo 3 letras)." }, { status: 400 });
  const { data, error } = await auth.supabase.rpc("viva_admin_adjust_credits", {
    p_user_id: parsed.data.user_id, p_amount: parsed.data.amount, p_reason: parsed.data.reason, p_idempotency_key: parsed.data.idempotency_key,
  });
  if (error) return NextResponse.json({ error: "Não foi possível ajustar os créditos." }, { status: 400 });
  return NextResponse.json(data);
}

const configSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("plan"), id: z.string().regex(/^[a-z_]{2,30}$/),
    monthly_price_brl: z.number().min(0).max(100000).optional(), annual_price_brl: z.number().min(0).max(100000).optional(),
    monthly_credits: z.number().int().min(0).max(100000).optional(), signup_credits: z.number().int().min(0).max(100000).optional(),
    history_days: z.number().int().min(1).max(3650).nullable().optional(), rollover_credits: z.boolean().optional(),
    is_public: z.boolean().optional(), enabled: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("operation"), key: z.string().regex(/^[a-z_]{2,40}$/),
    credits: z.number().int().min(0).max(1000).optional(), pro_only: z.boolean().optional(), enabled: z.boolean().optional(),
    label: z.string().trim().min(2).max(80).optional(),
  }),
  z.object({
    kind: z.literal("settings"),
    rate_limit_per_minute: z.number().int().min(1).max(600).optional(), abnormal_credits_per_hour: z.number().int().min(1).max(100000).optional(),
    warn_threshold_1: z.number().int().min(1).max(99).optional(), warn_threshold_2: z.number().int().min(1).max(99).optional(),
  }),
]);

// Valores e limites configuráveis sem alterar código.
export async function PUT(request: NextRequest) {
  const auth = await adminClient();
  if ("response" in auth) return auth.response;
  const parsed = configSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Configuração inválida." }, { status: 400 });
  const now = new Date().toISOString();
  let result;
  if (parsed.data.kind === "plan") {
    const { kind, id, ...values } = parsed.data; void kind;
    result = await auth.supabase.from("viva_plans").update({ ...values, updated_at: now }).eq("id", id).select("id").single();
  } else if (parsed.data.kind === "operation") {
    const { kind, key, ...values } = parsed.data; void kind;
    result = await auth.supabase.from("viva_credit_operations").update({ ...values, updated_at: now }).eq("key", key).select("key").single();
  } else {
    const { kind, ...values } = parsed.data; void kind;
    if (values.warn_threshold_1 && values.warn_threshold_2 && values.warn_threshold_1 >= values.warn_threshold_2) return NextResponse.json({ error: "O primeiro aviso deve ser menor que o segundo." }, { status: 400 });
    result = await auth.supabase.from("viva_admin_settings").update({ ...values, updated_at: now }).eq("id", true).select("id").single();
  }
  if (result.error) { console.error("VIVA admin credits config", result.error); return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 }); }
  return NextResponse.json({ ok: true });
}
