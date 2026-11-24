"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  FINANCE_FLOW, PERSONAL_FLOW, applicable, inferExtras, labelOf, nextQuestion, optionsOf, progress, readAnswer,
  type Answer, type Answers, type AnswerValue, type Diagnosis, type Question,
} from "@/lib/onboarding/flows";
import { ProOffer } from "@/components/credit-ui";

type Kind = "finance" | "personal";
type Phase = "loading" | "intro" | "chat" | "diagnosis" | "done";
const brl = (n: number | null) => n == null ? "Não informado" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const CERT: Record<string, string> = { confirmed: "Confirmado", estimated: "Estimado", unknown: "Não informado" };

async function save(kind: Kind, body: Record<string, unknown>) {
  const r = await fetch("/api/onboarding", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, ...body }) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Não foi possível salvar.");
}

export default function OnboardingChat({ kind, embedded = false, onDone, onClose }: { kind: Kind; embedded?: boolean; onDone?: () => void; onClose?: () => void }) {
  const flow = kind === "finance" ? FINANCE_FLOW : PERSONAL_FLOW;
  const [phase, setPhase] = useState<Phase>("loading");
  const [answers, setAnswers] = useState<Answers>({});
  const [text, setText] = useState("");
  const [multi, setMulti] = useState<string[]>([]);
  const [typing, setTyping] = useState(false);
  const [saved, setSaved] = useState<"" | "saving" | "saved" | "error">("");
  const [error, setError] = useState("");
  const [diag, setDiag] = useState<{ diagnosis: Diagnosis; narrative: string } | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{ offerPro?: boolean; applied?: string[] } | null>(null);
  const [misunderstood, setMisunderstood] = useState(false);
  const [savedAnswers, setSavedAnswers] = useState<Answers | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const current = useMemo(() => nextQuestion(flow, answers), [flow, answers]);
  const prog = progress(flow, answers);

  // Retoma de onde parou (respostas salvas no servidor).
  useEffect(() => {
    let alive = true;
    fetch("/api/onboarding?kind=" + kind).then(r => r.json()).then(d => {
      if (!alive) return;
      const s = d.session;
      if (s && !s.legacy && s.status === "in_progress" && s.consent_at) {
        setAnswers((s.answers || {}) as Answers);
        setPhase(nextQuestion(flow, (s.answers || {}) as Answers) ? "chat" : kind === "finance" ? "diagnosis" : "chat");
      } else if (s?.status === "completed" && !embedded) setPhase("done");
      else { if (s && !s.legacy && s.answers && Object.keys(s.answers).length) setSavedAnswers(s.answers as Answers); setPhase("intro"); }
    }).catch(() => alive && setPhase("intro"));
    return () => { alive = false; };
  }, [kind, flow, embedded]);

  useEffect(() => {
    // Na tela cheia (celular), a própria página rola: vai até o fim, onde a pergunta atual fica logo acima das opções.
    const id = requestAnimationFrame(() => {
      const page = endRef.current?.closest(".ob-page") as HTMLElement | null;
      if (page && page.scrollHeight > page.clientHeight) page.scrollTo({ top: page.scrollHeight, behavior: "smooth" });
      else endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
    return () => cancelAnimationFrame(id);
  }, [answers, typing, phase, misunderstood]);
  useEffect(() => { if (phase === "chat" && !typing) inputRef.current?.focus({ preventScroll: true }); }, [phase, typing, current?.id]);
  useEffect(() => { if (phase === "diagnosis" && !diag && kind === "finance") loadDiagnosis(); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  async function persist(next: Answers, skippedId?: string) {
    setSaved("saving");
    try { await save(kind, { answers: next, step: nextQuestion(flow, next)?.id ?? "end", ...(skippedId ? { skipped_questions: Object.keys(next).filter(k => next[k].skipped) } : {}) }); setSaved("saved"); }
    catch { setSaved("error"); }
  }

  async function start() {
    setError("");
    try {
      // Quem pulou no meio continua de onde parou; quem nunca começou inicia do zero.
      if (savedAnswers) { await save(kind, { consent: true, status: "in_progress" }); setAnswers(savedAnswers); setPhase(nextQuestion(flow, savedAnswers) ? "chat" : kind === "finance" ? "diagnosis" : "chat"); }
      else { await save(kind, { consent: true, restart: true }); setAnswers({}); setPhase("chat"); }
    }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível começar."); }
  }

  function commit(q: Question, ans: Answer, extras: Answers = {}) {
    const next: Answers = { ...answers, [q.id]: ans };
    // Não repetir perguntas: o que foi dito de forma espontânea já fica respondido.
    for (const [id, a] of Object.entries(extras)) if (!(id in next) && flow.some(f => f.id === id)) next[id] = a;
    setAnswers(next); setText(""); setMulti([]); setMisunderstood(false);
    setTyping(true); window.setTimeout(() => setTyping(false), 420);
    void persist(next, ans.skipped ? q.id : undefined);
    if (!nextQuestion(flow, next)) window.setTimeout(() => setPhase(kind === "finance" ? "diagnosis" : "chat"), 450);
  }

  function submitText(e?: FormEvent) {
    e?.preventDefault(); if (!current) return;
    if (current.type === "multi" && multi.length && !text.trim()) { commit(current, { value: multi, certainty: "confirmed" }); return; }
    const ans = readAnswer(current, text, answers);
    if (!ans) { setMisunderstood(true); return; }
    commit(current, ans, inferExtras(text));
  }
  function choose(value: AnswerValue, label?: string) {
    if (!current) return;
    if (value === null) { commit(current, { value: null, certainty: "unknown", skipped: true, raw: label }); return; }
    commit(current, { value, certainty: "confirmed", raw: label });
  }
  function skip() { if (current) commit(current, { value: null, certainty: "unknown", skipped: true, raw: "Pulei" }); }
  function undo() {
    const answered = applicable(flow, answers).filter(q => q.id in answers);
    const last = answered[answered.length - 1]; if (!last) return;
    const next = { ...answers }; delete next[last.id]; setAnswers(next); setPhase("chat"); setDiag(null); void persist(next);
  }

  async function loadDiagnosis() {
    setError("");
    try {
      const r = await fetch("/api/onboarding/diagnosis", { method: "POST" }); const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Não foi possível montar o diagnóstico.");
      setDiag(d); setChosen((d.diagnosis as Diagnosis).actions.map(a => a.id));
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível montar o diagnóstico."); }
  }
  async function apply() {
    setApplying(true); setError("");
    try {
      const r = await fetch("/api/onboarding/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, actions: chosen }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Não foi possível salvar.");
      setResult(d); setPhase("done"); onDone?.();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar."); } finally { setApplying(false); }
  }
  async function skipAll() {
    try { await save(kind, { status: "skipped" }); } catch { /* segue para o app mesmo assim */ }
    window.location.href = "/meu-dia";
  }

  // ------------------------------------------------ telas
  if (phase === "loading") return <div className={"ob" + (embedded ? " embedded" : "")}><p className="ob-muted">Carregando…</p></div>;

  if (phase === "intro") return <div className={"ob" + (embedded ? " embedded" : "")}>
    <div className="ob-intro">
      <span className="ob-orb" aria-hidden="true" />
      {kind === "finance" ? <>
        <h1>Olá! Eu sou a VIVA.</h1>
        <p>Em 3 minutos eu descubro <b>quanto você pode gastar por dia</b> sem faltar dinheiro até o próximo pagamento, e monto um plano para o seu dinheiro começar a sobrar.</p>
        <p>É só responder algumas perguntas rápidas sobre a sua realidade.</p>
      </> : <>
        <h1>Vamos montar o seu Personal</h1>
        <p>São 7 perguntas rápidas sobre seu objetivo, rotina e cuidados, para eu sugerir treinos do seu jeito.</p>
      </>}
      <ul className="ob-facts">
        <li>Leva cerca de {kind === "finance" ? "3" : "1"} minuto{kind === "finance" ? "s" : ""} e não consome créditos.</li>
        <li>Você pode pular qualquer pergunta e completar depois.</li>
        <li>{kind === "finance" ? "Suas respostas ficam salvas e só você tem acesso. Você pode editar ou excluir em Meus dados." : "Dados de saúde ficam separados dos financeiros e só você tem acesso."}</li>
      </ul>
      <button className="ob-cta" onClick={start}>{savedAnswers ? "Continuar de onde parei" : "Vamos começar"}</button>
      {kind === "finance" && !embedded && <button className="ob-link" onClick={skipAll}>Pular por enquanto</button>}
      {kind === "finance" ? <small className="ob-muted">Ao continuar, você permite que o VIVA+ use essas respostas para personalizar sua experiência, conforme a <Link href="/privacidade">Política de Privacidade</Link>.</small> : <small className="ob-muted"><b>Consentimento para dados de saúde:</b> ao tocar em “Vamos começar”, você autoriza o VIVA+ a usar as informações de saúde que informar (objetivo, peso, rotina e limitações) só para montar e ajustar seus treinos e hábitos. Não compartilhamos esses dados para outros fins. Você pode revogar e apagar tudo em Meus dados a qualquer momento. Veja a <Link href="/privacidade">Política de Privacidade</Link>.</small>}
      {error && <p className="ob-error" role="alert">{error}</p>}
    </div>
  </div>;

  if (phase === "done") return <div className={"ob" + (embedded ? " embedded" : "")}><div className="ob-done">
    <span className="ob-check" aria-hidden="true" />
    {kind === "finance" ? <>
      <h2>Seu planejamento está pronto</h2>
      <p>{result?.applied?.length ? `Configurei ${result.applied.length} ${result.applied.length === 1 ? "item" : "itens"} no seu painel com o que você confirmou.` : "Seu perfil foi salvo. Você pode ajustar tudo no painel quando quiser."}</p>
      <div className="ob-done-actions">
        <Link className="ob-cta" href="/financas">Ver meu painel</Link>
        <Link className="ob-cta ghost" href="/saude?configurar=1">Configurar meu Personal</Link>
      </div>
      {result?.offerPro && <div className="ob-pro"><ProOffer title="Quer ir além do plano inicial?" text="Com o Pro, a VIVA acompanha seu planejamento todo mês, com análises e recomendações personalizadas." /></div>}
    </> : <>
      <h2>Personal configurado</h2>
      <p>Seu treino da semana já foi ajustado ao seu objetivo, ao seu tempo e ao lugar onde você treina.</p>
      {onClose ? <button className="ob-cta" onClick={onClose}>Ver meu treino</button> : <Link className="ob-cta" href="/saude">Ver meu treino</Link>}
    </>}
  </div></div>;

  if (phase === "diagnosis" && kind === "finance") {
    const d = diag?.diagnosis;
    return <div className={"ob" + (embedded ? " embedded" : "")}><div className="ob-diag">
      <header><span className="ob-step">Resumo para você conferir</span><h2>{d ? `Seu foco agora: ${d.focusTitle}` : "Montando seu diagnóstico…"}</h2>{diag?.narrative && <p>{diag.narrative}</p>}</header>
      {error && <p className="ob-error" role="alert">{error} <button className="ob-link" onClick={loadDiagnosis}>Tentar de novo</button></p>}
      {d && <>
        <div className="ob-kpis">
          <div><span>Renda considerada</span><b>{brl(d.income)}</b><em className={"c-" + d.incomeCertainty}>{CERT[d.incomeCertainty]}</em></div>
          <div><span>Gastos do mês</span><b>{brl(d.expenses)}</b><em className={"c-" + d.expensesCertainty}>{CERT[d.expensesCertainty]}</em></div>
          <div><span>Sobra estimada</span><b className={d.leftover != null && d.leftover < 0 ? "neg" : ""}>{brl(d.leftover)}</b><em className={"c-" + (d.leftover == null ? "unknown" : "estimated")}>{d.leftover == null ? "Falta informação" : "Cálculo"}</em></div>
          {d.debtTotal != null && <div><span>Dívidas</span><b>{brl(d.debtTotal)}</b><em>{d.debtMonthsToPay ? `~${d.debtMonthsToPay} meses para quitar` : "Sem valor mensal definido"}</em></div>}
        </div>
        {d.flags.length > 0 && <section className="ob-card"><h3>Pontos de atenção</h3><ul className="ob-flags">{d.flags.map(f => <li key={f.id} className={f.severity}>{f.text}</li>)}</ul></section>}
        <section className="ob-card"><h3>Primeiros passos</h3><ol className="ob-recs">{d.recommendations.map(r => <li key={r}>{r}</li>)}</ol></section>
        <section className="ob-card"><h3>Configurar no seu painel</h3>
          {d.actions.length ? <ul className="ob-actions">{d.actions.map(a => <li key={a.id}><label>
            <input type="checkbox" checked={chosen.includes(a.id)} onChange={e => setChosen(c => e.target.checked ? [...c, a.id] : c.filter(x => x !== a.id))} />
            <span><b>{a.label}</b><small>{a.detail}</small></span><em className={"c-" + a.certainty}>{CERT[a.certainty]}</em>
          </label></li>)}</ul> : <p className="ob-muted">Ainda faltam informações para sugerir orçamentos e metas. Você pode completar depois em Meus dados.</p>}
          <p className="ob-muted">Nada é cadastrado sem a sua confirmação. Valores estimados podem ser ajustados a qualquer momento.</p>
        </section>
        {d.unknown.length > 0 && <details className="ob-card"><summary>{d.unknown.length} pergunta{d.unknown.length > 1 ? "s" : ""} em aberto</summary><ul className="ob-unknown">{d.unknown.map(u => <li key={u}>{u}</li>)}</ul></details>}
        <div className="ob-diag-actions">
          <button className="ob-cta" disabled={applying} onClick={apply}>{applying ? "Salvando…" : chosen.length ? "Confirmar e montar meu painel" : "Salvar meu perfil"}</button>
          <button className="ob-link" onClick={undo}>Voltar e corrigir uma resposta</button>
        </div>
      </>}
    </div></div>;
  }

  // ------------------------------------------------ conversa
  const answered = applicable(flow, answers).filter(q => q.id in answers);
  const opts = current ? optionsOf(current, answers) : [];
  const personalDone = kind === "personal" && !current;
  return <div className={"ob" + (embedded ? " embedded" : "")}>
    <div className="ob-top">
      <div className="ob-progress" role="progressbar" aria-valuenow={prog.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso"><i style={{ width: prog.pct + "%" }} /></div>
      <div className="ob-top-row"><span>{current?.block || "Finalizando"} · {prog.done} de {prog.total}</span>{kind === "finance" && !embedded && <button type="button" className="ob-link" onClick={skipAll}>Continuar depois</button>}<span className="ob-saved" aria-live="polite">{saved === "saving" ? "Salvando…" : saved === "saved" ? "Salvo" : saved === "error" ? "Sem conexão: tentaremos de novo" : ""}</span></div>
    </div>
    <div className="ob-thread">
      {answered.map(q => <div key={q.id} className="ob-pair">
        <div className="ob-bot"><p>{q.ask(answers)}</p></div>
        <div className="ob-me"><p>{answers[q.id].skipped ? "Pular por agora" : answers[q.id].raw && q.type !== "money" && q.type !== "multi" && !answers[q.id].inferred ? answers[q.id].raw : labelOf(q, answers, answers[q.id].value)}{answers[q.id].certainty === "estimated" && <em> · estimado</em>}{answers[q.id].inferred && <em> · entendi pela sua resposta</em>}</p></div>
      </div>)}
      {typing && <div className="ob-bot"><p className="ob-typing"><span /><span /><span /></p></div>}
      {!typing && current && <div className="ob-bot ob-current" key={current.id}><p>{current.ask(answers)}</p>{current.hint?.(answers) && <small>{current.hint(answers)}</small>}</div>}
      {misunderstood && <div className="ob-bot"><p>Não consegui entender. {current?.type === "money" ? "Pode escrever só o valor, por exemplo 2500." : "Pode escolher uma das opções abaixo."}</p></div>}
      {personalDone && <div className="ob-card ob-review"><h3>Confira suas respostas</h3><ul>{answered.map(q => <li key={q.id}><span>{q.ask(answers)}</span><b>{labelOf(q, answers, answers[q.id].value)}</b></li>)}</ul>
        <div className="ob-diag-actions"><button className="ob-cta" disabled={applying} onClick={apply}>{applying ? "Salvando…" : "Salvar e montar meu treino"}</button><button className="ob-link" onClick={undo}>Corrigir a última resposta</button></div>
        {error && <p className="ob-error" role="alert">{error}</p>}</div>}
      <div ref={endRef} />
    </div>
    {current && !typing && <div className="ob-answer">
      {(opts.length > 0 || current.quick || current.type === "yesno") && <div className="ob-chips">
        {current.type === "multi" ? opts.map(o => <button key={o.value} type="button" aria-pressed={multi.includes(o.value)} className={multi.includes(o.value) ? "on" : ""} onClick={() => setMulti(m => m.includes(o.value) ? m.filter(x => x !== o.value) : [...m, o.value])}>{o.label}</button>)
          : current.type === "yesno" ? [<button key="s" type="button" onClick={() => choose(true, "Sim")}>Sim</button>, <button key="n" type="button" onClick={() => choose(false, "Não")}>Não</button>]
          : opts.map(o => <button key={o.value} type="button" onClick={() => choose(o.value, o.label)}>{o.label}</button>)}
        {current.quick?.map(q => <button key={q.label} type="button" className="soft" onClick={() => choose(q.value, q.label)}>{q.label}</button>)}
      </div>}
      {current.type === "multi" && multi.length > 0 && <button className="ob-cta small" type="button" onClick={() => commit(current, { value: multi, certainty: "confirmed" })}>Continuar com {multi.length} {multi.length === 1 ? "opção" : "opções"}</button>}
      <form className="ob-input" onSubmit={submitText}>
        <input ref={inputRef} value={text} onChange={e => setText(e.target.value)} inputMode={current.type === "money" ? "decimal" : "text"} placeholder={current.placeholder || (current.type === "money" ? "Digite o valor" : current.type === "yesno" ? "Sim ou não" : "Escreva sua resposta")} aria-label="Sua resposta" maxLength={300} />
        <button type="submit" disabled={!text.trim() && !(current.type === "multi" && multi.length)} aria-label="Enviar resposta"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
      </form>
      <div className="ob-answer-foot"><button type="button" className="ob-link" onClick={skip}>Pular esta pergunta</button>{answered.length > 0 && <button type="button" className="ob-link" onClick={undo}>Voltar</button>}</div>
    </div>}
  </div>;
}
