"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Activity, ChevronLeft, Droplet, Dumbbell, Flame, Minus, Pencil, Plus, Search, Trash2, User, X } from "lucide-react";
import type { HealthGoal } from "@/lib/health-plans";
import { ACTIVITY_LEVELS, SUGGESTIONS, dailyTargets, exerciseKcal, foodByName, searchFoods, type Body, type Food } from "@/lib/nutrition";

export type MealType = "breakfast" | "lunch" | "snack" | "dinner";
export type FoodEntry = { id: string; meal: MealType; name: string; qty: string; kcal: number; p: number; c: number; f: number };
export type ExerciseEntry = { id: string; kind: "activity" | "workout"; label: string; minutes: number; type: string; intensity: string };
export type NewFood = { meal: MealType; name: string; qty: string; kcal: number; p: number; c: number; f: number };

const MEALS: [MealType, string][] = [["breakfast", "Café da manhã"], ["lunch", "Almoço"], ["snack", "Lanches"], ["dinner", "Jantar"]];
const TO: Record<MealType, string> = { breakfast: "ao café da manhã", lunch: "ao almoço", snack: "aos lanches", dinner: "ao jantar" };
const fmt = (n: number, d = 0) => n.toLocaleString("pt-BR", { maximumFractionDigits: d });
const CUP = 250;

type Props = {
  goal: HealthGoal; body: Body; weightKg: number | null;
  foods: FoodEntry[]; exercises: ExerciseEntry[]; recent: NewFood[];
  water: number; waterGoal: number;
  onAddFood: (f: NewFood) => Promise<boolean>; onRemoveFood: (id: string) => void; onRemoveExercise: (e: ExerciseEntry) => void;
  onAddWater: (ml: number) => Promise<boolean>; onAddExercise: () => void; onSaveBody: (b: Body) => Promise<void>;
};

export default function CalorieDiary(props: Props) {
  const { goal, body, weightKg, foods, exercises, water, waterGoal } = props;
  const [addTo, setAddTo] = useState<MealType | null>(null);
  const [bodyOpen, setBodyOpen] = useState(false);
  const t = dailyTargets(goal, body, weightKg);
  const eaten = foods.reduce((s, x) => s + x.kcal, 0);
  const burned = exercises.reduce((s, e) => s + exerciseKcal(e.kind === "workout" ? "workout" : e.type, e.intensity, e.minutes, weightKg), 0);
  const remaining = t.kcal - eaten + burned;
  const budget = t.kcal + burned;
  const macro = { p: foods.reduce((s, x) => s + x.p, 0), c: foods.reduce((s, x) => s + x.c, 0), f: foods.reduce((s, x) => s + x.f, 0) };
  const cups = Math.max(1, Math.ceil(waterGoal / CUP));
  const filled = Math.floor(water / CUP);

  return <div className="cd">
    <section className="cd-card cd-cal">
      <div className="cd-cal-head"><h3><Flame />Calorias de hoje</h3><button className="vh-chip" onClick={() => setBodyOpen(true)}><User />{t.complete ? "Meus dados" : "Calcular minha meta"}</button></div>
      <p className="cd-formula">Restante = Meta − Alimentos + Exercício</p>
      <div className="cd-cal-body">
        <Ring value={eaten} max={budget} over={remaining < 0}><strong>{fmt(Math.abs(remaining))}</strong><span>{remaining < 0 ? "acima" : "restantes"}</span></Ring>
        <ul className="cd-eq">
          <li><span>🏁</span><div><small>Meta base</small><b>{fmt(t.kcal)}</b></div></li>
          <li><span>🍽️</span><div><small>Alimentos</small><b>{fmt(eaten)}</b></div></li>
          <li><span>🔥</span><div><small>Exercício</small><b>{fmt(burned)}</b></div></li>
        </ul>
      </div>
      {!t.complete && <p className="cd-hint">Usando meta padrão de 2.000 kcal. <button className="vh-inline" onClick={() => setBodyOpen(true)}>Informe idade, altura e peso</button> para uma meta personalizada.</p>}
      <div className="cd-macros">
        <Macro label="Carboidratos" v={macro.c} goal={t.c} cls="c" />
        <Macro label="Proteínas" v={macro.p} goal={t.p} cls="p" />
        <Macro label="Gorduras" v={macro.f} goal={t.f} cls="f" />
      </div>
    </section>

    <section className="cd-card cd-diary">
      <h3>Diário alimentar</h3>
      {MEALS.map(([id, name]) => { const items = foods.filter(x => x.meal === id); const total = items.reduce((s, x) => s + x.kcal, 0); return <div className="cd-meal" key={id}>
        <div className="cd-meal-head"><b>{name}</b><span>{total ? fmt(total) + " kcal" : ""}</span></div>
        {items.length > 0 && <ul>{items.map(x => <li key={x.id}><div><b>{x.name}</b><small>{x.qty}{x.p || x.c || x.f ? ` · C ${fmt(x.c)}g · P ${fmt(x.p)}g · G ${fmt(x.f)}g` : ""}</small></div><span>{fmt(x.kcal)}</span><button onClick={() => props.onRemoveFood(x.id)} aria-label={"Apagar " + x.name}><Trash2 /></button></li>)}</ul>}
        <button className="cd-add" onClick={() => setAddTo(id)}><Plus />Adicionar alimento</button>
      </div>; })}
      <div className="cd-meal">
        <div className="cd-meal-head"><b>Exercícios</b><span>{burned ? "−" + fmt(burned) + " kcal" : ""}</span></div>
        {exercises.length > 0 && <ul>{exercises.map(e => <li key={e.kind + e.id}><div><b>{e.label}</b><small>{e.minutes} min</small></div><span className="burn">{fmt(exerciseKcal(e.kind === "workout" ? "workout" : e.type, e.intensity, e.minutes, weightKg))}</span><button onClick={() => props.onRemoveExercise(e)} aria-label={"Apagar " + e.label}><Trash2 /></button></li>)}</ul>}
        <button className="cd-add" onClick={props.onAddExercise}><Activity />Adicionar exercício</button>
      </div>
      <div className="cd-meal">
        <div className="cd-meal-head"><b>Água</b><span>{fmt(water / 1000, 2)} / {fmt(waterGoal / 1000, 1)} L</span></div>
        <div className="cd-cups">{Array.from({ length: cups }, (_, i) => <button key={i} className={i < filled ? "on" : ""} onClick={() => props.onAddWater(CUP)} aria-label="Adicionar 1 copo de 250 ml"><Droplet /></button>)}</div>
        <small className="cd-muted">Toque num copo para somar 250 ml.</small>
      </div>
    </section>

    {addTo && <FoodSheet meal={addTo} recent={props.recent} onClose={() => setAddTo(null)} onAdd={props.onAddFood} />}
    {bodyOpen && <BodySheet body={body} weightKg={weightKg} goal={goal} onClose={() => setBodyOpen(false)} onSave={async b => { await props.onSaveBody(b); setBodyOpen(false); }} />}
  </div>;
}

