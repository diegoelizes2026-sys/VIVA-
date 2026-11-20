import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { runAsUser } from "@/lib/supabase/acting-user";
import { userAccessToken } from "@/lib/whatsapp/session";
import { appUrl, downloadMedia, markRead, sendButtons, sendText } from "@/lib/whatsapp/cloud";
import { POST as assistantPOST } from "@/app/api/assistant/route";
import { POST as transactionsPOST } from "@/app/api/transactions/route";
import { POST as billsPOST } from "@/app/api/bills/route";
import { PATCH as myDataPATCH } from "@/app/api/my-data/route";

type Admin = ReturnType<typeof createAdminClient>;

export type Inbound = {
  id: string;
  from: string;
  type: string;
  profileName?: string;
  text?: { body?: string };
  button?: { text?: string; payload?: string };
  interactive?: { type?: string; button_reply?: { id?: string; title?: string }; list_reply?: { id?: string; title?: string } };
  audio?: { id?: string; mime_type?: string };
  voice?: { id?: string; mime_type?: string };
  image?: { id?: string; mime_type?: string; caption?: string };
  document?: { id?: string; mime_type?: string; caption?: string; filename?: string };
};

type Clarification = { amount: number | null; description: string; category: string; occurred_on: string; payment_method: string };
type HistoryItem = { role: "user" | "assistant"; content: string; clarification?: Clarification };
type Pending =
  | { type: "transaction"; draft: Record<string, unknown> }
  | { type: "bill"; draft: Record<string, unknown> }
  | { type: "event"; draft: Record<string, unknown> }
  | { type: "profile"; draft: Record<string, unknown> };
type Link = { user_id: string; wa_id: string; history: HistoryItem[] | null; pending: Pending | null };
type ApiData = Record<string, unknown> & { error?: string; answer?: string; message?: string };

const CONFIRM_BUTTONS = [{ id: "viva:ok", title: "✅ Salvar" }, { id: "viva:no", title: "Cancelar" }];
const YES = /^\s*(sim|s|ok|okay|confirmar?|confirmo|pode( salvar)?|salva(r)?|isso|certo|beleza|blz|👍|✅)\s*[.!]*\s*$/i;
const NO = /^\s*(n[aã]o|nao|cancela(r)?|deixa|esquece|❌)\s*[.!]*\s*$/i;

const brl = (v: unknown) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const day = (iso: unknown) => { const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}` : String(iso || ""); };
const dateTime = (iso: unknown) => {
  const d = new Date(String(iso || ""));
  if (Number.isNaN(d.getTime())) return String(iso || "");
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);
};

async function call(handler: (req: Request) => Promise<Response>, path: string, init: RequestInit): Promise<{ status: number; data: ApiData }> {
  const res = await handler(new Request(`https://viva.internal${path}`, init));
  const data = (await res.json().catch(() => ({}))) as ApiData;
  return { status: res.status, data };
}

