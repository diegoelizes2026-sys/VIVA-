// Respostas da VIVA para quem veio do diagnóstico e ainda não tem conta (assistente virtual, só informações reais).
import OpenAI from "openai";
import type { createAdminClient } from "@/lib/supabase/admin";
import { isDeleteRequest, isOptOut } from "@/lib/diag-followup";

type Admin = ReturnType<typeof createAdminClient>;
const SITE = "https://www.vivamaiss.app.br";
const DAILY_AI_LIMIT = 15;
const HUMAN = "[ATENDENTE]";

async function facts(admin: Admin) {
  const { data } = await admin.rpc("viva_public_pricing");
  const plans = ((data as { name: string; monthly_price_brl: number; annual_price_brl: number; monthly_credits: number }[] | null) || [])
    .map(p => `- ${p.name}: ${Number(p.monthly_price_brl) === 0 ? "grátis" : `R$ ${Number(p.monthly_price_brl).toFixed(2).replace(".", ",")}/mês${Number(p.annual_price_brl) > 0 ? ` ou R$ ${Number(p.annual_price_brl).toFixed(2).replace(".", ",")}/ano` : ""}`}, ${p.monthly_credits} créditos de IA por mês`).join("\n");
  return `FATOS DO VIVA+ (use só isto; não invente nada):
- VIVA+ (Vivamais) é um app com assistente de IA (a VIVA) que diz quanto a pessoa pode gastar por dia sem faltar dinheiro até o salário ("número do dia").
- Anota gastos e entradas por mensagem, áudio ou foto do comprovante, avisa antes das contas vencerem, ajuda com metas e com plano para sair das dívidas.
- Funciona no WhatsApp e no app pelo navegador do celular. Não pede senha de banco nem acesso à conta bancária.
- VIVA Saúde: diário de calorias com foto do prato, água, treinos, Personal com IA e Radar Fitness com personais e academias credenciados.
- Quem faz o diagnóstico em ${SITE}/diagnostico vê uma promoção do Pro por R$ 19,90/mês que vale por tempo limitado (preço normal R$ 29,90). Toda assinatura tem garantia de 7 dias: reembolso de 100% sem perguntas. Não ofereça teste grátis e não prometa o preço promocional fora do prazo.
- No plano grátis, a VIVA no WhatsApp tem 10 mensagens por semana.
- Planos:
${plans || "- (consultar em " + SITE + "/planos)"}
- Pagamentos por Pix ou cartão via Mercado Pago. Indicação: R$ 10 por amigo que assinar o Pro.
- Suporte humano: pela equipe do VIVA+ neste mesmo WhatsApp.`;
}

const RULES = `Você é a VIVA, ASSISTENTE VIRTUAL do VIVA+ (deixe isso claro na primeira resposta da conversa). Fale em português do Brasil, de forma curta (até 4 frases), gentil e sem pressão.
A pessoa fez o Diagnóstico Financeiro Grátis no site e ainda não tem conta.
Regras: responda só com os FATOS abaixo e o diagnóstico dela. Não prometa resultados, ganhos ou quitação de dívidas. Não assuste, não julgue e não exponha valores de dívidas. Não dê orientação de investimento, jurídica ou de crédito.
Não peça senha, CPF, cartão nem dados bancários. Se ela quiser criar conta, mande o link ${SITE}/cadastro.
Se você não souber a resposta, se for reclamação, cobrança, problema de pagamento ou se ela pedir para falar com uma pessoa, responda que vai chamar alguém da equipe e termine a mensagem com ${HUMAN}.
Lembre que ela pode responder SAIR para não receber mais mensagens, só se for a primeira resposta da conversa.`;

export type LeadReply = { handled: boolean; reply?: string };