function Ring({ value, max, over, children }: { value: number; max: number; over: boolean; children: React.ReactNode }) {
  const r = 52, c = 2 * Math.PI * r, p = max > 0 ? Math.min(1, value / max) : 0;
  return <div className={"cd-ring" + (over ? " over" : "")}>
    <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r={r} className="bg" /><circle cx="60" cy="60" r={r} className="fg" strokeDasharray={c} strokeDashoffset={c * (1 - p)} /></svg>
    <div>{children}</div>
  </div>;
}

function Macro({ label, v, goal, cls }: { label: string; v: number; goal: number; cls: string }) {
  return <div className={"cd-macro " + cls}><p><b>{label}</b><span>{fmt(v)} / {fmt(goal)} g</span></p><i><em style={{ width: Math.min(100, goal ? (v / goal) * 100 : 0) + "%" }} /></i></div>;
}

function useEsc(onClose: () => void) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
}

function FoodSheet({ meal, recent, onClose, onAdd }: { meal: MealType; recent: NewFood[]; onClose: () => void; onAdd: (f: NewFood) => Promise<boolean> }) {
  useEsc(onClose);
  const [mode, setMode] = useState<"search" | "quick">("search");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Food | null>(null);
  const [servings, setServings] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [quick, setQuick] = useState({ name: "", kcal: "", p: "", c: "", f: "" });
  const mealName = MEALS.find(m => m[0] === meal)![1];
  const results = useMemo(() => q.trim() ? searchFoods(q) : (SUGGESTIONS[meal] || []).map(foodByName).filter((x): x is Food => Boolean(x)), [q, meal]);

  async function add(f: NewFood) {
    setBusy(true); setMsg("");
    const ok = await onAdd(f);
    setBusy(false);
    if (ok) { setMsg(`✓ ${f.name} adicionado ${TO[meal]}`); setPicked(null); setServings(1); setQuick({ name: "", kcal: "", p: "", c: "", f: "" }); }
    else setMsg("Não foi possível salvar. Tente de novo.");
  }
  const r1 = (n: number) => Math.round(n * 10) / 10;
  function addPicked() {
    if (!picked) return;
    const s = servings;
    const qty = (s === 1 ? picked.portion : `${fmt(s, 1)} × ${picked.portion}`).slice(0, 40);
    add({ meal, name: picked.name, qty, kcal: Math.round(picked.kcal * s), p: r1(picked.p * s), c: r1(picked.c * s), f: r1(picked.f * s) });
  }
  function addQuick(e: FormEvent) {
    e.preventDefault();
    const n = (v: string) => Math.max(0, Number(v.replace(",", ".")) || 0);
    if (quick.name.trim().length < 2) { setMsg("Dê um nome ao alimento."); return; }
    const kcal = n(quick.kcal) || Math.round(n(quick.p) * 4 + n(quick.c) * 4 + n(quick.f) * 9);
    if (kcal > 5000) { setMsg("Calorias entre 0 e 5.000."); return; }
    add({ meal, name: quick.name.trim().slice(0, 120), qty: "1 porção", kcal, p: r1(n(quick.p)), c: r1(n(quick.c)), f: r1(n(quick.f)) });
  }

  return <div className="vh-sheet-layer" role="dialog" aria-modal="true" aria-label={"Adicionar " + TO[meal]}>
    <button className="vh-sheet-backdrop" aria-label="Fechar" onClick={onClose} />
    <div className="vh-sheet cd-sheet">
      <div className="vh-sheet-head">{picked ? <button onClick={() => setPicked(null)} aria-label="Voltar"><ChevronLeft /></button> : <span><Search /></span>}<h4>{picked ? picked.name : mealName}</h4><button onClick={onClose} aria-label="Fechar"><X /></button></div>
      {picked ? <div className="vh-form">
        <p className="vh-sub">Porção: <b>{picked.portion}</b></p>
        <div className="cd-stepper"><button type="button" onClick={() => setServings(s => Math.max(0.5, s - 0.5))} aria-label="Menos"><Minus /></button><strong>{fmt(servings, 1)}</strong><button type="button" onClick={() => setServings(s => Math.min(20, s + 0.5))} aria-label="Mais"><Plus /></button><span>porção(ões)</span></div>
        <div className="cd-nutri"><div><b>{fmt(picked.kcal * servings)}</b><small>kcal</small></div><div><b>{fmt(picked.c * servings, 1)}g</b><small>Carbo</small></div><div><b>{fmt(picked.p * servings, 1)}g</b><small>Proteína</small></div><div><b>{fmt(picked.f * servings, 1)}g</b><small>Gordura</small></div></div>
        <button className="vh-cta" disabled={busy} onClick={addPicked}>{busy ? "Salvando..." : "Adicionar " + TO[meal]}</button>
      </div> : <>
        <div className="vh-pick cd-tabs"><button type="button" className={mode === "search" ? "sel" : ""} onClick={() => setMode("search")}>Buscar alimento</button><button type="button" className={mode === "quick" ? "sel" : ""} onClick={() => setMode("quick")}><Pencil />Adição rápida</button></div>
        {mode === "search" ? <div className="vh-form">
          <label className="cd-search"><Search /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar: arroz, ovo, banana..." autoFocus aria-label="Buscar alimento" /></label>
          {!q.trim() && recent.length > 0 && <><b className="cd-list-title">Recentes</b><ul className="cd-results">{recent.slice(0, 6).map((f, i) => <li key={"r" + i}><button type="button" onClick={() => add({ ...f, meal })} disabled={busy}><div><b>{f.name}</b><small>{f.qty}</small></div><span>{fmt(f.kcal)} kcal</span><Plus /></button></li>)}</ul></>}
          <b className="cd-list-title">{q.trim() ? `${results.length} resultado(s)` : "Sugestões para " + mealName.toLowerCase()}</b>
          <ul className="cd-results">{results.map(f => <li key={f.name}><button type="button" onClick={() => { setPicked(f); setServings(1); setMsg(""); }}><div><b>{f.name}</b><small>{f.portion}</small></div><span>{fmt(f.kcal)} kcal</span><Plus /></button></li>)}</ul>
          {q.trim() && !results.length && <p className="vh-sub">Não achamos “{q}”. Use a <button className="vh-inline" type="button" onClick={() => { setMode("quick"); setQuick(x => ({ ...x, name: q })); }}>adição rápida</button>.</p>}
        </div> : <form className="vh-form" onSubmit={addQuick}>
          <label>Alimento<input value={quick.name} onChange={e => setQuick({ ...quick, name: e.target.value })} maxLength={120} placeholder="Ex.: Marmita do restaurante" autoFocus /></label>
          <label>Calorias (kcal)<input inputMode="numeric" value={quick.kcal} onChange={e => setQuick({ ...quick, kcal: e.target.value })} placeholder="Ex.: 550" /></label>
          <div className="cd-three">
            <label>Carbo (g)<input inputMode="decimal" value={quick.c} onChange={e => setQuick({ ...quick, c: e.target.value })} /></label>
            <label>Proteína (g)<input inputMode="decimal" value={quick.p} onChange={e => setQuick({ ...quick, p: e.target.value })} /></label>
            <label>Gordura (g)<input inputMode="decimal" value={quick.f} onChange={e => setQuick({ ...quick, f: e.target.value })} /></label>
          </div>
          <p className="vh-sub">Sem calorias? Calculamos pelos macros (4/4/9 kcal por grama).</p>
          <button className="vh-cta" disabled={busy}>{busy ? "Salvando..." : "Adicionar"}</button>
        </form>}
      </>}
      {msg && <p className={msg.startsWith("✓") ? "vh-ok" : "vh-warn"} role="status">{msg}</p>}
    </div>
  </div>;
}

