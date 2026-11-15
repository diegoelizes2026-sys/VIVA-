import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return response;
  let user = null;
  const pathname = request.nextUrl.pathname;
  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    const { data, error } = await supabase.auth.getUser();
    if (error && error.message !== "Auth session missing!") console.error("[VIVA+] Falha ao validar sessão:", error.message);
    user = data.user;
    if (user && pathname !== "/conta-suspensa" && !pathname.startsWith("/_next")) {
      const { data: profile } = await supabase.from("viva_profiles").select("account_status,terms_of_use_version,privacy_policy_version,terms_accepted_at").eq("id", user.id).maybeSingle();
      if (profile?.account_status === "suspended") {
        if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sua conta está suspensa. Fale com o suporte." }, { status: 403 });
        return NextResponse.redirect(new URL("/conta-suspensa", request.url));
      }
      const termsExempt = ["/aceite-termos", "/termos", "/privacidade", "/api/auth/terms", "/auth/callback"];
      const accepted = Boolean(profile?.terms_of_use_version && profile?.privacy_policy_version && profile?.terms_accepted_at);
      if (!accepted && !termsExempt.some(path => pathname === path || pathname.startsWith(path + "/"))) {
        if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Aceite os Termos de Uso e a Política de Privacidade para continuar." }, { status: 403 });
        return NextResponse.redirect(new URL("/aceite-termos", request.url));
      }
    }
  } catch (error) { console.error("[VIVA+] Erro no middleware de autenticação:", error); }

  const protectedPaths = ["/meu-dia", "/agenda", "/financas", "/economizar", "/assistente", "/perfil", "/admin"];
  const isProtectedPath = protectedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (!user && isProtectedPath) {
    const target = request.nextUrl.clone(); target.pathname = "/login"; target.searchParams.set("next", pathname);
    return NextResponse.redirect(target);
  }
  if (user && ["/login", "/cadastro"].includes(pathname)) return NextResponse.redirect(new URL("/assistente", request.url));
  return response;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest).*)" ] };
