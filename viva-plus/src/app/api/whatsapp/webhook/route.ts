import { after } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildReport, reportMessage, reportRange, type ReportPeriod } from "@/lib/report";
import { randomUUID } from "node:crypto";
import { detectHealthIntent, exerciseReply, foodReply, loadDay, mealFor, saveExercise, saveFoods, saveWater, summaryReply, undoHealth, waterReply, type MealType } from "@/lib/health-whatsapp";
import type { FoodAiItem } from "@/lib/food-ai";
import { detectLang, type Lang } from "@/lib/lang";
import { downloadWhatsappMedia, oggDurationSeconds, FREE_WHATSAPP_NOTE, FREE_WHATSAPP_NOTE_EN, WHATSAPP_FREE_WEEKLY, SITE_URL, activeWhatsappPlan, brl, connectUrlFor, featuresMessage, freeLeftFooter, freeLimitMessage, linkWhatsapp, notLinkedMessage, requestKeyFor, sendWhatsappText, validSignature, welcomeAfterLink } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const maxDuration = 60;

type Admin = ReturnType<typeof createAdminClient>;
type HealthMark = { table: string; ids: string[]; at: string };
type HistoryItem = { role: "user" | "assistant"; content: string; clarification?: Record<string, unknown>; health?: HealthMark; lang?: Lang };
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
      await sendWhatsappText(from, detectLang(text) === "en" ? `This code has expired. Tap here to connect this WhatsApp to your account (valid for 1 hour):\n${connectUrlFor(from)}` : `Esse código expirou. Toque aqui para conectar este WhatsApp à sua conta (vale 1 hora):\n${connectUrlFor(from)}`);
      return;
    }
    await linkWhatsapp(admin, row.user_id, from);
    await welcomeAfterLink(admin, row.user_id, from);
    return;
  }

  const { data: link } = await admin.from("viva_whatsapp_links").select("user_id,history,last_transaction_id,last_transaction_at").eq("wa_id", from).maybeSingle();
  if (!link) {
    await sendWhatsappText(from, notLinkedMessage(connectUrlFor(from), detectLang(text)));
    return;
  }
  await admin.from("viva_whatsapp_links").update({ last_inbound_at: now, updated_at: now }).eq("user_id", link.user_id);

  // Idioma: o da mensagem; sem texto (foto/áudio), o último usado na conversa. Áudio é conferido de novo depois da transcrição.
  const lastLang: Lang = [...(Array.isArray(link.history) ? (link.history as HistoryItem[]) : [])].reverse().find(h => h.role === "user" && h.lang)?.lang ?? "pt";
  const caption = m.image?.caption || m.document?.caption || "";
  let lang: Lang = detectLang(text || caption, lastLang);
  const tr = (pt: string, en: string) => (lang === "en" ? en : pt);

  if (/^\s*(desconectar|disconnect|unlink)\s*[.!]*\s*$/i.test(text)) {
    await admin.from("viva_whatsapp_links").update({ wa_id: null, linked_at: null, history: [], updated_at: now }).eq("user_id", link.user_id);
    await sendWhatsappText(from, tr(`Pronto, desconectei este WhatsApp da sua conta. Para conectar de novo, é só me mandar um *oi*.`, `Done, this WhatsApp is disconnected from your account. To connect again, just send me *hi*.`));
    return;
  }

  // Assinantes (e quem está no teste do Pro) usam sem limite; o Free tem mensagens grátis por semana.
  const plan = await activeWhatsappPlan(admin, link.user_id);

  if (/^\s*(ajuda|menu|fun[çc][õo]es|funcionalidades|o que voc[êe] faz\??|comandos|help|commands|what can you do\??)\s*$/i.test(text)) {
    if (/^\s*(help|commands|what can you do\??)\s*$/i.test(text)) lang = "en";
    await sendWhatsappText(from, plan ? featuresMessage(plan.planName, lang) : `${featuresMessage(null, lang)}\n\n${lang === "en" ? FREE_WHATSAPP_NOTE_EN : FREE_WHATSAPP_NOTE}`);
    await admin.from("viva_whatsapp_links").update({ history: [...(Array.isArray(link.history) ? (link.history as HistoryItem[]) : []).slice(-11), { role: "user", content: text, lang }] }).eq("user_id", link.user_id);
    return;
  }

  // "relatório" / "resumo da semana" / "relatório do mês": responde na hora, sem IA (não gasta créditos nem a cota do Free).
  const reportEn = text.match(/^\s*(weekly|monthly|last\s+week'?s?|last\s+month'?s?|this\s+week'?s?|this\s+month'?s?)?\s*(report|summary)(\s+(for\s+)?(this|last)\s+(week|month))?\s*[.!?]*\s*$/i);
  const reportAsk = reportEn ? null : text.match(/^\s*(relat[óo]rio|resumo)(\s+(da|desta)\s+semana|\s+semanal|\s+(do|deste)\s+m[êe]s|\s+mensal|\s+do\s+m[êe]s\s+passado|\s+da\s+semana\s+passada)?\s*[.!?]*\s*$/i);
  if (reportAsk || reportEn) {
    const tail = ((reportAsk ? reportAsk[2] : text) || "").toLowerCase();
    const period: ReportPeriod = reportEn
      ? (/last/.test(tail) ? (/month/.test(tail) ? "mes-passado" : "semana-passada") : /month/.test(tail) ? "mes" : "semana")
      : /passad/.test(tail) ? (/m[êe]s/.test(tail) ? "mes-passado" : "semana-passada") : /m[êe]s|mensal/.test(tail) ? "mes" : "semana";
    if (reportEn) lang = "en";
    const range = reportRange(period);
    const r = await buildReport(admin, link.user_id, range).catch(() => null);
    if (!r) { await sendWhatsappText(from, tr("Não consegui montar o relatório agora. Tente de novo em instantes.", "I couldn't build the report right now. Please try again in a moment.")); return; }
    const head = `📊 *${range.title}* (${range.subtitle})`;
    const body = r.count === 0 && r.income === 0 ? tr("Nenhum gasto anotado nesse período. Me mande seus gastos (“gastei 20 no lanche”) que eu monto o relatório.", "No expenses logged in this period. Send me your expenses (“spent 20 on lunch”) and I'll build the report.") : reportMessage(r, true);
    await sendWhatsappText(from, tr(`${head}\n\n${body}\n\nRelatório completo: ${SITE_URL}/relatorio?p=${period}\n\n_Dica: peça “relatório do mês” ou “relatório da semana passada”._`, `${head}\n\n${body}\n\nFull report: ${SITE_URL}/relatorio?p=${period}\n\n_Tip: ask for “monthly report” or “last week's report”._`));
    return;
  }

  // Áudio (vira texto) e foto/PDF de comprovante (a VIVA lê e anota).
  const media = mediaOf(m);
  if (!text && !media) {
    await sendWhatsappText(from, tr("Ainda não entendo esse tipo de mensagem 😅 Pode me mandar *texto*, *áudio*, *foto do comprovante* ou *foto do prato*.", "I can't read this kind of message yet 😅 You can send *text*, a *voice note*, a *receipt photo* or a *meal photo*."));
    return;
  }

  const session = await openUserSession(admin, link.user_id);
  try {
    const history0: HistoryItem[] = Array.isArray(link.history) ? (link.history as HistoryItem[]) : [];
    // Guarda a conversa e o que foi anotado na saúde (para o "desfazer").
    const remember = async (userText: string, reply: string, health?: HealthMark) => {
      const next: HistoryItem[] = [...history0.slice(-10), { role: "user" as const, content: userText.slice(0, 4000), lang }, { role: "assistant" as const, content: reply.slice(0, 4000), ...(health ? { health } : {}) }].slice(-12);
      await admin.from("viva_whatsapp_links").update({ history: next, updated_at: new Date().toISOString() }).eq("user_id", link.user_id);
    };

    if (/^\s*(desfazer|undo)\s*[.!]*\s*$/i.test(text)) {
      if (/undo/i.test(text)) lang = "en";
      // Saúde: desfaz o último registro de comida, água ou exercício, se for o lançamento mais recente (até 15 min).
      const mark = [...history0].reverse().find(h => h.role === "assistant")?.health;
      const markAt = mark ? new Date(mark.at).getTime() : 0;
      const txAt = link.last_transaction_at ? new Date(link.last_transaction_at).getTime() : 0;
      if (mark && Date.now() - markAt < UNDO_WINDOW_MS && markAt >= txAt) {
        const ok = await undoHealth(session.client, mark.table, mark.ids);
        const reply = ok ? tr("Pronto, desfiz o último registro do seu diário de saúde. ↩️", "Done, I removed the last entry from your health diary. ↩️") : tr("Não consegui desfazer agora. Você pode apagar pela tela de Saúde do app.", "I couldn't undo it right now. You can delete it on the Health screen in the app.");
        await sendWhatsappText(from, reply);
        if (ok) await remember(text, reply);
        return;
      }
      const recent = link.last_transaction_id && link.last_transaction_at && Date.now() - new Date(link.last_transaction_at).getTime() < UNDO_WINDOW_MS;
      if (!recent) { await sendWhatsappText(from, tr("Não tenho nenhum lançamento recente para desfazer. Lançamentos mais antigos você apaga pela tela de Finanças do app.", "There's no recent entry to undo. Older entries can be deleted on the Money screen in the app.")); return; }
      const res = await callApp(origin, session.cookie, `/api/transactions?id=${encodeURIComponent(String(link.last_transaction_id))}`, { method: "DELETE" });
      if (res.ok) await admin.from("viva_whatsapp_links").update({ last_transaction_id: null, last_transaction_at: null }).eq("user_id", link.user_id);
      await sendWhatsappText(from, res.ok ? tr("Pronto, desfiz o último lançamento. ↩️", "Done, I undid the last entry. ↩️") : String(res.data.error || tr("Não consegui desfazer agora.", "I couldn't undo it right now.")));
      return;
    }

    // Saúde sem IA (água, exercício, saldo de calorias): responde na hora e não conta na cota nem gasta créditos.
    const quickHealth = async (said: string, userText: string, prefixText = "") => {
      const h = detectHealthIntent(said, lang);
      if (!h || h.kind === "food") return false;
      try {
        let reply: string; let mark: HealthMark | undefined;
        const at = new Date().toISOString();
        if (h.kind === "water") { const hid = await saveWater(session.client, link.user_id, h.ml); reply = waterReply(h.ml, await loadDay(session.client, link.user_id), lang); mark = { table: "viva_water_logs", ids: [hid], at }; }
        else if (h.kind === "exercise") { const hid = await saveExercise(session.client, link.user_id, h); reply = exerciseReply(h, await loadDay(session.client, link.user_id), lang); mark = { table: "viva_activity_logs", ids: [hid], at }; }
        else reply = summaryReply(await loadDay(session.client, link.user_id), SITE_URL, lang);
        await sendWhatsappText(from, prefixText + reply);
        await remember(userText, reply, mark);
      } catch (e) { console.error("VIVA WhatsApp health", e); await sendWhatsappText(from, tr("Não consegui anotar no seu diário agora. Tente de novo em instantes.", "I couldn't log it in your diary right now. Please try again in a moment.")); }
      return true;
    };
    if (text && !media && await quickHealth(text, text)) return;

    // Free: conta a mensagem na cota da semana antes de chamar a VIVA (ajuda e desfazer não contam).
    let freeLeft: number | null = null;
    if (!plan) {
      const { data: quota, error: quotaError } = await admin.rpc("viva_whatsapp_free_use", { p_user_id: link.user_id, p_limit: WHATSAPP_FREE_WEEKLY });
      if (quotaError) { console.error("VIVA WhatsApp free quota", quotaError); await sendWhatsappText(from, tr("Não consegui responder agora. Tente de novo em instantes.", "I couldn't reply right now. Please try again in a moment.")); return; }
      const q = quota as { allowed?: boolean; left?: number; resets_on?: string } | null;
      if (!q?.allowed) { await sendWhatsappText(from, freeLimitMessage(q?.resets_on, lang)); return; }
      freeLeft = Number(q.left ?? 0);
    }

    // Comida (texto ou foto do prato): a IA separa os alimentos e anota no diário de saúde.
    const logFood = async (items: FoodAiItem[], meal: MealType, userText: string, tip: string, footer = "", prefixText = "") => {
      const ids = await saveFoods(session.client, link.user_id, items, meal);
      const reply = prefixText + foodReply(items, meal, await loadDay(session.client, link.user_id), tip, lang) + footer;
      await sendWhatsappText(from, freeLeft === null ? reply : reply + freeLeftFooter(freeLeft, lang));
      await remember(userText, reply, { table: "viva_food_logs", ids, at: new Date().toISOString() });
    };
    const foodError = async (d: Record<string, unknown>) => {
      let err = String(d.error || d.message || tr("Não consegui analisar agora. Tente de novo em instantes.", "I couldn't analyze it right now. Please try again in a moment."));
      if (d.upgrade) err += tr(`\n\nVeja os planos: ${SITE_URL}/planos`, `\n\nSee the plans: ${SITE_URL}/planos`);
      await sendWhatsappText(from, err);
    };
    // Comida contada em texto (ou áudio): devolve true se já respondeu.
    const foodText = async (said: string, userText: string, key: string, prefixText = "") => {
      if (detectHealthIntent(said, lang)?.kind !== "food") return false;
      const r = await callApp(origin, session.cookie, "/api/food-text", { method: "POST", body: JSON.stringify({ text: said, lang, requestId: requestKeyFor(key) }) });
      const result = r.data.result as { items?: FoodAiItem[]; meal?: string | null; tip?: string } | undefined;
      if (r.ok && result?.items?.length) {
        try { await logFood(result.items, mealFor(said, result.meal), userText, String(result.tip || ""), "", prefixText); }
        catch (e) { console.error("VIVA WhatsApp food save", e); await sendWhatsappText(from, tr("Entendi a refeição, mas não consegui salvar no diário agora. Tente de novo em instantes.", "I got your meal, but couldn't save it to your diary right now. Please try again in a moment.")); }
        return true;
      }
      if (!r.data.not_food) { await foodError(r.data); return true; }
      return false; // Não era comida: segue para a VIVA normal.
    };
    if (text && !media && await foodText(text, text, id + ":food")) return;
    // Foto: tenta como prato primeiro (sem cobrar se não for comida); se não for, lê como comprovante.
    if (media?.kind === "receipt" && media.image && !/\b(comprovante|pix|nota|cupom|boleto|recibo|fatura|transfer|receipt|invoice|bill|payment)/i.test(media.caption || "")) {
      const file = await downloadWhatsappMedia(media.id);
      const mime = "error" in file ? "" : (file.mime || media.mime).replace("image/jpg", "image/jpeg");
      if (!("error" in file) && /^image\/(jpeg|png|webp)$/.test(mime) && file.buffer.length <= 2_900_000) {
        await sendWhatsappText(from, tr("📸 Analisando sua foto…", "📸 Analyzing your photo…"));
        const image = `data:${mime};base64,${file.buffer.toString("base64")}`;
        const r = await callApp(origin, session.cookie, "/api/food-photo", { method: "POST", body: JSON.stringify({ image, lang, note: media.caption?.slice(0, 300) || undefined, requestId: requestKeyFor(id + ":meal") }) });
        const result = r.data.result as { items?: FoodAiItem[]; meal?: string | null; tip?: string; confidence?: string } | undefined;
        const usage = r.data.usage as { sample_left?: number | null } | undefined;
        if (r.ok && result?.items?.length) {
          const low = result.confidence === "low" ? tr("\n\n_⚠️ A foto não estava muito clara: confira os itens no app._", "\n\n_⚠️ The photo wasn't very clear: check the items in the app._") : "";
          const sample = usage?.sample_left != null ? sampleFooter("meal", Number(usage.sample_left), lang) : "";
          try { await logFood(result.items, mealFor(media.caption || "", result.meal), `[foto do prato]${media.caption ? " " + media.caption : ""}`, String(result.tip || ""), low + sample); }
          catch (e) { console.error("VIVA WhatsApp meal save", e); await sendWhatsappText(from, tr("Analisei o prato, mas não consegui salvar no diário agora. Tente de novo em instantes.", "I analyzed your meal, but couldn't save it to your diary right now. Please try again in a moment.")); }
          return;
        }
        if (!r.data.not_food) { await foodError(r.data); return; }
      }
    }

    let message = text;
    let userContent = text;
    let prefix = "";
    let receiptUploadId: string | null = null;
    let sampleNote = "";
    if (media?.kind === "audio") {
      await sendWhatsappText(from, tr("🎧 Ouvindo seu áudio…", "🎧 Listening to your voice note…"));
      const file = await downloadWhatsappMedia(media.id);
      if ("error" in file) { await sendWhatsappText(from, file.error === "too_big" ? tr("Esse áudio ficou grande demais 😅 Me manda um de até 1 minuto.", "That voice note is too long 😅 Please send one up to 1 minute.") : tr("Não consegui baixar seu áudio. Tenta mandar de novo?", "I couldn't download your voice note. Could you send it again?")); return; }
      const seconds = (file.mime.includes("ogg") ? oggDurationSeconds(file.buffer) : null) ?? Math.max(1, file.buffer.length / 4000);
      if (seconds > 60) { await sendWhatsappText(from, tr("Esse áudio passou de 1 minuto 😅 Me manda em partes menores, por favor.", "That voice note is over 1 minute 😅 Please send it in shorter parts.")); return; }
      const form = new FormData();
      const mime = file.mime && file.mime.startsWith("audio/") ? file.mime : "audio/ogg";
      form.append("audio", new Blob([new Uint8Array(file.buffer)], { type: mime }), mime.includes("ogg") ? "audio.ogg" : mime.includes("mpeg") ? "audio.mp3" : "audio.m4a");
      form.append("duration_seconds", String(Math.min(60, Math.max(1, Math.round(seconds)))));
      const trx = await callAppForm(origin, session.cookie, "/api/assistant/transcribe", form);
      const transcript = String(trx.data.text || "").trim();
      if (!trx.ok || !transcript) {
        let err = String(trx.data.error || tr("Não consegui entender o áudio. Tenta falar mais perto do microfone? 🎤", "I couldn't understand the voice note. Could you speak closer to the mic? 🎤"));
        if (trx.data.upgrade) err += tr(`\n\nAssine o Pro (Pix ou cartão): ${SITE_URL}/planos`, `\n\nGet Pro (Pix or card): ${SITE_URL}/planos`);
        await sendWhatsappText(from, err);
        return;
      }
      message = transcript.slice(0, 4000);
      userContent = message;
      lang = detectLang(transcript, lang);
      prefix = `🎤 _“${transcript.slice(0, 280)}”_\n\n`;
      if (trx.data.sample_left != null) sampleNote = sampleFooter("audio", Number(trx.data.sample_left), lang);
      // Áudio de saúde ("bebi 2 copos de água", "I had rice for lunch") vai direto para o diário.
      if (await quickHealth(message, message, prefix)) return;
      if (await foodText(message, message, id + ":voicefood", prefix)) return;
    } else if (media?.kind === "receipt") {
      const file = await downloadWhatsappMedia(media.id);
      if ("error" in file) { await sendWhatsappText(from, file.error === "too_big" ? tr("Esse arquivo passou de 5 MB 😅 Tenta uma foto mais leve.", "That file is over 5 MB 😅 Try a lighter photo.") : tr("Não consegui baixar a foto. Tenta mandar de novo?", "I couldn't download the photo. Could you send it again?")); return; }
      const mime = file.mime || media.mime;
      const ext = mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "image/jpeg" || mime === "image/jpg" ? "jpg" : null;
      if (!ext) { await sendWhatsappText(from, tr("Consigo ler *foto* (JPG/PNG) ou *PDF* do comprovante. Tenta mandar assim?", "I can read a receipt *photo* (JPG/PNG) or *PDF*. Could you send it that way?")); return; }
      const contentType = ext === "jpg" ? "image/jpeg" : mime;
      const path = `${link.user_id}/${randomUUID()}.${ext}`;
      const { error: upError } = await admin.storage.from("viva-receipt-temp").upload(path, file.buffer, { contentType, cacheControl: "0", upsert: false });
      if (upError) { console.error("VIVA WhatsApp receipt upload", upError); await sendWhatsappText(from, tr("Não consegui guardar a foto agora. Tenta de novo em instantes.", "I couldn't save the photo right now. Please try again in a moment.")); return; }
      const { data: row, error: rowError } = await admin.from("viva_receipt_uploads").insert({ user_id: link.user_id, temp_path: path, file_name: `whatsapp.${ext}`, mime_type: contentType, status: "uploaded", expires_at: new Date(Date.now() + 60 * 60000).toISOString() }).select("id").single();
      if (rowError || !row) { await admin.storage.from("viva-receipt-temp").remove([path]); await sendWhatsappText(from, tr("Não consegui preparar o comprovante. Tenta de novo?", "I couldn't prepare the receipt. Could you try again?")); return; }
      receiptUploadId = String(row.id);
      message = (media.caption || "").slice(0, 500);
      userContent = `[foto de comprovante]${media.caption ? " " + media.caption : ""}`;
      prefix = tr("🧾 Li seu comprovante!\n\n", "🧾 I read your receipt!\n\n");
    }

    const history: HistoryItem[] = Array.isArray(link.history) ? (link.history as HistoryItem[]).slice(-10) : [];
    const res = await callApp(origin, session.cookie, "/api/assistant", { method: "POST", body: JSON.stringify({ message, history, requestId: requestKeyFor(id), ...(receiptUploadId ? { receiptUploadId } : {}) }) });
    const { reply: rawReply, clarification, transactionId } = await buildReply(res, origin, session.cookie, lang);
    if (receiptUploadId && res.data.sample_left != null) sampleNote = sampleFooter("photo", Number(res.data.sample_left), lang);
    const reply = (res.ok && !res.data.error ? prefix : prefix.startsWith("🎤") ? prefix : "") + rawReply + sampleNote;
    await sendWhatsappText(from, freeLeft === null ? reply : reply + freeLeftFooter(freeLeft, lang));

    const nextHistory: HistoryItem[] = [...history, { role: "user" as const, content: userContent.slice(0, 4000), lang }, { role: "assistant" as const, content: reply.slice(0, 4000), ...(clarification ? { clarification } : {}) }].slice(-12);
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
function sampleFooter(kind: "audio" | "photo" | "meal", left: number, lang: Lang = "pt") {
  if (lang === "en") {
    const what = kind === "audio" ? "voice note" : kind === "meal" ? "meal photo" : "receipt photo";
    return left <= 0 ? `\n\n_🎁 That was your last free ${what} this month. Unlimited on Pro: ${SITE_URL}/planos_` : `\n\n_🎁 ${left} free ${what}${left === 1 ? "" : "s"} left this month._`;
  }
  if (kind === "meal") return left <= 0 ? `\n\n_🎁 Essa foi a última foto grátis do mês. Com o Pro é à vontade: ${SITE_URL}/planos_` : `\n\n_🎁 Resta${left === 1 ? "" : "m"} ${left} ${left === 1 ? "foto grátis" : "fotos grátis"} este mês._`;
  const what = kind === "audio" ? (left === 1 ? "áudio grátis" : "áudios grátis") : (left === 1 ? "leitura de comprovante grátis" : "leituras de comprovante grátis");
  if (left <= 0) return `\n\n_🎁 Esse foi o último ${kind === "audio" ? "áudio grátis" : "comprovante grátis"} do mês. Com o Pro é à vontade: ${SITE_URL}/planos_`;
  return `\n\n_🎁 ${kind === "audio" ? "Resta" + (left === 1 ? "" : "m") : "Resta" + (left === 1 ? "" : "m")} ${left} ${what} este mês._`;
}
type Media = { kind: "audio" | "receipt"; id: string; mime: string; caption?: string; image?: boolean };
function mediaOf(m: WaMessage): Media | null {
  const audio = m.audio || m.voice;
  if ((m.type === "audio" || m.type === "voice") && audio?.id) return { kind: "audio", id: audio.id, mime: String(audio.mime_type || "audio/ogg").split(";")[0] };
  if (m.type === "image" && m.image?.id) return { kind: "receipt", id: m.image.id, mime: String(m.image.mime_type || "image/jpeg"), caption: m.image.caption, image: true };
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

async function buildReply(res: AppResult, origin: string, cookie: string, lang: Lang = "pt"): Promise<{ reply: string; clarification?: Record<string, unknown>; transactionId?: string }> {
  const d = res.data;
  const tr = (pt: string, en: string) => (lang === "en" ? en : pt);
  if (!res.ok || d.error) {
    let reply = String(d.error || tr("Não consegui responder agora. Tente de novo em instantes.", "I couldn't reply right now. Please try again in a moment."));
    if (d.upgrade) reply += tr(`\n\nVeja os planos: ${SITE_URL}/planos`, `\n\nSee the plans: ${SITE_URL}/planos`);
    return { reply };
  }

  const draft = d.transactionDraft as Record<string, unknown> | undefined;
  if (draft) {
    const amount = Number(draft.amount || 0);
    if (!(amount > 0)) return { reply: tr("Qual foi o valor?", "What was the amount?"), clarification: { amount: null, description: String(draft.description || ""), category: String(draft.category || "Outros"), occurred_on: String(draft.occurred_on || todayIso()), payment_method: String(draft.payment_method || "Pix") } };
    const kind = draft.kind === "income" ? "income" : "expense";
    const payload = { kind, amount, description: String(draft.description || (kind === "income" ? "Entrada" : "Gasto")).slice(0, 240), occurred_on: String(draft.occurred_on || todayIso()), category: draft.category ? String(draft.category) : undefined, payment_method: draft.payment_method ? String(draft.payment_method) : undefined, source: "viva" };
    const saved = await callApp(origin, cookie, "/api/transactions", { method: "POST", body: JSON.stringify(payload) });
    if (!saved.ok) return { reply: String(saved.data.error || tr("Não consegui salvar esse lançamento agora. Tente de novo em instantes.", "I couldn't save this entry right now. Please try again in a moment.")) };
    const tx = saved.data.transaction as { id?: string } | undefined;
    const date = payload.occurred_on !== todayIso() ? ` · ${payload.occurred_on.slice(8, 10)}/${payload.occurred_on.slice(5, 7)}` : "";
    const reply = lang === "en"
      ? `${kind === "income" ? "Income" : "Expense"} logged ✅\n${brl(amount)} · ${payload.description}${payload.category ? ` (${payload.category})` : ""}${date}\n\nWrong? Reply *undo*.`
      : `${kind === "income" ? "Entrada" : "Gasto"} anotado ✅\n${brl(amount)} · ${payload.description}${payload.category ? ` (${payload.category})` : ""}${date}\n\nSe errei, responda *desfazer*.`;
    return { reply, transactionId: tx?.id };
  }

  const clarification = d.clarification as Record<string, unknown> | undefined;
  if (clarification) {
    const amount = Number(clarification.amount || 0);
    const reply = d.clarificationPrompt ? String(d.clarificationPrompt) : amount > 0 ? tr(`${brl(amount)}: foi um *gasto* ou uma *entrada*?\nResponda *1* para gasto ou *2* para entrada.`, `${brl(amount)}: was it an *expense* or *income*?\nReply *1* for expense or *2* for income.`) : tr("Qual foi o valor?", "What was the amount?");
    return { reply, clarification };
  }

  if (d.eventDraft || d.billDraft || d.profileDraft) {
    return { reply: `${d.answer ? String(d.answer) : tr("Preparei isso para você.", "I prepared this for you.")}\n\n${tr("Para confirmar, abra o app", "To confirm, open the app")}: ${SITE_URL}/assistente` };
  }

  let reply = d.answer ? String(d.answer) : tr("Não entendi bem. Pode reformular?", "I didn't quite get that. Could you rephrase?");
  const action = d.action as { href?: string; label?: string } | undefined;
  if (action?.href) reply += `\n\n${action.label || tr("Abrir no app", "Open in the app")}: ${action.href.startsWith("http") ? action.href : SITE_URL + action.href}`;
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
