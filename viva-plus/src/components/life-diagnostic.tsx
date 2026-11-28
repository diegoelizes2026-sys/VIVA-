"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Lock, ShieldCheck, Sparkles } from "lucide-react";
import OfferCountdown from "@/components/offer-countdown";
import { AREA_LABEL, FUNNEL_OFFER, FUNNEL_PRICE_BRL, FUNNEL_REGULAR_BRL, LIFE_KEY, QUESTIONS, brl, computeLife, type LifeAnswers, type LifeResult } from "@/lib/life-diagnostic";

type Stage = "intro" | number | "loading" | "result";
type Utm = { utm_source?: string; utm_medium?: string; utm_campaign?: string };
const TOTAL = QUESTIONS.length;

function rid() { try { return crypto.randomUUID().replace(/-/g, ""); } catch { return Math.random().toString(36).slice(2) + Date.now().toString(36); } }
function save(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* navegação privada */ } }

/** Diagnóstico da Vida: perguntas sobre a rotina, resultado parcial e a oferta do Pro por R$19,90. */
export default function LifeDiagnostic() {
  const [stage, setStage] = useState<Stage>("intro");
  const [answers, setAnswers] = useState<LifeAnswers>({});
  const [result, setResult] = useState<LifeResult | null>(null);
  const [offer, setOffer] = useState<{ expiresAt: string; token?: string } | null>(null);
  const [expired, setExpired] = useState(false);
  const session = useRef("");
  const utm = useRef<Utm>({});
  const sent = useRef(new Set<string>());

  useEffect(() => {
    session.current = rid();
    try {
      const q = new URLSearchParams(window.location.search); const u: Utm = {};
      for (const k of ["utm_source", "utm_medium", "utm_campaign"] as const) { const v = q.get(k); if (v) u[k] = v.slice(0, 80); }
      utm.current = u; if (Object.keys(u).length) save(LIFE_KEY + ":utm", u);
    } catch { /* sem URL */ }
  }, []);
  useEffect(() => { document.querySelector(".dq")?.scrollTo({ top: 0 }); }, [stage]);

  function event(name: string, step?: number) {
    const k = name + (step ?? ""); if (sent.current.has(k)) return; sent.current.add(k);
    try { void fetch("/api/diagnostic/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session: session.current, event: name, step, ...utm.current }), keepalive: true }).catch(() => {}); } catch { /* sem rede */ }
  }

  function choose(qid: string, oid: string, i: number) {
    const next = { ...answers, [qid]: oid }; setAnswers(next); event("vida_question", i + 1);
    setTimeout(() => { if (i + 1 < TOTAL) setStage(i + 1); else finish(next); }, 170);
  }

  async function finish(a: LifeAnswers) {
    setStage("loading");
    const r = computeLife(a); setResult(r);
    save(LIFE_KEY, { answers: a, result: r, at: new Date().toISOString() });
    const started = Date.now();
    try {
      const res = await fetch("/api/funnel/offer", { method: "POST" });
      const d = await res.json();
      if (d.expiresAt) { setOffer(d); save(LIFE_KEY + ":offer", d); }
    } catch { /* sem rede: mostra o resultado sem o relógio */ }
    // Uma pausa curta de "analisando" deixa claro que o resultado foi montado com as respostas.
    setTimeout(() => { setStage("result"); event("vida_result"); }, Math.max(0, 1400 - (Date.now() - started)));
  }

  const onExpire = useCallback(() => setExpired(true), []);
  const promo = !!offer && !expired;
  const cta = "/cadastro?origem=" + FUNNEL_OFFER;
  const qIndex = typeof stage === "number" ? stage : -1;
  const q = qIndex >= 0 ? QUESTIONS[qIndex] : null;

  return <main id="conteudo" className="dq lv">
    <header className="dq-top"><Link href="/" className="dq-logo" aria-label="VIVA+ início">VIVA<span>+</span></Link>
      {q ? <button type="button" className="dq-back" onClick={() => setStage(qIndex === 0 ? "intro" : qIndex - 1)}><ArrowLeft aria-hidden />Voltar</button> : null}</header>

    {stage === "intro" && <section className="dq-card dq-intro">
      <span className="dq-pill">Diagnóstico da vida · grátis</span>
      <h1>Descubra onde a sua vida está desequilibrada</h1>
      <p>9 perguntas rápidas sobre dinheiro, tempo, rotina, alimentação e sono. No final você vê o ponto que mais está te travando hoje.</p>
      <button type="button" className="dq-btn" onClick={() => { event("vida_start"); setStage(0); }}>Fazer meu diagnóstico <ArrowRight aria-hidden /></button>
      <ul className="dq-trust"><li><Check aria-hidden />Leva 1 minuto</li><li><Check aria-hidden />Sem cadastro para responder</li></ul>
    </section>}

    {q && <>
      <div className="dq-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((qIndex / TOTAL) * 100)} aria-label="Progresso">
        <i style={{ width: Math.round((qIndex / TOTAL) * 100) + "%" }} /><span>Pergunta {qIndex + 1} de {TOTAL}</span></div>
      <section className="dq-card" key={q.id}><h2>{q.title}</h2>{q.help && <p className="dq-help">{q.help}</p>}
        <div className="dq-opts" role="radiogroup" aria-label={q.title}>{q.options.map(o => { const sel = answers[q.id] === o.id;
          return <button key={o.id} type="button" role="radio" aria-checked={sel} className={sel ? "sel" : ""} onClick={() => choose(q.id, o.id, qIndex)}><span>{o.label}</span>{sel ? <Check aria-hidden /> : <ArrowRight aria-hidden />}</button>; })}</div>
      </section></>}

    {stage === "loading" && <section className="dq-card lv-loading" role="status"><span className="lv-spin" aria-hidden /><h2>Analisando suas respostas…</h2><p>Cruzando dinheiro, tempo, rotina, alimentação e sono.</p></section>}

    {stage === "result" && result && <>
      <section className="dq-card lv-result">
        <span className="dq-pill lv-pill">Seu resultado parcial</span>
        <div className="lv-index"><strong>{result.index}<small>/100</small></strong><span>Equilíbrio da sua vida hoje</span></div>
        <div className="lv-alert"><small>Seu ponto mais desequilibrado: {AREA_LABEL[result.worst]}</small><h1>{result.headline}</h1><p>{result.detail}</p></div>
        <ul className="lv-areas" aria-label="Notas por área">{result.areas.map((x, i) => { const open = i === 0;
          return <li key={x.area} className={open ? "is-open" : "is-locked"}><span>{AREA_LABEL[x.area]}</span>
            {open ? <><i><b style={{ width: Math.max(6, x.score) + "%" }} /></i><em>{x.score}</em></> : <><i className="lv-blur" aria-hidden="true"><b style={{ width: "55%" }} /></i><em aria-label="Bloqueado"><Lock aria-hidden /></em></>}</li>; })}</ul>
        <p className="lv-teaser"><Lock aria-hidden /><span>Seu 2º ponto de atenção é <b>{AREA_LABEL[result.second]}</b>. As notas das outras áreas e o seu plano para corrigir cada uma ficam no Pro.</span></p>
      </section>

      <section className="dq-card dq-cta lv-offer">
        <h2>Para ter o controle total da sua vida, assine o Pro.</h2>
        <ul className="lv-get">
          <li><Sparkles aria-hidden />Seu diagnóstico completo, área por área</li>
          <li><Sparkles aria-hidden />A VIVA no seu WhatsApp: gastos, contas, agenda e lembretes</li>
          <li><Sparkles aria-hidden />Quanto você pode gastar por dia até o salário</li>
          <li><Sparkles aria-hidden />Diário de alimentação com foto do prato, água e treinos</li>
        </ul>
        {offer && <OfferCountdown expiresAt={offer.expiresAt} onExpire={onExpire} />}
        <Link href={cta} className="dq-btn light" onClick={() => event("vida_cta")}>Quero o controle total <ArrowRight aria-hidden /></Link>
        <p className="lv-price">{promo ? <><s>{brl(FUNNEL_REGULAR_BRL)}</s> <b>{brl(FUNNEL_PRICE_BRL)}</b>/mês</> : <><b>{brl(FUNNEL_REGULAR_BRL)}</b>/mês</>}</p>
        <p className="lv-guarantee"><ShieldCheck aria-hidden /><span><b>Garantia de 7 dias.</b> Não gostou? Devolvemos 100% do valor, sem perguntas.</span></p>
      </section>
      <p className="dq-disclaimer"><ShieldCheck aria-hidden />Resultado educativo, calculado a partir das suas respostas. Não substitui orientação médica ou financeira profissional.</p>
    </>}
  </main>;
}
