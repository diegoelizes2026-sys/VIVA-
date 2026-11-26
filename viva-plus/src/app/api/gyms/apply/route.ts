import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MODALITY_IDS, validCnpj } from "@/lib/gyms";

export const runtime = "nodejs";

// Academias credenciadas: o dono envia/atualiza o cadastro (aprovação manual no painel, com conferência do CNPJ).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { data } = await supabase.from("viva_gym_profiles").select("name,cnpj,city,state,neighborhood,address,lat,lon,modalities,price_from_cents,hours,whatsapp,instagram,photo_url,bio,perk,status,admin_note,approved_at").eq("owner_id", user.id).maybeSingle();
  return NextResponse.json({ gym: data ?? null });
}

const Fields = z.object({
  name: z.string().trim().min(2, "Digite o nome da academia.").max(80),
  cnpj: z.string().trim().refine(validCnpj, "CNPJ inválido. Confira os números."),
  city: z.string().trim().min(2, "Digite a cidade.").max(80),
  state: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Escolha o estado."),
  neighborhood: z.string().trim().max(60).optional().default(""),
  address: z.string().trim().max(160).optional().default(""),
  lat: z.coerce.number().min(-35).max(7, "Marque a localização da academia."),
  lon: z.coerce.number().min(-75).max(-28, "Marque a localização da academia."),
  modalities: z.string().transform(s => s.split(",").filter(Boolean)).pipe(z.array(z.enum(MODALITY_IDS)).min(1, "Escolha ao menos uma modalidade.").max(10)),
  price_from: z.string().trim().optional().default(""),
  hours: z.string().trim().max(120).optional().default(""),
  whatsapp: z.string().trim().max(20).optional().default(""),
  instagram: z.string().trim().max(31).optional().default(""),
  bio: z.string().trim().max(200).optional().default(""),
  perk: z.string().trim().max(100).optional().default(""),
  consent: z.literal("true", { errorMap: () => ({ message: "Marque a autorização para mostrar a academia no app." }) }),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta para cadastrar a academia." }, { status: 401 });
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const parsed = Fields.safeParse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Confira os dados." }, { status: 400 });
  const v = parsed.data;
  const ig = v.instagram.replace(/^@/, "");
  if (ig && !/^[A-Za-z0-9._]{1,30}$/.test(ig)) return NextResponse.json({ error: "Instagram inválido. Use só o @, sem link." }, { status: 400 });
  const wa = v.whatsapp.replace(/\D/g, "");
  if (wa && (wa.length < 10 || wa.length > 13)) return NextResponse.json({ error: "WhatsApp inválido. Use DDD + número." }, { status: 400 });
  if (v.neighborhood && v.neighborhood.length < 2) return NextResponse.json({ error: "Bairro muito curto." }, { status: 400 });
  if (v.address && v.address.length < 4) return NextResponse.json({ error: "Endereço muito curto." }, { status: 400 });
  let price: number | null = null;
  if (v.price_from) { const n = Number(v.price_from.replace(/[^\d,.]/g, "").replace(/\.(?=\d{3})/g, "").replace(",", ".")); if (!(n >= 10 && n <= 5000)) return NextResponse.json({ error: "Mensalidade entre R$ 10 e R$ 5.000." }, { status: 400 }); price = Math.round(n * 100); }

  let photoUrl: string | null = null;
  const photo = form.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(photo.type)) return NextResponse.json({ error: "A foto precisa ser JPG, PNG ou WebP, até 2 MB." }, { status: 400 });
    const admin = createAdminClient();
    const ext = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
    const path = `gyms/${user.id}/${randomUUID()}.${ext}`;
    const { error } = await admin.storage.from("viva-partner-photos").upload(path, Buffer.from(await photo.arrayBuffer()), { contentType: photo.type, cacheControl: "31536000", upsert: false });
    if (error) { console.error("VIVA gym photo", error); return NextResponse.json({ error: "Não consegui enviar a foto agora." }, { status: 500 }); }
    photoUrl = admin.storage.from("viva-partner-photos").getPublicUrl(path).data.publicUrl;
  }
  const { data, error } = await supabase.rpc("viva_gym_apply", { p_name: v.name, p_cnpj: v.cnpj, p_city: v.city, p_state: v.state, p_neighborhood: v.neighborhood, p_address: v.address, p_lat: v.lat, p_lon: v.lon, p_modalities: v.modalities, p_price_from_cents: price, p_hours: v.hours, p_whatsapp: wa, p_instagram: ig, p_bio: v.bio, p_perk: v.perk, p_photo_url: photoUrl });
  if (error) { console.error("VIVA gym apply", error); return NextResponse.json({ error: "Não consegui salvar o cadastro. Confira os dados e tente de novo." }, { status: 400 }); }
  return NextResponse.json(data);
}
