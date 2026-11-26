import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseOffProduct } from "@/lib/nutrition";

// Busca um alimento pelo código de barras na base aberta Open Food Facts.
// Nada do usuário é enviado: só o número do código. Resultado em cache por 24 h.
type Cached = { at: number; status: number; data: unknown };
const cache = new Map<string, Cached>();
const TTL = 24 * 60 * 60 * 1000;
const perUser = new Map<string, number[]>();
const FIELDS = "product_name,product_name_pt,generic_name,brands,serving_size,serving_quantity,nutriments";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const code = (new URL(request.url).searchParams.get("code") || "").replace(/\D/g, "");
  if (code.length < 8 || code.length > 14) return NextResponse.json({ error: "Código de barras inválido. Confira os números (8 a 14 dígitos)." }, { status: 400 });

  const hit = cache.get(code);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.data, { status: hit.status });

  const now = Date.now();
  const recent = (perUser.get(user.id) || []).filter(t => now - t < 60 * 1000);
  if (recent.length >= 20) return NextResponse.json({ error: "Muitas leituras seguidas. Espere um minutinho." }, { status: 429 });
  recent.push(now); perUser.set(user.id, recent);

  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${FIELDS}`, { headers: { "User-Agent": "VIVA-Plus/1.0 (diario alimentar)" }, signal: AbortSignal.timeout(8000) });
    const body = await r.json().catch(() => null) as { status?: number; product?: Record<string, unknown> } | null;
    const food = body?.status === 1 ? parseOffProduct(code, body.product) : null;
    const status = food ? 200 : 404;
    const data = food ? { food } : { error: body?.status === 1 ? "Achamos o produto, mas ele não tem as calorias cadastradas. Use a adição rápida com os dados do rótulo." : "Produto não encontrado. Use a adição rápida com os dados do rótulo." };
    if (cache.size > 2000) cache.clear();
    if (r.ok || r.status === 404) cache.set(code, { at: now, status, data });
    return NextResponse.json(data, { status });
  } catch (e) {
    console.error("VIVA food-barcode", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não consegui consultar o código agora. Tente de novo em instantes." }, { status: 502 });
  }
}
