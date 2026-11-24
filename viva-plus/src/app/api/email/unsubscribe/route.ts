import { createAdminClient } from "@/lib/supabase/admin";
import { validUnsubscribe } from "@/lib/email";

export const runtime = "nodejs";

// "Não quero mais receber e-mails": link assinado no rodapé de cada e-mail (funciona sem login).
async function unsubscribe(url: URL) {
  const userId = url.searchParams.get("u") || "";
  const token = url.searchParams.get("t") || "";
  if (!validUnsubscribe(userId, token)) return false;
  const admin = createAdminClient();
  const { error } = await admin.from("viva_notification_settings").upsert({ user_id: userId, email_enabled: false, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) { console.error("VIVA email unsubscribe", error); return false; }
  return true;
}

const page = (ok: boolean) => new Response(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>E-mails do VIVA+</title></head>
<body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#f4f1f8;color:#20162b;display:grid;place-items:center;min-height:100vh;padding:16px">
<main style="max-width:440px;background:#fff;border-radius:22px;padding:28px;text-align:center">
<p style="font-size:26px;font-weight:900;color:#6410C9;margin:0 0 12px">VIVA<span style="color:#8b3de8">+</span></p>
<h1 style="font-size:21px;margin:0 0 10px">${ok ? "Pronto, você não vai mais receber nossos e-mails." : "Não consegui processar o pedido."}</h1>
<p style="color:#5b5166;line-height:1.5">${ok ? "Os avisos importantes da sua conta continuam no app. Se mudar de ideia, é só religar em Notificações." : "O link pode estar incompleto. Você também pode desligar os e-mails em Notificações, dentro do app."}</p>
<a href="https://www.vivamaiss.app.br/configuracoes/notificacoes" style="display:inline-block;margin-top:10px;padding:12px 20px;border-radius:999px;background:#6410C9;color:#fff;text-decoration:none;font-weight:700">Abrir Notificações</a>
</main></body></html>`, { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } });

export async function GET(request: Request) { return page(await unsubscribe(new URL(request.url))); }
// Descadastro com 1 clique dos provedores de e-mail (List-Unsubscribe-Post).
export async function POST(request: Request) { const ok = await unsubscribe(new URL(request.url)); return new Response(null, { status: ok ? 200 : 400 }); }
