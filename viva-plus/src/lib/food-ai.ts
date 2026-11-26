// IA de alimentação do VIVA+: foto do prato ou texto ("comi 2 pães com ovo") → itens com porção, calorias e macros.
// Toda chamada passa pelo motor de créditos (reserva → IA → liquidação, ou devolução se falhar).
import OpenAI from "openai";
import type { createClient } from "@/lib/supabase/server";
import { blockedResponse, readRequestKey } from "@/lib/credits";

type Supa = Awaited<ReturnType<typeof createClient>>;
export type FoodAiItem = { name: string; portion: string; grams: number; kcal: number; p: number; c: number; f: number };
export type FoodAiResult = { is_food: boolean; items: FoodAiItem[]; confidence: string; tip: string; meal: string | null };

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
  required: ["is_food", "items", "confidence", "tip", "meal"],
  properties: {
    is_food: { type: "boolean", description: "false se não houver comida ou bebida (ex.: comprovante, nota fiscal, documento, print de tela)" },
    items: { type: "array", maxItems: 12, items: ITEM },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    tip: { type: "string", description: "Observação curta e gentil sobre a refeição (máx. 140 caracteres), sem julgamento." },
    meal: { type: ["string", "null"], enum: ["breakfast", "lunch", "snack", "dinner", null], description: "Refeição citada explicitamente pela pessoa (café, almoço, lanche, jantar); null se não disser." },
  },
} as const;

const BASE = `Você é o nutricionista virtual do app VIVA+. Liste cada alimento ou bebida separadamente, com porção em medida caseira, peso em gramas e calorias/macros com base em tabelas brasileiras (TACO/IBGE).
Não invente itens. Se não houver comida nem bebida, is_food=false e items vazio. Responda somente no JSON Schema.`;
const PHOTO = BASE + `\nVocê recebe a FOTO de uma refeição. Use o prato e os talheres como referência de tamanho. Inclua óleo/molho só se for visível. Se a foto for comprovante, nota fiscal, documento ou print de tela, is_food=false.`;
const TEXT = BASE + `\nVocê recebe um TEXTO em que a pessoa conta o que comeu ou bebeu. Use as quantidades ditas; se não disser, use uma porção média brasileira. Água pura não conta como alimento (ignore).`;

const normalizeModelId = (v: string) => v.trim().toLowerCase().replace(/-\d{4}-\d{2}-\d{2}$/, "").trim();

export function cleanFoodAi(raw: unknown): FoodAiResult {
  const d = (raw || {}) as Record<string, unknown>;
  const n = (v: unknown, max: number) => { const x = Number(v); return Number.isFinite(x) ? Math.min(max, Math.max(0, Math.round(x * 10) / 10)) : 0; };
  const items = (Array.isArray(d.items) ? d.items : []).slice(0, 12).map((i: Record<string, unknown>) => ({
    name: String(i?.name || "Alimento").trim().slice(0, 120) || "Alimento",
    portion: String(i?.portion || "1 porção").trim().slice(0, 40) || "1 porção",
    grams: n(i?.grams, 3000), kcal: Math.round(n(i?.kcal, 5000)), p: n(i?.protein_g ?? i?.p, 500), c: n(i?.carbs_g ?? i?.c, 1000), f: n(i?.fat_g ?? i?.f, 500),
  })).filter(i => i.name.length >= 2);
  const meal = ["breakfast", "lunch", "snack", "dinner"].includes(String(d.meal)) ? String(d.meal) : null;
  return { is_food: Boolean(d.is_food) && items.length > 0, items, confidence: ["low", "medium", "high"].includes(String(d.confidence)) ? String(d.confidence) : "low", tip: String(d.tip || "").slice(0, 200), meal };
}

type Ok = { ok: true; result: FoodAiResult; credits: number; sample: boolean; sample_left: number | null; wallet: unknown };
type Fail = { ok: false; status: number; body: Record<string, unknown> };

