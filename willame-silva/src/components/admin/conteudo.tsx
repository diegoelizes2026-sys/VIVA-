"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, ExternalLink, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { STATUS_OPCOES, TIPO_OPCOES, type Configuracoes, type Empreendimento, type Slide } from "@/lib/types";
import { corStatus, moeda } from "@/lib/format";
import { Titulo } from "@/components/marca";
import { api } from "./api";
import { Botao, Campo, inputCls, ListaImagens, SeletorImagem, Toggle, Vazio } from "./ui";

// ======================= Empreendimentos =======================

const novoEmp = (): Empreendimento => ({
  id: "",
  slug: "",
  nome: "",
  chamada: "",
  descricao: "",
  cidade: "",
  bairro: "",
  tipo: TIPO_OPCOES[0],
  status: "Lançamento",
  preco_a_partir: null,
  area_min: null,
  area_max: null,
  quartos: "",
  diferenciais: [],
  capa: "",
  imagens: [],
  video_url: "",
  endereco_mapa: "",
  construtora: "",
  destaque: false,
  publicado: true,
  ordem: 0,
  created_at: "",
  updated_at: "",
});

export function Empreendimentos({ lista, onMudou }: { lista: Empreendimento[]; onMudou: () => void }) {
  const [editando, setEditando] = useState<Empreendimento | null>(null);

  async function alternar(e: Empreendimento, campo: "publicado" | "destaque") {
    await api("empreendimentos", { method: "POST", body: { ...e, [campo]: !e[campo] } });
    onMudou();
  }
  async function mover(i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= lista.length) return;
    const a = lista[i];
    const b = lista[j];
    await Promise.all([
      api("empreendimentos", { method: "POST", body: { ...a, ordem: j + 1 } }),
      api("empreendimentos", { method: "POST", body: { ...b, ordem: i + 1 } }),
    ]);
    onMudou();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-[14px] text-ink/55">{lista.length} empreendimentos · a ordem aqui é a ordem do site</p>
        <Botao onClick={() => setEditando(novoEmp())}>
          <Plus className="h-4 w-4" /> Lançar empreendimento
        </Botao>
      </div>
      {!lista.length ? (
        <Vazio titulo="Nenhum empreendimento" texto="Cadastre o primeiro para ele aparecer no site e no Agente 24h." />
      ) : (
        <div className="grid gap-3">
          {lista.map((e, i) => (
            <div key={e.id} className={`flex items-center gap-4 rounded-3xl border border-ink/10 bg-white p-3 pr-4 ${e.publicado ? "" : "opacity-60"}`}>
              <div className="foto-fallback relative h-20 w-28 shrink-0 overflow-hidden rounded-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {e.capa && <img src={e.capa} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display text-2xl leading-none">{e.nome}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase ${corStatus(e.status)} ring-1 ring-ink/10`}>{e.status}</span>
                  {e.destaque && <Star className="h-4 w-4 fill-sol text-sol" />}
                </div>
                <p className="mt-1 truncate text-[13px] text-ink/55">
                  {e.tipo} · {e.cidade || "sem cidade"} · {e.preco_a_partir ? moeda(e.preco_a_partir) : "sob consulta"}
                </p>
              </div>
              <div className="hidden items-center gap-1 sm:flex">
                <button onClick={() => mover(i, -1)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-osso" title="Subir"><ArrowUp className="h-4 w-4" /></button>
                <button onClick={() => mover(i, 1)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-osso" title="Descer"><ArrowDown className="h-4 w-4" /></button>
                <button onClick={() => alternar(e, "destaque")} className="grid h-9 w-9 place-items-center rounded-full hover:bg-osso" title="Destaque"><Star className={`h-4 w-4 ${e.destaque ? "fill-sol text-sol" : ""}`} /></button>
                <button onClick={() => alternar(e, "publicado")} className="grid h-9 w-9 place-items-center rounded-full hover:bg-osso" title={e.publicado ? "Ocultar do site" : "Publicar"}>
                  {e.publicado ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <a href={`/empreendimentos/${e.slug}`} target="_blank" className="grid h-9 w-9 place-items-center rounded-full hover:bg-osso" title="Ver no site"><ExternalLink className="h-4 w-4" /></a>
              </div>
              <Botao variante="claro" onClick={() => setEditando(e)}>
                <Pencil className="h-4 w-4" /> Editar
              </Botao>
            </div>
          ))}
        </div>
      )}
      {editando && (
        <EditorEmpreendimento
          inicial={editando}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            onMudou();
          }}
        />
      )}
    </div>
  );
}

function Gaveta({ titulo, onFechar, children, rodape }: { titulo: string; onFechar: () => void; children: React.ReactNode; rodape: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm" onClick={onFechar}>
      <div className="flex h-full w-full max-w-2xl flex-col bg-osso shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-ink/10 px-6 py-5">
          <p className="font-display text-3xl">{titulo}</p>
          <button onClick={onFechar} className="grid h-10 w-10 place-items-center rounded-full hover:bg-ink/5"><X /></button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-6">{children}</div>
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-ink/10 bg-white p-4">{rodape}</div>
      </div>
    </div>
  );
}

function EditorEmpreendimento({ inicial, onFechar, onSalvo }: { inicial: Empreendimento; onFechar: () => void; onSalvo: () => void }) {
  const [e, setE] = useState(inicial);
  const [difs, setDifs] = useState(inicial.diferenciais.join("\n"));
  const [salvando, setSalvando] = useState(false);
  const set = <K extends keyof Empreendimento>(k: K, v: Empreendimento[K]) => setE((x) => ({ ...x, [k]: v }));
  const num = (v: string) => (v === "" ? null : Number(v.replace(/\D/g, "")));

  async function salvar() {
    setSalvando(true);
    try {
      await api("empreendimentos", { method: "POST", body: { ...e, diferenciais: difs.split("\n") } });
      onSalvo();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Gaveta
      titulo={e.id ? `Editar ${inicial.nome}` : "Novo empreendimento"}
      onFechar={onFechar}
      rodape={
        <>
          {e.id ? (
            <Botao
              variante="perigo"
              onClick={async () => {
                if (!confirm(`Excluir ${e.nome}?`)) return;
                await api(`empreendimentos?id=${e.id}`, { method: "DELETE" });
                onSalvo();
              }}
            >
              <Trash2 className="h-4 w-4" /> Excluir
            </Botao>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-4">
            <Toggle ligado={e.publicado} onChange={(v) => set("publicado", v)} label="Publicado" />
            <Botao onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : e.id ? "Salvar" : "Lançar no site"}</Botao>
          </div>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nome *"><input className={inputCls} value={e.nome} onChange={(x) => set("nome", x.target.value)} placeholder="Ex.: Lagoar" /></Campo>
        <Campo label="Status">
          <select className={inputCls} value={e.status} onChange={(x) => set("status", x.target.value as Empreendimento["status"])}>
            {STATUS_OPCOES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Campo>
      </div>
      <Campo label="Frase de impacto" dica="Aparece no card e no topo da página.">
        <input className={inputCls} value={e.chamada} onChange={(x) => set("chamada", x.target.value)} placeholder="A vida à beira da lagoa, com alma de resort." />
      </Campo>
      <Campo label="Descrição">
        <textarea rows={5} className={inputCls} value={e.descricao} onChange={(x) => set("descricao", x.target.value)} />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo label="Tipo">
          <select className={inputCls} value={e.tipo} onChange={(x) => set("tipo", x.target.value)}>
            {[...new Set([...TIPO_OPCOES, e.tipo])].map((s) => <option key={s}>{s}</option>)}
          </select>
        </Campo>
        <Campo label="Cidade"><input className={inputCls} value={e.cidade} onChange={(x) => set("cidade", x.target.value)} placeholder="Aquiraz · CE" /></Campo>
        <Campo label="Bairro / região"><input className={inputCls} value={e.bairro} onChange={(x) => set("bairro", x.target.value)} /></Campo>
        <Campo label="Preço a partir de (R$)" dica="Deixe vazio para 'sob consulta'.">
          <input className={inputCls} inputMode="numeric" value={e.preco_a_partir ?? ""} onChange={(x) => set("preco_a_partir", num(x.target.value))} />
        </Campo>
        <Campo label="Área mín. (m²)"><input className={inputCls} inputMode="numeric" value={e.area_min ?? ""} onChange={(x) => set("area_min", num(x.target.value))} /></Campo>
        <Campo label="Área máx. (m²)"><input className={inputCls} inputMode="numeric" value={e.area_max ?? ""} onChange={(x) => set("area_max", num(x.target.value))} /></Campo>
        <Campo label="Plantas / quartos"><input className={inputCls} value={e.quartos} onChange={(x) => set("quartos", x.target.value)} placeholder="2 e 3 suítes" /></Campo>
        <Campo label="Construtora / incorporadora" className="sm:col-span-2"><input className={inputCls} value={e.construtora} onChange={(x) => set("construtora", x.target.value)} /></Campo>
      </div>
      <Campo label="Diferenciais" dica="Um por linha.">
        <textarea rows={5} className={inputCls} value={difs} onChange={(x) => setDifs(x.target.value)} placeholder={"Frente para a lagoa\nPiscina com borda infinita"} />
      </Campo>
      <SeletorImagem rotulo="Foto de capa" valor={e.capa} onChange={(v) => set("capa", v)} />
      <ListaImagens valor={e.imagens} onChange={(v) => set("imagens", v)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Vídeo (YouTube ou Vimeo)"><input className={inputCls} value={e.video_url} onChange={(x) => set("video_url", x.target.value)} placeholder="https://youtube.com/…" /></Campo>
        <Campo label="Endereço para o mapa"><input className={inputCls} value={e.endereco_mapa} onChange={(x) => set("endereco_mapa", x.target.value)} placeholder="Rua, cidade - CE" /></Campo>
      </div>
      <Toggle ligado={e.destaque} onChange={(v) => set("destaque", v)} label="Destaque (aparece primeiro na vitrine)" />
    </Gaveta>
  );
}

// ======================= Carrossel =======================

const novoSlide = (): Slide => ({
  id: "",
  sobretitulo: "",
  titulo: "",
  subtitulo: "",
  imagem: "",
  cta_texto: "Saiba mais",
  cta_link: "",
  ordem: 0,
  ativo: true,
  created_at: "",
});

export function Carrossel({ lista, emps, onMudou }: { lista: Slide[]; emps: Empreendimento[]; onMudou: () => void }) {
  const [editando, setEditando] = useState<Slide | null>(null);

  async function mover(i: number, d: number) {
    const ids = lista.map((s) => s.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await api("slides-ordem", { method: "POST", body: { ids } });
    onMudou();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-[14px] text-ink/55">Banners da página inicial. Use *asteriscos* para destacar palavras em itálico dourado.</p>
        <Botao onClick={() => setEditando(novoSlide())}>
          <Plus className="h-4 w-4" /> Novo slide
        </Botao>
      </div>
      {!lista.length && <Vazio titulo="Carrossel vazio" texto="Sem slides ativos, o site abre direto na vitrine." />}
      <div className="grid gap-4 md:grid-cols-2">
        {lista.map((s, i) => (
          <div key={s.id} className={`group overflow-hidden rounded-3xl border border-ink/10 bg-white ${s.ativo ? "" : "opacity-55"}`}>
            <div className="foto-fallback relative aspect-[16/8] overflow-hidden text-osso">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {s.imagem && <img src={s.imagem} alt="" className="absolute inset-0 h-full w-full object-cover" />}
              <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <p className="rotulo !text-[9.5px] text-sol">{s.sobretitulo}</p>
                <p className="font-display mt-1 line-clamp-2 text-2xl font-light leading-tight"><Titulo texto={s.titulo} /></p>
              </div>
              <span className="font-display absolute left-4 top-3 text-lg italic text-osso/80">{String(i + 1).padStart(2, "0")}</span>
            </div>
            <div className="flex items-center justify-between gap-2 p-3">
              <div className="flex gap-1">
                <button onClick={() => mover(i, -1)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-osso" title="Mover para antes"><ArrowUp className="h-4 w-4 -rotate-90" /></button>
                <button onClick={() => mover(i, 1)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-osso" title="Mover para depois"><ArrowDown className="h-4 w-4 -rotate-90" /></button>
                <button
                  onClick={async () => {
                    await api("slides", { method: "POST", body: { ...s, ativo: !s.ativo } });
                    onMudou();
                  }}
                  className="grid h-9 w-9 place-items-center rounded-full hover:bg-osso"
                  title={s.ativo ? "Desativar" : "Ativar"}
                >
                  {s.ativo ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
              </div>
              <Botao variante="claro" onClick={() => setEditando(s)}><Pencil className="h-4 w-4" /> Editar</Botao>
            </div>
          </div>
        ))}
      </div>
      {editando && <EditorSlide inicial={editando} emps={emps} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); onMudou(); }} />}
    </div>
  );
}

function EditorSlide({ inicial, emps, onFechar, onSalvo }: { inicial: Slide; emps: Empreendimento[]; onFechar: () => void; onSalvo: () => void }) {
  const [s, setS] = useState(inicial);
  const set = <K extends keyof Slide>(k: K, v: Slide[K]) => setS((x) => ({ ...x, [k]: v }));
  const [salvando, setSalvando] = useState(false);

  return (
    <Gaveta
      titulo={s.id ? "Editar slide" : "Novo slide"}
      onFechar={onFechar}
      rodape={
        <>
          {s.id ? (
            <Botao
              variante="perigo"
              onClick={async () => {
                if (!confirm("Excluir este slide?")) return;
                await api(`slides?id=${s.id}`, { method: "DELETE" });
                onSalvo();
              }}
            >
              <Trash2 className="h-4 w-4" /> Excluir
            </Botao>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-4">
            <Toggle ligado={s.ativo} onChange={(v) => set("ativo", v)} label="Ativo" />
            <Botao
              disabled={salvando}
              onClick={async () => {
                setSalvando(true);
                try {
                  await api("slides", { method: "POST", body: s });
                  onSalvo();
                } catch (e) {
                  alert(e instanceof Error ? e.message : "Erro");
                } finally {
                  setSalvando(false);
                }
              }}
            >
              {salvando ? "Salvando…" : "Salvar slide"}
            </Botao>
          </div>
        </>
      }
    >
      <div className="foto-fallback relative aspect-[16/8] overflow-hidden rounded-3xl text-osso">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {s.imagem && <img src={s.imagem} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/25 to-ink/10" />
        <div className="absolute inset-x-0 bottom-0 p-6">
          <p className="rotulo !text-[10px] text-sol">{s.sobretitulo || "Sobretítulo"}</p>
          <p className="font-display mt-2 text-3xl font-light leading-tight"><Titulo texto={s.titulo || "Título do *slide*"} /></p>
          <p className="mt-2 line-clamp-2 text-[13px] text-osso/75">{s.subtitulo}</p>
        </div>
      </div>
      <SeletorImagem rotulo="Imagem de fundo (horizontal, 1920px+)" valor={s.imagem} onChange={(v) => set("imagem", v)} />
      <Campo label="Sobretítulo"><input className={inputCls} value={s.sobretitulo} onChange={(x) => set("sobretitulo", x.target.value)} placeholder="Lançamento · Lagoar" /></Campo>
      <Campo label="Título *" dica="Coloque entre *asteriscos* o trecho que deve ficar em itálico dourado.">
        <input className={inputCls} value={s.titulo} onChange={(x) => set("titulo", x.target.value)} placeholder="Viva onde os outros *passam férias*." />
      </Campo>
      <Campo label="Subtítulo"><textarea rows={2} className={inputCls} value={s.subtitulo} onChange={(x) => set("subtitulo", x.target.value)} /></Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Texto do botão"><input className={inputCls} value={s.cta_texto} onChange={(x) => set("cta_texto", x.target.value)} /></Campo>
        <Campo label="Link do botão">
          <input className={inputCls} list="links-emps" value={s.cta_link} onChange={(x) => set("cta_link", x.target.value)} placeholder="/empreendimentos/lagoar" />
          <datalist id="links-emps">
            {emps.map((e) => <option key={e.id} value={`/empreendimentos/${e.slug}`}>{e.nome}</option>)}
            <option value="#contato">Contato</option>
          </datalist>
        </Campo>
      </div>
    </Gaveta>
  );
}

// ======================= Configurações =======================

function Bloco({ t, d, children }: { t: string; d: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-b border-ink/10 py-8 lg:grid-cols-3">
      <div>
        <p className="font-display text-2xl">{t}</p>
        <p className="mt-1 text-[13.5px] text-ink/55">{d}</p>
      </div>
      <div className="space-y-4 lg:col-span-2">{children}</div>
    </section>
  )
}


export function Ajustes({ inicial, onSalvo }: { inicial: Configuracoes; onSalvo: (c: Configuracoes) => void }) {
  const [c, setC] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);
  const set = <K extends keyof Configuracoes>(k: K, v: Configuracoes[K]) => {
    setOk(false);
    setC((x) => ({ ...x, [k]: v }));
  };

  return (
    <div className="max-w-5xl">
      <Bloco t="WhatsApp do corretor" d="Para onde o Agente 24h e os formulários mandam os clientes.">
        <Campo label="WhatsApp com DDD *" dica="Ex.: 85 99999-9999">
          <input className={inputCls} value={c.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} inputMode="tel" />
        </Campo>
        {!c.whatsapp && <p className="rounded-xl bg-coral/10 px-4 py-3 text-[13.5px] text-coral">Sem número, os botões abrem o WhatsApp sem destinatário. Preencha antes de divulgar o site.</p>}
      </Bloco>
      <Bloco t="Perfil" d="Informações exibidas no site.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Nome"><input className={inputCls} value={c.corretor_nome} onChange={(e) => set("corretor_nome", e.target.value)} /></Campo>
          <Campo label="CRECI"><input className={inputCls} value={c.creci} onChange={(e) => set("creci", e.target.value)} placeholder="00000-F" /></Campo>
          <Campo label="Instagram"><input className={inputCls} value={c.instagram} onChange={(e) => set("instagram", e.target.value)} /></Campo>
          <Campo label="E-mail"><input className={inputCls} value={c.email} onChange={(e) => set("email", e.target.value)} /></Campo>
        </div>
        <Campo label="Região de atuação"><input className={inputCls} value={c.regiao_atuacao} onChange={(e) => set("regiao_atuacao", e.target.value)} /></Campo>
        <Campo label="Frase-manifesto"><textarea rows={2} className={inputCls} value={c.manifesto} onChange={(e) => set("manifesto", e.target.value)} /></Campo>
        <Campo label="Bio"><textarea rows={4} className={inputCls} value={c.bio} onChange={(e) => set("bio", e.target.value)} /></Campo>
        <SeletorImagem rotulo="Foto do corretor (vertical)" valor={c.foto} onChange={(v) => set("foto", v)} />
      </Bloco>
      <Bloco t="Números" d="Só aparecem no site se preenchidos. Use dados reais.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo label="Anos de mercado"><input className={inputCls} value={c.anos_mercado} onChange={(e) => set("anos_mercado", e.target.value)} placeholder="+8" /></Campo>
          <Campo label="Famílias atendidas"><input className={inputCls} value={c.familias_atendidas} onChange={(e) => set("familias_atendidas", e.target.value)} placeholder="+500" /></Campo>
          <Campo label="Negócios fechados"><input className={inputCls} value={c.vgv_negociado} onChange={(e) => set("vgv_negociado", e.target.value)} placeholder="R$ 50 mi" /></Campo>
        </div>
      </Bloco>
      <Bloco t="Agente 24h" d="Como o assistente se apresenta para o visitante.">
        <Campo label="Nome do agente"><input className={inputCls} value={c.agente_nome} onChange={(e) => set("agente_nome", e.target.value)} /></Campo>
        <Campo label="Mensagem de boas-vindas"><textarea rows={3} className={inputCls} value={c.agente_boas_vindas} onChange={(e) => set("agente_boas_vindas", e.target.value)} /></Campo>
      </Bloco>
      <div className="sticky bottom-0 flex items-center justify-end gap-3 bg-osso/90 py-4 backdrop-blur">
        {ok && <span className="text-[13.5px] font-semibold text-zap">Salvo ✓</span>}
        <Botao
          disabled={salvando}
          onClick={async () => {
            setSalvando(true);
            try {
              const r = await api<Configuracoes>("config", { method: "POST", body: c });
              onSalvo(r);
              setOk(true);
            } catch (e) {
              alert(e instanceof Error ? e.message : "Erro");
            } finally {
              setSalvando(false);
            }
          }}
        >
          {salvando ? "Salvando…" : "Salvar configurações"}
        </Botao>
      </div>
    </div>
  );
}
