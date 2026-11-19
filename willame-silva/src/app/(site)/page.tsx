import { ArrowUpRight, Instagram, MessageCircle } from "lucide-react";
import { Cabecalho } from "@/components/cabecalho";
import { Carrossel } from "@/components/carrossel";
import { Vitrine } from "@/components/vitrine";
import { FormContato } from "@/components/form-contato";
import { BotaoAgente } from "@/components/botao-agente";
import { IconeWhatsapp, Monograma } from "@/components/marca";
import { lerConfig, listarEmpreendimentos, listarSlides } from "@/lib/db";
import { linkWhatsapp, telefoneBonito } from "@/lib/format";

const FAIXA = ["Lançamentos", "Lotes em condomínio", "Beira-lagoa", "Bairros planejados", "Segunda moradia", "Investimento", "Casas de alto padrão"];

const METODO = [
  { n: "01", t: "Escuta", d: "Antes de mostrar qualquer imóvel, entendo sua fase de vida, seu orçamento real e o que não pode faltar." },
  { n: "02", t: "Curadoria", d: "Filtro o mercado e trago só o que faz sentido — com números, comparativos e minha opinião sincera." },
  { n: "03", t: "Visita", d: "Vou junto. Mostro o que o folder não mostra: entorno, acessos, obra e potencial de valorização." },
  { n: "04", t: "Chaves", d: "Cuido da proposta, documentação e financiamento até a assinatura. Depois disso, continuo por perto." },
];

function Selo() {
  return (
    <svg viewBox="0 0 200 200" className="girar-lento h-36 w-36 text-ink" aria-hidden>
      <defs>
        <path id="circ" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
      </defs>
      <text className="rotulo" fill="currentColor" style={{ fontSize: 13.5, letterSpacing: "0.32em" }}>
        <textPath href="#circ">Willame Silva · Corretor de imóveis · Ceará ·</textPath>
      </text>
    </svg>
  );
}

