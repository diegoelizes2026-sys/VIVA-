import { AsyncLocalStorage } from "node:async_hooks";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function cookieClient(store: Awaited<ReturnType<typeof cookies>>, url: string, key: string) {
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (items) => {
        try { items.forEach(({name,value,options}) => store.set(name,value,options)); } catch {}
      }
    }
  });
}
type ServerClient = ReturnType<typeof cookieClient>;

// Permite que canais sem cookie (ex.: robô do WhatsApp) reutilizem as mesmas
// rotas do app com o cliente já autenticado como o usuário. A RLS continua valendo.
const clientOverride = new AsyncLocalStorage<SupabaseClient>();

export function runWithSupabaseClient<T>(client: SupabaseClient, fn: () => Promise<T>): Promise<T> {
  return clientOverride.run(client, fn);
}

export async function createClient(): Promise<ServerClient> {
  const override = clientOverride.getStore();
  if (override) return override as unknown as ServerClient;
  const store = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase não configurado. Adicione as variáveis de ambiente.");
  return cookieClient(store, url, key);
}
