"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Instagram, LocateFixed, MapPin, MessageCircle, Radar } from "lucide-react";
import { MODES } from "@/components/partner-location";
import CredentialSeal from "@/components/credential-seal";

type Partner = { display_name: string; cref: string; city: string; state: string; instagram: string | null; whatsapp: string | null; photo_url: string | null; bio: string | null; reviewer: boolean; credentialed_at?: string | null;
  gym_name?: string | null; neighborhood?: string | null; modes?: string[] | null; home_radius_km?: number | null; distance_km?: number | null; comes_to_you?: boolean; online_only?: boolean; same_city?: boolean };
type Status = "idle" | "locating" | "loading" | "ready" | "denied" | "error";
const RADII = [2, 5, 10, 20, 50];
const CONSENT_KEY = "viva-nearby-location-ok";
const readConsent = () => { try { return localStorage.getItem(CONSENT_KEY) === "1"; } catch { return false; } };
const saveConsent = () => { try { localStorage.setItem(CONSENT_KEY, "1"); } catch { /* navegação privada */ } };
const fmtKm = (k: number) => (k < 1 ? "menos de 1 km" : `${k.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`);
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();

/** Radar de Personais: parceiros aprovados perto de quem busca, com distância, academia e jeito de atender. */
export default function PartnerRadar() {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [radius, setRadius] = useState(10);
  const [mode, setMode] = useState<string>("");
  const [list, setList] = useState<Partner[]>([]);
  const [city, setCity] = useState<Partner[] | null>(null);

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) { setStatus("error"); setError("Seu aparelho não informa a localização."); return; }
    setStatus("locating"); setError("");
    navigator.geolocation.getCurrentPosition(p => { saveConsent(); setCoords({ lat: p.coords.latitude, lon: p.coords.longitude }); },
      e => { if (e.code === e.PERMISSION_DENIED) setStatus("denied"); else { setStatus("error"); setError("Não consegui achar sua localização. Ligue o GPS e tente de novo."); } },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
  }, []);
  useEffect(() => { if (readConsent()) locate(); }, [locate]);
  // Sem localização: mostra os parceiros da cidade cadastrada no perfil.
  useEffect(() => { fetch("/api/partners/directory").then(r => (r.ok ? r.json() : null)).then(d => setCity(d?.partners || [])).catch(() => setCity([])); }, []);

  useEffect(() => {
    if (!coords) return;
    const ctrl = new AbortController();
    setStatus("loading");
    fetch(`/api/partners/radar?lat=${coords.lat}&lon=${coords.lon}&radius=${radius}${mode ? "&mode=" + mode : ""}`, { signal: ctrl.signal })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || "Não consegui buscar agora."); setList(d.partners || []); setStatus("ready"); })
      .catch(e => { if (ctrl.signal.aborted) return; setStatus("error"); setError(e.message); });
    return () => ctrl.abort();
  }, [coords, radius, mode]);

  const near = list.filter(p => !p.online_only);
  const online = list.filter(p => p.online_only);

  return <div className="pr">
    <header className="pr-head">
      <span className="pr-icon"><Radar aria-hidden /></span>
      <div><h1>Radar de Personais</h1><p>Só profissionais <b>credenciados VIVA+</b>: CREF conferido pela nossa equipe.</p></div>
    </header>

    {!coords ? <section className="pr-locate">
      <MapPin aria-hidden />
      <b>Ver personais perto de você</b>
      <p>Usamos sua localização só para calcular a distância. Ela não é guardada.</p>
      <button type="button" className="pr-btn" onClick={locate} disabled={status === "locating"}><LocateFixed aria-hidden />{status === "locating" ? "Localizando…" : "Usar minha localização"}</button>
      {status === "denied" && <p className="pr-warn">A localização está bloqueada. Libere nas configurações do navegador, ou veja abaixo os personais da sua cidade.</p>}
      {status === "error" && <p className="pr-warn">{error}</p>}
    </section> : <>
      <div className="pr-filters">
        <div className="pr-chips" role="group" aria-label="Distância">{RADII.map(r => <button key={r} type="button" className={r === radius ? "sel" : ""} onClick={() => setRadius(r)}>{r} km</button>)}</div>
        <div className="pr-chips" role="group" aria-label="Tipo de atendimento">
          <button type="button" className={!mode ? "sel" : ""} onClick={() => setMode("")}>Todos</button>
          {MODES.map(m => <button key={m.id} type="button" className={mode === m.id ? "sel" : ""} onClick={() => setMode(m.id)}>{m.label}</button>)}
        </div>
      </div>
      {status === "loading" && <p className="pr-muted">Procurando personais…</p>}
      {status === "error" && <p className="pr-warn">{error}</p>}
      {status === "ready" && <>
        <h2 className="pr-sub">{near.length ? `${near.length} ${near.length === 1 ? "personal" : "personais"} até ${radius} km` : `Nenhum personal até ${radius} km`}</h2>
        {!near.length && <p className="pr-muted">{radius < 50 ? <>Tente aumentar a distância. </> : null}A rede está crescendo: indique seu personal para entrar na VIVA+!</p>}
        <div className="pr-list">{near.map(p => <Card key={p.cref} p={p} />)}</div>
        {online.length > 0 && mode !== "academia" && mode !== "domicilio" && mode !== "ar_livre" && <><h2 className="pr-sub">💻 Atendem online, de qualquer lugar</h2><div className="pr-list">{online.map(p => <Card key={p.cref} p={p} />)}</div></>}
      </>}
    </>}

    {!coords && city && city.length > 0 && <><h2 className="pr-sub">Personais parceiros {city.some(p => p.same_city) ? `em ${city.find(p => p.same_city)!.city}` : "da VIVA+"}</h2>
      <div className="pr-list">{city.map(p => <Card key={p.cref} p={p} />)}</div></>}

    <Link href="/parceiros" className="pr-join">É personal? <b>Apareça no radar de graça →</b></Link>
    <p className="pr-note">A VIVA+ apresenta os profissionais, mas não presta o serviço de treino. Combine valores e condições direto com o personal.</p>
  </div>;
}

