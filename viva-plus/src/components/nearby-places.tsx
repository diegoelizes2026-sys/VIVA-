"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NEARBY_KINDS, directionsLinks, distanceMeters, formatDistance, isOpenNow, overpassQuery, parsePlaces, queryOverpass, travelHint, type NearbyKind, type Place } from "@/lib/nearby";

type Coords = { lat: number; lon: number };
type Status = "idle" | "locating" | "loading" | "ready" | "denied" | "error";
const RADII = [1000, 2000, 5000];
const CONSENT_KEY = "viva-nearby-location-ok";
const KINDS = Object.keys(NEARBY_KINDS) as NearbyKind[];
type Rating = { avg: number | null; count: number; mine: number | null; myComment: string | null; recent: { rating: number; comment: string; name: string }[] };
const refOf = (p: Place) => (p.id.startsWith("viva:") ? p.id : "osm:" + p.id);
const stars = (n: number) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));
const nf = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

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
  const [community, setCommunity] = useState<Place[]>([]);
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [sort, setSort] = useState<"near" | "best">("near");
  const [review, setReview] = useState<Place | null>(null);
  const [adding, setAdding] = useState(params.get("adicionar") === "1");
  const [toast, setToast] = useState("");
  const [uid, setUid] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const cardRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const supabase = useMemo(() => createClient(), []);

  // Lembrete do que falta comprar (lista de compras do próprio usuário, via RLS).
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
      setUid(user.id);
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

  // Lugares adicionados pelos usuários do VIVA+ (quem adicionou nunca é mostrado).
  useEffect(() => {
    if (!coords) return;
    let active = true;
    supabase.rpc("viva_places_nearby", { p_lat: coords.lat, p_lon: coords.lon, p_radius: radius, p_kind: kind }).then(({ data }) => {
      if (!active) return;
      const rows = (data || []) as { id: string; kind: NearbyKind; name: string; address: string | null; phone: string | null; lat: number; lon: number; is_mine: boolean }[];
      setCommunity(rows.map(r => ({ id: "viva:" + r.id, name: r.name, kind: r.kind, type: r.is_mine ? "Adicionado por você" : "Indicado por usuário do VIVA+", lat: r.lat, lon: r.lon,
        distance: Math.round(distanceMeters(coords.lat, coords.lon, r.lat, r.lon)), address: r.address, openingHours: null, phone: r.phone, cuisine: null }))
        .filter(p => p.distance <= radius));
    });
    return () => { active = false; };
  }, [coords, kind, radius, supabase, reload]);

  // Junta OpenStreetMap + VIVA+, sem repetir o mesmo lugar (mesmo nome a menos de ~80 m).
  const merged = useMemo(() => {
    const same = (a: Place, b: Place) => a.name.toLowerCase() === b.name.toLowerCase() && distanceMeters(a.lat, a.lon, b.lat, b.lon) < 80;
    return [...places, ...community.filter(c => !places.some(p => same(p, c)))].sort((a, b) => a.distance - b.distance);
  }, [places, community]);

  const refsKey = merged.map(refOf).slice(0, 80).join(",");
  useEffect(() => {
    if (!refsKey) return;
    let active = true;
    supabase.rpc("viva_place_ratings", { p_refs: refsKey.split(",") }).then(({ data }) => {
      if (!active || !data) return;
      const map: Record<string, Rating> = {};
      for (const r of data as { place_ref: string; avg_rating: number | null; reviews: number; my_rating: number | null; my_comment: string | null; recent: Rating["recent"] }[])
        map[r.place_ref] = { avg: r.avg_rating == null ? null : Number(r.avg_rating), count: r.reviews, mine: r.my_rating, myComment: r.my_comment, recent: r.recent || [] };
      setRatings(map);
    });
    return () => { active = false; };
  }, [refsKey, supabase, reload]);

  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(""), 2600); };

  const changeKind = (k: NearbyKind) => { setKind(k); router.replace(`/perto?tipo=${k}`, { scroll: false }); };

  const now = new Date();
  const enriched = merged.map(p => ({ ...p, open: isOpenNow(p.openingHours, now), rating: ratings[refOf(p)] }));
  const filtered = openOnly ? enriched.filter(p => p.open === true) : enriched;
  const score = (r?: Rating) => (r?.avg ? (r.avg * r.count + 3.5 * 2) / (r.count + 2) : 0); // média “bayesiana”: 1 avaliação não vale tanto quanto 20
  const shown = sort === "best" ? [...filtered].sort((a, b) => score(b.rating) - score(a.rating) || a.distance - b.distance) : filtered;
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
      <div className="np-tools">
        <div className="np-sort" role="group" aria-label="Ordenar">
          <button className={sort === "near" ? "on" : ""} onClick={() => setSort("near")}>Mais perto</button>
          <button className={sort === "best" ? "on" : ""} onClick={() => setSort("best")}>Melhor avaliados</button>
        </div>
        <button className="np-add" onClick={() => setAdding(true)}>+ Adicionar lugar</button>
      </div>

      {status === "error" && <p className="sl-error">{error} <button className="ob-link" onClick={() => setCoords({ ...coords })}>Tentar de novo</button></p>}

      {shown.length > 0 && <Radar places={shown} radius={radius} center={coords} selected={selected} onPick={pick} />}

      {status === "ready" && !shown.length && <div className="sl-empty"><b>{openOnly ? "Nada aberto agora nesse raio" : `Não achei ${NEARBY_KINDS[kind].plural.toLowerCase()} nesse raio`}</b><p>{radius < 5000 ? "Tente aumentar a distância." : openOnly ? "Tire o filtro “Aberto agora” para ver todos." : "Os dados vêm do OpenStreetMap e podem não ter todos os lugares da sua região."}</p></div>}

      {shown.length > 0 && <ul className="np-list">
        {shown.map((p, i) => { const links = directionsLinks(p); return <li key={p.id} ref={el => { cardRefs.current[p.id] = el; }} className={selected === p.id ? "sel" : ""} onClick={() => setSelected(p.id)}>
          <div className="np-num" aria-hidden>{i + 1}</div>
          <div className="np-info">
            <b>{p.name}{p.rating && p.rating.count >= 3 && (p.rating.avg ?? 0) >= 4.5 && <em className="np-top">⭐ Recomendado</em>}</b>
            <span>{[p.cuisine || p.type, formatDistance(p.distance), travelHint(p.distance)].join(" · ")}</span>
            {p.address && <small>{p.address}</small>}
            <button className="np-stars" onClick={e => { e.stopPropagation(); setReview(p); }} aria-label={`Avaliar ${p.name}`}>
              {p.rating?.count ? <><span className="on">{stars(p.rating.avg || 0)}</span> {nf(p.rating.avg || 0)} <small>({p.rating.count})</small></> : <span>☆☆☆☆☆ <small>Seja o primeiro a avaliar</small></span>}
              {p.rating?.mine ? <small className="mine"> · sua nota {p.rating.mine}★</small> : <small className="cta"> · Avaliar</small>}
            </button>
            {p.rating?.recent?.[0] && <q className="np-quote">“{p.rating.recent[0].comment}” <small>— {p.rating.recent[0].name}</small></q>}
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

      {review && uid && <ReviewSheet place={review} rating={ratings[refOf(review)]} uid={uid} onClose={() => setReview(null)} onSaved={m => { setReview(null); setReload(x => x + 1); flash(m); }} />}
      {adding && uid && <AddPlaceSheet kind={kind} coords={coords} uid={uid} onClose={() => setAdding(false)} onSaved={m => { setAdding(false); setReload(x => x + 1); flash(m); }} />}
      {toast && <div className="sl-toast" role="status">{toast}</div>}

      <p className="np-credit">Lugares: © colaboradores do <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>. Lugares marcados “Indicado por usuário” e avaliações são da comunidade VIVA+. Horários e endereços podem estar desatualizados.</p>
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

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="vc-sheet-layer" role="dialog" aria-modal="true" aria-label={title}><button className="vc-sheet-backdrop" aria-label="Fechar" onClick={onClose} /><div className="vc-sheet sl-sheet"><div className="md-head"><h2>{title}</h2><button className="ob-link" onClick={onClose}>Fechar</button></div>{children}</div></div>;
}

function ReviewSheet({ place, rating, uid, onClose, onSaved }: { place: Place; rating?: Rating; uid: string; onClose: () => void; onSaved: (msg: string) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [value, setValue] = useState(rating?.mine || 0);
  const [comment, setComment] = useState(rating?.myComment || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ref = refOf(place);
  const save = async () => {
    if (!value) { setErr("Escolha de 1 a 5 estrelas."); return; }
    setBusy(true); setErr("");
    const { error } = await supabase.from("viva_place_reviews").upsert({ place_ref: ref, user_id: uid, rating: value, comment: comment.trim() || null, place_name: place.name.slice(0, 80) }, { onConflict: "place_ref,user_id" });
    setBusy(false);
    if (error) { setErr("Não consegui salvar sua avaliação. Tente de novo."); return; }
    onSaved("Obrigado! Sua avaliação ajuda outras pessoas.");
  };
  const remove = async () => {
    setBusy(true);
    const { error } = await supabase.from("viva_place_reviews").delete().eq("place_ref", ref).eq("user_id", uid);
    setBusy(false);
    if (error) { setErr("Não consegui remover agora."); return; } onSaved("Avaliação removida.");
  };
  const LABELS = ["", "Ruim", "Fraco", "Ok", "Bom", "Excelente"];
  return <Sheet title={`Avaliar ${place.name}`} onClose={onClose}>
    <div className="vh-form">
      {rating?.count ? <p>Nota da comunidade: <b>{nf(rating.avg || 0)} ★</b> em {rating.count} {rating.count === 1 ? "avaliação" : "avaliações"}.</p> : <p>Ninguém avaliou ainda. Sua nota ajuda quem é novo por aqui.</p>}
      <div className="np-rate" role="radiogroup" aria-label="Sua nota">
        {[1, 2, 3, 4, 5].map(n => <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`} className={n <= value ? "on" : ""} onClick={() => setValue(n)}>★</button>)}
        <span>{LABELS[value] || "Toque nas estrelas"}</span>
      </div>
      <label>Comentário (opcional)<textarea value={comment} maxLength={280} rows={3} placeholder="Ex.: preço bom, atendimento rápido, estacionamento fácil" onChange={e => setComment(e.target.value)} /></label>
      <small className="vc-muted">Aparece só o seu primeiro nome. {280 - comment.length} caracteres.</small>
      {rating?.recent?.length ? <div className="np-recent">{rating.recent.map((r, i) => <p key={i}><b>{"★".repeat(r.rating)}</b> “{r.comment}” <small>— {r.name}</small></p>)}</div> : null}
      {err && <p className="sl-error">{err}</p>}
      <button className="vh-cta" disabled={busy} onClick={save}>{busy ? "Salvando…" : rating?.mine ? "Atualizar avaliação" : "Enviar avaliação"}</button>
      {rating?.mine ? <button className="md-danger" disabled={busy} onClick={remove}>Remover minha avaliação</button> : null}
    </div>
  </Sheet>;
}

function AddPlaceSheet({ kind, coords, uid, onClose, onSaved }: { kind: NearbyKind; coords: Coords; uid: string; onClose: () => void; onSaved: (msg: string) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [v, setV] = useState({ kind, name: "", address: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    const name = v.name.trim();
    if (name.length < 2) { setErr("Escreva o nome do lugar."); return; }
    setBusy(true); setErr("");
    const { error } = await supabase.from("viva_places").insert({ created_by: uid, kind: v.kind, name: name.slice(0, 80), address: v.address.trim().slice(0, 160) || null, phone: v.phone.trim().slice(0, 30) || null, lat: coords.lat, lon: coords.lon });
    setBusy(false);
    if (error) {
      setErr(/place_duplicate/.test(error.message) ? "Esse lugar já está no mapa." : /places_daily_limit/.test(error.message) ? "Você já adicionou 10 lugares hoje. Tente amanhã." : "Não consegui salvar. Tente de novo.");
      return;
    }
    onSaved("Lugar adicionado! Agora outras pessoas também podem ver e avaliar.");
  };
  return <Sheet title="Adicionar um lugar" onClose={onClose}>
    <div className="vh-form">
      <p>Use quando você <b>estiver no lugar</b>: ele fica marcado na sua localização atual e aparece para quem estiver por perto.</p>
      <div className="vh-pick">{KINDS.map(k => <button key={k} type="button" className={v.kind === k ? "sel" : ""} onClick={() => setV({ ...v, kind: k })}>{NEARBY_KINDS[k].emoji} {NEARBY_KINDS[k].label}</button>)}</div>
      <label>Nome do lugar<input value={v.name} maxLength={80} placeholder="Ex.: Mercadinho do Zé" onChange={e => setV({ ...v, name: e.target.value })} autoFocus /></label>
      <label>Endereço (opcional)<input value={v.address} maxLength={160} placeholder="Ex.: Rua das Flores, 120" onChange={e => setV({ ...v, address: e.target.value })} /></label>
      <label>Telefone (opcional)<input value={v.phone} maxLength={30} inputMode="tel" placeholder="Ex.: (11) 99999-0000" onChange={e => setV({ ...v, phone: e.target.value })} /></label>
      {err && <p className="sl-error">{err}</p>}
      <button className="vh-cta" disabled={busy} onClick={save}>{busy ? "Salvando…" : "Adicionar no mapa"}</button>
    </div>
  </Sheet>;
}
