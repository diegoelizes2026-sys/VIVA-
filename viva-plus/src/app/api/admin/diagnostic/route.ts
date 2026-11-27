import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DIAG_TEMPLATES, renderTemplate, sendTemplate, templateFor } from "@/lib/diag-followup";
import { normalizeWhatsapp } from "@/lib/diagnostic";

export const runtime = "nodejs";
export const maxDuration = 60;

// Painel do Diagnóstico Financeiro (só administrador): funil, leads, mensagens, pausa geral e teste.
async function guard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { res: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  const { data: ok } = await supabase.rpc("viva_is_admin");
  if (!ok) return { res: NextResponse.json({ error: "Acesso restrito." }, { status: 403 }) };
  return { admin: createAdminClient() };
}

export async function GET(request: Request) {
  const g = await guard(); if ("res" in g) return g.res;
  const days = Math.min(90, Math.max(1, Number(new URL(request.url).searchParams.get("dias")) || 30));
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const [ev, leads, msgs, settings] = await Promise.all([
    g.admin.from("viva_diag_events").select("session_id,event,step,utm_source").gte("created_at", since).limit(50000),
    g.admin.from("viva_diag_leads").select("id,name,whatsapp,goal,wants_health,result,marketing_opt_in,consent_at,consent_text,utm_source,utm_medium,utm_campaign,followup_status,followup_step,next_send_at,last_sent_at,opted_out_at,converted_at,replies_count,last_reply_at,needs_human,created_at").order("created_at", { ascending: false }).limit(300),
    g.admin.from("viva_diag_messages").select("lead_id,direction,kind,step,body,status,error,created_at").order("created_at", { ascending: false }).limit(1500),
    g.admin.from("viva_diag_settings").select("followup_paused,test_whatsapp").eq("id", true).maybeSingle(),
  ]);
  // Funil por visitas únicas (sessões), total e por origem (utm_source).
  const funnel: Record<string, Set<string>> = {}; const bySource: Record<string, Record<string, Set<string>>> = {};
  for (const e of ev.data || []) {
    const k = e.event === "question" ? "q" + e.step : e.event;
    (funnel[k] ||= new Set()).add(e.session_id);
    const src = e.utm_source || "direto";
    ((bySource[src] ||= {})[k] ||= new Set()).add(e.session_id);
  }
  const count = (m: Record<string, Set<string>>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.size]));
  const msgByLead: Record<string, unknown[]> = {};
  for (const m of msgs.data || []) { const a = (msgByLead[m.lead_id] ||= []); if (a.length < 12) a.push(m); }
  const L = leads.data || [];
  return NextResponse.json({
    days,
    funnel: count(funnel),
    bySource: Object.fromEntries(Object.entries(bySource).map(([s, m]) => [s, count(m)])),
    totals: {
      leads: L.length, optIn: L.filter(l => l.marketing_opt_in).length, optedOut: L.filter(l => l.opted_out_at).length,
      converted: L.filter(l => l.converted_at).length, needsHuman: L.filter(l => l.needs_human).length,
      sent: (msgs.data || []).filter(m => m.direction === "out" && m.kind === "template" && m.status === "sent").length,
      failed: (msgs.data || []).filter(m => m.status === "failed").length,
    },
    leads: L.map(l => ({ ...l, messages: (msgByLead[l.id] || []).reverse() })),
    settings: { paused: settings.data?.followup_paused !== false, testWhatsapp: settings.data?.test_whatsapp ?? null },
    templates: DIAG_TEMPLATES.map(t => ({ name: t.name, step: t.step, goal: t.goal ?? null, category: t.category, body: t.body })),
  });
}

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pause"), paused: z.boolean() }),
  z.object({ action: z.literal("test_number"), whatsapp: z.string().max(20) }),
  z.object({ action: z.literal("send_test"), goal: z.enum(["dividas", "reserva", "comprar", "organizar"]).default("dividas") }),
  z.object({ action: z.literal("resolve"), id: z.string().uuid() }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }),
]);

export async function POST(request: Request) {
  const g = await guard(); if ("res" in g) return g.res;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const v = parsed.data; const now = new Date().toISOString();
  if (v.action === "pause") {
    await g.admin.from("viva_diag_settings").update({ followup_paused: v.paused, updated_at: now }).eq("id", true);
    return NextResponse.json({ ok: true, paused: v.paused });
  }
  if (v.action === "test_number") {
    const wa = normalizeWhatsapp(v.whatsapp); if (!wa) return NextResponse.json({ error: "Celular inválido. Use DDD + número." }, { status: 400 });
    await g.admin.from("viva_diag_settings").update({ test_whatsapp: wa, updated_at: now }).eq("id", true);
    return NextResponse.json({ ok: true, whatsapp: wa });
  }
  if (v.action === "send_test") {
    // Teste: manda a sequência inteira (4 modelos) só para o número de teste, mesmo com a pausa ligada.
    const { data: s } = await g.admin.from("viva_diag_settings").select("test_whatsapp").eq("id", true).maybeSingle();
    if (!s?.test_whatsapp) return NextResponse.json({ error: "Salve primeiro o seu número de teste." }, { status: 400 });
    const out = [];
    for (const step of [1, 2, 3, 4]) {
      const t = templateFor(step, v.goal)!;
      const r = await sendTemplate(s.test_whatsapp, t, "Teste");
      out.push({ step, template: t.name, text: renderTemplate(t, "Teste"), ok: r.ok, error: r.ok ? null : r.error });
    }
    return NextResponse.json({ ok: true, results: out });
  }
  if (v.action === "resolve") { await g.admin.from("viva_diag_leads").update({ needs_human: false, updated_at: now }).eq("id", v.id); return NextResponse.json({ ok: true }); }
  if (v.action === "delete") { await g.admin.from("viva_diag_leads").delete().eq("id", v.id); return NextResponse.json({ ok: true }); }
  return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
}
