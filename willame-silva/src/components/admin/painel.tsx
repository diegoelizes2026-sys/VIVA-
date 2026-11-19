"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  Building2,
  Columns3,
  Database,
  ExternalLink,
  Flame,
  GalleryHorizontalEnd,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  Settings,
  Users,
  X,
} from "lucide-react";
import type { Configuracoes, Empreendimento, Etapa, Lead, Slide } from "@/lib/types";
import { dataCurta } from "@/lib/format";
import { IconeWhatsapp, Logo } from "@/components/marca";
import { api } from "./api";
import { CartaoLead, DetalheLead, Kanban, TabelaLeads } from "./crm";
import { Ajustes, Carrossel, Empreendimentos } from "./conteudo";
import { Botao, Vazio } from "./ui";

type Cfg = Configuracoes & { _banco?: "supabase" | "arquivo"; _ia?: boolean };

const ABAS = [
  { id: "geral", nome: "Visão geral", i: LayoutDashboard },
  { id: "crm", nome: "CRM · Funil", i: Columns3 },
  { id: "leads", nome: "Leads", i: Users },
  { id: "empreendimentos", nome: "Empreendimentos", i: Building2 },
  { id: "carrossel", nome: "Carrossel", i: GalleryHorizontalEnd },
  { id: "config", nome: "Configurações", i: Settings },
] as const;
type Aba = (typeof ABAS)[number]["id"];

