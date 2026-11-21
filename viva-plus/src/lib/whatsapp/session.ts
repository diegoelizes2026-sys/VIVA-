import { createClient as createSupabaseClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;
export type WhatsAppState = {
  user_id: string;
  history: unknown;
  pending: unknown;
  session_access_token: string | null;
  session_refresh_token: string | null;
  session_expires_at: string | null;
};

function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase não configurado.");
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

async function saveSession(admin: Admin, userId: string, session: Session) {
  const expiresAt = session.expires_at ? new Date(session.expires_at * 1000).toISOString() : new Date(Date.now() + 50 * 60000).toISOString();
  const { error } = await admin.from("viva_whatsapp_state").upsert(
    { user_id: userId, session_access_token: session.access_token, session_refresh_token: session.refresh_token, session_expires_at: expiresAt, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  if (error) console.error("VIVA WhatsApp session save failed", error);
}

/**
 * Devolve um cliente Supabase autenticado como o usuário dono do número.
 * Reaproveita a sessão guardada; se expirou, renova; se não der, cria uma nova
 * por link mágico gerado no servidor (nenhum e-mail é enviado).
 */
export async function getUserClient(admin: Admin, userId: string, state: WhatsAppState | null): Promise<SupabaseClient> {
  const client = anonClient();
  const access = state?.session_access_token;
  const refresh = state?.session_refresh_token;
  const expiresAt = state?.session_expires_at ? new Date(state.session_expires_at).getTime() : 0;

  if (access && refresh && expiresAt - Date.now() > 120000) {
    const { data, error } = await client.auth.setSession({ access_token: access, refresh_token: refresh });
    if (!error && data.session?.user.id === userId) return client;
  }
  if (refresh) {
    const { data, error } = await client.auth.refreshSession({ refresh_token: refresh });
    if (!error && data.session && data.session.user.id === userId) {
      await saveSession(admin, userId, data.session);
      return client;
    }
  }

  const { data: found, error: userError } = await admin.auth.admin.getUserById(userId);
  if (userError || !found.user?.email) throw new Error("Conta sem e-mail: não consigo autenticar pelo WhatsApp.");
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: found.user.email });
  if (linkError || !link.properties?.hashed_token) throw new Error("Não consegui gerar a sessão do WhatsApp.");
  const { data: verified, error: verifyError } = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
  if (verifyError || !verified.session || verified.session.user.id !== userId) throw new Error("Não consegui abrir a sessão do WhatsApp.");
  await saveSession(admin, userId, verified.session);
  return client;
}
