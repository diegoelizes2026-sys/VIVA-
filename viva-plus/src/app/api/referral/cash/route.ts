import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Indicação paga: meu saldo em dinheiro (GET) e pedir saque por Pix (POST). Regras no banco.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { data, error } = await supabase.rpc("viva_my_referral_cash");
  if (error) { console.error("VIVA referral cash", error); return NextResponse.json({ error: "Não foi possível carregar seu saldo." }, { status: 500 }); }
  return NextResponse.json(data);
}

const Payout = z.object({ pix_key_type: z.enum(["cpf", "email", "phone", "random"]), pix_key: z.string().trim().min(5).max(120) });
const REASON: Record<string, string> = {
  pix_invalid: "Confira a chave Pix: ela não parece válida para o tipo escolhido.",
  payout_open: "Você já tem um saque em análise. Assim que for pago, pode pedir outro.",
  payout_min: "O saque fica disponível a partir de R$ 30,00 liberados.",
};
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = Payout.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: REASON.pix_invalid }, { status: 400 });
  const { data, error } = await supabase.rpc("viva_request_referral_payout", { p_pix_type: parsed.data.pix_key_type, p_pix_key: parsed.data.pix_key });
  if (error) {
    const known = Object.keys(REASON).find(k => error.message?.includes(k));
    if (known) return NextResponse.json({ error: REASON[known] }, { status: 409 });
    console.error("VIVA referral payout", error);
    return NextResponse.json({ error: "Não consegui pedir o saque agora. Tente de novo." }, { status: 500 });
  }
  return NextResponse.json(data);
}
