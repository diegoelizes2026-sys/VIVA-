import { after } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { NEEDS_PLAN_MESSAGE, SITE_URL, activeWhatsappPlan, brl, connectUrlFor, featuresMessage, linkWhatsapp, notLinkedMessage, requestKeyFor, sendWhatsappText, validSignature, welcomeAfterLink } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const maxDuration = 60;

type Admin = ReturnType<typeof createAdminClient>;
type HistoryItem = { role: "user" | "assistant"; content: string; clarification?: Record<string, unknown> };
type WaMessage = { id?: string; from?: string; type?: string; text?: { body?: string }; button?: { text?: string }; interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } } };

const UNDO_WINDOW_MS = 15 * 60 * 1000;

// Verificação do webhook pela Meta (feita uma vez ao configurar a URL de callback).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge") || "";
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected) { console.log("VIVA WhatsApp webhook: verificação OK"); return new Response(challenge, { status: 200 }); }
  console.warn("VIVA WhatsApp webhook: verificação recusada", { mode, temToken: Boolean(token), configurado: Boolean(expected) });
  return new Response("forbidden", { status: 403 });
}

// Mensagens recebidas: responde 200 na hora para a Meta e processa logo em seguida.
export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!validSignature(raw, signature)) {
    console.warn("VIVA WhatsApp webhook: assinatura inválida", { temAssinatura: Boolean(signature), segredoConfigurado: Boolean(process.env.WHATSAPP_APP_SECRET), bytes: raw.length });
    return new Response("invalid signature", { status: 401 });
  }
  let body: { entry?: Array<{ changes?: Array<{ field?: string; value?: { messages?: WaMessage[] } }> }> };
  try { body = JSON.parse(raw); } catch { return new Response("bad request", { status: 400 }); }
  const messages: WaMessage[] = [];
  for (const entry of body.entry || []) for (const change of entry.changes || []) {
    if (change.field === "messages") messages.push(...(change.value?.messages || []));
  }
  console.log("VIVA WhatsApp webhook: recebido", { mensagens: messages.length, campos: (body.entry || []).flatMap(e => (e.changes || []).map(c => c.field)) });
  if (messages.length) {
    const origin = new URL(request.url).origin;
    after(async () => {
      for (const message of messages) {
        try { await handleMessage(message, origin); } catch (error) { console.error("VIVA WhatsApp handle failed", error); }
      }
    });
  }
  return new Response("ok", { status: 200 });
}

function messageText(m: WaMessage) {
  if (m.type === "text") return String(m.text?.body || "").trim();
  if (m.type === "button") return String(m.button?.text || "").trim();
  if (m.type === "interactive") return String(m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || "").trim();
  return "";
}

