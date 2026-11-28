"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { AREA_LABEL, LIFE_KEY, PLAN, computeLife, type LifeAnswers, type LifeResult } from "@/lib/life-diagnostic";

const tone = (s: number) => (s < 40 ? "low" : s < 70 ? "mid" : "ok");

/** Diagnóstico completo: as 5 áreas com nota e o plano passo a passo de cada uma, ligado às funções do app. */
export default function FullDiagnostic({ serverAnswers, firstName }: { serverAnswers: LifeAnswers | null; firstName: string }) {
  const [result, setResult] = useState<LifeResult | null>(serverAnswers && Object.keys(serverAnswers).length >= 8 ? computeLife(serverAnswers) : null);
  const [ready, setReady] = useState(!!result);
  useEffect(() => {
    if (result) return;
    try { const saved = JSON.parse(localStorage.getItem(LIFE_KEY) || "null") as { answers?: LifeAnswers } | null; if (saved?.answers) setResult(computeLife(saved.answers)); } catch { /* sem dados */ }
    setReady(true);
  }, [result]);

  if (!ready) return <main className="dq lv" />;
  return <main id="conteudo" className="dq lv">
    <header className="dq-top"><Link href="/meu-dia" className="dq-logo" aria-label="VIVA+">VIVA<span>+</span></Link><Link href="/meu-dia" className="lv-step">Ir para o app</Link></header>
    {!result ? <section className="dq-card dq-intro">
      <span className="dq-pill">Pro ativo</span>
      <h1>{firstName ? `${firstName}, f` : "F"}aça o diagnóstico para montar seu plano</h1>
      <p>Não encontramos suas respostas neste aparelho. Leva 1 minuto e o resultado completo aparece aqui.</p>
      <Link href="/diagnostico-vida" className="dq-btn">Fazer meu diagnóstico <ArrowRight aria-hidden /></Link>
    </section> : <>
      <section className="dq-card lv-result">
        <span className="dq-pill lv-pill">Diagnóstico completo · Pro</span>
        <div className="lv-index"><strong>{result.index}<small>/100</small></strong><span>{firstName ? firstName + ", este" : "Este"} é o equilíbrio da sua vida hoje</span></div>
        <ul className="lv-areas full" aria-label="Notas por área">{result.areas.map(x => <li key={x.area} className={"t-" + tone(x.score)}><span>{AREA_LABEL[x.area]}</span><i><b style={{ width: Math.max(6, x.score) + "%" }} /></i><em>{x.score}</em></li>)}</ul>
        <div className="lv-alert"><small>Comece por aqui: {AREA_LABEL[result.worst]}</small><b>{result.headline}</b><p>{result.detail}</p></div>
      </section>
      {result.areas.map((x, idx) => <section key={x.area} className="dq-card lv-plan-full">
        <div className="lv-plan-head"><span className={"lv-badge t-" + tone(x.score)}>{x.score}/100</span><h2>{idx === 0 ? "Prioridade 1: " : idx === 1 ? "Prioridade 2: " : ""}{AREA_LABEL[x.area]}</h2></div>
        <ol>{PLAN[x.area].map(s => <li key={s.title}><b>{s.title}</b><span>{s.text}</span><Link href={s.href}>{s.cta} <ArrowRight aria-hidden /></Link></li>)}</ol>
      </section>)}
      <section className="dq-card dq-cta"><h2>Próximo passo: conecte a VIVA no seu WhatsApp</h2><p className="lv-on-dark">É por lá que ela lembra seus passos todos os dias, anota gastos e avisa as contas.</p>
        <Link href="/perfil" className="dq-btn light"><Sparkles aria-hidden />Conectar meu WhatsApp</Link>
        <ul className="dq-trust on-dark"><li><Check aria-hidden />Leva 30 segundos</li></ul></section>
    </>}
  </main>;
}

/** Volta do cartão: o pagamento pode levar alguns segundos para confirmar. Atualiza sozinho por até 3 minutos. */
export function WaitingPayment() {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  useEffect(() => { if (tries >= 36) return; const t = setTimeout(() => { setTries(n => n + 1); router.refresh(); }, 5000); return () => clearTimeout(t); }, [tries, router]);
  return <main id="conteudo" className="dq lv"><header className="dq-top"><span className="dq-logo">VIVA<span>+</span></span></header>
    <section className="dq-card lv-loading" role="status">{tries < 36 ? <><span className="lv-spin" aria-hidden /><h2>Confirmando seu pagamento…</h2><p>Leva alguns segundos. Esta tela abre o seu diagnóstico completo sozinha.</p></>
      : <><h2>Seu pagamento ainda está em análise</h2><p>Assim que o Mercado Pago confirmar, o Pro é liberado e avisamos você. Pode fechar esta tela.</p><Link href="/meu-dia" className="dq-btn">Ir para o app</Link></>}</section></main>;
}
