"use client";

import { useMemo, useState } from "react";
import { Bot, Download, MessageSquareText, Phone, Search, Trash2, X } from "lucide-react";
import { ETAPAS, type Etapa, type Lead, type Temperatura } from "@/lib/types";
import { dataCurta, linkWhatsapp, telefoneBonito } from "@/lib/format";
import { IconeWhatsapp } from "@/components/marca";
import { Botao, Campo, inputCls, PontoTemperatura, Vazio } from "./ui";
import { api } from "./api";

const COR_ETAPA: Record<Etapa, string> = {
  novo: "bg-sol",
  atendimento: "bg-lagoa-2",
  visita: "bg-espuma",
  proposta: "bg-coral",
  fechado: "bg-zap",
  perdido: "bg-ink/30",
};

export function CartaoLead({ l, onAbrir, arrastavel }: { l: Lead; onAbrir: () => void; arrastavel?: boolean }) {
  return (
    <button
      draggable={arrastavel}
      onDragStart={(e) => e.dataTransfer.setData("text/lead", l.id)}
      onClick={onAbrir}
      className="block w-full rounded-2xl border border-ink/8 bg-white p-3.5 text-left shadow-[0_1px_0_rgba(11,31,30,.04)] transition hover:-translate-y-0.5 hover:border-lagoa/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-[14.5px] font-semibold">{l.nome || "Visitante sem nome"}</p>
        <PontoTemperatura t={l.temperatura} />
      </div>
      <p className="mt-0.5 text-[12.5px] text-ink/55">{l.telefone ? telefoneBonito(l.telefone) : "sem telefone ainda"}</p>
      {l.busca && <p className="mt-2 line-clamp-2 text-[12.5px] leading-snug text-ink/75">{l.busca}</p>}
      <div className="mt-3 flex items-center justify-between text-[11px] text-ink/45">
        <span className="flex items-center gap-1 truncate">
          {l.origem.includes("Agente") ? <Bot className="h-3 w-3" /> : <MessageSquareText className="h-3 w-3" />}
          {l.origem}
        </span>
        <span className="shrink-0">{dataCurta(l.updated_at)}</span>
      </div>
      {l.encaminhado_whatsapp && (
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-zap/10 px-2 py-0.5 text-[10.5px] font-semibold text-zap">
          <IconeWhatsapp className="h-3 w-3" /> Chamou no WhatsApp
        </span>
      )}
    </button>
  );
}

