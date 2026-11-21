import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { runWithSupabaseClient } from "@/lib/supabase/server";
import { extractMoneyAmount } from "@/lib/finance-intent";
import { POST as assistantPOST } from "@/app/api/assistant/route";
import { POST as transactionsPOST } from "@/app/api/transactions/route";
import { POST as billsPOST } from "@/app/api/bills/route";
import { PATCH as myDataPATCH } from "@/app/api/my-data/route";
import { POST as discardReceiptPOST } from "@/app/api/receipts/discard/route";
import { appUrl, downloadMedia, markRead, sendButtons, sendText } from "./api";
import { getUserClient, type WhatsAppState } from "./session";

type Admin = ReturnType<typeof createAdminClient>;

export type IncomingMessage = {
  id: string;
  from: string;
  type: string;
  text?: { body?: string };
  interactive?: { button_reply?: { id?: string; title?: string }; list_reply?: { id?: string; title?: string } };
  button?: { text?: string; payload?: string };
  audio?: { id: string; mime_type?: string };
  image?: { id: string; mime_type?: string };
  document?: { id: string; mime_type?: string; filename?: string };
};

type Clarification = { amount: number | null; description: string; category: string; occurred_on: string; payment_method: string; kind?: "expense" | "income" };
type HistoryItem = { role: "user" | "assistant"; content: string; clarification?: Omit<Clarification, "kind"> };
type TxDraft = { kind: "expense" | "income"; amount: number; description: string; occurred_on: string; category?: string; payment_method?: string; isReceipt?: boolean; receiptUploadId?: string; missing_fields?: string[] };
type EventDraft = { title: string; start_at: string; description?: string; reminder_enabled?: boolean; reminder_before_minutes?: number; reminder_at_start?: boolean };
type BillDraft = { name: string; amount: number; due_date: string; recurrence?: string; installments?: number; category?: string };
type ProfileDraft = { field: string; value: unknown; label: string; display: string };
type Pending =
  | { type: "transaction"; draft: TxDraft }
  | { type: "event"; draft: EventDraft }
  | { type: "bill"; draft: BillDraft }
  | { type: "profile"; draft: ProfileDraft }
  | { type: "clarification"; draft: Clarification };

const OK = "viva_ok", CANCEL = "viva_cancel", EXPENSE = "viva_expense", INCOME = "viva_income";
const CONFIRM_BUTTONS = [{ id: OK, title: "✅ Salvar" }, { id: CANCEL, title: "❌ Cancelar" }];
const KIND_BUTTONS = [{ id: EXPENSE, title: "💸 Despesa" }, { id: INCOME, title: "💰 Receita" }];
const TZ = "America/Sao_Paulo";

