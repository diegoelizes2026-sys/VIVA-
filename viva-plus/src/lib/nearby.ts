// VIVA+ Perto de mim — mercados, farmácias e restaurantes próximos (dados abertos do OpenStreetMap).
// A localização é usada só para a busca: não é gravada no banco.

export type NearbyKind = "mercado" | "farmacia" | "restaurante" | "academia";

export const NEARBY_KINDS: Record<NearbyKind, { label: string; plural: string; emoji: string }> = {
  mercado: { label: "Mercado", plural: "Mercados", emoji: "🛒" },
  farmacia: { label: "Farmácia", plural: "Farmácias", emoji: "💊" },
  restaurante: { label: "Restaurante", plural: "Restaurantes", emoji: "🍽️" },
  academia: { label: "Academia", plural: "Academias", emoji: "🏋️" },
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
  academia: ['["leisure"="fitness_centre"]', '["leisure"="sports_centre"]["sport"~"fitness|crossfit|multi|martial_arts|yoga|pilates|swimming"]', '["amenity"="gym"]'],
};

export function overpassQuery(kind: NearbyKind, lat: number, lon: number, radius: number) {
  const parts = FILTERS[kind].map(f => `nwr(around:${Math.round(radius)},${lat},${lon})${f}["name"];`).join("");
  return `[out:json][timeout:25];(${parts});out center tags 120;`;
}

const TYPE_LABEL: Record<string, string> = {
  supermarket: "Supermercado", convenience: "Mercadinho / conveniência", greengrocer: "Hortifruti", wholesale: "Atacado",
  butcher: "Açougue", bakery: "Padaria", pharmacy: "Farmácia", fitness_centre: "Academia", sports_centre: "Centro esportivo", gym: "Academia", restaurant: "Restaurante", fast_food: "Lanchonete", food_court: "Praça de alimentação",
};

const CUISINE: Record<string, string> = {
  pizza: "Pizza", burger: "Hambúrguer", japanese: "Japonesa", sushi: "Japonesa", brazilian: "Brasileira", regional: "Regional",
  italian: "Italiana", chinese: "Chinesa", arab: "Árabe", barbecue: "Churrasco", steak_house: "Churrascaria", chicken: "Frango",
  coffee_shop: "Café", ice_cream: "Sorvete", sandwich: "Lanches", vegetarian: "Vegetariana", vegan: "Vegana", seafood: "Frutos do mar",
  mexican: "Mexicana", acai: "Açaí", juice: "Sucos", buffet: "Buffet", international: "Internacional", pasta: "Massas",
};

const SPORT: Record<string, string> = { fitness: "Musculação", crossfit: "CrossFit", yoga: "Yoga", pilates: "Pilates", martial_arts: "Lutas", swimming: "Natação", multi: "Várias modalidades", boxing: "Boxe", dance: "Dança" };

export function distanceMeters(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371000, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLon = toRad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type OsmElement = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

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
    const raw = t.shop || t.leisure || t.amenity || t.healthcare || "";
    const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(", ");
    const address = [street, t["addr:suburb"] || t["addr:neighbourhood"]].filter(Boolean).join(" · ") || null;
    const sport = kind === "academia" && t.sport ? t.sport.split(";").map(x => SPORT[x.trim()] || null).filter(Boolean).slice(0, 2).join(", ") || null : null;
    const cuisine = sport ?? (t.cuisine ? t.cuisine.split(";").map(c => CUISINE[c.trim()] || null).filter(Boolean).slice(0, 2).join(", ") || null : null);
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

// ---------- Busca no OpenStreetMap (servidor ou, como reserva, o próprio navegador) ----------
export const OVERPASS_ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];

/** Consulta todos os servidores ao mesmo tempo e fica com a primeira resposta válida. */
export async function queryOverpass(query: string, opts: { endpoints?: string[]; timeoutMs?: number; headers?: Record<string, string> } = {}) {
  const endpoints = opts.endpoints?.length ? opts.endpoints : OVERPASS_ENDPOINTS;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 12000);
  const failures: string[] = [];
  try {
    let done = false;
    return await Promise.any(endpoints.map(async (url, i) => {
      const host = (() => { try { return new URL(url).host; } catch { return url; } })();
      // Não sobrecarrega os servidores gratuitos: o próximo só entra se o anterior demorar ou falhar.
      if (i > 0) await new Promise<void>(resolve => { const t = setTimeout(resolve, i * 2500); ctrl.signal.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true }); });
      if (done || ctrl.signal.aborted) throw new Error(`${host}:skipped`);
      try {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", ...(opts.headers || {}) }, body: "data=" + encodeURIComponent(query), signal: ctrl.signal, cache: "no-store" });
        if (!res.ok) throw new Error(`${host}:${res.status}`);
        const json = await res.json();
        if (!Array.isArray(json?.elements)) throw new Error(`${host}:invalid`);
        if (!json.elements.length && typeof json.remark === "string" && /error|timed out/i.test(json.remark)) throw new Error(`${host}:remark`);
        done = true;
        return json.elements as OsmElement[];
      } catch (e) {
        const msg = e instanceof Error ? (e.name === "AbortError" ? `${host}:timeout` : e.message.startsWith(host) ? e.message : `${host}:${e.message}`) : `${host}:erro`;
        failures.push(msg.slice(0, 80)); throw e;
      }
    }));
  } catch {
    throw new Error("overpass_failed " + failures.join(" | "));
  } finally { clearTimeout(timer); ctrl.abort(); }
}

