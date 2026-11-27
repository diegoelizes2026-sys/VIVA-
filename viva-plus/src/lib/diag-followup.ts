// Acompanhamento automático dos leads do Diagnóstico Financeiro no WhatsApp (API oficial da Meta).
// Regras: só quem marcou o consentimento; modelos aprovados para iniciar conversa; 9h–20h (Fortaleza);
// no máximo 1 automática por dia; para na hora com SAIR/PARAR, ao criar conta ou com a pausa geral.
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;
type Goal = "dividas" | "reserva" | "comprar" | "organizar";
export type DiagTemplate = { name: string; step: 1 | 2 | 3 | 4; goal?: Goal; category: "MARKETING"; body: string };

const SITE = "vivamaiss.app.br/cadastro";
const OUT = "Para não receber mais, responda SAIR.";
/** Textos dos modelos (cadastrar iguais na Meta, idioma pt_BR, variável {{1}} = primeiro nome). */
export const DIAG_TEMPLATES: DiagTemplate[] = [
  { name: "viva_diag_boas_vindas", step: 1, category: "MARKETING", body: `Oi, {{1}}! Aqui é a VIVA, assistente virtual do VIVA+. Seu diagnóstico está pronto. Quer ajuda para dar o primeiro passo? ${OUT}` },
  { name: "viva_diag_dia1_dividas", step: 2, goal: "dividas", category: "MARKETING", body: `Oi, {{1}}! Uma dica para quem quer sair das dívidas: anote todas com valor e juros e comece pelas de juros mais altos, como cartão e cheque especial. Se quiser, a VIVA te ajuda a montar um plano no seu ritmo. A conta é grátis: ${SITE}. ${OUT}` },
  { name: "viva_diag_dia1_reserva", step: 2, goal: "reserva", category: "MARKETING", body: `Oi, {{1}}! Uma dica para criar sua reserva: separe um valor assim que o dinheiro cair, mesmo que pequeno. Guardar primeiro costuma funcionar melhor do que esperar sobrar. A VIVA acompanha sua meta com você. A conta é grátis: ${SITE}. ${OUT}` },
  { name: "viva_diag_dia1_comprar", step: 2, goal: "comprar", category: "MARKETING", body: `Oi, {{1}}! Uma dica para a sua compra: defina o preço e o prazo e divida pelo número de meses. Assim você sabe quanto guardar por mês e evita juros. A VIVA acompanha essa meta com você. A conta é grátis: ${SITE}. ${OUT}` },
  { name: "viva_diag_dia1_organizar", step: 2, goal: "organizar", category: "MARKETING", body: `Oi, {{1}}! Uma dica para organizar o mês: anote os gastos por 7 dias, até os pequenos. Ver para onde o dinheiro vai já ajuda a decidir o que manter. A VIVA faz isso com você pelo WhatsApp. A conta é grátis: ${SITE}. ${OUT}` },
  { name: "viva_diag_dia3", step: 3, category: "MARKETING", body: `Oi, {{1}}! Sabe o número do dia? É quanto você pode gastar hoje sem faltar dinheiro até o salário. A VIVA calcula isso todo dia e te avisa aqui no WhatsApp. Você pode testar o Pro grátis por 7 dias, sem cartão e sem senha de banco: ${SITE}. ${OUT}` },
  { name: "viva_diag_dia7", step: 4, category: "MARKETING", body: `Oi, {{1}}! Passando só para lembrar: seu diagnóstico continua guardado e a conta no VIVA+ é grátis, sem cartão. Se fizer sentido para você, é só entrar em ${SITE}. Esta é a última mensagem desta série. ${OUT}` },
];
export function templateFor(step: number, goal: Goal) {
  return DIAG_TEMPLATES.find(t => t.step === step && (!t.goal || t.goal === goal));
}
const firstName = (n: string) => (n.trim().split(/\s+/)[0] || "tudo bem").slice(0, 30);
export const renderTemplate = (t: DiagTemplate, name: string) => t.body.replace("{{1}}", firstName(name));