const brl = (n: number) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateBR = (ymd: string) => (/^\d{4}-\d{2}-\d{2}$/.test(ymd) ? new Date(ymd + "T12:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "data a confirmar");
const dateTimeBR = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const isYes = (t: string) => /^\s*(sim|s|ok|okay|pode|confirm[ao]r?|confirmo|salva(r)?|isso|beleza|blz|👍|✅)\s*[.!]*\s*$/i.test(t);
const isNo = (t: string) => /^\s*(n[ãa]o|nao|n|cancela(r)?|deixa|esquece|❌)\s*[.!]*\s*$/i.test(t);

function internalRequest(path: string, method: string, body?: unknown | FormData) {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  return new Request("http://viva.internal" + path, {
    method,
    headers: isForm ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  });
}

async function readJson(res: Response) {
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

function txSummary(d: TxDraft) {
  const lines = [
    (d.kind === "income" ? "💰 *Receita*: " : "💸 *Despesa*: ") + (d.amount > 0 ? brl(d.amount) : "valor a confirmar"),
    "📝 " + (d.description || "Sem descrição"),
    "🏷️ " + [d.category, d.payment_method].filter(Boolean).join(" · "),
    "📅 " + dateBR(d.occurred_on),
  ];
  return lines.filter(l => l.trim().length > 2).join("\n");
}

function eventSummary(d: EventDraft) {
  const remind = d.reminder_enabled === false ? "sem lembrete" : d.reminder_before_minutes ? `lembrete ${d.reminder_before_minutes} min antes` + (d.reminder_at_start ? " e na hora" : "") : "lembrete na hora";
  return `📅 *${d.title}*\n🕒 ${dateTimeBR(d.start_at)}\n🔔 ${remind}`;
}

function billSummary(d: BillDraft) {
  return `🧾 *${d.name}*\n💵 ${brl(d.amount)}\n📅 vence em ${dateBR(d.due_date)}`;
}

async function saveState(admin: Admin, userId: string, patch: { history?: HistoryItem[]; pending?: Pending | null }) {
  const { error } = await admin.from("viva_whatsapp_state").upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) console.error("VIVA WhatsApp state save failed", error);
}

function cleanHistory(items: HistoryItem[]): HistoryItem[] {
  return items
    .filter(i => (i?.role === "user" || i?.role === "assistant") && typeof i.content === "string" && i.content.trim())
    .slice(-12)
    .map(i => {
      const c = i.clarification;
      const valid = c && (c.amount === null || typeof c.amount === "number") && [c.description, c.category, c.occurred_on, c.payment_method].every(v => typeof v === "string");
      return { role: i.role, content: i.content.slice(0, 4000), ...(valid ? { clarification: c } : {}) };
    });
}

function pushHistory(history: HistoryItem[], ...items: HistoryItem[]) {
  return [...history, ...items.map(i => ({ ...i, content: i.content.slice(0, 4000) }))].slice(-12);
}

async function askConfirm(to: string, pending: Pending, intro?: string) {
  if (pending.type === "transaction") {
    const missing = !(pending.draft.amount > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(pending.draft.occurred_on);
    if (missing) {
      await sendText(to, (intro ? intro + "\n\n" : "") + txSummary(pending.draft) + "\n\nFaltou o valor ou a data. Me mande em texto, por exemplo: *gastei 35,90 no mercado hoje*.");
      return false;
    }
    await sendButtons(to, (intro ? intro + "\n\n" : "") + txSummary(pending.draft) + "\n\nPosso salvar?", CONFIRM_BUTTONS);
  } else if (pending.type === "event") await sendButtons(to, (intro || "Separei seu compromisso:") + "\n\n" + eventSummary(pending.draft) + "\n\nPosso salvar na agenda?", CONFIRM_BUTTONS);
  else if (pending.type === "bill") await sendButtons(to, (intro || "Separei os dados da conta:") + "\n\n" + billSummary(pending.draft) + "\n\nPosso cadastrar?", CONFIRM_BUTTONS);
  else if (pending.type === "profile") await sendButtons(to, intro || `Quer que eu atualize ${pending.draft.label.toLowerCase()} para ${pending.draft.display}?`, CONFIRM_BUTTONS);
  return true;
}

async function commitPending(client: SupabaseClient, userId: string, pending: Pending): Promise<string> {
  return runWithSupabaseClient(client, async () => {
    if (pending.type === "transaction") {
      const d = pending.draft;
      const res = await transactionsPOST(internalRequest("/api/transactions", "POST", { ...d, source: "viva", isReceipt: Boolean(d.isReceipt), receiptUploadId: d.receiptUploadId }));
      const data = await readJson(res);
      if (!res.ok) throw new Error(String(data.error || "Não foi possível salvar o lançamento."));
      return String(data.message || "Lançamento salvo! 💜");
    }
    if (pending.type === "bill") {
      const res = await billsPOST(internalRequest("/api/bills", "POST", pending.draft));
      const data = await readJson(res);
      if (!res.ok) throw new Error(String(data.error || "Não foi possível cadastrar a conta."));
      return String(data.message || "Conta cadastrada! 💜");
    }
    if (pending.type === "profile") {
      const res = await myDataPATCH(internalRequest("/api/my-data", "PATCH", { field: pending.draft.field, value: pending.draft.value }));
      const data = await readJson(res);
      if (!res.ok) throw new Error(String(data.error || "Não foi possível atualizar."));
      return "Pronto! Atualizei seu perfil: " + pending.draft.label.toLowerCase() + " agora é " + pending.draft.display + ".";
    }
    if (pending.type === "event") {
      const d = pending.draft;
      const { error } = await client.from("viva_events").insert({
        user_id: userId, title: d.title, start_at: d.start_at, description: d.description || "",
        reminder_enabled: d.reminder_enabled ?? true, reminder_before_minutes: d.reminder_before_minutes ?? 30, reminder_at_start: d.reminder_at_start ?? true,
      });
      if (error) throw new Error(error.message || "Não foi possível salvar o compromisso.");
      return "Compromisso salvo! Vou avisar " + (d.reminder_before_minutes ? d.reminder_before_minutes + " minutos antes" : "na hora") + (d.reminder_at_start ? " e também no início." : ".") + " 💜";
    }
    return "";
  });
}

async function discardPending(client: SupabaseClient, pending: Pending | null) {
  if (pending?.type === "transaction" && pending.draft.receiptUploadId) {
    await runWithSupabaseClient(client, () => discardReceiptPOST(internalRequest("/api/receipts/discard", "POST", { receiptUploadId: pending.draft.receiptUploadId }))).catch(() => null);
  }
}

/** Guarda foto/PDF no mesmo armazenamento temporário que o app usa. */
async function stageReceipt(client: SupabaseClient, userId: string, mediaId: string, declaredMime?: string, fileName?: string) {
  const { buffer, mimeType } = await downloadMedia(mediaId);
  const mime = (declaredMime || mimeType).split(";")[0].trim().toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(mime)) throw new Error("Envie o comprovante como foto (JPG/PNG) ou PDF.");
  if (buffer.length > 5 * 1024 * 1024) throw new Error("O arquivo deve ter até 5 MB.");
  const ext = mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/${randomUUID()}.${ext}`;
  const { error: upErr } = await client.storage.from("viva-receipt-temp").upload(path, buffer, { contentType: mime, cacheControl: "0", upsert: false });
  if (upErr) throw new Error("Não consegui receber o arquivo. Tente de novo.");
  const { data: record, error: recErr } = await client.from("viva_receipt_uploads")
    .insert({ user_id: userId, temp_path: path, file_name: (fileName || "comprovante-whatsapp." + ext).slice(0, 180), mime_type: mime, status: "uploaded", expires_at: new Date(Date.now() + 60 * 60000).toISOString() })
    .select("id").single();
  if (recErr || !record) {
    await client.storage.from("viva-receipt-temp").remove([path]);
    throw new Error("Não consegui preparar o comprovante para análise.");
  }
  return String(record.id);
}

async function tryLink(admin: Admin, waId: string, text: string) {
  const match = text.match(/VIVA-([A-Z0-9]{6})/i);
  if (!match) return null;
  const code = match[1].toUpperCase();
  const { data: row } = await admin.from("viva_whatsapp_link_codes").select("user_id,expires_at").eq("code", code).maybeSingle();
  if (!row || new Date(row.expires_at).getTime() < Date.now()) return { ok: false as const };
  await admin.from("viva_whatsapp_links").delete().or(`wa_id.eq.${waId},user_id.eq.${row.user_id}`);
  const { error } = await admin.from("viva_whatsapp_links").insert({ user_id: row.user_id, wa_id: waId, last_message_at: new Date().toISOString() });
  if (error) throw error;
  await admin.from("viva_whatsapp_link_codes").delete().eq("user_id", row.user_id);
  await admin.from("viva_whatsapp_state").upsert({ user_id: row.user_id, history: [], pending: null, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  return { ok: true as const };
}

export async function handleIncoming(msg: IncomingMessage) {
  const admin = createAdminClient();
  const to = msg.from;

  // Deduplicação: a Meta pode reenviar o mesmo evento.
  const { error: dupErr } = await admin.from("viva_whatsapp_inbox").insert({ message_id: msg.id, wa_id: to });
  if (dupErr) { if (dupErr.code === "23505") return; console.error("VIVA WhatsApp inbox insert failed", dupErr); }
  void markRead(msg.id);

  const buttonId = msg.interactive?.button_reply?.id || msg.button?.payload || "";
  const text = (msg.text?.body || msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || msg.button?.text || "").trim();

  const { data: link } = await admin.from("viva_whatsapp_links").select("user_id").eq("wa_id", to).maybeSingle();
  if (!link) {
    const result = await tryLink(admin, to, text);
    if (result?.ok) return void await sendText(to, "Pronto, conta conectada! 💜\n\nAgora é só falar comigo por aqui, do mesmo jeito que no app:\n• *gastei 42 no almoço*\n• *recebi 1500 de salário*\n• *me lembra de pagar a luz amanhã às 9h*\n• *coloca arroz e café na lista*\n• *quanto posso gastar hoje?*\n\nTambém entendo *áudio* e *foto de comprovante*. 📸🎙️");
    if (result && !result.ok) return void await sendText(to, "Esse código expirou ou já foi usado. Abra o app VIVA+ e toque em *Conectar WhatsApp* de novo para gerar outro. 💜");
    return void await sendText(to, "Oi! Eu sou a VIVA+, sua assistente de finanças e rotina. 💜\n\nPara conversar comigo por aqui, conecte sua conta: abra o app, vá em *Configurações > Notificações* e toque em *Conectar WhatsApp*." + (appUrl() ? "\n\n" + appUrl("/configuracoes/notificacoes") : ""));
  }
  const userId = String(link.user_id);
  await admin.from("viva_whatsapp_links").update({ last_message_at: new Date().toISOString() }).eq("user_id", userId);

  const { data: profile } = await admin.from("viva_profiles").select("account_status,terms_of_use_version,privacy_policy_version,terms_accepted_at").eq("id", userId).maybeSingle();
  if (profile?.account_status === "suspended") return void await sendText(to, "Sua conta está suspensa. Fale com o suporte pelo app.");
  if (!(profile?.terms_of_use_version && profile?.privacy_policy_version && profile?.terms_accepted_at)) return void await sendText(to, "Antes de continuarmos, aceite os Termos de Uso e a Política de Privacidade no app. 💜" + (appUrl() ? "\n" + appUrl("/aceite-termos") : ""));

  if (/^\s*desconectar\s*$/i.test(text)) {
    await admin.from("viva_whatsapp_links").delete().eq("user_id", userId);
    await admin.from("viva_whatsapp_state").delete().eq("user_id", userId);
    return void await sendText(to, "Desconectei este WhatsApp da sua conta VIVA+. Quando quiser voltar, é só conectar de novo pelo app. 💜");
  }

  const { data: stateRow } = await admin.from("viva_whatsapp_state").select("*").eq("user_id", userId).maybeSingle();
  const state = (stateRow as WhatsAppState | null) ?? null;
  let history: HistoryItem[] = Array.isArray(state?.history) ? cleanHistory(state!.history as HistoryItem[]) : [];
  let pending: Pending | null = (state?.pending as Pending | null) ?? null;

  let client: SupabaseClient;
  try { client = await getUserClient(admin, userId, state); }
  catch (e) { console.error("VIVA WhatsApp auth failed", e); return void await sendText(to, "Não consegui acessar sua conta agora. Tente de novo em instantes. 💜"); }

  // 1) Resposta a um rascunho pendente (Salvar / Cancelar / Despesa / Receita)
  if (pending && msg.type !== "audio" && msg.type !== "image" && msg.type !== "document") {
    if (pending.type === "clarification") {
      const kind = buttonId === EXPENSE || /^\s*despesas?\b/i.test(text) ? "expense" : buttonId === INCOME || /^\s*receitas?\b/i.test(text) ? "income" : null;
      const amount = kind ? null : extractMoneyAmount(text);
      if (kind || amount) {
        const c: Clarification = { ...pending.draft, ...(kind ? { kind } : {}), ...(amount ? { amount } : {}) };
        if (c.kind && c.amount) {
          const tx: Pending = { type: "transaction", draft: { description: c.description, category: c.category, occurred_on: c.occurred_on, payment_method: c.payment_method, kind: c.kind, amount: Number(c.amount) } };
          await saveState(admin, userId, { pending: tx, history: pushHistory(history, { role: "user", content: text }) });
          return void await askConfirm(to, tx);
        }
        await saveState(admin, userId, { pending: { type: "clarification", draft: c }, history: pushHistory(history, { role: "user", content: text }) });
        return void await (c.kind ? sendText(to, "Qual foi o valor?") : sendButtons(to, "Anotei " + brl(Number(c.amount)) + ". É despesa ou receita?", KIND_BUTTONS));
      }
      if (isNo(text) || buttonId === CANCEL) { await saveState(admin, userId, { pending: null }); return void await sendText(to, "Tudo bem, deixei pra lá."); }
      pending = null; // assunto novo: segue para a assistente
      await saveState(admin, userId, { pending: null });
    } else if (buttonId === OK || isYes(text)) {
      try {
        const done = await commitPending(client, userId, pending);
        await saveState(admin, userId, { pending: null, history: pushHistory(history, { role: "user", content: text || "Salvar" }, { role: "assistant", content: done }) });
        return void await sendText(to, done);
      } catch (e) {
        await saveState(admin, userId, { pending: null });
        return void await sendText(to, (e instanceof Error ? e.message : "Não consegui salvar.") + "\nSe quiser, me mande os dados de novo.");
      }
    } else if (buttonId === CANCEL || isNo(text)) {
      await discardPending(client, pending);
      const msgCancel = pending.type === "event" ? "Compromisso cancelado." : pending.type === "bill" ? "Cadastro cancelado." : pending.type === "profile" ? "Ok, mantive seu perfil como estava." : "Lançamento cancelado.";
      await saveState(admin, userId, { pending: null, history: pushHistory(history, { role: "user", content: text || "Cancelar" }, { role: "assistant", content: msgCancel }) });
      return void await sendText(to, msgCancel);
    } else {
      await discardPending(client, pending);
      pending = null;
      await saveState(admin, userId, { pending: null });
    }
  }

  // 2) Montar a chamada para a assistente (texto, áudio ou comprovante)
  let request: Request;
  let userContent = text;
  try {
    if (msg.type === "audio" && msg.audio?.id) {
      const { buffer, mimeType } = await downloadMedia(msg.audio.id);
      const seconds = Math.max(1, Math.round(buffer.length / 2000));
      if (seconds > 60) return void await sendText(to, "Consigo ouvir áudios de até 1 minuto. Pode mandar um mais curtinho? 🎙️");
      const mime = (msg.audio.mime_type || mimeType || "audio/ogg").split(";")[0].trim();
      const form = new FormData();
      form.set("audio", new File([new Uint8Array(buffer)], "whatsapp.ogg", { type: mime }));
      form.set("duration_seconds", String(seconds));
      form.set("history", JSON.stringify(history));
      form.set("requestId", "wa-" + msg.id.slice(-60));
      request = internalRequest("/api/assistant", "POST", form);
      userContent = "🎙️ Mensagem de voz";
    } else if ((msg.type === "image" && msg.image?.id) || (msg.type === "document" && msg.document?.id)) {
      const media = msg.image || msg.document!;
      const receiptUploadId = await stageReceipt(client, userId, media.id, media.mime_type, msg.document?.filename);
      request = internalRequest("/api/assistant", "POST", { receiptUploadId, requestId: "wa-" + msg.id.slice(-60) });
      userContent = "📸 Comprovante";
    } else if (text) {
      request = internalRequest("/api/assistant", "POST", { message: text.slice(0, 4000), history, requestId: "wa-" + msg.id.slice(-60) });
    } else {
      return void await sendText(to, "Por enquanto entendo texto, áudio e foto ou PDF de comprovante. 💜");
    }
  } catch (e) {
    return void await sendText(to, e instanceof Error ? e.message : "Não consegui receber essa mensagem.");
  }

  const res = await runWithSupabaseClient(client, () => assistantPOST(request));
  const data = await readJson(res);
  const transcript = typeof data.transcript === "string" && data.transcript ? data.transcript : "";
  if (transcript) userContent = transcript;
  const heard = transcript ? `🎙️ _"${transcript}"_\n\n` : "";

  if (data.state === "limit_reached" || data.state === "blocked" || (!res.ok && !data.answer)) {
    const err = String(data.message || data.error || "Não consegui responder agora. Tente de novo.");
    return void await sendText(to, heard + err + (data.state === "limit_reached" && appUrl() ? "\n\nVeja seus créditos no app: " + appUrl("/assistente") : ""));
  }

  let next: Pending | null = null;
  let reply = String(data.answer || "");
  let historyExtra: { clarification?: HistoryItem["clarification"] } = {};

  if (data.transactionDraft) next = { type: "transaction", draft: data.transactionDraft as TxDraft };
  else if (data.eventDraft) next = { type: "event", draft: data.eventDraft as EventDraft };
  else if (data.billDraft) next = { type: "bill", draft: data.billDraft as BillDraft };
  else if (data.profileDraft) next = { type: "profile", draft: data.profileDraft as ProfileDraft };
  else if (data.clarification) {
    const c = data.clarification as Clarification;
    next = { type: "clarification", draft: c };
    reply = String(data.clarificationPrompt || "Você quer registrar isso como despesa ou receita?");
    historyExtra = { clarification: { amount: c.amount, description: c.description, category: c.category, occurred_on: c.occurred_on, payment_method: c.payment_method } };
  }

  if (next && next.type !== "clarification") {
    const intro = (heard + (next.type === "profile" ? reply : next.type === "transaction" ? (reply || "Confira o lançamento:") : "")).trim() || undefined;
    const ok = await askConfirm(to, next, intro);
    const summary = next.type === "transaction" ? txSummary(next.draft) : next.type === "event" ? eventSummary(next.draft) : next.type === "bill" ? billSummary(next.draft) : reply;
    await saveState(admin, userId, { pending: ok ? next : null, history: pushHistory(history, { role: "user", content: userContent }, { role: "assistant", content: summary }) });
    if (!ok) await discardPending(client, next);
    return;
  }

  const action = data.action as { href?: string; label?: string } | undefined;
  if (action?.href && appUrl()) reply += `\n\n👉 ${action.label || "Abrir no app"}: ${appUrl(action.href)}`;
  if (data.goalDraft && appUrl()) reply += "\n\nPara salvar essa meta, confirme no app: " + appUrl("/assistente");
  if (!reply) reply = "Pronto! 💜";

  history = pushHistory(history, { role: "user", content: userContent }, { role: "assistant", content: reply, ...historyExtra });
  await saveState(admin, userId, { pending: next, history });
  if (next?.type === "clarification") {
    return void await (next.draft.amount ? sendButtons(to, heard + reply, KIND_BUTTONS) : sendText(to, heard + reply + "\n\nMe diga o valor e se é despesa ou receita."));
  }
  await sendText(to, heard + reply);
}
