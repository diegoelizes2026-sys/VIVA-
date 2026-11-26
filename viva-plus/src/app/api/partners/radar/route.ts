import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Radar de Personais: aprovados perto de quem busca, com a distância em km.
// A localização de quem busca é arredondada (~100 m) e não é gravada.
const Query = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(1).max(100).default(10),
  mode: z.enum(["academia", "domicilio", "online", "ar_livre"]).optional(),
});

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Localização inválida." }, { status: 400 });
  const { radius, mode } = parsed.data;
  const lat = Math.round(parsed.data.lat * 1000) / 1000, lon = Math.round(parsed.data.lon * 1000) / 1000;
  const { data, error } = await supabase.rpc("viva_partner_radar", { p_lat: lat, p_lon: lon, p_radius_km: radius, p_mode: mode ?? null, p_limit: 40 });
  if (error) { console.error("VIVA partner radar", error); return NextResponse.json({ error: "Não consegui buscar os personais agora." }, { status: 500 }); }
  return NextResponse.json({ partners: data || [] }, { headers: { "Cache-Control": "private, max-age=60" } });
}
