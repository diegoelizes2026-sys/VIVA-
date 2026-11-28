import { createDelivery, logDeliveryFailure, sendDelivery } from "@/lib/notifications";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;
const TZ = "America/Fortaleza";
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Início do dia de hoje no fuso de Fortaleza (UTC-3, sem horário de verão), em ISO. */
function todayStartIso(now = new Date()) {
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return new Date(d + "T00:00:00-03:00").toISOString();
}

/**
 * Aviso de venda no celular dos administradores, no estilo "Venda aprovada!" da Kiwify.
 * Vai para quem está em viva_admin_users e ativou as notificações do VIVA+ no aparelho.
 * Um aviso por pagamento (dedupe no banco). Nunca lança erro: não pode atrapalhar o pagamento.
 */
export async function notifySale(db: Db, sale: { key: string; userId?: string | null; planId?: string | null; amount: number; method: "pix" | "card"; offer?: boolean; renewal?: boolean; test?: boolean; onlyAdminId?: string }) {
  try {
    const { data: admins } = await db.from("viva_admin_users").select("user_id");
    const ids: string[] = (admins || []).map((a: { user_id: string }) => a.user_id).filter((id: string) => !sale.onlyAdminId || id === sale.onlyAdminId);
    if (!ids.length) return 0;
    const [{ data: plan }, buyer, { data: today }] = await Promise.all([
      sale.planId ? db.from("viva_plans").select("name").eq("id", sale.planId).maybeSingle() : Promise.resolve({ data: null }),
      sale.userId ? db.auth.admin.getUserById(sale.userId).then((r: { data?: { user?: { user_metadata?: Record<string, unknown> } } }) => r.data?.user ?? null).catch(() => null) : Promise.resolve(null),
      db.from("viva_payments").select("amount_brl").eq("status", "approved").gt("amount_brl", 0).gte("paid_at", todayStartIso()).limit(5000),
    ]);
    const first = String(buyer?.user_metadata?.full_name || "").trim().split(" ")[0];
    const rows = (today || []) as { amount_brl: number }[];
    const dayTotal = rows.reduce((t, r) => t + Number(r.amount_brl || 0), 0);
    const title = (sale.test ? "[Teste] " : "") + (sale.renewal ? "Assinatura renovada!" : "Venda aprovada!");
    const body = [
      `Valor: ${brl(sale.amount)}`,
      `${plan?.name ? "Plano " + plan.name : "VIVA+"}${sale.offer ? " (oferta R$19,90)" : ""} · ${sale.method === "pix" ? "Pix" : "Cartão"}${first ? " · " + first : ""}`,
      sale.test ? "Assim chega cada venda no seu celular." : `Hoje: ${rows.length} ${rows.length === 1 ? "venda" : "vendas"} · ${brl(dayTotal)}`,
    ].join("\n");
    let sent = 0;
    for (const adminId of ids) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let d: any = null;
      try {
        d = await createDelivery({ user_id: adminId, notification_type: "sale", dedupe_key: `sale:${sale.key}:${adminId}`, title, body, target_url: "/admin", payload: { type: "sale" } });
        if (d?.status === "pending") { await sendDelivery(d); sent++; }
      } catch (e) {
        console.error("VIVA sale alert", adminId, e instanceof Error ? e.message : e);
        if (d?.id) await logDeliveryFailure({ ...d, status: "processing", attempts: Number(d.attempts || 0) + 1 }, e).catch(() => {});
      }
    }
    return sent;
  } catch (e) { console.error("VIVA sale alert", e); }
  return 0;
}
