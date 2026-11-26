"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Clock3, Dumbbell, Gift, Instagram, LocateFixed, MapPin, MessageCircle, Navigation, Radar, Users } from "lucide-react";
import { MODALITIES, brlFromCents, modalityLabel } from "@/lib/gyms";
import { MODES } from "@/components/partner-location";
import CredentialSeal from "@/components/credential-seal";

type Partner = { display_name: string; cref: string; city: string; state: string; instagram: string | null; whatsapp: string | null; photo_url: string | null; bio: string | null; reviewer: boolean; credentialed_at?: string | null;
  gym_name?: string | null; neighborhood?: string | null; modes?: string[] | null; home_radius_km?: number | null; distance_km?: number | null; comes_to_you?: boolean; online_only?: boolean; same_city?: boolean };
type Gym = { name: string; city: string; state: string; neighborhood: string | null; address: string | null; lat: number; lon: number; modalities: string[]; price_from_cents: number | null; hours: string | null;
  whatsapp: string | null; instagram: string | null; photo_url: string | null; bio: string | null; perk: string | null; credentialed_at: string | null; distance_km: number; personal_count: number };
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
  const [tab, setTab] = useState<"personais" | "academias">("personais");
  const [modality, setModality] = useState("");
  const [gyms, setGyms] = useState<Gym[]>([]);
  useEffect(() => { try { if (new URLSearchParams(window.location.search).get("aba") === "academias") setTab("academias"); } catch { } }, []);

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
    const url = tab === "personais"
      ? `/api/partners/radar?lat=${coords.lat}&lon=${coords.lon}&radius=${radius}${mode ? "&mode=" + mode : ""}`
      : `/api/gyms/radar?lat=${coords.lat}&lon=${coords.lon}&radius=${radius}${modality ? "&modality=" + modality : ""}`;
    fetch(url, { signal: ctrl.signal })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || "Não consegui buscar agora."); if (tab === "personais") setList(d.partners || []); else setGyms(d.gyms || []); setStatus("ready"); })
      .catch(e => { if (ctrl.signal.aborted) return; setStatus("error"); setError(e.message); });
    return () => ctrl.abort();
  }, [coords, radius, mode, modality, tab]);
  const pros = tab === "personais";

  const near = list.filter(p => !p.online_only);
  const online = list.filter(p => p.online_only);

  return <div className="pr">
    <header className="pr-head">
      <span className="pr-icon"><Radar aria-hidden /></span>
      <div><h1>Radar Fitness VIVA+</h1><p>Só personais e academias <b>credenciados VIVA+</b>: CREF e CNPJ conferidos pela nossa equipe.</p></div>
    </header>
    <nav className="pr-tabs" role="tablist" aria-label="O que procurar">
      <button type="button" role="tab" aria-selected={pros} className={pros ? "sel" : ""} onClick={() => setTab("personais")}><Users aria-hidden />Personais</button>
      <button type="button" role="tab" aria-selected={!pros} className={!pros ? "sel" : ""} onClick={() => setTab("academias")}><Dumbbell aria-hidden />Academias</button>
    </nav>

    {!coords ? <section className="pr-locate">
      <MapPin aria-hidden />
      <b>{pros ? "Ver personais perto de você" : "Ver academias perto de você"}</b>
      <p>Usamos sua localização só para calcular a distância. Ela não é guardada.</p>
      <button type="button" className="pr-btn" onClick={locate} disabled={status === "locating"}><LocateFixed aria-hidden />{status === "locating" ? "Localizando…" : "Usar minha localização"}</button>
      {status === "denied" && <p className="pr-warn">A localização está bloqueada. Libere nas configurações do navegador, {pros ? "ou veja abaixo os personais da sua cidade." : "para ver as academias por distância."}</p>}
      {status === "error" && <p className="pr-warn">{error}</p>}
    </section> : <>
      <div className="pr-filters">
        <div className="pr-chips" role="group" aria-label="Distância">{RADII.map(r => <button key={r} type="button" className={r === radius ? "sel" : ""} onClick={() => setRadius(r)}>{r} km</button>)}</div>
        {pros ? <div className="pr-chips" role="group" aria-label="Tipo de atendimento">
          <button type="button" className={!mode ? "sel" : ""} onClick={() => setMode("")}>Todos</button>
          {MODES.map(m => <button key={m.id} type="button" className={mode === m.id ? "sel" : ""} onClick={() => setMode(m.id)}>{m.label}</button>)}
        </div> : <div className="pr-chips" role="group" aria-label="Modalidade">
          <button type="button" className={!modality ? "sel" : ""} onClick={() => setModality("")}>Todas</button>
          {MODALITIES.map(([id, l]) => <button key={id} type="button" className={modality === id ? "sel" : ""} onClick={() => setModality(id)}>{l}</button>)}
        </div>}
      </div>
      {status === "loading" && <p className="pr-muted">{pros ? "Procurando personais…" : "Procurando academias…"}</p>}
      {status === "error" && <p className="pr-warn">{error}</p>}
      {status === "ready" && !pros && <>
        <h2 className="pr-sub">{gyms.length ? `${gyms.length} ${gyms.length === 1 ? "academia credenciada" : "academias credenciadas"} até ${radius} km` : `Nenhuma academia credenciada até ${radius} km`}</h2>
        {!gyms.length && <p className="pr-muted">{radius < 50 ? <>Tente aumentar a distância ou veja todas as academias do mapa em <Link href="/perto?tipo=academia">Perto de mim</Link>. </> : null}Indique sua academia para entrar na VIVA+!</p>}
        <div className="pr-list">{gyms.map(g => <GymCard key={g.name + g.lat} g={g} />)}</div>
      </>}
      {status === "ready" && pros && <>
        <h2 className="pr-sub">{near.length ? `${near.length} ${near.length === 1 ? "personal" : "personais"} até ${radius} km` : `Nenhum personal até ${radius} km`}</h2>
        {!near.length && <p className="pr-muted">{radius < 50 ? <>Tente aumentar a distância. </> : null}A rede está crescendo: indique seu personal para entrar na VIVA+!</p>}
        <div className="pr-list">{near.map(p => <Card key={p.cref} p={p} />)}</div>
        {online.length > 0 && mode !== "academia" && mode !== "domicilio" && mode !== "ar_livre" && <><h2 className="pr-sub">💻 Atendem online, de qualquer lugar</h2><div className="pr-list">{online.map(p => <Card key={p.cref} p={p} />)}</div></>}
      </>}
    </>}

    {pros && !coords && city && city.length > 0 && <><h2 className="pr-sub">Personais parceiros {city.some(p => p.same_city) ? `em ${city.find(p => p.same_city)!.city}` : "da VIVA+"}</h2>
      <div className="pr-list">{city.map(p => <Card key={p.cref} p={p} />)}</div></>}

    {pros ? <Link href="/parceiros" className="pr-join">É personal? <b>Apareça no radar de graça →</b></Link>
      : <Link href="/academias" className="pr-join">Tem academia? <b>Cadastre e apareça no radar de graça →</b></Link>}
    <p className="pr-note">A VIVA+ apresenta {pros ? "os profissionais" : "as academias"}, mas não presta o serviço. Combine valores e condições direto com {pros ? "o personal" : "a academia"}.</p>
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

