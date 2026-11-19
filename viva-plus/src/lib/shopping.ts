// Lista de compras: leitura de itens digitados ou falados e organização por seção do mercado.
// Código puro (navegador e servidor). Nenhum preço é inventado: o preço estimado é opcional e informado pelo usuário.

export type ParsedItem = { title: string; quantity: number; unit: string | null; category: string };

// Ordem das seções como num mercado (hortifruti na entrada, limpeza no fundo).
export const SECTIONS: { name: string; words: string[] }[] = [
  { name: "Hortifruti", words: ["banana", "maçã", "maca", "laranja", "limão", "limao", "tomate", "cebola", "alho", "batata", "cenoura", "alface", "couve", "fruta", "verdura", "legume", "abacate", "mamão", "mamao", "uva", "melancia", "pepino", "abobrinha", "brócolis", "brocolis", "pimentão", "pimentao", "morango", "manga", "abacaxi", "coentro", "cheiro verde", "mandioca", "aipim", "inhame", "beterraba"] },
  { name: "Padaria", words: ["pão", "pao", "pães", "paes", "bisnaguinha", "bolo", "torrada", "rosca", "croissant"] },
  { name: "Açougue e peixaria", words: ["carne", "frango", "peito de frango", "coxa", "linguiça", "linguica", "bife", "patinho", "acém", "acem", "costela", "peixe", "tilápia", "tilapia", "salmão", "salmao", "camarão", "camarao", "porco", "lombo", "moída", "moida", "picanha", "hambúrguer", "hamburguer", "salsicha"] },
  { name: "Frios e laticínios", words: ["leite", "queijo", "presunto", "iogurte", "manteiga", "margarina", "requeijão", "requeijao", "mussarela", "muçarela", "creme de leite", "nata", "ricota", "peito de peru", "mortadela", "ovo", "ovos"] },
  { name: "Mercearia", words: ["arroz", "feijão", "feijao", "macarrão", "macarrao", "farinha", "açúcar", "acucar", "sal", "óleo", "oleo", "azeite", "café", "cafe", "biscoito", "bolacha", "molho", "extrato", "milho", "ervilha", "atum", "sardinha", "aveia", "granola", "cereal", "fubá", "fuba", "tempero", "vinagre", "maionese", "ketchup", "mostarda", "achocolatado", "leite condensado", "gelatina", "chocolate", "pipoca", "lentilha", "grão", "grao", "tapioca"] },
  { name: "Bebidas", words: ["água", "agua", "refrigerante", "suco", "cerveja", "vinho", "energético", "energetico", "chá", "cha", "refri"] },
  { name: "Congelados", words: ["sorvete", "congelado", "pizza", "lasanha", "nuggets", "polpa", "batata congelada"] },
  { name: "Limpeza", words: ["detergente", "sabão", "sabao", "amaciante", "desinfetante", "água sanitária", "agua sanitaria", "esponja", "limpador", "multiuso", "saco de lixo", "vassoura", "rodo", "pano", "álcool", "alcool", "lustra", "cloro", "papel toalha", "guardanapo", "papel alumínio", "papel aluminio", "filme plástico"] },
  { name: "Higiene", words: ["sabonete", "shampoo", "xampu", "condicionador", "pasta de dente", "creme dental", "escova de dente", "desodorante", "papel higiênico", "papel higienico", "absorvente", "fio dental", "barbeador", "lâmina", "lamina", "cotonete", "hidratante", "protetor solar", "fralda", "lenço", "lenco"] },
  { name: "Farmácia", words: ["remédio", "remedio", "dipirona", "paracetamol", "ibuprofeno", "vitamina", "curativo", "band-aid", "esparadrapo", "termômetro", "termometro", "soro", "pomada", "xarope", "antialérgico", "antialergico", "colírio", "colirio", "gaze", "seringa", "teste de gravidez", "dorflex", "neosaldina", "omeprazol"] },
  { name: "Pet", words: ["ração", "racao", "areia de gato", "petisco", "coleira", "antipulgas"] },
  { name: "Outros", words: [] },
];
export const SECTION_ORDER = SECTIONS.map(s => s.name);

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function categorize(title: string): string {
  const t = " " + norm(title) + " ";
  let best: { name: string; len: number } | null = null;
  for (const s of SECTIONS) for (const w of s.words) {
    const nw = norm(w);
    if (t.includes(" " + nw) && (!best || nw.length > best.len)) best = { name: s.name, len: nw.length };
  }
  return best?.name || "Outros";
}

