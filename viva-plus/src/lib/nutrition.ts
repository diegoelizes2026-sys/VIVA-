// VIVA+ Saúde: base de alimentos e cálculos do diário de calorias.
// Valores aproximados por porção (referência: tabelas brasileiras de composição de alimentos).
import type { HealthGoal } from "@/lib/health-plans";

export type Food = { name: string; portion: string; kcal: number; p: number; c: number; f: number; tags?: string };
const F = (name: string, portion: string, kcal: number, p: number, c: number, f: number, tags = ""): Food => ({ name, portion, kcal, p, c, f, tags });

export const FOODS: Food[] = [
  // Café da manhã
  F("Pão francês", "1 unidade (50 g)", 150, 4.7, 29, 1.6, "pao cafe"),
  F("Pão de forma integral", "2 fatias (50 g)", 125, 6, 22, 1.8, "pao cafe"),
  F("Tapioca (só a massa)", "1 média (60 g de goma)", 145, 0, 36, 0, "cafe"),
  F("Cuscuz de milho", "1 prato raso (150 g)", 170, 3.3, 37, 1, "cafe nordeste"),
  F("Ovo cozido", "1 unidade (50 g)", 72, 6.3, 0.4, 4.8, "cafe proteina"),
  F("Ovo mexido", "2 ovos (100 g)", 180, 12, 1.5, 14, "cafe proteina"),
  F("Omelete simples", "2 ovos", 190, 13, 1, 15, "cafe proteina"),
  F("Queijo muçarela", "2 fatias (30 g)", 95, 6.8, 0.9, 7.2, "cafe"),
  F("Queijo minas frescal", "1 fatia (30 g)", 79, 5.2, 1, 6, "cafe"),
  F("Queijo coalho", "1 espeto (60 g)", 190, 13, 1.2, 15, "cafe nordeste"),
  F("Presunto", "2 fatias (30 g)", 40, 5, 0.6, 2, "cafe"),
  F("Peito de peru", "2 fatias (30 g)", 35, 6, 0.8, 0.8, "cafe proteina"),
  F("Manteiga", "1 colher de chá (5 g)", 36, 0, 0, 4.1, "cafe"),
  F("Margarina", "1 colher de chá (5 g)", 30, 0, 0, 3.3, "cafe"),
  F("Requeijão", "1 colher de sopa (30 g)", 80, 2.9, 0.9, 7.3, "cafe"),
  F("Café sem açúcar", "1 xícara (100 ml)", 3, 0.2, 0.5, 0, "cafe bebida"),
  F("Café com leite e açúcar", "1 xícara (200 ml)", 120, 4.5, 16, 4, "cafe bebida"),
  F("Leite integral", "1 copo (200 ml)", 120, 6, 9.4, 6.4, "cafe bebida"),
  F("Leite desnatado", "1 copo (200 ml)", 70, 6.4, 9.6, 0.4, "cafe bebida"),
  F("Iogurte natural", "1 pote (170 g)", 105, 6.5, 8, 5, "lanche"),
  F("Iogurte grego", "1 pote (100 g)", 120, 5, 14, 5, "lanche"),
  F("Aveia em flocos", "2 colheres de sopa (30 g)", 117, 4.4, 20, 2.5, "cafe"),
  F("Granola", "3 colheres de sopa (40 g)", 170, 4, 27, 5.5, "cafe"),
  F("Mel", "1 colher de sopa (20 g)", 62, 0, 17, 0, "cafe"),
  F("Bolo simples", "1 fatia (60 g)", 200, 3.5, 32, 6.5, "lanche doce"),
  F("Biscoito cream cracker", "5 unidades (30 g)", 130, 3, 21, 4, "lanche"),
  F("Pão de queijo", "3 pequenos (60 g)", 200, 3.4, 23, 10, "lanche cafe"),
  // Frutas
  F("Banana", "1 média (90 g)", 88, 1.2, 23, 0.1, "fruta"),
  F("Maçã", "1 média (130 g)", 72, 0.4, 19, 0.2, "fruta"),
  F("Mamão papaia", "1/2 unidade (150 g)", 60, 0.8, 15, 0.2, "fruta"),
  F("Laranja", "1 média (150 g)", 55, 1.2, 13, 0.2, "fruta"),
  F("Manga", "1 média (200 g)", 128, 0.8, 33, 0.4, "fruta"),
  F("Melancia", "1 fatia (200 g)", 66, 1.8, 16, 0, "fruta"),
  F("Abacaxi", "2 fatias (150 g)", 72, 1.4, 18, 0.2, "fruta"),
  F("Uva", "1 cacho pequeno (100 g)", 70, 0.7, 18, 0.2, "fruta"),
  F("Morango", "10 unidades (120 g)", 36, 1, 8, 0.4, "fruta"),
  F("Abacate", "2 colheres de sopa (60 g)", 58, 0.7, 3.7, 5, "fruta"),
  F("Açaí com granola", "1 tigela (300 ml)", 450, 5, 75, 14, "lanche doce"),
  // Almoço / jantar
  F("Arroz branco", "4 colheres de sopa (100 g)", 128, 2.5, 28, 0.2, "almoco"),
  F("Arroz integral", "4 colheres de sopa (100 g)", 124, 2.6, 26, 1, "almoco"),
  F("Feijão carioca", "1 concha (100 g)", 76, 4.8, 13.6, 0.5, "almoco"),
  F("Feijão preto", "1 concha (100 g)", 77, 4.5, 14, 0.5, "almoco"),
  F("Feijoada", "1 concha (150 g)", 260, 15, 17, 15, "almoco"),
  F("Macarrão cozido", "1 escumadeira (110 g)", 160, 5.5, 32, 1, "almoco massa"),
  F("Macarrão ao molho de tomate", "1 prato (200 g)", 270, 9, 50, 4, "almoco massa"),
  F("Lasanha à bolonhesa", "1 pedaço (200 g)", 340, 18, 30, 16, "almoco massa"),
  F("Batata cozida", "1 média (130 g)", 68, 1.5, 15.5, 0, "almoco"),
  F("Batata frita", "1 porção pequena (100 g)", 270, 3.5, 35, 13, "almoco lanche"),
  F("Purê de batata", "2 colheres de sopa (90 g)", 90, 1.8, 13, 3.5, "almoco"),
  F("Batata-doce cozida", "1 média (150 g)", 115, 1.5, 27, 0.2, "almoco fit"),
  F("Mandioca cozida", "1 pedaço (100 g)", 125, 0.6, 30, 0.3, "almoco"),
  F("Farofa", "2 colheres de sopa (30 g)", 120, 0.6, 20, 4, "almoco"),
  F("Peito de frango grelhado", "1 filé (100 g)", 160, 32, 0, 3.2, "almoco proteina fit"),
  F("Frango assado (coxa)", "1 coxa (100 g)", 215, 26, 0, 12, "almoco proteina"),
  F("Carne moída refogada", "3 colheres de sopa (90 g)", 190, 24, 1, 10, "almoco proteina"),
  F("Bife de patinho grelhado", "1 bife (100 g)", 220, 36, 0, 7.3, "almoco proteina"),
  F("Picanha", "1 fatia (100 g)", 290, 24, 0, 21, "almoco churrasco"),
  F("Carne de sol", "1 porção (100 g)", 270, 30, 0, 16, "almoco nordeste"),
  F("Peixe grelhado (tilápia)", "1 filé (100 g)", 128, 26, 0, 2.7, "almoco proteina fit"),
  F("Atum em conserva (em água)", "1/2 lata (60 g)", 70, 15, 0, 0.6, "proteina fit"),
  F("Linguiça calabresa", "1 gomo (60 g)", 210, 9.5, 1, 19, "almoco"),
  F("Salada verde", "1 prato (100 g)", 15, 1.2, 2.5, 0.2, "almoco salada"),
  F("Tomate", "1 médio (100 g)", 18, 0.9, 3.9, 0.2, "salada"),
  F("Legumes cozidos", "1 xícara (120 g)", 55, 2, 11, 0.3, "almoco salada"),
  F("Brócolis cozido", "1 xícara (90 g)", 30, 2.5, 5, 0.4, "salada"),
  F("Azeite de oliva", "1 colher de sopa (13 ml)", 108, 0, 0, 12, "almoco"),
  F("Sopa de legumes", "1 prato fundo (300 ml)", 150, 6, 22, 4, "jantar"),
  F("Prato feito (arroz, feijão, carne e salada)", "1 prato", 650, 35, 80, 20, "almoco"),
  // Lanches e fast food
  F("Hambúrguer de lanchonete", "1 unidade", 500, 26, 40, 26, "lanche fast"),
  F("Pizza de muçarela", "1 fatia (100 g)", 270, 12, 32, 10, "jantar fast"),
  F("Coxinha", "1 média (80 g)", 230, 8, 26, 10, "lanche salgado"),
  F("Pastel de carne", "1 médio (90 g)", 280, 9, 25, 16, "lanche salgado"),
  F("Esfiha de carne", "1 unidade (70 g)", 190, 8, 25, 6, "lanche salgado"),
  F("Misto quente", "1 unidade", 300, 15, 30, 13, "lanche"),
  F("Sanduíche natural", "1 unidade", 280, 16, 32, 9, "lanche fit"),
  F("Pipoca de panela", "1 saco médio (30 g)", 150, 3, 18, 7, "lanche"),
  F("Castanha de caju", "1 punhado (30 g)", 170, 5, 9, 13, "lanche"),
  F("Amendoim torrado", "1 punhado (30 g)", 175, 7.5, 6, 15, "lanche"),
  F("Pasta de amendoim", "1 colher de sopa (15 g)", 90, 3.8, 3, 7.5, "lanche fit"),
  F("Whey protein", "1 dose (30 g)", 120, 24, 3, 1.5, "proteina fit suplemento"),
  F("Barra de proteína", "1 unidade (45 g)", 180, 15, 18, 6, "lanche fit"),
  F("Chocolate ao leite", "1 tablete pequeno (25 g)", 135, 1.8, 15, 7.6, "doce"),
  F("Brigadeiro", "1 unidade (20 g)", 80, 0.8, 12, 3, "doce"),
  F("Sorvete", "1 bola (60 g)", 120, 2, 15, 6, "doce"),
  // Bebidas
  F("Refrigerante", "1 lata (350 ml)", 150, 0, 37, 0, "bebida"),
  F("Refrigerante zero", "1 lata (350 ml)", 1, 0, 0, 0, "bebida"),
  F("Suco de laranja natural", "1 copo (250 ml)", 110, 1.7, 26, 0.5, "bebida"),
  F("Suco de caixinha", "1 copo (200 ml)", 100, 0, 24, 0, "bebida"),
  F("Água de coco", "1 copo (250 ml)", 55, 0, 13, 0, "bebida"),
  F("Cerveja", "1 lata (350 ml)", 150, 1.5, 13, 0, "bebida alcool"),
  F("Vinho tinto", "1 taça (150 ml)", 125, 0.1, 4, 0, "bebida alcool"),
  F("Vitamina de banana com leite", "1 copo (300 ml)", 230, 8, 38, 6, "bebida lanche"),
];

