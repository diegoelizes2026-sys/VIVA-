import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Keep public pages available if Supabase environment variables are not configured.
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  let user = null;

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { data, error } = await supabase.auth.getUser();

    if (error && error.message !== "Auth session missing!") {
      console.error("[VIVA+] Falha ao validar sessão:", error.message);
    }

    user = data.user;
  } catch (error) {
    console.error("[VIVA+] Erro no middleware de autenticação:", error);
  }

  const pathname = request.nextUrl.pathname;
  const protectedPaths = [
    "/meu-dia",
    "/agenda",
    "/financas",
    "/economizar",
    "/assistente",
    "/perfil",
  ];

  const isProtectedPath = protectedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (!user && isProtectedPath) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    target.searchParams.set("next", pathname);
    return NextResponse.redirect(target);
  }

  if (user && ["/login", "/cadastro"].includes(pathname)) {
    return NextResponse.redirect(new URL("/meu-dia", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest).*)"],
};
