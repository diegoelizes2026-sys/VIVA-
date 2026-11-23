import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { WHATSAPP_PUBLIC_NUMBER, whatsappLinkUrl } from "@/lib/whatsapp";

export const runtime = "nodejs";
const CODE_TTL_MS = 30 * 60 * 1000;

const mask = (waId: string) => `+${waId.slice(0, 2)} ${waId.slice(2, 4)} ••••-${waId.slice(-4)}`;

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Status da conexão do WhatsApp da pessoa.
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  const { data, error } = await createAdminClient().from("viva_whatsapp_links").select("wa_id,linked_at").eq("user_id", user.id).maybeSingle();
  if (error) { console.error("VIVA WhatsApp link status", error); return NextResponse.json({ error: "Não consegui consultar agora." }, { status: 500 }); }
  return NextResponse.json({ linked: Boolean(data?.wa_id), number: data?.wa_id ? mask(data.wa_id) : null, chatUrl: `https://wa.me/${WHATSAPP_PUBLIC_NUMBER}` });
}

// Gera um código de 6 dígitos (vale 30 minutos) para a pessoa mandar no WhatsApp da VIVA.
export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  const admin = createAdminClient();
  const expires = new Date(Date.now() + CODE_TTL_MS).toISOString();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = String(randomInt(100000, 1000000));
    const { error } = await admin.from("viva_whatsapp_links").upsert({ user_id: user.id, link_code: code, code_expires_at: expires, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (!error) return NextResponse.json({ code, url: whatsappLinkUrl(code), expiresAt: expires });
    if (error.code !== "23505") { console.error("VIVA WhatsApp link code", error); break; }
  }
  return NextResponse.json({ error: "Não consegui gerar o código agora. Tente de novo." }, { status: 500 });
}

// Desconecta o WhatsApp da conta.
export async function DELETE() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  const { error } = await createAdminClient().from("viva_whatsapp_links").update({ wa_id: null, linked_at: null, link_code: null, code_expires_at: null, history: [], updated_at: new Date().toISOString() }).eq("user_id", user.id);
  if (error) { console.error("VIVA WhatsApp unlink", error); return NextResponse.json({ error: "Não consegui desconectar agora." }, { status: 500 }); }
  return NextResponse.json({ ok: true });
}
