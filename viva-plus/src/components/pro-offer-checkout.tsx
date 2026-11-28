"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CreditCard, Flame, Lock, ShieldCheck, Sparkles, X } from "lucide-react";
import OfferCountdown from "@/components/offer-countdown";
import { useDiagnosticsCount } from "@/components/life-diagnostic";
import { PixSheet, type PixData } from "@/app/(app)/planos/checkout-actions";
import { createClient } from "@/lib/supabase/client";
import { AREA_LABEL, FUNNEL_OFFER, FUNNEL_PRICE_BRL, LIFE_KEY, PLAN, brl, clock, pricePerDay, type LifeAnswers, type LifeResult } from "@/lib/life-diagnostic";

function load<T>(k: string): T | null { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) as T : null; } catch { return null; } }
const EXIT_KEY = "viva-offer-exit-shown";

/** Tela de pagamento do Pro no funil: gancho, resultado parcial, plano bloqueado, relógio, preço abaixo do botão e garantia. */
export default function ProOfferCheckout({ deadline, expiredAt, regular, firstName, hasAnswers }: { deadline: string | null; expiredAt: string | null; regular: number; firstName: string; hasAnswers?: boolean }) {
  const [result, setResult] = useState<LifeResult | null>(null);
  const [expired, setExpired] = useState(!deadline);
  const [loading, setLoading] = useState<"pix" | "card" | null>(null);
  const [error, setError] = useState("");
  const [pix, setPix] = useState<PixData | null>(null);
  const [exit, setExit] = useState(false);
  const session = useRef("");
  const proof = useDiagnosticsCount();

  const showExit = useCallback(() => {
    try { if (sessionStorage.getItem(EXIT_KEY)) return false; sessionStorage.setItem(EXIT_KEY, "1"); } catch { /* navegação privada */ }
    setExit(true); return true;
  }, []);

  useEffect(() => {
    const saved = load<{ answers?: LifeAnswers; result: LifeResult }>(LIFE_KEY);
    setResult(saved?.result ?? null);
    try { session.current = crypto.randomUUID().replace(/-/g, ""); } catch { session.current = Date.now().toString(36) + "visit"; }
    track("offer_view");
    // Quem já tinha conta: guarda as respostas na conta para o diagnóstico completo abrir em qualquer aparelho.
    if (saved?.answers && !hasAnswers) { try { void createClient().auth.updateUser({ data: { life_answers: saved.answers } }).catch(() => {}); } catch { /* sem Supabase */ } }
    // "Antes de sair": uma vez por visita, ao voltar no navegador ou ao levar o mouse para fechar a aba (computador).
    try { history.pushState({ vivaOffer: 1 }, ""); } catch { /* sem histórico */ }
    const onPop = () => { if (!showExit()) history.back(); };
    const onLeave = (e: MouseEvent) => { if (e.clientY <= 0) showExit(); };
    window.addEventListener("popstate", onPop); document.addEventListener("mouseout", onLeave);
    return () => { window.removeEventListener("popstate", onPop); document.removeEventListener("mouseout", onLeave); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function track(name: string) {
    try { void fetch("/api/diagnostic/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session: session.current, event: name, ...(load<Record<string, string>>(LIFE_KEY + ":utm") || {}) }), keepalive: true }).catch(() => {}); } catch { /* sem rede */ }
  }

  const onExpire = useCallback(() => setExpired(true), []);
  const promo = !!deadline && !expired;
  const price = promo ? FUNNEL_PRICE_BRL : regular;

  async function pay(method: "pix" | "card") {
    if (loading) return; setExit(false); setLoading(method); setError(""); track("offer_checkout");
    try {
      const r = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId: "pro", interval: "monthly", method, ...(promo ? { offer: FUNNEL_OFFER } : {}) }) });
      const d = await r.json();
      if (r.status === 410) { setExpired(true); throw new Error(d.error || "A promoção terminou. O Pro segue pelo preço normal."); }
      if (!r.ok) throw new Error(d.error || "Não foi possível iniciar o pagamento.");
      if (method === "card" && d.checkoutUrl) { window.location.assign(d.checkoutUrl); return; }
      setPix(d);
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao iniciar pagamento."); }
    finally { setLoading(null); }
  }
  function skip() { if (!showExit()) window.location.assign("/meu-dia"); }

  return <main id="conteudo" className="dq lv">
    <header className="dq-top"><span className="dq-logo">VIVA<span>+</span></span><span className="lv-step">Passo 2 de 2 · pagamento</span></header>

    <section className="dq-card lv-hook">
      <span className="dq-pill lv-pill">Conta criada{firstName ? `, ${firstName}` : ""}!</span>
      <h1>Para ter o controle total da sua vida, assine o Pro.</h1>
      {result ? <div className="lv-alert"><small>Seu ponto mais desequilibrado: {AREA_LABEL[result.worst]}</small><b>{result.headline}</b></div>
        : <p>Seu número do dia, a VIVA no seu WhatsApp e tudo do Pro liberados assim que o pagamento confirmar.</p>}
    </section>

    <section className="dq-card lv-pay">
      {deadline ? <OfferCountdown expiresAt={deadline} onExpire={onExpire} regular={regular} />
        : expiredAt ? <OfferCountdown expiresAt={expiredAt} regular={regular} /> : null}
      <div className="lv-plan"><span>Plano Pro · mensal<small>menos de {pricePerDay(price)} por dia</small></span>{promo ? <strong><s>{brl(regular)}</s> {brl(FUNNEL_PRICE_BRL)}<small>/mês</small></strong> : <strong>{brl(regular)}<small>/mês</small></strong>}</div>
      <ul className="lv-get">
        <li><Check aria-hidden />Diagnóstico completo e plano para cada área</li>
        <li><Check aria-hidden />VIVA no WhatsApp sem limite de mensagens</li>
        <li><Check aria-hidden />Número do dia, contas e lembretes antes do vencimento</li>
        <li><Check aria-hidden />Saúde: foto do prato, calorias, água e treinos</li>
        <li><Check aria-hidden />Áudio e foto de comprovante à vontade</li>
      </ul>
      <button type="button" className="dq-btn lv-pay-btn" disabled={!!loading} onClick={() => pay("pix")}>{loading === "pix" ? "Gerando Pix…" : <>Assinar o Pro com Pix</>}</button>
      <p className="lv-price under">{promo ? <><s>{brl(regular)}</s> <b>{brl(price)}</b></> : <b>{brl(price)}</b>} · libera na hora</p>
      <button type="button" className="dq-btn ghost" disabled={!!loading} onClick={() => pay("card")}><CreditCard aria-hidden />{loading === "card" ? "Abrindo o cartão…" : `Assinar no cartão · ${brl(price)}/mês`}</button>
      {error && <p className="dq-err" role="alert">{error}</p>}
      <div className="lv-guarantee big"><ShieldCheck aria-hidden /><span><b>Garantia de 7 dias</b>Use o Pro à vontade. Se não gostar, peça o reembolso em até 7 dias e devolvemos 100% do valor, sem perguntas.</span></div>
      {proof ? <p className="lv-proof in-card"><Flame aria-hidden /><span><b>{proof.toLocaleString("pt-BR")} pessoas</b> fizeram o diagnóstico nos últimos 7 dias</span></p> : null}
      <p className="lv-fine">No Pix, vale por 30 dias e não renova sozinho. No cartão, {brl(price)} por mês, renovação automática{promo ? ": o preço não aumenta enquanto você mantiver a assinatura" : ""}; cancele quando quiser, sem multa.{promo && deadline ? ` Preço promocional para assinaturas feitas até ${clock(deadline)}.` : ""} Ao assinar, você concorda com os <a href="/termos" target="_blank" rel="noopener noreferrer">Termos de Uso</a> e a <a href="/reembolso" target="_blank" rel="noopener noreferrer">Política de Reembolso</a>.</p>
    </section>

    {result && <section className="dq-card lv-plan-preview compact">
      <h2>Pronto para liberar: seu plano para {AREA_LABEL[result.worst].toLowerCase()}</h2>
      <ol>{PLAN[result.worst].map((s, i) => <li key={s.title} className="is-locked"><b>{i === 0 ? s.title : "Passo " + (i + 1)}</b><span className="lv-blur-text" aria-hidden="true">{s.text}</span></li>)}</ol>
      <p className="lv-teaser"><Lock aria-hidden /><span>+ as notas e os planos das outras 4 áreas. Tudo abre assim que o pagamento confirmar.</span></p>
    </section>}

    <p className="lv-skip"><Sparkles aria-hidden /><button type="button" onClick={skip}>Agora não, quero conhecer o plano grátis</button></p>

    {exit && <div className="fs-layer" role="dialog" aria-modal="true" aria-labelledby="ex-title">
      <button type="button" className="fs-backdrop" aria-label="Fechar" onClick={() => setExit(false)} />
      <section className="fs-sheet lv-exit">
        <button type="button" className="fs-close" onClick={() => setExit(false)} aria-label="Fechar"><X aria-hidden /></button>
        <span className="fs-step">Antes de sair{firstName ? `, ${firstName}` : ""}</span>
        <h2 id="ex-title">{result ? `Seu plano para ${AREA_LABEL[result.worst].toLowerCase()} já está pronto` : "Seu Pro está a um passo"}</h2>
        {result && <p className="fs-sub">{result.headline}. Sem um plano, isso continua igual no mês que vem.</p>}
        <ul className="lv-get dark"><li><ShieldCheck aria-hidden />Teste por 7 dias. Não gostou, devolvemos 100%.</li><li><Check aria-hidden />{promo ? `${brl(FUNNEL_PRICE_BRL)} até ${clock(deadline!)}: menos de ${pricePerDay(FUNNEL_PRICE_BRL)} por dia` : `Menos de ${pricePerDay(price)} por dia`}</li><li><Check aria-hidden />Cancele quando quiser, sem multa</li></ul>
        <button type="button" className="dq-btn lv-pay-btn" onClick={() => pay("pix")}>Liberar meu plano com Pix · {brl(price)}</button>
        <button type="button" className="lv-exit-no" onClick={() => window.location.assign("/meu-dia")}>Continuar no plano grátis</button>
      </section>
    </div>}
    {pix && <PixSheet pix={pix} onClose={() => setPix(null)} onCard={() => pay("card")} successHref="/meu-diagnostico" successLabel="Ver meu diagnóstico completo" />}
  </main>;
}
