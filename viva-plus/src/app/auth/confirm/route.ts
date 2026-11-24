import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Link do e-mail de "criar nova senha": valida o token, abre a sessão e leva para /alterar-senha.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (!tokenHash || type !== "recovery") return NextResponse.redirect(new URL("/recuperar-senha?erro=link-invalido", url.origin));
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
  if (error) return NextResponse.redirect(new URL("/recuperar-senha?erro=link-invalido", url.origin));
  return NextResponse.redirect(new URL("/alterar-senha", url.origin));
}
