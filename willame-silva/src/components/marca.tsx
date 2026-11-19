import { partesTitulo } from "@/lib/format";

export function Monograma({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <circle cx="24" cy="24" r="23" fill="none" stroke="currentColor" strokeWidth="1" opacity=".5" />
      <path
        d="M10 15 L16.5 34 L24 19 L31.5 34 L38 15"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 38.5 Q24 34.5 34 38.5" fill="none" stroke="var(--color-sol)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ claro = false, creci }: { claro?: boolean; creci?: string }) {
  return (
    <span className={`flex items-center gap-3 ${claro ? "text-osso" : "text-ink"}`}>
      <Monograma className="h-10 w-10 shrink-0" />
      <span className="leading-none">
        <span className="font-display block text-[22px] font-medium">Willame Silva</span>
        <span className={`rotulo mt-1 block !text-[9.5px] ${claro ? "text-osso/60" : "text-ink/55"}`}>
          Corretor de imóveis{creci ? ` · CRECI ${creci}` : ""}
        </span>
      </span>
    </span>
  );
}

/** Título com trechos *em itálico* destacados. */
export function Titulo({ texto, destaque = "text-sol" }: { texto: string; destaque?: string }) {
  return (
    <>
      {partesTitulo(texto).map((p, i) =>
        p.em ? (
          <em key={i} className={destaque}>
            {p.txt}
          </em>
        ) : (
          <span key={i}>{p.txt}</span>
        ),
      )}
    </>
  );
}

export function IconeWhatsapp({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.23 8.23 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.23 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.25-.42.08-.17.04-.31-.02-.43-.06-.13-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}
