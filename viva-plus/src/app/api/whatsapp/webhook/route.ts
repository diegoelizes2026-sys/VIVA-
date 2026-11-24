import { after } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildReport, reportMessage, reportRange, type ReportPeriod } from "@/lib/report";
import { randomUUID } from "node:crypto";
import { downloadWhatsappMedia, oggDurationSeconds, FREE_WHATSAPP_NOTE, WHATSAPP_FREE_WEEKLY, SITE_URL, activeWhatsappPlan, brl, connectUrlFor, featuresMessage, freeLeftFooter, freeLimitMessage, linkWhatsapp, notLinkedMessage, requestKeyFor, sendWhatsappText, validSignature, welcomeAfterLink } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const maxDuration = 60;

type Admin = ReturnType<typeof createAdminClient>;
type HistoryItem = { role: "user" | "assistant"; content: string; clarification?: Record<string, unknown> };
type WaMedia = { id?: string; mime_type?: string; caption?: string; filename?: string };
type WaMessage = { id?: string; from?: string; type?: string; text?: { body?: string }; audio?: WaMedia; voice?: WaMedia; image?: WaMedia; document?: WaMedia; button?: { text?: string }; interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } } };

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

  // Assinantes (e quem está no teste do Pro) usam sem limite; o Free tem mensagens grátis por semana.
  const plan = await activeWhatsappPlan(admin, link.user_id);

  if (/^\s*(ajuda|menu|fun[çc][õo]es|funcionalidades|o que voc[êe] faz\??|comandos)\s*$/i.test(text)) {
    await sendWhatsappText(from, plan ? featuresMessage(plan.planName) : `${featuresMessage()}\n\n${FREE_WHATSAPP_NOTE}`);
    return;
  }

  // "relatório" / "resumo da semana" / "relatório do mês": responde na hora, sem IA (não gasta créditos nem a cota do Free).
  const reportAsk = text.match(/^\s*(relat[óo]rio|resumo)(\s+(da|desta)\s+semana|\s+semanal|\s+(do|deste)\s+m[êe]s|\s+mensal|\s+do\s+m[êe]s\s+passado|\s+da\s+semana\s+passada)?\s*[.!?]*\s*$/i);
  if (reportAsk) {
    const tail = (reportAsk[2] || "").toLowerCase();
    const period: ReportPeriod = /passad/.test(tail) ? (/m[êe]s/.test(tail) ? "mes-passado" : "semana-passada") : /m[êe]s|mensal/.test(tail) ? "mes" : "semana";
    const range = reportRange(period);
    const r = await buildReport(admin, link.user_id, range).catch(() => null);
    if (!r) { await sendWhatsappText(from, "Não consegui montar o relatório agora. Tente de novo em instantes."); return; }
    const head = `📊 *${range.title}* (${range.subtitle})`;
    const body = r.count === 0 && r.income === 0 ? "Nenhum gasto anotado nesse período. Me mande seus gastos (“gastei 20 no lanche”) que eu monto o relatório." : reportMessage(r, true);
    await sendWhatsappText(from, `${head}\n\n${body}\n\nRelatório completo: ${SITE_URL}/relatorio?p=${period}\n\n_Dica: peça “relatório do mês” ou “relatório da semana passada”._`);
    return;
  }

  // Áudio (vira texto) e foto/PDF de comprovante (a VIVA lê e anota).
  const media = mediaOf(m);
  if (!text && !media) {
    await sendWhatsappText(from, "Ainda não entendo esse tipo de mensagem 😅 Pode me mandar *texto*, *áudio* ou *foto do comprovante*.");
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

    // Free: conta a mensagem na cota da semana antes de chamar a VIVA (ajuda e desfazer não contam).
    let freeLeft: number | null = null;
    if (!plan) {
      const { data: quota, error: quotaError } = await admin.rpc("viva_whatsapp_free_use", { p_user_id: link.user_id, p_limit: WHATSAPP_FREE_WEEKLY });
      if (quotaError) { console.error("VIVA WhatsApp free quota", quotaError); await sendWhatsappText(from, "Não consegui responder agora. Tente de novo em instantes."); return; }
      const q = quota as { allowed?: boolean; left?: number; resets_on?: string } | null;
      if (!q?.allowed) { await sendWhatsappText(from, freeLimitMessage(q?.resets_on)); return; }
      freeLeft = Number(q.left ?? 0);
    }

    let message = text;
    let userContent = text;
    let prefix = "";
    let receiptUploadId: string | null = null;
    let sampleNote = "";
    if (media?.kind === "audio") {
      await sendWhatsappText(from, "🎧 Ouvindo seu áudio…");
      const file = await downloadWhatsappMedia(media.id);
      if ("error" in file) { await sendWhatsappText(from, file.error === "too_big" ? "Esse áudio ficou grande demais 😅 Me manda um de até 1 minuto." : "Não consegui baixar seu áudio. Tenta mandar de novo?"); return; }
      const seconds = (file.mime.includes("ogg") ? oggDurationSeconds(file.buffer) : null) ?? Math.max(1, file.buffer.length / 4000);
      if (seconds > 60) { await sendWhatsappText(from, "Esse áudio passou de 1 minuto 😅 Me manda em partes menores, por favor."); return; }
      const form = new FormData();
      const mime = file.mime && file.mime.startsWith("audio/") ? file.mime : "audio/ogg";
      form.append("audio", new Blob([new Uint8Array(file.buffer)], { type: mime }), mime.includes("ogg") ? "audio.ogg" : mime.includes("mpeg") ? "audio.mp3" : "audio.m4a");
      form.append("duration_seconds", String(Math.min(60, Math.max(1, Math.round(seconds)))));
      const tr = await callAppForm(origin, session.cookie, "/api/assistant/transcribe", form);
      const transcript = String(tr.data.text || "").trim();
      if (!tr.ok || !transcript) {
        let err = String(tr.data.error || "Não consegui entender o áudio. Tenta falar mais perto do microfone? 🎤");
        if (tr.data.upgrade) err += `\n\nAssine o Pro (Pix ou cartão): ${SITE_URL}/planos`;
        await sendWhatsappText(from, err);
        return;
      }
      message = transcript.slice(0, 4000);
      userContent = message;
      prefix = `🎤 _“${transcript.slice(0, 280)}”_\n\n`;
      if (tr.data.sample_left != null) sampleNote = sampleFooter("audio", Number(tr.data.sample_left));
    } else if (media?.kind === "receipt") {
      const file = await downloadWhatsappMedia(media.id);
      if ("error" in file) { await sendWhatsappText(from, file.error === "too_big" ? "Esse arquivo passou de 5 MB 😅 Tenta uma foto mais leve." : "Não consegui baixar a foto. Tenta mandar de novo?"); return; }
      const mime = file.mime || media.mime;
      const ext = mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "image/jpeg" || mime === "image/jpg" ? "jpg" : null;
      if (!ext) { await sendWhatsappText(from, "Consigo ler *foto* (JPG/PNG) ou *PDF* do comprovante. Tenta mandar assim?"); return; }
      const contentType = ext === "jpg" ? "image/jpeg" : mime;
      const path = `${link.user_id}/${randomUUID()}.${ext}`;
      const { error: upError } = await admin.storage.from("viva-receipt-temp").upload(path, file.buffer, { contentType, cacheControl: "0", upsert: false });
      if (upError) { console.error("VIVA WhatsApp receipt upload", upError); await sendWhatsappText(from, "Não consegui guardar a foto agora. Tenta de novo em instantes."); return; }
      const { data: row, error: rowError } = await admin.from("viva_receipt_uploads").insert({ user_id: link.user_id, temp_path: path, file_name: `whatsapp.${ext}`, mime_type: contentType, status: "uploaded", expires_at: new Date(Date.now() + 60 * 60000).toISOString() }).select("id").single();
      if (rowError || !row) { await admin.storage.from("viva-receipt-temp").remove([path]); await sendWhatsappText(from, "Não consegui preparar o comprovante. Tenta de novo?"); return; }
      receiptUploadId = String(row.id);
      message = (media.caption || "").slice(0, 500);
      userContent = `[foto de comprovante]${media.caption ? " " + media.caption : ""}`;
      prefix = "🧾 Li seu comprovante!\n\n";
    }

    const history: HistoryItem[] = Array.isArray(link.history) ? (link.history as HistoryItem[]).slice(-10) : [];
    const res = await callApp(origin, session.cookie, "/api/assistant", { method: "POST", body: JSON.stringify({ message, history, requestId: requestKeyFor(id), ...(receiptUploadId ? { receiptUploadId } : {}) }) });
    const { reply: rawReply, clarification, transactionId } = await buildReply(res, origin, session.cookie);
    if (receiptUploadId && res.data.sample_left != null) sampleNote = sampleFooter("photo", Number(res.data.sample_left));
    const reply = (res.ok && !res.data.error ? prefix : prefix.startsWith("🎤") ? prefix : "") + rawReply + sampleNote;
    await sendWhatsappText(from, freeLeft === null ? reply : reply + freeLeftFooter(freeLeft));

    const nextHistory: HistoryItem[] = [...history, { role: "user" as const, content: userContent.slice(0, 4000) }, { role: "assistant" as const, content: reply.slice(0, 4000), ...(clarification ? { clarification } : {}) }].slice(-12);
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
/** Plano grátis: avisa quantos áudios/fotos grátis ainda restam no mês. */
function sampleFooter(kind: "audio" | "photo", left: number) {
  const what = kind === "audio" ? (left === 1 ? "áudio grátis" : "áudios grátis") : (left === 1 ? "leitura de comprovante grátis" : "leituras de comprovante grátis");
  if (left <= 0) return `\n\n_🎁 Esse foi o último ${kind === "audio" ? "áudio grátis" : "comprovante grátis"} do mês. Com o Pro é à vontade: ${SITE_URL}/planos_`;
  return `\n\n_🎁 ${kind === "audio" ? "Resta" + (left === 1 ? "" : "m") : "Resta" + (left === 1 ? "" : "m")} ${left} ${what} este mês._`;
}
type Media = { kind: "audio" | "receipt"; id: string; mime: string; caption?: string };
function mediaOf(m: WaMessage): Media | null {
  const audio = m.audio || m.voice;
  if ((m.type === "audio" || m.type === "voice") && audio?.id) return { kind: "audio", id: audio.id, mime: String(audio.mime_type || "audio/ogg").split(";")[0] };
  if (m.type === "image" && m.image?.id) return { kind: "receipt", id: m.image.id, mime: String(m.image.mime_type || "image/jpeg"), caption: m.image.caption };
  if (m.type === "document" && m.document?.id && /^(application\/pdf|image\/)/.test(String(m.document.mime_type || ""))) return { kind: "receipt", id: m.document.id, mime: String(m.document.mime_type), caption: m.document.caption };
  return null;
}
async function callAppForm(origin: string, cookie: string, path: string, body: FormData): Promise<AppResult> {
  const res = await fetch(origin + path, { method: "POST", body, headers: { cookie }, cache: "no-store" });
  let data: Record<string, unknown> = {};
  try { data = await res.json(); } catch { /* resposta sem JSON */ }
  return { ok: res.ok, status: res.status, data };
}
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
    const reply = d.clarificationPrompt ? String(d.clarificationPrompt) : amount > 0 ? `${brl(amount)}: foi um *gasto* ou uma *entrada*?\nResponda *1* para gasto ou *2* para entrada.` : "Qual foi o valor?";
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
