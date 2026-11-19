"use client";
import { useCallback, useEffect, useState } from "react";

type Plan = { id: string; name: string; monthly_price_brl: number; annual_price_brl: number; monthly_credits: number; signup_credits: number; history_days: number | null; rollover_credits: boolean; is_public: boolean; enabled: boolean };
type Operation = { key: string; label: string; credits: number; pro_only: boolean; enabled: boolean };
type Settings = { rate_limit_per_minute: number; abnormal_credits_per_hour: number; warn_threshold_1: number; warn_threshold_2: number };
type Overview = { free_users: number; pro_users: number; credits_month: number; ai_cost_month_brl: number; ai_cost_total_brl: number; tokens_in_month: number; tokens_out_month: number; revenue_month_brl: number; margin_month_brl: number; heavy_users_24h: number; plans: Plan[]; operations: Operation[]; settings: Settings };
type UserRow = { user_id: string; full_name: string; email: string; plan_id: string; balance: number; reserved: number; cycle_granted: number; cycle_used: number; next_renewal_at: string | null; credits_month: number; tokens_in_month: number; tokens_out_month: number; cost_month_brl: number; cost_total_brl: number; credits_24h: number; high_usage: boolean };
type LedgerRow = { id: string; kind: string; amount: number; balance_after: number; description: string | null; tokens_in: number; tokens_out: number; cost_brl: number; created_at: string };

const brl = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const num = (v: number) => Number(v || 0).toLocaleString("pt-BR");
const when = (v: string | null) => v ? new Date(v).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "—";
const KIND: Record<string, string> = { signup_bonus: "Boas-vindas", monthly_renewal: "Renovação Free", plan_renewal: "Ciclo do plano", consumption: "Consumo", expiration: "Expiração", admin_grant: "Adição manual", admin_revoke: "Remoção manual", extra_purchase: "Extra", adjustment: "Ajuste" };
const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now()).replace(/[^A-Za-z0-9_-]/g, "");

