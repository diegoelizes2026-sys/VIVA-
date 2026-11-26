"use client";
import { useState } from "react";
import { Dumbbell, Home, LocateFixed, MapPin, Monitor, Trees } from "lucide-react";

export type PartnerLocationData = { gym_name: string | null; neighborhood: string | null; service_lat: number | null; modes: string[] | null; home_radius_km: number | null };
type Gym = { id: string; name: string; lat: number; lon: number; distance: number; address: string | null };

export const MODES: { id: "academia" | "domicilio" | "online" | "ar_livre"; label: string; icon: typeof Home }[] = [
  { id: "academia", label: "Na academia", icon: Dumbbell },
  { id: "domicilio", label: "A domicílio", icon: Home },
  { id: "online", label: "Online", icon: Monitor },
  { id: "ar_livre", label: "Ao ar livre", icon: Trees },
];
const RADII = [3, 5, 10, 15, 20, 30];
const km = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`);

/** Personal parceiro: marca onde e como atende para aparecer no Radar de Personais. */
export default function PartnerLocation({ data, onSaved }: { data: PartnerLocationData; onSaved: () => void }) {
  const placed = data.service_lat != null || (data.modes || []).join() === "online";
  const [editing, setEditing] = useState(!placed);
  const [modes, setModes] = useState<string[]>(data.modes?.length ? data.modes : ["academia"]);
  const [radius, setRadius] = useState(data.home_radius_km || 5);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [gyms, setGyms] = useState<Gym[] | null>(null);
  const [gym, setGym] = useState<Gym | null>(null);
  const [manual, setManual] = useState(false);
  const [place, setPlace] = useState({ gym: data.gym_name || "", hood: data.neighborhood || "" });
  const [busy, setBusy] = useState(""); const [err, setErr] = useState(""); const [ok, setOk] = useState("");
  const onlineOnly = modes.length === 1 && modes[0] === "online";
  const keepOld = placed && !coords && !gym; // salvar sem remarcar mantém o ponto atual

  function toggle(id: string) { setModes(c => c.includes(id) ? (c.length > 1 ? c.filter(x => x !== id) : c) : [...c, id]); }
  function locate(then?: (c: { lat: number; lon: number }) => void) {
    if (!("geolocation" in navigator)) { setErr("Seu aparelho não informa a localização."); return; }
    setBusy("locating"); setErr("");
    navigator.geolocation.getCurrentPosition(p => { const c = { lat: p.coords.latitude, lon: p.coords.longitude }; setCoords(c); setBusy(""); then?.(c); },
      e => { setBusy(""); setErr(e.code === e.PERMISSION_DENIED ? "Permita a localização no navegador para marcar seu local." : "Não consegui achar sua localização. Ligue o GPS e tente de novo."); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }
  function findGyms() {
    locate(async c => {
      setBusy("gyms"); setGyms(null); setManual(false);
      try {
        const r = await fetch(`/api/nearby?lat=${c.lat}&lon=${c.lon}&type=academia&radius=2000`);
        const d = await r.json().catch(() => ({}));
        setGyms(r.ok ? (d.places || []).slice(0, 15) : []);
        if (!r.ok) setErr(d.error || "Não consegui buscar academias agora. Use “Atendo em outro lugar”.");
      } catch { setGyms([]); setErr("Sem conexão. Tente de novo."); }
      finally { setBusy(""); }
    });
  }
  async function save() {
    setErr(""); setOk("");
    let body: Record<string, unknown> = { modes, home_radius_km: modes.includes("domicilio") ? radius : null };
    if (onlineOnly) body = { ...body, lat: null, lon: null, gym_name: "", neighborhood: place.hood, precise: false };
    else if (gym) body = { ...body, lat: gym.lat, lon: gym.lon, gym_name: gym.name.slice(0, 80), neighborhood: place.hood, precise: true };
    else if (manual && coords) {
      if (place.hood.trim().length < 2) { setErr("Digite o bairro onde você atende."); return; }
      body = { ...body, lat: coords.lat, lon: coords.lon, gym_name: place.gym, neighborhood: place.hood, precise: false };
    } else if (keepOld) body = { ...body, keep: true };
    else { setErr("Marque a academia ou o bairro onde você atende."); return; }
    setBusy("saving");
    try {
      let r: Response;
      if (body.keep) {
        // Só mudou o jeito de atender: reenvia o ponto atual sem precisar de GPS.
        r = await fetch("/api/partners/location", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modes, home_radius_km: body.home_radius_km }) });
      } else r = await fetch("/api/partners/location", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || "Não consegui salvar."); return; }
      setOk("Pronto! Você já aparece no Radar de Personais. ✅"); setEditing(false); setGyms(null); setGym(null); setManual(false); onSaved();
    } catch { setErr("Sem conexão. Tente de novo."); }
    finally { setBusy(""); }
  }

  const summary = <div className="pl-summary">
    <MapPin aria-hidden />
    <div>
      <b>{(data.modes || []).join() === "online" ? "Atendimento online" : [data.gym_name, data.neighborhood].filter(Boolean).join(" · ") || "Local marcado"}</b>
      <span>{(data.modes || []).map(m => MODES.find(x => x.id === m)?.label).filter(Boolean).join(" · ")}{data.home_radius_km ? ` · vai até ${data.home_radius_km} km` : ""}</span>
    </div>
  </div>;

  return <section className="pl-card">
    <h3>📍 Onde você atende</h3>
    {!editing ? <>
      {summary}
      {ok && <p className="pl-ok">{ok}</p>}
      <button type="button" className="pa-ghost" onClick={() => { setEditing(true); setOk(""); }}>Alterar local e atendimento</button>
    </> : <>
      <p className="pa-muted">{placed ? "Atualize como e onde você atende." : "Marque onde você atende para aparecer no Radar de Personais, com a distância até cada aluno."}</p>
      <b className="pl-label">Como você atende?</b>
      <div className="pl-modes">{MODES.map(m => { const I = m.icon; return <button type="button" key={m.id} className={modes.includes(m.id) ? "sel" : ""} onClick={() => toggle(m.id)} aria-pressed={modes.includes(m.id)}><I aria-hidden />{m.label}</button>; })}</div>
      {modes.includes("domicilio") && <><b className="pl-label">Até quantos km você vai até o aluno?</b>
        <div className="pl-radii">{RADII.map(r => <button type="button" key={r} className={r === radius ? "sel" : ""} onClick={() => setRadius(r)}>{r} km</button>)}</div></>}

      {!onlineOnly && <>
        <b className="pl-label">Onde fica?</b>
        {keepOld && !gyms && !manual && <div className="pl-keep">{summary}<small>Para trocar o local, use os botões abaixo.</small></div>}
        {gym ? <div className="pl-picked"><Dumbbell aria-hidden /><div><b>{gym.name}</b><small>{gym.address || "Academia selecionada"}</small></div><button type="button" onClick={() => setGym(null)}>Trocar</button></div> : <>
          <button type="button" className="pa-btn pl-btn" onClick={findGyms} disabled={Boolean(busy)}><LocateFixed aria-hidden />{busy === "locating" || busy === "gyms" ? "Procurando academias…" : "Achar minha academia (estou nela ou perto)"}</button>
          {gyms && (gyms.length ? <ul className="pl-gyms">{gyms.map(g => <li key={g.id}><button type="button" onClick={() => { setGym(g); setGyms(null); }}><b>{g.name}</b><small>{km(g.distance)}{g.address ? " · " + g.address : ""}</small></button></li>)}</ul>
            : <p className="pa-muted">Nenhuma academia encontrada por perto.</p>)}
          <button type="button" className="pa-ghost" onClick={() => { setManual(true); setGyms(null); if (!coords) locate(); }}>Atendo em outro lugar (estúdio, condomínio, praça…)</button>
          {manual && <div className="pl-manual">
            <label>Bairro<input maxLength={60} value={place.hood} onChange={e => setPlace({ ...place, hood: e.target.value })} placeholder="Ex.: Aldeota" /></label>
            <label>Nome do local (opcional)<input maxLength={80} value={place.gym} onChange={e => setPlace({ ...place, gym: e.target.value })} placeholder="Ex.: Estúdio Corpo em Movimento" /></label>
            <small className="pa-muted">{coords ? "📍 Usamos sua localização aproximada (cerca de 1 km). Seu endereço nunca aparece." : busy === "locating" ? "Pegando sua localização…" : "Permita a localização para marcar o bairro."}</small>
          </div>}
        </>}
        {gym && <label className="pl-hood">Bairro (opcional)<input maxLength={60} value={place.hood} onChange={e => setPlace({ ...place, hood: e.target.value })} placeholder="Ex.: Aldeota" /></label>}
      </>}
      {onlineOnly && <label className="pl-hood">Cidade/bairro de referência (opcional)<input maxLength={60} value={place.hood} onChange={e => setPlace({ ...place, hood: e.target.value })} placeholder="Ex.: Fortaleza" /></label>}
      {err && <p className="pa-error" role="alert">{err}</p>}
      <button type="button" className="pa-btn" onClick={save} disabled={busy === "saving"}>{busy === "saving" ? "Salvando…" : "Salvar e aparecer no radar"}</button>
      {placed && <button type="button" className="pa-ghost" onClick={() => { setEditing(false); setErr(""); }}>Cancelar</button>}
      <p className="pa-muted pl-privacy">🔒 Os alunos veem só a distância, a academia e o bairro. Nunca o seu endereço.</p>
    </>}
  </section>;
}