export async function runFoodAi(supabase: Supa, input: { image?: string; text?: string; note?: string; requestId?: string }): Promise<Ok | Fail> {
  if (!process.env.OPENAI_API_KEY) return { ok: false, status: 503, body: { error: "A análise de refeições está temporariamente indisponível." } };
  const photo = Boolean(input.image);
  const { data: guard, error: guardError } = await supabase.rpc("viva_reserve_ai_credits", {
    p_feature: photo ? "photo" : "chat", p_estimated_input_tokens: photo ? 1500 : 600, p_prefer_cheap: !photo,
    p_operation: photo ? "meal_photo" : "simple_question", p_request_key: readRequestKey(input.requestId),
  });
  if (guardError) { console.error("VIVA food-ai reservation failed", guardError); return { ok: false, status: 503, body: { error: "Não foi possível validar seus créditos. Tente novamente." } }; }
  if (!guard?.allowed) {
    if (guard?.reason === "duplicate" && guard.cached_answer) { try { return { ok: true, result: cleanFoodAi(JSON.parse(guard.cached_answer)), credits: 0, sample: false, sample_left: null, wallet: guard.wallet ?? null }; } catch { } }
    const blocked = blockedResponse(guard, "VIVA", photo ? "meal_photo" : undefined);
    return { ok: false, status: blocked.status === 200 ? 402 : blocked.status, body: blocked.body };
  }
  let reservationId: string | null = guard.reservation_id;
  const release = async () => { if (reservationId) { const id = reservationId; reservationId = null; try { await supabase.rpc("viva_release_ai_reservation", { p_reservation_id: id }); } catch (e) { console.error("VIVA food-ai release failed", e); } } };
  try {
    const configuredModel = process.env[String(guard.model_key || "cheap") === "balanced" ? "OPENAI_MODEL_BALANCED" : "OPENAI_MODEL_CHEAP"] || "";
    if (!normalizeModelId(configuredModel) || normalizeModelId(configuredModel) !== normalizeModelId(String(guard.model_id || ""))) {
      console.error("VIVA food-ai model/pricing mismatch", { configuredModel, priced: guard.model_id });
      await release(); return { ok: false, status: 503, body: { error: "A análise está em manutenção rápida. Tente novamente em instantes." } };
    }
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const content = photo
      ? [{ type: "input_text" as const, text: input.note ? "Observação da pessoa: " + input.note : "Analise esta refeição." }, { type: "input_image" as const, image_url: input.image!, detail: "high" as const }]
      : [{ type: "input_text" as const, text: String(input.text || "").slice(0, 1000) }];
    const response = await client.responses.create({
      model: configuredModel.trim(), instructions: photo ? PHOTO : TEXT,
      input: [{ role: "user", content }],
      text: { format: { type: "json_schema", name: "meal_items", strict: true, schema: OUTPUT as unknown as Record<string, unknown> } },
      max_output_tokens: 1200,
    });
    let result: FoodAiResult | null = null;
    try { result = cleanFoodAi(JSON.parse(response.output_text || "")); } catch { result = null; }
    // Sem resposta válida ou sem comida: devolve a reserva, nada é descontado.
    if (!result) { await release(); return { ok: false, status: 502, body: { error: "Não consegui analisar agora. Nenhum crédito foi descontado." } }; }
    if (!result.is_food) { await release(); return { ok: false, status: 422, body: { not_food: true, error: photo ? "Não encontrei comida nessa foto. Tente de novo mostrando o prato de cima. Nenhum crédito foi descontado." : "Não identifiquei nenhum alimento nessa mensagem. Nenhum crédito foi descontado." } }; }
    const tokensIn = response.usage?.input_tokens ?? 0; const tokensOut = response.usage?.output_tokens ?? 0;
    const costUsd = (tokensIn * Number(guard.input_usd_per_million) + tokensOut * Number(guard.output_usd_per_million)) / 1_000_000; const costBrl = costUsd * Number(guard.usd_brl_rate || 6.5) * 1.25;
    const { data: settled, error: settleError } = await supabase.rpc("viva_settle_ai_usage", { p_reservation_id: reservationId, p_model: configuredModel, p_tokens_in: tokensIn, p_tokens_out: tokensOut, p_cost_usd: costUsd, p_cost_brl: costBrl, p_response_text: response.output_text });
    if (settleError) { console.error("VIVA food-ai settlement failed", settleError); await release(); return { ok: false, status: 503, body: { error: "Não foi possível registrar o consumo. Tente novamente." } }; }
    reservationId = null;
    return { ok: true, result, credits: Number(guard.credits_cost || 0), sample: Boolean(guard.sample), sample_left: guard.sample_left ?? null, wallet: settled?.wallet ?? null };
  } catch (error) {
    console.error("VIVA food-ai error", error);
    await release();
    return { ok: false, status: 500, body: { error: "Não consegui analisar agora. Nenhum crédito foi descontado." } };
  }
}