// ---- Horário ----
const TZ = "America/Fortaleza"; // UTC-3, sem horário de verão
const OFFSET_H = 3;
function localParts(d: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map(x => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute) };
}
const atLocal = (day: string, hour: number, minute = 0) => { const [y, m, d] = day.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d, hour + OFFSET_H, minute)); };
const addDays = (day: string, n: number) => { const [y, m, d] = day.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
export const inWindow = (d = new Date()) => { const h = localParts(d).hour; return h >= 9 && h < 20; };
/** Primeiro horário permitido a partir de `d` (9h–20h). */
export function nextWindow(d: Date) {
  const { day, hour } = localParts(d);
  if (hour < 9) return atLocal(day, 9, 30);
  if (hour >= 20) return atLocal(addDays(day, 1), 9, 30);
  return d;
}
/** Dia 1, 3 e 7 depois do cadastro, às 10h (ou no próximo horário permitido). */
function scheduleFor(step: number, createdAt: Date) {
  const offset = step === 2 ? 1 : step === 3 ? 3 : step === 4 ? 7 : 0;
  return nextWindow(atLocal(addDays(localParts(createdAt).day, offset), 10));
}

// ---- Envio pela API oficial ----
const GRAPH = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
export async function sendTemplate(to: string, t: DiagTemplate, name: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const token = process.env.WHATSAPP_TOKEN, phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return { ok: false, error: "WHATSAPP_TOKEN ou WHATSAPP_PHONE_NUMBER_ID não configurado" };
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH}/${phoneId}/messages`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template", template: { name: t.name, language: { code: "pt_BR" }, components: [{ type: "body", parameters: [{ type: "text", text: firstName(name) }] }] } }),
    });
    const j = await res.json().catch(() => ({})) as { messages?: { id?: string }[]; error?: { message?: string; code?: number } };
    if (!res.ok) return { ok: false, error: `${j.error?.code ?? res.status}: ${j.error?.message ?? "erro"}`.slice(0, 480) };
    return { ok: true, id: String(j.messages?.[0]?.id || "") };
  } catch (e) { return { ok: false, error: (e instanceof Error ? e.message : "falha de rede").slice(0, 480) }; }
}

export async function diagSettings(admin: Admin) {
  const { data } = await admin.from("viva_diag_settings").select("followup_paused,test_whatsapp").eq("id", true).maybeSingle();
  return { paused: data?.followup_paused !== false, testWhatsapp: (data?.test_whatsapp as string | null) ?? null };
}

/** Se a pessoa já criou conta (WhatsApp ligado a uma conta), marca como convertida e para os convites. */
async function checkConverted(admin: Admin, lead: { id: string; whatsapp: string }) {
  const { data } = await admin.from("viva_whatsapp_links").select("user_id").eq("wa_id", lead.whatsapp).maybeSingle();
  if (!data?.user_id) return false;
  await admin.from("viva_diag_leads").update({ followup_status: "converted", converted_user_id: data.user_id, converted_at: new Date().toISOString(), next_send_at: null, updated_at: new Date().toISOString() }).eq("id", lead.id);
  return true;
}

/** Envia o próximo passo da sequência, se for a hora. Devolve o que aconteceu (para o painel e os logs). */
export async function processDiagLead(admin: Admin, id: string, now = new Date()): Promise<string> {
  const settings = await diagSettings(admin);
  if (settings.paused) return "pausado";
  const { data: lead } = await admin.from("viva_diag_leads").select("id,name,whatsapp,goal,created_at,marketing_opt_in,consent_at,followup_status,followup_step,next_send_at,last_sent_at,opted_out_at,converted_at").eq("id", id).maybeSingle();
  if (!lead) return "não encontrado";
  if (!lead.marketing_opt_in || !lead.consent_at || lead.opted_out_at || lead.converted_at) return "sem permissão";
  if (!["pending", "active"].includes(lead.followup_status)) return "encerrado";
  if (await checkConverted(admin, lead)) return "criou conta";
  if (lead.next_send_at && new Date(lead.next_send_at) > now) return "aguardando";
  if (!inWindow(now)) { await admin.from("viva_diag_leads").update({ next_send_at: nextWindow(now).toISOString() }).eq("id", id); return "fora do horário"; }
  if (lead.last_sent_at && localParts(new Date(lead.last_sent_at)).day === localParts(now).day) {
    await admin.from("viva_diag_leads").update({ next_send_at: atLocal(addDays(localParts(now).day, 1), 10).toISOString() }).eq("id", id); return "já enviou hoje";
  }
  const step = Number(lead.followup_step) + 1;
  if (step > 4) { await admin.from("viva_diag_leads").update({ followup_status: "done", next_send_at: null }).eq("id", id); return "concluído"; }
  const t = templateFor(step, lead.goal as Goal);
  if (!t) return "sem modelo";
  const sent = await sendTemplate(lead.whatsapp, t, lead.name);
  const body = renderTemplate(t, lead.name);
  await admin.from("viva_diag_messages").insert({ lead_id: id, direction: "out", kind: "template", step, body, status: sent.ok ? "sent" : "failed", wa_message_id: sent.ok ? sent.id : null, error: sent.ok ? null : sent.error });
  if (!sent.ok) {
    // Tenta de novo no dia seguinte; o erro fica visível no painel.
    await admin.from("viva_diag_leads").update({ next_send_at: atLocal(addDays(localParts(now).day, 1), 10).toISOString(), updated_at: now.toISOString() }).eq("id", id);
    return "falhou: " + sent.error;
  }
  const created = new Date(lead.created_at);
  await admin.from("viva_diag_leads").update({
    followup_step: step, last_sent_at: now.toISOString(), updated_at: now.toISOString(),
    followup_status: step >= 4 ? "done" : "active", next_send_at: step >= 4 ? null : scheduleFor(step + 1, created).toISOString(),
  }).eq("id", id);
  return "enviado passo " + step;
}

/** Executado pela tarefa agendada: processa os leads com envio vencido. */
export async function runDiagFollowup(admin: Admin, now = new Date()) {
  const settings = await diagSettings(admin);
  if (settings.paused) return { paused: true, processed: 0 };
  if (!inWindow(now)) return { paused: false, processed: 0, outside: true };
  const { data } = await admin.from("viva_diag_leads").select("id").in("followup_status", ["pending", "active"]).eq("marketing_opt_in", true)
    .lte("next_send_at", now.toISOString()).order("next_send_at").limit(60);
  const results: Record<string, number> = {};
  for (const r of data || []) { const out = await processDiagLead(admin, String(r.id), now); const k = out.startsWith("falhou") ? "falhou" : out; results[k] = (results[k] || 0) + 1; }
  return { paused: false, processed: (data || []).length, results };
}

// ---- Respostas da pessoa ----
/** SAIR, PARAR, STOP, "não quero mais receber" etc., em qualquer formato. */
export function isOptOut(text: string) {
  const t = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  if (!t) return false;
  if (/^\W*(sair|sai|parar|para|pare|stop|cancelar|cancela|cancele|descadastrar|descadastre|remover|remove|unsubscribe|chega|bloquear)\W*$/.test(t)) return true;
  if (t.length <= 60 && /\b(sair|parar|pare|stop|descadastr\w*|unsubscribe)\b/.test(t)) return true;
  return /\bnao\s+(quero|desejo|preciso)\s+(mais\s+)?(receber|mensage|contato)|\b(para|pare|parem)\s+de\s+(me\s+)?(mandar|enviar)|\bnao\s+me\s+(mande|envie|chame)|\bme\s+(tira|tire|remova|remove)\b/.test(t);
}
export const isDeleteRequest = (text: string) => /^\W*(apagar|apague|excluir|exclua|deletar)(\s+(meus\s+)?dados)?\W*$/i.test(text.normalize("NFD").replace(/[̀-ͯ]/g, "").trim());