export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
export function searchFoods(q: string, limit = 30): Food[] {
  const t = norm(q).split(/\s+/).filter(Boolean);
  if (!t.length) return [];
  return FOODS.filter(f => { const hay = norm(f.name + " " + (f.tags || "")); return t.every(w => hay.includes(w)); })
    .sort((a, b) => Number(!norm(a.name).startsWith(t[0])) - Number(!norm(b.name).startsWith(t[0])))
    .slice(0, limit);
}
// Sugestões rápidas por refeição quando a busca está vazia.
export const SUGGESTIONS: Record<string, string[]> = {
  breakfast: ["Pão francês", "Ovo mexido", "Café com leite e açúcar", "Tapioca (só a massa)", "Cuscuz de milho", "Banana", "Queijo muçarela", "Iogurte natural"],
  lunch: ["Arroz branco", "Feijão carioca", "Peito de frango grelhado", "Bife de patinho grelhado", "Salada verde", "Batata-doce cozida", "Farofa", "Prato feito (arroz, feijão, carne e salada)"],
  snack: ["Banana", "Iogurte grego", "Castanha de caju", "Whey protein", "Pão de queijo", "Maçã", "Sanduíche natural", "Coxinha"],
  dinner: ["Arroz branco", "Feijão carioca", "Omelete simples", "Sopa de legumes", "Peixe grelhado (tilápia)", "Pizza de muçarela", "Salada verde", "Legumes cozidos"],
};
export const foodByName = (n: string) => FOODS.find(f => f.name === n);