export function Painel() {
  const [aba, setAba] = useState<Aba>("geral");
  const [menu, setMenu] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [emps, setEmps] = useState<Empreendimento[]>([]);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [aberto, setAberto] = useState<Lead | null>(null);
  const [atualizando, setAtualizando] = useState(false);

  const carregarLeads = useCallback(async () => setLeads(await api<Lead[]>("leads")), []);
  const carregarConteudo = useCallback(async () => {
    const [e, s] = await Promise.all([api<Empreendimento[]>("empreendimentos"), api<Slide[]>("slides")]);
    setEmps(e);
    setSlides(s);
  }, []);
  const tudo = useCallback(async () => {
    setAtualizando(true);
    try {
      await Promise.all([carregarLeads(), carregarConteudo(), api<Cfg>("config").then(setCfg)]);
    } finally {
      setAtualizando(false);
    }
  }, [carregarLeads, carregarConteudo]);

  useEffect(() => {
    const ab = new URLSearchParams(location.hash.slice(1)).get("aba") as Aba | null;
    if (ab && ABAS.some((a) => a.id === ab)) setAba(ab);
    tudo();
    const t = setInterval(() => carregarLeads().catch(() => {}), 20000);
    return () => clearInterval(t);
  }, [tudo, carregarLeads]);

  function irPara(a: Aba) {
    setAba(a);
    setMenu(false);
    history.replaceState(null, "", `#aba=${a}`);
  }

  async function mover(id: string, etapa: Etapa) {
    const l = leads.find((x) => x.id === id);
    if (!l || l.etapa === etapa) return;
    setLeads((ls) => ls.map((x) => (x.id === id ? { ...x, etapa } : x)));
    await api("leads", { method: "POST", body: { id, etapa } }).catch(() => carregarLeads());
  }

  const titulo = ABAS.find((a) => a.id === aba)!.nome;
  const quentes = leads.filter((l) => l.temperatura === "quente" && !["fechado", "perdido"].includes(l.etapa));

  return (
    <div className="min-h-svh bg-[#f3eee4] lg:grid lg:grid-cols-[260px_1fr]">
      {/* Lateral */}
      <aside
        className={`grao fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-ink p-5 text-osso transition-transform lg:sticky lg:top-0 lg:h-svh lg:translate-x-0 ${menu ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between">
          <Logo claro creci={cfg?.creci} />
          <button onClick={() => setMenu(false)} className="lg:hidden"><X /></button>
        </div>
        <nav className="mt-10 flex-1 space-y-1">
          {ABAS.map((a) => (
            <button
              key={a.id}
              onClick={() => irPara(a.id)}
              className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-[14.5px] font-medium transition ${aba === a.id ? "bg-osso text-ink" : "text-osso/70 hover:bg-osso/10 hover:text-osso"}`}
            >
              <a.i className="h-[18px] w-[18px]" />
              {a.nome}
              {a.id === "crm" && quentes.length > 0 && (
                <span className="ml-auto rounded-full bg-coral px-2 py-0.5 text-[11px] font-bold text-white">{quentes.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="space-y-1 border-t border-osso/10 pt-4">
          <a href="/" target="_blank" className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[14px] text-osso/70 hover:bg-osso/10">
            <ExternalLink className="h-4 w-4" /> Ver site
          </a>
          <button
            onClick={async () => {
              await fetch("/api/admin/login", { method: "DELETE" });
              location.href = "/admin/login";
            }}
            className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[14px] text-osso/70 hover:bg-osso/10"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>
      {menu && <div className="fixed inset-0 z-30 bg-ink/40 lg:hidden" onClick={() => setMenu(false)} />}

      {/* Conteúdo */}
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-ink/10 bg-[#f3eee4]/85 px-4 py-4 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setMenu(true)} className="grid h-10 w-10 place-items-center rounded-full bg-white lg:hidden"><Menu className="h-5 w-5" /></button>
            <h1 className="font-display text-3xl font-light sm:text-4xl">{titulo}</h1>
          </div>
          <Botao variante="claro" onClick={tudo} disabled={atualizando}>
            <RefreshCw className={`h-4 w-4 ${atualizando ? "animate-spin" : ""}`} /> <span className="hidden sm:inline">Atualizar</span>
          </Botao>
        </header>

        <main className="px-4 py-8 sm:px-8">
          {cfg && (cfg._banco === "arquivo" || !cfg._ia || !cfg.whatsapp) && aba === "geral" && <Avisos cfg={cfg} onIr={irPara} onSeed={tudo} vazio={!emps.length} />}

          {aba === "geral" && <VisaoGeral leads={leads} emps={emps} onAbrir={setAberto} onIr={irPara} />}
          {aba === "crm" && (
            <>
              <p className="mb-5 text-[14px] text-ink/55">Arraste os cartões entre as colunas para mover o lead no funil. Toque para ver a conversa e os dados completos.</p>
              <Kanban leads={leads} onAbrir={setAberto} onMover={mover} />
            </>
          )}
          {aba === "leads" && <TabelaLeads leads={leads} onAbrir={setAberto} />}
          {aba === "empreendimentos" && <Empreendimentos lista={emps} onMudou={carregarConteudo} />}
          {aba === "carrossel" && <Carrossel lista={slides} emps={emps} onMudou={carregarConteudo} />}
          {aba === "config" && cfg && <Ajustes inicial={cfg} onSalvo={(c) => setCfg((x) => ({ ...x, ...c }))} />}
        </main>
      </div>

      {aberto && (
        <DetalheLead
          key={aberto.id}
          lead={aberto}
          onFechar={() => setAberto(null)}
          onSalvo={(l) => {
            setLeads((ls) => ls.map((x) => (x.id === l.id ? l : x)));
            setAberto(null);
          }}
          onRemovido={(id) => {
            setLeads((ls) => ls.filter((x) => x.id !== id));
            setAberto(null);
          }}
        />
      )}
    </div>
  );
}

function Avisos({ cfg, onIr, onSeed, vazio }: { cfg: Cfg; onIr: (a: Aba) => void; onSeed: () => void; vazio: boolean }) {
  return (
    <div className="mb-8 grid gap-3 md:grid-cols-3">
      {!cfg.whatsapp && (
        <button onClick={() => onIr("config")} className="rounded-3xl border border-coral/25 bg-white p-5 text-left">
          <IconeWhatsapp className="h-5 w-5 text-coral" />
          <p className="mt-3 font-semibold">Cadastre seu WhatsApp</p>
          <p className="mt-1 text-[13px] text-ink/55">É para onde o Agente 24h envia os clientes. Toque para configurar.</p>
        </button>
      )}
      {!cfg._ia && (
        <div className="rounded-3xl border border-sol/40 bg-white p-5">
          <Bot className="h-5 w-5 text-sol-2" />
          <p className="mt-3 font-semibold">Agente em modo roteiro</p>
          <p className="mt-1 text-[13px] text-ink/55">Ele já qualifica com perguntas prontas. Adicione a ANTHROPIC_API_KEY na Vercel para ativar a conversa com IA.</p>
        </div>
      )}
      {cfg._banco === "arquivo" && (
        <div className="rounded-3xl border border-sol/40 bg-white p-5">
          <Database className="h-5 w-5 text-sol-2" />
          <p className="mt-3 font-semibold">Banco de dados temporário</p>
          <p className="mt-1 text-[13px] text-ink/55">Conecte o Supabase (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY) para os leads ficarem salvos para sempre.</p>
        </div>
      )}
      {cfg._banco === "supabase" && vazio && (
        <div className="rounded-3xl border border-lagoa/30 bg-white p-5">
          <Database className="h-5 w-5 text-lagoa" />
          <p className="mt-3 font-semibold">Banco conectado e vazio</p>
          <p className="mt-1 text-[13px] text-ink/55">Quer importar os empreendimentos e slides de exemplo para editar?</p>
          <Botao className="mt-3" onClick={async () => { await api("seed", { method: "POST", body: {} }); onSeed(); }}>Importar exemplos</Botao>
        </div>
      )}
    </div>
  );
}

function VisaoGeral({ leads, emps, onAbrir, onIr }: { leads: Lead[]; emps: Empreendimento[]; onAbrir: (l: Lead) => void; onIr: (a: Aba) => void }) {
  const hoje = new Date().toDateString();
  const k = useMemo(() => {
    const doDia = leads.filter((l) => new Date(l.created_at).toDateString() === hoje);
    const comZap = leads.filter((l) => l.telefone);
    const quentes = leads.filter((l) => l.temperatura === "quente");
    const agente = leads.filter((l) => l.origem.includes("Agente"));
    const fechados = leads.filter((l) => l.etapa === "fechado");
    return { doDia, comZap, quentes, agente, fechados };
  }, [leads, hoje]);

  const porEmp = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of leads) {
      for (const e of emps) if (l.empreendimento_interesse.toLowerCase().includes(e.nome.toLowerCase())) m.set(e.nome, (m.get(e.nome) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [leads, emps]);
  const max = Math.max(1, ...porEmp.map((x) => x[1]));

  const ultimos7 = useMemo(() => {
    const dias = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    });
    return dias.map((d) => ({
      d,
      n: leads.filter((l) => new Date(l.created_at).toDateString() === d.toDateString()).length,
    }));
  }, [leads]);
  const max7 = Math.max(1, ...ultimos7.map((x) => x.n));

  const kpis = [
    { l: "Leads hoje", v: k.doDia.length, s: `${leads.length} no total` },
    { l: "Com WhatsApp", v: k.comZap.length, s: `${leads.length ? Math.round((k.comZap.length / leads.length) * 100) : 0}% de conversão` },
    { l: "Leads quentes", v: k.quentes.length, s: "prontos para atender", destaque: true },
    { l: "Via Agente 24h", v: k.agente.length, s: `${k.fechados.length} negócios fechados` },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((x) => (
          <div key={x.l} className={`rounded-3xl p-5 sm:p-6 ${x.destaque ? "grao relative overflow-hidden bg-ink text-osso" : "bg-white"}`}>
            <p className={`text-[13px] font-medium ${x.destaque ? "text-osso/60" : "text-ink/55"}`}>{x.l}</p>
            <p className="font-display mt-3 flex items-center gap-2 text-5xl font-light">
              {x.v} {x.destaque && x.v > 0 && <Flame className="h-6 w-6 text-coral" />}
            </p>
            <p className={`mt-2 text-[12.5px] ${x.destaque ? "text-osso/50" : "text-ink/45"}`}>{x.s}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-3xl bg-white p-6 xl:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <p className="font-display text-2xl">Atender agora</p>
            <button onClick={() => onIr("crm")} className="text-[13px] font-semibold text-lagoa hover:underline">Abrir funil →</button>
          </div>
          {!leads.length ? (
            <Vazio titulo="Ainda sem leads" texto="Abra o site, converse com o Agente 24h e veja o lead aparecer aqui em tempo real." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {[...leads]
                .filter((l) => !["fechado", "perdido"].includes(l.etapa))
                .sort((a, b) => b.pontuacao - a.pontuacao || +new Date(b.updated_at) - +new Date(a.updated_at))
                .slice(0, 6)
                .map((l) => (
                  <CartaoLead key={l.id} l={l} onAbrir={() => onAbrir(l)} />
                ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl bg-white p-6">
            <p className="font-display text-2xl">Últimos 7 dias</p>
            <div className="mt-6 flex h-36 items-end gap-2">
              {ultimos7.map((x) => (
                <div key={x.d.toISOString()} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-[11px] font-semibold text-ink/50">{x.n || ""}</span>
                  <div className="w-full rounded-t-lg bg-lagoa transition-all" style={{ height: `${Math.max(4, (x.n / max7) * 100)}px`, opacity: x.n ? 1 : 0.15 }} />
                  <span className="text-[10.5px] uppercase text-ink/45">{x.d.toLocaleDateString("pt-BR", { weekday: "short" }).slice(0, 3)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl bg-white p-6">
            <p className="font-display text-2xl">Mais procurados</p>
            {!porEmp.length ? (
              <p className="mt-3 text-[13.5px] text-ink/50">Aparece quando os leads citarem empreendimentos.</p>
            ) : (
              <ul className="mt-5 space-y-3.5">
                {porEmp.map(([nome, n]) => (
                  <li key={nome}>
                    <div className="mb-1.5 flex justify-between text-[13.5px]">
                      <span className="font-medium">{nome}</span>
                      <span className="text-ink/50">{n}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-ink/5">
                      <div className="h-full rounded-full bg-sol" style={{ width: `${(n / max) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {leads.length > 0 && (
        <div className="rounded-3xl bg-white p-6">
          <p className="font-display mb-4 text-2xl">Atividade recente</p>
          <ul className="divide-y divide-ink/5">
            {leads.slice(0, 8).map((l) => (
              <li key={l.id}>
                <button onClick={() => onAbrir(l)} className="flex w-full items-center gap-4 py-3 text-left hover:bg-osso/60">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-osso text-[13px] font-bold">{(l.nome || "?")[0].toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{l.nome || "Visitante"} <span className="font-normal text-ink/45">· {l.origem}</span></span>
                    <span className="block truncate text-[13px] text-ink/55">{l.busca || l.conversa.at(-1)?.content || "—"}</span>
                  </span>
                  <span className="shrink-0 text-[12px] text-ink/45">{dataCurta(l.updated_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
