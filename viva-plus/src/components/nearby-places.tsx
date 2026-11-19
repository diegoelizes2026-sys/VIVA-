"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NEARBY_KINDS, directionsLinks, formatDistance, isOpenNow, overpassQuery, parsePlaces, queryOverpass, travelHint, type NearbyKind, type Place } from "@/lib/nearby";

type Coords = { lat: number; lon: number };
type Status = "idle" | "locating" | "loading" | "ready" | "denied" | "error";
const RADII = [1000, 2000, 5000];
const CONSENT_KEY = "viva-nearby-location-ok";
const KINDS = Object.keys(NEARBY_KINDS) as NearbyKind[];

function readConsent() { try { return localStorage.getItem(CONSENT_KEY) === "1"; } catch { return false; } }
function saveConsent() { try { localStorage.setItem(CONSENT_KEY, "1"); } catch { /* navegação privada */ } }

export default function NearbyPlaces() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = (params.get("tipo") as NearbyKind) || "mercado";
  const [kind, setKind] = useState<NearbyKind>(KINDS.includes(initial) ? initial : "mercado");
  const [radius, setRadius] = useState(2000);
  const [openOnly, setOpenOnly] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState<{ mercado: string[]; farmacia: string[] }>({ mercado: [], farmacia: [] });
  const cardRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const supabase = useMemo(() => createClient(), []);

  // Lembrete do que falta comprar (lista de compras do próprio usuário, via RLS).
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
      const { data: lists } = await supabase.from("viva_shopping_lists").select("id,kind").eq("user_id", user.id).is("archived_at", null);
      if (!lists?.length) return;
      const { data: items } = await supabase.from("viva_shopping_list_items").select("title,list_id").eq("user_id", user.id).eq("is_purchased", false).in("list_id", lists.map(l => l.id)).order("created_at").limit(200);
      const kindOf = new Map(lists.map(l => [l.id, l.kind as string]));
      const out = { mercado: [] as string[], farmacia: [] as string[] };
      for (const i of items || []) { const k = kindOf.get(i.list_id); if (k === "farmacia") out.farmacia.push(i.title); else if (k === "mercado") out.mercado.push(i.title); }
      setPending(out);
    })().catch(() => {});
  }, [supabase]);

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) { setStatus("error"); setError("Seu aparelho não informa a localização."); return; }
    setStatus("locating"); setError("");
    navigator.geolocation.getCurrentPosition(
      pos => { saveConsent(); setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }); },
      err => {
        if (err.code === err.PERMISSION_DENIED) { setStatus("denied"); return; }
        setStatus("error"); setError("Não consegui achar sua localização. Confira se o GPS está ligado e tente de novo.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 120000 },
    );
  }, []);

  // Quem já permitiu antes não precisa tocar no botão de novo.
  useEffect(() => { if (readConsent()) locate(); }, [locate]);

  useEffect(() => {
    if (!coords) return;
    const ctrl = new AbortController();
    setStatus("loading"); setError(""); setSelected(null);
    // 1º o servidor (cache e coordenadas arredondadas); se ele falhar, o próprio navegador consulta o OpenStreetMap.
    const direct = async () => {
      const lat = Math.round(coords.lat * 1000) / 1000, lon = Math.round(coords.lon * 1000) / 1000;
      const elements = await queryOverpass(overpassQuery(kind, lat, lon, radius), { timeoutMs: 20000 });
      return parsePlaces(kind, lat, lon, elements);
    };
    (async () => {
      let list: Place[] | null = null; let serverMsg = "";
      try {
        const r = await fetch(`/api/nearby?lat=${coords.lat}&lon=${coords.lon}&type=${kind}&radius=${radius}`, { signal: ctrl.signal });
        const d = await r.json().catch(() => ({}));
        if (r.ok) list = d.places || [];
        else if (r.status === 400 || r.status === 401 || r.status === 429) throw new Error(d.error || "Não consegui buscar os lugares agora.");
        else serverMsg = d.reason || String(r.status);
      } catch (e) { if (ctrl.signal.aborted) return; if (e instanceof Error && e.name !== "TypeError") throw e; serverMsg = "rede"; }
      if (!list) {
        try { list = await direct(); }
        catch (e) { console.warn("VIVA nearby", serverMsg, e); throw new Error("Não consegui buscar os lugares agora. Confira sua internet e tente de novo."); }
      }
      if (ctrl.signal.aborted) return;
      setPlaces(list); setStatus("ready");
    })().catch(e => { if (ctrl.signal.aborted) return; setStatus("error"); setError(e instanceof Error ? e.message : "Erro ao buscar."); });
    return () => ctrl.abort();
  }, [coords, kind, radius]);

  const changeKind = (k: NearbyKind) => { setKind(k); router.replace(`/perto?tipo=${k}`, { scroll: false }); };

  const now = new Date();
  const enriched = places.map(p => ({ ...p, open: isOpenNow(p.openingHours, now) }));
  const shown = openOnly ? enriched.filter(p => p.open === true) : enriched;
  const reminder = kind === "mercado" || kind === "farmacia" ? pending[kind] : [];

  const pick = (id: string) => { setSelected(id); cardRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" }); };

  return <div className="np-page">
    <header className="np-head">
      <p className="vc-eyebrow">VIVA+ Perto de mim</p>
      <h1>{NEARBY_KINDS[kind].plural} perto de você</h1>
    </header>

    <div className="np-tabs" role="tablist" aria-label="O que procurar">
      {KINDS.map(k => <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? "on" : ""} onClick={() => changeKind(k)}><span aria-hidden>{NEARBY_KINDS[k].emoji}</span>{NEARBY_KINDS[k].label}</button>)}
    </div>

    {reminder.length > 0 && <a className="np-reminder" href="/lista-de-compras">
      <b>Você tem {reminder.length} {reminder.length === 1 ? "item" : "itens"} pra comprar {kind === "farmacia" ? "na farmácia" : "no mercado"}</b>
      <span>{reminder.slice(0, 4).join(", ")}{reminder.length > 4 ? "…" : ""}</span>
      <em>Ver lista →</em>
    </a>}

    {!coords && status !== "locating" && <section className="np-ask">
      <div className="np-pin" aria-hidden><svg viewBox="0 0 28 28"><path d="M14 24.5s7.5-6.6 7.5-13a7.5 7.5 0 0 0-15 0c0 6.4 7.5 13 7.5 13Z" /><circle cx="14" cy="11.5" r="2.8" /></svg></div>
      {status === "denied" ? <>
        <b>A localização está bloqueada</b>
        <p>Para ver o que tem perto, permita a localização para o VIVA+ nas configurações do navegador (no iPhone: Ajustes › Safari › Localização) e toque em tentar de novo.</p>
      </> : <>
        <b>Veja o que tem perto de você</b>
        <p>Usamos sua localização só para esta busca. Ela não fica salva na sua conta.</p>
      </>}
      {status === "error" && <p className="sl-error">{error}</p>}
      <button className="vc-btn" onClick={locate}>{status === "denied" || status === "error" ? "Tentar de novo" : "Usar minha localização"}</button>
    </section>}

    {(status === "locating" || (status === "loading" && !places.length)) && <div className="np-loading" aria-live="polite"><span className="np-spin" />{status === "locating" ? "Achando sua localização…" : `Procurando ${NEARBY_KINDS[kind].plural.toLowerCase()}…`}</div>}

    {coords && <>
      <div className="np-filters">
        <div className="np-radius" role="group" aria-label="Distância">
          {RADII.map(r => <button key={r} className={radius === r ? "on" : ""} onClick={() => setRadius(r)}>{r / 1000} km</button>)}
        </div>
        <label className="np-open"><input type="checkbox" checked={openOnly} onChange={e => setOpenOnly(e.target.checked)} />Aberto agora</label>
      </div>

      {status === "error" && <p className="sl-error">{error} <button className="ob-link" onClick={() => setCoords({ ...coords })}>Tentar de novo</button></p>}

      {shown.length > 0 && <Radar places={shown} radius={radius} center={coords} selected={selected} onPick={pick} />}

      {status === "ready" && !shown.length && <div className="sl-empty"><b>{openOnly ? "Nada aberto agora nesse raio" : `Não achei ${NEARBY_KINDS[kind].plural.toLowerCase()} nesse raio`}</b><p>{radius < 5000 ? "Tente aumentar a distância." : openOnly ? "Tire o filtro “Aberto agora” para ver todos." : "Os dados vêm do OpenStreetMap e podem não ter todos os lugares da sua região."}</p></div>}

      {shown.length > 0 && <ul className="np-list">
        {shown.map((p, i) => { const links = directionsLinks(p); return <li key={p.id} ref={el => { cardRefs.current[p.id] = el; }} className={selected === p.id ? "sel" : ""} onClick={() => setSelected(p.id)}>
          <div className="np-num" aria-hidden>{i + 1}</div>
          <div className="np-info">
            <b>{p.name}</b>
            <span>{[p.cuisine || p.type, formatDistance(p.distance), travelHint(p.distance)].join(" · ")}</span>
            {p.address && <small>{p.address}</small>}
            {p.open === true && <i className="np-badge open">Aberto agora</i>}
            {p.open === false && <i className="np-badge closed">Fechado agora</i>}
            {p.open === null && p.openingHours && <i className="np-badge">Horário: {p.openingHours}</i>}
            <div className="np-actions">
              <a href={links.google} target="_blank" rel="noopener noreferrer" className="np-go">Como chegar</a>
              <a href={links.waze} target="_blank" rel="noopener noreferrer">Waze</a>
              {p.phone && <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`}>Ligar</a>}
            </div>
          </div>
        </li>; })}
      </ul>}

      <p className="np-credit">Lugares: © colaboradores do <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>. Horários e endereços podem estar desatualizados.</p>
    </>}
  </div>;
}

// Mini-mapa no estilo radar: você no centro, cada lugar na direção e distância reais.
function Radar({ places, radius, center, selected, onPick }: { places: (Place & { open: boolean | null })[]; radius: number; center: Coords; selected: string | null; onPick: (id: string) => void }) {
  const R = 46; // raio útil do desenho (viewBox 100x100)
  const kx = 111320 * Math.cos((center.lat * Math.PI) / 180), ky = 110540;
  const dots = places.slice(0, 30).map((p, i) => {
    let x = ((p.lon - center.lon) * kx) / radius, y = -((p.lat - center.lat) * ky) / radius;
    const len = Math.hypot(x, y); if (len > 1) { x /= len; y /= len; }
    return { p, i, x: 50 + x * R, y: 50 + y * R };
  });
  return <div className="np-radar" aria-label="Mapa dos lugares em volta de você">
    <svg viewBox="0 0 100 100" role="img">
      <circle cx="50" cy="50" r={R} className="ring" /><circle cx="50" cy="50" r={R * 0.66} className="ring" /><circle cx="50" cy="50" r={R * 0.33} className="ring" />
      <path d="M50 4v92M4 50h92" className="axis" />
      <text x="50" y="9" className="n">N</text>
      {[...dots].reverse().map(d => <g key={d.p.id} className={"dot" + (selected === d.p.id ? " sel" : "") + (d.p.open === false ? " closed" : "")} onClick={() => onPick(d.p.id)} role="button" aria-label={`${d.i + 1}. ${d.p.name}`}>
        <circle cx={d.x} cy={d.y} r={selected === d.p.id ? 5 : 3.6} /><text x={d.x} y={d.y + 1.4}>{d.i + 1}</text>
      </g>)}
      <circle cx="50" cy="50" r="3.2" className="me" /><circle cx="50" cy="50" r="6.5" className="me-halo" />
    </svg>
    <span className="np-radar-scale">{radius / 1000} km</span>
  </div>;
}
