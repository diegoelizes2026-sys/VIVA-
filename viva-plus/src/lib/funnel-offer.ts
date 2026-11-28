import { createHmac, timingSafeEqual } from "node:crypto";
import { FUNNEL_OFFER_MINUTES } from "@/lib/life-diagnostic";

// Prazo da oferta do funil (Pro por R$19,90). O prazo nasce quando a pessoa vê o resultado do
// diagnóstico e fica assinado (HMAC): o navegador mostra o relógio e o checkout confere o mesmo prazo.
// Guardado num cookie httpOnly e, no cadastro, também nos dados da conta (para quem confirma o e-mail em outro aparelho).
export const OFFER_COOKIE = "viva_offer";
const GRACE_MS = 5 * 60_000; // margem para quem clicou em pagar no último minuto

const secret = () => process.env.FUNNEL_OFFER_SECRET || process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const sign = (exp: number) => createHmac("sha256", secret()).update("offer:" + exp).digest("hex").slice(0, 32);

export function createOfferToken(now = Date.now()) {
  const exp = now + FUNNEL_OFFER_MINUTES * 60_000;
  return { token: `${exp}.${sign(exp)}`, expiresAt: new Date(exp).toISOString() };
}

/** Devolve o prazo (ISO) se o token é legítimo, ou null. Não diz se já venceu. */
export function readOfferToken(token?: string | null) {
  if (!token || !secret()) return null;
  const m = /^(\d{13})\.([0-9a-f]{32})$/.exec(token);
  if (!m) return null;
  const exp = Number(m[1]);
  const a = Buffer.from(sign(exp)), b = Buffer.from(m[2]);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (exp > Date.now() + FUNNEL_OFFER_MINUTES * 60_000 + 60_000) return null; // prazo maior do que o permitido
  return new Date(exp).toISOString();
}

/** Prazo válido mais longo entre o cookie e o token guardado na conta. */
export function offerDeadline(cookieToken?: string | null, metaToken?: unknown) {
  const list = [readOfferToken(cookieToken), readOfferToken(typeof metaToken === "string" ? metaToken : null)].filter(Boolean) as string[];
  return list.sort().pop() ?? null;
}

export const offerOpen = (deadline: string | null, now = Date.now()) => !!deadline && new Date(deadline).getTime() + GRACE_MS > now;
