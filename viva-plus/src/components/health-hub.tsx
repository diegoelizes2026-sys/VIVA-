"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Activity, BedDouble, Check, ChartColumn, Droplet, Dumbbell, Flame, HeartPulse, Info, Mic, Play, Salad, Scale, SendHorizontal, Settings2, Star, Target, Trash2, Trophy, X, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CreditMeter, CreditNotice, OutOfCredits, UpgradeSheet, makeRequestKey, type Wallet } from "@/components/credit-ui";
import { GOALS, PLANS, TIPS, WEEKDAYS, adaptPlan, type HealthGoal } from "@/lib/health-plans";
import OnboardingChat from "@/components/onboarding-chat";

type Kind = "water" | "sleep" | "weight" | "meal" | "activity" | "workout";
type Log = { id: string; kind: Kind; value: number; note: string | null; logged_on: string; created_at: string };
type Extra = { note?: string; meal_type?: string; quantity?: string; activity_type?: string; intensity?: string };
const TABLE: Record<Kind, string> = { water: "viva_water_logs", sleep: "viva_sleep_logs", weight: "viva_weight_logs", meal: "viva_food_logs", activity: "viva_activity_logs", workout: "viva_workout_logs" };
const MEAL_TYPES: [string, string][] = [["breakfast", "Café da manhã"], ["lunch", "Almoço"], ["snack", "Lanche"], ["dinner", "Jantar"]];
const ACTIVITY_TYPES: [string, string][] = [["walking", "Caminhada"], ["running", "Corrida"], ["gym", "Academia"], ["cycling", "Bike"], ["sports", "Esporte"], ["yoga", "Yoga / alongamento"], ["other", "Outra"]];
const INTENSITIES: [string, string][] = [["light", "Leve"], ["moderate", "Moderada"], ["vigorous", "Intensa"]];
const label = (list: [string, string][], v: string) => list.find(x => x[0] === v)?.[1] ?? v;
type Row = Record<string, unknown>;
// Converte as linhas de cada tabela de saúde para um formato único usado na tela.
function toLog(kind: Kind, r: Row): Log {
  const base = { id: String(r.id), kind, created_at: String(r.created_at ?? ""), logged_on: String(kind === "sleep" ? r.sleep_date : r.logged_on) };
  switch (kind) {
    case "water": return { ...base, value: Number(r.amount_ml), note: null };
    case "sleep": return { ...base, value: Number(r.sleep_hours), note: null };
    case "weight": return { ...base, value: Number(r.weight_kg), note: null };
    case "meal": return { ...base, value: Number(r.calories ?? 0), note: `${label(MEAL_TYPES, String(r.meal_type))}: ${r.food_name}${r.quantity && r.quantity !== "1 porção" ? ` (${r.quantity})` : ""}` };
    case "activity": return { ...base, value: Number(r.duration_minutes), note: `${label(ACTIVITY_TYPES, String(r.activity_type))} · ${label(INTENSITIES, String(r.intensity)).toLowerCase()}${r.notes ? ` · ${r.notes}` : ""}` };
    case "workout": return { ...base, value: Number(r.duration_minutes), note: String(r.focus) };
  }
}
type Personal = { onboarded: boolean; location: string | null; minutes: number | null; level: string | null; limitations: string | null };
type Profile = { goal: HealthGoal; trainer: "mulher" | "homem"; water_goal_ml: number; weekly_workouts: number; weekly_activity_min: number; target_weight_kg: number | null; personal?: Personal };
type ChatMessage = { role: "user" | "assistant"; content: string; credits?: number };
type Sheet = Kind | "goals" | null;

const DEFAULT_PROFILE: Profile = { goal: "saude", trainer: "mulher", water_goal_ml: 2000, weekly_workouts: 5, weekly_activity_min: 150, target_weight_kg: null };
const TZ = "America/Fortaleza";
const todayStr = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const addDays = (d: string, n: number) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const weekdayIdx = (d: string) => (new Date(d + "T12:00:00Z").getUTCDay() + 6) % 7;
const fmt = (n: number, digits = 1) => n.toLocaleString("pt-BR", { maximumFractionDigits: digits });
const KIND_META: Record<Kind, { label: string; title: string; unit: string; icon: typeof Droplet }> = {
  water: { label: "Água", title: "Registrar água", unit: "ml", icon: Droplet },
  sleep: { label: "Sono", title: "Registrar sono", unit: "h", icon: BedDouble },
  weight: { label: "Peso", title: "Registrar peso", unit: "kg", icon: Scale },
  meal: { label: "Alimentação", title: "Diário alimentar", unit: "kcal", icon: Salad },
  activity: { label: "Atividade", title: "Registrar atividade", unit: "min", icon: Activity },
  workout: { label: "Treino de hoje", title: "Treino de hoje", unit: "min", icon: Dumbbell },
};
const greeting = (t: "mulher" | "homem") => `👋 Olá! Eu sou ${t === "mulher" ? "a sua Personal" : "o seu Personal"} VIVA+. Posso montar seu treino, orientar os exercícios, repetições, séries, descanso e ajustar conforme sua evolução. Qual é o seu objetivo hoje?`;
const TRAINERS: { id: "mulher" | "homem"; label: string }[] = [{ id: "mulher", label: "Personal Mulher" }, { id: "homem", label: "Personal Homem" }];

