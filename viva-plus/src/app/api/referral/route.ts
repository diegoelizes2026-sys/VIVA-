import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Indique e ganhe: meu código e números (GET) e usar um convite (POST). Regras e créditos no banco.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { data, error } = await supabase.rpc("viva_my_referral");
  if (error) { console.error("VIVA referral", error); return NextResponse.json({ error: "Não foi possível carregar seu convite." }, { status: 500 }); }
  return NextResponse.json(data);
}

const Claim = z.object({ code: z.string().trim().min(4).max(12) });
const REASON: Record<string, string> = {
  invalid: "Esse código de convite não existe.", self: "Esse é o seu próprio convite.",
  already: "Você já entrou com um convite.", too_old: "O convite vale só para contas novas (até 7 dias).",
};
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = Claim.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: REASON.invalid }, { status: 400 });
  const { data, error } = await supabase.rpc("viva_claim_referral", { p_code: parsed.data.code });
  if (error) { console.error("VIVA referral claim", error); return NextResponse.json({ ok: false, error: "Não consegui usar o convite agora." }, { status: 500 }); }
  const r = data as { ok: boolean; reason?: string };
  return NextResponse.json(r.ok ? { ok: true } : { ok: false, reason: r.reason, error: REASON[r.reason || ""] || REASON.invalid }, { status: r.ok ? 200 : 409 });
}