const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// ---------------------------------------------------------------- entrada
export async function handleInbound(msg: Inbound) {
  const admin = createAdminClient();
  const { error: dupError } = await admin.from("viva_whatsapp_inbound").insert({ wamid: msg.id, wa_id: msg.from });
  if (dupError) { if (dupError.code === "23505") return; console.error("VIVA WhatsApp dedupe failed", dupError); }
  markRead(msg.id).catch(() => {});

  const text = messageText(msg);
  const code = text.match(/\bVIVA[\s-]?([A-HJ-NP-Z2-9]{6})\b/i);
  if (code) { await linkAccount(admin, msg, code[1].toUpperCase()); return; }

  const { data: link } = await admin.from("viva_whatsapp_links").select("user_id,wa_id,history,pending").eq("wa_id", msg.from).maybeSingle();
  if (!link) { await welcomeLead(admin, msg, text); return; }

  if (/^\s*(desconectar|sair do whatsapp)\s*$/i.test(text)) {
    await admin.from("viva_whatsapp_links").delete().eq("user_id", link.user_id);
    await admin.from("viva_whatsapp_sessions").delete().eq("user_id", link.user_id);
    await sendText(msg.from, "Pronto, desconectei este número da sua conta VIVA+. Para voltar, é só conectar de novo em Meus dados. 💜");
    return;
  }
  if (/^\s*(ajuda|menu|oi|ol[aá]|bom dia|boa tarde|boa noite)\s*[!.?]*\s*$/i.test(text) && !link.pending) {
    await sendText(msg.from, helpText(msg.profileName));
    return;
  }

  const { data: profile } = await admin.from("viva_profiles").select("account_status,terms_of_use_version,privacy_policy_version,terms_accepted_at").eq("id", link.user_id).maybeSingle();
  if (profile?.account_status === "suspended") { await sendText(msg.from, "Sua conta VIVA+ está suspensa. Fale com o suporte pelo app."); return; }
  if (!(profile?.terms_of_use_version && profile?.privacy_policy_version && profile?.terms_accepted_at)) {
    await sendText(msg.from, `Antes de continuar, aceite os Termos de Uso no app: ${appUrl()}/aceite-termos`);
    return;
  }

  try {
    const token = await userAccessToken(admin, link.user_id);
    await runAsUser(token, () => converse(admin, link as Link, msg, text));
  } catch (error) {
    console.error("VIVA WhatsApp conversation failed", error);
    await sendText(msg.from, "Tive um probleminha para responder agora. Tenta de novo em instantes? 💜").catch(() => {});
  }
}

function messageText(msg: Inbound) {
  if (msg.type === "text") return String(msg.text?.body || "").trim();
  if (msg.type === "interactive") return String(msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id || "").trim();
  if (msg.type === "button") return String(msg.button?.payload || msg.button?.text || "").trim();
  if (msg.type === "image") return String(msg.image?.caption || "").trim();
  if (msg.type === "document") return String(msg.document?.caption || "").trim();
  return "";
}

function helpText(name?: string) {
  const hi = name ? `Oi, ${name.split(" ")[0]}!` : "Oi!";
  return `${hi} 💜 Pode falar comigo do jeito que você fala com um amigo:\n\n` +
    "💸 *gastei 35 no mercado no pix*\n" +
    "🧾 manda a *foto do comprovante* que eu lanço\n" +
    "🎙️ manda um *áudio* que eu entendo\n" +
    "📅 *me lembra da reunião amanhã às 15h*\n" +
    "🧮 *posso comprar um tênis de 300?*\n" +
    "🛒 *acabou o café e o arroz*\n\n" +
    "Nada é salvo sem você confirmar.";
}

// ---------------------------------------------------------------- leads e vínculo
async function welcomeLead(admin: Admin, msg: Inbound, text: string) {
  const { data: lead } = await admin.from("viva_whatsapp_leads").select("messages_count").eq("wa_id", msg.from).maybeSingle();
  if (lead) {
    await admin.from("viva_whatsapp_leads").update({ messages_count: Number(lead.messages_count || 0) + 1, last_seen_at: new Date().toISOString(), profile_name: msg.profileName || null }).eq("wa_id", msg.from);
  } else {
    await admin.from("viva_whatsapp_leads").insert({ wa_id: msg.from, profile_name: msg.profileName || null, first_message: (text || `[${msg.type}]`).slice(0, 500) });
  }
  const name = msg.profileName ? `, ${msg.profileName.split(" ")[0]}` : "";
  const body = lead
    ? `Pra eu cuidar do seu dinheiro, contas e agenda por aqui, crie sua conta em 1 minuto 👇\n${appUrl()}/cadastro\n\nDepois abra *Meus dados → VIVA no WhatsApp* e toque em *Conectar*.`
    : `Oi${name}! 💜 Eu sou a *VIVA+*, sua assistente pessoal.\n\n` +
      "Aqui no WhatsApp eu:\n" +
      "💸 anoto seus gastos por mensagem, áudio ou foto do comprovante\n" +
      "🧮 te digo se uma compra *cabe* no seu mês\n" +
      "📅 lembro das suas contas e compromissos\n" +
      "💪 monto seu treino com o VIVA+ Personal\n\n" +
      `Cria sua conta em 1 minuto 👇\n${appUrl()}/cadastro\n\n` +
      "Depois é só abrir *Meus dados → VIVA no WhatsApp* e tocar em *Conectar*.";
  await sendText(msg.from, body);
}

