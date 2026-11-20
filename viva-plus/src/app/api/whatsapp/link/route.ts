import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { whatsappConfigured, whatsappNumber } from "@/lib/whatsapp/cloud";

export const runtime = "nodejs";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const mask = (waId: string) => (waId.length > 4 ? "•••• " + waId.slice(-4) : waId);

async function currentUser() {
  const s = await createClient();
  const { data: { user } } = await s.auth.getUser();
  return { s, user };
}

export async function GET() {
  const { s, user } = await currentUser();
  if (!user) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  const available = whatsappConfigured() && Boolean(whatsappNumber());
  const { data } = await s.from("viva_whatsapp_links").select("wa_id,linked_at,last_message_at").eq("user_id", user.id).maybeSingle();
  return NextResponse.json({
    available,
    linked: Boolean(data),
    number: data ? mask(data.wa_id) : null,
    linkedAt: data?.linked_at ?? null,
    chatLink: available ? `https://wa.me/${whatsappNumber()}` : null,
  });
}

export async function POST() {
  const { user } = await currentUser();
  if (!user) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  if (!whatsappConfigured() || !whatsappNumber()) return NextResponse.json({ error: "A VIVA no WhatsApp ainda não está disponível." }, { status: 503 });
  const admin = createAdminClient();
  await admin.from("viva_whatsapp_link_codes").delete().eq("user_id", user.id);
  const bytes = crypto.randomBytes(6);
  const code = Array.from(bytes as Uint8Array, (b: number) => ALPHABET[b % ALPHABET.length]).join("");
  const { error } = await admin.from("viva_whatsapp_link_codes").insert({ code, user_id: user.id, expires_at: new Date(Date.now() + 15 * 60000).toISOString() });
  if (error) { console.error("VIVA WhatsApp code failed", error); return NextResponse.json({ error: "Não foi possível gerar o código. Tente de novo." }, { status: 500 }); }
  const text = `Quero conectar minha conta: VIVA-${code}`;
  return NextResponse.json({ code: `VIVA-${code}`, waLink: `https://wa.me/${whatsappNumber()}?text=${encodeURIComponent(text)}`, expiresInMinutes: 15 });
}

export async function DELETE() {
  const { user } = await currentUser();
  if (!user) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  const admin = createAdminClient();
  await admin.from("viva_whatsapp_links").delete().eq("user_id", user.id);
  await admin.from("viva_whatsapp_sessions").delete().eq("user_id", user.id);
  await admin.from("viva_whatsapp_link_codes").delete().eq("user_id", user.id);
  return NextResponse.json({ message: "WhatsApp desconectado." });
}
