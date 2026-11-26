import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { MODALITY_IDS } from "@/lib/gyms";

// Radar de academias credenciadas perto de quem busca. O ponto de quem busca é arredondado (~100 m) e não é gravado.
const Query = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(1).max(100).default(10),
  modality: z.enum(MODALITY_IDS).optional(),
});

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Localização inválida." }, { status: 400 });
  const lat = Math.round(parsed.data.lat * 1000) / 1000, lon = Math.round(parsed.data.lon * 1000) / 1000;
  const { data, error } = await supabase.rpc("viva_gym_radar", { p_lat: lat, p_lon: lon, p_radius_km: parsed.data.radius, p_modality: parsed.data.modality ?? null, p_limit: 40 });
  if (error) { console.error("VIVA gym radar", error); return NextResponse.json({ error: "Não consegui buscar as academias agora." }, { status: 500 }); }
  return NextResponse.json({ gyms: data || [] }, { headers: { "Cache-Control": "private, max-age=60" } });
}
