// Saúde pelo WhatsApp: entende "bebi 2 copos de água", "corri 30 min", "comi arroz e feijão",
// "quanto posso comer hoje?", grava no diário e monta respostas curtas com o saldo de calorias.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HealthGoal } from "@/lib/health-plans";
import { dailyTargets, exerciseKcal, type Body } from "@/lib/nutrition";
import type { FoodAiItem } from "@/lib/food-ai";
import { locale, type Lang } from "@/lib/lang";

export type MealType = "breakfast" | "lunch" | "snack" | "dinner";
export type HealthIntent =
  | { kind: "water"; ml: number }
  | { kind: "exercise"; type: string; minutes: number; intensity: "light" | "moderate" | "vigorous"; label: string }
  | { kind: "summary" }
  | { kind: "food" };

const TZ = "America/Fortaleza";
export const healthToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const hourNow = () => Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(new Date()));
const fmtL = (lang: Lang) => (n: number, d = 0) => n.toLocaleString(locale(lang), { maximumFractionDigits: d });
export const MEAL_LABEL: Record<MealType, string> = { breakfast: "Café da manhã", lunch: "Almoço", snack: "Lanche", dinner: "Jantar" };
const MEAL_EN: Record<MealType, string> = { breakfast: "Breakfast", lunch: "Lunch", snack: "Snack", dinner: "Dinner" };
const EX_LABEL: Record<Lang, Record<string, string>> = {
  pt: { running: "corrida", walking: "caminhada", cycling: "bike", yoga: "yoga / alongamento", sports: "esporte", gym: "academia" },
  en: { running: "run", walking: "walk", cycling: "bike ride", yoga: "yoga / stretching", sports: "sports", gym: "workout" },
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const MONEY = /(r\$|\breais\b|\bconto\b|\bgastei\b|\bpaguei\b|\bcomprei\b|\brecebi\b|\bpix\b|\bcusto[uo]\b|\bpor\s+\d+\b)/;
const WORDS: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, meia: 0.5, meio: 0.5 };
const numOf = (s: string) => { const t = s.replace(",", "."); return /^\d/.test(t) ? Number(t) : WORDS[t] ?? NaN; };

