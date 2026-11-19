// Sessão do painel: cookie assinado com HMAC-SHA256 (Web Crypto — funciona no middleware e nas rotas).
export const COOKIE = "ws_admin";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 dias

function segredo() {
  return process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || "dev-secret-troque-isto";
}

async function hmac(msg: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function criarToken() {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  return `${exp}.${await hmac(String(exp))}`;
}

export async function tokenValido(token?: string | null) {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  const esperado = await hmac(exp);
  if (esperado.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ esperado.charCodeAt(i);
  return diff === 0;
}

export function senhaAdmin() {
  // Em desenvolvimento, sem senha configurada, a senha é "willame".
  return process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === "production" ? "" : "willame");
}

export const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE,
};
