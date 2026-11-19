"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { House } from "lucide-react";
import type { Slide } from "@/lib/types";
import { linkWhatsapp } from "@/lib/format";
import { IconeWhatsapp, Titulo } from "./marca";

const DUR = 7000;

export function Carrossel({ slides, whatsapp }: { slides: Slide[]; whatsapp: string; regiao?: string }) {
  const [i, setI] = useState(0);
  const [pausado, setPausado] = useState(false);
  const toque = useRef<number | null>(null);
  const total = slides.length;

  const ir = useCallback((n: number) => setI(((n % total) + total) % total), [total]);

  useEffect(() => {
    if (pausado || total < 2) return;
    const t = setTimeout(() => ir(i + 1), DUR);
    return () => clearTimeout(t);
  }, [i, pausado, total, ir]);

  if (!total) return null;
  const s = slides[i];
  const externo = s.cta_link.startsWith("http");

  return (
    <section
      className="relative w-full overflow-hidden bg-ink text-white"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onTouchStart={(e) => (toque.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - (toque.current ?? 0);
        if (Math.abs(dx) > 50) ir(i + (dx < 0 ? 1 : -1));
        toque.current = null;
      }}
    >
      {/* Foto à direita, esmaecendo no azul-marinho à esquerda */}
      {slides.map((sl, k) => (
        <div
          key={sl.id}
          className={`foto-fallback absolute inset-0 transition-opacity duration-[1200ms] lg:left-[30%] ${k === i ? "opacity-100" : "opacity-0"}`}
          aria-hidden={k !== i}
        >
          {sl.imagem && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={k === i ? `on-${i}` : `off-${k}`}
              src={sl.imagem}
              alt=""
              onError={(ev) => (ev.currentTarget.style.display = "none")}
              className={`h-full w-full object-cover ${k === i ? "kenburns" : ""}`}
              loading={k === 0 ? "eager" : "lazy"}
            />
          )}
        </div>
      ))}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#0f1a2c_0%,#0f1a2c_28%,rgba(15,26,44,.82)_42%,rgba(15,26,44,.25)_62%,rgba(15,26,44,0)_80%)] max-lg:bg-[linear-gradient(180deg,rgba(15,26,44,.55),rgba(15,26,44,.88))]" />

      <div className="relative mx-auto flex min-h-[600px] max-w-[1320px] flex-col justify-center px-4 pb-32 pt-[130px] sm:px-8 lg:min-h-[640px] lg:pb-36">
        <div key={s.id} className="max-w-[760px]">
          <h1 className="font-display subir text-[clamp(38px,4.7vw,64px)] font-extrabold leading-[1.05]">
            <Titulo texto={s.titulo} destaque="text-sol" />
          </h1>
          {(s.sobretitulo || s.subtitulo) && (
            <div className="subir mt-6 border-l-4 border-sol pl-5" style={{ animationDelay: ".12s" }}>
              {s.sobretitulo && <p className="text-[clamp(20px,2vw,26px)] font-normal leading-snug">{s.sobretitulo}</p>}
              {s.subtitulo && <p className="mt-2 max-w-[440px] text-[16.5px] leading-relaxed text-white/85">{s.subtitulo}</p>}
            </div>
          )}
          <div className="subir mt-8 flex flex-wrap gap-4" style={{ animationDelay: ".22s" }}>
            {s.cta_texto && (
              <Link
                href={s.cta_link || "/empreendimentos"}
                target={externo ? "_blank" : undefined}
                className="inline-flex items-center gap-3 rounded-lg bg-gradient-to-b from-[#e7bd55] to-sol-2 px-7 py-3.5 text-[16px] font-bold text-ink shadow-lg shadow-black/20 transition hover:brightness-110"
              >
                <House className="h-5 w-5" /> {s.cta_texto}
              </Link>
            )}
            <a
              href={linkWhatsapp(whatsapp, "Olá! Quero falar com um corretor.")}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-3 rounded-lg border-2 border-white/90 px-6 py-3 text-[16px] font-semibold transition hover:bg-white hover:text-ink"
            >
              <IconeWhatsapp className="h-5 w-5" /> Falar com um Corretor
            </a>
          </div>
        </div>

        {total > 1 && (
          <div className="absolute bottom-[92px] right-4 flex gap-2 sm:right-8">
            {slides.map((sl, k) => (
              <button key={sl.id} onClick={() => ir(k)} aria-label={`Slide ${k + 1}`} className="py-2">
                <span className={`block h-1.5 rounded-full transition-all ${k === i ? "w-8 bg-sol" : "w-3 bg-white/50 hover:bg-white"}`} />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
