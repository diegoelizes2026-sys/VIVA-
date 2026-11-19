import Link from "next/link";
import {
  ArrowRight,
  Building2,
  ChartNoAxesCombined,
  Clock3,
  FileSearch,
  Handshake,
  House,
  Instagram,
  KeyRound,
  Landmark,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { Cabecalho } from "@/components/cabecalho";
import { Carrossel } from "@/components/carrossel";
import { BuscaImoveis } from "@/components/busca-imoveis";
import { CardEmpreendimento } from "@/components/vitrine";
import { FormContato } from "@/components/form-contato";
import { BotaoAgente } from "@/components/botao-agente";
import { IconeWhatsapp, Monograma } from "@/components/marca";
import { lerConfig, listarEmpreendimentos, listarSlides } from "@/lib/db";
import { linkWhatsapp, telefoneBonito } from "@/lib/format";

const SELOS = [
  { i: ShieldCheck, t: "Segurança", d: "Negociações transparentes" },
  { i: Handshake, t: "Confiança", d: "Atendimento humanizado" },
  { i: Clock3, t: "Suporte 24h", d: "Fale com um corretor a qualquer hora" },
  { i: ChartNoAxesCombined, t: "Valorização", d: "As melhores oportunidades do mercado" },
];

const SERVICOS = [
  { i: House, t: "Compra", d: "Encontramos o imóvel certo para o seu momento e cuidamos de toda a negociação." },
  { i: KeyRound, t: "Locação", d: "Imóveis para alugar com contrato seguro e acompanhamento do início ao fim." },
  { i: Handshake, t: "Venda", d: "Divulgação profissional, avaliação justa e clientes qualificados para o seu imóvel." },
  { i: Building2, t: "Lançamentos", d: "Acesso antecipado aos melhores empreendimentos e condições de lançamento." },
  { i: Landmark, t: "Financiamento", d: "Simulação e apoio no crédito imobiliário, FGTS e consórcio." },
  { i: FileSearch, t: "Avaliação", d: "Saiba quanto vale o seu imóvel com uma análise completa de mercado." },
];

function TituloSecao({ children, acao }: { children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <h2 className="font-display border-l-4 border-sol pl-4 text-[clamp(26px,3vw,34px)] font-bold leading-tight text-ink">{children}</h2>
      {acao}
    </div>
  );
}

export default async function Home() {
  const [cfg, slides, emps] = await Promise.all([lerConfig(), listarSlides(), listarEmpreendimentos()]);
  const zap = linkWhatsapp(cfg.whatsapp, "Olá! Vim pelo site da Willame Negócios Imobiliário.");
  const destaques = [...emps].sort((a, b) => Number(b.destaque) - Number(a.destaque) || a.ordem - b.ordem).slice(0, 6);
  const tipos = [...new Set(emps.map((e) => e.tipo).filter(Boolean))];
  const cidades = [...new Set(emps.map((e) => e.cidade).filter(Boolean))];
  const numeros = [
    { v: cfg.anos_mercado, l: "anos de mercado" },
    { v: cfg.familias_atendidas, l: "famílias atendidas" },
    { v: cfg.vgv_negociado, l: "em negócios fechados" },
  ].filter((x) => x.v);

  return (
    <main className="bg-osso">
      <Cabecalho whatsapp={cfg.whatsapp} creci={cfg.creci} />
      {slides.length ? <Carrossel slides={slides} whatsapp={cfg.whatsapp} /> : <div className="h-[92px] bg-ink" />}

      {/* Busca sobreposta */}
      <div className="relative z-10 mx-auto -mt-[70px] max-w-[1180px] px-4 sm:px-8">
        <BuscaImoveis tipos={tipos} cidades={cidades} />
      </div>

      {/* Selos */}
      <section className="mx-auto max-w-[1180px] px-4 py-10 sm:px-8">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4 lg:divide-x lg:divide-ink/12">
          {SELOS.map((s) => (
            <div key={s.t} className="flex items-center gap-4 lg:justify-center lg:px-4">
              <s.i className="h-11 w-11 shrink-0 text-sol-2" strokeWidth={1.5} />
              <div>
                <p className="font-display text-[17px] font-bold text-ink">{s.t}</p>
                <p className="text-[13.5px] leading-snug text-ink/70">{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Destaques */}
      <section id="imoveis" className="mx-auto max-w-[1320px] scroll-mt-24 px-4 pb-20 pt-6 sm:px-8">
        <TituloSecao
          acao={
            <Link href="/empreendimentos" className="flex items-center gap-2 text-[16px] font-semibold text-sol-2 hover:underline">
              Ver todos os imóveis <ArrowRight className="h-5 w-5" />
            </Link>
          }
        >
          Imóveis em Destaque
        </TituloSecao>
        {destaques.length ? (
          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {destaques.map((e) => (
              <CardEmpreendimento key={e.id} e={e} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-white p-10 text-center text-ink/60">Novos imóveis em breve.</p>
        )}
      </section>

      {/* Sobre */}
      <section id="sobre" className="scroll-mt-20 bg-white">
        <div className="mx-auto grid max-w-[1320px] gap-12 px-4 py-20 sm:px-8 lg:grid-cols-2 lg:items-center">
          <div className="relative">
            <div className="foto-fallback relative aspect-[5/4] overflow-hidden rounded-2xl">
              {cfg.foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cfg.foto} alt={cfg.corretor_nome} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center">
                  <Monograma className="h-40 w-52" />
                </div>
              )}
            </div>
            <div className="absolute -bottom-6 right-6 rounded-xl bg-ink px-6 py-4 text-white shadow-xl">
              <p className="font-display text-[15px] font-bold text-sol">{cfg.corretor_nome}</p>
              <p className="text-[13px] text-white/75">Corretor de imóveis{cfg.creci ? ` · CRECI ${cfg.creci}` : ""}</p>
            </div>
          </div>
          <div>
            <p className="font-display mb-3 text-[14px] font-bold uppercase tracking-[0.16em] text-sol-2">Sobre nós</p>
            <h2 className="font-display text-[clamp(28px,3.4vw,42px)] font-extrabold leading-tight text-ink">
              Seu imóvel, <span className="text-sol-2">nosso compromisso.</span>
            </h2>
            <p className="mt-5 text-[17px] font-semibold leading-relaxed text-ink/85">{cfg.manifesto}</p>
            <p className="mt-4 text-[16px] leading-relaxed text-ink/70">{cfg.bio}</p>
            {numeros.length > 0 && (
              <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-ink/10 pt-6">
                {numeros.map((x) => (
                  <div key={x.l}>
                    <dt className="font-display text-[34px] font-extrabold leading-none text-sol-2">{x.v}</dt>
                    <dd className="mt-1.5 text-[13.5px] text-ink/65">{x.l}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={zap} target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-lg bg-zap px-6 py-3.5 font-semibold text-white hover:brightness-110">
                <IconeWhatsapp className="h-5 w-5" /> Falar no WhatsApp
              </a>
              {cfg.instagram && (
                <a
                  href={`https://instagram.com/${cfg.instagram.replace("@", "")}`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-2 rounded-lg border-2 border-ink/15 px-6 py-3 font-semibold text-ink hover:border-ink"
                >
                  <Instagram className="h-5 w-5" /> @{cfg.instagram.replace("@", "")}
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Serviços */}
      <section id="servicos" className="mx-auto max-w-[1320px] scroll-mt-20 px-4 py-20 sm:px-8">
        <TituloSecao>Nossos Serviços</TituloSecao>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICOS.map((s) => (
            <div key={s.t} className="group rounded-xl border border-ink/10 bg-white p-7 transition hover:-translate-y-1 hover:border-sol hover:shadow-lg">
              <span className="grid h-14 w-14 place-items-center rounded-xl bg-ink text-sol transition group-hover:bg-sol group-hover:text-ink">
                <s.i className="h-7 w-7" strokeWidth={1.6} />
              </span>
              <h3 className="font-display mt-5 text-[20px] font-bold text-ink">{s.t}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink/70">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Agente 24h */}
      <section className="px-4 sm:px-8">
        <div className="relative mx-auto max-w-[1320px] overflow-hidden rounded-2xl bg-ink text-white">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-sol/20 blur-3xl" />
          <div className="relative grid gap-10 px-6 py-14 sm:px-12 lg:grid-cols-[1.3fr_1fr] lg:items-center">
            <div>
              <p className="font-display mb-3 flex items-center gap-2 text-[14px] font-bold uppercase tracking-[0.16em] text-sol">
                <span className="h-2.5 w-2.5 rounded-full bg-zap" /> Online agora
              </p>
              <h2 className="font-display text-[clamp(28px,3.4vw,42px)] font-extrabold leading-tight">
                Atendimento <span className="text-sol">24 horas</span>, todos os dias.
              </h2>
              <p className="mt-4 max-w-xl text-[16.5px] leading-relaxed text-white/80">
                O nosso Agente 24h entende o que você procura, indica os imóveis certos e já te conecta com o corretor no WhatsApp — sem você precisar repetir nada.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <BotaoAgente className="flex items-center justify-center gap-3 rounded-lg bg-gradient-to-b from-[#e7bd55] to-sol-2 px-7 py-4 text-[16px] font-bold text-ink hover:brightness-110">
                <MessageCircle className="h-5 w-5" /> Conversar com o Agente 24h
              </BotaoAgente>
              <a href={zap} target="_blank" rel="noopener" className="flex items-center justify-center gap-3 rounded-lg border-2 border-white/80 px-7 py-3.5 text-[16px] font-semibold hover:bg-white hover:text-ink">
                <IconeWhatsapp className="h-5 w-5" /> {cfg.whatsapp ? telefoneBonito(cfg.whatsapp) : "WhatsApp"}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Contato */}
      <section id="contato" className="mx-auto max-w-[1320px] scroll-mt-20 px-4 py-20 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <TituloSecao>Fale Conosco</TituloSecao>
            <p className="max-w-md text-[16.5px] leading-relaxed text-ink/70">
              Deixe seu contato e um corretor te chama no WhatsApp. Atendemos {cfg.regiao_atuacao}.
            </p>
            <ul className="mt-8 space-y-4 text-[16px]">
              <li>
                <a href={zap} target="_blank" rel="noopener" className="flex items-center gap-3 font-semibold text-ink hover:text-sol-2">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-zap text-white"><IconeWhatsapp className="h-5 w-5" /></span>
                  {cfg.whatsapp ? telefoneBonito(cfg.whatsapp) : "WhatsApp"}
                </a>
              </li>
              {cfg.instagram && (
                <li>
                  <a href={`https://instagram.com/${cfg.instagram.replace("@", "")}`} target="_blank" rel="noopener" className="flex items-center gap-3 font-semibold text-ink hover:text-sol-2">
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-ink text-sol"><Instagram className="h-5 w-5" /></span>
                    @{cfg.instagram.replace("@", "")}
                  </a>
                </li>
              )}
            </ul>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-[0_10px_40px_-20px_rgba(15,26,44,.4)] sm:p-8">
            <FormContato />
          </div>
        </div>
      </section>
    </main>
  );
}
