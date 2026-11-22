// Regras compartilhadas do sistema de créditos de IA (servidor).
// O custo de cada operação vem da tabela viva_credit_operations (configurável no admin);
// aqui o servidor apenas decide QUAL operação está sendo executada.

export type OperationKey =
  | "simple_question" | "elaborate_answer" | "financial_analysis" | "debt_planning"
  | "workout_creation" | "personalized_analysis" | "voice_message" | "receipt_reading" | "price_radar";

const DEBT = /\b(d[ií]vidas?|devendo|deve(?:ndo)?|quitar|quita[çc][ãa]o|renegociar|negociar (?:a |minha )?d[ií]vida|parcelas? atrasadas?|nome sujo|serasa|empr[ée]stimo|cart[ãa]o (?:atrasado|estourado)|juros do cart[ãa]o)\b/i;
const FIN_ANALYSIS = /\b(analis[ea]r?|an[áa]lise|avali[ae]r?|diagn[óo]stico|relat[óo]rio|resumo (?:financeiro|do m[êe]s|dos gastos)|onde (?:eu )?(?:estou|t[ôo]) gastando|como (?:est[ãa]o|anda) (?:minhas|as) finan[çc]as|posso (?:comprar|gastar)|vale a pena comprar|cabe no (?:meu )?or[çc]amento|planejamento financeiro|planej(?:ar|e) (?:o )?(?:m[êe]s|or[çc]amento)|or[çc]amento)\b/i;
const WORKOUT = /\b(mont[ae]r?|cri[ae]r?|fa[çc]a|gere|gerar|elabor[ae]r?|prepar[ae]r?|sugir[ae]|quero|preciso)\b.{0,40}\b(treinos?|ficha|s[ée]ries?|rotina de exerc[íi]cios|plano de treino|divis[ãa]o de treino)\b/i;
const PERSONAL_ANALYSIS = /\b(analis[ea]r?|an[áa]lise|avali[ae]r?|avalia[çc][ãa]o|diagn[óo]stico|relat[óo]rio|como (?:est[áa]|anda|foi) (?:a )?minha (?:evolu[çc][ãa]o|semana|sa[úu]de)|minha evolu[çc][ãa]o)\b/i;
const ELABORATE = /\b(explique|explica|detalh[ae]|passo a passo|compar[ae]|diferen[çc]a entre|estrat[ée]gia|plano completo|me ensina|guia)\b/i;

export function classifyFinanceOperation(message: string, opts: { receipt?: boolean; audio?: boolean; radar?: boolean } = {}): OperationKey {
  if (opts.receipt) return "receipt_reading";
  if (opts.radar) return "price_radar";
  const text = (message || "").trim();
  if (DEBT.test(text) && /\b(plano|planej|organiz|quitar|sair|ajud|como|estrat|negoci|priori)\w*/i.test(text)) return "debt_planning";
  if (FIN_ANALYSIS.test(text)) return "financial_analysis";
  if (text.length > 280 || ELABORATE.test(text)) return "elaborate_answer";
  return opts.audio ? "voice_message" : "simple_question";
}

export function classifyPersonalOperation(message: string): OperationKey {
  const text = (message || "").trim();
  if (PERSONAL_ANALYSIS.test(text)) return "personalized_analysis";
  if (WORKOUT.test(text)) return "workout_creation";
  if (text.length > 280 || ELABORATE.test(text)) return "elaborate_answer";
  return "simple_question";
}

// Chave de idempotência enviada pelo app (uma por mensagem; repetida em reenvios).
export function readRequestKey(value: unknown): string | null {
  const key = typeof value === "string" ? value.trim() : "";
  return /^[A-Za-z0-9_-]{8,80}$/.test(key) ? key : null;
}

export type WalletSnapshot = {
  plan_id: string; plan_name: string; is_free: boolean; balance: number; reserved: number; available: number; extra_credits: number;
  cycle_granted: number; cycle_used: number; percent_used: number; warning_level: 0 | 70 | 90 | 100;
  next_renewal_at: string | null; last_renewal_at: string | null; monthly_credits: number;
};

type Guard = { allowed?: boolean; reason?: string; cached_answer?: string | null; wallet?: WalletSnapshot | null; is_free?: boolean; operation_label?: string; credits_required?: number; required_plan?: string } | null;

function renewalText(wallet?: WalletSnapshot | null) {
  if (!wallet?.next_renewal_at) return "";
  const date = new Date(wallet.next_renewal_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  return ` Seus créditos renovam em ${date}.`;
}

// Resposta padrão quando o motor de créditos não libera a operação.
export function blockedResponse(guard: Guard, who: "VIVA" | "Personal" = "VIVA", feature?: string) {
  const reason = guard?.reason || "blocked";
  const wallet = guard?.wallet ?? null;
  const isFree = guard?.is_free ?? wallet?.is_free ?? true;
  if (reason === "duplicate") {
    return { status: 200, body: { answer: guard?.cached_answer || "Essa mensagem já foi respondida.", duplicate: true, wallet } };
  }
  const messages: Record<string, string> = {
    no_credits: isFree
      ? `Seus créditos acabaram.${renewalText(wallet)} Com o VIVA+ Pro você recebe 150 créditos por mês.`
      : `Seus créditos deste ciclo acabaram.${renewalText(wallet)}`,
    feature_not_in_plan: feature === "radar"
      ? "O Radar de preços está disponível nos planos Essencial e Pro."
      : `${guard?.operation_label ? guard.operation_label + " é" : "Este recurso é"} exclusivo do VIVA+ Pro.`,
    rate_limit: "Muitas mensagens seguidas. Aguarde alguns segundos e tente de novo.",
    concurrent: `${who === "VIVA" ? "A VIVA" : "O Personal"} ainda está respondendo a sua mensagem anterior. Aguarde um instante.`,
    in_progress: "Sua mensagem já está sendo respondida. Aguarde um instante.",
    paused_global: "A IA do VIVA+ está temporariamente pausada.",
    paused_user: "O uso de IA está pausado na sua conta. Fale com o suporte.",
    monthly_cost_cap: "Você atingiu o limite de uso do mês. Ele volta no próximo ciclo.",
    global_budget: "O limite diário de operação foi atingido. Tente novamente amanhã.",
    model_pricing_not_configured: "A IA está em manutenção rápida. Tente novamente em instantes.",
    unauthenticated: "Faça login para continuar.",
  };
  const status = reason === "unauthenticated" ? 401 : reason === "rate_limit" || reason === "concurrent" || reason === "in_progress" ? 429 : reason === "model_pricing_not_configured" ? 503 : 200;
  const upgrade = (reason === "no_credits" && isFree) || reason === "feature_not_in_plan";
  // O Essencial também resolve: créditos acabaram no Free, ou o recurso pedido (Radar) já vem no Essencial.
  const offerEssential = (reason === "no_credits" && isFree) || (reason === "feature_not_in_plan" && feature === "radar");
  return {
    status,
    body: {
      state: reason === "no_credits" ? "limit_reached" : "blocked",
      reason, upgrade, wallet, offer_essential: offerEssential,
      message: messages[reason] || "Não foi possível liberar esta solicitação.",
      error: messages[reason] || "Não foi possível liberar esta solicitação.",
    },
  };
}
