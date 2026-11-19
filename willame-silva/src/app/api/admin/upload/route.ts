import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

const TIPOS = ["image/jpeg", "image/png", "image/webp", "image/avif", "video/mp4"];

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ erro: "Arquivo ausente" }, { status: 400 });
  if (!TIPOS.includes(file.type)) return NextResponse.json({ erro: "Envie JPG, PNG, WEBP ou MP4." }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ erro: "Máximo 15 MB." }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const nome = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await sb.storage.from("ws-midia").upload(nome, bytes, { contentType: file.type });
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({ url: sb.storage.from("ws-midia").getPublicUrl(nome).data.publicUrl });
  }
  if (process.env.VERCEL) {
    return NextResponse.json(
      { erro: "Para enviar fotos, conecte o Supabase. Enquanto isso, cole o link da imagem." },
      { status: 400 },
    );
  }
  const dir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, nome), bytes);
  return NextResponse.json({ url: `/uploads/${nome}` });
}
