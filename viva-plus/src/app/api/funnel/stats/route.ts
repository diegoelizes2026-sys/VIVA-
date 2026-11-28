import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Prova social com número real: quantas pessoas viram o resultado de um diagnóstico nos últimos 7 dias.
// Guardado por 10 minutos no servidor e na CDN. Só o total sai daqui, nenhum dado pessoal.
let cache: { at: number; count: number } | null = null;

export async function GET() {
  try {
    if (!cache || Date.now() - cache.at > 10 * 60_000) {
      const since = new Date(Date.now() - 7 * 86400_000).toISOString();
      const { data } = await createAdminClient().from("viva_diag_events").select("session_id").in("event", ["vida_result", "result"]).gte("created_at", since).limit(50000);
      cache = { at: Date.now(), count: new Set((data || []).map(r => r.session_id)).size };
    }
    return NextResponse.json({ diagnostics7d: cache.count }, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=600" } });
  } catch { return NextResponse.json({ diagnostics7d: 0 }); }
}