function GymCard({ g }: { g: Gym }) {
  const wa = g.whatsapp ? `https://wa.me/${g.whatsapp}?text=${encodeURIComponent(`Olá! Achei a ${g.name} no Radar da VIVA+ e quero saber sobre planos e horários.`)}` : null;
  const maps = `https://www.google.com/maps/dir/?api=1&destination=${g.lat},${g.lon}`;
  return <article className="pr-card pr-gym">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {g.photo_url ? <img className="pr-cover" src={g.photo_url} alt="" /> : <span className="pr-cover pr-cover-ph"><Dumbbell aria-hidden /></span>}
    <div className="pr-info">
      <div className="pr-top"><b>{g.name}</b><span className="pr-dist">{fmtKm(g.distance_km)}</span></div>
      <div className="pr-seal"><CredentialSeal kind="gym" credentialedAt={g.credentialed_at} /></div>
      <span className="pr-where"><MapPin aria-hidden />{[g.address, g.neighborhood].filter(Boolean).join(" · ") || `${g.city}/${g.state}`}</span>
      <div className="pr-tags">{g.modalities.map(m => <i key={m}>{modalityLabel(m)}</i>)}</div>
      <div className="pr-facts">
        {g.price_from_cents ? <span>a partir de <b>{brlFromCents(g.price_from_cents)}</b>/mês</span> : null}
        {g.hours ? <span><Clock3 aria-hidden />{g.hours}</span> : null}
        {g.personal_count > 0 ? <span><Users aria-hidden />{g.personal_count} {g.personal_count === 1 ? "personal credenciado atende" : "personais credenciados atendem"} aqui</span> : null}
      </div>
      {g.perk && <p className="pr-perk"><Gift aria-hidden />{g.perk}</p>}
      {g.bio && <p>{g.bio}</p>}
      <div className="pr-btns">
        {wa && <a className="pr-wa" href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden />WhatsApp</a>}
        <a className="pr-ig" href={maps} target="_blank" rel="noopener noreferrer"><Navigation aria-hidden />Como chegar</a>
        {g.instagram && <a className="pr-ig" href={`https://instagram.com/${g.instagram}`} target="_blank" rel="noopener noreferrer"><Instagram aria-hidden />Instagram</a>}
      </div>
    </div>
  </article>;
}
