"use client";
import { useCallback, useEffect, useState } from "react";

// Saques da indicação paga: a equipe confere, faz o Pix pelo banco e marca como pago (ou recusa).
type Friend = { email: string; created_at: string; paid_at: string | null; amount_brl: number | null; payment_status: string | null };
type Payout = { id: string; user_id: string; amount_cents: number; pix_key_type: string; pix_key: string; status: string; created_at: string; decided_at: string | null; admin_note: string | null; name: string; email: string; friends: Friend[] | null };
const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const TYPE: Record<string, string> = { cpf: "CPF", phone: "Celular", email: "E-mail", random: "Aleatória" };
const STATUS: Record<string, string> = { requested: "Aguardando", paid: "Pago", rejected: "Recusado" };

export default function AdminPayouts() {
  const [status, setStatus] = useState("requested"); const [list, setList] = useState<Payout[]>([]); const [err, setErr] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(""); const [copied, setCopied] = useState("");
  const load = useCallback(() => {
    fetch("/api/admin/payouts?status=" + status).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setList(d.payouts || []); setErr(""); })
      .catch(e => setErr(e.message || "Erro ao carregar."));
  }, [status]);
  useEffect(() => { load(); }, [load]);
  const decide = async (id: string, decision: "paid" | "rejected") => {
    if (decision === "paid" && !confirm("Confirma que o Pix já foi enviado?")) return;
    setBusy(id);
    const r = await fetch("/api/admin/payouts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, decision, note: notes[id] || undefined }) });
    const d = await r.json().catch(() => ({})); setBusy("");
    if (!r.ok) { setErr(d.error || "Erro ao salvar."); return; }
    load();
  };
  const copy = async (id: string, key: string) => { try { await navigator.clipboard.writeText(key); setCopied(id); setTimeout(() => setCopied(""), 1500); } catch { /* */ } };
  return <section className="viva-admin-section">
    <div className="viva-admin-section-title vao-title"><div><h2>Saques da indicação paga</h2><p>R$ 10 por amigo que pagou o Pro, liberados após 30 dias. Faça o Pix pelo banco e marque como pago.</p></div>
      <select aria-label="Situação" value={status} onChange={e => setStatus(e.target.value)}><option value="requested">Aguardando</option><option value="paid">Pagos</option><option value="rejected">Recusados</option><option value="all">Todos</option></select></div>
    {err && <p className="vac-err" role="alert">{err}</p>}
    {list.length === 0 && !err && <p style={{ color: "#666" }}>Nenhum saque {status === "requested" ? "aguardando" : "nesta lista"}.</p>}
    <div className="vpo-list">{list.map(p => <article key={p.id} className="vpo-item">
      <div className="vpo-top"><div><strong>{reais(p.amount_cents)}</strong> · {STATUS[p.status] || p.status}<br /><small>{p.name || "Sem nome"} · {p.email} · pedido em {new Date(p.created_at).toLocaleString("pt-BR")}</small></div></div>
      <div className="vpo-key"><span>Pix ({TYPE[p.pix_key_type] || p.pix_key_type}): {p.pix_key}</span><button onClick={() => copy(p.id, p.pix_key)}>{copied === p.id ? "Copiado" : "Copiar"}</button></div>
      {p.friends && p.friends.length > 0 && <ul className="vpo-friends">{p.friends.map((f, i) => <li key={i}>{f.email} · pagou {f.amount_brl != null ? Number(f.amount_brl).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "?"}{f.paid_at ? ` em ${new Date(f.paid_at).toLocaleDateString("pt-BR")}` : ""} · {f.payment_status}</li>)}</ul>}
      {p.status === "requested" ? <div className="vpo-actions">
        <input placeholder="Observação (opcional, o usuário vê se recusar)" maxLength={300} value={notes[p.id] || ""} onChange={e => setNotes({ ...notes, [p.id]: e.target.value })} />
        <button className="pay" disabled={busy === p.id} onClick={() => decide(p.id, "paid")}>Marcar como pago</button>
        <button className="rej" disabled={busy === p.id} onClick={() => decide(p.id, "rejected")}>Recusar</button>
      </div> : <small>{p.decided_at ? `Decidido em ${new Date(p.decided_at).toLocaleString("pt-BR")}` : ""}{p.admin_note ? ` · ${p.admin_note}` : ""}</small>}
    </article>)}</div>
  </section>;
}
