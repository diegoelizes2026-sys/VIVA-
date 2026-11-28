"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Camera, HeartPulse, Lock, Share2, ShieldCheck, Trash2 } from "lucide-react";
import WhatsAppIcon from "@/components/whatsapp-icon";
import OfferCountdown from "@/components/offer-countdown";
import FunnelSignup from "@/components/funnel-signup";
import { createClient } from "@/lib/supabase/client";
import { FUNNEL_PRICE_BRL, FUNNEL_REGULAR_BRL, LIFE_KEY, pricePerDay } from "@/lib/life-diagnostic";
import { CONSENT_TEXT, CONTROL, DEBTS, GOALS, HEALTH, LEVEL_LABEL, VIVA_WHATSAPP, brl, computeResult, normalizeWhatsapp, parseMoney, type Answers, type Result } from "@/lib/diagnostic";

type Stage = "intro" | 1 | 2 | 3 | 4 | 5 | 6 | 7 | "contact" | "result";
type Utm = { utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_content?: string };
const TOTAL = 7;
const KEY = "viva-diag-v1";

function rid() { try { return crypto.randomUUID().replace(/-/g, ""); } catch { return Math.random().toString(36).slice(2) + Date.now().toString(36); } }
function store<T>(k: string, v?: T): T | null {
  try { if (v === undefined) { const r = localStorage.getItem(k); return r ? JSON.parse(r) as T : null; } localStorage.setItem(k, JSON.stringify(v)); } catch { /* navegação privada */ }
  return null;
}
const moneyMask = (raw: string) => { const d = raw.replace(/\D/g, "").slice(0, 9); if (!d) return ""; return (Number(d) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };

/** Diagnóstico Financeiro Grátis: 7 perguntas, contato, resultado e convite. */
export default function DiagnosticQuiz() {
  const [stage, setStage] = useState<Stage>("intro");
  const [income, setIncome] = useState("");
  const [payday, setPayday] = useState("");
  const [fixed, setFixed] = useState("");
  const [debts, setDebts] = useState<Answers["debts"] | null>(null);
  const [control, setControl] = useState<Answers["control"] | null>(null);
  const [goal, setGoal] = useState<Answers["goal"] | null>(null);
  const [health, setHealth] = useState<Answers["health"] | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [trap, setTrap] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [lead, setLead] = useState<{ id: string; token: string } | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [shared, setShared] = useState("");
  const [offer, setOffer] = useState<string | null>(null);
  const [offerOver, setOfferOver] = useState(false);
  const onOfferExpire = useCallback(() => setOfferOver(true), []);
  const [signup, setSignup] = useState(false);
  const [logged, setLogged] = useState(false);
  const closeSignup = useCallback(() => setSignup(false), []);
  useEffect(() => { try { createClient().auth.getSession().then(({ data }) => setLogged(!!data.session)).catch(() => {}); } catch { /* sem Supabase */ } }, []);
  const session = useRef("");
  const device = useRef("");
  const utm = useRef<Utm>({});
  const sent = useRef(new Set<string>());
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    session.current = rid();
    const dev = store<string>(KEY + ":device"); device.current = dev || rid(); if (!dev) store(KEY + ":device", device.current);
    try {
      const q = new URLSearchParams(window.location.search);
      const u: Utm = {}; for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const) { const v = q.get(k); if (v) u[k] = v.slice(0, 80); }
      utm.current = Object.keys(u).length ? u : (store<Utm>(KEY + ":utm") || {});
      if (Object.keys(u).length) store(KEY + ":utm", u);
    } catch { /* sem URL */ }
  }, []);
  useEffect(() => { if (typeof stage === "number" || stage === "contact") setTimeout(() => inputRef.current?.focus(), 60); document.querySelector(".dq")?.scrollTo({ top: 0 }); }, [stage]);

  function event(name: string, step?: number) {
    const k = name + (step ?? "");
    if (sent.current.has(k) && name !== "cta_signup" && name !== "cta_whatsapp" && name !== "share") return;
    sent.current.add(k);
    try { void fetch("/api/diagnostic/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session: session.current, event: name, step, ...utm.current }), keepalive: true }).catch(() => {}); } catch { /* sem rede */ }
  }

  const answers = (): Answers => ({ income: parseMoney(income), payday: Number(payday), fixed: parseMoney(fixed), debts: debts!, control: control!, goal: goal!, health: health! });

  function next(e?: FormEvent) {
    e?.preventDefault(); setErr("");
    if (stage === 1) { const n = parseMoney(income); if (!(n > 0)) return setErr("Digite quanto você recebe por mês."); if (n > 1_000_000) return setErr("Confira o valor digitado."); }
    if (stage === 2) { const d = Number(payday); if (!Number.isInteger(d) || d < 1 || d > 31) return setErr("Digite um dia entre 1 e 31."); }
    if (stage === 3) { const n = parseMoney(fixed); if (!(n >= 0) || fixed === "") return setErr("Digite o valor das contas fixas (pode ser 0)."); if (n > 1_000_000) return setErr("Confira o valor digitado."); }
    if (typeof stage === "number") { event("question", stage); setStage(stage === TOTAL ? "contact" : ((stage + 1) as Stage)); }
  }
  function choose<T>(set: (v: T) => void, v: T) { set(v); setErr(""); if (typeof stage === "number") { event("question", stage); setTimeout(() => setStage(stage === TOTAL ? "contact" : ((stage + 1) as Stage)), 160); } }
  function back() { setErr(""); setStage(stage === "contact" ? TOTAL : stage === 1 ? "intro" : typeof stage === "number" ? ((stage - 1) as Stage) : stage); }

  async function submitContact(e: FormEvent) {
    e.preventDefault(); setErr("");
    if (name.trim().length < 2) return setErr("Digite seu nome.");
    const wa = normalizeWhatsapp(phone); if (!wa) return setErr("Digite um celular com DDD, por exemplo (85) 99999-0000.");
    setBusy(true);
    const a = answers();
    try {
      const r = await fetch("/api/diagnostic/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), whatsapp: wa, answers: a, optIn, consentText: optIn ? CONSENT_TEXT : null, device: device.current, website: trap, ...utm.current }) });
      const d = await r.json().catch(() => ({}));
      if (r.status === 429) { setErr(d.error || "Você já fez vários diagnósticos hoje. Tente amanhã."); return; }
      if (r.ok && d.id) { setLead({ id: d.id, token: d.token }); store(KEY + ":lead", d.id); }
    } catch { /* sem rede: mostra o resultado mesmo assim */ }
    finally { setBusy(false); }
    event("lead");
    // Liga o relógio da oferta do Pro por R$19,90 (prazo controlado pelo servidor).
    try { const o = await fetch("/api/funnel/offer", { method: "POST" }).then(r => r.json()); if (o.expiresAt) setOffer(o.expiresAt); } catch { /* sem rede: sem relógio */ }
    // A tela de pagamento mostra o resumo do diagnóstico da vida se houver: aqui o diagnóstico é o financeiro.
    try { localStorage.removeItem(LIFE_KEY); if (Object.keys(utm.current).length) localStorage.setItem(LIFE_KEY + ":utm", JSON.stringify(utm.current)); } catch { /* navegação privada */ }
    setResult(computeResult(a)); setStage("result"); event("result");
  }

  async function removeData() {
    if (!lead) return;
    setBusy(true);
    const r = await fetch("/api/diagnostic/lead", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lead) }).catch(() => null);
    setBusy(false);
    if (r?.ok) { setDeleted(true); setConfirmDel(false); try { localStorage.removeItem(KEY + ":lead"); } catch { } }
    else setErr("Não consegui apagar agora. Escreva APAGAR para a VIVA no WhatsApp que a gente apaga para você.");
  }

  async function share() {
    if (!result) return;
    event("share");
    const url = "https://www.vivamaiss.app.br/diagnostico?utm_source=compartilhar&utm_medium=social&utm_campaign=diagnostico";
    const text = `Fiz meu diagnóstico financeiro no VIVA+ e meu resultado foi: ${LEVEL_LABEL[result.level]}. Faça o seu grátis, leva 2 minutos:`;
    try { if (navigator.share) { await navigator.share({ title: "Diagnóstico financeiro VIVA+", text, url }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(`${text} ${url}`); setShared("Link copiado! Cole onde quiser compartilhar."); } catch { setShared(`${text} ${url}`); }
  }

  const step = typeof stage === "number" ? stage : 0;
  const progress = stage === "contact" ? 100 : Math.round(((step - 1) / TOTAL) * 100);
  const options = <T extends string>(list: [T, string][], cur: T | null, set: (v: T) => void) =>
    <div className="dq-opts" role="radiogroup">{list.map(([id, l]) => <button key={id} type="button" role="radio" aria-checked={cur === id} className={cur === id ? "sel" : ""} onClick={() => choose(set, id)}><span>{l}</span>{cur === id ? <Check aria-hidden /> : <ArrowRight aria-hidden />}</button>)}</div>;
  const waLink = `https://wa.me/${VIVA_WHATSAPP}?text=${encodeURIComponent("Oi VIVA! Fiz o diagnóstico financeiro e quero conhecer.")}`;

  return <main id="conteudo" className="dq">
    <header className="dq-top"><Link href="/" className="dq-logo" aria-label="VIVA+ início">VIVA<span>+</span></Link>{typeof stage === "number" || stage === "contact" ? <button type="button" className="dq-back" onClick={back}><ArrowLeft aria-hidden />Voltar</button> : null}</header>

    {stage === "intro" && <section className="dq-card dq-intro">
      <span className="dq-pill">Diagnóstico financeiro</span>
      <h1>Faça seu diagnóstico financeiro grátis</h1>
      <p>Em 2 minutos você descobre quanto pode gastar por dia sem faltar dinheiro até o salário.</p>
      <button type="button" className="dq-btn" onClick={() => { event("quiz_start"); setStage(1); }}>Começar agora <ArrowRight aria-hidden /></button>
      <ul className="dq-trust"><li><Check aria-hidden />Grátis</li><li><Check aria-hidden />Sem cartão</li><li><Check aria-hidden />Não pede senha de banco</li></ul>
    </section>}

    {(typeof stage === "number" || stage === "contact") && <div className="dq-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Progresso"><i style={{ width: progress + "%" }} /><span>{stage === "contact" ? "Último passo" : `Pergunta ${step} de ${TOTAL}`}</span></div>}

    {stage === 1 && <form className="dq-card" onSubmit={next}><h2>Quanto você recebe por mês?</h2><p className="dq-help">Some salário e outras rendas fixas. Pode ser um valor aproximado.</p>
      <label className="dq-money"><span>R$</span><input ref={inputRef} inputMode="numeric" autoComplete="off" value={income} onChange={e => setIncome(moneyMask(e.target.value))} placeholder="0,00" aria-label="Renda mensal em reais" /></label>
      {err && <p className="dq-err" role="alert">{err}</p>}<button className="dq-btn">Continuar <ArrowRight aria-hidden /></button></form>}

    {stage === 2 && <form className="dq-card" onSubmit={next}><h2>Em que dia do mês você recebe?</h2><p className="dq-help">Se recebe em mais de uma data, use a do pagamento principal.</p>
      <label className="dq-money"><span>Dia</span><input ref={inputRef} inputMode="numeric" pattern="[0-9]*" maxLength={2} value={payday} onChange={e => setPayday(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="5" aria-label="Dia do pagamento, de 1 a 31" /></label>
      {err && <p className="dq-err" role="alert">{err}</p>}<button className="dq-btn">Continuar <ArrowRight aria-hidden /></button></form>}

    {stage === 3 && <form className="dq-card" onSubmit={next}><h2>Quanto você gasta por mês com contas fixas?</h2><p className="dq-help">Aluguel, luz, água, internet, parcelas e outras contas que vêm todo mês.</p>
      <label className="dq-money"><span>R$</span><input ref={inputRef} inputMode="numeric" autoComplete="off" value={fixed} onChange={e => setFixed(moneyMask(e.target.value))} placeholder="0,00" aria-label="Contas fixas por mês em reais" /></label>
      {err && <p className="dq-err" role="alert">{err}</p>}<button className="dq-btn">Continuar <ArrowRight aria-hidden /></button></form>}

    {stage === 4 && <section className="dq-card"><h2>Você tem dívidas ou parcelas atrasadas?</h2>{options(DEBTS, debts, setDebts)}</section>}
    {stage === 5 && <section className="dq-card"><h2>Você costuma saber para onde vai seu dinheiro?</h2>{options(CONTROL, control, setControl)}</section>}
    {stage === 6 && <section className="dq-card"><h2>Qual é o seu maior objetivo agora?</h2>{options(GOALS, goal, setGoal)}</section>}
    {stage === 7 && <section className="dq-card"><h2>Quer também cuidar da saúde e da alimentação?</h2>{options(HEALTH, health, setHealth)}</section>}

    {stage === "contact" && <form className="dq-card" onSubmit={submitContact} noValidate>
      <h2>Para quem enviamos seu diagnóstico?</h2>
      <label className="dq-field">Seu nome<input ref={inputRef} autoComplete="given-name" maxLength={60} value={name} onChange={e => setName(e.target.value)} placeholder="Como podemos te chamar" /></label>
      <label className="dq-field">Seu WhatsApp<input type="tel" inputMode="tel" autoComplete="tel-national" maxLength={20} value={phone} onChange={e => setPhone(e.target.value)} placeholder="(85) 99999-0000" /></label>
      <label className="dq-hp" aria-hidden="true">Site<input tabIndex={-1} autoComplete="off" value={trap} onChange={e => setTrap(e.target.value)} /></label>
      <label className="dq-check"><input type="checkbox" checked={optIn} onChange={e => setOptIn(e.target.checked)} /><span>{CONSENT_TEXT}</span></label>
      <p className="dq-legal"><Lock aria-hidden /><span>Ao continuar você concorda com a <Link href="/privacidade" target="_blank">Política de Privacidade</Link>. Não pedimos senha de banco, CPF nem cartão.</span></p>
      {err && <p className="dq-err" role="alert">{err}</p>}
      <button className="dq-btn" disabled={busy}>{busy ? "Calculando…" : "Ver meu diagnóstico"} <ArrowRight aria-hidden /></button>
    </form>}

    {stage === "result" && result && <>
      <section className={"dq-card dq-result lv-" + result.level}>
        <span className="dq-level">{LEVEL_LABEL[result.level]}</span>
        <h1>{name.trim().split(" ")[0] ? `${name.trim().split(" ")[0]}, seu diagnóstico está pronto` : "Seu diagnóstico está pronto"}</h1>
        {result.negative ? <div className="dq-neg">
          <b>Hoje suas contas fixas passam da sua renda.</b>
          <p>Isso acontece com muita gente e tem saída. Antes de pensar num valor por dia, o primeiro passo é rever as contas fixas: ver o que dá para renegociar, trocar ou pausar. As dicas abaixo ajudam a começar.</p>
        </div> : <div className="dq-daily">
          <small>Seu número do dia</small>
          <strong>{brl(result.daily!)}</strong>
          <span>por dia, pelos próximos {result.daysToPay} {result.daysToPay === 1 ? "dia" : "dias"}, até o pagamento de {new Date(result.nextPayday + "T12:00:00Z").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })}</span>
          <em>Considera que o que sobra das contas fixas ainda está disponível. No app, a VIVA calcula com o seu saldo real.</em>
        </div>}
        <div className="dq-stats">
          <div><small>Sobra por mês depois das contas</small><b>{result.negative ? brl(0) : brl(result.leftover)}</b></div>
          <div><small>Da sua renda</small><b>{result.negative ? "0%" : result.leftoverPct + "%"}</b></div>
        </div>
      </section>

      <section className="dq-card"><h2>3 dicas para você</h2><ol className="dq-tips">{result.tips.map(t => <li key={t}>{t}</li>)}</ol></section>

      <section className="dq-card dq-cta">
        <h2>Para ter o controle total do seu dinheiro, assine o Pro.</h2>
        <ul className="lv-get">
          <li><Check aria-hidden />Seu número do dia, todo dia, no WhatsApp</li>
          <li><Check aria-hidden />Aviso antes das contas vencerem</li>
          <li><Check aria-hidden />Plano para sair das dívidas e juntar dinheiro</li>
          <li><Check aria-hidden />VIVA no WhatsApp sem limite de mensagens</li>
        </ul>
        {offer && <OfferCountdown expiresAt={offer} onExpire={onOfferExpire} />}
        <button type="button" className="dq-btn light" onClick={() => { event("cta_signup"); if (logged) window.location.assign("/oferta-pro"); else setSignup(true); }}>Quero o controle total <ArrowRight aria-hidden /></button>
        <p className="lv-price">{offer && !offerOver ? <><s>{brl(FUNNEL_REGULAR_BRL)}</s> <b>{brl(FUNNEL_PRICE_BRL)}</b>/mês</> : <><b>{brl(FUNNEL_REGULAR_BRL)}</b>/mês</>}<br /><small>menos de {pricePerDay(offer && !offerOver ? FUNNEL_PRICE_BRL : FUNNEL_REGULAR_BRL)} por dia · cancele quando quiser</small></p>
        <p className="lv-guarantee"><ShieldCheck aria-hidden /><span><b>Garantia de 7 dias.</b> Não gostou? Devolvemos 100% do valor, sem perguntas.</span></p>
        <a href={waLink} target="_blank" rel="noopener noreferrer" className="dq-btn wa" onClick={() => event("cta_whatsapp")}><WhatsAppIcon size={20} />Tirar dúvidas com a VIVA no WhatsApp</a>
      </section>

      <FunnelSignup open={signup} onClose={closeSignup} leadId={lead?.id} headline="Receba seu número do dia todo dia no WhatsApp" />
      {result && health === "sim" && <section className="dq-card dq-health">
        <span className="dq-hic"><HeartPulse aria-hidden /></span>
        <div><h2>Cuide da saúde junto</h2><p>No <b>VIVA Saúde</b> você manda a <b>foto do prato</b> e a VIVA calcula as calorias. Também registra água e treinos pelo WhatsApp e encontra personais e academias credenciados perto de você.</p>
          <p className="dq-hint"><Camera aria-hidden />Já vem no Pro.</p></div>
      </section>}

      <section className="dq-actions">
        <button type="button" className="dq-btn ghost" onClick={share}><Share2 aria-hidden />Compartilhar meu resultado</button>
        {shared && <p className="dq-ok" role="status">{shared}</p>}
      </section>

      <p className="dq-disclaimer"><ShieldCheck aria-hidden />Este diagnóstico é uma estimativa educativa e não substitui orientação financeira profissional.</p>
      {lead && !deleted && <div className="dq-delete">
        {confirmDel ? <><span>Apagar seu nome, WhatsApp e respostas do VIVA+?</span><button type="button" onClick={removeData} disabled={busy}>Sim, apagar</button><button type="button" onClick={() => setConfirmDel(false)}>Cancelar</button></>
          : <button type="button" onClick={() => setConfirmDel(true)}><Trash2 aria-hidden />Apagar meus dados</button>}
      </div>}
      {deleted && <p className="dq-ok" role="status">Pronto. Seu nome, WhatsApp e respostas foram apagados.</p>}
      {err && <p className="dq-err" role="alert">{err}</p>}
    </>}

    {stage === "intro" && <p className="dq-disclaimer"><ShieldCheck aria-hidden />Este diagnóstico é uma estimativa educativa e não substitui orientação financeira profissional.</p>}
  </main>;
}
