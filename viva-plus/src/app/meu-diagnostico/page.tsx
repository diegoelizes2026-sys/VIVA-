import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FullDiagnostic, { WaitingPayment } from "@/components/full-diagnostic";

export const metadata = { title: "Meu diagnóstico", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Diagnóstico completo (5 áreas + plano por área): o que o Pro libera para quem veio do funil.
export default async function Page({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const { checkout } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/meu-diagnostico");
  const { data: pro } = await supabase.from("viva_subscriptions").select("id").eq("user_id", user.id).in("status", ["active", "trialing"])
    .neq("plan_id", "free").gt("current_period_end", new Date().toISOString()).limit(1).maybeSingle();
  // Voltou do cartão e o Mercado Pago ainda está confirmando: espera aqui em vez de voltar para a oferta.
  if (!pro && checkout === "return") return <WaitingPayment />;
  if (!pro) redirect("/oferta-pro");
  const raw = user.user_metadata?.life_answers;
  const answers = raw && typeof raw === "object" ? Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter(([k, v]) => /^[a-z_]{2,20}$/.test(k) && typeof v === "string").map(([k, v]) => [k, String(v).slice(0, 20)])) : null;
  const first = String(user.user_metadata?.full_name || "").trim().split(" ")[0] || "";
  return <FullDiagnostic serverAnswers={answers} firstName={first} />;
}