type SpeechRec = { lang: string; interimResults: boolean; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };

export default function HealthHub() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [logs, setLogs] = useState<Log[]>([]);
  const [weights, setWeights] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [selectedDay, setSelectedDay] = useState(() => weekdayIdx(todayStr()));
  const [done, setDone] = useState<number[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: "" }]);
  const [input, setInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [upgrade, setUpgrade] = useState<string | null>(null);
  const requestRef = useRef<{ text: string; id: string; at: number } | null>(null);
  useEffect(() => { fetch("/api/assistant").then(r => r.ok ? r.json() : null).then(d => { if (d?.authenticated) setWallet(d); }).catch(() => {}); }, []);
  const outOfCredits = Boolean(wallet && wallet.available <= 0 && wallet.extra_credits <= 0);
  const [listening, setListening] = useState(false);
  const [speechOk, setSpeechOk] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);

  const today = todayStr();
  const todayIdx = weekdayIdx(today);
  const weekStart = addDays(today, -todayIdx);
  // Treino ajustado ao diagnóstico do Personal (dias, local, tempo e nível).
  const plan = profile.personal?.onboarded ? adaptPlan(PLANS[profile.goal], { days: profile.weekly_workouts, location: profile.personal.location, minutes: profile.personal.minutes, level: profile.personal.level }) : PLANS[profile.goal];
  const [setupOpen, setSetupOpen] = useState(false);
  useEffect(() => { try { if (new URLSearchParams(window.location.search).get("configurar") === "1") setSetupOpen(true); } catch { } }, []);
  const goalInfo = GOALS.find(g => g.id === profile.goal) ?? GOALS[3];
  const tip = TIPS[Number(today.slice(8, 10)) % TIPS.length];

  const load = useCallback(async () => {
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const since = addDays(today, -13);
      const kinds: Kind[] = ["water", "sleep", "meal", "activity", "workout"];
      const [p, w, ...rest] = await Promise.all([
        supabase.from("viva_health_profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("viva_weight_logs").select("*").eq("user_id", user.id).order("logged_on", { ascending: false }).order("created_at", { ascending: false }).limit(10),
        ...kinds.map(k => supabase.from(TABLE[k]).select("*").eq("user_id", user.id).gte(k === "sleep" ? "sleep_date" : "logged_on", since).order("created_at", { ascending: false }).limit(300)),
      ]);
      const failed = [p, w, ...rest].find(x => x.error);
      if (failed) throw failed.error;
      if (p.data) { const d = p.data as Row; setProfile({ goal: (d.goal as HealthGoal) || "saude", trainer: d.trainer === "homem" ? "homem" : "mulher", water_goal_ml: Number(d.water_goal_ml) || 2000, weekly_workouts: Number(d.weekly_workouts) || 5, weekly_activity_min: Number(d.weekly_activity_min) || 150, target_weight_kg: d.goal_weight_kg == null ? null : Number(d.goal_weight_kg), personal: { onboarded: Boolean(d.personal_onboarded_at), location: (d.train_location as string) ?? null, minutes: d.session_minutes == null ? null : Number(d.session_minutes), level: (d.experience_level as string) ?? null, limitations: (d.limitations as string) ?? null } }); }
      const weightLogs = ((w.data || []) as Row[]).map(r => toLog("weight", r));
      setWeights(weightLogs);
      setLogs([...weightLogs, ...rest.flatMap((res, i) => ((res.data || []) as Row[]).map(r => toLog(kinds[i], r)))].sort((a, b) => b.created_at.localeCompare(a.created_at)));
    } catch (e) {
      console.error("VIVA health load", e);
      setError("Não foi possível carregar seus registros de saúde agora. Atualize a página para tentar de novo.");
    } finally { setLoading(false); }
  }, [supabase, today]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { try { const raw = localStorage.getItem("viva-health-done-" + today); if (raw) setDone(JSON.parse(raw)); } catch { } }, [today]);
  useEffect(() => { const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }; setSpeechOk(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition)); }, []);
  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" }); }, [messages, chatBusy]);

  // ---- derived numbers ----
  const sum = (kind: Kind, from: string, to = today) => logs.filter(l => l.kind === kind && l.logged_on >= from && l.logged_on <= to).reduce((s, l) => s + l.value, 0);
  const todayLogs = (kind: Kind) => logs.filter(l => l.kind === kind && l.logged_on === today);
  const waterToday = sum("water", today);
  const sleepToday = todayLogs("sleep")[0]?.value ?? null;
  const lastWeight = weights[0]?.value ?? null;
  const activityToday = sum("activity", today) + sum("workout", today);
  const kcalToday = sum("meal", today);
  const workoutDays = new Set(logs.filter(l => l.kind === "workout" && l.logged_on >= weekStart).map(l => l.logged_on)).size;
  const waterWeek = sum("water", weekStart);
  const activityWeek = sum("activity", weekStart) + sum("workout", weekStart);
  const waterWeekGoal = profile.water_goal_ml * 7;
  const pct = (a: number, b: number) => (b > 0 ? Math.min(1, a / b) : 0);
  const weeklyScore = Math.round(((pct(workoutDays, profile.weekly_workouts) + pct(waterWeek, waterWeekGoal) + pct(activityWeek, profile.weekly_activity_min)) / 3) * 100);
  const workoutDoneToday = todayLogs("workout").length > 0;
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

  // ---- actions ----
  async function addLog(kind: Kind, value: number, extra: Extra = {}) {
    if (!userId) return false;
    const note = extra.note?.trim() || null;
    const payload: Row = { user_id: userId };
    if (kind === "water") Object.assign(payload, { amount_ml: Math.round(value), logged_on: today });
    if (kind === "sleep") Object.assign(payload, { sleep_hours: value, sleep_date: today });
    if (kind === "weight") Object.assign(payload, { weight_kg: value, logged_on: today });
    if (kind === "meal") Object.assign(payload, { meal_type: extra.meal_type || "lunch", food_name: (note || "Refeição").slice(0, 120), quantity: (extra.quantity?.trim() || "1 porção").slice(0, 40), calories: value > 0 ? value : null, logged_on: today });
    if (kind === "activity") Object.assign(payload, { activity_type: extra.activity_type || "other", intensity: extra.intensity || "moderate", duration_minutes: Math.round(value), notes: note?.slice(0, 240) ?? null, logged_on: today });
    if (kind === "workout") Object.assign(payload, { focus: (note || "Treino").slice(0, 120), duration_minutes: Math.round(value), logged_on: today });
    // Sono é um registro por dia: registrar de novo atualiza as horas.
    const query = kind === "sleep" ? supabase.from(TABLE.sleep).upsert(payload, { onConflict: "user_id,sleep_date" }) : supabase.from(TABLE[kind]).insert(payload);
    const { data, error: e } = await query.select("*").single();
    if (e || !data) { setError("Não foi possível salvar. Confira os valores e tente de novo."); return false; }
    const row = toLog(kind, data as Row);
    setLogs(c => [row, ...c.filter(l => !(l.kind === kind && l.id === row.id))]);
    if (kind === "weight") setWeights(c => [row, ...c]);
    setError("");
    return true;
  }
  async function removeLog(log: Log) {
    const { error: e } = await supabase.from(TABLE[log.kind]).delete().eq("id", log.id);
    if (e) { setError("Não foi possível apagar o registro."); return; }
    setLogs(c => c.filter(l => !(l.kind === log.kind && l.id === log.id))); if (log.kind === "weight") setWeights(c => c.filter(l => l.id !== log.id));
  }
  async function saveProfile(next: Partial<Profile>) {
    const merged = { ...profile, ...next }; setProfile(merged);
    if (!userId) return;
    const { error: e } = await supabase.from("viva_health_profiles").upsert({ user_id: userId, goal: merged.goal, trainer: merged.trainer, water_goal_ml: merged.water_goal_ml, weekly_workouts: merged.weekly_workouts, weekly_activity_min: merged.weekly_activity_min, goal_weight_kg: merged.target_weight_kg, updated_at: new Date().toISOString() });
    if (e) setError("Não foi possível salvar suas preferências.");
  }
  function toggleDone(i: number) {
    setDone(c => { const n = c.includes(i) ? c.filter(x => x !== i) : [...c, i]; try { localStorage.setItem("viva-health-done-" + today, JSON.stringify(n)); } catch { } return n; });
  }
  async function send(text: string) {
    const message = text.trim(); if (!message || chatBusy) return;
    const history = messages.slice(1).slice(-8);
    setMessages(m => [...m, { role: "user", content: message }]); setInput(""); setChatBusy(true);
    try {
      const r = await fetch("/api/personal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, history, requestId: makeRequestKey(requestRef, message) }) });
      const d = await r.json().catch(() => ({}));
      if (d.wallet) setWallet(d.wallet);
      if (d.upgrade && d.reason !== "no_credits") setUpgrade(String(d.message || ""));
      if (d.reason !== "no_credits") setMessages(m => [...m, { role: "assistant", content: String(d.answer || d.message || d.error || "Não consegui responder agora. Tente novamente."), credits: Number(d.usage?.credits) || 0 }]);
      else if (d.wallet) setWallet(d.wallet);
    } catch { setMessages(m => [...m, { role: "assistant", content: "Sem conexão com o Personal agora. Tente novamente em instantes." }]); }
    finally { setChatBusy(false); }
  }
  function toggleMic() {
    if (listening) { recRef.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition; if (!Ctor) return;
    const rec = new Ctor(); rec.lang = "pt-BR"; rec.interimResults = false;
    rec.onresult = e => { const t = Array.from(e.results).map(r => r[0]?.transcript || "").join(" ").trim(); if (t) setInput(c => (c ? c + " " : "") + t); };
    rec.onend = () => setListening(false); rec.onerror = () => setListening(false);
    recRef.current = rec; setListening(true); rec.start();
  }
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const quick: { kind: Kind | "evolucao"; label: string; icon: typeof Droplet }[] = [
    { kind: "workout", label: "Treino de hoje", icon: Dumbbell }, { kind: "water", label: "Água", icon: Droplet }, { kind: "sleep", label: "Sono", icon: BedDouble },
    { kind: "weight", label: "Peso", icon: Scale }, { kind: "meal", label: "Alimentação", icon: Salad }, { kind: "activity", label: "Atividade", icon: Activity }, { kind: "evolucao", label: "Evolução", icon: ChartColumn },
  ];

  return <div className="viva-health">
    {setupOpen && <div className="vc-sheet-layer" role="dialog" aria-modal="true" aria-label="Configurar Personal"><button className="vc-sheet-backdrop" aria-label="Fechar" onClick={() => setSetupOpen(false)} /><div className="vc-sheet vh-setup-sheet"><button className="vh-setup-close" onClick={() => { setSetupOpen(false); load(); }} aria-label="Fechar">Fechar</button><OnboardingChat kind="personal" embedded onDone={() => { load(); }} onClose={() => { setSetupOpen(false); load(); }} /></div></div>}
    <section className="vh-banner">
      <span className="vh-banner-icon"><HeartPulse /></span>
      <div><h1>Saúde e Bem-Estar</h1><p>Cuidar de você nunca foi tão simples. Treino, alimentação, sono, hidratação e muito mais, com o apoio da IA do VIVA+.</p></div>
    </section>

    <section className={"vh-hero trainer-" + profile.trainer}>
      <div className="vh-hero-photo" style={{ backgroundImage: `url(/saude/personal-${profile.trainer}.jpg)` }} role="img" aria-label="Seu Personal VIVA+" />
      <div className="vh-hero-body">
        <div className="vh-hero-title">
          <div><h2>VIVA+ <span>PERSONAL</span></h2><p>{profile.trainer === "mulher" ? "Sua treinadora virtual" : "Seu treinador virtual"} com IA <em>IA</em></p></div>
          <span className="vh-online"><i />Online</span>
        </div>
        {!loading && !profile.personal?.onboarded && <div className="vh-setup"><div><b>Configure seu Personal em 1 minuto</b><span>Objetivo, rotina e cuidados para treinos do seu jeito. Não consome créditos.</span></div><button type="button" onClick={() => setSetupOpen(true)}>Começar</button></div>}
        <div className="vh-trainers" role="radiogroup" aria-label="Escolha seu personal">
          {TRAINERS.map(t => <button key={t.id} type="button" role="radio" aria-checked={profile.trainer === t.id} className={profile.trainer === t.id ? "sel" : ""} onClick={() => saveProfile({ trainer: t.id })}>
            <span className="vh-trainer-face" style={{ backgroundImage: `url(/saude/personal-${t.id}.jpg)` }} />{t.label}{profile.trainer === t.id && <Check />}
          </button>)}
        </div>
        <div className="vh-thread" ref={threadRef} aria-live="polite">
          {messages.map((m, i) => <div key={i} className={"vh-msg " + m.role}><p>{i === 0 ? greeting(profile.trainer) : m.content}{m.credits ? <span className="vh-credit-tag">−{m.credits} {m.credits === 1 ? "crédito" : "créditos"}</span> : null}</p></div>)}
          {chatBusy && <div className="vh-msg assistant"><p className="vh-typing"><span /><span /><span /></p></div>}
        </div>
        <div className="vh-actions">
          <button onClick={() => send("Monte um treino para hoje de acordo com o meu objetivo, com séries, repetições e descanso.")}><Dumbbell />Montar meu treino</button>
          <button onClick={() => scrollTo("vh-treino")}><Play />Ver treino da semana</button>
          <button onClick={() => scrollTo("vh-evolucao")}><ChartColumn />Acompanhar evolução</button>
          <button onClick={() => setSheet("goals")}><Target />Ajustar objetivo</button>
        </div>
        {wallet && <div className="vh-credits"><CreditMeter wallet={wallet} compact /><CreditNotice wallet={wallet} /></div>}
        {outOfCredits ? <OutOfCredits wallet={wallet} /> : <form className="vh-composer" onSubmit={(e: FormEvent) => { e.preventDefault(); send(input); }}>
          {speechOk && <button type="button" className={"vh-mic" + (listening ? " on" : "")} onClick={toggleMic} aria-label={listening ? "Parar de ouvir" : "Falar por voz"}><Mic /></button>}
          <input value={input} onChange={e => setInput(e.target.value)} placeholder={`Digite sua mensagem para ${profile.trainer === "mulher" ? "a" : "o"} Personal VIVA+...`} maxLength={2000} aria-label="Mensagem para o Personal" />
          <button type="submit" className="vh-send" disabled={chatBusy || !input.trim()} aria-label="Enviar"><SendHorizontal /></button>
        </form>}
        <UpgradeSheet open={Boolean(upgrade)} text={upgrade || undefined} onClose={() => setUpgrade(null)} />

      </div>
    </section>

    {error && <p role="alert" className="vh-error">{error}</p>}

    <section className="vh-section">
      <div className="vh-head"><div><h3><Zap />Acesso rápido do dia</h3><p>Registre, acompanhe e mantenha sua rotina em dia.</p></div><button className="vh-chip" onClick={() => setSheet("goals")}><Settings2 />Minhas metas</button></div>
      <div className="vh-quick">
        {quick.map(q => { const Icon = q.icon; return <button key={q.kind} className={q.kind === "workout" ? "primary" : ""} onClick={() => q.kind === "evolucao" ? scrollTo("vh-evolucao") : setSheet(q.kind)}><Icon /><span>{q.label}</span></button>; })}
      </div>
    </section>

    <section className="vh-section">
      <div className="vh-head"><div><h3><ChartColumn />Meu resumo de hoje</h3></div></div>
      <div className="vh-summary">
        <button onClick={() => setSheet("water")}><span><Droplet />Água</span><strong>{fmt(waterToday / 1000)} <small>/ {fmt(profile.water_goal_ml / 1000)} L</small></strong><em>{Math.round(pct(waterToday, profile.water_goal_ml) * 100)}% da meta</em></button>
        <button onClick={() => setSheet("sleep")}><span><BedDouble />Sono</span><strong>{sleepToday == null ? "—" : fmt(sleepToday)} <small>h</small></strong><em>{sleepToday == null ? "sem registro" : "registrado"}</em></button>
        <button onClick={() => setSheet("weight")}><span><Scale />Peso</span><strong>{lastWeight == null ? "—" : fmt(lastWeight)} <small>kg</small></strong><em>{lastWeight == null ? "sem registro" : weights[0].logged_on === today ? "registrado hoje" : "último registro"}</em></button>
        <button onClick={() => setSheet("activity")}><span><Activity />Atividade</span><strong>{activityToday ? fmt(activityToday, 0) : "—"} <small>min</small></strong><em>{kcalToday ? fmt(kcalToday, 0) + " kcal em refeições" : "registre hoje"}</em></button>
      </div>
    </section>

    <div className="vh-two" id="vh-treino">
      <section className="vh-card">
        <h3><Dumbbell />Meu treino da semana</h3>
        <p className="vh-sub">Plano atual: <b>{goalInfo.plan}</b>{profile.personal?.onboarded ? <> · {profile.weekly_workouts} dias{profile.personal.minutes ? ` · ${profile.personal.minutes} min` : ""}{profile.personal.location === "casa" ? " · em casa" : profile.personal.location === "academia" ? " · academia" : ""} · <button className="vh-inline" onClick={() => setSetupOpen(true)}>ajustar</button></> : null}</p>
        {profile.personal?.limitations && <p className="vh-limit">Considerando: {profile.personal.limitations}. Em caso de dor, pare e procure um profissional.</p>}
        <div className="vh-days">
          {WEEKDAYS.map((d, i) => { const date = addDays(weekStart, i); const trained = logs.some(l => l.kind === "workout" && l.logged_on === date); return <button key={d} className={(i === selectedDay ? "sel " : "") + (i === todayIdx ? "today" : "")} onClick={() => setSelectedDay(i)}><b>{d}</b><span>{plan[i].short}</span>{trained && <Check className="vh-check" />}</button>; })}
        </div>
        <div className="vh-ex">
          <p className="vh-focus">{WEEKDAYS[selectedDay]} · {plan[selectedDay].focus}</p>
          <ul>
            {plan[selectedDay].exercises.map((e, i) => { const can = selectedDay === todayIdx; const on = can && done.includes(i); return <li key={i} className={on ? "on" : ""}>
              {can ? <button onClick={() => toggleDone(i)} aria-label={on ? "Desmarcar" : "Marcar como feito"}>{on && <Check />}</button> : <i>{i + 1}</i>}
              <div><b>{e.name}</b><span>{e.sets === "1" ? e.reps : `${e.sets} séries × ${e.reps}`}{e.rest !== "—" ? ` · descanso ${e.rest}` : ""}</span></div>
            </li>; })}
          </ul>
        </div>
        {selectedDay === todayIdx
          ? <button className="vh-cta" onClick={() => setSheet("workout")} disabled={plan[todayIdx].rest && workoutDoneToday}><Play />{workoutDoneToday ? "Treino de hoje concluído ✓ registrar outro" : plan[todayIdx].rest ? "Hoje é descanso · registrar mesmo assim" : "Concluir treino de hoje"}</button>
          : <button className="vh-cta ghost" onClick={() => setSelectedDay(todayIdx)}>Voltar para o treino de hoje</button>}
      </section>

      <section className="vh-card">
        <h3><Target />Meta da semana</h3>
        <div className="vh-goals">
          <Meter icon={Dumbbell} label="Treinos" value={`${workoutDays} / ${profile.weekly_workouts}`} p={pct(workoutDays, profile.weekly_workouts)} />
          <Meter icon={Droplet} label="Água" value={`${fmt(waterWeek / 1000)} / ${fmt(waterWeekGoal / 1000)} L`} p={pct(waterWeek, waterWeekGoal)} />
          <Meter icon={Activity} label="Atividade" value={`${fmt(activityWeek, 0)} / ${profile.weekly_activity_min} min`} p={pct(activityWeek, profile.weekly_activity_min)} />
        </div>
        <div className="vh-ring-row">
          <div className="vh-ring" style={{ ["--p" as string]: weeklyScore }}><strong>{weeklyScore}%</strong></div>
          <div><b><Flame />Seu progresso</b><p>{weeklyScore >= 80 ? "Foco excelente! Continue assim. 🔥" : weeklyScore >= 40 ? "Bom ritmo! Falta pouco para a meta da semana." : "Toda semana é um recomeço. Um passo de cada vez! 💜"}</p></div>
        </div>
      </section>
    </div>

    <div className="vh-two">
      <section className="vh-card vh-tip">
        <h3><Star />Dica do Personal</h3>
        <p>{tip}</p>
        <button className="vh-cta small" onClick={() => send("Me dê 3 dicas práticas para hoje com base no meu objetivo e nos meus registros.")}>Ver mais dicas</button>
      </section>
      <section className="vh-card">
        <h3><Trophy />Desafie-se!</h3>
        <p className="vh-sub">Escolha seu objetivo e o VIVA+ Personal ajusta seu treino.</p>
        <div className="vh-goal-pick">
          {GOALS.map(g => <button key={g.id} className={g.id === profile.goal ? "sel" : ""} onClick={() => saveProfile({ goal: g.id })}><b>{g.label}</b><span>{g.hint}</span></button>)}
        </div>
      </section>
    </div>

    <section className="vh-card" id="vh-evolucao">
      <h3><ChartColumn />Minha evolução</h3>
      <p className="vh-sub">Últimos 7 dias</p>
      <div className="vh-evo">
        <Bars title="Atividade (min)" days={last7} values={last7.map(d => sum("activity", d, d) + sum("workout", d, d))} />
        <Bars title="Água (L)" days={last7} values={last7.map(d => sum("water", d, d) / 1000)} goal={profile.water_goal_ml / 1000} />
        <div className="vh-weights">
          <b>Peso</b>
          {weights.length ? <>
            <p className="vh-big">{fmt(weights[0].value)} kg{weights.length > 1 && <small className={weights[0].value - weights[weights.length - 1].value <= 0 ? "down" : "up"}> {weights[0].value - weights[weights.length - 1].value > 0 ? "+" : ""}{fmt(weights[0].value - weights[weights.length - 1].value)} kg</small>}</p>
            {profile.target_weight_kg && <p className="vh-sub">Meta: {fmt(profile.target_weight_kg)} kg · faltam {fmt(Math.abs(weights[0].value - profile.target_weight_kg))} kg</p>}
            <ul>{weights.slice(0, 5).map(w => <li key={w.id}><span>{new Date(w.logged_on + "T12:00:00Z").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })}</span><b>{fmt(w.value)} kg</b></li>)}</ul>
          </> : <p className="vh-sub">Registre seu peso para acompanhar a evolução.</p>}
        </div>
      </div>
    </section>

    <p className="vh-disclaimer"><Info />O VIVA+ é um assistente de bem-estar com IA. As orientações são educativas e não substituem o acompanhamento de um profissional de saúde, educação física ou nutricionista.</p>
    {loading && <p className="vh-sub" style={{ textAlign: "center" }}>Carregando seus registros…</p>}

    {sheet && <LogSheet key={sheet} sheet={sheet} profile={profile} todayLogs={sheet !== "goals" ? todayLogs(sheet) : []} todayFocus={plan[todayIdx].focus} onClose={() => setSheet(null)} onAdd={addLog} onRemove={removeLog} onSaveProfile={saveProfile} />}
  </div>;
}