function Card({ p }: { p: Partner }) {
  const first = p.display_name.split(" ")[0];
  const wa = p.whatsapp ? `https://wa.me/${p.whatsapp}?text=${encodeURIComponent(`Oi, ${first}! Te achei no Radar de Personais da VIVA+ e quero saber sobre seu atendimento.`)}` : null;
  const where = [p.gym_name, p.neighborhood].filter(Boolean).join(" · ") || `${p.city}/${p.state}`;
  return <article className="pr-card">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {p.photo_url ? <img className="pr-avatar" src={p.photo_url} alt="" width={64} height={64} /> : <span className="pr-avatar pr-ini">{initials(p.display_name)}</span>}
    <div className="pr-info">
      <div className="pr-top"><b>{p.display_name}</b>{p.distance_km != null && !p.online_only && <span className="pr-dist">{fmtKm(p.distance_km)}</span>}</div>
      <div className="pr-seal"><CredentialSeal credentialedAt={p.credentialed_at} cref={p.cref} /><small>CREF {p.cref}{p.reviewer ? " · revisa os treinos da VIVA" : ""}</small></div>
      <span className="pr-where"><MapPin aria-hidden />{where}</span>
      {p.modes?.length ? <div className="pr-tags">{p.modes.map(m => <i key={m}>{MODES.find(x => x.id === m)?.label}{m === "domicilio" && p.home_radius_km ? ` (até ${p.home_radius_km} km)` : ""}</i>)}{p.comes_to_you && <i className="go">Vai até você</i>}</div> : null}
      {p.bio && <p>{p.bio}</p>}
      <div className="pr-btns">
        {wa && <a className="pr-wa" href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden />Chamar no WhatsApp</a>}
        {p.instagram && <a className="pr-ig" href={`https://instagram.com/${p.instagram}`} target="_blank" rel="noopener noreferrer"><Instagram aria-hidden />Instagram</a>}
      </div>
    </div>
  </article>;
}
