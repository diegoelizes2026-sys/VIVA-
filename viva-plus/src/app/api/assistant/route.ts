import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  message: z.string().trim().min(1).max(4000),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(4000),
  })).max(12).optional(),
});

function parseMoney(text: string) {
  const match = text.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[,.]\d{1,2})?)(?:\s*reais?)?/i);
  if (!match) return null;
  const normalized = match[1].includes(",")
    ? match[1].replace(/\./g, "").replace(",", ".")
    : match[1];
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Faça login para conversar com a VIVA+." }, { status: 401 });

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Mensagem inválida." }, { status: 400 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Assistente ainda não configurado. Adicione OPENAI_API_KEY nas variáveis da Vercel." }, { status: 503 });

    const message = parsed.data.message;
    const lower = message.toLocaleLowerCase("pt-BR");
    let actionNote = "";

    // Registra somente quando a frase indica claramente uma movimentação já realizada.
    const isExpense = /\b(gastei|paguei|comprei|despesa|anota.*gasto|registra.*gasto)\b/i.test(lower);
    const isIncome = /\b(recebi|ganhei|faturei|entrou|receita|anota.*receita|registra.*receita)\b/i.test(lower);
    const amount = (isExpense || isIncome) ? parseMoney(message) : null;

    if (amount && (isExpense || isIncome)) {
      const description = message
        .replace(/r\$\s*/ig, "")
        .replace(/\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[,.]\d{1,2})?/g, "")
        .replace(/\b(gastei|paguei|comprei|despesa|anota|registra|recebi|ganhei|faturei|entrou|receita|reais|real)\b/ig, "")
        .replace(/\s+/g, " ").trim() || (isExpense ? "Despesa informada à VIVA+" : "Receita informada à VIVA+");
      const { error } = await supabase.from("viva_transactions").insert({
        kind: isExpense ? "expense" : "income",
        description: description.slice(0, 180),
        amount,
        occurred_on: new Date().toISOString().slice(0, 10),
        category: "Geral",
      });
      if (error) throw error;
      actionNote = `\n\n✅ Registrei ${isExpense ? "uma despesa" : "uma receita"} de R$ ${amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} no seu financeiro de hoje: ${description}.`;
    } else if ((isExpense || isIncome) && !amount) {
      actionNote = "\n\nPara registrar isso no seu financeiro, me diga também o valor em reais.";
    }

    // Preferências só são guardadas quando o usuário pede explicitamente.
    if (/\b(guarde|guardar|lembre|lembrar|anote como preferência|minha preferência|eu prefiro|eu gosto)\b/i.test(lower)) {
      const { error } = await supabase.from("viva_ai_memories").insert({ memory: message.slice(0, 1000) });
      if (!error) actionNote += "\n\n💜 Vou guardar essa preferência para considerar nas próximas conversas.";
      else console.error("VIVA memory save error", error);
    }

    const [{ data: memories }, { data: transactions }] = await Promise.all([
      supabase.from("viva_ai_memories").select("memory").order("created_at", { ascending: false }).limit(20),
      supabase.from("viva_transactions").select("kind,description,amount,occurred_on,category").order("occurred_on", { ascending: false }).limit(15),
    ]);

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const history = (parsed.data.history || []).slice(-12).map(item => ({ role: item.role, content: item.content }));
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      instructions: `Você é VIVA+, uma agente pessoal acolhedora, proativa e prática. Fale sempre em português brasileiro, como uma amiga virtual inteligente e respeitosa. Ajude a organizar o dia, hábitos, agenda, orçamento, compras e decisões. Use as preferências e o resumo financeiro abaixo como contexto, mas nunca invente dados. Seja clara sobre o que você realmente conseguiu registrar. Se faltar valor ou informação, pergunte. Não diga que pesquisou preços na internet se não fez uma pesquisa real. Para compras, peça produto e cidade/país quando necessário. Não dê aconselhamento médico, jurídico ou financeiro profissional como se fosse especialista.\n\nPreferências que o usuário pediu para guardar:\n${(memories || []).map(x => "- " + x.memory).join("\n") || "Ainda não há preferências salvas."}\n\nMovimentações recentes do usuário:\n${(transactions || []).map(x => `- ${x.occurred_on}: ${x.kind === "income" ? "receita" : "despesa"} ${x.description}, R$ ${x.amount}`).join("\n") || "Nenhuma movimentação registrada."}`,
      input: history.length ? history : message,
    });
    return NextResponse.json({ answer: (response.output_text || "Estou aqui com você. Pode me contar mais.") + actionNote });
  } catch (error) {
    console.error("VIVA assistant error", error);
    return NextResponse.json({ error: "Não foi possível responder agora. Tente novamente." }, { status: 500 });
  }
}
