"use client";
import { useCallback, useEffect, useState } from "react";

type Msg = { direction: "in" | "out"; kind: string; step: number | null; body: string; status: string; error: string | null; created_at: string };
type Lead = { id: string; name: string; whatsapp: string; goal: string; wants_health: string; result: { level?: string; daily?: number | null }; marketing_opt_in: boolean; consent_at: string | null; consent_text: string | null;
  utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; followup_status: string; followup_step: number; next_send_at: string | null; last_sent_at: string | null;
  opted_out_at: string | null; converted_at: string | null; replies_count: number; last_reply_at: string | null; needs_human: boolean; created_at: string; messages: Msg[] };
type Data = { days: number; funnel: Record<string, number>; bySource: Record<string, Record<string, number>>; totals: Record<string, number>; leads: Lead[];
  settings: { paused: boolean; testWhatsapp: string | null }; templates: { name: string; step: number; goal: string | null; category: string; body: string }[] };

const SITE = "https://www.vivamaiss.app.br/diagnostico";
const UTMS = [
  ["Instagram · bio", "utm_source=instagram&utm_medium=bio&utm_campaign=diagnostico"],
  ["Instagram · stories", "utm_source=instagram&utm_medium=stories&utm_campaign=diagnostico"],
  ["Instagram · post/reels", "utm_source=instagram&utm_medium=post&utm_campaign=diagnostico"],
  ["Instagram · anúncio", "utm_source=instagram&utm_medium=paid&utm_campaign=diagnostico"],
  ["WhatsApp · status", "utm_source=whatsapp&utm_medium=status&utm_campaign=diagnostico"],
];
const STATUS: Record<string, string> = { pending: "Aguardando 1º envio", active: "Em sequência", done: "Sequência concluída", opted_out: "Saiu (SAIR)", converted: "Criou conta", not_eligible: "Sem consentimento", failed: "Falhou" };
const LEVEL: Record<string, string> = { atencao: "Atenção", construcao: "Em construção", caminho: "No caminho certo" };
const GOAL: Record<string, string> = { dividas: "Sair das dívidas", reserva: "Reserva", comprar: "Comprar algo", organizar: "Organizar" };
const dt = (s: string | null) => (s ? new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Fortaleza" }) : "—");
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) + "%" : "—");
const phone = (w: string) => w.replace(/^55(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");

/** Painel do Diagnóstico Financeiro Grátis (só administrador). */
export default function AdminDiagnostic() {
  const [d, setD] = useState<Data | null>(null);
  const [days, setDays] = useState(30);
  const [err, setErr] = useState(""); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState("");
  const [test, setTest] = useState(""); const [goal, setGoal] = useState("dividas");
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState("todos");
  const [testOut, setTestOut] = useState<{ step: number; template: string; text: string; ok: boolean; error: string | null }[] | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/diagnostic?dias=" + days, { cache: "no-store" }).then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Erro ao carregar."); setD(j); if (j.settings?.testWhatsapp) setTest(phone(j.settings.testWhatsapp)); })
      .catch(e => setErr(e instanceof Error ? e.message : "Erro ao carregar."));
  }, [days]);
  useEffect(() => { load(); }, [load]);

  async function act(body: Record<string, unknown>, ok?: string) {
    setBusy(String(body.action)); setErr(""); setMsg("");
    const r = await fetch("/api/admin/diagnostic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({})); setBusy("");
    if (!r.ok) { setErr(j.error || "Não foi possível."); return null; }
    if (ok) setMsg(ok); load(); return j;
  }
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); setMsg("Link copiado."); } catch { setMsg(t); } };

  if (!d) return <section className="viva-admin-section"><div className="viva-admin-section-title"><div><h2>Diagnóstico Financeiro</h2></div></div>{err ? <p role="alert" style={{ color: "#b42318" }}>{err}</p> : <p>Carregando…</p>}</section>;
  const f = d.funnel; const start = f.quiz_start || 0;
  const steps: [string, string][] = [["quiz_start", "Começaram"], ["q1", "P1"], ["q2", "P2"], ["q3", "P3"], ["q4", "P4"], ["q5", "P5"], ["q6", "P6"], ["q7", "P7"], ["lead", "Deixaram contato"], ["result", "Viram resultado"], ["cta_signup", "Clicaram Criar conta"], ["cta_whatsapp", "Clicaram WhatsApp"], ["share", "Compartilharam"]];
  const leads = d.leads.filter(l => filter === "todos" ? true : filter === "consent" ? l.marketing_opt_in : filter === "human" ? l.needs_human : filter === "saiu" ? l.opted_out_at : filter === "conta" ? l.converted_at : true);
  const box = { padding: 12, border: "1px solid #eee6f8", borderRadius: 14, background: "#fff" } as const;

  return <section className="viva-admin-section">
    <div className="viva-admin-section-title"><div><h2>Diagnóstico Financeiro Grátis</h2><p>Página <b>/diagnostico</b>. Funil por visitas únicas, leads e acompanhamento automático no WhatsApp.</p></div>
      <div style={{ display: "flex", gap: 8 }}><select value={days} onChange={e => setDays(Number(e.target.value))} aria-label="Período"><option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option></select><button className="viva-admin-save" onClick={load}>Atualizar</button></div></div>
    {msg && <p role="status" style={{ color: "#0b6b37", fontWeight: 700 }}>{msg}</p>}
    {err && <p role="alert" style={{ color: "#b42318" }}>{err}</p>}

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
      {[["Fizeram o quiz (começaram)", start], ["Viram o resultado", f.result || 0], ["Leads", d.totals.leads], ["Aceitaram mensagens", d.totals.optIn], ["Criaram conta", d.totals.converted], ["Saíram (SAIR)", d.totals.optedOut], ["Precisam de atendente", d.totals.needsHuman], ["Mensagens enviadas", d.totals.sent], ["Envios com falha", d.totals.failed]].map(([l, v]) =>
        <div key={String(l)} style={box}><small style={{ color: "#6f6680" }}>{l}</small><b style={{ display: "block", fontSize: 24 }}>{v}</b></div>)}
    </div>

    <h3 style={{ marginTop: 18 }}>Funil (últimos {d.days} dias)</h3>
    <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", fontSize: 13, minWidth: 620 }}><thead><tr><th style={{ textAlign: "left", padding: 6 }}>Origem</th>{steps.map(([, l]) => <th key={l} style={{ padding: 6 }}>{l}</th>)}</tr></thead>
      <tbody>
        <tr style={{ fontWeight: 800 }}><td style={{ padding: 6 }}>Total</td>{steps.map(([k]) => <td key={k} style={{ padding: 6, textAlign: "center" }}>{f[k] || 0}<br /><small style={{ color: "#6f6680", fontWeight: 500 }}>{k === "quiz_start" ? "" : pct(f[k] || 0, start)}</small></td>)}</tr>
        {Object.entries(d.bySource).sort((a, b) => (b[1].quiz_start || 0) - (a[1].quiz_start || 0)).map(([s, m]) => <tr key={s} style={{ borderTop: "1px solid #eee6f8" }}><td style={{ padding: 6 }}>{s}</td>{steps.map(([k]) => <td key={k} style={{ padding: 6, textAlign: "center" }}>{m[k] || 0}</td>)}</tr>)}
      </tbody></table></div>

    <h3 style={{ marginTop: 18 }}>Links com tags de campanha</h3>
    <div style={{ display: "grid", gap: 6 }}>{UTMS.map(([l, q]) => <div key={l} style={{ ...box, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><b style={{ minWidth: 160 }}>{l}</b><code style={{ flex: 1, fontSize: 12, overflowWrap: "anywhere" }}>{SITE}?{q}</code><button className="viva-admin-save" onClick={() => copy(`${SITE}?${q}`)}>Copiar</button></div>)}</div>

    <h3 style={{ marginTop: 18 }}>Mensagens automáticas no WhatsApp</h3>
    <div style={{ ...box, display: "grid", gap: 10, borderColor: d.settings.paused ? "#f2c4c4" : "#b7ecd0", background: d.settings.paused ? "#fff7f7" : "#f1fbf5" }}>
      <b>{d.settings.paused ? "Envios automáticos PAUSADOS" : "Envios automáticos ATIVOS"}</b>
      <span style={{ fontSize: 13 }}>Só para quem marcou a caixa de mensagens · 9h às 20h · no máximo 1 por dia · para com SAIR ou quando a pessoa cria conta. Respostas da pessoa são respondidas pela VIVA (assistente virtual) mesmo com a pausa.</span>
      <div><button className="viva-admin-save" style={d.settings.paused ? {} : { background: "#b42318" }} disabled={busy === "pause"} onClick={() => act({ action: "pause", paused: !d.settings.paused }, d.settings.paused ? "Envios ativados." : "Todos os envios foram pausados.")}>{d.settings.paused ? "Ativar envios" : "Pausar todos os envios"}</button></div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>Meu número de teste<input inputMode="tel" value={test} onChange={e => setTest(e.target.value)} placeholder="(85) 99999-0000" style={{ height: 40, padding: "0 10px", borderRadius: 10, border: "1px solid #e4d8f5" }} /></label>
        <button className="viva-admin-save" disabled={busy === "test_number"} onClick={() => act({ action: "test_number", whatsapp: test }, "Número de teste salvo.")}>Salvar número</button>
        <select value={goal} onChange={e => setGoal(e.target.value)} aria-label="Objetivo do teste">{Object.entries(GOAL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <button className="viva-admin-save" disabled={busy === "send_test" || !d.settings.testWhatsapp} onClick={async () => { const j = await act({ action: "send_test", goal }); if (j) { setTestOut(j.results); setMsg("Teste enviado para o seu número. Confira o WhatsApp."); } }}>{busy === "send_test" ? "Enviando…" : "Enviar sequência de teste"}</button>
      </div>
      {testOut && <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>{testOut.map(t => <li key={t.step}><b>Passo {t.step} ({t.template}):</b> {t.ok ? "enviado ✓" : "falhou: " + t.error}</li>)}</ul>}
    </div>

    <details style={{ ...box, marginTop: 8 }}><summary style={{ cursor: "pointer", fontWeight: 800 }}>Textos dos modelos (cadastrar e aprovar na Meta com estes nomes, idioma Português (BR), categoria Marketing)</summary>
      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>{d.templates.map(t => <div key={t.name} style={{ padding: 10, borderRadius: 10, background: "#faf7fe", fontSize: 13 }}><b>{t.name}</b> · passo {t.step}{t.goal ? ` · objetivo: ${GOAL[t.goal]}` : ""}<p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{t.body}</p></div>)}</div></details>

    <h3 style={{ marginTop: 18 }}>Contatos ({leads.length})</h3>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{[["todos", "Todos"], ["consent", "Aceitaram mensagens"], ["human", "Precisam de atendente"], ["saiu", "Saíram"], ["conta", "Criaram conta"]].map(([k, l]) => <button key={k} onClick={() => setFilter(k)} className="viva-admin-save" style={filter === k ? {} : { background: "#fff", color: "#6410C9", border: "1px solid #e4d8f5" }}>{l}</button>)}</div>
    <div style={{ display: "grid", gap: 8, marginTop: 8 }}>{leads.map(l => <div key={l.id} style={{ ...box, borderColor: l.needs_human ? "#f5c26b" : "#eee6f8" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", alignItems: "baseline", fontSize: 13 }}>
        <b style={{ fontSize: 15 }}>{l.name}</b>
        <a href={`https://wa.me/${l.whatsapp}`} target="_blank" rel="noopener noreferrer" style={{ color: "#0f7a3d", fontWeight: 700 }}>{phone(l.whatsapp)}</a>
        <span>{dt(l.created_at)}</span><span>Origem: {l.utm_source || "direto"}{l.utm_medium ? " / " + l.utm_medium : ""}</span>
        <span>{LEVEL[l.result?.level || ""] || "—"} · {GOAL[l.goal] || l.goal}{l.wants_health === "sim" ? " · quer saúde" : ""}</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 13, marginTop: 4 }}>
        <span>{l.marketing_opt_in ? `Aceitou mensagens em ${dt(l.consent_at)}` : l.opted_out_at ? "" : "Não aceitou mensagens"}</span>
        <span><b>{STATUS[l.followup_status] || l.followup_status}</b>{l.followup_step ? ` · passo ${l.followup_step}/4` : ""}{l.next_send_at ? ` · próximo: ${dt(l.next_send_at)}` : ""}</span>
        {l.opted_out_at && <span style={{ color: "#b42318" }}>Saiu em {dt(l.opted_out_at)}</span>}
        {l.converted_at && <span style={{ color: "#0b6b37" }}>Criou conta em {dt(l.converted_at)}</span>}
        <span>{l.replies_count} resposta{l.replies_count === 1 ? "" : "s"}</span>
        {l.needs_human && <span style={{ color: "#8a5300", fontWeight: 800 }}>Precisa de atendente <button className="viva-admin-save" style={{ padding: "2px 8px" }} onClick={() => act({ action: "resolve", id: l.id }, "Marcado como atendido.")}>Atendido</button></span>}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        {l.messages.length > 0 && <button className="viva-admin-save" style={{ background: "#fff", color: "#6410C9", border: "1px solid #e4d8f5" }} onClick={() => setOpen(open === l.id ? null : l.id)}>{open === l.id ? "Fechar conversa" : `Ver conversa (${l.messages.length})`}</button>}
        <button className="viva-admin-save" style={{ background: "#fff", color: "#b42318", border: "1px solid #f2c4c4" }} onClick={() => { if (window.confirm(`Apagar todos os dados de ${l.name}?`)) act({ action: "delete", id: l.id }, "Dados apagados."); }}>Apagar dados</button>
      </div>
      {open === l.id && <div style={{ display: "grid", gap: 6, marginTop: 8 }}>{l.messages.map((m, i) => <div key={i} style={{ justifySelf: m.direction === "in" ? "start" : "end", maxWidth: "85%", padding: "8px 10px", borderRadius: 12, background: m.direction === "in" ? "#f3f4f6" : m.status === "failed" ? "#fff1f1" : "#f3ebfd", fontSize: 13 }}>
        <small style={{ color: "#6f6680" }}>{dt(m.created_at)} · {m.direction === "in" ? "pessoa" : m.kind === "template" ? `modelo passo ${m.step}` : m.kind === "ai" ? "VIVA (IA)" : "VIVA"}{m.status === "failed" ? " · FALHOU: " + (m.error || "") : ""}</small>
        <p style={{ margin: "2px 0 0", whiteSpace: "pre-wrap" }}>{m.body}</p></div>)}</div>}
    </div>)}</div>
  </section>;
}
