import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// O personal define onde e como atende (academia/bairro, domicílio, online). Não precisa de nova análise.
const Body = z.object({
  gym_name: z.string().trim().max(80).optional().default(""),
  neighborhood: z.string().trim().max(60).optional().default(""),
  lat: z.number().min(-35).max(7).nullable(),
  lon: z.number().min(-75).max(-28).nullable(),
  precise: z.boolean().default(true),
  modes: z.array(z.enum(["academia", "domicilio", "online", "ar_livre"])).min(1, "Escolha como você atende.").max(4),
  home_radius_km: z.number().int().min(1).max(50).nullable().optional(),
});
const ERRORS: Record<string, string> = {
  not_partner: "Faça primeiro o seu cadastro de parceiro.",
  modes_required: "Escolha como você atende.",
  point_required: "Marque a academia ou o bairro onde você atende.",
  invalid_point: "Localização inválida. Tente marcar de novo.",
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Confira os dados." }, { status: 400 });
  const v = parsed.data;
  if (v.gym_name && v.gym_name.length < 2) return NextResponse.json({ error: "Nome da academia muito curto." }, { status: 400 });
  if (v.neighborhood && v.neighborhood.length < 2) return NextResponse.json({ error: "Nome do bairro muito curto." }, { status: 400 });
  const { error } = await supabase.rpc("viva_partner_set_location", { p_gym_name: v.gym_name, p_neighborhood: v.neighborhood, p_lat: v.lat, p_lon: v.lon, p_modes: v.modes, p_home_radius_km: v.home_radius_km ?? null, p_precise: v.precise });
  if (error) {
    const key = Object.keys(ERRORS).find(k => error.message.includes(k));
    if (!key) console.error("VIVA partner location", error);
    return NextResponse.json({ error: key ? ERRORS[key] : "Não consegui salvar agora. Tente de novo." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

// Só muda o jeito de atender (e o raio), mantendo o local já marcado.
const Patch = z.object({
  modes: z.array(z.enum(["academia", "domicilio", "online", "ar_livre"])).min(1, "Escolha como você atende.").max(4),
  home_radius_km: z.number().int().min(1).max(50).nullable().optional(),
});
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Confira os dados." }, { status: 400 });
  const { data: cur } = await supabase.from("viva_partner_profiles").select("gym_name,neighborhood,service_lat,service_lon").eq("user_id", user.id).maybeSingle();
  if (!cur) return NextResponse.json({ error: ERRORS.not_partner }, { status: 400 });
  const { error } = await supabase.rpc("viva_partner_set_location", { p_gym_name: cur.gym_name ?? "", p_neighborhood: cur.neighborhood ?? "", p_lat: cur.service_lat, p_lon: cur.service_lon, p_modes: parsed.data.modes, p_home_radius_km: parsed.data.home_radius_km ?? null, p_precise: true });
  if (error) {
    const key = Object.keys(ERRORS).find(k => error.message.includes(k));
    if (!key) console.error("VIVA partner location patch", error);
    return NextResponse.json({ error: key ? ERRORS[key] : "Não consegui salvar agora. Tente de novo." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
