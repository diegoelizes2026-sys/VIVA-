"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Camera, CheckCircle2, Clock3, Copy, Check } from "lucide-react";
import PartnerLocation from "@/components/partner-location";
import CredentialSeal from "@/components/credential-seal";

type Profile = { display_name: string; cref: string; city: string; state: string; instagram: string | null; whatsapp: string | null; photo_url: string | null; bio: string | null; desired_code: string | null; status: "pending" | "approved" | "rejected"; reviewer: boolean; admin_note: string | null; gym_name: string | null; neighborhood: string | null; service_lat: number | null; modes: string[] | null; home_radius_km: number | null; approved_at?: string | null };
const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

async function shrink(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d"); if (!ctx) { bitmap.close(); return file; }
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 512, 512); bitmap.close();
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error("foto"))), "image/jpeg", 0.85));
  return new File([blob], "foto.jpg", { type: "image/jpeg" });
}

/** Formulário da Rede de Personais (pessoa logada). */
export default function PartnerApply() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ display_name: "", cref: "", city: "", state: "CE", instagram: "", whatsapp: "", bio: "", desired_code: "" });
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [copied, setCopied] = useState(false);

  const load = () => fetch("/api/partners/apply", { cache: "no-store" }).then(r => r.json()).then(d => {
    const p = d.profile as Profile | null; setProfile(p); setCode(d.code ?? null);
    if (p) setF({ display_name: p.display_name, cref: p.cref, city: p.city, state: p.state, instagram: p.instagram ? "@" + p.instagram : "", whatsapp: p.whatsapp ? p.whatsapp.replace(/^55/, "") : "", bio: p.bio || "", desired_code: p.desired_code || "" });
    if (p?.photo_url) setPreview(p.photo_url);
  }).catch(() => null).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  async function pick(file: File | null) {
    if (!file) return;
    try { const small = await shrink(file); setPhoto(small); setPreview(URL.createObjectURL(small)); } catch { setErr("Não consegui ler essa foto. Tente outra."); }
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr("");
    if (!consent) { setErr("Marque a autorização para mostrarmos seus dados no app."); return; }
    setBusy(true);
    const body = new FormData();
    Object.entries(f).forEach(([k, v]) => body.append(k, v));
    body.append("consent", "true");
    if (photo) body.append("photo", photo);
    const r = await fetch("/api/partners/apply", { method: "POST", body });
    const j = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) { setErr(j.error || "Não consegui enviar."); return; }
    setEditing(false); setPhoto(null); await load();
  }

  if (loading) return <p className="pa-muted">Carregando…</p>;
  const link = code && typeof window !== "undefined" ? `${window.location.origin}/cadastro?convite=${code}` : "";

  if (profile && !editing) return <section className="pa-status">
    {profile.status === "approved" ? <>
      <CheckCircle2 className="pa-ic ok" aria-hidden />
      <h2>Você é Personal Parceiro VIVA+ 🎉</h2>
      <CredentialSeal size="lg" credentialedAt={profile.approved_at} cref={profile.cref} />
      <p className="pa-muted">O selo aparece no seu perfil no Radar de Personais e mostra aos alunos que seu CREF foi conferido pela VIVA+.</p>
      <p>Seu perfil já aparece no <b>Radar de Personais</b> para os usuários de <b>{profile.city}/{profile.state}</b> e região{profile.reviewer ? " e você é o responsável pela revisão dos treinos do app" : ""}.</p>
      {link && <div className="pa-link"><span>{link}</span><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* */ } }}>{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copiado" : "Copiar"}</button></div>}
      <p className="pa-muted">Você ganha <b>R$ 10 por assinante do Pro</b> pelo seu link, sem limite, e <b>R$ 50 de bônus a cada 10 assinantes</b>. Acompanhe e saque em <a href="/indique">Indique e ganhe</a>.</p>
    </> : profile.status === "pending" ? <>
      <Clock3 className="pa-ic" aria-hidden />
      <h2>Cadastro em análise</h2>
      <p>Vamos conferir seu CREF e aprovar em até 2 dias úteis. Você recebe o aviso por aqui.</p>
    </> : <>
      <Clock3 className="pa-ic" aria-hidden />
      <h2>Cadastro não aprovado</h2>
      <p>{profile.admin_note || "Confira os dados (principalmente o CREF) e envie de novo."}</p>
    </>}
    <button type="button" className="pa-ghost" onClick={() => setEditing(true)}>Editar meus dados</button>
    {profile.status !== "rejected" && <PartnerLocation data={profile} onSaved={load} />}
  </section>;

  return <form className="pa-form" onSubmit={submit}>
    <div className="pa-photo">
      <label className="pa-avatar">{preview ? <img src={preview} alt="Sua foto" /> : <Camera aria-hidden />}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => pick(e.target.files?.[0] ?? null)} /></label>
      <span>Foto de perfil<small>Rosto bem visível. Aparece no app para os alunos.</small></span>
    </div>
    <label>Nome profissional<input required maxLength={80} value={f.display_name} onChange={e => setF({ ...f, display_name: e.target.value })} placeholder="Ex.: João Silva Personal" /></label>
    <label>CREF<input required maxLength={30} value={f.cref} onChange={e => setF({ ...f, cref: e.target.value.toUpperCase() })} placeholder="Ex.: 012345-G/CE" /></label>
    <div className="pa-row">
      <label>Cidade<input required maxLength={80} value={f.city} onChange={e => setF({ ...f, city: e.target.value })} placeholder="Ex.: Aquiraz" /></label>
      <label className="pa-uf">UF<select value={f.state} onChange={e => setF({ ...f, state: e.target.value })}>{UFS.map(u => <option key={u}>{u}</option>)}</select></label>
    </div>
    <div className="pa-row">
      <label>Instagram<input maxLength={31} value={f.instagram} onChange={e => setF({ ...f, instagram: e.target.value })} placeholder="@seuperfil" /></label>
      <label>WhatsApp<input inputMode="tel" maxLength={20} value={f.whatsapp} onChange={e => setF({ ...f, whatsapp: e.target.value })} placeholder="(85) 99999-0000" /></label>
    </div>
    <label>Frase curta sobre seu trabalho<input maxLength={160} value={f.bio} onChange={e => setF({ ...f, bio: e.target.value })} placeholder="Ex.: Treino em casa e emagrecimento, online e presencial" /></label>
    <label>Código do seu link (opcional)<input maxLength={12} value={f.desired_code} onChange={e => setF({ ...f, desired_code: e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase() })} placeholder="Ex.: JOAO10" /></label>
    <label className="pa-check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> Autorizo a VIVA+ a mostrar no app meu nome, foto, CREF, cidade, Instagram e WhatsApp para os usuários. Posso pedir para sair a qualquer momento.</label>
    {err && <p className="pa-error" role="alert">{err}</p>}
    <button className="pa-btn" disabled={busy}>{busy ? "Enviando…" : profile ? "Salvar alterações" : "Quero ser parceiro"}</button>
    {profile && <button type="button" className="pa-ghost" onClick={() => setEditing(false)}>Cancelar</button>}
  </form>;
}
