import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyWhatsappPlanActive } from "@/lib/whatsapp";

// "Liberar Pro": presente de N dias, sem pagamento (ex.: para um influenciador testar antes de divulgar).
const Body = z.object({ user_id: z.string().uuid(), days: z.coerce.number().int().min(1).max(366) });

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("viva_is_admin");
  if (!isAdmin) return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Escolha por quantos dias liberar." }, { status: 400 });
  const { data, error } = await supabase.rpc("viva_admin_grant_pro", { p_user_id: parsed.data.user_id, p_days: parsed.data.days });
  if (error) {
    const msg = /already_paid/.test(error.message) ? "Essa pessoa já tem um plano pago ativo." : "Não foi possível liberar o Pro.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  await notifyWhatsappPlanActive(createAdminClient(), parsed.data.user_id);
  return NextResponse.json(data);
}