// ---- Metas ----
export type Body = { age: number | null; sex: "female" | "male" | "other" | null; height_cm: number | null; current_weight_kg: number | null; activity_level: "sedentary" | "light" | "moderate" | "high" | null };
export const ACTIVITY_LEVELS: [NonNullable<Body["activity_level"]>, string, string][] = [
  ["sedentary", "Sedentário", "Pouco movimento no dia a dia"],
  ["light", "Pouco ativo", "Anda um pouco, trabalho em pé às vezes"],
  ["moderate", "Ativo", "Se movimenta bastante ou treina 3–5x"],
  ["high", "Muito ativo", "Trabalho físico ou treino intenso diário"],
];
const FACTOR = { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725 } as const;
const GOAL_ADJ: Record<HealthGoal, number> = { emagrecimento: -500, hipertrofia: 300, condicionamento: 0, saude: 0 };
export const MACRO_SPLIT: Record<HealthGoal, { p: number; c: number; f: number }> = {
  emagrecimento: { p: 0.3, c: 0.4, f: 0.3 },
  hipertrofia: { p: 0.3, c: 0.45, f: 0.25 },
  condicionamento: { p: 0.25, c: 0.5, f: 0.25 },
  saude: { p: 0.2, c: 0.5, f: 0.3 },
};
export type Targets = { kcal: number; p: number; c: number; f: number; bmr: number | null; complete: boolean };
// Mifflin-St Jeor × fator de atividade, ajustado ao objetivo, com piso de segurança.
export function dailyTargets(goal: HealthGoal, body: Body, weightKg: number | null): Targets {
  const w = weightKg ?? body.current_weight_kg;
  const complete = Boolean(w && body.height_cm && body.age && body.sex);
  let kcal = 2000, bmr: number | null = null;
  if (complete) {
    const sexAdj = body.sex === "male" ? 5 : body.sex === "female" ? -161 : -78;
    bmr = 10 * w! + 6.25 * body.height_cm! - 5 * body.age! + sexAdj;
    const tdee = bmr * FACTOR[body.activity_level ?? "light"];
    const floor = Math.max(bmr, body.sex === "male" ? 1500 : 1200);
    kcal = Math.max(floor, tdee + GOAL_ADJ[goal]);
  }
  kcal = Math.round(kcal / 10) * 10;
  const s = MACRO_SPLIT[goal];
  return { kcal, p: Math.round((kcal * s.p) / 4), c: Math.round((kcal * s.c) / 4), f: Math.round((kcal * s.f) / 9), bmr: bmr && Math.round(bmr), complete };
}

// Calorias gastas no exercício: MET × peso × horas.
const MET: Record<string, [number, number, number]> = {
  walking: [3, 3.8, 5], running: [7, 9.8, 11.5], gym: [3.5, 5, 6], cycling: [4, 6.8, 10], sports: [5, 7, 9], yoga: [2.5, 3, 4], other: [3, 4.5, 6],
};
export function exerciseKcal(type: string, intensity: string, minutes: number, weightKg: number | null) {
  const met = type === "workout" ? 5 : (MET[type] ?? MET.other)[intensity === "light" ? 0 : intensity === "vigorous" ? 2 : 1];
  return Math.round(met * (weightKg ?? 70) * (minutes / 60));
}