// ---------- Photon (busca do OpenStreetMap feita pela komoot; aceita chamadas do navegador) ----------
const PHOTON_TAGS: Record<NearbyKind, string[]> = {
  mercado: ["shop:supermarket", "shop:convenience", "shop:greengrocer", "shop:wholesale", "shop:butcher", "shop:bakery"],
  farmacia: ["amenity:pharmacy", "healthcare:pharmacy"],
  restaurante: ["amenity:restaurant", "amenity:fast_food", "amenity:food_court"],
  academia: ["leisure:fitness_centre", "leisure:sports_centre", "amenity:gym"],
};
export const PHOTON_URL = "https://photon.komoot.io/reverse";

export function photonUrl(kind: NearbyKind, lat: number, lon: number, radius: number, base = PHOTON_URL) {
  const q = new URLSearchParams({ lat: String(lat), lon: String(lon), radius: String(Math.max(0.3, Math.min(5, radius / 1000))), limit: "50", lang: "default" });
  for (const t of PHOTON_TAGS[kind]) q.append("osm_tag", t);
  return `${base}?${q.toString()}`;
}

type PhotonFeature = { geometry?: { coordinates?: [number, number] }; properties?: Record<string, string | number | undefined> };
const OSM_TYPE: Record<string, string> = { N: "node", W: "way", R: "relation" };

/** Converte a resposta do Photon para o mesmo formato do OpenStreetMap (mesmos ids → mesmas avaliações). */
export function photonToElements(features: PhotonFeature[]): OsmElement[] {
  const out: OsmElement[] = [];
  for (const f of features || []) {
    const p = f.properties || {}; const c = f.geometry?.coordinates;
    if (!c || !p.name || !p.osm_id || !p.osm_key) continue;
    const tags: Record<string, string> = { name: String(p.name), [String(p.osm_key)]: String(p.osm_value || "") };
    if (p.street) tags["addr:street"] = String(p.street);
    if (p.housenumber) tags["addr:housenumber"] = String(p.housenumber);
    if (p.district || p.locality) tags["addr:suburb"] = String(p.district || p.locality);
    out.push({ type: OSM_TYPE[String(p.osm_type)] || "node", id: Number(p.osm_id), lat: c[1], lon: c[0], tags });
  }
  return out;
}

export async function queryPhoton(kind: NearbyKind, lat: number, lon: number, radius: number, opts: { timeoutMs?: number; headers?: Record<string, string>; base?: string } = {}) {
  const res = await fetch(photonUrl(kind, lat, lon, radius, opts.base), { headers: opts.headers, signal: AbortSignal.timeout(opts.timeoutMs ?? 10000), cache: "no-store" });
  if (!res.ok) throw new Error("photon:" + res.status);
  const json = await res.json();
  if (!Array.isArray(json?.features)) throw new Error("photon:invalid");
  return photonToElements(json.features);
}

/** Busca completa: Photon primeiro (rápido e estável), OpenStreetMap/Overpass como reserva. */
export async function searchPlaces(kind: NearbyKind, lat: number, lon: number, radius: number, opts: { overpassEndpoints?: string[]; photonBase?: string; headers?: Record<string, string> } = {}) {
  const errors: string[] = [];
  try {
    const els = await queryPhoton(kind, lat, lon, radius, { headers: opts.headers, base: opts.photonBase });
    return { places: parsePlaces(kind, lat, lon, els).filter(p => p.distance <= radius * 1.05), source: "photon" as const };
  } catch (e) { errors.push(e instanceof Error ? e.message : "photon:erro"); }
  try {
    const els = await queryOverpass(overpassQuery(kind, lat, lon, radius), { endpoints: opts.overpassEndpoints, timeoutMs: 15000, headers: opts.headers });
    return { places: parsePlaces(kind, lat, lon, els), source: "overpass" as const };
  } catch (e) { errors.push(e instanceof Error ? e.message.replace(/^overpass_failed\s*/, "") : "overpass:erro"); }
  throw new Error("search_failed " + errors.join(" | "));
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
  if (/\b(academias?|crossfit|musculacao|pilates|onde treinar|treinar)\b/.test(low)) return "academia";
  if (/\b(restaurantes?|lanchonetes?|onde comer|comer|almocar|jantar|pizzaria|hamburgueria|lanche)\b/.test(low)) return "restaurante";
  return null;
}