async function linkAccount(admin: Admin, msg: Inbound, code: string) {
  const { data: row } = await admin.from("viva_whatsapp_link_codes").select("user_id,expires_at").eq("code", code).maybeSingle();
  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    await sendText(msg.from, "Esse código expirou ou não existe. Gere um novo no app em *Meus dados → VIVA no WhatsApp*.");
    return;
  }
  await admin.from("viva_whatsapp_links").delete().or(`wa_id.eq.${msg.from},user_id.eq.${row.user_id}`);
  const { error } = await admin.from("viva_whatsapp_links").insert({ user_id: row.user_id, wa_id: msg.from, profile_name: msg.profileName || null, history: [], pending: null });
  if (error) { console.error("VIVA WhatsApp link failed", error); await sendText(msg.from, "Não consegui conectar agora. Tente gerar um novo código."); return; }
  await admin.from("viva_whatsapp_link_codes").delete().eq("user_id", row.user_id);
  await admin.from("viva_whatsapp_leads").update({ converted_user_id: row.user_id }).eq("wa_id", msg.from);
  await sendText(msg.from, "✅ *WhatsApp conectado à sua conta VIVA+!*\n\n" + helpText(msg.profileName));
}

// ---------------------------------------------------------------- conversa
async function converse(admin: Admin, link: Link, msg: Inbound, text: string) {
  const to = msg.from;
  const history: HistoryItem[] = Array.isArray(link.history) ? link.history.slice(-12) : [];
  const pending = link.pending;

  // Resposta a um rascunho aguardando confirmação.
  if (pending && (text === "viva:ok" || YES.test(text))) { await confirmPending(admin, link, pending, to); return; }
  if (pending && (text === "viva:no" || NO.test(text))) {
    await admin.from("viva_whatsapp_links").update({ pending: null, updated_at: new Date().toISOString() }).eq("user_id", link.user_id);
    await sendText(to, "Tudo bem, não salvei nada. 👍");
    return;
  }
  if (text === "viva:ok" || text === "viva:no") { await sendText(to, "Esse item já foi resolvido. Pode me mandar a próxima. 💜"); return; }

  let userLine = text;
  let result: { status: number; data: ApiData };

  if (msg.type === "audio" || msg.type === "voice") {
    const media = msg.audio || msg.voice;
    const file = await downloadMedia(String(media?.id));
    const mime = file.mimeType || "audio/ogg";
    const duration = Math.min(60, Math.max(1, Math.ceil(file.buffer.length / 2500)));
    const form = new FormData();
    form.append("audio", new File([new Uint8Array(file.buffer)], `whatsapp.${mime.includes("ogg") ? "ogg" : mime.includes("mp4") || mime.includes("m4a") ? "m4a" : "mp3"}`, { type: mime }));
    form.append("duration_seconds", String(duration));
    form.append("history", JSON.stringify(history));
    form.append("requestId", `wa:${msg.id}`.slice(0, 80));
    result = await call(assistantPOST, "/api/assistant", { method: "POST", body: form });
    userLine = String(result.data.transcript || "[áudio]");
  } else if (msg.type === "image" || msg.type === "document") {
    const media = msg.image || msg.document;
    const file = await downloadMedia(String(media?.id));
    const ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" } as Record<string, string>)[file.mimeType];
    if (!ext) { await sendText(to, "Por enquanto eu leio comprovantes em foto (JPG, PNG) ou PDF. 📄"); return; }
    const path = `${link.user_id}/${crypto.randomUUID()}.${ext}`;
    const { error: upError } = await admin.storage.from("viva-receipt-temp").upload(path, file.buffer, { contentType: file.mimeType, upsert: false });
    if (upError) throw upError;
    const { data: record, error: recError } = await admin.from("viva_receipt_uploads").insert({
      user_id: link.user_id, temp_path: path, file_name: (msg.document?.filename || `whatsapp.${ext}`).slice(0, 180),
      mime_type: file.mimeType, status: "uploaded", expires_at: new Date(Date.now() + 60 * 60000).toISOString(),
    }).select("id").single();
    if (recError) { await admin.storage.from("viva-receipt-temp").remove([path]); throw recError; }
    result = await call(assistantPOST, "/api/assistant", json("POST", {
      message: text || "Analise este comprovante e prepare um lançamento editável.",
      history, feature: "photo", receiptUploadId: record.id, requestId: `wa:${msg.id}`.slice(0, 80),
    }));
    userLine = text || "[comprovante]";
  } else if (text) {
    const message = text === "viva:expense" ? "despesa" : text === "viva:income" ? "receita" : text;
    userLine = message;
    result = await call(assistantPOST, "/api/assistant", json("POST", { message, history, feature: "chat", requestId: `wa:${msg.id}`.slice(0, 80) }));
  } else {
    await sendText(to, "Ainda não entendo esse tipo de mensagem. Me manda texto, áudio ou foto do comprovante. 💜");
    return;
  }

  const reply = await respond(to, result);
  const nextHistory: HistoryItem[] = [...history, { role: "user" as const, content: userLine.slice(0, 4000) }, { ...reply.history, content: reply.history.content.slice(0, 4000) }].slice(-12);
  await admin.from("viva_whatsapp_links").update({ history: nextHistory, pending: reply.pending, last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("user_id", link.user_id);
}

// Transforma a resposta do assistente do app em mensagem de WhatsApp.
async function respond(to: string, { status, data }: { status: number; data: ApiData }): Promise<{ history: HistoryItem; pending: Pending | null }> {
  if (data.error || status >= 400) {
    const text = String(data.error || "Não consegui responder agora. Tenta de novo?");
    await sendText(to, text);
    return { history: { role: "assistant", content: text }, pending: null };
  }
  if (data.transactionDraft) {
    const d = data.transactionDraft as Record<string, unknown>;
    const head = d.kind === "income" ? "💰 *Receita*" : "💸 *Despesa*";
    const lines = [
      data.answer && !String(data.answer).startsWith("{") ? String(data.answer) : "Confira antes de salvar:",
      "",
      `${head}: *${brl(d.amount)}*`,
      `📝 ${d.description || "Sem descrição"}`,
      `🏷️ ${d.category || "Outros"} · ${d.payment_method || "—"} · ${day(d.occurred_on)}`,
    ];
    await sendButtons(to, lines.join("\n"), CONFIRM_BUTTONS);
    return { history: { role: "assistant", content: lines.join("\n") }, pending: { type: "transaction", draft: d } };
  }
  if (data.billDraft) {
    const d = data.billDraft as Record<string, unknown>;
    const rec = ({ once: "só uma vez", monthly: "todo mês", weekly: "toda semana", yearly: "todo ano" } as Record<string, string>)[String(d.recurrence)] || String(d.recurrence || "");
    const text = `Separei os dados da conta:\n\n🧾 *${d.name}* — *${brl(d.amount)}*\n📅 Vence ${day(d.due_date)} · ${rec}${Number(d.installments) > 1 ? ` · ${d.installments}x` : ""}\n🏷️ ${d.category || "Contas"}\n\nEu te lembro antes do vencimento.`;
    await sendButtons(to, text, CONFIRM_BUTTONS);
    return { history: { role: "assistant", content: text }, pending: { type: "bill", draft: d } };
  }
  if (data.eventDraft) {
    const d = data.eventDraft as Record<string, unknown>;
    const reminder = d.reminder_enabled ? `⏰ Lembrete ${Number(d.reminder_before_minutes) ? `${d.reminder_before_minutes} min antes` : "na hora"}` : "Sem lembrete";
    const text = `Separei seu compromisso:\n\n📅 *${d.title}*\n🕒 ${dateTime(d.start_at)}\n${reminder}`;
    await sendButtons(to, text, CONFIRM_BUTTONS);
    return { history: { role: "assistant", content: text }, pending: { type: "event", draft: d } };
  }
  if (data.profileDraft) {
    const d = data.profileDraft as Record<string, unknown>;
    const text = String(data.answer || `Quer que eu atualize ${String(d.label || "seu perfil").toLowerCase()} para ${d.display}?`);
    await sendButtons(to, text, [{ id: "viva:ok", title: "✅ Atualizar" }, { id: "viva:no", title: "Agora não" }]);
    return { history: { role: "assistant", content: text }, pending: { type: "profile", draft: d } };
  }
  if (data.clarification) {
    const text = String(data.clarificationPrompt || "Você quer registrar isso como despesa ou receita?");
    await sendButtons(to, text, [{ id: "viva:expense", title: "💸 Despesa" }, { id: "viva:income", title: "💰 Receita" }]);
    return { history: { role: "assistant", content: text, clarification: data.clarification as Clarification }, pending: null };
  }
  if (data.purchaseDecision) {
    const p = data.purchaseDecision as Record<string, unknown>;
    const numbers = [
      `Valor da compra: ${brl(p.purchase_total)}`,
      `Contas que ainda vencem: ${brl(p.bills_remaining)}`,
      `Saldo previsto depois: ${brl(p.forecast_balance_after)}`,
      Number(p.goal_delay_weeks) > 0 ? `Atraso na sua meta: +${p.goal_delay_weeks} semana(s)` : "",
      p.daily_remaining_after != null ? `Pra gastar por dia depois: ${brl(p.daily_remaining_after)}` : "",
    ].filter(Boolean);
    const parts = [`🧮 *${p.verdict}*`, numbers.join("\n"), String(data.answer || "").trim(), "_A VIVA ajuda na organização e não substitui um profissional financeiro._"].filter(Boolean);
    const text = parts.join("\n\n");
    await sendText(to, text);
    return { history: { role: "assistant", content: text }, pending: null };
  }
  const action = data.action as { href?: string; label?: string } | undefined;
  let text = String(data.answer || "Prontinho. 💜");
  if (action?.href) text += `\n\n👉 ${action.label || "Abrir no app"}: ${action.href.startsWith("http") ? action.href : appUrl() + action.href}`;
  await sendText(to, text);
  return { history: { role: "assistant", content: text }, pending: null };
}

async function confirmPending(admin: Admin, link: Link, pending: Pending, to: string) {
  await admin.from("viva_whatsapp_links").update({ pending: null, updated_at: new Date().toISOString() }).eq("user_id", link.user_id);
  const d = pending.draft;
  let reply = "Salvo! 💜";
  if (pending.type === "transaction") {
    const { status, data } = await call(transactionsPOST, "/api/transactions", json("POST", { ...d, source: "viva", isReceipt: Boolean(d.isReceipt), receiptUploadId: d.receiptUploadId }));
    reply = status >= 400 ? String(data.error || "Não consegui salvar o lançamento.") : `✅ ${data.message || "Lançamento salvo."}`;
  } else if (pending.type === "bill") {
    const { status, data } = await call(billsPOST, "/api/bills", json("POST", d));
    reply = status >= 400 ? String(data.error || "Não consegui salvar a conta.") : `✅ ${data.message || "Conta cadastrada."} Eu te aviso antes de vencer.`;
  } else if (pending.type === "profile") {
    const { status, data } = await call(myDataPATCH, "/api/my-data", json("PATCH", { field: d.field, value: d.value }));
    reply = status >= 400 ? String(data.error || "Não consegui atualizar seu perfil.") : "✅ Perfil atualizado.";
  } else if (pending.type === "event") {
    const s = await createClient();
    const { error } = await s.from("viva_events").insert({
      user_id: link.user_id, title: d.title, start_at: d.start_at, description: d.description || "",
      reminder_enabled: Boolean(d.reminder_enabled), reminder_before_minutes: Number(d.reminder_before_minutes || 0), reminder_at_start: Boolean(d.reminder_at_start),
    });
    reply = error ? "Não consegui salvar o compromisso. Tenta de novo pelo app?" : `✅ Compromisso salvo: *${d.title}* (${dateTime(d.start_at)}).`;
    if (error) console.error("VIVA WhatsApp event insert failed", error);
  }
  await sendText(to, reply);
}
