import Link from "next/link";
import { Instagram, Mail } from "lucide-react";
import type { Configuracoes, Empreendimento } from "@/lib/types";
import { linkWhatsapp, telefoneBonito } from "@/lib/format";
import { IconeWhatsapp, Logo } from "./marca";

export function Rodape({ cfg, emps }: { cfg: Configuracoes; emps: Empreendimento[] }) {
  return (
    <footer className="grao relative overflow-hidden bg-ink text-osso">
      <div className="mx-auto max-w-[1400px] px-4 pt-20 sm:px-8">
        <p className="font-display max-w-4xl text-[clamp(36px,5.5vw,80px)] font-light leading-[0.98]">
          O próximo capítulo da sua família <em className="text-sol">começa com uma boa conversa.</em>
        </p>
        <div className="mt-16 grid gap-12 border-t border-osso/10 py-14 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo claro creci={cfg.creci} />
            <p className="mt-6 max-w-sm text-[14.5px] leading-relaxed text-osso/60">{cfg.regiao_atuacao}</p>
          </div>
          <div>
            <p className="rotulo mb-5 text-osso/45">Empreendimentos</p>
            <ul className="space-y-2.5 text-[14.5px]">
              {emps.slice(0, 6).map((e) => (
                <li key={e.id}>
                  <Link href={`/empreendimentos/${e.slug}`} className="text-osso/80 hover:text-sol">
                    {e.nome}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="rotulo mb-5 text-osso/45">Contato</p>
            <ul className="space-y-3 text-[14.5px] text-osso/80">
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
      <div className="border-t border-osso/10">
        <div className="mx-auto flex max-w-[1400px] flex-col justify-between gap-2 px-4 py-6 text-[12px] text-osso/40 sm:flex-row sm:px-8">
          <span>© {new Date().getFullYear()} {cfg.corretor_nome} · Corretor de imóveis{cfg.creci ? ` · CRECI ${cfg.creci}` : ""}</span>
          <span>Imagens meramente ilustrativas. Valores e disponibilidade sujeitos a alteração.</span>
        </div>
      </div>
      <div aria-hidden className="font-display pointer-events-none select-none whitespace-nowrap px-4 pb-2 text-center text-[17vw] font-light leading-[0.8] text-osso/[0.04]">
        Willame Silva
      </div>
    </footer>
  );
}
