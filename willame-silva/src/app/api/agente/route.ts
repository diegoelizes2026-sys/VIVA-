import { NextResponse } from "next/server";
import {
  buscarLeadPorSessao,
  listarEmpreendimentos,
  lerConfig,
  novoLead,
  salvarLead,
} from "@/lib/db";
import { agenteComIA, responderComClaude, responderComRoteiro, type RespostaAgente } from "@/lib/agente";
import { linkWhatsapp, mensagemParaCorretor, telefoneBonito } from "@/lib/format";
import type { Lead, MensagemConversa } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const janela = new Map<string, number[]>();
function limitado(ip: string) {
  const t = Date.now();
  const arr = (janela.get(ip) ?? []).filter((x) => t - x < 60_000);
  arr.push(t);
  janela.set(ip, arr);
  return arr.length > 20;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limitado(ip)) {
    return NextResponse.json({ erro: "Muitas mensagens seguidas. Aguarde um minutinho." }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as {
    session_id?: string;
    mensagens?: MensagemConversa[];
    pagina?: string;
  } | null;
  const sessionId = String(body?.session_id || "").slice(0, 80);
  const conversa = (body?.mensagens ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-30)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1500), at: m.at }));
  if (!sessionId || !conversa.some((m) => m.role === "user")) {
    return NextResponse.json({ erro: "Conversa inválida." }, { status: 400 });
  }

  const [cfg, emps, existente] = await Promise.all([
    lerConfig(),
    listarEmpreendimentos(),
    buscarLeadPorSessao(sessionId),
  ]);

  let r: RespostaAgente;
  let motor: "claude" | "roteiro" = "roteiro";
  if (agenteComIA()) {
    try {
      r = await responderComClaude(conversa, cfg, emps, existente);
      motor = "claude";
    } catch (e) {
      console.error("[agente] falha no Claude, usando roteiro:", e);
      r = responderComRoteiro(conversa, cfg, emps, existente);
    }
  } else {
    r = responderComRoteiro(conversa, cfg, emps, existente);
  }

  // Mescla no CRM sem apagar o que já sabíamos.
  const lead: Lead = existente ?? novoLead({ session_id: sessionId, origem: "Agente 24h" });
  for (const [k, v] of Object.entries(r.dados)) {
    if (v && String(v).trim()) (lead as Record<string, unknown>)[k] = String(v).trim();
  }
  lead.temperatura = r.temperatura;
  lead.pontuacao = Math.max(lead.pontuacao, r.pontuacao);
  if (body?.pagina && !lead.notas.includes("Página de entrada")) {
    lead.notas = `Página de entrada: ${body.pagina}${lead.notas ? `\n${lead.notas}` : ""}`;
  }
  lead.conversa = [...conversa, { role: "assistant", content: r.resposta, at: new Date().toISOString() }];
  try {
    await salvarLead(lead);
  } catch (e) {
    console.error("[agente] erro ao salvar lead:", e);
  }

  const pronto = r.pronto_para_corretor || Boolean(lead.nome && lead.telefone.length >= 10);
  const citados = emps
    .filter((e) => r.empreendimentos_citados.includes(e.slug))
    .slice(0, 3)
    .map((e) => ({ slug: e.slug, nome: e.nome, capa: e.capa, status: e.status, cidade: e.cidade }));

  return NextResponse.json({
    resposta: r.resposta,
    sugestoes: r.sugestoes,
    pronto,
    motor,
    empreendimentos: citados,
    whatsapp: pronto ? linkWhatsapp(cfg.whatsapp, mensagemParaCorretor(lead, cfg.corretor_nome)) : null,
    lead: { nome: lead.nome, telefone: lead.telefone ? telefoneBonito(lead.telefone) : "" },
  });
}

/** Marca que o cliente tocou no botão do WhatsApp. */
export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => null)) as { session_id?: string } | null;
  if (!body?.session_id) return NextResponse.json({ ok: false }, { status: 400 });
  const lead = await buscarLeadPorSessao(String(body.session_id));
  if (lead) {
    lead.encaminhado_whatsapp = true;
    if (lead.etapa === "novo") lead.etapa = "atendimento";
    await salvarLead(lead);
  }
  return NextResponse.json({ ok: true });
}