export function Kanban({ leads, onAbrir, onMover }: { leads: Lead[]; onAbrir: (l: Lead) => void; onMover: (id: string, etapa: Etapa) => void }) {
  const [sobre, setSobre] = useState<string | null>(null);
  return (
    <div className="sem-barra -mx-4 flex gap-4 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8">
      {ETAPAS.map((et) => {
        const lista = leads.filter((l) => l.etapa === et.id);
        return (
          <div
            key={et.id}
            onDragOver={(e) => {
              e.preventDefault();
              setSobre(et.id);
            }}
            onDragLeave={() => setSobre(null)}
            onDrop={(e) => {
              const id = e.dataTransfer.getData("text/lead");
              setSobre(null);
              if (id) onMover(id, et.id);
            }}
            className={`flex w-[290px] shrink-0 flex-col rounded-3xl p-3 transition ${sobre === et.id ? "bg-lagoa/10 ring-2 ring-lagoa/30" : "bg-ink/[0.035]"}`}
          >
            <div className="mb-3 flex items-center justify-between px-1.5">
              <span className="flex items-center gap-2 text-[13.5px] font-semibold">
                <span className={`h-2 w-2 rounded-full ${COR_ETAPA[et.id]}`} />
                {et.nome}
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[12px] font-semibold text-ink/60">{lista.length}</span>
            </div>
            <div className="flex min-h-[120px] flex-col gap-2.5">
              {lista.map((l) => (
                <CartaoLead key={l.id} l={l} onAbrir={() => onAbrir(l)} arrastavel />
              ))}
              {!lista.length && <p className="px-2 py-6 text-center text-[12px] text-ink/35">Arraste leads para cá</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TabelaLeads({ leads, onAbrir }: { leads: Lead[]; onAbrir: (l: Lead) => void }) {
  const [q, setQ] = useState("");
  const [temp, setTemp] = useState<"" | Temperatura>("");
  const filtrados = useMemo(() => {
    const t = q.toLowerCase();
    return leads.filter(
      (l) =>
        (!temp || l.temperatura === temp) &&
        (!t || [l.nome, l.telefone, l.busca, l.empreendimento_interesse, l.regiao].join(" ").toLowerCase().includes(t)),
    );
  }, [leads, q, temp]);

  function exportar() {
    const cols: (keyof Lead)[] = ["nome", "telefone", "email", "busca", "objetivo", "tipo_imovel", "regiao", "empreendimento_interesse", "orcamento", "prazo", "forma_pagamento", "temperatura", "pontuacao", "etapa", "origem", "created_at"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.join(";"), ...filtrados.map((l) => cols.map((c) => esc(l[c])).join(";"))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `leads-willame-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, telefone, interesse…" className={`${inputCls} pl-10`} />
        </div>
        {(["", "quente", "morno", "frio"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTemp(t)}
            className={`rounded-full border px-3.5 py-2 text-[13px] font-medium ${temp === t ? "border-ink bg-ink text-osso" : "border-ink/15 bg-white"}`}
          >
            {t ? <span className="flex items-center gap-1.5"><PontoTemperatura t={t} />{t[0].toUpperCase() + t.slice(1)}</span> : "Todos"}
          </button>
        ))}
        <Botao variante="claro" onClick={exportar}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Botao>
      </div>
      {!filtrados.length ? (
        <Vazio titulo="Nenhum lead" texto="Quando alguém conversar com o Agente 24h ou preencher um formulário, aparece aqui." />
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-ink/10 bg-white">
          <table className="w-full min-w-[860px] text-left text-[13.5px]">
            <thead className="border-b border-ink/10 text-[11.5px] uppercase tracking-wider text-ink/50">
              <tr>
                <th className="px-4 py-3 font-semibold">Lead</th>
                <th className="px-4 py-3 font-semibold">WhatsApp</th>
                <th className="px-4 py-3 font-semibold">O que busca</th>
                <th className="px-4 py-3 font-semibold">Orçamento</th>
                <th className="px-4 py-3 font-semibold">Etapa</th>
                <th className="px-4 py-3 font-semibold">Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((l) => (
                <tr key={l.id} onClick={() => onAbrir(l)} className="cursor-pointer border-b border-ink/5 last:border-0 hover:bg-osso">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2 font-semibold">
                      <PontoTemperatura t={l.temperatura} /> {l.nome || "—"}
                    </span>
                    <span className="text-[11.5px] text-ink/45">{l.origem}</span>
                  </td>
                  <td className="px-4 py-3">
                    {l.telefone ? (
                      <a href={linkWhatsapp(l.telefone, `Olá, ${l.nome.split(" ")[0]}! Aqui é o Willame Silva.`)} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 font-medium text-zap hover:underline">
                        <IconeWhatsapp className="h-3.5 w-3.5" /> {telefoneBonito(l.telefone)}
                      </a>
                    ) : (
                      <span className="text-ink/35">—</span>
                    )}
                  </td>
                  <td className="max-w-[320px] px-4 py-3">
                    <span className="line-clamp-2">{l.busca || l.empreendimento_interesse || "—"}</span>
                  </td>
                  <td className="px-4 py-3">{l.orcamento || "—"}</td>
                  <td className="px-4 py-3">{ETAPAS.find((e) => e.id === l.etapa)?.nome}</td>
                  <td className="px-4 py-3 text-ink/55">{dataCurta(l.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const CAMPOS_PERFIL: { k: keyof Lead; l: string }[] = [
  { k: "objetivo", l: "Objetivo" },
  { k: "tipo_imovel", l: "Tipo de imóvel" },
  { k: "regiao", l: "Região" },
  { k: "empreendimento_interesse", l: "Empreendimento de interesse" },
  { k: "orcamento", l: "Orçamento" },
  { k: "prazo", l: "Prazo" },
  { k: "forma_pagamento", l: "Pagamento" },
  { k: "email", l: "E-mail" },
];

export function DetalheLead({
  lead,
  onFechar,
  onSalvo,
  onRemovido,
}: {
  lead: Lead;
  onFechar: () => void;
  onSalvo: (l: Lead) => void;
  onRemovido: (id: string) => void;
}) {
  const [l, setL] = useState(lead);
  const [salvando, setSalvando] = useState(false);
  const [aba, setAba] = useState<"perfil" | "conversa">("perfil");
  const set = <K extends keyof Lead>(k: K, v: Lead[K]) => setL((x) => ({ ...x, [k]: v }));

  async function salvar() {
    setSalvando(true);
    try {
      onSalvo(await api<Lead>("leads", { method: "POST", body: l }));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm" onClick={onFechar}>
      <div className="flex h-full w-full max-w-xl flex-col bg-osso shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="grao relative shrink-0 overflow-hidden bg-ink p-6 text-osso">
          <div className="flex items-start justify-between">
            <div>
              <p className="rotulo text-osso/50">{l.origem} · {dataCurta(l.created_at)}</p>
              <input
                value={l.nome}
                onChange={(e) => set("nome", e.target.value)}
                placeholder="Nome do lead"
                className="font-display mt-2 w-full bg-transparent text-4xl font-light placeholder:text-osso/30 focus:outline-none"
              />
            </div>
            <button onClick={onFechar} className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-osso/10">
              <X />
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {l.telefone && (
              <a
                href={linkWhatsapp(l.telefone, `Olá, ${l.nome.split(" ")[0] || ""}! Aqui é o Willame Silva, corretor. Recebi seu contato pelo site 🙂`)}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 rounded-full bg-zap px-4 py-2 text-[13.5px] font-semibold text-white"
              >
                <IconeWhatsapp className="h-4 w-4" /> Chamar no WhatsApp
              </a>
            )}
            {l.telefone && (
              <a href={`tel:+${l.telefone.length <= 11 ? "55" + l.telefone : l.telefone}`} className="inline-flex items-center gap-2 rounded-full border border-osso/20 px-4 py-2 text-[13.5px] font-semibold">
                <Phone className="h-4 w-4" /> Ligar
              </a>
            )}
            <span className="ml-auto rounded-full bg-osso/10 px-3 py-1.5 text-[12px] font-semibold">Pontuação {l.pontuacao}/100</span>
          </div>
        </div>

        <div className="flex shrink-0 gap-1 border-b border-ink/10 px-6">
          {(["perfil", "conversa"] as const).map((a) => (
            <button key={a} onClick={() => setAba(a)} className={`border-b-2 px-3 py-3 text-[14px] font-semibold capitalize ${aba === a ? "border-lagoa text-ink" : "border-transparent text-ink/45"}`}>
              {a === "conversa" ? `Conversa (${l.conversa.length})` : "Perfil"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {aba === "perfil" ? (
            <div className="space-y-5">
              <Campo label="O que está buscando">
                <textarea rows={2} className={inputCls} value={l.busca} onChange={(e) => set("busca", e.target.value)} />
              </Campo>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo label="WhatsApp">
                  <input className={inputCls} value={l.telefone} onChange={(e) => set("telefone", e.target.value.replace(/\D/g, ""))} />
                </Campo>
                <Campo label="Etapa">
                  <select className={inputCls} value={l.etapa} onChange={(e) => set("etapa", e.target.value as Etapa)}>
                    {ETAPAS.map((e) => (
                      <option key={e.id} value={e.id}>{e.nome}</option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Temperatura">
                  <select className={inputCls} value={l.temperatura} onChange={(e) => set("temperatura", e.target.value as Temperatura)}>
                    <option value="quente">Quente</option>
                    <option value="morno">Morno</option>
                    <option value="frio">Frio</option>
                  </select>
                </Campo>
                {CAMPOS_PERFIL.map((c) => (
                  <Campo key={c.k} label={c.l}>
                    <input className={inputCls} value={String(l[c.k] ?? "")} onChange={(e) => set(c.k, e.target.value as never)} />
                  </Campo>
                ))}
              </div>
              <Campo label="Anotações do corretor">
                <textarea rows={4} className={inputCls} value={l.notas} onChange={(e) => set("notas", e.target.value)} placeholder="Ex.: visita marcada sábado 10h no Lagoar…" />
              </Campo>
            </div>
          ) : (
            <div className="space-y-3">
              {!l.conversa.length && <p className="text-[14px] text-ink/50">Lead de formulário — sem conversa com o agente.</p>}
              {l.conversa.map((m, k) => (
                <div key={k} className={`flex ${m.role === "user" ? "justify-end" : ""}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] ${m.role === "user" ? "rounded-br-md bg-lagoa text-osso" : "rounded-bl-md border border-ink/10 bg-white"}`}>
                    <p className="whitespace-pre-line">{m.content}</p>
                    {m.at && <p className={`mt-1 text-[10.5px] ${m.role === "user" ? "text-osso/50" : "text-ink/35"}`}>{dataCurta(m.at)}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-ink/10 bg-white p-4">
          <Botao
            variante="perigo"
            onClick={async () => {
              if (!confirm("Excluir este lead definitivamente?")) return;
              await api(`leads?id=${l.id}`, { method: "DELETE" });
              onRemovido(l.id);
            }}
          >
            <Trash2 className="h-4 w-4" /> Excluir
          </Botao>
          <Botao onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar alterações"}
          </Botao>
        </div>
      </div>
    </div>
  );
}
