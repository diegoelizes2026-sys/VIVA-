import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { appUrl, register360Webhook, using360dialog } from "@/lib/whatsapp/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Abrir /api/whatsapp/setup logado como administrador cadastra o webhook na 360dialog.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login como administrador." }, { status: 401 });
  const { data: isAdmin, error } = await supabase.rpc("viva_is_admin");
  if (error || !isAdmin) return NextResponse.json({ error: "Acesso restrito ao administrador VIVA+." }, { status: 403 });

  const checks = {
    D360_API_KEY: Boolean(process.env.D360_API_KEY),
    WHATSAPP_WEBHOOK_SECRET: Boolean(process.env.WHATSAPP_WEBHOOK_SECRET),
    WHATSAPP_DISPLAY_NUMBER: Boolean(process.env.WHATSAPP_DISPLAY_NUMBER),
    NEXT_PUBLIC_APP_URL: Boolean(process.env.NEXT_PUBLIC_APP_URL),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
  const webhookUrl = appUrl("/api/whatsapp/webhook");
  if (!using360dialog()) return NextResponse.json({ ok: false, message: "Falta a variável D360_API_KEY na Vercel.", checks });
  if (!webhookUrl) return NextResponse.json({ ok: false, message: "Falta a variável NEXT_PUBLIC_APP_URL na Vercel.", checks });

  try {
    const result = await register360Webhook(webhookUrl);
    return NextResponse.json({
      ok: result.ok,
      message: result.ok ? "Webhook cadastrado na 360dialog! Mande uma mensagem para o número da VIVA para testar." : "A 360dialog recusou o cadastro do webhook.",
      webhookUrl,
      checks,
      provider: result.ok ? undefined : { status: result.status, body: result.body },
    }, { status: result.ok ? 200 : 502 });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Erro ao configurar.", checks }, { status: 500 });
  }
}
