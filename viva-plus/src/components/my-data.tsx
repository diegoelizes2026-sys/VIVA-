"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Row = Record<string, unknown>;
type FieldDef = { key: string; label: string; type: "money" | "bool" | "text" | "select"; cert?: string; options?: [string, string][] };
const FIN: FieldDef[] = [
  { key: "monthly_income", label: "Renda mensal", type: "money", cert: "income" },
  { key: "income_type", label: "Tipo de renda", type: "select", options: [["fixed", "Fixa"], ["variable", "Variável"], ["mixed", "Parte fixa, parte variável"]] },
  { key: "income_min", label: "Renda num mês fraco", type: "money", cert: "income_min" },
  { key: "income_max", label: "Renda num mês bom", type: "money", cert: "income_max" },
  { key: "work_type", label: "Trabalho", type: "select", options: [["clt", "Carteira assinada"], ["servidor", "Servidor público"], ["autonomo", "Autônomo"], ["empreendedor", "Empreendedor"], ["aposentado", "Aposentado"], ["estudante", "Estudante"], ["desempregado", "Sem trabalho"], ["outro", "Outro"]] },
  { key: "other_income_amount", label: "Outra renda", type: "money", cert: "other_income_amount" },
  { key: "monthly_expenses", label: "Gastos mensais", type: "money", cert: "expenses" },
  { key: "housing_cost", label: "Moradia", type: "money", cert: "housing" },
  { key: "food_cost", label: "Alimentação", type: "money", cert: "food" },
  { key: "transport_cost", label: "Transporte", type: "money", cert: "transport" },
  { key: "has_debts", label: "Tem dívidas", type: "bool" },
  { key: "debt_total", label: "Total das dívidas", type: "money", cert: "debt_total" },
  { key: "has_overdue", label: "Parcelas atrasadas", type: "bool" },
  { key: "debt_payment_capacity", label: "Pode pagar por mês", type: "money", cert: "debt_capacity" },
  { key: "main_difficulty", label: "Maior dificuldade", type: "text" },
  { key: "purchase_goal", label: "Bem que quer comprar", type: "text" },
  { key: "purchase_amount", label: "Valor do bem", type: "money", cert: "purchase_amount" },
];
const CERT: Record<string, string> = { confirmed: "Confirmado", estimated: "Estimado", unknown: "Não informado" };
const HEALTH: Record<string, Record<string, string>> = {
  goal: { hipertrofia: "Ganhar massa", emagrecimento: "Perder peso", condicionamento: "Condicionamento", saude: "Saúde e bem-estar" },
  experience_level: { iniciante: "Iniciante", intermediario: "Intermediário", avancado: "Avançado" },
  train_location: { casa: "Em casa", academia: "Academia", ar_livre: "Ao ar livre", misto: "Casa e academia" },
};
const show = (f: FieldDef, v: unknown) => v == null || v === "" ? "Não informado" : f.type === "money" ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : f.type === "bool" ? (v ? "Sim" : "Não") : f.type === "select" ? (f.options?.find(o => o[0] === v)?.[1] || String(v)) : String(v);

