// VIVA+ Perto de mim — mercados, farmácias e restaurantes próximos (dados abertos do OpenStreetMap).
// A localização é usada só para a busca: não é gravada no banco.

export type NearbyKind = "mercado" | "farmacia" | "restaurante";

export const NEARBY_KINDS: Record<NearbyKind, { label: string; plural: string; emoji: string }> = {
  mercado: { label: "Mercado", plural: "Mercados", emoji: "🛒" },
  farmacia: { label: "Farmácia", plural: "Farmácias", emoji: "💊" },
  restaurante: { label: "Restaurante", plural: "Restaurantes", emoji: "🍽️" },
};

export type Place = {
  id: string;
  name: string;
  kind: NearbyKind;
  type: string; // ex.: "Supermercado", "Padaria", "Lanchonete"
  lat: number;
  lon: number;
  distance: number; // metros
  address: string | null;
  openingHours: string | null;
  phone: string | null;
  cuisine: string | null;
};

const FILTERS: Record<NearbyKind, string[]> = {
  mercado: ['["shop"~"^(supermarket|convenience|greengrocer|wholesale|butcher|bakery)$"]'],
  farmacia: ['["amenity"="pharmacy"]', '["healthcare"="pharmacy"]'],
  restaurante: ['["amenity"~"^(restaurant|fast_food|food_court)$"]'],
};

export function overpassQuery(kind: NearbyKind, lat: number, lon: number, radius: number) {
  const parts = FILTERS[kind].map(f => `nwr(around:${Math.round(radius)},${lat},${lon})${f}["name"];`).join("");
  return `[out:json][timeout:15];(${parts});out center tags 120;`;
}

const TYPE_LABEL: Record<string, string> = {
  supermarket: "Supermercado", convenience: "Mercadinho / conveniência", greengrocer: "Hortifruti", wholesale: "Atacado",
  butcher: "Açougue", bakery: "Padaria", pharmacy: "Farmácia", restaurant: "Restaurante", fast_food: "Lanchonete", food_court: "Praça de alimentação",
};

const CUISINE: Record<string, string> = {
  pizza: "Pizza", burger: "Hambúrguer", japanese: "Japonesa", sushi: "Japonesa", brazilian: "Brasileira", regional: "Regional",
  italian: "Italiana", chinese: "Chinesa", arab: "Árabe", barbecue: "Churrasco", steak_house: "Churrascaria", chicken: "Frango",
  coffee_shop: "Café", ice_cream: "Sorvete", sandwich: "Lanches", vegetarian: "Vegetariana", vegan: "Vegana", seafood: "Frutos do mar",
  mexican: "Mexicana", acai: "Açaí", juice: "Sucos", buffet: "Buffet", international: "Internacional", pasta: "Massas",
};

export function distanceMeters(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371000, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLon = toRad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type OsmElement = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

export function parsePlaces(kind: NearbyKind, lat: number, lon: number, elements: OsmElement[]): Place[] {
  const seen = new Set<string>();
  const out: Place[] = [];
  for (const el of elements || []) {
    const t = el.tags || {};
    const pLat = el.lat ?? el.center?.lat, pLon = el.lon ?? el.center?.lon;
    if (pLat == null || pLon == null || !t.name) continue;
    const name = t.name.trim().slice(0, 80);
    const key = name.toLowerCase() + ":" + pLat.toFixed(3) + ":" + pLon.toFixed(3);
    if (seen.has(key)) continue; seen.add(key);
    const raw = t.shop || t.amenity || t.healthcare || "";
    const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(", ");
    const address = [street, t["addr:suburb"] || t["addr:neighbourhood"]].filter(Boolean).join(" · ") || null;
    const cuisine = t.cuisine ? t.cuisine.split(";").map(c => CUISINE[c.trim()] || null).filter(Boolean).slice(0, 2).join(", ") || null : null;
    out.push({
      id: `${el.type}/${el.id}`, name, kind, type: TYPE_LABEL[raw] || NEARBY_KINDS[kind].label,
      lat: pLat, lon: pLon, distance: Math.round(distanceMeters(lat, lon, pLat, pLon)),
      address, openingHours: t.opening_hours ? t.opening_hours.slice(0, 160) : null,
      phone: (t.phone || t["contact:phone"] || "").split(";")[0].trim() || null, cuisine,
    });
  }
  return out.sort((a, b) => a.distance - b.distance).slice(0, 60);
}

// ---------- Aberto agora? (formatos comuns do OpenStreetMap) ----------
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
function dayIn(spec: string, day: number) {
  return spec.split(",").some(part => {
    const [a, b] = part.trim().split("-");
    const ia = DAYS.indexOf(a), ib = b ? DAYS.indexOf(b) : ia;
    if (ia < 0 || ib < 0) return false;
    return ia <= ib ? day >= ia && day <= ib : day >= ia || day <= ib;
  });
}
const mins = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + (m || 0); };

