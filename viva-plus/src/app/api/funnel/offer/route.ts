import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OFFER_COOKIE, createOfferToken, readOfferToken } from "@/lib/funnel-offer";

export const runtime = "nodejs";

// Liga o relógio da oferta quando a pessoa vê o resultado do diagnóstico.
// Se já existe um prazo (mesmo vencido), mantém o mesmo: refazer o diagnóstico não reinicia o relógio.
// Só depois de 24 h do fim é que um novo prazo pode começar (visita nova, outra campanha).
export async function POST() {
  const jar = await cookies();
  const current = jar.get(OFFER_COOKIE)?.value;
  const expiresAt = readOfferToken(current);
  if (current && expiresAt && new Date(expiresAt).getTime() > Date.now() - 24 * 3600_000) return NextResponse.json({ expiresAt, token: current });
  const fresh = createOfferToken();
  const res = NextResponse.json(fresh);
  res.cookies.set(OFFER_COOKIE, fresh.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 7 * 86400 });
  return res;
}

export async function GET() {
  const current = (await cookies()).get(OFFER_COOKIE)?.value;
  const expiresAt = readOfferToken(current);
  return NextResponse.json(expiresAt ? { expiresAt, token: current } : { expiresAt: null });
}
