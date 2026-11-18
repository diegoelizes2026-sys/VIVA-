"use client";
import { useEffect, useState } from "react";

type Report = { signups: number; started: number; completed: number; skipped: number; in_progress: number; abandoned: number; abandon_rate: number; personal_completed: number;
  free_users: number; pro_users: number; conversions: number; conversion_rate: number; onboarding_credits: number; ai_cost_per_user_brl: number;
  top_goals: { goal: string; users: number }[]; focus: Record<string, number>; daily: { day: string; signups: number; completed: number }[] };
const GOAL: Record<string, string> = { sair_dividas: "Sair das dívidas", economizar: "Economizar todo mês", reserva: "Reserva de emergência", comprar_bem: "Comprar um bem", organizar: "Organizar as contas" };
const FOCUS: Record<string, string> = { debts: "Dívidas", spending: "Controle de gastos", variable: "Renda variável", saving: "Poupança", organize: "Organização" };
const brl = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 4 });

export default function AdminOnboarding() {
  const [days, setDays] = useState(30); const [r, setR] = useState<Report | null>(null); const [err, setErr] = useState("");
  useEffect(() => { fetch("/api/admin/onboarding?days=" + days).then(async x => { const d = await x.json(); if (!x.ok) throw new Error(d.error); setR(d); setErr(""); }).catch(e => setErr(e.message || "Erro ao carregar.")); }, [days]);
  const max = Math.max(1, ...(r?.daily || []).map(d => Math.max(d.signups, d.completed)));
  const funnel: [string, number][] = r ? [["Cadastros", r.signups], ["Iniciaram", r.started], ["Concluíram", r.completed], ["Assinaram o Pro", r.conversions]] : [];
  const top = Math.max(1, ...funnel.map(f => f[1]));
  return <section className="viva-admin-section vac">
    <div className="viva-admin-section-title vao-title"><div><h2>Primeiro acesso e conversão</h2><p>Eficiência da experiência de entrada. Dados agregados, sem informações individuais.</p></div>
      <select aria-label="Período" value={days} onChange={e => setDays(Number(e.target.value))}><option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option><option value={365}>12 meses</option></select></div>
    {err && <p className="vac-err" role="alert">{err}</p>}
    {r && <>
      <div className="vac-kpis">
        <article><span>Novos cadastros</span><strong>{r.signups}</strong></article>
        <article><span>Onboardings iniciados</span><strong>{r.started}</strong></article>
        <article><span>Onboardings concluídos</span><strong>{r.completed}</strong></article>
        <article className={r.abandon_rate > 50 ? "warn" : ""}><span>Taxa de abandono</span><strong>{r.abandon_rate}%</strong></article>
        <article><span>Usuários Free / Pro</span><strong>{r.free_users} / {r.pro_users}</strong></article>
        <article><span>Conversões Free → Pro</span><strong>{r.conversions} <small>({r.conversion_rate}%)</small></strong></article>
        <article><span>Créditos usados no onboarding</span><strong>{r.onboarding_credits}</strong></article>
        <article><span>Custo de IA por usuário</span><strong>{brl(r.ai_cost_per_user_brl)}</strong></article>
        <article><span>Personal configurado</span><strong>{r.personal_completed}</strong></article>
      </div>
      <div className="vao-grid">
        <div className="vao-card"><h3 className="vac-h">Funil de entrada</h3><ul className="vao-funnel">{funnel.map(([l, n]) => <li key={l}><span>{l}</span><i style={{ width: Math.max(2, (n / top) * 100) + "%" }} /><b>{n}</b></li>)}</ul>
          <p className="vac-sub">{r.in_progress} em andamento · {r.abandoned} parados há mais de 24h · {r.skipped} pularam</p></div>
        <div className="vao-card"><h3 className="vac-h">Últimos 14 dias</h3><div className="vao-bars" role="img" aria-label="Cadastros e onboardings concluídos por dia">{r.daily.map(d => <div key={d.day} title={`${new Date(d.day + "T12:00:00").toLocaleDateString("pt-BR")}: ${d.signups} cadastros, ${d.completed} concluídos`}><i className="a" style={{ height: (d.signups / max) * 100 + "%" }} /><i className="b" style={{ height: (d.completed / max) * 100 + "%" }} /><small>{d.day.slice(8, 10)}</small></div>)}</div>
          <p className="vao-legend"><span className="a" />Cadastros <span className="b" />Concluídos</p></div>
        <div className="vao-card"><h3 className="vac-h">Principais objetivos</h3>{r.top_goals.length ? <ul className="vao-list">{r.top_goals.map(g => <li key={g.goal}><span>{GOAL[g.goal] || g.goal}</span><b>{g.users}</b></li>)}</ul> : <p className="vac-sub">Ainda sem diagnósticos concluídos.</p>}</div>
        <div className="vao-card"><h3 className="vac-h">Foco dos usuários</h3>{Object.keys(r.focus).length ? <ul className="vao-list">{Object.entries(r.focus).sort((a, b) => b[1] - a[1]).map(([k, n]) => <li key={k}><span>{FOCUS[k] || k}</span><b>{n}</b></li>)}</ul> : <p className="vac-sub">Ainda sem diagnósticos concluídos.</p>}</div>
      </div>
    </>}
  </section>;
}
