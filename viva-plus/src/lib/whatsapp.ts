import { createHmac, createHash, timingSafeEqual } from "node:crypto";

// Número oficial da VIVA no WhatsApp (só dígitos, com DDI). Pode ser trocado pela variável de ambiente.
export const WHATSAPP_PUBLIC_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "558588252048").replace(/\D/g, "");
export const SITE_URL = "https://www.vivamaiss.app.br";
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";

export function whatsappLinkUrl(code: string) {
  return `https://wa.me/${WHATSAPP_PUBLIC_NUMBER}?text=${encodeURIComponent(`Conectar VIVA ${code}`)}`;
}

/** Confere a assinatura X-Hub-Signature-256 que a Meta manda em cada webhook. */
export function validSignature(rawBody: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = Buffer.from("sha256=" + createHmac("sha256", secret).update(rawBody, "utf8").digest("hex"));
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/** Chave de idempotência aceita pela VIVA (letras, números, _ e -). */
export function requestKeyFor(messageId: string) {
  return "wa_" + createHash("sha256").update(messageId).digest("hex").slice(0, 40);
}

/** Markdown do app (**negrito**) para o formato do WhatsApp (*negrito*), dentro do limite de tamanho. */
export function toWhatsappText(text: string) {
  return text.replace(/\*\*(.+?)\*\*/g, "*$1*").replace(/^#{1,6}\s*/gm, "").trim().slice(0, 4000);
}

export async function sendWhatsappText(to: string, body: string) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) { console.error("VIVA WhatsApp: WHATSAPP_TOKEN ou WHATSAPP_PHONE_NUMBER_ID não configurado"); return false; }
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: true, body: toWhatsappText(body) } }),
  });
  if (!res.ok) { console.error("VIVA WhatsApp send failed", res.status, (await res.text()).slice(0, 500)); return false; }
  console.log("VIVA WhatsApp: resposta enviada");
  return true;
}

// Link de conexão com um toque, enviado pela VIVA no próprio WhatsApp (assinado, vale 1 hora).
const CONNECT_TTL_MS = 60 * 60 * 1000;
function connectSignature(payload: string) {
  return createHmac("sha256", process.env.WHATSAPP_APP_SECRET || "").update("connect:" + payload).digest("base64url").slice(0, 32);
}
export function connectUrlFor(waId: string) {
  const payload = `${waId.replace(/\D/g, "")}.${Date.now() + CONNECT_TTL_MS}`;
  return `${SITE_URL}/whatsapp/conectar?t=${payload}.${connectSignature(payload)}`;
}
export function readConnectToken(token: string | null | undefined) {
  const match = /^(\d{8,15})\.(\d{13})\.([A-Za-z0-9_-]{32})$/.exec(token || "");
  if (!match || !process.env.WHATSAPP_APP_SECRET) return null;
  const expected = Buffer.from(connectSignature(`${match[1]}.${match[2]}`));
  const received = Buffer.from(match[3]);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  if (Number(match[2]) < Date.now()) return null;
  return match[1];
}

/** Tudo o que a VIVA faz pelo WhatsApp (enviado ao conectar, ao assinar e quando a pessoa pede "ajuda"). */
export function featuresMessage(planName?: string | null, lang: "pt" | "en" = "pt") {
  if (lang === "en") return featuresMessageEn(planName);
  return `${planName ? `Seu plano *${planName}* está ativo e ` : "Seu WhatsApp está conectado e "}a VIVA no WhatsApp está liberada! ✅\n\nOlha tudo que eu faço por aqui:\n\n💸 *Anotar gastos e entradas*\n“gastei 35 na farmácia” · “lanche 20” · “recebi 1500 de salário”\n\n🎤 *Áudio*\nManda um áudio falando o gasto que eu entendo\n\n🧾 *Foto do comprovante*\nManda a foto (ou PDF) que eu leio e anoto\n\n🍽️ *Diário de saúde*\n“almocei arroz, feijão e frango” · manda a *foto do prato* · “bebi 2 copos de água” · “corri 30 min” · “quanto posso comer hoje?”\n\n📊 *Quanto posso gastar*\n“quanto posso gastar hoje?”\n\n🧾 *Contas a pagar*\n“o que vence essa semana?” · “conta de luz 180 dia 10”\n\n💳 *Sair das dívidas*\n“me ajuda a quitar minhas dívidas”\n\n🎯 *Planejamento e metas*\n“quero juntar 2 mil até dezembro”\n\n📊 *Relatórios* (não gastam créditos)\n“relatório da semana” · “relatório do mês”\n\n🛒 *Antes de comprar*\n“vale a pena comprar uma TV de 2 mil?”\n\n📅 *Agenda e lembretes*\n“dentista sexta às 15h”\n\n*Comandos:*\n• *desfazer* — apaga o último lançamento (até 15 min)\n• *ajuda* — mostra esta lista de novo\n• *desconectar* — desliga este WhatsApp da conta\n\nRadar de preços, Personal e o diário completo você usa no app: ${SITE_URL}/meu-dia`;
}