const UNITS: Record<string, string> = { kg: "kg", quilo: "kg", quilos: "kg", g: "g", gramas: "g", grama: "g", l: "L", litro: "L", litros: "L", ml: "ml", un: "un", unidade: "un", unidades: "un", pct: "pct", pacote: "pct", pacotes: "pct", cx: "cx", caixa: "cx", caixas: "cx", duzia: "dz", dúzia: "dz", duzias: "dz", dúzias: "dz", lata: "lata", latas: "lata", garrafa: "gf", garrafas: "gf", fardo: "fardo", fardos: "fardo", bandeja: "bdj", bandejas: "bdj" };
const WORD_NUM: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, três: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, meia: 0.5, meio: 0.5 };

function parseOne(raw: string): ParsedItem | null {
  let t = raw.trim().replace(/^[-•*·\s]+/, "").replace(/[.!?;]+$/, "").trim();
  if (!t) return null;
  let quantity = 1; let unit: string | null = null;
  // "2 kg de arroz", "2kg arroz", "3x sabonete", "duas caixas de leite", "meia dúzia de ovos"
  const m = t.match(/^(\d+(?:[.,]\d+)?|um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|meia|meio)\s*(x\b)?\s*([a-zA-Zúçãí]+)?\s*(de\s+)?(.*)$/i);
  if (m) {
    const n = /^\d/.test(m[1]) ? Number(m[1].replace(",", ".")) : WORD_NUM[norm(m[1])] ?? WORD_NUM[m[1].toLowerCase()];
    const maybeUnit = m[3] ? UNITS[norm(m[3])] || UNITS[m[3].toLowerCase()] : undefined;
    if (n && n > 0) {
      quantity = n;
      if (maybeUnit) { unit = maybeUnit; t = (m[5] || "").trim(); }
      else t = ((m[3] || "") + " " + (m[5] ? (m[4] || "") + m[5] : "")).replace(/^de\s+/i, "").trim();
    }
  }
  // "arroz 5kg", "leite 2 litros", "ovos x2"
  const tail = t.match(/^(.*?)\s+(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|litros?|quilos?|un|unidades?|pct|pacotes?|cx|caixas?|latas?)?$/i) || t.match(/^(.*?)\s+x\s?(\d+)$/i);
  if (tail && tail[1] && quantity === 1) {
    quantity = Number(tail[2].replace(",", ".")) || 1;
    if (tail[3]) unit = UNITS[norm(tail[3])] || unit;
    t = tail[1].trim();
  }
  // Dúzia vira unidades: "meia dúzia de ovos" → 6 un.
  if (unit === "dz") { quantity = quantity * 12; unit = "un"; }
  t = t.replace(/\s+/g, " ").trim();
  if (t.length < 2) return null;
  const title = t.charAt(0).toUpperCase() + t.slice(1, 120);
  return { title, quantity: Math.min(10000, Math.round(quantity * 1000) / 1000), unit, category: categorize(title) };
}

// Vários itens de uma vez: "leite, pão e 2kg de arroz" ou uma lista colada com quebras de linha.
export function parseItems(text: string): ParsedItem[] {
  const parts = text.split(/\n|,|;|\s+e\s+(?=\S)/i).map(s => s.trim()).filter(Boolean);
  const out: ParsedItem[] = [];
  for (const p of parts.slice(0, 50)) { const it = parseOne(p); if (it) out.push(it); }
  return out;
}

export function formatQty(q: number, unit: string | null) {
  const n = Number(q).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  if (unit) return `${n} ${unit}`;
  return q === 1 ? "" : `${n}x`;
}

