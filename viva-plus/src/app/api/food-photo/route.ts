import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { blockedResponse, readRequestKey } from "@/lib/credits";
export const runtime = "nodejs";
export const maxDuration = 60;

// Foto do prato → alimentos, porções, calorias e macros estimados pela IA.
// A imagem não é guardada: vai só para a análise e é descartada.
const schema = z.object({
  image: z.string().regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/).max(2_000_000),
  note: z.string().trim().max(300).optional(),
  requestId: z.string().max(80).optional(),
});

const ITEM = {
  type: "object", additionalProperties: false,
  required: ["name", "portion", "grams", "kcal", "protein_g", "carbs_g", "fat_g"],
  properties: {
    name: { type: "string", description: "Nome do alimento em português do Brasil, curto. Ex.: Arroz branco" },
    portion: { type: "string", description: "Porção caseira estimada. Ex.: 4 colheres de sopa" },
    grams: { type: "number", description: "Peso estimado em gramas (ou ml para bebidas)" },
    kcal: { type: "number" }, protein_g: { type: "number" }, carbs_g: { type: "number" }, fat_g: { type: "number" },
  },
} as const;
const OUTPUT = {
  type: "object", additionalProperties: false,
  required: ["is_food", "items", "confidence", "tip"],
  properties: {
    is_food: { type: "boolean", description: "false se a foto não mostrar comida ou bebida" },
    items: { type: "array", maxItems: 12, items: ITEM },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    tip: { type: "string", description: "Uma observação curta e gentil sobre o prato (máx. 140 caracteres), sem julgamento." },
  },
} as const;

const INSTRUCTIONS = `Você é o nutricionista virtual do app VIVA+. Analise a foto de uma refeição brasileira e liste cada alimento visível separadamente.
Para cada item estime a porção em medida caseira, o peso em gramas e calorias/macros com base em tabelas brasileiras (TACO/IBGE).
Considere o tamanho do prato e talheres como referência. Inclua óleo/molho só se for visível. Não invente itens que não aparecem.
Se a pessoa escrever uma observação (ex.: "metade do prato", "sem açúcar"), use para ajustar.
Se a foto não for de comida, is_food=false e items vazio. Responda somente no JSON Schema.`;

const normalizeModelId = (v: string) => v.trim().toLowerCase().replace(/-\d{4}-\d{2}-\d{2}$/, "").trim();
type Parsed = { is_food: boolean; items: { name: string; portion: string; grams: number; kcal: number; protein_g: number; carbs_g: number; fat_g: number }[]; confidence: string; tip: string };

function clean(raw: unknown) {
  const d = (raw || {}) as Partial<Parsed>;
  const n = (v: unknown, max: number) => { const x = Number(v); return Number.isFinite(x) ? Math.min(max, Math.max(0, Math.round(x * 10) / 10)) : 0; };
  const items = (Array.isArray(d.items) ? d.items : []).slice(0, 12).map(i => ({
    name: String(i?.name || "Alimento").trim().slice(0, 120) || "Alimento",
    portion: String(i?.portion || "1 porção").trim().slice(0, 40) || "1 porção",
    grams: n(i?.grams, 3000), kcal: Math.round(n(i?.kcal, 5000)), p: n(i?.protein_g, 500), c: n(i?.carbs_g, 1000), f: n(i?.fat_g, 500),
  })).filter(i => i.name.length >= 2);
  return { is_food: Boolean(d.is_food) && items.length > 0, items, confidence: ["low", "medium", "high"].includes(String(d.confidence)) ? String(d.confidence) : "low", tip: String(d.tip || "").slice(0, 200) };
}

