"use client";
import { useCallback, useEffect, useState } from "react";

const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const box: React.CSSProperties = { display: "grid", gap: 8, padding: 14, border: "1px solid #eadff7", borderRadius: 14, background: "#fbf8ff", marginTop: 12 };
const field: React.CSSProperties = { width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 10 };

/** Dentro de "Gerenciar" usuário: liberar o Pro de presente e transformar em parceiro. */
export function AdminUserGrowthTools({ userId, name, onChanged }: { userId: string; name: string; onChanged?: () => void }) {
  const [days, setDays] = useState(30);
  const [code, setCode] = useState(() => (name.split(/\s+/)[0] || "").normalize("NFD").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8));
  const [reward, setReward] = useState("10");
  const [limit, setLimit] = useState("");
  const [busy, setBusy] = useState<"" | "pro" | "partner">("");
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");

  async function grant() {
    if (!confirm(`Liberar o Pro por ${days} dias para ${name || "esta conta"}?`)) return;
    setBusy("pro"); setErr(""); setMsg("");
    const r = await fetch("/api/admin/grant-pro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: userId, days }) });
    const j = await r.json().catch(() => ({})); setBusy("");
    if (!r.ok) { setErr(j.error || "Não foi possível liberar."); return; }
    setMsg(`Pro liberado até ${new Date(j.ends_at).toLocaleDateString("pt-BR")}. Se o WhatsApp dela estiver conectado, a VIVA já avisou por lá.`); onChanged?.();
  }
  async function makePartner() {
    setBusy("partner"); setErr(""); setMsg("");
    const r = await fetch("/api/admin/partners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: userId, code, reward_brl: Number(reward.replace(",", ".")) || 0, monthly_limit_brl: limit.trim() ? Number(limit.replace(",", ".")) : null }) });
    const j = await r.json().catch(() => ({})); setBusy("");
    if (!r.ok) { setErr(j.error || "Não foi possível salvar."); return; }
    setMsg(`Parceiro salvo! Link: ${location.origin}/cadastro?convite=${j.code}`); onChanged?.();
  }

  return <>
    <div style={box}>
      <b>🎁 Liberar Pro de presente</b>
      <small style={{ color: "#666" }}>Sem cobrança. Ideal para o influenciador testar antes de divulgar. Se já tiver presente ativo, os dias são somados.</small>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[7, 30, 90, 365].map(d => <button key={d} type="button" className="viva-admin-save" style={{ opacity: days === d ? 1 : 0.55 }} onClick={() => setDays(d)}>{d === 365 ? "1 ano" : `${d} dias`}</button>)}
      </div>
      <button className="viva-admin-save" disabled={busy !== ""} onClick={grant}>{busy === "pro" ? "Liberando…" : `Liberar Pro por ${days === 365 ? "1 ano" : `${days} dias`}`}</button>
    </div>
    <div style={box}>
      <b>🤝 Tornar parceiro (influenciador)</b>
      <small style={{ color: "#666" }}>Código próprio para o link e valor por assinante. Deixe o limite em branco para não ter limite por mês.</small>
      <label>Código do link<input style={field} value={code} maxLength={12} onChange={e => setCode(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())} placeholder="EX.: JOAO10" /></label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label>R$ por assinante<input style={field} inputMode="decimal" value={reward} onChange={e => setReward(e.target.value)} /></label>
        <label>Limite por mês (R$)<input style={field} inputMode="decimal" value={limit} onChange={e => setLimit(e.target.value)} placeholder="Sem limite" /></label>
      </div>
      <button className="viva-admin-save" disabled={busy !== "" || code.length < 4} onClick={makePartner}>{busy === "partner" ? "Salvando…" : "Salvar parceiro"}</button>
    </div>
    {msg && <p role="status" style={{ color: "#0b6b37", fontWeight: 700, wordBreak: "break-all" }}>{msg}</p>}
    {err && <p role="alert" style={{ color: "#b42318" }}>{err}</p>}
  </>;
}

type Partner = { user_id: string; full_name: string; email: string; code: string | null; reward_cents: number; monthly_limit_cents: number | null; active: boolean; signups: number; paying: number; earned_cents: number; created_at: string };

/** Seção do painel: parceiros e resultados. */
export default function AdminPartners() {
  const [list, setList] = useState<Partner[] | null>(null); const [err, setErr] = useState(""); const [copied, setCopied] = useState("");
  const load = useCallback(() => {
    fetch("/api/admin/partners").then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error); setList(j.partners || []); })
      .catch(e => setErr(e instanceof Error ? e.message : "Erro ao carregar."));
  }, []);
  useEffect(() => { load(); }, [load]);
  const copy = async (code: string) => { try { await navigator.clipboard.writeText(`${location.origin}/cadastro?convite=${code}`); setCopied(code); setTimeout(() => setCopied(""), 2000); } catch { /* sem permissão */ } };
  return <section className="viva-admin-section">
    <div className="viva-admin-section-title"><div><h2>Parceiros e influenciadores</h2><p>Para criar um parceiro ou liberar o Pro, abra “Gerenciar” na conta da pessoa, em Usuários e acessos.</p></div><button className="viva-admin-save" onClick={load}>Atualizar</button></div>
    {err && <p role="alert" style={{ color: "#b42318" }}>{err}</p>}
    {!list ? <p>Carregando…</p> : list.length === 0 ? <p>Nenhum parceiro ainda.</p> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 680 }}>
      <thead><tr>{["Parceiro", "Código", "Por assinante", "Limite/mês", "Cadastros", "Assinaram", "A pagar/pago", ""].map(h => <th key={h} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #e8e2f0" }}>{h}</th>)}</tr></thead>
      <tbody>{list.map(p => <tr key={p.user_id} style={{ borderBottom: "1px solid #eee", opacity: p.active ? 1 : 0.5 }}>
        <td style={{ padding: 10 }}><b>{p.full_name || "Sem nome"}</b><div>{p.email}</div></td>
        <td><code>{p.code || "—"}</code></td><td>{reais(p.reward_cents)}</td><td>{p.monthly_limit_cents == null ? "Sem limite" : reais(p.monthly_limit_cents)}</td>
        <td>{p.signups}</td><td>{p.paying}</td><td>{reais(p.earned_cents)}</td>
        <td>{p.code && <button className="viva-admin-save" onClick={() => copy(p.code!)}>{copied === p.code ? "Copiado ✓" : "Copiar link"}</button>}</td>
      </tr>)}</tbody></table></div>}
  </section>;
}