// Pedidos feitos no chat da VIVA (sem IA e sem créditos).
export type ShoppingIntent = { action: "add"; items: ParsedItem[]; kind: "mercado" | "farmacia" } | { action: "show" };
export function detectShoppingIntent(message: string): ShoppingIntent | null {
  const t = message.trim();
  const low = norm(t);
  if (/\b(o que (tem|falta) na|ver|mostra(r)?|mostre|qual (e|é) a) (minha )?lista( de compras)?\b/.test(low) || /^minha lista( de compras)?\??$/.test(low)) return { action: "show" };
  const explicit = t.match(/^(?:viva,?\s*)?(?:coloca|coloque|colocar|adiciona|adicione|adicionar|bota|bote|inclui|inclua|anota|anote|p[õo]e|ponha|acrescenta|acrescente)\s+(.+?)\s+(?:na|à|a|para a|pra)\s+(?:minha\s+)?lista(?:\s+de\s+compras|\s+do\s+mercado|\s+da\s+farm[áa]cia)?\s*[.!]?$/i)
    || t.match(/^(?:viva,?\s*)?(?:lista de compras|na lista)\s*:\s*(.+)$/i);
  // Frases soltas ("acabou o café") só valem para itens reconhecidos de mercado/farmácia: "acabou o dinheiro" não vira item.
  const soft = !explicit && t.match(/^(?:viva,?\s*)?(?:preciso comprar|tenho que comprar|acabou o|acabou a|acabaram os|acabaram as)\s+(.+)$/i);
  const add = explicit || soft;
  if (!add) return null;
  const items = parseItems(add[1]);
  if (!items.length) return null;
  if (soft && items.some(i => i.category === "Outros")) return null;
  const pharmacy = /farm[áa]cia/i.test(t) || items.every(i => i.category === "Farmácia");
  return { action: "add", items, kind: pharmacy ? "farmacia" : "mercado" };
}

export function shareText(listTitle: string, items: { title: string; quantity: number; unit: string | null; category: string; is_purchased: boolean }[]) {
  const pending = items.filter(i => !i.is_purchased);
  const lines: string[] = [`🛒 ${listTitle}`];
  for (const sec of SECTION_ORDER) {
    const group = pending.filter(i => i.category === sec);
    if (!group.length) continue;
    lines.push("", `*${sec}*`);
    for (const i of group) { const q = formatQty(i.quantity, i.unit); lines.push(`• ${q ? q + " " : ""}${i.title}`); }
  }
  lines.push("", "Feita no VIVA+");
  return lines.join("\n");
}

// Servidor: executa o pedido de lista feito no chat com o cliente do próprio usuário (RLS garante o dono).
type Db = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
export async function runShoppingIntent(db: Db, userId: string, intent: ShoppingIntent): Promise<{ answer: string; action: { href: string; label: string } }> {
  const action = { href: "/lista-de-compras", label: "Abrir lista de compras" };
  const { data: lists } = await db.from("viva_shopping_lists").select("id,title,kind").eq("user_id", userId).is("archived_at", null).order("created_at");
  if (intent.action === "show") {
    const ids = (lists || []).map((l: { id: string }) => l.id);
    if (!ids.length) return { answer: "Sua lista de compras está vazia. É só me dizer, por exemplo: “coloca leite e pão na lista”.", action };
    const { data: items } = await db.from("viva_shopping_list_items").select("title,quantity,unit,list_id").in("list_id", ids).eq("is_purchased", false).order("category").limit(60);
    if (!items?.length) return { answer: "Não tem nada pendente na sua lista agora. 🎉", action };
    const lines = (items as { title: string; quantity: number; unit: string | null }[]).map(i => { const q = formatQty(Number(i.quantity), i.unit); return `• ${q ? q + " " : ""}${i.title}`; });
    return { answer: `Na sua lista tem ${items.length} ${items.length === 1 ? "item" : "itens"}:\n${lines.join("\n")}`, action };
  }
  let list = (lists || []).find((l: { kind: string }) => l.kind === intent.kind) || (intent.kind === "mercado" ? (lists || [])[0] : null);
  if (!list) {
    const { data, error } = await db.from("viva_shopping_lists").insert({ user_id: userId, title: intent.kind === "farmacia" ? "Farmácia" : "Mercado", kind: intent.kind }).select("id,title,kind").single();
    if (error) throw error; list = data;
  }
  const { data: pending } = await db.from("viva_shopping_list_items").select("id,title,quantity,unit").eq("list_id", list.id).eq("is_purchased", false);
  const rows: Record<string, unknown>[] = [];
  for (const it of intent.items) {
    const dup = (pending || []).find((p: { title: string; unit: string | null }) => p.title.toLowerCase() === it.title.toLowerCase() && (p.unit ?? null) === (it.unit ?? null));
    if (dup) await db.from("viva_shopping_list_items").update({ quantity: Number(dup.quantity) + it.quantity }).eq("id", dup.id);
    else rows.push({ list_id: list.id, user_id: userId, title: it.title, quantity: it.quantity, unit: it.unit, category: list.kind === "farmacia" && it.category === "Outros" ? "Farmácia" : it.category, source: "chat" });
  }
  if (rows.length) { const { error } = await db.from("viva_shopping_list_items").insert(rows); if (error) throw error; }
  const names = intent.items.map(i => i.title).join(", ");
  return { answer: `Anotado na lista ${list.title}: ${names}. 🛒`, action };
}
