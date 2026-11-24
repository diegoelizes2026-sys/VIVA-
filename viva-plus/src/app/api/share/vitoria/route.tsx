import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { loadTodayBudget } from "@/lib/daily-budget-load";
import { todayBR } from "@/lib/payday";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// Cartão de vitória ou do número do dia (?tipo=dia) (1080x1350, tamanho de status/stories) para compartilhar com o convite.
// ?valores=0 esconde os valores em reais.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Não autenticado.", { status: 401 });
  const params = new URL(request.url).searchParams;
  const showValues = params.get("valores") !== "0";
  const dayCard = params.get("tipo") === "dia";
  const today = todayBR();
  const [{ budget, streak }, referral] = await Promise.all([
    loadTodayBudget(supabase, user.id, today),
    supabase.rpc("viva_my_referral").then(r => (r.data as { code?: string } | null) ?? null, () => null),
  ]);
  const first = String(user.user_metadata?.full_name || "").trim().split(/\s+/)[0] || "";
  const leftover = budget.mode === "dynamic" && budget.forecast?.kind === "leftover" ? budget.forecast.amount : 0;

  let emoji = "💜", big = "Organizando meu dinheiro", small = "Sei quanto posso gastar todo dia, sem planilha.";
  if (streak >= 3) { emoji = "🔥"; big = `${streak} dias seguidos`; small = "dentro do meu valor do dia, sem estourar o orçamento."; }
  else if (leftover > 0) { emoji = "🎉"; big = showValues ? `Vai sobrar ${brl(leftover)}` : "Vai sobrar dinheiro"; small = "neste mês, no ritmo que estou gastando."; }

  // ?tipo=dia: "número do dia" para o Status do WhatsApp (o valor que dá para gastar hoje).
  if (dayCard && budget.mode !== "setup") {
    const value = Math.max(0, budget.allowance);
    emoji = budget.forecast?.kind === "runs_out" ? "💪" : "💜";
    big = showValues ? `Hoje posso gastar ${brl(value)}` : "Eu sei quanto posso gastar hoje";
    small = budget.forecast?.kind === "runs_out" ? "e estou ajustando para fechar o mês no azul." : "e vou fechar o mês no azul.";
  }

  const code = referral?.code ? String(referral.code) : "";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 90, background: "linear-gradient(160deg,#3d0a86 0%,#6410C9 55%,#8b3de8 100%)", color: "#fff", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", width: 84, height: 84, borderRadius: 26, background: "rgba(255,255,255,.16)", alignItems: "center", justifyContent: "center", fontSize: 44, fontWeight: 900 }}>V+</div>
          <div style={{ display: "flex", fontSize: 46, fontWeight: 900, letterSpacing: -1 }}>VIVA+</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div style={{ display: "flex", fontSize: 150 }}>{emoji}</div>
          {first && <div style={{ display: "flex", fontSize: 44, fontWeight: 700, opacity: 0.85 }}>{dayCard ? `${first}:` : `${first} conseguiu:`}</div>}
          <div style={{ display: "flex", fontSize: 112, fontWeight: 900, letterSpacing: -4, lineHeight: 1.02 }}>{big}</div>
          <div style={{ display: "flex", fontSize: 46, fontWeight: 600, opacity: 0.9, lineHeight: 1.3, maxWidth: 860 }}>{small}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: 44, borderRadius: 40, background: "rgba(255,255,255,.12)" }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 800 }}>A VIVA me diz quanto posso gastar hoje.</div>
          <div style={{ display: "flex", fontSize: 36, opacity: 0.9 }}>{code ? `Entre com meu convite: ${code}` : "Baixe grátis e descubra o seu valor do dia."}</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1350, headers: { "Cache-Control": "private, no-store" } },
  );
}
