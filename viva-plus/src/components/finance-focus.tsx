"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Flag = { id: string; text: string; severity: "high" | "medium" | "info" };
type Profile = Record<string, unknown> & { focus?: string; diagnosis?: { focusTitle?: string; flags?: Flag[]; recommendations?: string[]; leftover?: number | null; commitmentPct?: number | null; debtMonthsToPay?: number | null }; certainty?: Record<string, string> };
type Onb = { kind: string; status: string };
const brl = (v: unknown) => v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// Painel adaptado ao perfil financeiro do diagnóstico (dívidas, gastos, renda variável, poupança).
export default function FinanceFocus() {
  const [p, setP] = useState<Profile | null | undefined>(undefined);
  const [onb, setOnb] = useState<Onb | null>(null);
  useEffect(() => {
    fetch("/api/my-data").then(r => r.ok ? r.json() : null).then(d => { setP(d?.finance ?? null); setOnb((d?.onboarding || []).find((o: Onb) => o.kind === "finance") || null); }).catch(() => setP(null));
  }, []);
  if (p === undefined) return null;
  if (!p) return <section className="ff ff-invite">
    <div><span className="ff-tag">DIAGNÓSTICO GRATUITO</span><h2>Deixe a VIVA preparar seu painel</h2><p>Responda algumas perguntas em uma conversa rápida e receba um planejamento feito para a sua realidade. Não consome créditos.</p></div>
    <Link className="ff-btn" href="/boas-vindas">{onb?.status === "in_progress" ? "Continuar diagnóstico" : "Fazer meu diagnóstico"}</Link>
  </section>;

  const d = p.diagnosis || {}; const focus = String(p.focus || "organize");
  const income = p.income_type === "variable" || p.income_type === "mixed" ? (p.income_min ?? p.monthly_income) : p.monthly_income;
  const est = (k: string) => p.certainty?.[k] === "estimated" ? " · estimado" : "";
  const kpi: [string, string, string?][] = [];
  if (focus === "debts") {
    kpi.push(["Dívidas", brl(p.debt_total), est("debt_total")]);
    kpi.push(["Por mês para quitar", brl(p.debt_payment_capacity), est("debt_capacity")]);
    kpi.push(["Previsão para quitar", d.debtMonthsToPay ? `${d.debtMonthsToPay} meses` : "Defina um valor mensal"]);
    if (income) kpi.push(["Renda", brl(income), est("income")]);
  } else if (focus === "variable") {
    kpi.push(["Mês fraco", brl(p.income_min ?? p.monthly_income)], ["Mês bom", brl(p.income_max)], ["Gastos do mês", brl(p.monthly_expenses ?? null), est("expenses")]);
    if (p.income_max != null && p.income_min != null) kpi.push(["Guardar nos meses bons", brl(Number(p.income_max) - Number(p.income_min))]);
  } else {
    kpi.push(["Renda", brl(income), est("income")], ["Gastos", brl(p.monthly_expenses ?? sumParts(p)), est("expenses")], ["Sobra estimada", brl(d.leftover)]);
    if (d.commitmentPct != null) kpi.push(["Renda comprometida", `${d.commitmentPct}%`]);
  }
  const links: [string, string][] = focus === "debts" ? [["Cartões e dívidas", "/planejamento"], ["Contas a pagar", "/contas"], ["Plano para sair das dívidas", "/assistente"]]
    : focus === "spending" ? [["Orçamento do mês", "/planejamento"], ["Registrar gastos com a VIVA", "/assistente"], ["Meus lançamentos", "/financas"]]
    : focus === "variable" ? [["Metas e reserva", "/assistente"], ["Previsão do mês", "/planejamento"]]
    : focus === "saving" ? [["Minhas metas", "/assistente"], ["Orçamento do mês", "/planejamento"]]
    : [["Planejamento", "/planejamento"], ["Contas a pagar", "/contas"]];
  return <section className={"ff ff-" + focus}>
    <div className="ff-head"><div><span className="ff-tag">SEU FOCO</span><h2>{d.focusTitle || "Sua vida financeira"}</h2></div><Link className="ff-edit" href="/meus-dados">Atualizar dados</Link></div>
    <div className="ff-kpis">{kpi.map(([l, v, e]) => <div key={l}><span>{l}</span><b>{v}</b>{e && <em>{e.replace(" · ", "")}</em>}</div>)}</div>
    {!!d.flags?.length && <ul className="ff-flags">{d.flags.slice(0, 3).map(f => <li key={f.id} className={f.severity}>{f.text}</li>)}</ul>}
    {!!d.recommendations?.length && <p className="ff-rec"><b>Próximo passo:</b> {d.recommendations[0]}</p>}
    <nav className="ff-links">{links.map(([l, h]) => <Link key={l} href={h}>{l}</Link>)}</nav>
  </section>;
}
function sumParts(p: Profile) { const v = ["housing_cost", "food_cost", "transport_cost"].map(k => p[k]).filter(x => x != null).map(Number); return v.length ? v.reduce((a, b) => a + b, 0) : null; }
