import { createClient as createJsClient, type Session } from "@supabase/supabase-js";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase não configurado.");
  return createJsClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

async function save(admin: Admin, userId: string, session: Session) {
  const expiresAt = session.expires_at ?? Math.floor(Date.now() / 1000) + (session.expires_in || 3600);
  const { error } = await admin.from("viva_whatsapp_sessions").upsert({
    user_id: userId,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error("VIVA WhatsApp session save failed", error);
}

// Devolve um token de acesso válido do usuário vinculado, para o servidor agir em nome dele.
export async function userAccessToken(admin: Admin, userId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const { data: row } = await admin.from("viva_whatsapp_sessions").select("access_token,refresh_token,expires_at").eq("user_id", userId).maybeSingle();
  if (row?.access_token && Number(row.expires_at) - now > 120) return row.access_token;

  const anon = anonClient();
  if (row?.refresh_token) {
    const { data, error } = await anon.auth.refreshSession({ refresh_token: row.refresh_token });
    if (!error && data.session) { await save(admin, userId, data.session); return data.session.access_token; }
  }

  // Sem sessão reaproveitável: cria uma nova pelo painel administrativo (nenhum e-mail é enviado).
  const { data: found, error: userError } = await admin.auth.admin.getUserById(userId);
  const email = found?.user?.email;
  if (userError || !email) throw new Error("Usuário sem e-mail para abrir a sessão do WhatsApp.");
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) throw new Error("Não foi possível gerar a sessão do WhatsApp.");
  const { data: verified, error: verifyError } = await anon.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (verifyError || !verified.session) throw new Error("Não foi possível validar a sessão do WhatsApp.");
  await save(admin, userId, verified.session);
  return verified.session.access_token;
}
