import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";
const TERMS_VERSION = "2026-11-15-v1";
const PRIVACY_VERSION = "2026-11-15-v1";
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (body?.accepted !== true) return NextResponse.json({ error: "O aceite é obrigatório." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Entre na sua conta para aceitar os termos." }, { status: 401 });
  const acceptedAt = new Date().toISOString();
  const { data, error } = await supabase.from("viva_profiles").update({
    terms_of_use_version: TERMS_VERSION, privacy_policy_version: PRIVACY_VERSION,
    terms_accepted_at: acceptedAt, updated_at: acceptedAt
  }).eq("id", user.id).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "Não foi possível registrar seu aceite: " + error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Perfil VIVA+ não encontrado." }, { status: 404 });
  return NextResponse.json({ success: true, acceptedAt });
}