/** Trata a mensagem de alguém do diagnóstico (sem conta). Devolve handled=false se o número não é lead. */
export async function handleLeadMessage(admin: Admin, waId: string, text: string, hasMedia: boolean): Promise<LeadReply> {
  const { data: lead } = await admin.from("viva_diag_leads").select("id,name,answers,result,goal,opted_out_at,replies_count,ai_day,ai_replies_day").eq("whatsapp", waId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!lead) return { handled: false };
  const now = new Date();
  const log = (direction: "in" | "out", kind: "text" | "ai" | "system", body: string, status: "received" | "sent") =>
    admin.from("viva_diag_messages").insert({ lead_id: lead.id, direction, kind, body: body.slice(0, 4000), status });

  if (text && isDeleteRequest(text)) {
    await admin.from("viva_diag_leads").delete().eq("whatsapp", waId);
    return { handled: true, reply: "Pronto. Apagamos seu nome, WhatsApp e as respostas do diagnóstico. Se quiser fazer de novo, é só acessar " + SITE + "/diagnostico" };
  }
  await log("in", "text", text || "[mídia]", "received");
  await admin.from("viva_diag_leads").update({ replies_count: Number(lead.replies_count) + 1, last_reply_at: now.toISOString(), updated_at: now.toISOString() }).eq("id", lead.id);

  if (text && isOptOut(text)) {
    await admin.from("viva_diag_leads").update({ followup_status: "opted_out", opted_out_at: now.toISOString(), opt_out_text: text.slice(0, 300), next_send_at: null, marketing_opt_in: false }).eq("whatsapp", waId);
    const reply = "Pronto, você não vai mais receber mensagens automáticas do VIVA+. Se quiser apagar seus dados, responda APAGAR.";
    await log("out", "system", reply, "sent");
    return { handled: true, reply };
  }
  if (hasMedia && !text) {
    const reply = "Oi! Aqui é a VIVA, assistente virtual do VIVA+. Por aqui eu leio só texto. Para mandar fotos e áudios, crie sua conta grátis: " + SITE + "/cadastro";
    await log("out", "system", reply, "sent");
    return { handled: true, reply };
  }
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(now);
  const used = lead.ai_day === day ? Number(lead.ai_replies_day) : 0;
  if (used >= DAILY_AI_LIMIT || !process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL_CHEAP) {
    await admin.from("viva_diag_leads").update({ needs_human: true }).eq("id", lead.id);
    const reply = "Recebi sua mensagem! Uma pessoa da equipe do VIVA+ vai te responder por aqui. Se preferir, crie sua conta grátis: " + SITE + "/cadastro";
    await log("out", "system", reply, "sent");
    return { handled: true, reply };
  }
  const { data: hist } = await admin.from("viva_diag_messages").select("direction,kind,body").eq("lead_id", lead.id).in("kind", ["text", "ai", "template"]).order("created_at", { ascending: false }).limit(10);
  const firstReply = !(hist || []).some(h => h.kind === "ai");
  const r = lead.result as { level?: string; daily?: number | null; leftoverPct?: number };
  const diag = `DIAGNÓSTICO DELA: faixa ${r.level === "caminho" ? "No caminho certo" : r.level === "construcao" ? "Em construção" : "Atenção"}; objetivo: ${lead.goal}; ${r.daily != null ? `número do dia estimado R$ ${Number(r.daily).toFixed(2).replace(".", ",")}` : "contas fixas acima da renda"}. Nome: ${String(lead.name).split(" ")[0]}.`;
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const history = (hist || []).reverse().slice(0, -1).map(h => ({ role: h.direction === "in" ? "user" as const : "assistant" as const, content: String(h.body).slice(0, 1200) }));
    const res = await client.responses.create({ model: process.env.OPENAI_MODEL_CHEAP.trim(), instructions: RULES + (firstReply ? "" : "\nNão repita que é assistente virtual nem o aviso de SAIR.") + "\n\n" + (await facts(admin)) + "\n\n" + diag, input: [...history, { role: "user" as const, content: text.slice(0, 1500) }], max_output_tokens: 350 });
    let reply = (res.output_text || "").trim();
    const human = reply.includes(HUMAN);
    reply = reply.replace(HUMAN, "").trim() || "Vou chamar uma pessoa da equipe do VIVA+ para te responder por aqui.";
    await admin.from("viva_diag_leads").update({ ai_day: day, ai_replies_day: used + 1, ...(human ? { needs_human: true } : {}) }).eq("id", lead.id);
    await log("out", "ai", reply, "sent");
    return { handled: true, reply };
  } catch (e) {
    console.error("VIVA diag chat", e);
    await admin.from("viva_diag_leads").update({ needs_human: true }).eq("id", lead.id);
    const reply = "Recebi sua mensagem! Uma pessoa da equipe do VIVA+ vai te responder por aqui.";
    await log("out", "system", reply, "sent");
    return { handled: true, reply };
  }
}

/** Ao ligar o WhatsApp a uma conta, ou ao criar conta pelo diagnóstico: para os convites. */
export async function markLeadConverted(admin: Admin, opts: { whatsapp?: string; leadId?: string; userId: string }) {
  const patch = { followup_status: "converted", converted_user_id: opts.userId, converted_at: new Date().toISOString(), next_send_at: null, updated_at: new Date().toISOString() };
  if (opts.leadId) await admin.from("viva_diag_leads").update(patch).eq("id", opts.leadId).is("converted_at", null);
  if (opts.whatsapp) await admin.from("viva_diag_leads").update(patch).eq("whatsapp", opts.whatsapp).is("converted_at", null);
}
