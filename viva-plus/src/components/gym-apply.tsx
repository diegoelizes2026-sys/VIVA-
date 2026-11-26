"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Camera, CheckCircle2, Clock3, LocateFixed, MapPin } from "lucide-react";
import CredentialSeal from "@/components/credential-seal";
import { MODALITIES, brlFromCents, formatCnpj, validCnpj } from "@/lib/gyms";

type Gym = { name: string; cnpj: string; city: string; state: string; neighborhood: string | null; address: string | null; lat: number; lon: number; modalities: string[]; price_from_cents: number | null; hours: string | null;
  whatsapp: string | null; instagram: string | null; photo_url: string | null; bio: string | null; perk: string | null; status: "pending" | "approved" | "rejected"; admin_note: string | null; approved_at: string | null };
type Osm = { id: string; name: string; lat: number; lon: number; distance: number; address: string | null };
const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const EMPTY = { name: "", cnpj: "", city: "", state: "CE", neighborhood: "", address: "", price_from: "", hours: "", whatsapp: "", instagram: "", bio: "", perk: "" };

async function shrink(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas"); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error("foto"))), "image/jpeg", 0.85));
  return new File([blob], "academia.jpg", { type: "image/jpeg" });
}

/** Cadastro da academia pelo dono (pessoa logada). */
export default function GymApply() {
  const [loading, setLoading] = useState(true);
  const [gym, setGym] = useState<Gym | null>(null);
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [mods, setMods] = useState<string[]>(["musculacao"]);
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(null);
  const [osm, setOsm] = useState<Osm[] | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(""); const [err, setErr] = useState("");

  const load = () => fetch("/api/gyms/apply", { cache: "no-store" }).then(r => r.json()).then(d => {
    const g = d.gym as Gym | null; setGym(g);
    if (g) {
      setF({ name: g.name, cnpj: formatCnpj(g.cnpj), city: g.city, state: g.state, neighborhood: g.neighborhood || "", address: g.address || "", price_from: g.price_from_cents ? String(g.price_from_cents / 100).replace(".", ",") : "", hours: g.hours || "", whatsapp: g.whatsapp ? g.whatsapp.replace(/^55/, "") : "", instagram: g.instagram ? "@" + g.instagram : "", bio: g.bio || "", perk: g.perk || "" });
      setMods(g.modalities); setPoint({ lat: g.lat, lon: g.lon }); if (g.photo_url) setPreview(g.photo_url);
    }
  }).catch(() => null).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  function locate() {
    if (!("geolocation" in navigator)) { setErr("Seu aparelho não informa a localização."); return; }
    setBusy("locating"); setErr(""); setOsm(null);
    navigator.geolocation.getCurrentPosition(async p => {
      const c = { lat: p.coords.latitude, lon: p.coords.longitude }; setPoint(c);
      setBusy("osm");
      try { const r = await fetch(`/api/nearby?lat=${c.lat}&lon=${c.lon}&type=academia&radius=500`); const d = await r.json().catch(() => ({})); setOsm(r.ok ? (d.places || []).slice(0, 6) : []); }
      catch { setOsm([]); } finally { setBusy(""); }
    }, e => { setBusy(""); setErr(e.code === e.PERMISSION_DENIED ? "Permita a localização no navegador para marcar a academia." : "Não consegui achar sua localização. Ligue o GPS e tente de novo."); },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  }
  function pickOsm(o: Osm) { setPoint({ lat: o.lat, lon: o.lon }); setF(c => ({ ...c, name: c.name || o.name, address: c.address || o.address || "" })); setOsm(null); }
  async function pick(file: File | null) { if (!file) return; try { const s = await shrink(file); setPhoto(s); setPreview(URL.createObjectURL(s)); } catch { setErr("Não consegui ler essa foto. Tente outra."); } }
  const toggle = (id: string) => setMods(c => c.includes(id) ? (c.length > 1 ? c.filter(x => x !== id) : c) : [...c, id]);

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr("");
    if (!validCnpj(f.cnpj)) { setErr("CNPJ inválido. Confira os números."); return; }
    if (!point) { setErr("Marque a localização da academia (toque em “Estou na academia agora”)."); return; }
    if (!consent) { setErr("Marque a autorização para mostrarmos a academia no app."); return; }
    setBusy("saving");
    const body = new FormData();
    Object.entries(f).forEach(([k, v]) => body.append(k, v));
    body.append("lat", String(point.lat)); body.append("lon", String(point.lon)); body.append("modalities", mods.join(",")); body.append("consent", "true");
    if (photo) body.append("photo", photo);
    const r = await fetch("/api/gyms/apply", { method: "POST", body });
    const j = await r.json().catch(() => ({})); setBusy("");
    if (!r.ok) { setErr(j.error || "Não consegui enviar."); return; }
    setEditing(false); setPhoto(null); await load();
  }

  if (loading) return <p className="pa-muted">Carregando…</p>;

  if (gym && !editing) return <section className="pa-status">
    {gym.status === "approved" ? <>
      <CheckCircle2 className="pa-ic ok" aria-hidden />
      <h2>{gym.name} está no Radar VIVA+</h2>
      <CredentialSeal size="lg" kind="gym" credentialedAt={gym.approved_at} />
      <p>Sua academia aparece para quem procura academias perto de <b>{gym.neighborhood ? gym.neighborhood + ", " : ""}{gym.city}/{gym.state}</b>, com distância, modalidades{gym.price_from_cents ? `, mensalidade a partir de ${brlFromCents(gym.price_from_cents)}` : ""} e o botão de WhatsApp.</p>
      <p className="pa-muted">Dica: peça aos personais que treinam alunos aí para se cadastrarem em <a href="/parceiros">/parceiros</a> e marcarem esta academia. Eles aparecem no seu card do radar.</p>
    </> : gym.status === "pending" ? <>
      <Clock3 className="pa-ic" aria-hidden />
      <h2>Cadastro em análise</h2>
      <p>Vamos conferir o CNPJ e aprovar em até 2 dias úteis. Depois disso a academia aparece no Radar com o selo de credenciada.</p>
    </> : <>
      <Clock3 className="pa-ic" aria-hidden />
      <h2>Cadastro não aprovado</h2>
      <p>{gym.admin_note || "Confira os dados (principalmente o CNPJ) e envie de novo."}</p>
    </>}
    <button type="button" className="pa-ghost" onClick={() => setEditing(true)}>Editar dados da academia</button>
  </section>;

  return <form className="pa-form" onSubmit={submit}>
    <div className="pa-photo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <label className="pa-avatar ga-cover">{preview ? <img src={preview} alt="Foto da academia" /> : <Camera aria-hidden />}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => pick(e.target.files?.[0] ?? null)} /></label>
      <span>Foto da academia<small>Fachada ou área de treino. Aparece no Radar.</small></span>
    </div>
    <label>Nome da academia<input required maxLength={80} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Ex.: Academia Força Total" /></label>
    <label>CNPJ<input required inputMode="numeric" maxLength={18} value={f.cnpj} onChange={e => setF({ ...f, cnpj: e.target.value.replace(/[^\d./-]/g, "") })} onBlur={() => setF(c => ({ ...c, cnpj: formatCnpj(c.cnpj) || c.cnpj }))} placeholder="00.000.000/0000-00" /></label>

    <div className="ga-locate">
      <b>Localização no mapa</b>
      {point ? <p className="ga-point"><MapPin aria-hidden /> Localização marcada. <button type="button" className="ga-link" onClick={locate}>Marcar de novo</button></p>
        : <button type="button" className="pa-btn ga-btn" onClick={locate} disabled={Boolean(busy)}><LocateFixed aria-hidden />{busy === "locating" || busy === "osm" ? "Localizando…" : "Estou na academia agora"}</button>}
      <small className="pa-muted">Faça isso de dentro da academia: é o ponto usado para calcular a distância até cada aluno.</small>
      {osm && osm.length > 0 && <div className="ga-osm"><small>Achamos no mapa. É uma destas? (preenche nome e endereço)</small>{osm.map(o => <button type="button" key={o.id} onClick={() => pickOsm(o)}><b>{o.name}</b><span>{o.address || `${Math.round(o.distance)} m daqui`}</span></button>)}</div>}
    </div>

    <div className="pa-row">
      <label>Cidade<input required maxLength={80} value={f.city} onChange={e => setF({ ...f, city: e.target.value })} placeholder="Ex.: Fortaleza" /></label>
      <label className="pa-uf">UF<select value={f.state} onChange={e => setF({ ...f, state: e.target.value })}>{UFS.map(u => <option key={u}>{u}</option>)}</select></label>
    </div>
    <div className="pa-row">
      <label>Bairro<input maxLength={60} value={f.neighborhood} onChange={e => setF({ ...f, neighborhood: e.target.value })} placeholder="Ex.: Aldeota" /></label>
      <label>Mensalidade a partir de (R$)<input inputMode="decimal" maxLength={10} value={f.price_from} onChange={e => setF({ ...f, price_from: e.target.value })} placeholder="Ex.: 89,90" /></label>
    </div>
    <label>Endereço<input maxLength={160} value={f.address} onChange={e => setF({ ...f, address: e.target.value })} placeholder="Ex.: Rua Barbosa de Freitas, 100" /></label>

    <div className="ga-mods"><b>Modalidades</b><div>{MODALITIES.map(([id, l]) => <button type="button" key={id} className={mods.includes(id) ? "sel" : ""} aria-pressed={mods.includes(id)} onClick={() => toggle(id)}>{l}</button>)}</div></div>
    <label>Horário de funcionamento<input maxLength={120} value={f.hours} onChange={e => setF({ ...f, hours: e.target.value })} placeholder="Ex.: Seg a sex 5h–22h · Sáb 8h–12h" /></label>
    <div className="pa-row">
      <label>WhatsApp<input inputMode="tel" maxLength={20} value={f.whatsapp} onChange={e => setF({ ...f, whatsapp: e.target.value })} placeholder="(85) 99999-0000" /></label>
      <label>Instagram<input maxLength={31} value={f.instagram} onChange={e => setF({ ...f, instagram: e.target.value })} placeholder="@academia" /></label>
    </div>
    <label>Frase sobre a academia<input maxLength={200} value={f.bio} onChange={e => setF({ ...f, bio: e.target.value })} placeholder="Ex.: Estrutura completa, estacionamento e ar-condicionado" /></label>
    <label>Vantagem para quem vem pelo VIVA+ (opcional)<input maxLength={100} value={f.perk} onChange={e => setF({ ...f, perk: e.target.value })} placeholder="Ex.: 1ª semana grátis · 10% na matrícula" /></label>
    <label className="pa-check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> Sou responsável por esta academia e autorizo a VIVA+ a mostrar no app o nome, a foto, o endereço, a localização, as modalidades, os preços e os contatos informados. Posso pedir para sair a qualquer momento.</label>
    {err && <p className="pa-error" role="alert">{err}</p>}
    <button className="pa-btn" disabled={busy === "saving"}>{busy === "saving" ? "Enviando…" : gym ? "Salvar alterações" : "Cadastrar minha academia"}</button>
    {gym && <button type="button" className="pa-ghost" onClick={() => setEditing(false)}>Cancelar</button>}
  </form>;
}
