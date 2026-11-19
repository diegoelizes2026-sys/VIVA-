import { NextResponse } from "next/server";
import { lerConfig, novoLead, salvarLead } from "@/lib/db";
import { linkWhatsapp, soDigitos } from "@/lib/format";

export const runtime = "nodejs";

/** Formulários do site (contato e página de empreendimento). */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Record<string, string> | null;
  const nome = String(b?.nome || "").trim().slice(0, 80);
  const telefone = soDigitos(String(b?.telefone || "")).slice(0, 13);
  if (!nome || telefone.length < 10) {
    return NextResponse.json({ erro: "Informe nome e WhatsApp com DDD." }, { status: 400 });
  }
  const interesse = String(b?.empreendimento || "").slice(0, 120);
  const mensagem = String(b?.mensagem || "").slice(0, 1000);
  const objetivo = String(b?.objetivo || "").slice(0, 60);
  const lead = novoLead({
    nome,
    telefone,
    email: String(b?.email || "").slice(0, 120),
    objetivo,
    empreendimento_interesse: interesse,
    busca: [interesse && `Interesse em ${interesse}`, objetivo, mensagem].filter(Boolean).join(" · "),
    origem: interesse ? `Formulário · ${interesse}` : "Formulário do site",
    temperatura: "morno",
    pontuacao: 50,
    notas: mensagem,
  });
  await salvarLead(lead);
  const cfg = await lerConfig();
  const texto = `Olá, ${cfg.corretor_nome.split(" ")[0]}! Sou ${nome} e vim pelo seu site.${
    interesse ? ` Tenho interesse no ${interesse}.` : ""
  }${mensagem ? `\n${mensagem}` : ""}`;
  return NextResponse.json({ ok: true, whatsapp: linkWhatsapp(cfg.whatsapp, texto) });
}
