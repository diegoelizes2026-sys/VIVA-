import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { linkWhatsapp, readConnectToken, welcomeAfterLink } from "@/lib/whatsapp";

export const runtime = "nodejs";
const COOKIE = "viva_wa_connect";

// Link de um toque que a VIVA manda no WhatsApp: liga o número à conta de quem está logado.
// Se a pessoa não estiver logada, guarda o link e volta aqui depois do login.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const store = await cookies();
  const token = url.searchParams.get("t") || store.get(COOKIE)?.value || "";
  const waId = readConnectToken(token);
  if (!waId) {
    const res = NextResponse.redirect(new URL("/meu-dia?whatsapp=expirado", request.url));
    res.cookies.delete({ name: COOKIE, path: "/whatsapp" });
    return res;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const res = NextResponse.redirect(new URL("/login?next=/whatsapp/conectar", request.url));
    res.cookies.set(COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 60, path: "/whatsapp" });
    return res;
  }

  let subscribed = false;
  try {
    const admin = createAdminClient();
    await linkWhatsapp(admin, user.id, waId);
    subscribed = Boolean(await welcomeAfterLink(admin, user.id, waId));
  } catch (error) {
    console.error("VIVA WhatsApp connect link failed", error);
    return NextResponse.redirect(new URL("/meu-dia?whatsapp=erro", request.url));
  }
  // Sem plano: leva direto para os planos (a VIVA no WhatsApp é só para assinantes).
  const res = NextResponse.redirect(new URL(subscribed ? "/meu-dia?whatsapp=conectado" : "/planos?whatsapp=assinar", request.url));
  res.cookies.delete({ name: COOKIE, path: "/whatsapp" });
  return res;
}