/** true = aberto, false = fechado, null = não dá para saber. `now` no horário local do lugar. */
export function isOpenNow(oh: string | null, now: Date = new Date()): boolean | null {
  if (!oh) return null;
  const s = oh.trim();
  if (s === "24/7") return true;
  if (/PH|SH|sunrise|sunset|week|\[|"|\|\|/.test(s)) return null; // formatos complexos: não arriscar
  const day = now.getDay(), cur = now.getHours() * 60 + now.getMinutes();
  const prevDay = (day + 6) % 7;
  let decided: boolean | null = null; let matchedAny = false;
  for (const rule of s.split(";").map(r => r.trim()).filter(Boolean)) {
    const m = rule.match(/^((?:[A-Z][a-z](?:-[A-Z][a-z])?)(?:,(?:[A-Z][a-z](?:-[A-Z][a-z])?))*)?\s*(.*)$/);
    if (!m) return null;
    const daysSpec = m[1], times = m[2].trim();
    const appliesToday = !daysSpec || dayIn(daysSpec, day);
    const appliesYesterday = !daysSpec || dayIn(daysSpec, prevDay);
    if (/^(off|closed)$/i.test(times)) { if (appliesToday) { decided = false; matchedAny = true; } continue; }
    const ranges = times.split(",").map(r => r.trim().match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\+?$/));
    if (ranges.some(r => !r)) return null;
    let openHere = false;
    for (const r of ranges as RegExpMatchArray[]) {
      const a = mins(r[1]), b = mins(r[2]);
      if (b > a) { if (appliesToday && cur >= a && cur < b) openHere = true; }
      else { // passa da meia-noite (ex.: 18:00-02:00)
        if (appliesToday && cur >= a) openHere = true;
        if (appliesYesterday && cur < b) openHere = true;
      }
    }
    if (appliesToday || (appliesYesterday && openHere)) { matchedAny = true; decided = openHere; } // regra posterior prevalece (padrão OSM)
  }
  return matchedAny ? decided : false;
}

export function formatDistance(m: number) {
  return m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}
/** Estimativa a pé (~80 m/min) até 2 km, depois de carro (~25 km/h em cidade). */
export function travelHint(m: number) {
  if (m <= 2000) return `${Math.max(1, Math.round(m / 80))} min a pé`;
  return `${Math.max(3, Math.round(m / 420))} min de carro`;
}

export function directionsLinks(p: { lat: number; lon: number; name: string }) {
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}&travelmode=walking`,
    waze: `https://waze.com/ul?ll=${p.lat},${p.lon}&navigate=yes`,
  };
}

// ---------- Chat: "farmácia perto", "mercado mais próximo", "onde comer aqui perto" ----------
export function detectNearbyIntent(message: string): NearbyKind | null {
  const low = message.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  if (low.length > 140) return null;
  if (/\b(gastei|paguei|comprei|recebi|transferi)\b/.test(low)) return null; // é lançamento de gasto, não busca
  const near = /\b(perto|proxim[oa]s?|mais perto|por aqui|aqui perto|nas redondezas|na regiao|no bairro)\b/.test(low);
  if (!near) return null;
  if (/\b(farmacias?|drogarias?|remedio)\b/.test(low)) return "farmacia";
  if (/\b(mercados?|supermercados?|mercadinho|atacad\w*|hortifruti|sacolao|padarias?|acougue)\b/.test(low)) return "mercado";
  if (/\b(restaurantes?|lanchonetes?|onde comer|comer|almocar|jantar|pizzaria|hamburgueria|lanche)\b/.test(low)) return "restaurante";
  return null;
}
