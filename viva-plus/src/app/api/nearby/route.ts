import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { OVERPASS_ENDPOINTS, searchPlaces, type NearbyKind } from "@/lib/nearby";

// Lugares próximos via OpenStreetMap (Overpass). A localização não é gravada: só é usada nesta busca,
// arredondada (~100 m) antes de sair do servidor, e o resultado fica em cache por 10 minutos.
const Query = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  type: z.enum(["mercado", "farmacia", "restaurante", "academia"]),
  radius: z.coerce.number().int().min(300).max(5000).default(2000),
});

const ENDPOINTS = (process.env.OVERPASS_URL ? [process.env.OVERPASS_URL] : []).concat(OVERPASS_ENDPOINTS);
export const maxDuration = 30;

type Cached = { at: number; data: unknown };
const cache = new Map<string, Cached>();
const TTL = 10 * 60 * 1000;
const perUser = new Map<string, number[]>();

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Localização inválida." }, { status: 400 });
  const { type, radius } = parsed.data;
  const lat = Math.round(parsed.data.lat * 1000) / 1000, lon = Math.round(parsed.data.lon * 1000) / 1000;

  const key = `${type}:${lat}:${lon}:${radius}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.data, { headers: { "Cache-Control": "private, max-age=300" } });

  // Limite simples por usuário: 20 buscas novas a cada 5 minutos (o cache não conta).
  const now = Date.now();
  const recent = (perUser.get(user.id) || []).filter(t => now - t < 5 * 60 * 1000);
  if (recent.length >= 20) return NextResponse.json({ error: "Muitas buscas seguidas. Espere um minutinho e tente de novo." }, { status: 429 });
  recent.push(now); perUser.set(user.id, recent);

  try {
    const found = await searchPlaces(type as NearbyKind, lat, lon, radius, { overpassEndpoints: ENDPOINTS, photonBase: process.env.PHOTON_URL || undefined, headers: { "User-Agent": "VIVA-Plus/1.0 (lugares proximos)" } });
    const data = { type, radius, places: found.places, source: found.source };
    if (cache.size > 500) cache.clear();
    cache.set(key, { at: now, data });
    return NextResponse.json(data, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (e) {
    const reason = e instanceof Error ? e.message.replace(/^search_failed\s*/, "").slice(0, 300) : "erro";
    console.error("VIVA nearby", reason);
    // O navegador tenta direto no OpenStreetMap quando o servidor não consegue.
    return NextResponse.json({ error: "Não consegui buscar os lugares agora. Tente de novo em instantes.", reason, fallback: true }, { status: 502 });
  }
}
