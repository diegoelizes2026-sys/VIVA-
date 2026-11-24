import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE, sendEmail } from "@/lib/email";
import { passwordResetEmail } from "@/lib/email-messages";

export const runtime = "nodejs";

// "Esqueci a senha": a VIVA gera o link e manda o próprio e-mail (em português, pelo Resend).
// O link aponta para www.vivamaiss.app.br/auth/confirm, sem depender da URL padrão do Supabase compartilhado.
// Sempre responde igual (não revela se o e-mail tem conta).
const Body = z.object({ email: z.string().trim().toLowerCase().email().max(254) });
const OK = { ok: true, message: "Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha. Confira também o spam." };

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Digite um e-mail válido." }, { status: 400 });
  const email = parsed.data.email;
  const admin = createAdminClient();
  try {
    // No máximo 3 pedidos por e-mail por hora.
    const emailHash = createHash("sha256").update(email).digest("hex");
    const { count } = await admin.from("viva_password_resets").select("id", { count: "exact", head: true }).eq("email_hash", emailHash).gt("created_at", new Date(Date.now() - 3600000).toISOString());
    if ((count ?? 0) >= 3) return NextResponse.json(OK);
    await admin.from("viva_password_resets").insert({ email_hash: emailHash });

    const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
    const tokenHash = data?.properties?.hashed_token;
    const userId = data?.user?.id;
    if (error || !tokenHash || !userId) return NextResponse.json(OK);
    // Só contas do VIVA+ (o acesso do Supabase é compartilhado com outro produto).
    const { data: profile } = await admin.from("viva_profiles").select("full_name").eq("id", userId).maybeSingle();
    if (!profile) return NextResponse.json(OK);
    const first = String(profile.full_name || "").trim().split(/\s+/)[0] || "";
    const link = `${SITE}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`;
    await sendEmail(email, passwordResetEmail(first, link));
  } catch (e) {
    console.error("VIVA reset request", e);
  }
  return NextResponse.json(OK);
}
