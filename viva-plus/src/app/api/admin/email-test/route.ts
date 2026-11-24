import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { emailConfigured, SITE, sendEmail } from "@/lib/email";

export const runtime = "nodejs";

// Painel administrativo: manda um e-mail de teste para o próprio administrador (confere Resend + domínio).
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("viva_is_admin");
  if (!isAdmin) return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });
  if (!emailConfigured()) return NextResponse.json({ error: "A chave RESEND_API_KEY não está configurada na Vercel (ou falta fazer o redeploy)." }, { status: 503 });
  const ok = await sendEmail(user.email, {
    subject: "✅ Teste de e-mail da VIVA+",
    preheader: "Se você recebeu, está tudo certo.",
    title: "Os e-mails da VIVA estão funcionando 🎉",
    paragraphs: ["Este é um e-mail de teste enviado pelo Painel administrativo.", "A partir de agora saem sozinhos: boas-vindas, lembretes dos primeiros dias, aviso do fim do teste e os resumos da semana e do mês."],
    cta: { label: "Abrir a VIVA", url: `${SITE}/meu-dia` },
  }, user.id);
  if (!ok) return NextResponse.json({ error: "O Resend recusou o envio. Confira se o domínio vivamaiss.app.br está \"Verified\" no Resend e se a chave está certa (detalhes nos logs da Vercel)." }, { status: 502 });
  return NextResponse.json({ ok: true, to: user.email });
}