/** Mensagens grátis por semana na VIVA no WhatsApp para quem está no plano Free. */
export const WHATSAPP_FREE_WEEKLY = 10;

/** Quem está no Free: a VIVA funciona no WhatsApp com limite semanal. */
export const FREE_WHATSAPP_NOTE = `🎁 No plano *Free* você tem *${WHATSAPP_FREE_WEEKLY} mensagens por semana* comigo aqui, com *5 áudios* e *3 fotos* (comprovante ou prato) grátis por mês. Água, exercício e saldo de calorias não contam no limite. Para usar sem limite, teste o Pro grátis por 7 dias (sem cartão): ${SITE_URL}/planos`;

/** Free que usou todas as mensagens da semana. */
export function freeLimitMessage(resetsOn?: string | null, lang: "pt" | "en" = "pt") {
  if (lang === "en") { const when = resetsOn && /^\d{4}-\d{2}-\d{2}$/.test(resetsOn) ? ` They come back on Monday (${resetsOn.slice(5, 7)}/${resetsOn.slice(8, 10)}).` : " They come back on Monday."; return `You used your *${WHATSAPP_FREE_WEEKLY} free messages* with me this week. 💜${when}\n\nTo keep going now with no limit, try *Pro free for 7 days* (no card) or pick a plan:\n${SITE_URL}/planos?whatsapp=assinar\n\nIn the app you can keep logging expenses for free: ${SITE_URL}/meu-dia`; }
  const when = resetsOn && /^\d{4}-\d{2}-\d{2}$/.test(resetsOn) ? ` Elas voltam na segunda (${resetsOn.slice(8, 10)}/${resetsOn.slice(5, 7)}).` : " Elas voltam na segunda-feira.";
  return `Você usou suas *${WHATSAPP_FREE_WEEKLY} mensagens grátis* desta semana comigo no WhatsApp. 💜${when}\n\nPara continuar agora, sem limite, teste o *Pro grátis por 7 dias* (sem cartão) ou escolha um plano:\n${SITE_URL}/planos?whatsapp=assinar\n\nNo app você continua anotando gastos à vontade: ${SITE_URL}/meu-dia`;
}

/** Rodapé quando estão acabando as mensagens grátis da semana. */
export function freeLeftFooter(left: number, lang: "pt" | "en" = "pt") {
  if (left > 3) return "";
  if (lang === "en") return left <= 0 ? `\n\n_That was your last free message this week. No limit on Pro: ${SITE_URL}/planos_` : `\n\n_${left} free ${left === 1 ? "message" : "messages"} left this week. No limit on Pro: ${SITE_URL}/planos_`;
  return left <= 0
    ? `\n\n_Essa foi sua última mensagem grátis da semana. Sem limite no Pro: ${SITE_URL}/planos_`
    : `\n\n_Restam ${left} ${left === 1 ? "mensagem grátis" : "mensagens grátis"} nesta semana. Sem limite no Pro: ${SITE_URL}/planos_`;
}

/** Mensagem para quem fala com a VIVA sem conta conectada. */
export function notLinkedMessage(connectUrl: string, lang: "pt" | "en" = "pt") {
  if (lang === "en") return `Hi! 👋 I'm VIVA+, your assistant for money and health.\n\nIt's *free* to start and takes 2 minutes:\n\n1️⃣ Create your account:\n${SITE_URL}/cadastro\n2️⃣ Come back here and send me *hi*\n\n*Already have an account?* Tap the link to connect this WhatsApp (valid for 1 hour):\n${connectUrl}`;
  return `Oi! 👋 Eu sou a VIVA+, sua assistente para o mês não acabar antes do salário.\n\nÉ *grátis* para começar e leva 2 minutos:\n\n1️⃣ Crie sua conta no site:\n${SITE_URL}/cadastro\n2️⃣ Volte aqui e me mande um *oi*\n\n*Já tem conta?* Toque no link para conectar este WhatsApp (vale 1 hora):\n${connectUrl}`;
}

export type WhatsappPlan = { planId: string; planName: string };
/** Plano pago (ou teste do Pro) ativo da pessoa — sem ele, a VIVA no WhatsApp funciona com o limite do Free. */
export async function activeWhatsappPlan(admin: AdminClient, userId: string): Promise<WhatsappPlan | null> {
  const { data, error } = await admin.from("viva_subscriptions").select("plan_id")
    .eq("user_id", userId).in("status", ["active", "trialing"]).neq("plan_id", "free")
    .gt("current_period_end", new Date().toISOString())
    .order("current_period_end", { ascending: false }).limit(1).maybeSingle();
  if (error) { console.error("VIVA WhatsApp plan lookup", error); return null; }
  if (!data?.plan_id) return null;
  const { data: plan } = await admin.from("viva_plans").select("name").eq("id", data.plan_id).maybeSingle();
  return { planId: String(data.plan_id), planName: String(plan?.name || data.plan_id) };
}

