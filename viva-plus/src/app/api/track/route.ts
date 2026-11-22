import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Registra tela visitada ou ação ("acao:1-toque") para o painel de uso do admin.
// Nunca atrapalha o app: qualquer erro é ignorado.
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { path?: unknown } | null;
    const path = String(body?.path || "").toLowerCase().trim().slice(0, 60);
    if (!/^[a-z0-9/_:-]{1,60}$/.test(path)) return new NextResponse(null, { status: 204 });
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.rpc("viva_track_visit", { p_path: path });
  } catch { /* ignorado */ }
  return new NextResponse(null, { status: 204 });
}
