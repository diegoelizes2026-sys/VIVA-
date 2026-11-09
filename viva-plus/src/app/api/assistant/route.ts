import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  message: z.string().trim().min(1).max(4000),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(4000),
  })).max(10).optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Faça login para usar o assistente." }, { status: 401 });

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Mensagem inválida." }, { status: 400 });
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Assistente ainda não configurado. Adicione OPENAI_API_KEY nas variáveis da Vercel." }, { status: 503 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const history = (parsed.data.history || []).map(item => ({ role: item.role, content: item.content }));
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      instructions: "Você é o Assistente VIVA+, fala português brasileiro com clareza, acolhimento e objetividade. Ajude com organização pessoal e educação financeira geral. Você não tem acesso aos dados privados do usuário nem pode executar ações no aplicativo. Nunca invente compromissos, saldos, preços, avaliações ou despesas. Deixe claro quando precisar de informações e sugira a tela do aplicativo adequada quando isso ajudar.",
      input: [...history, { role: "user", content: parsed.data.message }],
    });
    return NextResponse.json({ answer: response.output_text || "Não consegui gerar uma resposta agora." });
  } catch (error) {
    console.error("VIVA assistant error", error);
    return NextResponse.json({ error: "Não foi possível responder agora. Tente novamente." }, { status: 500 });
  }
}
