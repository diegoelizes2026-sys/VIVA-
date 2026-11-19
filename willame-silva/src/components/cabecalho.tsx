"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, UserRound, X } from "lucide-react";
import { IconeWhatsapp, Logo } from "./marca";
import { linkWhatsapp, telefoneBonito } from "@/lib/format";

const LINKS = [
  { href: "/", label: "Início" },
  { href: "/empreendimentos", label: "Imóveis" },
  { href: "/#sobre", label: "Sobre Nós" },
  { href: "/#servicos", label: "Serviços" },
  { href: "/#contato", label: "Contato" },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Cabecalho({ whatsapp, creci, sobreFoto }: { whatsapp: string; creci: string; sobreFoto?: boolean }) {
  const [rolou, setRolou] = useState(false);
  const [aberto, setAberto] = useState(false);
  const path = usePathname();

  useEffect(() => {
    const f = () => setRolou(window.scrollY > 20);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);

  const zap = linkWhatsapp(whatsapp, "Olá! Vim pelo site da Willame Negócios Imobiliário.");
  const ativo = (href: string) => (href === "/" ? path === "/" : !href.includes("#") && path.startsWith(href));

  return (
    <header className={`fixed inset-x-0 top-0 z-40 bg-ink text-white transition-shadow ${rolou ? "shadow-[0_8px_30px_-10px_rgba(0,0,0,.5)]" : ""}`}>
      <div className={`mx-auto flex max-w-[1320px] items-center justify-between gap-6 px-4 transition-all sm:px-8 ${rolou ? "h-[76px]" : "h-[92px]"}`}>
        <Link href="/" aria-label="Início" className="shrink-0">
          <Logo claro compacto={rolou} />
        </Link>

        <nav className="hidden items-center gap-9 lg:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`relative py-2 text-[16px] font-semibold transition ${ativo(l.href) ? "text-sol" : "text-white/90 hover:text-sol"}`}
            >
              {l.label}
              {ativo(l.href) && <span className="absolute -bottom-0.5 left-0 h-[3px] w-full rounded-full bg-sol" />}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <a href={zap} target="_blank" rel="noopener" className="hidden items-center gap-2 text-[16px] font-semibold text-white/95 hover:text-sol xl:flex">
            <IconeWhatsapp className="h-6 w-6" />
            {whatsapp ? telefoneBonito(whatsapp) : "WhatsApp"}
          </a>
          <span className="hidden h-8 w-px bg-white/25 xl:block" />
          <Link
            href="/admin"
            className="hidden items-center gap-2 rounded-lg border-2 border-sol px-4 py-2 text-[15px] font-semibold text-sol transition hover:bg-sol hover:text-ink sm:flex"
          >
            <UserRound className="h-[18px] w-[18px]" /> Painel Admin
          </Link>
          <button onClick={() => setAberto((v) => !v)} className="grid h-11 w-11 place-items-center rounded-lg lg:hidden" aria-label="Menu">
            {aberto ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {aberto && (
        <div className="border-t border-white/10 bg-ink px-4 pb-8 pt-2 lg:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setAberto(false)}
              className={`font-display block border-b border-white/10 py-4 text-xl font-bold ${ativo(l.href) ? "text-sol" : ""}`}
            >
              {l.label}
            </Link>
          ))}
          <a href={zap} className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-zap py-4 font-semibold text-white">
            <IconeWhatsapp /> {whatsapp ? telefoneBonito(whatsapp) : "Falar no WhatsApp"}
          </a>
          <Link href="/admin" className="mt-3 flex items-center justify-center gap-2 rounded-lg border-2 border-sol py-3.5 font-semibold text-sol">
            <UserRound className="h-4 w-4" /> Painel Admin
          </Link>
        </div>
      )}
    </header>
  );
}