async function handleMessage(m: WaMessage, origin: string) {
  const from = String(m.from || "");
  const id = String(m.id || "");
  if (!from || !id) return;
  const admin = createAdminClient();

  // A Meta pode reenviar a mesma mensagem: processa cada uma só uma vez.
  const { error: dupError } = await admin.from("viva_whatsapp_inbound").insert({ message_id: id, wa_id: from });
  if (dupError) { if (dupError.code === "23505") return; throw dupError; }

  const text = messageText(m);
  const now = new Date().toISOString();

  // Ligação do WhatsApp com a conta: "Conectar VIVA 123456" (código gerado em Meu perfil).
  const code = text.match(/conectar\s+viva\s+(\d{6})/i)?.[1];
  if (code) {
    const { data: row } = await admin.from("viva_whatsapp_links").select("user_id,code_expires_at").eq("link_code", code).maybeSingle();
    if (!row || !row.code_expires_at || new Date(row.code_expires_at).getTime() < Date.now()) {
      await sendWhatsappText(from, `Esse código expirou. Toque aqui para conectar este WhatsApp à sua conta (vale 1 hora):\n${connectUrlFor(from)}`);
      return;
    }
    await linkWhatsapp(admin, row.user_id, from);
    await welcomeAfterLink(admin, row.user_id, from);
    return;
  }

  const { data: link } = await admin.from("viva_whatsapp_links").select("user_id,history,last_transaction_id,last_transaction_at").eq("wa_id", from).maybeSingle();
  if (!link) {
    await sendWhatsappText(from, notLinkedMessage(connectUrlFor(from)));
    return;
  }
  await admin.from("viva_whatsapp_links").update({ last_inbound_at: now, updated_at: now }).eq("user_id", link.user_id);

  if (/^\s*desconectar\s*$/i.test(text)) {
    await admin.from("viva_whatsapp_links").update({ wa_id: null, linked_at: null, history: [], updated_at: now }).eq("user_id", link.user_id);
    await sendWhatsappText(from, `Pronto, desconectei este WhatsApp da sua conta. Para conectar de novo, é só me mandar um *oi*.`);
    return;
  }

  // A VIVA no WhatsApp é exclusiva de quem assinou um plano pelo site.
  const plan = await activeWhatsappPlan(admin, link.user_id);
  if (!plan) {
    await sendWhatsappText(from, NEEDS_PLAN_MESSAGE);
    return;
  }

  if (/^\s*(ajuda|menu|fun[çc][õo]es|funcionalidades|o que voc[êe] faz\??|comandos)\s*$/i.test(text)) {
    await sendWhatsappText(from, featuresMessage(plan.planName));
    return;
  }

  if (!text) {
    await sendWhatsappText(from, `Por enquanto eu entendo só mensagens de texto por aqui. 🎤📷 Áudio e foto de comprovante funcionam no app: ${SITE_URL}/assistente`);
    return;
  }

  const session = await openUserSession(admin, link.user_id);
  try {
    if (/^\s*desfazer\s*$/i.test(text)) {
      const recent = link.last_transaction_id && link.last_transaction_at && Date.now() - new Date(link.last_transaction_at).getTime() < UNDO_WINDOW_MS;
      if (!recent) { await sendWhatsappText(from, "Não tenho nenhum lançamento recente para desfazer. Lançamentos mais antigos você apaga pela tela de Finanças do app."); return; }
      const res = await callApp(origin, session.cookie, `/api/transactions?id=${encodeURIComponent(String(link.last_transaction_id))}`, { method: "DELETE" });
      if (res.ok) await admin.from("viva_whatsapp_links").update({ last_transaction_id: null, last_transaction_at: null }).eq("user_id", link.user_id);
      await sendWhatsappText(from, res.ok ? "Pronto, desfiz o último lançamento. ↩️" : String(res.data.error || "Não consegui desfazer agora."));
      return;
    }

    const history: HistoryItem[] = Array.isArray(link.history) ? (link.history as HistoryItem[]).slice(-10) : [];
    const res = await callApp(origin, session.cookie, "/api/assistant", { method: "POST", body: JSON.stringify({ message: text.slice(0, 4000), history, requestId: requestKeyFor(id) }) });
    const { reply, clarification, transactionId } = await buildReply(res, origin, session.cookie);
    await sendWhatsappText(from, reply);

    const nextHistory: HistoryItem[] = [...history, { role: "user" as const, content: text.slice(0, 4000) }, { role: "assistant" as const, content: reply.slice(0, 4000), ...(clarification ? { clarification } : {}) }].slice(-12);
    await admin.from("viva_whatsapp_links").update({
      history: nextHistory,
      ...(transactionId ? { last_transaction_id: transactionId, last_transaction_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    }).eq("user_id", link.user_id);
  } finally {
    await session.client.auth.signOut({ scope: "local" }).catch(() => {});
  }
}

type AppResult = { ok: boolean; status: number; data: Record<string, unknown> };
async function callApp(origin: string, cookie: string, path: string, init: RequestInit): Promise<AppResult> {
  const res = await fetch(origin + path, { ...init, headers: { "content-type": "application/json", cookie }, cache: "no-store" });
  let data: Record<string, unknown> = {};
  try { data = await res.json(); } catch { /* resposta sem JSON */ }
  return { ok: res.ok, status: res.status, data };
}

const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

async function buildReply(res: AppResult, origin: string, cookie: string): Promise<{ reply: string; clarification?: Record<string, unknown>; transactionId?: string }> {
  const d = res.data;
  if (!res.ok || d.error) {
    let reply = String(d.error || "Não consegui responder agora. Tente de novo em instantes.");
    if (d.upgrade) reply += `\n\nVeja os planos: ${SITE_URL}/planos`;
    return { reply };
  }

  const draft = d.transactionDraft as Record<string, unknown> | undefined;
  if (draft) {
    const amount = Number(draft.amount || 0);
    if (!(amount > 0)) return { reply: "Qual foi o valor?", clarification: { amount: null, description: String(draft.description || ""), category: String(draft.category || "Outros"), occurred_on: String(draft.occurred_on || todayIso()), payment_method: String(draft.payment_method || "Pix") } };
    const kind = draft.kind === "income" ? "income" : "expense";
    const payload = { kind, amount, description: String(draft.description || (kind === "income" ? "Entrada" : "Gasto")).slice(0, 240), occurred_on: String(draft.occurred_on || todayIso()), category: draft.category ? String(draft.category) : undefined, payment_method: draft.payment_method ? String(draft.payment_method) : undefined, source: "viva" };
    const saved = await callApp(origin, cookie, "/api/transactions", { method: "POST", body: JSON.stringify(payload) });
    if (!saved.ok) return { reply: String(saved.data.error || "Não consegui salvar esse lançamento agora. Tente de novo em instantes.") };
    const tx = saved.data.transaction as { id?: string } | undefined;
    const date = payload.occurred_on !== todayIso() ? ` · ${payload.occurred_on.slice(8, 10)}/${payload.occurred_on.slice(5, 7)}` : "";
    const reply = `${kind === "income" ? "Entrada" : "Gasto"} anotado ✅\n${brl(amount)} · ${payload.description}${payload.category ? ` (${payload.category})` : ""}${date}\n\nSe errei, responda *desfazer*.`;
    return { reply, transactionId: tx?.id };
  }

  const clarification = d.clarification as Record<string, unknown> | undefined;
  if (clarification) {
    const amount = Number(clarification.amount || 0);
    const reply = d.clarificationPrompt ? String(d.clarificationPrompt) : amount > 0 ? `Anotei ${brl(amount)}. Foi uma *despesa* ou uma *receita*?` : "Qual foi o valor?";
    return { reply, clarification };
  }

  if (d.eventDraft || d.billDraft || d.profileDraft) {
    return { reply: `${d.answer ? String(d.answer) : "Preparei isso para você."}\n\nPara confirmar, abra o app: ${SITE_URL}/assistente` };
  }

  let reply = d.answer ? String(d.answer) : "Não entendi bem. Pode reformular?";
  const action = d.action as { href?: string; label?: string } | undefined;
  if (action?.href) reply += `\n\n${action.label || "Abrir no app"}: ${action.href.startsWith("http") ? action.href : SITE_URL + action.href}`;
  return { reply };
}

// Abre uma sessão temporária da pessoa (mesmas regras, créditos e plano do app) e devolve o cookie dela.
async function openUserSession(admin: Admin, userId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Supabase não configurado.");
  const { data: found, error: userError } = await admin.auth.admin.getUserById(userId);
  if (userError || !found.user?.email) throw userError || new Error("Usuário sem e-mail.");
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: found.user.email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) throw linkError || new Error("Não foi possível abrir a sessão.");
  const jar = new Map<string, string>();
  const client = createServerClient(url, anon, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (items) => items.forEach(({ name, value }) => { if (value) jar.set(name, value); else jar.delete(name); }),
    },
  });
  const { error } = await client.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (error) throw error;
  return { client, cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; ") };
}
