import { partesTitulo } from "@/lib/format";

export function Monograma({ className = "" }: { className?: string }) {
  // Telhado com janela — o símbolo da marca
  return (
    <svg viewBox="0 0 64 48" className={className} aria-hidden>
      <defs>
        <linearGradient id="ouro" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3d27a" />
          <stop offset=".55" stopColor="#d8a93d" />
          <stop offset="1" stopColor="#a8761f" />
        </linearGradient>
      </defs>
      <path d="M4 30 L32 6 L60 30" fill="none" stroke="url(#ouro)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="43" y="6" width="6" height="12" rx="1" fill="url(#ouro)" />
      <g fill="url(#ouro)">
        <rect x="27" y="19" width="4.6" height="4.6" rx=".6" />
        <rect x="32.6" y="19" width="4.6" height="4.6" rx=".6" />
        <rect x="27" y="24.6" width="4.6" height="4.6" rx=".6" />
        <rect x="32.6" y="24.6" width="4.6" height="4.6" rx=".6" />
      </g>
      <path d="M10 42 Q32 50 54 42" fill="none" stroke="url(#ouro)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ claro = false, creci, compacto = false }: { claro?: boolean; creci?: string; compacto?: boolean }) {
  return (
    <span className={`relative inline-flex flex-col items-center leading-none ${claro ? "text-white" : "text-ink"}`}>
      <svg viewBox="0 0 64 30" className={compacto ? "mb-0 h-5 w-10" : "mb-0.5 h-7 w-14"} aria-hidden>
        <defs>
          <linearGradient id="ouro-logo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f3d27a" />
            <stop offset=".55" stopColor="#d8a93d" />
            <stop offset="1" stopColor="#a8761f" />
          </linearGradient>
        </defs>
        <path d="M5 28 L32 5 L59 28" fill="none" stroke="url(#ouro-logo)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="43" y="5" width="5.5" height="11" rx="1" fill="url(#ouro-logo)" />
        <g fill="url(#ouro-logo)">
          <rect x="27.4" y="16" width="4.2" height="4.2" rx=".5" />
          <rect x="32.4" y="16" width="4.2" height="4.2" rx=".5" />
          <rect x="27.4" y="21" width="4.2" height="4.2" rx=".5" />
          <rect x="32.4" y="21" width="4.2" height="4.2" rx=".5" />
        </g>
      </svg>
      <span className={`font-display font-extrabold tracking-[0.02em] ${compacto ? "text-[20px]" : "text-[27px]"}`}>WILLAME</span>
      <span className={`font-display mt-1 font-semibold tracking-[0.2em] ${compacto ? "text-[7.5px]" : "text-[9px]"} ${claro ? "text-white/85" : "text-ink/70"}`}>
        NEGÓCIOS <b className="font-extrabold">IMOBILIÁRIO</b>
      </span>
      <svg viewBox="0 0 120 10" className={compacto ? "mt-0.5 h-1.5 w-20" : "mt-1 h-2 w-28"} aria-hidden>
        <path d="M4 2 Q60 12 116 2" fill="none" stroke="url(#ouro-logo)" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      {creci && !compacto && <span className={`mt-0.5 text-[8.5px] font-semibold tracking-wider ${claro ? "text-white/50" : "text-ink/45"}`}>CRECI {creci}</span>}
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