/** Depois que o plano é ativado: se a pessoa já ligou o WhatsApp, avisa e lembra todas as funções. Nunca lança erro. */
export async function notifyWhatsappPlanActive(admin: AdminClient, userId: string) {
  try {
    const { data: link } = await admin.from("viva_whatsapp_links").select("wa_id").eq("user_id", userId).maybeSingle();
    if (!link?.wa_id) return;
    const plan = await activeWhatsappPlan(admin, userId);
    if (plan) await sendWhatsappText(link.wa_id, featuresMessage(plan.planName));
  } catch (error) { console.error("VIVA WhatsApp plan notice", error); }
}

/** Mensagem enviada logo após ligar o número à conta (com ou sem plano). */
export async function welcomeAfterLink(admin: AdminClient, userId: string, waId: string) {
  const plan = await activeWhatsappPlan(admin, userId);
  await sendWhatsappText(waId, plan ? featuresMessage(plan.planName) : `${featuresMessage()}\n\n${FREE_WHATSAPP_NOTE}`);
  return plan;
}

type AdminClient = { from: (table: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
/** Liga o número de WhatsApp à conta (um número só pode estar ligado a uma conta). */
export async function linkWhatsapp(admin: AdminClient, userId: string, waId: string) {
  const now = new Date().toISOString();
  await admin.from("viva_whatsapp_links").update({ wa_id: null, linked_at: null, history: [], updated_at: now }).eq("wa_id", waId).neq("user_id", userId);
  const { error } = await admin.from("viva_whatsapp_links").upsert({ user_id: userId, wa_id: waId, linked_at: now, link_code: null, code_expires_at: null, history: [], updated_at: now }, { onConflict: "user_id" });
  if (error) throw error;
}

export function brl(value: number) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Baixa um áudio/foto enviado no WhatsApp (2 passos na API da Meta: endereço do arquivo e depois o arquivo). */
export async function downloadWhatsappMedia(mediaId: string, maxBytes = 5 * 1024 * 1024): Promise<{ buffer: Buffer; mime: string } | { error: "too_big" | "failed" }> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token || !/^\d+$/.test(mediaId)) return { error: "failed" };
  try {
    const meta = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!meta.ok) { console.error("VIVA WhatsApp media meta", meta.status, (await meta.text()).slice(0, 300)); return { error: "failed" }; }
    const info = (await meta.json()) as { url?: string; mime_type?: string; file_size?: number };
    if (!info.url) return { error: "failed" };
    if (Number(info.file_size || 0) > maxBytes) return { error: "too_big" };
    const file = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!file.ok) { console.error("VIVA WhatsApp media download", file.status); return { error: "failed" }; }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > maxBytes) return { error: "too_big" };
    return { buffer, mime: String(info.mime_type || file.headers.get("content-type") || "").split(";")[0].trim().toLowerCase() };
  } catch (e) {
    console.error("VIVA WhatsApp media", e);
    return { error: "failed" };
  }
}

/** Duração de um áudio OGG/Opus (os áudios de voz do WhatsApp), lendo a última página do arquivo. */
export function oggDurationSeconds(buffer: Buffer): number | null {
  const at = buffer.lastIndexOf(Buffer.from("OggS"));
  if (at < 0 || at + 14 > buffer.length) return null;
  const granule = Number(buffer.readBigUInt64LE(at + 6));
  if (!Number.isFinite(granule) || granule <= 0) return null;
  return granule / 48000;
}

/** Free no WhatsApp, em inglês. */
export const FREE_WHATSAPP_NOTE_EN = `🎁 On the *Free* plan you get *${WHATSAPP_FREE_WEEKLY} messages a week* with me here, plus *5 voice notes* and *3 photos* (receipt or meal) free each month. Water, exercise and calorie checks don't count toward the limit. For no limit, try Pro free for 7 days (no card): ${SITE_URL}/planos`;

/** Tudo o que a VIVA faz pelo WhatsApp, em inglês. Valores continuam em reais. */
function featuresMessageEn(planName?: string | null) {
  return `${planName ? `Your *${planName}* plan is active and ` : "Your WhatsApp is connected and "}VIVA on WhatsApp is on! ✅\n\nHere's what I can do:\n\n💸 *Log expenses and income*\n“spent 35 at the pharmacy” · “lunch 20” · “got 1500 salary”\n\n🎤 *Voice notes*\nSend a voice note in English or Portuguese\n\n🧾 *Receipt photo*\nSend the photo (or PDF) and I'll log it\n\n🍽️ *Health diary*\n“I had rice, beans and chicken for lunch” · send a *photo of your meal* · “drank 2 glasses of water” · “ran 30 min” · “how many calories left?”\n\n📊 *How much can I spend*\n“how much can I spend today?”\n\n🧾 *Bills*\n“what's due this week?” · “electricity bill 180 on the 10th”\n\n🎯 *Goals and planning*\n“I want to save 2,000 by December”\n\n📊 *Reports* (free, no credits)\n“weekly report” · “monthly report”\n\n*Commands:*\n• *undo* — deletes the last entry (up to 15 min)\n• *help* — shows this list again\n• *disconnect* — unlinks this WhatsApp\n\nAmounts are in Brazilian reais (R$). Price radar, Personal trainer and the full diary are in the app: ${SITE_URL}/meu-dia`;
}
