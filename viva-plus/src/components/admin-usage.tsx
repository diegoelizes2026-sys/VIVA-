"use client";
import { useEffect, useState } from "react";

type Usage = {
  today: string; tracking_since: string | null;
  active_today: number; active_7d: number; active_30d: number; users_total: number;
  d1: { back: number; total: number }; d7: { back: number; total: number };
  daily: { day: string; active: number; new: number }[];
  top: { path: string; users: number; hits: number }[];
};

const LABELS: Record<string, string> = {
  "/meu-dia": "Meu dia (tela inicial)", "/assistente": "Chat com a VIVA", "/financas": "Meu dinheiro", "/planejamento": "Planejamento",
  "/contas": "Contas a pagar", "/lista-de-compras": "Lista de compras", "/perto": "Perto de mim", "/economizar": "Radar de preços",
  "/agenda": "Agenda", "/saude": "Saúde", "/indique": "Indique e ganhe", "/planos": "Planos", "/creditos": "Créditos",
  "/configuracoes": "Configurações", "/perfil": "Minha conta", "/meus-dados": "Meus dados", "/admin": "Admin",
  "acao:1-toque": "⚡ Lançou gasto em 1 toque", "acao:posso-comprar": "🛍️ Perguntou “Posso comprar?”", "acao:vitoria": "🎉 Compartilhou vitória",
  "acao:conta-paga": "🧾 Marcou conta como paga", "acao:setup-1-minuto": "⏱️ Configurou o valor do dia",
};
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) + "%" : "—");
const dm = (iso: string) => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };

export default function AdminUsage() {
  const [u, setU] = useState<Usage | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/admin/usage", { cache: "no-store" }).then(async r => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Não foi possível carregar o uso.");
      setU(d as Usage);
    }).catch(e => setError(e instanceof Error ? e.message : "Erro."));
  }, []);

  if (error) return <section className="vau"><h2>Uso do app</h2><p className="vau-note">{error}</p></section>;
  if (!u) return <section className="vau"><h2>Uso do app</h2><p className="vau-note">Carregando…</p></section>;
  const max = Math.max(1, ...u.daily.map(d => Math.max(d.active, d.new)));
  return <section className="vau">
    <h2>Uso do app</h2>
    <p className="vau-note">{u.tracking_since ? `Contando desde ${dm(u.tracking_since)}. A retenção fica confiável depois de algumas semanas de dados.` : "Ainda sem visitas registradas. Os números aparecem a partir dos próximos acessos."}</p>
    <div className="vau-grid">
      <article><span>Ativos hoje</span><strong>{u.active_today}</strong></article>
      <article><span>Ativos em 7 dias</span><strong>{u.active_7d}</strong></article>
      <article><span>Ativos em 30 dias</span><strong>{u.active_30d}</strong></article>
      <article><span>Contas criadas</span><strong>{u.users_total}</strong></article>
    </div>
    <div className="vau-grid two">
      <article><span>Voltaram no dia seguinte ao cadastro</span><strong>{pct(u.d1.back, u.d1.total)}</strong><small>{u.d1.back} de {u.d1.total} cadastros</small></article>
      <article><span>Voltaram na 2ª semana</span><strong>{pct(u.d7.back, u.d7.total)}</strong><small>{u.d7.back} de {u.d7.total} cadastros</small></article>
    </div>
    <h3>Últimos 14 dias</h3>
    <div className="vau-bars" role="img" aria-label="Pessoas ativas e novos cadastros por dia">
      {u.daily.map(d => <div key={d.day} title={`${dm(d.day)}: ${d.active} ativos, ${d.new} novos`}>
        <i className="a" style={{ height: `${(d.active / max) * 100}%` }} /><i className="n" style={{ height: `${(d.new / max) * 100}%` }} /><small>{dm(d.day).slice(0, 2)}</small>
      </div>)}
    </div>
    <p className="vau-legend"><i className="a" /> ativos <i className="n" /> novos cadastros</p>
    <h3>Mais usado (7 dias)</h3>
    {u.top.length ? <ol className="vau-top">{u.top.map(t => <li key={t.path}><span>{LABELS[t.path] || t.path}</span><b>{t.users} {t.users === 1 ? "pessoa" : "pessoas"}</b></li>)}</ol>
      : <p className="vau-note">Sem dados ainda.</p>}
  </section>;
}