export function detectHealthIntent(raw: string, lang: Lang = "pt"): HealthIntent | null {
  const t = norm(raw).trim();
  if (!t || t.length > 600) return null;
  if (lang === "en") return MONEY.test(t) ? null : detectEnglish(t);
  if (/\b(quanto|quantas?)\b.{0,25}\b(posso|consigo|falta|faltam|resta|restam)\b.{0,20}\b(comer|calorias?|kcal)\b|\b(saldo|resumo|total)\b.{0,15}\b(de )?(calorias|kcal|dieta|alimentacao)\b|\bquantas calorias\b.{0,20}\b(comi|consumi|ingeri)\b|^\s*(meu dia|dieta|calorias)( de hoje)?\s*[?!.]*$/.test(t)) return { kind: "summary" };
  if (MONEY.test(t)) return null; // gasto com comida é finanças ("gastei 30 no almoço")

  // Água: "bebi 2 copos de água", "tomei 500ml de agua", "1 litro de água"
  if (/\bagua\b/.test(t) && !/\bagua de coco\b/.test(t) && /\b(bebi|tomei|bebendo|tomando)\b|\d\s*(ml|l\b|litros?)|\bcopos?\b|\bgarrafas?\b/.test(t)) {
    let ml = 0;
    const m = t.match(/(\d+(?:[.,]\d+)?|um|uma|dois|duas|tres|quatro|cinco|seis|meio|meia)\s*(ml|mls|l\b|litros?|copos?|garrafas?|garrafinhas?)/);
    if (m) { const n = numOf(m[1]); const u = m[2]; ml = u.startsWith("ml") ? n : u.startsWith("l") ? n * 1000 : u.startsWith("copo") ? n * 250 : n * 500; }
    else if (/\bcopo\b/.test(t)) ml = 250; else if (/\bgarrafa\b/.test(t)) ml = 500;
    if (ml >= 50 && ml <= 5000) return { kind: "water", ml: Math.round(ml) };
  }

  // Exercício: "corri 30 min", "caminhei 1 hora", "fiz 40 minutos de academia", "treinei 1h"
  const dur = t.match(/(\d+(?:[.,]\d+)?|uma|meia)\s*(h\b|hr|hrs|horas?|min\b|mins?|minutos?)(?:\s*e\s*(\d+)\s*(?:min|minutos?))?/);
  const ex: [RegExp, string, string][] = [
    [/\b(corri|corrida|correr)\b/, "running", "Corrida"], [/\b(caminhei|caminhada|andei)\b/, "walking", "Caminhada"],
    [/\b(pedalei|bike|bicicleta|ciclismo|spinning)\b/, "cycling", "Bike"], [/\b(yoga|alonguei|alongamento|pilates)\b/, "yoga", "Yoga / alongamento"],
    [/\b(futebol|futsal|volei|basquete|tenis|beach tennis|natacao|nadei|luta|jiu|muay thai|danca|dancei)\b/, "sports", "Esporte"],
    [/\b(academia|musculacao|malhei|treinei|treino|crossfit|funcional)\b/, "gym", "Academia"],
  ];
  const hit = ex.find(([re]) => re.test(t));
  if (hit && dur) {
    const n = dur[1] === "meia" ? 0.5 : numOf(dur[1]);
    let minutes = dur[2].startsWith("h") ? n * 60 : n;
    if (dur[3]) minutes += Number(dur[3]);
    if (/\bmeia\s*hora\b/.test(t)) minutes = 30;
    const intensity = /\b(leve|devagar|tranquil)/.test(t) ? "light" : /\b(intens|pesad|forte|puxad|tiro|hiit)/.test(t) ? "vigorous" : "moderate";
    if (minutes >= 1 && minutes <= 600) return { kind: "exercise", type: hit[1], minutes: Math.round(minutes), intensity, label: hit[2] };
  }

  // Comida: "comi...", "almocei...", "no café comi...", "jantei uma pizza"
  if (/\b(comi|almocei|jantei|lanchei|merendei|belisquei|tomei cafe|cafe da manha foi|no (almoco|jantar|lanche|cafe) (eu )?(comi|foi|tomei))\b/.test(t)) return { kind: "food" };
  return null;
}

