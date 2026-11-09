import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies) {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // A missing session is expected for visitors who are not logged in.
  // Keep logging unexpected Supabase auth failures only.
  if (error && error.message !== "Auth session missing!") {
    console.error("Falha ao validar sessão Supabase no middleware:", error.message);
  }

  const protectedPath = [
    "/meu-dia",
    "/agenda",
    "/financas",
    "/economizar",
    "/assistente",
    "/perfil",
  ];

  if (
    !user &&
    protectedPath.some((path) => request.nextUrl.pathname.startsWith(path))
  ) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    target.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(target);
  }

  if (user && ["/login", "/cadastro"].includes(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/meu-dia", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest).*)"],
};
