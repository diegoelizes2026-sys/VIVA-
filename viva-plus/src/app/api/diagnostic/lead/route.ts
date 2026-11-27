import { createHash } from "node:crypto";
import { after, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONSENT_TEXT, computeResult, normalizeWhatsapp } from "@/lib/diagnostic";
import { processDiagLead } from "@/lib/diag-followup";

export const runtime = "nodejs";
export const maxDuration = 30;

// Lead do diagnóstico: nome, WhatsApp, respostas e consentimento opcional para mensagens.
// O resultado é recalculado aqui. Anti-spam: campo-armadilha e limite por aparelho e por conexão.
const money = z.number().finite().min(0).max(1_000_000);
const Body = z.object({
  name: z.string().trim().min(2).max(60),
  whatsapp: z.string().max(20),
  answers: z.object({
    income: money.refine(n => n > 0), payday: z.number().int().min(1).max(31), fixed: money,
    debts: z.enum(["nao", "poucas", "muitas"]), control: z.enum(["sempre", "as_vezes", "quase_nunca"]),
    goal: z.enum(["dividas", "reserva", "comprar", "organizar"]), health: z.enum(["sim", "talvez", "nao"]),
  }),
  optIn: z.boolean(),
  consentText: z.string().max(300).nullable().optional(),
  device: z.string().regex(/^[A-Za-z0-9]{8,64}$/),
  website: z.string().max(200).optional(),
  utm_source: z.string().max(80).optional(), utm_medium: z.string().max(80).optional(), utm_campaign: z.string().max(80).optional(), utm_content: z.string().max(80).optional(),
});
const salt = () => process.env.DIAG_HASH_SALT || process.env.CRON_SECRET || "viva-diag";
const hash = (s: string) => createHash("sha256").update(salt() + ":" + s).digest("hex").slice(0, 40);
const clean = (s?: string) => (s ? s.toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 80) || null : null);

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Confira os dados." }, { status: 400 });
  const v = parsed.data;
  if (v.website) return NextResponse.json({ ok: true }); // robô preencheu o campo escondido: finge sucesso e não salva
  const whatsapp = normalizeWhatsapp(v.whatsapp);
  if (!whatsapp) return NextResponse.json({ error: "WhatsApp inválido." }, { status: 400 });
  const admin = createAdminClient();
  const deviceHash = hash("d:" + v.device);
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || request.headers.get("x-real-ip") || "";
  const ipHash = ip ? hash("i:" + ip) : null;
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [{ count: byDevice }, ipRes] = await Promise.all([
    admin.from("viva_diag_leads").select("id", { count: "exact", head: true }).eq("device_hash", deviceHash).gte("created_at", since),
    ipHash ? admin.from("viva_diag_leads").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since) : Promise.resolve({ count: 0 }),
  ]);
  if ((byDevice || 0) >= 5 || (ipRes.count || 0) >= 20) return NextResponse.json({ error: "Você já fez vários diagnósticos hoje. Tente de novo amanhã." }, { status: 429 });

  const result = computeResult(v.answers);
  const now = new Date().toISOString();
  const optIn = v.optIn === true && v.consentText === CONSENT_TEXT;
  const { data, error } = await admin.from("viva_diag_leads").insert({
    name: v.name, whatsapp, answers: v.answers, result, goal: v.answers.goal, wants_health: v.answers.health,
    marketing_opt_in: optIn, consent_text: optIn ? CONSENT_TEXT : null, consent_at: optIn ? now : null,
    utm_source: clean(v.utm_source), utm_medium: clean(v.utm_medium), utm_campaign: clean(v.utm_campaign), utm_content: clean(v.utm_content),
    device_hash: deviceHash, ip_hash: ipHash,
    followup_status: optIn ? "pending" : "not_eligible", next_send_at: optIn ? now : null,
  }).select("id,delete_token").single();
  if (error || !data) { console.error("VIVA diag lead", error); return NextResponse.json({ error: "Não consegui salvar agora." }, { status: 500 }); }
  // Mensagem de boas-vindas "na hora" (só com consentimento, fora da pausa geral e dentro do horário permitido).
  if (optIn) after(async () => { try { await processDiagLead(admin, String(data.id)); } catch (e) { console.error("VIVA diag first message", e); } });
  return NextResponse.json({ ok: true, id: data.id, token: data.delete_token });
}

// LGPD: a própria pessoa apaga nome, WhatsApp, respostas e mensagens (token devolvido só para ela).
const Del = z.object({ id: z.string().uuid(), token: z.string().uuid() });
export async function DELETE(request: Request) {
  const parsed = Del.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const { error, count } = await createAdminClient().from("viva_diag_leads").delete({ count: "exact" }).eq("id", parsed.data.id).eq("delete_token", parsed.data.token);
  if (error) { console.error("VIVA diag delete", error); return NextResponse.json({ error: "Não consegui apagar agora." }, { status: 500 }); }
  return NextResponse.json({ ok: true, deleted: count || 0 });
}
