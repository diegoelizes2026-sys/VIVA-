import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Rede de Personais: o próprio personal envia/atualiza o cadastro (aprovação manual no painel).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { data } = await supabase.from("viva_partner_profiles").select("display_name,cref,city,state,instagram,whatsapp,photo_url,bio,desired_code,status,reviewer,admin_note,gym_name,neighborhood,service_lat,modes,home_radius_km").eq("user_id", user.id).maybeSingle();
  const { data: code } = await supabase.from("viva_referral_codes").select("code").eq("user_id", user.id).maybeSingle();
  return NextResponse.json({ profile: data ?? null, code: data?.status === "approved" ? code?.code ?? null : null });
}

const Fields = z.object({
  display_name: z.string().trim().min(2, "Digite seu nome profissional.").max(80),
  cref: z.string().trim().min(4, "Digite seu CREF completo (ex.: 012345-G/CE).").max(30),
  city: z.string().trim().min(2, "Digite sua cidade.").max(80),
  state: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Escolha o estado."),
  instagram: z.string().trim().max(31).optional().default(""),
  whatsapp: z.string().trim().max(20).optional().default(""),
  bio: z.string().trim().max(160).optional().default(""),
  desired_code: z.string().trim().max(12).optional().default(""),
  consent: z.literal("true", { errorMap: () => ({ message: "Marque a autorização para mostrar seus dados no app." }) }),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta para se cadastrar." }, { status: 401 });
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const parsed = Fields.safeParse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Confira os dados." }, { status: 400 });
  const v = parsed.data;
  const ig = v.instagram.replace(/^@/, "");
  if (ig && !/^[A-Za-z0-9._]{1,30}$/.test(ig)) return NextResponse.json({ error: "Instagram inválido. Use só o @, sem link." }, { status: 400 });
  const wa = v.whatsapp.replace(/\D/g, "");
  if (wa && (wa.length < 10 || wa.length > 13)) return NextResponse.json({ error: "WhatsApp inválido. Use DDD + número." }, { status: 400 });
  const code = v.desired_code.toUpperCase();
  if (code && !/^[A-Z0-9]{4,12}$/.test(code)) return NextResponse.json({ error: "O código precisa ter de 4 a 12 letras ou números." }, { status: 400 });

  // Foto (opcional): já vem reduzida do navegador; guarda num bucket público.
  let photoUrl: string | null = null;
  const photo = form.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(photo.type)) return NextResponse.json({ error: "A foto precisa ser JPG, PNG ou WebP, até 2 MB." }, { status: 400 });
    const admin = createAdminClient();
    const ext = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
    const path = `${user.id}/${randomUUID()}.${ext}`;
    const { error } = await admin.storage.from("viva-partner-photos").upload(path, Buffer.from(await photo.arrayBuffer()), { contentType: photo.type, cacheControl: "31536000", upsert: false });
    if (error) { console.error("VIVA partner photo", error); return NextResponse.json({ error: "Não consegui enviar a foto agora." }, { status: 500 }); }
    photoUrl = admin.storage.from("viva-partner-photos").getPublicUrl(path).data.publicUrl;
  }
  const { data, error } = await supabase.rpc("viva_partner_apply", { p_display_name: v.display_name, p_cref: v.cref, p_city: v.city, p_state: v.state, p_instagram: ig, p_whatsapp: wa, p_bio: v.bio, p_desired_code: code, p_photo_url: photoUrl });
  if (error) { console.error("VIVA partner apply", error); return NextResponse.json({ error: "Não consegui salvar seu cadastro. Confira os dados e tente de novo." }, { status: 400 }); }
  return NextResponse.json(data);
}