function Meter({ icon: Icon, label, value, p }: { icon: typeof Droplet; label: string; value: string; p: number }) {
  return <div className="vh-meter"><span className="vh-meter-icon"><Icon /></span><div><p><b>{label}</b><span>{value}</span></p><i><em style={{ width: Math.round(p * 100) + "%" }} /></i></div></div>;
}

function Bars({ title, days, values, goal }: { title: string; days: string[]; values: number[]; goal?: number }) {
  const max = Math.max(goal || 0, ...values, 1);
  return <div className="vh-bars"><b>{title}</b><div className="vh-bars-plot">
    {values.map((v, i) => <div key={days[i]} title={`${fmt(v)}`}><span className="vh-bar-val">{v ? fmt(v) : ""}</span><i style={{ height: Math.max(3, (v / max) * 100) + "%" }} className={v ? "" : "empty"} /><small>{WEEKDAYS[(new Date(days[i] + "T12:00:00Z").getUTCDay() + 6) % 7].slice(0, 1)}</small></div>)}
  </div></div>;
}

function LogSheet({ sheet, profile, todayLogs, todayFocus, onClose, onAdd, onRemove, onSaveProfile }: {
  sheet: Exclude<Sheet, null>; profile: Profile; todayLogs: Log[]; todayFocus: string; onClose: () => void;
  onAdd: (k: Kind, v: number, extra?: Extra) => Promise<boolean>; onRemove: (log: Log) => void; onSaveProfile: (p: Partial<Profile>) => Promise<void>;
}) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  const [value, setValue] = useState(sheet === "workout" ? "45" : "");
  const [note, setNote] = useState(sheet === "workout" ? todayFocus : "");
  const [mealType, setMealType] = useState(hour < 10 ? "breakfast" : hour < 15 ? "lunch" : hour < 18 ? "snack" : "dinner");
  const [quantity, setQuantity] = useState("");
  const [activityType, setActivityType] = useState("walking");
  const [intensity, setIntensity] = useState("moderate");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [g, setG] = useState({ water: String(profile.water_goal_ml), workouts: String(profile.weekly_workouts), activity: String(profile.weekly_activity_min), target: profile.target_weight_kg ? String(profile.target_weight_kg) : "" });
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);

  async function quickAdd(v: number) { setBusy(true); await onAdd("water", v); setBusy(false); }
  async function submit(e: FormEvent) {
    e.preventDefault(); if (sheet === "goals") return; setMsg("");
    const n = Number(String(value).replace(",", "."));
    const limits: Partial<Record<Kind, [number, number, string]>> = { water: [50, 2000, "Informe entre 50 e 2.000 ml por registro."], sleep: [0.5, 24, "Informe entre 0,5 e 24 horas."], weight: [25, 350, "Informe um peso entre 25 e 350 kg."], activity: [1, 1440, "Informe a duração em minutos."], workout: [1, 600, "Informe a duração em minutos."] };
    const lim = limits[sheet];
    if (lim && !(n >= lim[0] && n <= lim[1])) { setMsg(lim[2]); return; }
    if (sheet === "meal") { if (note.trim().length < 2) { setMsg("Conte o que você comeu."); return; } if (value && !(n >= 0 && n <= 5000)) { setMsg("Calorias entre 0 e 5.000."); return; } }
    setBusy(true);
    const ok = await onAdd(sheet, n > 0 ? n : 0, { note, meal_type: mealType, quantity, activity_type: activityType, intensity });
    setBusy(false);
    if (ok) { if (sheet === "workout" || sheet === "weight" || sheet === "sleep") onClose(); else { setValue(""); setNote(""); setQuantity(""); setMsg("Registrado! ✓"); } }
  }
  async function saveGoals(e: FormEvent) {
    e.preventDefault(); setBusy(true);
    const clamp = (s: string, lo: number, hi: number, d: number) => { const n = Math.round(Number(s.replace(",", "."))); return Number.isFinite(n) && n >= lo && n <= hi ? n : d; };
    const t = Number(g.target.replace(",", "."));
    await onSaveProfile({ water_goal_ml: clamp(g.water, 500, 8000, 2000), weekly_workouts: clamp(g.workouts, 1, 7, 5), weekly_activity_min: clamp(g.activity, 10, 2000, 150), target_weight_kg: t >= 25 && t <= 350 ? Math.round(t * 10) / 10 : null });
    setBusy(false); onClose();
  }

  const meta = sheet === "goals" ? null : KIND_META[sheet];
  const Icon = meta?.icon ?? Target;
  const pick = (list: [string, string][], v: string, set: (x: string) => void) => <div className="vh-pick">{list.map(([id, l]) => <button type="button" key={id} className={id === v ? "sel" : ""} onClick={() => set(id)}>{l}</button>)}</div>;
  return <div className="vh-sheet-layer" role="dialog" aria-modal="true" aria-label={meta?.title ?? "Minhas metas"}>
    <button className="vh-sheet-backdrop" aria-label="Fechar" onClick={onClose} />
    <div className="vh-sheet">
      <div className="vh-sheet-head"><span><Icon /></span><h4>{meta?.title ?? "Objetivo e metas"}</h4><button onClick={onClose} aria-label="Fechar"><X /></button></div>
      {sheet === "goals" ? <form onSubmit={saveGoals} className="vh-form">
        <div className="vh-goal-pick compact">{GOALS.map(x => <button type="button" key={x.id} className={x.id === profile.goal ? "sel" : ""} onClick={() => onSaveProfile({ goal: x.id })}><b>{x.label}</b><span>{x.hint}</span></button>)}</div>
        <label>Meta de água por dia (ml)<input inputMode="numeric" value={g.water} onChange={e => setG({ ...g, water: e.target.value })} /></label>
        <label>Treinos por semana<input inputMode="numeric" value={g.workouts} onChange={e => setG({ ...g, workouts: e.target.value })} /></label>
        <label>Minutos de atividade por semana<input inputMode="numeric" value={g.activity} onChange={e => setG({ ...g, activity: e.target.value })} /></label>
        <label>Peso desejado (kg, opcional)<input inputMode="decimal" value={g.target} onChange={e => setG({ ...g, target: e.target.value })} placeholder="Ex.: 68" /></label>
        <button className="vh-cta" disabled={busy}>{busy ? "Salvando..." : "Salvar metas"}</button>
      </form> : <form onSubmit={submit} className="vh-form">
        {sheet === "water" && <div className="vh-quick-water">{[200, 300, 500, 1000].map(v => <button type="button" key={v} disabled={busy} onClick={() => quickAdd(v)}>+{v >= 1000 ? "1 L" : v + " ml"}</button>)}</div>}
        {sheet === "workout" && <p className="vh-sub">Muito bem! 💪 Confirme o treino de hoje para contar na sua meta da semana.</p>}
        {sheet === "sleep" && <p className="vh-sub">Um registro por dia: se registrar de novo, as horas de hoje são atualizadas.</p>}
        {sheet === "meal" && <>{pick(MEAL_TYPES, mealType, setMealType)}
          <label>O que você comeu?<input value={note} onChange={e => setNote(e.target.value)} maxLength={120} placeholder="Ex.: Arroz, feijão, frango e salada" autoFocus /></label>
          <label>Quantidade (opcional)<input value={quantity} onChange={e => setQuantity(e.target.value)} maxLength={40} placeholder="Ex.: 1 prato, 200 g" /></label></>}
        {sheet === "activity" && <>{pick(ACTIVITY_TYPES, activityType, setActivityType)}{pick(INTENSITIES, intensity, setIntensity)}</>}
        <label>{sheet === "water" ? "Outra quantidade (ml)" : sheet === "sleep" ? "Quantas horas você dormiu?" : sheet === "weight" ? "Seu peso hoje (kg)" : sheet === "meal" ? "Calorias aproximadas (opcional)" : "Duração (minutos)"}
          <input inputMode="decimal" value={value} onChange={e => setValue(e.target.value)} placeholder={sheet === "sleep" ? "Ex.: 7,5" : sheet === "weight" ? "Ex.: 72,4" : sheet === "meal" ? "Ex.: 550" : sheet === "water" ? "Ex.: 350" : "Ex.: 30"} autoFocus={sheet === "sleep" || sheet === "weight" || sheet === "activity"} />
        </label>
        {(sheet === "activity" || sheet === "workout") && <label>{sheet === "activity" ? "Observação (opcional)" : "Treino"}<input value={note} onChange={e => setNote(e.target.value)} maxLength={sheet === "activity" ? 240 : 120} placeholder={sheet === "activity" ? "Ex.: no parque" : ""} /></label>}
        {msg && <p className={msg.startsWith("Registrado") ? "vh-ok" : "vh-warn"} role="status">{msg}</p>}
        <button className="vh-cta" disabled={busy}>{busy ? "Salvando..." : sheet === "workout" ? "Concluir treino" : "Registrar"}</button>
        {todayLogs.length > 0 && <div className="vh-today-list"><b>Registros de hoje</b><ul>{todayLogs.map(l => <li key={l.id}><span>{l.value ? fmt(l.value) + " " + (meta?.unit ?? "") : ""}{l.note ? (l.value ? " · " : "") + l.note : ""}</span><button type="button" onClick={() => onRemove(l)} aria-label="Apagar registro"><Trash2 /></button></li>)}</ul></div>}
      </form>}
    </div>
  </div>;
}