// Inglês: "drank 2 glasses of water", "ran 30 min", "how many calories left?", "I had rice and chicken for lunch"
const MONEY_EN = /(\$|\bbucks\b|\bspent\b|\bpaid\b|\bbought\b|\bcost\b|\bcosts\b|\bprice\b)/;
const WORDS_EN: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, half: 0.5 };
const numEn = (s: string) => /^\d/.test(s) ? Number(s.replace(",", ".")) : WORDS_EN[s] ?? NaN;
function detectEnglish(t: string): HealthIntent | null {
  if (/\bhow (many|much) (more )?(calories|kcal)\b|\b(calories|kcal) (left|remaining)\b|\bhow much (more )?can i (still )?eat\b|\bcalories (can|do) i (still )?(eat|have)\b|^\s*(my day|calories|my calories)( today)?\s*[?!.]*$/.test(t)) return { kind: "summary" };
  if (MONEY_EN.test(t)) return null;
  if (/\bwater\b/.test(t) && !/\bcoconut water\b/.test(t) && /\b(drank|drink|drinking|had)\b|\d\s*(ml|l\b|liters?|litres?)|\b(glass|glasses|cups?|bottles?)\b/.test(t)) {
    let ml = 0;
    const m = t.match(/(\d+(?:[.,]\d+)?|a|an|one|two|three|four|five|six|half)\s*(?:a\s+)?(ml|mls|l\b|liters?|litres?|glass(?:es)?|cups?|bottles?)/);
    if (m) { const n = numEn(m[1]); const u = m[2]; ml = u.startsWith("ml") ? n : u.startsWith("l") ? n * 1000 : /^(glass|cup)/.test(u) ? n * 250 : n * 500; }
    else if (/\b(glass|cup)\b/.test(t)) ml = 250; else if (/\bbottle\b/.test(t)) ml = 500;
    if (ml >= 50 && ml <= 5000) return { kind: "water", ml: Math.round(ml) };
  }
  const ex: [RegExp, string][] = [
    [/\b(ran|run|running|jog|jogged|jogging)\b/, "running"], [/\b(walked|walk|walking|hike|hiked)\b/, "walking"],
    [/\b(cycled|cycling|bike|biked|biking|spinning)\b/, "cycling"], [/\b(yoga|stretch|stretched|stretching|pilates)\b/, "yoga"],
    [/\b(soccer|football|basketball|volleyball|tennis|swim|swam|swimming|boxing|dance|danced|dancing|martial arts)\b/, "sports"],
    [/\b(gym|workout|worked out|work out|trained|training|lifting|weights|crossfit)\b/, "gym"],
  ];
  const hit = ex.find(([re]) => re.test(t));
  const dur = t.match(/(\d+(?:[.,]\d+)?|an|a|one|two|half an?)\s*(h\b|hr|hrs|hours?|min\b|mins?|minutes?)(?:\s*(?:and)?\s*(\d+)\s*(?:min|mins|minutes?))?/);
  if (hit && dur) {
    const n = /^half/.test(dur[1]) ? 0.5 : numEn(dur[1]);
    let minutes = dur[2].startsWith("h") ? n * 60 : n;
    if (dur[3]) minutes += Number(dur[3]);
    const intensity = /\b(light|easy|slow)\b/.test(t) ? "light" : /\b(intense|hard|heavy|hiit|sprint)/.test(t) ? "vigorous" : "moderate";
    if (minutes >= 1 && minutes <= 600) return { kind: "exercise", type: hit[1], minutes: Math.round(minutes), intensity, label: hit[1] };
  }
  if (/\b(i ate|ate|i had|had (breakfast|lunch|dinner|a snack)|for (breakfast|lunch|dinner)|snacked|i've eaten|just ate)\b/.test(t)) return { kind: "food" };
  return null;
}

export function mealFor(text: string, aiMeal?: string | null): MealType {
  const t = norm(text);
  if (/\bbreakfast\b/.test(t)) return "breakfast";
  if (/\blunch\b/.test(t)) return "lunch";
  if (/\b(dinner|supper)\b/.test(t)) return "dinner";
  if (/\b(snack|snacked)\b/.test(t)) return "snack";
  if (/\b(cafe da manha|desjejum|tomei cafe)\b/.test(t)) return "breakfast";
  if (/\b(almocei|almoco)\b/.test(t)) return "lunch";
  if (/\b(jantei|janta|jantar|ceia)\b/.test(t)) return "dinner";
  if (/\b(lanchei|lanche|merendei|belisquei)\b/.test(t)) return "snack";
  if (aiMeal && ["breakfast", "lunch", "snack", "dinner"].includes(aiMeal)) return aiMeal as MealType;
  const h = hourNow();
  return h < 10 ? "breakfast" : h < 15 ? "lunch" : h < 18 ? "snack" : "dinner";
}

export async function saveFoods(db: SupabaseClient, userId: string, items: FoodAiItem[], meal: MealType) {
  const rows = items.map(i => ({ user_id: userId, meal_type: meal, food_name: i.name.slice(0, 120), quantity: i.portion.slice(0, 40) || "1 porção", calories: Math.min(5000, Math.round(i.kcal)), protein_g: i.p || null, carbs_g: i.c || null, fat_g: i.f || null, logged_on: healthToday() }));
  const { data, error } = await db.from("viva_food_logs").insert(rows).select("id");
  if (error) throw error;
  return (data || []).map(r => String(r.id));
}
export async function saveWater(db: SupabaseClient, userId: string, ml: number) {
  const { data, error } = await db.from("viva_water_logs").insert({ user_id: userId, amount_ml: Math.min(2000, ml), logged_on: healthToday() }).select("id").single();
  if (error) throw error;
  return String(data.id);
}
export async function saveExercise(db: SupabaseClient, userId: string, x: Extract<HealthIntent, { kind: "exercise" }>) {
  // notes fica em português: é o registro interno do diário.
  const { data, error } = await db.from("viva_activity_logs").insert({ user_id: userId, activity_type: x.type, intensity: x.intensity, duration_minutes: x.minutes, notes: "pelo WhatsApp", logged_on: healthToday() }).select("id").single();
  if (error) throw error;
  return String(data.id);
}
export async function undoHealth(db: SupabaseClient, table: string, ids: string[]) {
  if (!["viva_food_logs", "viva_water_logs", "viva_activity_logs"].includes(table) || !ids.length) return false;
  const { error } = await db.from(table).delete().in("id", ids);
  return !error;
}

type Day = { goal: number; eaten: number; burned: number; left: number; water: number; waterGoal: number; p: number; c: number; f: number; tp: number; tc: number; tf: number; weight: number | null };
export async function loadDay(db: SupabaseClient, userId: string): Promise<Day> {
  const today = healthToday();
  const [p, w, food, act, wk, water] = await Promise.all([
    db.from("viva_health_profiles").select("goal,age,sex,height_cm,current_weight_kg,activity_level,water_goal_ml").eq("user_id", userId).maybeSingle(),
    db.from("viva_weight_logs").select("weight_kg").eq("user_id", userId).order("logged_on", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("viva_food_logs").select("calories,protein_g,carbs_g,fat_g").eq("user_id", userId).eq("logged_on", today).limit(300),
    db.from("viva_activity_logs").select("activity_type,intensity,duration_minutes").eq("user_id", userId).eq("logged_on", today).limit(100),
    db.from("viva_workout_logs").select("duration_minutes").eq("user_id", userId).eq("logged_on", today).limit(20),
    db.from("viva_water_logs").select("amount_ml").eq("user_id", userId).eq("logged_on", today).limit(200),
  ]);
  const pr = (p.data || {}) as Record<string, unknown>;
  const body: Body = { age: pr.age == null ? null : Number(pr.age), sex: (pr.sex as Body["sex"]) ?? null, height_cm: pr.height_cm == null ? null : Number(pr.height_cm), current_weight_kg: pr.current_weight_kg == null ? null : Number(pr.current_weight_kg), activity_level: (pr.activity_level as Body["activity_level"]) ?? null };
  const weight = w.data?.weight_kg != null ? Number(w.data.weight_kg) : body.current_weight_kg;
  const t = dailyTargets(((pr.goal as HealthGoal) || "saude"), body, weight);
  const sum = (rows: Record<string, unknown>[] | null, k: string) => (rows || []).reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const eaten = Math.round(sum(food.data, "calories"));
  const burned = (act.data || []).reduce((s, r) => s + exerciseKcal(String(r.activity_type), String(r.intensity), Number(r.duration_minutes), weight), 0)
    + (wk.data || []).reduce((s, r) => s + exerciseKcal("workout", "moderate", Number(r.duration_minutes), weight), 0);
  return { goal: t.kcal, eaten, burned, left: t.kcal - eaten + burned, water: sum(water.data, "amount_ml"), waterGoal: Number(pr.water_goal_ml) || 2000,
    p: sum(food.data, "protein_g"), c: sum(food.data, "carbs_g"), f: sum(food.data, "fat_g"), tp: t.p, tc: t.c, tf: t.f, weight };
}

function leftLine(d: Day, lang: Lang) {
  const fmt = fmtL(lang);
  if (lang === "en") return d.left >= 0 ? `🔥 Today: ${fmt(d.eaten)} of ${fmt(d.goal + d.burned)} kcal · *${fmt(d.left)} kcal left*` : `🔥 Today: ${fmt(d.eaten)} of ${fmt(d.goal + d.burned)} kcal · *${fmt(-d.left)} kcal over* your goal`;
  return d.left >= 0 ? `🔥 Hoje: ${fmt(d.eaten)} de ${fmt(d.goal + d.burned)} kcal · restam *${fmt(d.left)} kcal*` : `🔥 Hoje: ${fmt(d.eaten)} de ${fmt(d.goal + d.burned)} kcal · *${fmt(-d.left)} kcal acima* da meta`;
}
const undoHint = (lang: Lang) => (lang === "en" ? "Wrong? Reply *undo*." : "Se errei, responda *desfazer*.");

export function foodReply(items: FoodAiItem[], meal: MealType, d: Day, tip?: string, lang: Lang = "pt") {
  const fmt = fmtL(lang);
  const total = items.reduce((s, i) => s + i.kcal, 0);
  const list = items.map(i => `• ${i.name} (${i.portion}) — ${fmt(i.kcal)} kcal`).join("\n");
  const head = lang === "en" ? `🍽️ *${MEAL_EN[meal]}* logged in your diary:` : `🍽️ *${MEAL_LABEL[meal]}* anotado no seu diário:`;
  return `${head}\n${list}\n*Total: ${fmt(total)} kcal*\n\n${leftLine(d, lang)}${tip ? `\n\n💡 ${tip}` : ""}\n\n${undoHint(lang)}`;
}
export function waterReply(ml: number, d: Day, lang: Lang = "pt") {
  const fmt = fmtL(lang);
  const pct = Math.min(100, Math.round((d.water / Math.max(1, d.waterGoal)) * 100));
  if (lang === "en") return `💧 +${fmt(ml)} ml of water logged!\nToday: *${fmt(d.water / 1000, 2)} L* of ${fmt(d.waterGoal / 1000, 1)} L (${pct}%)${pct >= 100 ? " 🎉 Goal reached!" : ""}\n\n${undoHint(lang)}`;
  return `💧 +${fmt(ml)} ml de água anotados!\nHoje: *${fmt(d.water / 1000, 2)} L* de ${fmt(d.waterGoal / 1000, 1)} L (${pct}%)${pct >= 100 ? " 🎉 Meta batida!" : ""}\n\n${undoHint(lang)}`;
}
export function exerciseReply(x: Extract<HealthIntent, { kind: "exercise" }>, d: Day, lang: Lang = "pt") {
  const fmt = fmtL(lang);
  const kcal = exerciseKcal(x.type, x.intensity, x.minutes, d.weight);
  const what = EX_LABEL[lang][x.type] || x.type;
  if (lang === "en") return `💪 Logged: ${x.minutes}-min ${what}, about *${fmt(kcal)} kcal* burned.\n\n${leftLine(d, lang)}\n\n${undoHint(lang)}`;
  return `💪 Anotei: ${what} de ${x.minutes} min, cerca de *${fmt(kcal)} kcal* gastas.\n\n${leftLine(d, lang)}\n\n${undoHint(lang)}`;
}
export function summaryReply(d: Day, site: string, lang: Lang = "pt") {
  const fmt = fmtL(lang);
  const bar = (v: number, g: number) => `${fmt(v)}/${fmt(g)} g`;
  if (lang === "en") return `📊 *Your day so far*\n\n🎯 Goal: ${fmt(d.goal)} kcal\n🍽️ Eaten: ${fmt(d.eaten)} kcal\n🏃 Exercise: +${fmt(d.burned)} kcal\n${d.left >= 0 ? `✅ Left: *${fmt(d.left)} kcal*` : `⚠️ Over: *${fmt(-d.left)} kcal*`}\n\nCarbs ${bar(d.c, d.tc)} · Protein ${bar(d.p, d.tp)} · Fat ${bar(d.f, d.tf)}\n💧 Water: ${fmt(d.water / 1000, 2)} of ${fmt(d.waterGoal / 1000, 1)} L\n\nFull diary: ${site}/saude`;
  return `📊 *Seu dia até agora*\n\n🎯 Meta: ${fmt(d.goal)} kcal\n🍽️ Comido: ${fmt(d.eaten)} kcal\n🏃 Exercício: +${fmt(d.burned)} kcal\n${d.left >= 0 ? `✅ Restam: *${fmt(d.left)} kcal*` : `⚠️ Acima: *${fmt(-d.left)} kcal*`}\n\nCarbo ${bar(d.c, d.tc)} · Proteína ${bar(d.p, d.tp)} · Gordura ${bar(d.f, d.tf)}\n💧 Água: ${fmt(d.water / 1000, 2)} de ${fmt(d.waterGoal / 1000, 1)} L\n\nDiário completo: ${site}/saude`;
}
