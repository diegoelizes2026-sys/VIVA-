"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { SECTION_ORDER, formatQty, parseItems, shareText } from "@/lib/shopping";

type List = { id: string; title: string; kind: "mercado" | "farmacia" | "outros"; created_at: string };
type Item = { id: string; list_id: string; title: string; quantity: number; unit: string | null; category: string; estimated_price: number | null; note: string | null; is_purchased: boolean; created_at: string };
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const KIND_LABEL = { mercado: "Mercado", farmacia: "Farmácia", outros: "Outros" } as const;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export default function ShoppingList() {
  const supabase = useMemo(() => createClient(), []);
  const [uid, setUid] = useState<string | null>(null);
  const [lists, setLists] = useState<List[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [budget, setBudget] = useState<{ limit: number; spent: number } | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [edit, setEdit] = useState<Item | null>(null);
  const [newList, setNewList] = useState(false);
  const [finish, setFinish] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(""), 2600); };

  const load = useCallback(async () => {
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser(); if (!user) return; setUid(user.id);
      const first = await supabase.from("viva_shopping_lists").select("id,title,kind,created_at").eq("user_id", user.id).is("archived_at", null).order("created_at");
      if (first.error) throw first.error;
      let ls = first.data;
      if (!ls?.length) {
        const { data: created, error: e2 } = await supabase.from("viva_shopping_lists").insert({ user_id: user.id, title: "Mercado", kind: "mercado" }).select("id,title,kind,created_at").single();
        if (e2) throw e2; ls = [created];
      }
      setLists(ls as List[]);
      setActive(a => a && ls!.some(l => l.id === a) ? a : ls![0].id);
      const ids = ls.map(l => l.id);
      const [{ data: its, error: e3 }, hist] = await Promise.all([
        supabase.from("viva_shopping_list_items").select("id,list_id,title,quantity,unit,category,estimated_price,note,is_purchased,created_at").in("list_id", ids).order("created_at"),
        supabase.from("viva_shopping_list_items").select("title").eq("user_id", user.id).eq("is_purchased", true).order("purchased_at", { ascending: false }).limit(60),
      ]);
      if (e3) throw e3;
      setItems((its || []).map(i => ({ ...i, quantity: Number(i.quantity), estimated_price: i.estimated_price == null ? null : Number(i.estimated_price) })) as Item[]);
      const seen = new Set<string>(); setRecent(((hist.data || []) as { title: string }[]).map(h => h.title).filter(t => { const k = t.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 12));
      // Orçamento de Alimentação do mês (criado no diagnóstico ou no Planejamento) e quanto já foi gasto.
      const month = today().slice(0, 7) + "-01";
      const [b, tx] = await Promise.all([
        supabase.from("viva_budgets").select("monthly_limit").eq("user_id", user.id).eq("category", "Alimentação").eq("month", month).maybeSingle(),
        supabase.from("viva_transactions").select("amount").eq("user_id", user.id).eq("kind", "expense").eq("category", "Alimentação").gte("occurred_on", month).limit(1000),
      ]);
      setBudget(b.data ? { limit: Number(b.data.monthly_limit), spent: ((tx.data || []) as { amount: number }[]).reduce((s, x) => s + Number(x.amount), 0) } : null);
    } catch (e) { console.error("VIVA shopping load", e); setError("Não foi possível carregar sua lista. Atualize a página."); }
    finally { setLoading(false); }
  }, [supabase]);
  useEffect(() => { load(); }, [load]);

  const list = lists.find(l => l.id === active) || null;
  const mine = items.filter(i => i.list_id === active);
  const pending = mine.filter(i => !i.is_purchased);
  const cart = mine.filter(i => i.is_purchased);
  const total = (arr: Item[]) => arr.reduce((s, i) => s + (i.estimated_price ?? 0) * (i.unit && !["un", "pct", "cx", "lata", "gf", "dz", "fardo", "bdj"].includes(i.unit) ? 1 : i.quantity), 0);
  const priced = mine.filter(i => i.estimated_price != null).length;

  async function addFrom(raw: string) {
    if (!uid || !active) return;
    const parsed = parseItems(raw); if (!parsed.length) { setError("Escreva o nome do item. Ex.: leite, pão, 2kg de arroz"); return; }
    setError("");
    // Item que já está pendente na lista: só soma a quantidade.
    const toInsert: Record<string, unknown>[] = []; const updates: Item[] = [];
    for (const p of parsed) {
      const dup = pending.find(i => i.title.toLowerCase() === p.title.toLowerCase() && (i.unit ?? null) === (p.unit ?? null));
      if (dup) updates.push({ ...dup, quantity: dup.quantity + p.quantity });
      else toInsert.push({ list_id: active, user_id: uid, title: p.title, quantity: p.quantity, unit: p.unit, category: list?.kind === "farmacia" && p.category === "Outros" ? "Farmácia" : p.category });
    }
    const optimistic = toInsert.map((r, k) => ({ ...(r as object), id: "tmp-" + k + Date.now(), is_purchased: false, estimated_price: null, note: null, created_at: new Date().toISOString() })) as unknown as Item[];
    setItems(c => [...c.map(i => updates.find(u => u.id === i.id) || i), ...optimistic]); setText("");
    try {
      for (const u of updates) { const { error: e } = await supabase.from("viva_shopping_list_items").update({ quantity: u.quantity }).eq("id", u.id); if (e) throw e; }
      if (toInsert.length) {
        const { data, error: e } = await supabase.from("viva_shopping_list_items").insert(toInsert).select("id,list_id,title,quantity,unit,category,estimated_price,note,is_purchased,created_at");
        if (e) throw e;
        setItems(c => [...c.filter(i => !i.id.startsWith("tmp-")), ...((data || []).map(i => ({ ...i, quantity: Number(i.quantity), estimated_price: null })) as Item[])]);
      }
      flash(parsed.length === 1 ? `${parsed[0].title} adicionado` : `${parsed.length} itens adicionados`);
    } catch (e) { console.error(e); setError("Não foi possível adicionar. Tente de novo."); load(); }
    inputRef.current?.focus();
  }
  async function toggle(i: Item) {
    const v = !i.is_purchased; setItems(c => c.map(x => x.id === i.id ? { ...x, is_purchased: v } : x));
    const { error: e } = await supabase.from("viva_shopping_list_items").update({ is_purchased: v, purchased_at: v ? new Date().toISOString() : null }).eq("id", i.id);
    if (e) { setItems(c => c.map(x => x.id === i.id ? { ...x, is_purchased: !v } : x)); setError("Não foi possível atualizar o item."); }
  }
  async function saveItem(i: Item) {
    const { error: e } = await supabase.from("viva_shopping_list_items").update({ title: i.title.trim().slice(0, 120) || "Item", quantity: i.quantity > 0 ? i.quantity : 1, unit: i.unit || null, category: i.category, estimated_price: i.estimated_price, note: i.note?.trim() || null }).eq("id", i.id);
    if (e) { setError("Não foi possível salvar o item."); return; }
    setItems(c => c.map(x => x.id === i.id ? i : x)); setEdit(null);
  }
  async function removeItem(id: string) { setItems(c => c.filter(x => x.id !== id)); setEdit(null); await supabase.from("viva_shopping_list_items").delete().eq("id", id); }
  async function clearCart() {
    if (!cart.length || !window.confirm(`Tirar ${cart.length} ${cart.length === 1 ? "item comprado" : "itens comprados"} da lista?`)) return;
    const ids = cart.map(i => i.id); setItems(c => c.filter(x => !ids.includes(x.id)));
    await supabase.from("viva_shopping_list_items").delete().in("id", ids);
  }
  async function createList(title: string, kind: List["kind"]) {
    if (!uid) return;
    const { data, error: e } = await supabase.from("viva_shopping_lists").insert({ user_id: uid, title: title.trim().slice(0, 60) || KIND_LABEL[kind], kind }).select("id,title,kind,created_at").single();
    if (e || !data) { setError("Não foi possível criar a lista."); return; }
    setLists(c => [...c, data as List]); setActive(data.id); setNewList(false);
  }
  async function archiveList() {
    if (!list || lists.length < 2 || !window.confirm(`Excluir a lista "${list.title}" e seus itens?`)) return;
    await supabase.from("viva_shopping_lists").update({ archived_at: new Date().toISOString() }).eq("id", list.id);
    const rest = lists.filter(l => l.id !== list.id); setLists(rest); setActive(rest[0]?.id || null);
  }
  function share() {
    if (!list) return;
    const msg = shareText(list.title, mine);
    if (navigator.share) { navigator.share({ title: list.title, text: msg }).catch(() => {}); return; }
    window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank", "noopener");
  }

  const sections = SECTION_ORDER.map(s => ({ name: s, items: pending.filter(i => i.category === s) })).filter(s => s.items.length);
  const suggestions = recent.filter(r => !pending.some(p => p.title.toLowerCase() === r.toLowerCase())).slice(0, 8);
  const left = budget ? budget.limit - budget.spent : null;

  return <div className="sl-page">
    <header className="sl-head">
      <div><span className="vc-eyebrow">LISTA DE COMPRAS</span><h1>O que você precisa comprar?</h1></div>
      <div className="sl-head-actions"><a className="sl-icon" href={`/perto?tipo=${list?.kind === "farmacia" ? "farmacia" : "mercado"}`} aria-label={list?.kind === "farmacia" ? "Farmácias perto de mim" : "Mercados perto de mim"} title="Perto de mim"><svg viewBox="0 0 24 24"><path d="M12 21s6.5-5.7 6.5-11.2a6.5 6.5 0 0 0-13 0C5.5 15.3 12 21 12 21Z" /><circle cx="12" cy="9.8" r="2.4" /></svg></a><button className="sl-icon" onClick={share} disabled={!pending.length} aria-label="Compartilhar lista"><svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="2.6" /><circle cx="6" cy="12" r="2.6" /><circle cx="18" cy="19" r="2.6" /><path d="m8.3 10.8 7.4-4.4M8.3 13.2l7.4 4.4" /></svg></button></div>
    </header>

    <div className="sl-tabs" role="tablist" aria-label="Minhas listas">
      {lists.map(l => <button key={l.id} role="tab" aria-selected={l.id === active} className={l.id === active ? "on" : ""} onClick={() => setActive(l.id)}>{l.title}<small>{items.filter(i => i.list_id === l.id && !i.is_purchased).length}</small></button>)}
      <button className="sl-new" onClick={() => setNewList(true)}>+ Nova lista</button>
    </div>

    <form className="sl-add" onSubmit={(e: FormEvent) => { e.preventDefault(); addFrom(text); }}>
      <input ref={inputRef} value={text} onChange={e => setText(e.target.value)} placeholder="Ex.: leite, pão e 2kg de arroz" aria-label="Adicionar itens" maxLength={600} enterKeyHint="done" />
      <button type="submit" disabled={!text.trim()} aria-label="Adicionar">+</button>
    </form>
    <p className="sl-hint">Escreva vários itens de uma vez. Dica: no chat, diga “VIVA, coloca café na lista”.</p>
    {suggestions.length > 0 && <div className="sl-sugg"><span>Comprados antes:</span>{suggestions.map(s => <button key={s} onClick={() => addFrom(s)}>+ {s}</button>)}</div>}
    {error && <p className="sl-error" role="alert">{error}</p>}

    {loading ? <p className="vc-muted">Carregando sua lista…</p> : !pending.length && !cart.length ? <div className="sl-empty"><b>Sua lista está vazia</b><p>Adicione itens acima. A VIVA separa tudo por seção do mercado para você não esquecer nada.</p></div> : <>
      {!pending.length && cart.length > 0 && <div className="sl-empty done"><b>Tudo no carrinho!</b><p>Quando terminar, toque em “Finalizar compra” para registrar o gasto.</p></div>}
      {sections.map(sec => <section key={sec.name} className="sl-section"><h2>{sec.name}<small>{sec.items.length}</small></h2><ul>
        {sec.items.map(i => <li key={i.id}>
          <button className="sl-check" onClick={() => toggle(i)} aria-label={`Marcar ${i.title} como comprado`} />
          <button className="sl-item" onClick={() => toggle(i)}><b>{i.title}</b>{(formatQty(i.quantity, i.unit) || i.note) && <span>{[formatQty(i.quantity, i.unit), i.note].filter(Boolean).join(" · ")}</span>}</button>
          {i.estimated_price != null && <em className="sl-price">{brl(i.estimated_price)}</em>}
          <button className="sl-more" onClick={() => setEdit(i)} aria-label={`Editar ${i.title}`}><svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg></button>
        </li>)}
      </ul></section>)}
      {cart.length > 0 && <section className="sl-section sl-cart"><button className="sl-cart-head" onClick={() => setCartOpen(o => !o)} aria-expanded={cartOpen}><h2>No carrinho<small>{cart.length}</small></h2><span>{cartOpen ? "Ocultar" : "Mostrar"}</span></button>
        {cartOpen && <ul>{cart.map(i => <li key={i.id} className="got"><button className="sl-check on" onClick={() => toggle(i)} aria-label={`Desmarcar ${i.title}`} /><button className="sl-item" onClick={() => toggle(i)}><b>{i.title}</b>{formatQty(i.quantity, i.unit) && <span>{formatQty(i.quantity, i.unit)}</span>}</button>{i.estimated_price != null && <em className="sl-price">{brl(i.estimated_price)}</em>}</li>)}</ul>}
        <div className="sl-cart-actions"><button className="vc-btn" onClick={() => setFinish(true)}>Finalizar compra</button><button className="vc-btn ghost" onClick={clearCart}>Limpar comprados</button></div>
      </section>}
    </>}

    <footer className="sl-summary">
      <div><span>{pending.length} {pending.length === 1 ? "item" : "itens"} pendente{pending.length === 1 ? "" : "s"}</span><b>{priced ? `≈ ${brl(total(pending))}` : "Preços opcionais"}</b></div>
      {budget ? <div><span>Orçamento de Alimentação</span><b className={left != null && left < total(pending) ? "neg" : ""}>{left != null && left >= 0 ? `${brl(left)} livres` : `${brl(Math.abs(left || 0))} acima`}</b></div>
        : <div><span>Sem orçamento de Alimentação</span><Link href="/planejamento">Definir</Link></div>}
    </footer>
    {list && lists.length > 1 && <button className="ob-link sl-archive" onClick={archiveList}>Excluir a lista “{list.title}”</button>}
    {toast && <div className="sl-toast" role="status">{toast}</div>}

    {edit && <ItemSheet item={edit} onClose={() => setEdit(null)} onSave={saveItem} onDelete={() => removeItem(edit.id)} />}
    {newList && <NewListSheet onClose={() => setNewList(false)} onCreate={createList} />}
    {finish && list && <FinishSheet list={list} items={cart} estimate={total(cart)} onClose={() => setFinish(false)} onDone={async () => { const ids = cart.map(i => i.id); setItems(c => c.filter(x => !ids.includes(x.id))); await supabase.from("viva_shopping_list_items").delete().in("id", ids); setFinish(false); flash("Compra registrada em Meu dinheiro"); load(); }} />}
  </div>;
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return <div className="vc-sheet-layer" role="dialog" aria-modal="true" aria-label={title}><button className="vc-sheet-backdrop" aria-label="Fechar" onClick={onClose} /><div className="vc-sheet sl-sheet"><div className="md-head"><h2>{title}</h2><button className="ob-link" onClick={onClose}>Fechar</button></div>{children}</div></div>;
}

