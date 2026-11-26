"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import CredentialSeal from "@/components/credential-seal";
import { BadgeCheck, ChevronRight, MessageCircle, Instagram, Radar } from "lucide-react";

type Partner = { display_name: string; cref: string; city: string; state: string; instagram: string | null; whatsapp: string | null; photo_url: string | null; bio: string | null; reviewer: boolean; same_city: boolean };

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
function Avatar({ p, size = 56 }: { p: Partner; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return p.photo_url ? <img className="pt-avatar" src={p.photo_url} alt="" width={size} height={size} /> : <span className="pt-avatar pt-ini" style={{ width: size, height: size }}>{initials(p.display_name)}</span>;
}

/** Saúde: selo do personal que revisa os treinos + personais parceiros (primeiro os da cidade da pessoa). */
export default function PartnerTrainers() {
  const [list, setList] = useState<Partner[] | null>(null);
  useEffect(() => { fetch("/api/partners/directory").then(r => (r.ok ? r.json() : null)).then(d => setList(d?.partners || [])).catch(() => setList([])); }, []);
  if (!list) return null;
  const radar = <Link href="/saude/personais" className="pt-radar"><Radar aria-hidden /><span><b>Radar de Personais</b>Veja personais perto de você, com a distância em km</span><ChevronRight aria-hidden /></Link>;
  if (list.length === 0) return <div className="pt-wrap">{radar}</div>;
  const reviewer = list.find(p => p.reviewer);
  const nearby = list.filter(p => p.same_city);
  const shown = (nearby.length ? nearby : list).slice(0, 3);
  const wa = (p: Partner) => `https://wa.me/${p.whatsapp}?text=${encodeURIComponent(`Oi, ${p.display_name.split(" ")[0]}! Te achei pela VIVA+ e quero saber sobre acompanhamento de treino.`)}`;
  return <div className="pt-wrap">
    {reviewer && <div className="pt-seal"><BadgeCheck aria-hidden /><span><b>Treinos revisados por profissional</b>{reviewer.display_name} · CREF {reviewer.cref}</span></div>}
    <section className="pt-card">
      <span className="pt-eyebrow">QUER ACOMPANHAMENTO DE VERDADE?</span>
      <h2>{nearby.length ? `Personais parceiros em ${nearby[0].city}` : "Personais parceiros da VIVA+"}</h2>
      <div className="pt-list">{shown.map(p => <article key={p.cref} className="pt-item">
        <Avatar p={p} />
        <div className="pt-info"><b>{p.display_name}</b><CredentialSeal cref={p.cref} /><small>{p.city}/{p.state} · CREF {p.cref}</small>{p.bio && <span>{p.bio}</span>}
          <div className="pt-btns">
            {p.whatsapp && <a className="pt-wa" href={wa(p)} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} aria-hidden /> WhatsApp</a>}
            {p.instagram && <a className="pt-ig" href={`https://instagram.com/${p.instagram}`} target="_blank" rel="noopener noreferrer"><Instagram size={16} aria-hidden /> Instagram</a>}
          </div>
        </div>
      </article>)}</div>
      {radar}
      <small className="pt-note">Os treinos da VIVA são sugestões gerais. Para um plano individual, fale com um profissional.</small>
    </section>
  </div>;
}
