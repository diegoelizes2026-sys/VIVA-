"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import type { Slide } from "@/lib/types";
import { Titulo } from "./marca";
import { abrirAgente } from "./agente-eventos";

const DUR = 7000;
const ATALHOS = ["Lote para construir", "Casa em condomínio", "Beira-lagoa", "Para investir"];

export function Carrossel({ slides, regiao }: { slides: Slide[]; regiao: string }) {
  const [i, setI] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [busca, setBusca] = useState("");
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

  function enviarBusca(texto: string) {
    const t = texto.trim();
    if (!t) return abrirAgente();
    abrirAgente(`Estou procurando: ${t}`);
    setBusca("");
  }

  return (
    <section
      className="relative min-h-[100svh] w-full overflow-hidden bg-ink text-osso sm:h-[100svh] sm:min-h-[680px]"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onTouchStart={(e) => (toque.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - (toque.current ?? 0);
        if (Math.abs(dx) > 50) ir(i + (dx < 0 ? 1 : -1));
        toque.current = null;
      }}
    >
      {slides.map((sl, k) => (
        <div
          key={sl.id}
          className={`foto-fallback absolute inset-0 transition-opacity duration-[1400ms] ${k === i ? "opacity-100" : "opacity-0"}`}
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
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,31,30,.55)_0%,rgba(11,31,30,.05)_32%,rgba(11,31,30,.25)_58%,rgba(11,31,30,.92)_100%)]" />
      <div className="absolute inset-y-0 left-0 w-2/3 bg-[linear-gradient(90deg,rgba(11,31,30,.55),transparent)]" />
      <div className="grao absolute inset-0" />

      {/* Coordenadas laterais */}
      <div className="rotulo absolute right-7 top-1/2 hidden -translate-y-1/2 text-osso/50 [writing-mode:vertical-rl] xl:block">
        3°43′S · 38°31′W — {regiao}
      </div>

      <div className="relative mx-auto flex min-h-[100svh] max-w-[1400px] flex-col justify-end px-4 pb-28 pt-32 sm:h-full sm:min-h-0 sm:px-8 sm:pb-14">
        <div key={s.id} className="max-w-4xl">
          {s.sobretitulo && (
            <p className="rotulo subir mb-5 flex items-center gap-3 text-sol">
              <span className="h-px w-10 bg-sol" />
              {s.sobretitulo}
            </p>
          )}
          <h1 className="font-display subir text-[clamp(44px,7.6vw,112px)] font-light leading-[0.95]" style={{ animationDelay: ".08s" }}>
            <Titulo texto={s.titulo} />
          </h1>
          {s.subtitulo && (
            <p className="subir mt-6 max-w-xl text-[17px] leading-relaxed text-osso/80" style={{ animationDelay: ".18s" }}>
              {s.subtitulo}
            </p>
          )}
          {s.cta_texto && (
            <div className="subir mt-8" style={{ animationDelay: ".26s" }}>
              <Link
                href={s.cta_link || "#empreendimentos"}
                target={externo ? "_blank" : undefined}
                className="group inline-flex items-center gap-3 rounded-full bg-osso py-2 pl-6 pr-2 text-[15px] font-semibold text-ink transition hover:bg-sol"
              >
                {s.cta_texto}
                <span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-osso transition group-hover:rotate-45">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </Link>
            </div>
          )}
        </div>

        {/* Barra inferior: busca inteligente + controles */}
        <div className="mt-12 grid gap-6 border-t border-osso/15 pt-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviarBusca(busca);
            }}
            className="w-full max-w-2xl"
          >
            <label className="rotulo mb-3 flex items-center gap-2 text-osso/60">
              <Sparkles className="h-3.5 w-3.5 text-sol" /> Diga o que procura — o Agente 24h filtra para você
            </label>
            <div className="flex items-center gap-2 rounded-full border border-osso/20 bg-ink/40 p-1.5 backdrop-blur-md focus-within:border-sol">
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Ex.: lote em condomínio até R$ 300 mil perto da praia"
                className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-[15px] text-osso placeholder:text-osso/45 focus:outline-none"
              />
              <button className="flex shrink-0 items-center gap-2 rounded-full bg-sol px-5 py-3 text-[14px] font-semibold text-ink transition hover:bg-osso">
                Buscar <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <div className="sem-barra mt-3 flex gap-2 overflow-x-auto">
              {ATALHOS.map((a) => (
                <button
                  type="button"
                  key={a}
                  onClick={() => enviarBusca(a)}
                  className="shrink-0 rounded-full border border-osso/20 px-3.5 py-1.5 text-[12.5px] text-osso/80 transition hover:border-sol hover:text-sol"
                >
                  {a}
                </button>
              ))}
            </div>
          </form>

          {total > 1 && (
            <div className="flex items-center gap-5 lg:pr-24">
              <div className="flex gap-2">
                {slides.map((sl, k) => (
                  <button
                    key={sl.id}
                    onClick={() => ir(k)}
                    className="group w-12 py-3 sm:w-16"
                    aria-label={`Slide ${k + 1}`}
                  >
                    <span className="block h-[2px] w-full overflow-hidden bg-osso/25">
                      {k === i ? (
                        <span
                          key={`${i}-${pausado}`}
                          className={`block h-full bg-sol ${pausado ? "" : "barra-progresso"}`}
                          style={{ ["--dur" as string]: `${DUR}ms`, transform: pausado ? "scaleX(1)" : undefined }}
                        />
                      ) : (
                        <span className={`block h-full bg-osso/70 ${k < i ? "w-full" : "w-0"}`} />
                      )}
                    </span>
                  </button>
                ))}
              </div>
              <span className="font-display text-lg tabular-nums text-osso/80">
                {String(i + 1).padStart(2, "0")}
                <span className="text-osso/40"> / {String(total).padStart(2, "0")}</span>
              </span>
              <div className="hidden gap-1.5 sm:flex">
                <button onClick={() => ir(i - 1)} className="grid h-11 w-11 place-items-center rounded-full border border-osso/25 hover:bg-osso hover:text-ink" aria-label="Anterior">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button onClick={() => ir(i + 1)} className="grid h-11 w-11 place-items-center rounded-full border border-osso/25 hover:bg-osso hover:text-ink" aria-label="Próximo">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
