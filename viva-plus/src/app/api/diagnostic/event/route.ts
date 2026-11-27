import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Funil do diagnóstico (início, perguntas, lead, resultado, cliques), com as tags de campanha (UTM).
// Não guarda dados pessoais: só um id aleatório da visita. Nunca atrapalha a página.
const Body = z.object({
  session: z.string().regex(/^[A-Za-z0-9]{8,64}$/),
  event: z.enum(["quiz_start", "question", "lead", "result", "cta_signup", "cta_whatsapp", "share"]),
  step: z.number().int().min(1).max(7).optional(),
  utm_source: z.string().max(80).optional(), utm_medium: z.string().max(80).optional(), utm_campaign: z.string().max(80).optional(),
});
const perSession = new Map<string, number>();

export async function POST(request: Request) {
  try {
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return new NextResponse(null, { status: 204 });
    const v = parsed.data;
    const n = (perSession.get(v.session) || 0) + 1; perSession.set(v.session, n);
    if (perSession.size > 5000) perSession.clear();
    if (n > 40) return new NextResponse(null, { status: 204 });
    const clean = (s?: string) => (s ? s.toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 80) || null : null);
    await createAdminClient().from("viva_diag_events").insert({ session_id: v.session, event: v.event, step: v.step ?? null, utm_source: clean(v.utm_source), utm_medium: clean(v.utm_medium), utm_campaign: clean(v.utm_campaign) });
  } catch (e) { console.error("VIVA diag event", e); }
  return new NextResponse(null, { status: 204 });
}