export default function MyData() {
  const [data, setData] = useState<{ finance: Row | null; health: Row | null; onboarding: Row[] } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [msg, setMsg] = useState("");
  const load = useCallback(() => { fetch("/api/my-data").then(r => r.json()).then(setData).catch(() => setMsg("Não foi possível carregar seus dados.")); }, []);
  useEffect(() => { load(); }, [load]);

  async function saveField(f: FieldDef) {
    let value: unknown = draft.trim();
    if (f.type === "money") value = value === "" ? null : Number(String(value).replace(/\./g, "").replace(",", "."));
    if (f.type === "bool") value = draft === "true" ? true : draft === "false" ? false : null;
    if (value === "") value = null;
    if (f.type === "money" && value != null && !Number.isFinite(value as number)) { setMsg("Digite um valor válido."); return; }
    const r = await fetch("/api/my-data", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ field: f.key, value }) });
    const d = await r.json().catch(() => ({})); if (!r.ok) { setMsg(d.error || "Não foi possível salvar."); return; }
    setEditing(null); setMsg("Atualizado. A VIVA já vai considerar essa informação."); load();
  }
  async function remove(scope: "finance" | "personal") {
    const label = scope === "finance" ? "seu perfil financeiro e o diagnóstico" : "suas preferências do Personal";
    if (!window.confirm(`Excluir ${label}? Seus lançamentos, metas e registros de saúde continuam salvos.`)) return;
    const r = await fetch("/api/my-data?scope=" + scope, { method: "DELETE" });
    setMsg(r.ok ? "Dados excluídos." : "Não foi possível excluir."); load();
  }
  async function redo() {
    await fetch("/api/onboarding", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "finance", restart: true, consent: true }) });
    window.location.href = "/boas-vindas";
  }

  const fin = data?.finance; const cert = (fin?.certainty || {}) as Record<string, string>; const h = data?.health;
  const consent = (k: string) => data?.onboarding.find(o => o.kind === k)?.consent_at as string | undefined;
  return <div className="md-page">
    <header><span className="vc-eyebrow">MEUS DADOS</span><h1>O que a VIVA sabe sobre você</h1><p>Só você tem acesso a estas informações. Elas são usadas para personalizar o painel, a VIVA e o Personal, e você pode corrigir ou excluir tudo quando quiser.</p></header>
    {msg && <p className="md-msg" role="status">{msg}</p>}
    <section className="vc-card">
      <div className="md-head"><h2>Perfil financeiro</h2>{fin && <button className="vac-mini" onClick={redo}>Refazer diagnóstico</button>}</div>
      {!data ? <p className="vc-muted">Carregando…</p> : !fin ? <p className="vc-muted">Você ainda não fez o diagnóstico. <Link href="/boas-vindas">Fazer agora</Link></p> : <>
        <ul className="md-list">{FIN.map(f => <li key={f.key}>
          <span className="md-label">{f.label}</span>
          {editing === f.key ? <span className="md-edit">
            {f.type === "select" ? <select value={draft} onChange={e => setDraft(e.target.value)} aria-label={f.label}><option value="">Não informado</option>{f.options!.map(o => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select>
              : f.type === "bool" ? <select value={draft} onChange={e => setDraft(e.target.value)} aria-label={f.label}><option value="">Não informado</option><option value="true">Sim</option><option value="false">Não</option></select>
              : <input value={draft} onChange={e => setDraft(e.target.value)} inputMode={f.type === "money" ? "decimal" : "text"} aria-label={f.label} autoFocus />}
            <button className="vac-mini" onClick={() => saveField(f)}>Salvar</button><button className="ob-link" onClick={() => setEditing(null)}>Cancelar</button>
          </span> : <span className="md-value"><b>{show(f, fin[f.key])}</b>{f.cert && fin[f.key] != null && cert[f.cert] && <em className={"c-" + cert[f.cert]}>{CERT[cert[f.cert]]}</em>}<button className="ob-link" onClick={() => { setEditing(f.key); setDraft(fin[f.key] == null ? "" : String(fin[f.key])); }}>Editar</button></span>}
        </li>)}</ul>
        <p className="vc-muted">{consent("finance") ? `Consentimento registrado em ${new Date(consent("finance")!).toLocaleDateString("pt-BR")}.` : ""} Excluir o perfil não apaga seus lançamentos, contas e metas.</p>
        <button className="md-danger" onClick={() => remove("finance")}>Excluir perfil financeiro</button>
      </>}
    </section>
    <section className="vc-card">
      <div className="md-head"><h2>Personal com IA</h2><Link className="vac-mini" href="/saude?configurar=1">Ajustar</Link></div>
      {!h?.personal_onboarded_at ? <p className="vc-muted">Personal ainda não configurado. <Link href="/saude?configurar=1">Configurar agora</Link></p> : <>
        <ul className="md-list">
          <li><span className="md-label">Objetivo</span><b>{HEALTH.goal[String(h.goal)] || "—"}</b></li>
          <li><span className="md-label">Nível</span><b>{HEALTH.experience_level[String(h.experience_level)] || "—"}</b></li>
          <li><span className="md-label">Onde treina</span><b>{HEALTH.train_location[String(h.train_location)] || "—"}</b></li>
          <li><span className="md-label">Dias por semana</span><b>{String(h.weekly_workouts ?? "—")}</b></li>
          <li><span className="md-label">Tempo por treino</span><b>{h.session_minutes ? `${h.session_minutes} min` : "—"}</b></li>
          <li><span className="md-label">Limitações</span><b>{String(h.limitations || "Nenhuma informada")}</b></li>
        </ul>
        <p className="vc-muted">Dados de saúde ficam separados dos financeiros e nunca são usados pela VIVA financeira.</p>
        <button className="md-danger" onClick={() => remove("personal")}>Excluir dados do Personal</button>
      </>}
    </section>
  </div>;
}
