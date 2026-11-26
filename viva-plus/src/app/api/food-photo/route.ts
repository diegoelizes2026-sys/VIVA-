import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { runFoodAi } from "@/lib/food-ai";
export const runtime = "nodejs";
export const maxDuration = 60;

// Foto do prato → alimentos, porções, calorias e macros estimados pela IA.
// A imagem não é guardada: vai só para a análise e é descartada.
const schema = z.object({
  image: z.string().regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/).max(4_000_000),
  note: z.string().trim().max(300).optional(),
  requestId: z.string().max(80).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login para analisar sua refeição." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Foto inválida. Envie uma imagem JPG, PNG ou WebP de até 3 MB." }, { status: 400 });
  const r = await runFoodAi(supabase, parsed.data);
  if (!r.ok) return NextResponse.json(r.body, { status: r.status });
  return NextResponse.json({ result: r.result, usage: { credits: r.credits, sample: r.sample, sample_left: r.sample_left }, wallet: r.wallet });
}