function ItemSheet({ item, onClose, onSave, onDelete }: { item: Item; onClose: () => void; onSave: (i: Item) => void; onDelete: () => void }) {
  const [v, setV] = useState({ ...item, qty: String(item.quantity).replace(".", ","), price: item.estimated_price == null ? "" : String(item.estimated_price).replace(".", ",") });
  const num = (s: string) => { const n = Number(s.replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : NaN; };
  return <Sheet title="Editar item" onClose={onClose}><div className="vh-form">
    <label>Item<input value={v.title} maxLength={120} onChange={e => setV({ ...v, title: e.target.value })} /></label>
    <div className="sl-row"><label>Quantidade<input inputMode="decimal" value={v.qty} onChange={e => setV({ ...v, qty: e.target.value })} /></label>
      <label>Unidade<select value={v.unit || ""} onChange={e => setV({ ...v, unit: e.target.value || null })}><option value="">—</option>{["un", "kg", "g", "L", "ml", "pct", "cx", "dz", "lata", "gf", "fardo", "bdj"].map(u => <option key={u}>{u}</option>)}</select></label></div>
    <label>Seção<select value={v.category} onChange={e => setV({ ...v, category: e.target.value })}>{SECTION_ORDER.map(s => <option key={s}>{s}</option>)}</select></label>
    <label>Preço estimado (opcional, por unidade ou total do peso)<input inputMode="decimal" value={v.price} placeholder="Ex.: 6,90" onChange={e => setV({ ...v, price: e.target.value })} /></label>
    <label>Observação<input value={v.note || ""} maxLength={200} placeholder="Ex.: marca X, sem lactose" onChange={e => setV({ ...v, note: e.target.value })} /></label>
    <button className="vh-cta" onClick={() => { const q = num(v.qty); const p = v.price.trim() ? num(v.price) : null; onSave({ ...item, title: v.title, unit: v.unit, category: v.category, note: v.note, quantity: q > 0 ? q : 1, estimated_price: p != null && p >= 0 ? Math.round(p * 100) / 100 : null }); }}>Salvar</button>
    <button className="md-danger" onClick={onDelete}>Remover da lista</button>
  </div></Sheet>;
}

function NewListSheet({ onClose, onCreate }: { onClose: () => void; onCreate: (t: string, k: List["kind"]) => void }) {
  const [title, setTitle] = useState(""); const [kind, setKind] = useState<List["kind"]>("mercado");
  return <Sheet title="Nova lista" onClose={onClose}><div className="vh-form">
    <div className="vh-pick">{(Object.keys(KIND_LABEL) as List["kind"][]).map(k => <button key={k} type="button" className={kind === k ? "sel" : ""} onClick={() => setKind(k)}>{KIND_LABEL[k]}</button>)}</div>
    <label>Nome da lista<input value={title} maxLength={60} placeholder={kind === "farmacia" ? "Ex.: Farmácia" : "Ex.: Compras do mês"} onChange={e => setTitle(e.target.value)} autoFocus /></label>
    <button className="vh-cta" onClick={() => onCreate(title, kind)}>Criar lista</button>
  </div></Sheet>;
}

function FinishSheet({ list, items, estimate, onClose, onDone }: { list: List; items: Item[]; estimate: number; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(estimate ? estimate.toFixed(2).replace(".", ",") : "");
  const [method, setMethod] = useState("Pix"); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const category = list.kind === "farmacia" ? "Saúde" : "Alimentação";
  async function submit() {
    const n = Number(amount.replace(/\./g, "").replace(",", "."));
    if (!(n > 0)) { setErr("Informe o valor que você pagou."); return; }
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "expense", amount: n, description: `Compras · ${list.title}`.slice(0, 240), occurred_on: today(), category, payment_method: method }) });
      const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || "Não foi possível registrar.");
      window.dispatchEvent(new Event("viva:transactions-updated")); onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : "Não foi possível registrar."); } finally { setBusy(false); }
  }
  return <Sheet title="Finalizar compra" onClose={onClose}><div className="vh-form">
    <p className="vc-muted">{items.length} {items.length === 1 ? "item" : "itens"} no carrinho. O gasto entra em Meu dinheiro como <b>{category}</b> e os itens comprados saem da lista.</p>
    <label>Quanto você pagou?<input inputMode="decimal" value={amount} placeholder="Ex.: 187,40" onChange={e => setAmount(e.target.value)} autoFocus /></label>
    <div className="vh-pick">{["Pix", "Débito", "Crédito", "Dinheiro"].map(m => <button key={m} type="button" className={method === m ? "sel" : ""} onClick={() => setMethod(m)}>{m}</button>)}</div>
    {err && <p className="vh-warn">{err}</p>}
    <button className="vh-cta" disabled={busy} onClick={submit}>{busy ? "Registrando…" : "Registrar gasto e limpar carrinho"}</button>
  </div></Sheet>;
}