function BodySheet({ body, weightKg, goal, onClose, onSave }: { body: Body; weightKg: number | null; goal: HealthGoal; onClose: () => void; onSave: (b: Body) => Promise<void> }) {
  useEsc(onClose);
  const [v, setV] = useState({ age: body.age ? String(body.age) : "", height: body.height_cm ? String(body.height_cm) : "", weight: weightKg ?? body.current_weight_kg ? String(weightKg ?? body.current_weight_kg) : "" });
  const [sex, setSex] = useState<Body["sex"]>(body.sex);
  const [level, setLevel] = useState<Body["activity_level"]>(body.activity_level ?? "light");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const num = (s: string) => Number(s.replace(",", "."));
  const draft: Body = { age: Math.round(num(v.age)) || null, sex, height_cm: num(v.height) || null, current_weight_kg: num(v.weight) || null, activity_level: level };
  const preview = dailyTargets(goal, draft, null);
  async function save(e: FormEvent) {
    e.preventDefault(); setMsg("");
    if (draft.age !== null && !(draft.age >= 13 && draft.age <= 110)) return setMsg("Idade entre 13 e 110 anos.");
    if (draft.height_cm !== null && !(draft.height_cm >= 100 && draft.height_cm <= 250)) return setMsg("Altura entre 100 e 250 cm.");
    if (draft.current_weight_kg !== null && !(draft.current_weight_kg >= 25 && draft.current_weight_kg <= 350)) return setMsg("Peso entre 25 e 350 kg.");
    setBusy(true); await onSave(draft); setBusy(false);
  }
  const pick = <T extends string>(list: [T, string][], cur: T | null, set: (x: T) => void) => <div className="vh-pick">{list.map(([id, l]) => <button type="button" key={id} className={id === cur ? "sel" : ""} onClick={() => set(id)}>{l}</button>)}</div>;
  return <div className="vh-sheet-layer" role="dialog" aria-modal="true" aria-label="Meus dados">
    <button className="vh-sheet-backdrop" aria-label="Fechar" onClick={onClose} />
    <div className="vh-sheet">
      <div className="vh-sheet-head"><span><User /></span><h4>Calcular minha meta</h4><button onClick={onClose} aria-label="Fechar"><X /></button></div>
      <form className="vh-form" onSubmit={save}>
        {pick<"female" | "male" | "other">([["female", "Mulher"], ["male", "Homem"], ["other", "Prefiro não dizer"]], sex, setSex)}
        <div className="cd-three">
          <label>Idade<input inputMode="numeric" value={v.age} onChange={e => setV({ ...v, age: e.target.value })} placeholder="30" /></label>
          <label>Altura (cm)<input inputMode="numeric" value={v.height} onChange={e => setV({ ...v, height: e.target.value })} placeholder="168" /></label>
          <label>Peso (kg)<input inputMode="decimal" value={v.weight} onChange={e => setV({ ...v, weight: e.target.value })} placeholder="70" /></label>
        </div>
        <b className="cd-list-title">Nível de atividade</b>
        <div className="cd-levels">{ACTIVITY_LEVELS.map(([id, l, d]) => <button type="button" key={id} className={id === level ? "sel" : ""} onClick={() => setLevel(id)}><b>{l}</b><small>{d}</small></button>)}</div>
        <div className="cd-preview"><Dumbbell /><p>{preview.complete ? <>Sua meta: <b>{fmt(preview.kcal)} kcal/dia</b> · C {preview.c}g · P {preview.p}g · G {preview.f}g</> : "Preencha sexo, idade, altura e peso para calcular."}</p></div>
        {msg && <p className="vh-warn" role="status">{msg}</p>}
        <button className="vh-cta" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</button>
        <p className="vh-sub">Estimativa pela fórmula de Mifflin-St Jeor, ajustada ao seu objetivo. Não substitui um nutricionista.</p>
      </form>
    </div>
  </div>;
}
