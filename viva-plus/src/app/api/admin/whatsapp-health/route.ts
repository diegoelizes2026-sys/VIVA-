import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runWhatsappHealth } from "@/lib/whatsapp-health";

export const runtime = "nodejs";

// Painel: checa agora o WhatsApp (mesma checagem da tarefa agendada) e devolve o estado.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { data: ok } = await supabase.rpc("viva_is_admin");
  if (!ok) return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });
  try { return NextResponse.json(await runWhatsappHealth(createAdminClient())); }
  catch (e) { console.error("VIVA whatsapp health admin", e); return NextResponse.json({ error: "Não consegui checar agora." }, { status: 500 }); }
}
