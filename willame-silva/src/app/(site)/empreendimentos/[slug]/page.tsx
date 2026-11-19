import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bath, Building2, Car, Check, MapPin, Ruler, BedDouble, Sparkles, Tag } from "lucide-react";
import { Cabecalho } from "@/components/cabecalho";
import { Galeria } from "@/components/galeria";
import { FormContato } from "@/components/form-contato";
import { BotaoAgente } from "@/components/botao-agente";
import { CardEmpreendimento } from "@/components/vitrine";
import { IconeWhatsapp } from "@/components/marca";
import { buscarEmpreendimento, lerConfig, listarEmpreendimentos } from "@/lib/db";
import { corStatus, linkWhatsapp, moeda } from "@/lib/format";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const e = await buscarEmpreendimento((await params).slug);
  if (!e) return { title: "Empreendimento" };
  return {
    title: e.nome,
    description: e.chamada || e.descricao.slice(0, 150),
    openGraph: { images: e.capa ? [e.capa] : [] },
  };
}

function embedVideo(url: string) {
  const yt = url.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

export default async function Pagina({ params }: P) {
  const { slug } = await params;
  const [e, cfg, todos] = await Promise.all([buscarEmpreendimento(slug), lerConfig(), listarEmpreendimentos()]);
  if (!e || !e.publicado) notFound();

  const local = [e.bairro, e.cidade].filter(Boolean).join(" · ");
  const vendido = e.status === "100% vendido";
  const outros = todos.filter((x) => x.id !== e.id && x.status !== "100% vendido").slice(0, 3);
  const video = e.video_url ? embedVideo(e.video_url) : null;
  const imagens = e.imagens.length ? e.imagens : e.capa ? [e.capa] : [];
  const zap = linkWhatsapp(
    cfg.whatsapp,
    vendido
      ? `Olá, Willame! Vi que o ${e.nome} está 100% vendido. Quero entrar na lista de prioridade das próximas fases.`
      : `Olá, Willame! Vim pelo site e quero saber mais sobre o ${e.nome}.`,
  );

  const ficha = [
    { i: Building2, l: "Tipo", v: e.tipo },
    { i: MapPin, l: "Localização", v: local },
    { i: Ruler, l: "Área", v: e.area_min ? `${e.area_min}${e.area_max ? ` a ${e.area_max}` : ""} m²` : "" },
    { i: Tag, l: "Finalidade", v: e.finalidade },
    { i: BedDouble, l: "Quartos", v: e.quartos },
    { i: Bath, l: "Banheiros", v: e.banheiros },
    { i: Car, l: "Vagas", v: e.vagas },
    { i: Sparkles, l: "Realização", v: e.construtora },
  ].filter((x) => x.v);

  return (
    <main>
      <Cabecalho whatsapp={cfg.whatsapp} creci={cfg.creci} />

      {/* Abertura */}
      <section className="foto-fallback relative h-[72svh] min-h-[520px] overflow-hidden text-osso">
        {e.capa && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.capa} alt={e.nome} className="kenburns absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,26,44,.7),rgba(15,26,44,.15)_35%,rgba(15,26,44,.92))]" />
        <div className="relative mx-auto flex h-full max-w-[1320px] flex-col justify-end px-4 pb-14 sm:px-8">
          <Link href="/empreendimentos" className="rotulo mb-auto mt-32 flex w-fit items-center gap-2 text-osso/70 hover:text-osso">
            <ArrowLeft className="h-4 w-4" /> Todos os imóveis
          </Link>
          <span className={`subir mb-6 w-fit rounded-full px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-wider ${corStatus(e.status)}`}>{e.status}</span>
          <h1 className="font-display subir text-[clamp(40px,6vw,78px)] font-extrabold leading-[1]">{e.nome}</h1>
          <div className="mt-8 flex flex-col justify-between gap-6 border-t border-osso/20 pt-6 md:flex-row md:items-end">
            {e.chamada && <p className="max-w-xl text-[19px] leading-snug text-osso/85">{e.chamada}</p>}
            <div className="text-left md:text-right">
              <p className="rotulo text-osso/60">{vendido ? "Status" : /loca/i.test(e.finalidade) && !/venda/i.test(e.finalidade) ? "Aluguel" : "Investimento"}</p>
              <p className="font-display mt-1 text-[34px] font-extrabold text-sol">
                {vendido ? "Vendido" : e.preco_a_partir ? `${moeda(e.preco_a_partir)}${/loca/i.test(e.finalidade) && !/venda/i.test(e.finalidade) ? "/mês" : ""}` : "Sob consulta"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1320px] gap-14 px-4 py-20 sm:px-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <p className="rotulo mb-5 text-lagoa-2">Sobre o imóvel</p>
          <p className="text-[18px] leading-relaxed text-ink/80">{e.descricao}</p>

          {ficha.length > 0 && (
            <dl className="mt-14 grid gap-px overflow-hidden rounded-xl border border-ink/10 bg-ink/10 sm:grid-cols-2">
              {ficha.map((f) => (
                <div key={f.l} className="flex items-start gap-4 bg-white p-6">
                  <f.i className="mt-0.5 h-5 w-5 shrink-0 text-lagoa-2" />
                  <div>
                    <dt className="rotulo text-ink/50">{f.l}</dt>
                    <dd className="mt-1.5 text-[16px] font-semibold">{f.v}</dd>
                  </div>
                </div>
              ))}
            </dl>
          )}

          {e.diferenciais.length > 0 && (
            <div className="mt-16">
              <p className="rotulo mb-6 text-lagoa-2">Diferenciais</p>
              <ul className="grid gap-x-8 sm:grid-cols-2">
                {e.diferenciais.map((d) => (
                  <li key={d} className="flex items-center gap-4 border-b border-ink/10 py-4 text-[16px]">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-lagoa text-osso">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Lateral fixa */}
        <aside className="lg:col-span-4 lg:col-start-9">
          <div className="sticky top-28 rounded-2xl bg-ink p-6 text-osso sm:p-8">
            <p className="font-display text-[26px] font-extrabold leading-tight">
              {vendido ? (
                <>
                  Entre na <em className="text-sol">lista de prioridade</em>
                </>
              ) : (
                <>
                  Receba a <em className="text-sol">tabela atualizada</em>
                </>
              )}
            </p>
            <p className="mb-6 mt-3 text-[14.5px] text-osso/65">
              {vendido
                ? "Seja avisado antes de todo mundo quando abrirem novas fases."
                : "Plantas, valores e condições de pagamento direto no seu WhatsApp."}
            </p>
            <FormContato empreendimento={e.nome} escuro compacto />
            <div className="mt-6 grid gap-2 border-t border-osso/10 pt-6">
              <a href={zap} target="_blank" rel="noopener" className="flex items-center justify-center gap-2 rounded-full bg-zap py-3.5 text-[14.5px] font-semibold text-white hover:brightness-110">
                <IconeWhatsapp className="h-4 w-4" /> WhatsApp direto
              </a>
              <BotaoAgente
                mensagem={`Quero saber mais sobre o ${e.nome}`}
                className="rounded-full border border-osso/20 py-3.5 text-[14.5px] font-semibold hover:border-sol hover:text-sol"
              >
                Tirar dúvidas com o Agente 24h
              </BotaoAgente>
            </div>
          </div>
        </aside>
      </section>

      {imagens.length > 0 && (
        <section className="mx-auto max-w-[1320px] px-4 pb-20 sm:px-8">
          <p className="rotulo mb-6 text-lagoa-2">Galeria</p>
          <Galeria imagens={imagens} nome={e.nome} />
        </section>
      )}

      {(video || e.endereco_mapa) && (
        <section className="mx-auto grid max-w-[1320px] gap-6 px-4 pb-24 sm:px-8 lg:grid-cols-2">
          {video && (
            <div className="aspect-video overflow-hidden rounded-xl bg-ink">
              <iframe src={video} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen title={`Vídeo ${e.nome}`} />
            </div>
          )}
          {e.endereco_mapa && (
            <div className={`overflow-hidden rounded-xl border border-ink/10 ${video ? "aspect-video" : "aspect-[21/9] lg:col-span-2"}`}>
              <iframe
                src={`https://www.google.com/maps?q=${encodeURIComponent(e.endereco_mapa)}&output=embed`}
                className="h-full w-full grayscale-[.4]"
                loading="lazy"
                title={`Mapa ${e.nome}`}
              />
            </div>
          )}
        </section>
      )}

      {outros.length > 0 && (
        <section className="border-t border-ink/10 bg-areia/50">
          <div className="mx-auto max-w-[1320px] px-4 py-20 sm:px-8">
            <h2 className="font-display mb-12 text-5xl font-bold">
              Você também pode <span className="text-sol-2">gostar</span>
            </h2>
            <div className="grid gap-x-6 gap-y-12 md:grid-cols-3">
              {outros.map((o) => (
                <CardEmpreendimento key={o.id} e={o} />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
