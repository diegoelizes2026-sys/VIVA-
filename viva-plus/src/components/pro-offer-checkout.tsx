"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, CreditCard, Lock, ShieldCheck, Sparkles } from "lucide-react";
import OfferCountdown from "@/components/offer-countdown";
import { PixSheet, type PixData } from "@/app/(app)/planos/checkout-actions";
import { AREA_LABEL, FUNNEL_OFFER, FUNNEL_PRICE_BRL, LIFE_KEY, brl, clock, type LifeResult } from "@/lib/life-diagnostic";

function load<T>(k: string): T | null { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) as T : null; } catch { return null; } }

/** Tela de pagamento do Pro no funil: gancho, resultado parcial, relógio, preço logo abaixo do botão e garantia. */
export default function ProOfferCheckout({ deadline, expiredAt, regular, firstName }: { deadline: string | null; expiredAt: string | null; regular: number; firstName: string }) {
  const [result, setResult] = useState<LifeResult | null>(null);
  const [expired, setExpired] = useState(!deadline);
  const [loading, setLoading] = useState<"pix" | "card" | null>(null);
  const [error, setError] = useState("");
  const [pix, setPix] = useState<PixData | null>(null);
  const session = useRef("");

  useEffect(() => {
    setResult(load<{ result: LifeResult }>(LIFE_KEY)?.result ?? null);
    try { session.current = crypto.randomUUID().replace(/-/g, ""); } catch { session.current = Date.now().toString(36) + "visit"; }
    track("offer_view");
  }, []);

  function track(name: string) {
    try { void fetch("/api/diagnostic/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session: session.current, event: name, ...(load<Record<string, string>>(LIFE_KEY + ":utm") || {}) }), keepalive: true }).catch(() => {}); } catch { /* sem rede */ }
  }

  const onExpire = useCallback(() => setExpired(true), []);
  const promo = !!deadline && !expired;
  const price = promo ? FUNNEL_PRICE_BRL : regular;

  async function pay(method: "pix" | "card") {
    if (loading) return; setLoading(method); setError(""); track("offer_checkout");
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

  return <main id="conteudo" className="dq lv">
    <header className="dq-top"><span className="dq-logo">VIVA<span>+</span></span><span className="lv-step">Passo 2 de 2 · pagamento</span></header>

    <section className="dq-card lv-hook">
      <span className="dq-pill lv-pill">Conta criada{firstName ? `, ${firstName}` : ""}!</span>
      <h1>Para ter o controle total da sua vida, assine o Pro.</h1>
      {result ? <div className="lv-alert"><small>Seu ponto mais desequilibrado: {AREA_LABEL[result.worst]}</small><b>{result.headline}</b>
        <p className="lv-teaser"><Lock aria-hidden /><span>O diagnóstico completo das 5 áreas e o plano para corrigir cada uma são liberados assim que o pagamento confirmar.</span></p></div>
        : <p>Diagnóstico completo, a VIVA no seu WhatsApp e tudo do Pro liberado assim que o pagamento confirmar.</p>}
    </section>

    <section className="dq-card lv-pay">
      {deadline ? <OfferCountdown expiresAt={deadline} onExpire={onExpire} regular={regular} />
        : expiredAt ? <OfferCountdown expiresAt={expiredAt} regular={regular} /> : null}
      <div className="lv-plan"><span>Plano Pro · mensal</span>{promo ? <strong><s>{brl(regular)}</s> {brl(FUNNEL_PRICE_BRL)}<small>/mês</small></strong> : <strong>{brl(regular)}<small>/mês</small></strong>}</div>
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
      <p className="lv-fine">No Pix, vale por 30 dias e não renova sozinho. No cartão, {brl(price)} por mês, renovação automática; cancele quando quiser, sem multa.{promo && deadline ? ` Preço promocional para assinaturas feitas até ${clock(deadline)}.` : ""} Ao assinar, você concorda com os <a href="/termos" target="_blank" rel="noopener noreferrer">Termos de Uso</a> e a <a href="/reembolso" target="_blank" rel="noopener noreferrer">Política de Reembolso</a>.</p>
    </section>

    <p className="lv-skip"><Sparkles aria-hidden /><Link href="/meu-dia">Agora não, quero conhecer o plano grátis</Link></p>
    {pix && <PixSheet pix={pix} onClose={() => setPix(null)} onCard={() => pay("card")} />}
  </main>;
}
