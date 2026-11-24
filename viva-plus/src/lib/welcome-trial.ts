import { createAdminClient } from "@/lib/supabase/admin";
import { notifyWhatsappPlanActive } from "@/lib/whatsapp";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { rpc: (fn: string, args?: Record<string, unknown>) => any };

/**
 * Presente de boas-vindas: quem nunca teve plano (nem teste) ganha 7 dias do Pro na hora,
 * sem precisar procurar o botão. Uma vez por conta (regra no banco: viva_start_pro_trial).
 * Devolve true só na vez em que o teste começou. Nunca lança erro.
 */
export async function ensureWelcomeTrial(supabase: Db, userId: string) {
  try {
    const { data: status } = await supabase.rpc("viva_trial_status");
    if (!(status as { eligible?: boolean } | null)?.eligible) return false;
    const { error } = await supabase.rpc("viva_start_pro_trial");
    if (error) return false;
    await supabase.rpc("viva_get_ai_quota").then(() => null, () => null);
    await notifyWhatsappPlanActive(createAdminClient(), userId);
    return true;
  } catch (e) {
    console.error("VIVA welcome trial", e);
    return false;
  }
}
