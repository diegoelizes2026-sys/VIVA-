// Saúde pelo WhatsApp: entende "bebi 2 copos de água", "corri 30 min", "comi arroz e feijão",
// "quanto posso comer hoje?", grava no diário e monta respostas curtas com o saldo de calorias.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HealthGoal } from "@/lib/health-plans";
import { dailyTargets, exerciseKcal, type Body } from "@/lib/nutrition";
import type { FoodAiItem } from "@/lib/food-ai";

export type MealType = "breakfast" | "lunch" | "snack" | "dinner";
export type HealthIntent =
  | { kind: "water"; ml: number }
  | { kind: "exercise"; type: string; minutes: number; intensity: "light" | "moderate" | "vigorous"; label: string }
  | { kind: "summary" }
  | { kind: "food" };

const TZ = "America/Fortaleza";
export const healthToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const hourNow = () => Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(new Date()));
const fmt = (n: number, d = 0) => n.toLocaleString("pt-BR", { maximumFractionDigits: d });
export const MEAL_LABEL: Record<MealType, string> = { breakfast: "Café da manhã", lunch: "Almoço", snack: "Lanche", dinner: "Jantar" };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const MONEY = /(r\$|\breais\b|\bconto\b|\bgastei\b|\bpaguei\b|\bcomprei\b|\brecebi\b|\bpix\b|\bcusto[uo]\b|\bpor\s+\d+\b)/;
const WORDS: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, meia: 0.5, meio: 0.5 };
const numOf = (s: string) => { const t = s.replace(",", "."); return /^\d/.test(t) ? Number(t) : WORDS[t] ?? NaN; };

export function detectHealthIntent(raw: string): HealthIntent | null {
  const t = norm(raw).trim();
  if (!t || t.length > 600) return null;
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

export function mealFor(text: string, aiMeal?: string | null): MealType {
  const t = norm(text);
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

const leftLine = (d: Day) => d.left >= 0 ? `🔥 Hoje: ${fmt(d.eaten)} de ${fmt(d.goal + d.burned)} kcal · restam *${fmt(d.left)} kcal*` : `🔥 Hoje: ${fmt(d.eaten)} de ${fmt(d.goal + d.burned)} kcal · *${fmt(-d.left)} kcal acima* da meta`;

export function foodReply(items: FoodAiItem[], meal: MealType, d: Day, tip?: string) {
  const total = items.reduce((s, i) => s + i.kcal, 0);
  const list = items.map(i => `• ${i.name} (${i.portion}) — ${fmt(i.kcal)} kcal`).join("\n");
  return `🍽️ *${MEAL_LABEL[meal]}* anotado no seu diário:\n${list}\n*Total: ${fmt(total)} kcal*\n\n${leftLine(d)}${tip ? `\n\n💡 ${tip}` : ""}\n\nSe errei, responda *desfazer*.`;
}
export function waterReply(ml: number, d: Day) {
  const pct = Math.min(100, Math.round((d.water / Math.max(1, d.waterGoal)) * 100));
  return `💧 +${fmt(ml)} ml de água anotados!\nHoje: *${fmt(d.water / 1000, 2)} L* de ${fmt(d.waterGoal / 1000, 1)} L (${pct}%)${pct >= 100 ? " 🎉 Meta batida!" : ""}\n\nSe errei, responda *desfazer*.`;
}
export function exerciseReply(x: Extract<HealthIntent, { kind: "exercise" }>, d: Day) {
  const kcal = exerciseKcal(x.type, x.intensity, x.minutes, d.weight);
  return `💪 Anotei: ${x.label.toLowerCase()} de ${x.minutes} min, cerca de *${fmt(kcal)} kcal* gastas.\n\n${leftLine(d)}\n\nSe errei, responda *desfazer*.`;
}
export function summaryReply(d: Day, site: string) {
  const bar = (v: number, g: number) => `${fmt(v)}/${fmt(g)} g`;
  return `📊 *Seu dia até agora*\n\n🎯 Meta: ${fmt(d.goal)} kcal\n🍽️ Comido: ${fmt(d.eaten)} kcal\n🏃 Exercício: +${fmt(d.burned)} kcal\n${d.left >= 0 ? `✅ Restam: *${fmt(d.left)} kcal*` : `⚠️ Acima: *${fmt(-d.left)} kcal*`}\n\nCarbo ${bar(d.c, d.tc)} · Proteína ${bar(d.p, d.tp)} · Gordura ${bar(d.f, d.tf)}\n💧 Água: ${fmt(d.water / 1000, 2)} de ${fmt(d.waterGoal / 1000, 1)} L\n\nDiário completo: ${site}/saude`;
}
