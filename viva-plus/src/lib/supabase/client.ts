import { createBrowserClient } from "@supabase/ssr";

export function createClient(rememberSession = true) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Configure as variáveis do Supabase no ambiente da Vercel.");
  return createBrowserClient(url, key, {
    isSingleton: false,
    cookieOptions: rememberSession ? { maxAge: 60 * 60 * 24 * 30 } : {},
  });
}