async function call(method: string, body?: unknown, query = "") {
  const r = await fetch("/api/admin/credits" + query, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Falha na operação.");
  return d;
}

export default function AdminCredits() {
  const [ov, setOv] = useState<Overview | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [ops, setOps] = useState<Operation[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState(""); const [plan, setPlan] = useState(""); const [sort, setSort] = useState("cost"); const [offset, setOffset] = useState(0);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const [open, setOpen] = useState<UserRow | null>(null);

  const loadOverview = useCallback(async () => {
    try { const d: Overview = await call("GET", undefined, "?view=overview"); setOv(d); setPlans(d.plans || []); setOps((d.operations || [])); setSettings(d.settings); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro ao carregar."); }
  }, []);
  const loadUsers = useCallback(async () => {
    try { const d = await call("GET", undefined, `?view=users&q=${encodeURIComponent(q)}&plan=${plan}&sort=${sort}&limit=25&offset=${offset}`); setUsers(d.users); setTotal(d.total); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro ao carregar usuários."); }
  }, [q, plan, sort, offset]);
  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => { const t = setTimeout(loadUsers, 250); return () => clearTimeout(t); }, [loadUsers]);

  async function save(body: unknown, label: string) {
    setMsg(""); setErr("");
    try { await call("PUT", body); setMsg(label + " salvo."); loadOverview(); } catch (e) { setErr(e instanceof Error ? e.message : "Erro ao salvar."); }
  }
  const setPlanField = (id: string, patch: Partial<Plan>) => setPlans(ps => ps.map(p => p.id === id ? { ...p, ...patch } : p));
  const setOpField = (key: string, patch: Partial<Operation>) => setOps(os => os.map(o => o.key === key ? { ...o, ...patch } : o));

  return <section className="viva-admin-section vac">
    <div className="viva-admin-section-title"><div><h2>GERENCIAMENTO DE CRÉDITOS</h2><p>Planos, custo por operação, saldos e consumo de IA. Tudo validado no servidor.</p></div></div>
    {err && <p className="vac-err" role="alert">{err}</p>}{msg && <p className="viva-admin-notice" role="status">{msg}</p>}

    {ov && <div className="vac-kpis">
      <article><span>Usuários Free</span><strong>{num(ov.free_users)}</strong></article>
      <article><span>Assinantes pagos</span><strong>{num(ov.pro_users)}</strong></article>
      <article><span>Créditos consumidos no mês</span><strong>{num(ov.credits_month)}</strong></article>
      <article><span>Custo estimado da IA (mês)</span><strong>{brl(ov.ai_cost_month_brl)}</strong></article>
      <article><span>Receita de assinaturas (mês)</span><strong>{brl(ov.revenue_month_brl)}</strong></article>
      <article className={ov.margin_month_brl < 0 ? "neg" : ""}><span>Margem estimada (mês)</span><strong>{brl(ov.margin_month_brl)}</strong></article>
      <article><span>Custo total OpenAI</span><strong>{brl(ov.ai_cost_total_brl)}</strong></article>
      <article><span>Tokens no mês (entrada / saída)</span><strong className="small">{num(ov.tokens_in_month)} / {num(ov.tokens_out_month)}</strong></article>
      <article className={ov.heavy_users_24h ? "warn" : ""}><span>Consumo elevado (24h)</span><strong>{num(ov.heavy_users_24h)}</strong></article>
    </div>}

    <h3 className="vac-h">Créditos e preços dos planos</h3>
    <div className="vac-plans">{plans.map(p => <article key={p.id}>
      <div className="vac-plan-head"><b>{p.name}</b><span>{p.id}{!p.is_public ? " · fora da vitrine" : ""}</span></div>
      <div className="vac-fields">
        <label>Preço mensal (R$)<input type="number" min="0" step="0.01" value={p.monthly_price_brl} onChange={e => setPlanField(p.id, { monthly_price_brl: Number(e.target.value) })} /></label>
        <label>Preço anual (R$)<input type="number" min="0" step="0.01" value={p.annual_price_brl} onChange={e => setPlanField(p.id, { annual_price_brl: Number(e.target.value) })} /></label>
        <label>Créditos por mês<input type="number" min="0" value={p.monthly_credits} onChange={e => setPlanField(p.id, { monthly_credits: Number(e.target.value) })} /></label>
        <label>Créditos de cadastro<input type="number" min="0" value={p.signup_credits} onChange={e => setPlanField(p.id, { signup_credits: Number(e.target.value) })} /></label>
        <label>Histórico (dias, vazio = completo)<input type="number" min="1" value={p.history_days ?? ""} onChange={e => setPlanField(p.id, { history_days: e.target.value ? Number(e.target.value) : null })} /></label>
      </div>
      <div className="vac-flags">
        <label><input type="checkbox" checked={p.rollover_credits} onChange={e => setPlanField(p.id, { rollover_credits: e.target.checked })} /> Acumular créditos não usados</label>
        <label><input type="checkbox" checked={p.is_public} onChange={e => setPlanField(p.id, { is_public: e.target.checked })} /> Mostrar na página de planos</label>
      </div>
      <button className="viva-admin-save" onClick={() => save({ kind: "plan", id: p.id, monthly_price_brl: p.monthly_price_brl, annual_price_brl: p.annual_price_brl, monthly_credits: p.monthly_credits, signup_credits: p.signup_credits, history_days: p.history_days, rollover_credits: p.rollover_credits, is_public: p.is_public }, "Plano " + p.name)}>Salvar {p.name}</button>
    </article>)}</div>

    <h3 className="vac-h">Consumo por operação</h3>
    <div className="vac-scroll"><table className="vac-table"><thead><tr><th>Operação</th><th>Créditos</th><th>Só Pro</th><th>Ativa</th><th /></tr></thead><tbody>
      {ops.map(o => <tr key={o.key}><td><b>{o.label}</b><small>{o.key}</small></td>
        <td><input aria-label={"Créditos de " + o.label} type="number" min="0" max="1000" value={o.credits} onChange={e => setOpField(o.key, { credits: Number(e.target.value) })} /></td>
        <td><input aria-label={"Somente Pro: " + o.label} type="checkbox" checked={o.pro_only} onChange={e => setOpField(o.key, { pro_only: e.target.checked })} /></td>
        <td><input aria-label={"Ativa: " + o.label} type="checkbox" checked={o.enabled} onChange={e => setOpField(o.key, { enabled: e.target.checked })} /></td>
        <td><button className="vac-mini" onClick={() => save({ kind: "operation", key: o.key, credits: o.credits, pro_only: o.pro_only, enabled: o.enabled }, o.label)}>Salvar</button></td></tr>)}
    </tbody></table></div>

    {settings && <><h3 className="vac-h">Proteção financeira e avisos</h3><div className="vac-fields">
      <label>Requisições por minuto por usuário<input type="number" min="1" value={settings.rate_limit_per_minute} onChange={e => setSettings({ ...settings, rate_limit_per_minute: Number(e.target.value) })} /></label>
      <label>Alerta de consumo anormal (créditos/hora)<input type="number" min="1" value={settings.abnormal_credits_per_hour} onChange={e => setSettings({ ...settings, abnormal_credits_per_hour: Number(e.target.value) })} /></label>
      <label>Primeiro aviso (% usado)<input type="number" min="1" max="99" value={settings.warn_threshold_1} onChange={e => setSettings({ ...settings, warn_threshold_1: Number(e.target.value) })} /></label>
      <label>Segundo aviso (% usado)<input type="number" min="1" max="99" value={settings.warn_threshold_2} onChange={e => setSettings({ ...settings, warn_threshold_2: Number(e.target.value) })} /></label>
    </div><button className="viva-admin-save" onClick={() => save({ kind: "settings", ...settings }, "Proteções")}>Salvar proteções</button></>}

    <h3 className="vac-h">Usuários e saldos</h3>
    <div className="vac-filters">
      <input aria-label="Buscar usuário" placeholder="Buscar por nome ou e-mail" value={q} onChange={e => { setOffset(0); setQ(e.target.value); }} />
      <select aria-label="Plano" value={plan} onChange={e => { setOffset(0); setPlan(e.target.value); }}><option value="">Todos os planos</option>{plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <select aria-label="Ordenar" value={sort} onChange={e => setSort(e.target.value)}><option value="cost">Maior custo no mês</option><option value="credits">Mais créditos no mês</option><option value="balance">Menor saldo</option><option value="recent">Cadastro recente</option></select>
    </div>
    <div className="vac-scroll"><table className="vac-table"><thead><tr><th>Usuário</th><th>Plano</th><th>Saldo</th><th>Ciclo</th><th>Créditos mês</th><th>Tokens mês</th><th>Custo mês</th><th>Custo total</th><th /></tr></thead><tbody>
      {users.map(u => <tr key={u.user_id} className={u.high_usage ? "hot" : ""}>
        <td><b>{u.full_name || "Sem nome"}</b><small>{u.email}</small>{u.high_usage && <em className="vac-badge">consumo elevado</em>}</td>
        <td>{u.plan_id}</td><td><b>{u.balance - u.reserved}</b></td><td>{u.cycle_used}/{u.cycle_granted}<small>renova {when(u.next_renewal_at)}</small></td>
        <td>{num(u.credits_month)}</td><td>{num(u.tokens_in_month)} / {num(u.tokens_out_month)}</td><td>{brl(u.cost_month_brl)}</td><td>{brl(u.cost_total_brl)}</td>
        <td><button className="vac-mini" onClick={() => setOpen(u)}>Gerenciar</button></td></tr>)}
      {!users.length && <tr><td colSpan={9}>Nenhum usuário encontrado.</td></tr>}
    </tbody></table></div>
    <div className="vac-pager"><span>{total} usuários</span><button className="vac-mini" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>Anterior</button><button className="vac-mini" disabled={offset + 25 >= total} onClick={() => setOffset(offset + 25)}>Próxima</button></div>

    {open && <UserCredits user={open} onClose={() => setOpen(null)} onChanged={() => { loadUsers(); loadOverview(); }} />}
  </section>;
}

function UserCredits({ user, onClose, onChanged }: { user: UserRow; onClose: () => void; onChanged: () => void }) {
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [amount, setAmount] = useState(""); const [reason, setReason] = useState(""); const [mode, setMode] = useState<"add" | "remove">("add");
  const [key, setKey] = useState(newKey); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  const load = useCallback(async () => { try { const d = await call("GET", undefined, "?view=ledger&user_id=" + user.user_id); setLedger(d.ledger || []); } catch { setMsg("Não foi possível carregar o histórico."); } }, [user.user_id]);
  useEffect(() => { load(); }, [load]);
  async function apply() {
    const n = Math.round(Number(amount)); if (!(n > 0) || reason.trim().length < 3) { setMsg("Informe a quantidade e o motivo."); return; }
    setBusy(true); setMsg("");
    try { const d = await call("POST", { user_id: user.user_id, amount: mode === "add" ? n : -n, reason: reason.trim(), idempotency_key: key });
      setMsg(d.duplicate ? "Esse ajuste já tinha sido aplicado." : d.ok ? `Ajuste aplicado: ${d.applied > 0 ? "+" : ""}${d.applied} créditos.` : "Não há créditos disponíveis para remover.");
      setKey(newKey()); setAmount(""); setReason(""); load(); onChanged();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Erro ao ajustar."); } finally { setBusy(false); }
  }
  return <div className="vc-sheet-layer" role="dialog" aria-modal="true" aria-label={"Créditos de " + (user.full_name || user.email)}>
    <button className="vc-sheet-backdrop" aria-label="Fechar" onClick={onClose} />
    <div className="vc-sheet vac-sheet">
      <div className="vac-plan-head"><b>{user.full_name || user.email}</b><button className="vac-mini" onClick={onClose}>Fechar</button></div>
      <p className="vac-sub">{user.email} · plano {user.plan_id} · saldo {user.balance - user.reserved}</p>
      <div className="vac-adjust">
        <div className="vac-seg"><button className={mode === "add" ? "on" : ""} onClick={() => setMode("add")}>Adicionar</button><button className={mode === "remove" ? "on" : ""} onClick={() => setMode("remove")}>Retirar</button></div>
        <label>Quantidade<input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} /></label>
        <label>Motivo (fica registrado)<input value={reason} maxLength={240} onChange={e => setReason(e.target.value)} placeholder="Ex.: compensação por instabilidade" /></label>
        <button className="viva-admin-save" disabled={busy} onClick={apply}>{busy ? "Aplicando..." : mode === "add" ? "Adicionar créditos" : "Retirar créditos"}</button>
        {msg && <p className="vac-sub" role="status">{msg}</p>}
      </div>
      <h3 className="vac-h">Histórico de movimentações</h3>
      <ul className="vac-ledger">{ledger.map(l => <li key={l.id}><div><b>{KIND[l.kind] || l.kind}</b><small>{when(l.created_at)}{l.description ? " · " + l.description : ""}{l.tokens_in || l.tokens_out ? ` · ${num(l.tokens_in)}/${num(l.tokens_out)} tokens · ${brl(l.cost_brl)}` : ""}</small></div><strong className={l.amount > 0 ? "plus" : ""}>{l.amount > 0 ? "+" : ""}{l.amount}<small>saldo {l.balance_after}</small></strong></li>)}
        {!ledger.length && <li>Sem movimentações.</li>}</ul>
    </div>
  </div>;
}
