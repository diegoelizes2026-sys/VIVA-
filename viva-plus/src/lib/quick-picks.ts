// Gastos de 1 toque: os gastos que a pessoa mais repete (mesma descrição e valor parecido).

export type QuickPick = { description: string; category: string; payment_method: string; amount: number; emoji: string; count: number };
type Row = { description: string | null; category: string | null; payment_method: string | null; amount: number | string; occurred_on: string; source?: string | null };

const EMOJI: [RegExp, string][] = [
  [/padaria|p[aã]o|caf[eé]/i, "☕"], [/uber|99|t[aá]xi|corrida/i, "🚕"], [/[oô]nibus|metr[oô]|passagem|bilhete/i, "🚌"],
  [/gasolina|combust|posto|[aá]lcool|etanol/i, "⛽"], [/lanche|hamb|pizza|ifood|delivery|a[cç]a[ií]/i, "🍔"], [/almo[cç]o|restaurante|marmita|jantar/i, "🍽️"],
  [/mercado|supermercado|feira|hortifruti/i, "🛒"], [/farm[aá]cia|rem[eé]dio|drogaria/i, "💊"], [/cerveja|bar\b|bebida/i, "🍺"],
  [/academia|gym/i, "🏋️"], [/cabelo|barbearia|sal[aã]o/i, "💇"], [/estacionamento/i, "🅿️"],
];
const BY_CATEGORY: Record<string, string> = { "Alimentação": "🍽️", "Transporte": "🚗", "Saúde": "💊", "Lazer": "🎉", "Compras": "🛍️", "Contas": "🧾", "Moradia": "🏠", "Educação": "📚" };

export function emojiFor(description: string, category: string) {
  for (const [re, e] of EMOJI) if (re.test(description)) return e;
  return BY_CATEGORY[category] || "💸";
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function topQuickPicks(rows: Row[], max = 4): QuickPick[] {
  const groups = new Map<string, { rows: Row[]; last: string }>();
  for (const r of rows) {
    const desc = String(r.description || "").trim();
    const amount = Number(r.amount);
    if (!desc || !(amount > 0) || amount > 500 || desc.length > 40) continue; // atalhos são para o dia a dia
    const key = norm(desc);
    const g = groups.get(key) || { rows: [], last: "" };
    g.rows.push(r); if (r.occurred_on > g.last) g.last = r.occurred_on;
    groups.set(key, g);
  }
  return [...groups.values()]
    .filter(g => g.rows.length >= 2)
    .sort((a, b) => b.rows.length - a.rows.length || (a.last < b.last ? 1 : -1))
    .slice(0, max)
    .map(g => {
      const latest = g.rows.reduce((a, b) => (b.occurred_on > a.occurred_on ? b : a));
      // Valor que mais se repete; empate → o mais recente.
      const freq = new Map<number, number>();
      for (const r of g.rows) { const c = Math.round(Number(r.amount) * 100); freq.set(c, (freq.get(c) || 0) + 1); }
      const latestCents = Math.round(Number(latest.amount) * 100);
      const top = [...freq.entries()].sort((a, b) => b[1] - a[1] || (a[0] === latestCents ? -1 : b[0] === latestCents ? 1 : 0))[0][0];
      const description = String(latest.description).trim();
      const category = String(latest.category || "Outros");
      return { description, category, payment_method: String(latest.payment_method || "Pix"), amount: top / 100, emoji: emojiFor(description, category), count: g.rows.length };
    });
}
