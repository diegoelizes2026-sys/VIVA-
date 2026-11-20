import { createServerClient } from "@supabase/ssr";
import { createClient as createJsClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { actingUserToken } from "@/lib/supabase/acting-user";

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase não configurado. Adicione as variáveis de ambiente.");

  // Execução em nome de um usuário (WhatsApp): usa o token dele em vez dos cookies do navegador.
  const token = actingUserToken();
  if (token) {
    const client = createJsClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const getUser = client.auth.getUser.bind(client.auth);
    client.auth.getUser = ((jwt?: string) => getUser(jwt ?? token)) as typeof client.auth.getUser;
    return client as unknown as ReturnType<typeof createServerClient>;
  }

  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (items) => {
        try { items.forEach(({name,value,options}) => store.set(name,value,options)); } catch {}
      }
    }
  });
}
