// Memória financeira estruturada do usuário (viva_finance_profiles) usada pela VIVA:
// 1) contexto para a IA não perguntar de novo o que já sabe; 2) detecção de mudanças que exigem confirmação.
import { extractMoneyAmount } from "@/lib/finance-intent";

type Db = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
type Row = Record<string, unknown>;
const brl = (n: unknown) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const WORK: Record<string, string> = { clt: "carteira assinada", servidor: "servidor público", autonomo: "autônomo", empreendedor: "empreendedor", desempregado: "sem trabalho no momento", aposentado: "aposentado", estudante: "estudante", outro: "outro" };
const GOAL: Record<string, string> = { sair_dividas: "sair das dívidas", economizar: "economizar todo mês", reserva: "montar reserva de emergência", comprar_bem: "comprar um bem", organizar: "organizar as contas" };

export async function loadFinanceProfile(db: Db, userId: string): Promise<Row | null> {
  const { data } = await db.from("viva_finance_profiles").select("*").eq("user_id", userId).maybeSingle();
  return (data as Row) || null;
}

export function financeMemoryText(p: Row | null): string {
  if (!p) return "";
  const c = (p.certainty || {}) as Record<string, string>;
  const tag = (id: string) => c[id] === "estimated" ? " (estimado)" : "";
  const lines: string[] = [];
  if (p.monthly_income != null) lines.push(`Renda mensal: ${brl(p.monthly_income)}${tag("income")}${p.income_type === "variable" || p.income_type === "mixed" ? `, renda variável (mês fraco ${p.income_min != null ? brl(p.income_min) : "?"}, mês bom ${p.income_max != null ? brl(p.income_max) : "?"})` : p.income_type === "fixed" ? ", renda fixa" : ""}`);
  if (p.work_type) lines.push(`Trabalho: ${WORK[String(p.work_type)] || p.work_type}`);
  if (p.has_other_income) lines.push(`Outra renda: ${p.other_income_amount != null ? brl(p.other_income_amount) : "valor não informado"}`);
  if (p.monthly_expenses != null) lines.push(`Gastos mensais: ${brl(p.monthly_expenses)}${tag("expenses")}`);
  const parts = [["Moradia", "housing_cost", "housing"], ["Alimentação", "food_cost", "food"], ["Transporte", "transport_cost", "transport"]].filter(([, k]) => p[k] != null).map(([l, k, t]) => `${l} ${brl(p[k])}${tag(t)}`);
  if (parts.length) lines.push("Gastos por categoria: " + parts.join(", "));
  if (p.has_debts === false) lines.push("Não tem dívidas");
  if (p.has_debts) lines.push(`Dívidas: ${p.debt_total != null ? brl(p.debt_total) : "valor não informado"}${p.has_overdue ? ", com parcelas atrasadas" : ""}${(p.debt_types as string[] | null)?.length ? ` (${(p.debt_types as string[]).join(", ")})` : ""}${p.debt_payment_capacity != null ? `; consegue pagar ${brl(p.debt_payment_capacity)} por mês` : ""}`);
  if (p.main_difficulty) lines.push(`Maior dificuldade: ${p.main_difficulty}`);
  if ((p.goals as string[] | null)?.length) lines.push("Objetivos: " + (p.goals as string[]).map(g => GOAL[g] || g).join(", ") + (p.purchase_goal ? ` (quer comprar: ${p.purchase_goal}${p.purchase_amount ? `, ${brl(p.purchase_amount)}` : ""})` : ""));
  if (!lines.length) return "";
  return "\n\nPerfil financeiro informado pelo próprio usuário (memória do VIVA+; use como contexto, não repita tudo):\n- " + lines.join("\n- ") +
    "\nRegras: não pergunte de novo o que já está neste perfil. Se o usuário disser que algo mudou, NÃO afirme que atualizou: peça confirmação. Valores marcados como estimados são aproximados.";
}

export type ProfileDraft = { field: string; label: string; value: number | boolean | null; previous: string | null; display: string };

// Mudanças ditas no chat que pedem confirmação antes de alterar o perfil (sem gastar créditos).
export function detectProfileChange(message: string, p: Row | null): ProfileDraft | null {
  const t = message.toLowerCase();
  if (/\b(gastei|paguei|comprei|recebi|transferi|pix)\b/.test(t) && !/\bquitei\b/.test(t)) return null;
  const incomeChange = /\b(minha renda|meu sal[áa]rio|meu ganho|o que eu ganho)\b.*\b(mudou|agora|passou|aumentou|diminuiu|caiu|subiu|virou)\b|\b(agora (eu )?ganho|passei a ganhar|estou ganhando|t[ôo] ganhando)\b/.test(t);
  if (incomeChange) {
    const v = extractMoneyAmount(message);
    if (v && v > 0) return { field: "monthly_income", label: "Renda mensal", value: v, previous: p?.monthly_income != null ? brl(p.monthly_income) : null, display: brl(v) };
  }
  if (/\b(quitei|terminei de pagar|paguei (tudo|toda|todas|minhas?)).{0,30}d[íi]vidas?\b|\bn[ãa]o tenho mais d[íi]vidas?\b|\bzerei (as|minhas) d[íi]vidas\b/.test(t))
    return { field: "has_debts", label: "Dívidas", value: false, previous: p?.debt_total != null ? brl(p.debt_total) : p?.has_debts ? "com dívidas" : null, display: "Sem dívidas" };
  if (/\b(minhas? d[íi]vidas?|o que eu devo)\b.*\b(agora|est[áa]|ficou|caiu|baixou|subiu)\b/.test(t)) {
    const v = extractMoneyAmount(message);
    if (v != null && v >= 0) return { field: "debt_total", label: "Total das dívidas", value: v, previous: p?.debt_total != null ? brl(p.debt_total) : null, display: brl(v) };
  }
  return null;
}