export default async function Home() {
  const [cfg, slides, emps] = await Promise.all([lerConfig(), listarSlides(), listarEmpreendimentos()]);
  const zap = linkWhatsapp(cfg.whatsapp, "Olá, Willame! Vim pelo seu site e quero conversar sobre imóveis.");
  const numeros = [
    { v: cfg.anos_mercado, l: "anos de mercado" },
    { v: cfg.familias_atendidas, l: "famílias atendidas" },
    { v: cfg.vgv_negociado, l: "em negócios fechados" },
  ].filter((x) => x.v);

  return (
    <main>
      <Cabecalho whatsapp={cfg.whatsapp} creci={cfg.creci} sobreFoto={slides.length > 0} />
      {slides.length ? <Carrossel slides={slides} regiao={cfg.regiao_atuacao} /> : <div className="h-28" />}

      {/* Faixa */}
      <div className="overflow-hidden border-b border-ink/10 bg-areia py-5">
        <div className="marquee flex w-max gap-10">
          {[...FAIXA, ...FAIXA].map((f, k) => (
            <span key={k} className="font-display flex items-center gap-10 whitespace-nowrap text-[26px] font-light italic text-ink/80">
              {f} <span className="text-sol not-italic">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* Empreendimentos */}
      <section id="empreendimentos" className="mx-auto max-w-[1400px] scroll-mt-24 px-4 py-24 sm:px-8 sm:py-32">
        <div className="mb-14 grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="rotulo mb-5 text-lagoa-2">01 — Curadoria</p>
            <h2 className="font-display text-[clamp(40px,5.6vw,84px)] font-light leading-[0.95]">
              Empreendimentos onde eu <em className="text-lagoa-2">colocaria</em> a minha família.
            </h2>
          </div>
          <p className="max-w-md text-[16.5px] leading-relaxed text-ink/65 lg:col-span-4 lg:col-start-9">
            Uma seleção enxuta, visitada e analisada de perto. Toque em um empreendimento para ver fotos, diferenciais e pedir a tabela atualizada.
          </p>
        </div>
        <Vitrine empreendimentos={emps} />
      </section>

      {/* O corretor */}
      <section id="corretor" className="scroll-mt-20 bg-areia/60">
        <div className="mx-auto grid max-w-[1400px] gap-14 px-4 py-24 sm:px-8 sm:py-32 lg:grid-cols-12 lg:items-center">
          <div className="relative lg:col-span-5">
            <div className="foto-fallback grao relative aspect-[4/5] overflow-hidden rounded-[28px]">
              {cfg.foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cfg.foto} alt={cfg.corretor_nome} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full flex-col justify-between p-8 text-osso">
                  <Monograma className="h-20 w-20 text-osso/90" />
                  <p className="font-display text-6xl font-light leading-[0.9]">
                    Willame
                    <br />
                    <em className="text-sol">Silva</em>
                  </p>
                </div>
              )}
            </div>
            <div className="absolute -bottom-10 -right-4 grid place-items-center rounded-full bg-osso p-2 shadow-xl sm:-right-10">
              <Selo />
              <span className="font-display absolute text-3xl italic text-lagoa-2">ws</span>
            </div>
          </div>

          <div className="lg:col-span-6 lg:col-start-7">
            <p className="rotulo mb-5 text-lagoa-2">02 — O corretor</p>
            <blockquote className="font-display text-[clamp(30px,3.6vw,52px)] font-light leading-[1.08]">
              <span className="text-sol">“</span>
              {cfg.manifesto}
              <span className="text-sol">”</span>
            </blockquote>
            <p className="mt-8 max-w-xl text-[16.5px] leading-relaxed text-ink/70">{cfg.bio}</p>

            {numeros.length > 0 && (
              <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-ink/15 pt-8">
                {numeros.map((x) => (
                  <div key={x.l}>
                    <dt className="font-display text-[clamp(32px,4vw,54px)] font-light leading-none">{x.v}</dt>
                    <dd className="mt-2 text-[13px] text-ink/60">{x.l}</dd>
                  </div>
                ))}
              </dl>
            )}

            <div className="mt-10 flex flex-wrap gap-3">
              <a href={zap} target="_blank" rel="noopener" className="flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[14.5px] font-semibold text-osso hover:bg-lagoa">
                <IconeWhatsapp className="h-4 w-4" /> Conversar com o Willame
              </a>
              {cfg.instagram && (
                <a
                  href={`https://instagram.com/${cfg.instagram.replace("@", "")}`}
                  target="_blank"
                  rel="noopener"
                  className="flex items-center gap-2 rounded-full border border-ink/20 px-6 py-3.5 text-[14.5px] font-semibold hover:border-ink"
                >
                  <Instagram className="h-4 w-4" /> @{cfg.instagram.replace("@", "")}
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Método */}
      <section id="metodo" className="mx-auto max-w-[1400px] scroll-mt-20 px-4 py-24 sm:px-8 sm:py-32">
        <div className="mb-16 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="rotulo mb-5 text-lagoa-2">03 — Como trabalho</p>
            <h2 className="font-display max-w-3xl text-[clamp(40px,5.6vw,84px)] font-light leading-[0.95]">
              Do primeiro “oi” <em className="text-lagoa-2">às chaves na mão.</em>
            </h2>
          </div>
        </div>
        <ol className="grid border-t border-ink/15 md:grid-cols-2 lg:grid-cols-4">
          {METODO.map((m, k) => (
            <li key={m.n} className={`group relative py-10 pr-8 ${k > 0 ? "lg:border-l lg:pl-8" : ""} border-ink/15 max-lg:border-b md:max-lg:odd:border-r md:max-lg:even:pl-8`}>
              <span className="absolute -top-[5px] left-0 h-2.5 w-2.5 rounded-full bg-sol transition group-hover:scale-150 lg:left-8 lg:first:left-0" />
              <p className="font-display text-[15px] italic text-lagoa-2">{m.n}</p>
              <h3 className="font-display mt-6 text-4xl font-light">{m.t}</h3>
              <p className="mt-4 text-[15px] leading-relaxed text-ink/65">{m.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Agente 24h */}
      <section className="px-4 sm:px-8">
        <div className="grao relative mx-auto max-w-[1400px] overflow-hidden rounded-[36px] bg-ink text-osso">
          <div className="absolute -left-32 -top-32 h-[480px] w-[480px] rounded-full bg-lagoa-2/40 blur-[110px]" />
          <div className="absolute -bottom-40 right-0 h-[420px] w-[420px] rounded-full bg-sol/20 blur-[120px]" />
          <div className="relative grid gap-14 px-6 py-16 sm:px-14 sm:py-20 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="rotulo mb-5 flex items-center gap-2 text-sol">
                <span className="h-2 w-2 rounded-full bg-zap" /> Online agora · 24 horas por dia
              </p>
              <h2 className="font-display text-[clamp(40px,5vw,76px)] font-light leading-[0.95]">
                São 3 da manhã e bateu a vontade de ver imóvel? <em className="text-sol">Eu atendo.</em>
              </h2>
              <p className="mt-6 max-w-lg text-[16.5px] leading-relaxed text-osso/70">
                O Agente 24h entende o que você procura, mostra os empreendimentos que combinam com o seu perfil e já te conecta com o Willame no WhatsApp — com tudo explicado, sem você precisar repetir nada.
              </p>
              <BotaoAgente className="group mt-9 inline-flex items-center gap-3 rounded-full bg-sol py-2 pl-6 pr-2 text-[15px] font-semibold text-ink transition hover:bg-osso">
                Conversar com o Agente 24h
                <span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-osso transition group-hover:rotate-45">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </BotaoAgente>
            </div>

            {/* Prévia da conversa */}
            <div className="relative mx-auto w-full max-w-md">
              <div className="space-y-3 rounded-[28px] border border-osso/10 bg-osso/[0.04] p-5 backdrop-blur">
                {[
                  { u: false, t: "Oi! Está buscando para morar ou para investir?" },
                  { u: true, t: "Investir. Quero um lote perto da praia" },
                  { u: false, t: "Ótimo! Qual faixa de investimento fica confortável para você?" },
                  { u: true, t: "Até uns 250 mil, parcelado" },
                  { u: false, t: "Separei 2 opções que encaixam. Me passa seu WhatsApp que o Willame te envia a tabela?" },
                ].map((m, k) => (
                  <div key={k} className={`flex ${m.u ? "justify-end" : ""}`}>
                    <p className={`max-w-[82%] rounded-[18px] px-4 py-2.5 text-[14px] ${m.u ? "rounded-br-md bg-lagoa-2 text-osso" : "rounded-bl-md bg-osso text-ink"}`}>{m.t}</p>
                  </div>
                ))}
                <div className="flex items-center gap-3 rounded-2xl bg-zap p-3 text-white">
                  <IconeWhatsapp className="h-6 w-6" />
                  <span className="text-[14px] font-semibold">Perfil enviado ao Willame</span>
                </div>
              </div>
              <div className="absolute -right-3 -top-4 rotate-6 rounded-full bg-sol px-4 py-2 text-[12px] font-bold uppercase tracking-wider text-ink shadow-lg">
                Filtra · Qualifica · Conecta
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contato */}
      <section id="contato" className="mx-auto max-w-[1400px] scroll-mt-20 px-4 py-24 sm:px-8 sm:py-32">
        <div className="grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className="rotulo mb-5 text-lagoa-2">04 — Contato</p>
            <h2 className="font-display text-[clamp(40px,5.6vw,84px)] font-light leading-[0.95]">
              Vamos encontrar o <em className="text-lagoa-2">seu</em> lugar.
            </h2>
            <p className="mt-6 max-w-md text-[16.5px] leading-relaxed text-ink/65">
              Deixe seu contato e eu te chamo no WhatsApp. Se preferir, fale direto comigo ou com o Agente 24h.
            </p>
            <div className="mt-10 space-y-4">
              <a href={zap} target="_blank" rel="noopener" className="group flex items-center justify-between border-b border-ink/15 pb-4">
                <span className="flex items-center gap-4">
                  <IconeWhatsapp className="h-6 w-6 text-zap" />
                  <span className="font-display text-2xl">{cfg.whatsapp ? telefoneBonito(cfg.whatsapp) : "WhatsApp"}</span>
                </span>
                <ArrowUpRight className="h-5 w-5 transition group-hover:rotate-45" />
              </a>
              <BotaoAgente className="group flex w-full items-center justify-between border-b border-ink/15 pb-4 text-left">
                <span className="flex items-center gap-4">
                  <MessageCircle className="h-6 w-6 text-lagoa-2" />
                  <span className="font-display text-2xl">Agente 24h</span>
                </span>
                <ArrowUpRight className="h-5 w-5 transition group-hover:rotate-45" />
              </BotaoAgente>
            </div>
          </div>
          <div className="lg:col-span-5 lg:col-start-8">
            <div className="rounded-[28px] border border-ink/10 bg-white/60 p-6 sm:p-8">
              <FormContato />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
