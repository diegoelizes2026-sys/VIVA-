// Quando a pessoa recebe: interpreta "dia 5", "5º dia útil", "5 e 20", "toda sexta"… e calcula o próximo pagamento.
// Código puro (navegador e servidor). Datas sempre no fuso de Brasília, no formato AAAA-MM-DD.

export type PayFrequency = "monthly" | "biweekly" | "weekly" | "irregular";
export type PaySchedule = { frequency: PayFrequency | null; days: number[]; weekday: number | null; businessDay: boolean };

export const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const ORDINAL: Record<string, number> = { primeiro: 1, segundo: 2, terceiro: 3, quarto: 4, quinto: 5, sexto: 6, setimo: 7, oitavo: 8, nono: 9, decimo: 10 };
const plain = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Codifica para a resposta da conversa: "5", "5,20", "5u" (5º dia útil). */
export function encodeDays(days: number[], business: boolean) { return days.join(",") + (business ? "u" : ""); }
export function decodeDays(v: unknown): { days: number[]; business: boolean } | null {
  if (typeof v !== "string") return null;
  const m = v.match(/^(\d{1,2})(?:,(\d{1,2}))?(u)?$/);
  if (!m) return null;
  const days = [Number(m[1]), ...(m[2] ? [Number(m[2])] : [])].filter(d => d >= 1 && d <= 31);
  return days.length ? { days: [...new Set(days)].sort((a, b) => a - b), business: Boolean(m[3]) } : null;
}

/** "dia 5" · "5º dia útil" · "quinto dia útil" · "5 e 20" · "fim do mês" → dias do mês. */
export function parsePayDays(text: string, max = 2): { days: number[]; business: boolean } | null {
  const t = plain(text);
  const business = /\b(dia(s)? ut(il|eis)|util)\b/.test(t);
  const days: number[] = [];
  if (/\b(ultimo dia|fim do mes|final do mes)\b/.test(t)) days.push(31);
  for (const [w, n] of Object.entries(ORDINAL)) if (new RegExp(`\\b${w}\\b`).test(t)) days.push(n);
  for (const m of t.matchAll(/\b(\d{1,2})\s*(?:º|o|°|a)?\b/g)) { const n = Number(m[1]); if (n >= 1 && n <= 31) days.push(n); }
  const uniq = [...new Set(days)].slice(0, max).sort((a, b) => a - b);
  if (!uniq.length) return null;
  if (business && uniq.some(d => d > 23)) return null; // não existe "25º dia útil"
  return { days: uniq, business };
}

export function parseWeekday(text: string): number | null {
  const t = plain(text);
  const keys = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
  const i = keys.findIndex(k => new RegExp(`\\b${k}`).test(t));
  return i >= 0 ? i : null;
}

// ---------------------------------------------------------------- datas
export function todayBR(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m = 1..12
const dow = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();
function nthBusinessDay(y: number, m: number, n: number) {
  let count = 0;
  for (let d = 1; d <= lastDay(y, m); d++) { const w = dow(y, m, d); if (w !== 0 && w !== 6 && ++count === n) return d; }
  return lastDay(y, m);
}
export function addDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, d + n));
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}
export function daysBetween(a: string, b: string) {
  const [y1, m1, d1] = a.split("-").map(Number), [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

/** Datas de pagamento de um mês (m = 1..12). Dia 31 em mês de 30 dias vira o último dia. */
export function paydaysInMonth(s: PaySchedule, y: number, m: number): string[] {
  if (s.frequency === "weekly" && s.weekday != null) {
    const out: string[] = [];
    for (let d = 1; d <= lastDay(y, m); d++) if (dow(y, m, d) === s.weekday) out.push(iso(y, m, d));
    return out;
  }
  if ((s.frequency === "monthly" || s.frequency === "biweekly") && s.days.length) {
    return [...new Set(s.days.map(d => (s.businessDay ? nthBusinessDay(y, m, d) : Math.min(d, lastDay(y, m)))))].sort((a, b) => a - b).map(d => iso(y, m, d));
  }
  return [];
}

function around(s: PaySchedule, today: string) {
  const [y, m] = today.split("-").map(Number);
  const months = [[m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1], [y, m], [m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1]];
  return months.flatMap(([yy, mm]) => paydaysInMonth(s, yy, mm));
}
export function nextPayday(s: PaySchedule, today = todayBR()) { return around(s, today).find(d => d >= today) ?? null; }
export function lastPayday(s: PaySchedule, today = todayBR()) { return [...around(s, today)].reverse().find(d => d <= today) ?? null; }

export function paymentsPerMonth(s: PaySchedule) {
  if (s.frequency === "weekly") return 52 / 12;
  if (s.frequency === "biweekly") return 2;
  return 1;
}
/** Valor esperado em cada pagamento (renda mensal dividida pelo número de pagamentos). */
export function expectedPayment(monthlyIncome: number | null | undefined, s: PaySchedule) {
  if (!monthlyIncome || monthlyIncome <= 0) return null;
  return Math.round((monthlyIncome / paymentsPerMonth(s)) * 100) / 100;
}

export function scheduleLabel(s: PaySchedule) {
  if (s.frequency === "weekly" && s.weekday != null) return `Toda ${WEEKDAYS[s.weekday].replace("-feira", "")}`.replace("Toda sábado", "Todo sábado").replace("Toda domingo", "Todo domingo");
  if (s.frequency === "irregular") return "Sem data certa";
  if (!s.days.length) return null;
  const fmt = (d: number) => (s.businessDay ? `${d}º dia útil` : d === 31 ? "último dia" : `dia ${d}`);
  if (s.frequency === "biweekly" || s.days.length > 1) return s.businessDay ? `${s.days.map(d => `${d}º`).join(" e ")} dias úteis` : `Dias ${s.days.join(" e ")}`;
  return `Todo ${fmt(s.days[0])}${s.businessDay ? " do mês" : ""}`;
}

export function scheduleFromProfile(p: Record<string, unknown> | null | undefined): PaySchedule {
  const f = p?.pay_frequency;
  return {
    frequency: f === "monthly" || f === "biweekly" || f === "weekly" || f === "irregular" ? f : null,
    days: Array.isArray(p?.pay_days) ? (p!.pay_days as unknown[]).map(Number).filter(n => n >= 1 && n <= 31).slice(0, 2) : [],
    weekday: typeof p?.pay_weekday === "number" ? (p!.pay_weekday as number) : null,
    businessDay: Boolean(p?.pay_business_day),
  };
}
export const hasSchedule = (s: PaySchedule) => s.frequency === "irregular" || (s.frequency === "weekly" ? s.weekday != null : s.days.length > 0 && !!s.frequency);
