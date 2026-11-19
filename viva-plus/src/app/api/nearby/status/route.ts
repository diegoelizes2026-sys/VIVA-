import { NextResponse } from "next/server";
import { OVERPASS_ENDPOINTS } from "@/lib/nearby";

// Verificação pública e sem dados de usuários: o servidor consegue falar com o OpenStreetMap?
// Consulta mínima num ponto fixo (Praça da Sé, SP), com cache de 10 minutos.
export const maxDuration = 30;
let last: { at: number; body: unknown } | null = null;

export async function GET() {
  if (last && Date.now() - last.at < 10 * 60 * 1000) return NextResponse.json(last.body);
  const query = '[out:json][timeout:10];node(around:300,-23.5505,-46.6333)["amenity"="pharmacy"];out 1;';
  const results = await Promise.all(OVERPASS_ENDPOINTS.map(async url => {
    const t0 = Date.now(); const host = new URL(url).host;
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "VIVA-Plus/1.0 (lugares proximos)" }, body: "data=" + encodeURIComponent(query), signal: AbortSignal.timeout(12000), cache: "no-store" });
      const text = await res.text();
      let ok = false; try { ok = Array.isArray(JSON.parse(text).elements); } catch { /* não é JSON */ }
      return { host, status: res.status, ok, ms: Date.now() - t0, sample: ok ? undefined : text.slice(0, 120) };
    } catch (e) { return { host, status: 0, ok: false, ms: Date.now() - t0, error: e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 120) : "erro" }; }
  }));
  const body = { ok: results.some(r => r.ok), checkedAt: new Date().toISOString(), results };
  last = { at: Date.now(), body };
  return NextResponse.json(body);
}
