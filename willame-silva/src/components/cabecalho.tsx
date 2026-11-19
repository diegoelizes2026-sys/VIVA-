"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { IconeWhatsapp, Logo } from "./marca";
import { linkWhatsapp } from "@/lib/format";

const LINKS = [
  { href: "/#empreendimentos", label: "Empreendimentos" },
  { href: "/#corretor", label: "O corretor" },
  { href: "/#metodo", label: "Como trabalho" },
  { href: "/#contato", label: "Contato" },
];

export function Cabecalho({ whatsapp, creci, sobreFoto = true }: { whatsapp: string; creci: string; sobreFoto?: boolean }) {
  const [rolou, setRolou] = useState(false);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const f = () => setRolou(window.scrollY > 40);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);

  const claro = sobreFoto && !rolou && !aberto;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-500 ${
        claro ? "bg-transparent" : "border-b border-ink/10 bg-osso/90 backdrop-blur-xl"
      }`}
    >
      <div className="mx-auto flex h-20 max-w-[1400px] items-center justify-between px-4 sm:px-8">
        <Link href="/" aria-label="Início">
          <Logo claro={claro} creci={creci} />
        </Link>

        <nav className="hidden items-center gap-9 lg:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`group relative text-[14px] font-medium ${claro ? "text-osso/85 hover:text-osso" : "text-ink/75 hover:text-ink"}`}
            >
              {l.label}
              <span className="absolute -bottom-1.5 left-0 h-px w-0 bg-sol transition-all duration-300 group-hover:w-full" />
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={linkWhatsapp(whatsapp, "Olá, Willame! Vim pelo seu site.")}
            target="_blank"
            rel="noopener"
            className={`hidden items-center gap-2 rounded-full px-5 py-2.5 text-[13.5px] font-semibold transition sm:flex ${
              claro ? "bg-osso text-ink hover:bg-sol" : "bg-ink text-osso hover:bg-lagoa"
            }`}
          >
            <IconeWhatsapp className="h-4 w-4" /> Falar no WhatsApp
          </a>
          <button
            onClick={() => setAberto((v) => !v)}
            className={`grid h-11 w-11 place-items-center rounded-full lg:hidden ${claro ? "text-osso" : "text-ink"}`}
            aria-label="Menu"
          >
            {aberto ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {aberto && (
        <div className="border-t border-ink/10 bg-osso px-4 pb-8 pt-4 lg:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setAberto(false)}
              className="font-display block border-b border-ink/10 py-4 text-3xl"
            >
              {l.label}
            </Link>
          ))}
          <a
            href={linkWhatsapp(whatsapp, "Olá, Willame! Vim pelo seu site.")}
            className="mt-6 flex items-center justify-center gap-2 rounded-full bg-zap py-4 font-semibold text-white"
          >
            <IconeWhatsapp /> Falar no WhatsApp
          </a>
        </div>
      )}
    </header>
  );
}