export async function POST(request: Request) {
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null; let reservationId: string | null = null;
  try {
    supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Faça login para analisar sua refeição." }, { status: 401 });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Foto inválida. Envie uma imagem JPG, PNG ou WebP." }, { status: 400 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "A análise de fotos está temporariamente indisponível." }, { status: 503 });

    const { data: guard, error: guardError } = await supabase.rpc("viva_reserve_ai_credits", { p_feature: "photo", p_estimated_input_tokens: 1500, p_prefer_cheap: false, p_operation: "meal_photo", p_request_key: readRequestKey(parsed.data.requestId) });
    if (guardError) { console.error("VIVA food-photo reservation failed", guardError); return NextResponse.json({ error: "Não foi possível validar seus créditos. Tente novamente." }, { status: 503 }); }
    if (!guard?.allowed) {
      if (guard?.reason === "duplicate" && guard.cached_answer) { try { return NextResponse.json({ result: clean(JSON.parse(guard.cached_answer)), duplicate: true, wallet: guard.wallet ?? null }); } catch { } }
      const blocked = blockedResponse(guard, "VIVA", "meal_photo");
      return NextResponse.json(blocked.body, { status: blocked.status === 200 ? 402 : blocked.status });
    }
    reservationId = guard.reservation_id;
    const modelKey = String(guard.model_key || "cheap"); const configuredModel = process.env[modelKey === "balanced" ? "OPENAI_MODEL_BALANCED" : "OPENAI_MODEL_CHEAP"] || "";
    if (!normalizeModelId(configuredModel) || normalizeModelId(configuredModel) !== normalizeModelId(String(guard.model_id || ""))) {
      console.error("VIVA food-photo model/pricing mismatch", { configuredModel, priced: guard.model_id });
      await supabase.rpc("viva_release_ai_reservation", { p_reservation_id: reservationId }); reservationId = null;
      return NextResponse.json({ error: "A análise está em manutenção rápida. Tente novamente em instantes." }, { status: 503 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: configuredModel.trim(), instructions: INSTRUCTIONS,
      input: [{ role: "user", content: [
        { type: "input_text", text: parsed.data.note ? "Observação da pessoa: " + parsed.data.note : "Analise esta refeição." },
        { type: "input_image", image_url: parsed.data.image, detail: "high" },
      ] }],
      text: { format: { type: "json_schema", name: "meal_photo", strict: true, schema: OUTPUT as unknown as Record<string, unknown> } },
      max_output_tokens: 1200,
    });
    let result: ReturnType<typeof clean> | null = null;
    try { result = clean(JSON.parse(response.output_text || "")); } catch { result = null; }
    // Sem resposta válida: devolve a reserva, nada é descontado.
    if (!result) { await supabase.rpc("viva_release_ai_reservation", { p_reservation_id: reservationId }); reservationId = null; return NextResponse.json({ error: "Não consegui analisar essa foto. Nenhum crédito foi descontado." }, { status: 502 }); }
    if (!result.is_food) { await supabase.rpc("viva_release_ai_reservation", { p_reservation_id: reservationId }); reservationId = null; return NextResponse.json({ error: "Não encontrei comida nessa foto. Tente de novo mostrando o prato de cima. Nenhum crédito foi descontado." }, { status: 422 }); }

    const tokensIn = response.usage?.input_tokens ?? 0; const tokensOut = response.usage?.output_tokens ?? 0;
    const costUsd = (tokensIn * Number(guard.input_usd_per_million) + tokensOut * Number(guard.output_usd_per_million)) / 1_000_000; const costBrl = costUsd * Number(guard.usd_brl_rate || 6.5) * 1.25;
    const { data: settled, error: settleError } = await supabase.rpc("viva_settle_ai_usage", { p_reservation_id: reservationId, p_model: configuredModel, p_tokens_in: tokensIn, p_tokens_out: tokensOut, p_cost_usd: costUsd, p_cost_brl: costBrl, p_response_text: response.output_text });
    if (settleError) { console.error("VIVA food-photo settlement failed", settleError); await supabase.rpc("viva_release_ai_reservation", { p_reservation_id: reservationId }); reservationId = null; return NextResponse.json({ error: "Não foi possível registrar o consumo. Tente novamente." }, { status: 503 }); }
    reservationId = null;
    return NextResponse.json({ result, usage: { credits: Number(guard.credits_cost || 0), sample: Boolean(guard.sample), sample_left: guard.sample_left ?? null }, wallet: settled?.wallet ?? null });
  } catch (error) {
    console.error("VIVA food-photo error", error);
    if (supabase && reservationId) { try { await supabase.rpc("viva_release_ai_reservation", { p_reservation_id: reservationId }); } catch (e) { console.error("VIVA food-photo release failed", e); } }
    return NextResponse.json({ error: "Não consegui analisar essa foto agora. Nenhum crédito foi descontado." }, { status: 500 });
  }
}
