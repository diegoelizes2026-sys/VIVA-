import Link from "next/link";
import { Instagram, Mail } from "lucide-react";
import type { Configuracoes, Empreendimento } from "@/lib/types";
import { linkWhatsapp, telefoneBonito } from "@/lib/format";
import { IconeWhatsapp, Logo } from "./marca";

export function Rodape({ cfg, emps }: { cfg: Configuracoes; emps: Empreendimento[] }) {
  return (
    <footer className="relative mt-20 overflow-hidden bg-ink text-white">
      <div className="mx-auto max-w-[1320px] px-4 pt-16 sm:px-8">
        <div className="grid gap-12 pb-14 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo claro creci={cfg.creci} />
            <p className="mt-6 max-w-sm text-[14.5px] leading-relaxed text-white/65">Compra, venda e locação de imóveis com segurança, transparência e atendimento personalizado. {cfg.regiao_atuacao}.</p>
          </div>
          <div>
            <p className="font-display mb-5 text-[15px] font-bold text-sol">Imóveis</p>
            <ul className="space-y-2.5 text-[14.5px]">
              {emps.slice(0, 6).map((e) => (
                <li key={e.id}>
                  <Link href={`/empreendimentos/${e.slug}`} className="text-white/80 hover:text-sol">
                    {e.nome}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-display mb-5 text-[15px] font-bold text-sol">Contato</p>
            <ul className="space-y-3 text-[14.5px] text-white/80">
              <li>
                <a href={linkWhatsapp(cfg.whatsapp, "Olá, Willame! Vim pelo seu site.")} target="_blank" rel="noopener" className="flex items-center gap-2 hover:text-sol">
                  <IconeWhatsapp className="h-4 w-4" /> {cfg.whatsapp ? telefoneBonito(cfg.whatsapp) : "WhatsApp"}
                </a>
              </li>
              {cfg.instagram && (
                <li>
                  <a href={`https://instagram.com/${cfg.instagram.replace("@", "")}`} target="_blank" rel="noopener" className="flex items-center gap-2 hover:text-sol">
                    <Instagram className="h-4 w-4" /> @{cfg.instagram.replace("@", "")}
                  </a>
                </li>
              )}
              {cfg.email && (
                <li>
                  <a href={`mailto:${cfg.email}`} className="flex items-center gap-2 hover:text-sol">
                    <Mail className="h-4 w-4" /> {cfg.email}
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1320px] flex-col justify-between gap-2 px-4 py-6 text-[12px] text-white/40 sm:flex-row sm:px-8">
          <span>© {new Date().getFullYear()} Willame Negócios Imobiliário{cfg.creci ? ` · CRECI ${cfg.creci}` : ""}</span>
          <span>Imagens meramente ilustrativas. Valores e disponibilidade sujeitos a alteração.</span>
        </div>
      </div>
    </footer>
  );
}
