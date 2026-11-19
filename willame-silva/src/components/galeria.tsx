"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";

export function Galeria({ imagens, nome }: { imagens: string[]; nome: string }) {
  const [aberta, setAberta] = useState<number | null>(null);
  const n = imagens.length;

  useEffect(() => {
    if (aberta == null) return;
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberta(null);
      if (e.key === "ArrowRight") setAberta((i) => ((i ?? 0) + 1) % n);
      if (e.key === "ArrowLeft") setAberta((i) => ((i ?? 0) - 1 + n) % n);
    };
    window.addEventListener("keydown", f);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", f);
      document.body.style.overflow = "";
    };
  }, [aberta, n]);

  if (!n) return null;

  return (
    <>
      <div className="grid auto-rows-[220px] grid-cols-2 gap-3 sm:auto-rows-[280px] md:grid-cols-4">
        {imagens.slice(0, 5).map((src, k) => (
          <button
            key={k}
            onClick={() => setAberta(k)}
            className={`foto-fallback group relative overflow-hidden rounded-[20px] ${k === 0 ? "col-span-2 row-span-2" : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`${nome} — foto ${k + 1}`} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
            <span className="absolute inset-0 bg-ink/0 transition group-hover:bg-ink/15" />
            {k === 4 && n > 5 && (
              <span className="font-display absolute inset-0 grid place-items-center bg-ink/55 text-3xl text-osso">+{n - 5}</span>
            )}
            {k === 0 && (
              <span className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-osso/90 px-4 py-2 text-[13px] font-semibold text-ink">
                <Expand className="h-4 w-4" /> Ver {n} fotos
              </span>
            )}
          </button>
        ))}
      </div>

      {aberta != null && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-ink/95 backdrop-blur" onClick={() => setAberta(null)}>
          <div className="flex items-center justify-between p-4 text-osso">
            <span className="rotulo text-osso/60">
              {nome} · {aberta + 1}/{n}
            </span>
            <button className="grid h-11 w-11 place-items-center rounded-full hover:bg-osso/10" aria-label="Fechar">
              <X />
            </button>
          </div>
          <div className="relative flex flex-1 items-center justify-center px-4 pb-8" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagens[aberta]} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
            {n > 1 && (
              <>
                <button onClick={() => setAberta((aberta - 1 + n) % n)} className="absolute left-4 grid h-12 w-12 place-items-center rounded-full bg-osso/10 text-osso hover:bg-osso hover:text-ink" aria-label="Anterior">
                  <ChevronLeft />
                </button>
                <button onClick={() => setAberta((aberta + 1) % n)} className="absolute right-4 grid h-12 w-12 place-items-center rounded-full bg-osso/10 text-osso hover:bg-osso hover:text-ink" aria-label="Próxima">
                  <ChevronRight />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
