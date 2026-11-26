import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { runFoodAi } from "@/lib/food-ai";
export const runtime = "nodejs";
export const maxDuration = 60;

// Texto ("comi 2 pães com ovo e um café") → alimentos, porções, calorias e macros estimados pela IA.
const schema = z.object({ text: z.string().trim().min(2).max(1000), requestId: z.string().max(80).optional() });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login para registrar sua refeição." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Conte o que você comeu em até 1.000 caracteres." }, { status: 400 });
  const r = await runFoodAi(supabase, { text: parsed.data.text, requestId: parsed.data.requestId });
  if (!r.ok) return NextResponse.json(r.body, { status: r.status });
  return NextResponse.json({ result: r.result, usage: { credits: r.credits }, wallet: r.wallet });
}
