import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const vivaNumber = () => (process.env.WHATSAPP_DISPLAY_NUMBER || "").replace(/\D/g, "");
const mask = (waId: string) => (waId.length > 4 ? "•••• " + waId.slice(-4) : waId);

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await currentUser();
  if (!user) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  const { data } = await supabase.from("viva_whatsapp_links").select("wa_id,linked_at").eq("user_id", user.id).maybeSingle();
  return NextResponse.json({ available: Boolean(vivaNumber()), linked: Boolean(data), phone: data ? mask(String(data.wa_id)) : null, linkedAt: data?.linked_at ?? null });
}

export async function POST() {
  const { user } = await currentUser();
  if (!user) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  const number = vivaNumber();
  if (!number) return NextResponse.json({ error: "O WhatsApp da VIVA+ ainda não está disponível." }, { status: 503 });
  const admin = createAdminClient();
  await admin.from("viva_whatsapp_link_codes").delete().eq("user_id", user.id);
  let code = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
    const { error } = await admin.from("viva_whatsapp_link_codes").insert({ code, user_id: user.id, expires_at: new Date(Date.now() + 15 * 60000).toISOString() });
    if (!error) break;
    if (error.code !== "23505") { console.error("VIVA WhatsApp code insert failed", error); return NextResponse.json({ error: "Não consegui gerar o código. Tente de novo." }, { status: 500 }); }
    code = "";
  }
  if (!code) return NextResponse.json({ error: "Não consegui gerar o código. Tente de novo." }, { status: 500 });
  const text = `Oi VIVA+! Quero conectar minha conta 💜 Código: VIVA-${code}`;
  return NextResponse.json({ code: "VIVA-" + code, url: `https://wa.me/${number}?text=${encodeURIComponent(text)}`, expiresInMinutes: 15 });
}

export async function DELETE() {
  const { user } = await currentUser();
  if (!user) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  const admin = createAdminClient();
  await admin.from("viva_whatsapp_links").delete().eq("user_id", user.id);
  await admin.from("viva_whatsapp_state").delete().eq("user_id", user.id);
  return NextResponse.json({ ok: true, message: "WhatsApp desconectado." });
}
