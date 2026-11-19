import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import path from "path";
import { SEED_CONFIG, SEED_EMPREENDIMENTOS, SEED_SLIDES } from "./seed";
import type { Configuracoes, Empreendimento, Lead, Slide } from "./types";

/**
 * Camada de dados.
 * - Com SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY: usa o Postgres do Supabase (produção).
 * - Sem eles: usa um arquivo JSON local (.data/db.json) — ótimo para testar,
 *   mas na Vercel esse arquivo é temporário. Configure o Supabase antes de divulgar o site.
 */

type Tabelas = {
  empreendimentos: Empreendimento;
  slides: Slide;
  leads: Lead;
  configuracoes: Configuracoes;
};
type NomeTabela = keyof Tabelas;

// Prefixo das tabelas no Supabase (o projeto é compartilhado com outros apps).
const TABELA: Record<NomeTabela, string> = {
  empreendimentos: "ws_empreendimentos",
  slides: "ws_slides",
  leads: "ws_leads",
  configuracoes: "ws_configuracoes",
};

let _sb: SupabaseClient | null = null;
function supabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!_sb) _sb = createClient(url, key, { auth: { persistSession: false } });
  return _sb;
}

export function modoBanco(): "supabase" | "arquivo" {
  return supabase() ? "supabase" : "arquivo";
}

// ---------- backend em arquivo ----------
type Arquivo = { [K in NomeTabela]: Tabelas[K][] };
const DIR = process.env.VERCEL ? "/tmp/willame-data" : path.join(process.cwd(), ".data");
const FILE = path.join(DIR, "db.json");
let cache: Arquivo | null = null;
let fila: Promise<unknown> = Promise.resolve();

async function lerArquivo(): Promise<Arquivo> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(FILE, "utf8")) as Arquivo;
  } catch {
    cache = {
      empreendimentos: structuredClone(SEED_EMPREENDIMENTOS),
      slides: structuredClone(SEED_SLIDES),
      leads: [],
      configuracoes: [structuredClone(SEED_CONFIG)],
    };
    await salvarArquivo();
  }
  return cache!;
}
async function salvarArquivo() {
  if (!cache) return;
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(cache, null, 2));
}
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const p = fila.then(fn, fn);
  fila = p.catch(() => undefined);
  return p;
}

// ---------- API genérica ----------
async function listar<K extends NomeTabela>(t: K, ordem?: { col: string; asc: boolean }): Promise<Tabelas[K][]> {
  const sb = supabase();
  if (sb) {
    let q = sb.from(TABELA[t]).select("*");
    if (ordem) q = q.order(ordem.col, { ascending: ordem.asc });
    const { data, error } = await q;
    if (error) throw new Error(`[${t}] ${error.message}`);
    return (data ?? []) as Tabelas[K][];
  }
  const db = await lerArquivo();
  const rows = [...(db[t] as Tabelas[K][])];
  if (ordem) {
    rows.sort((a, b) => {
      const va = (a as Record<string, unknown>)[ordem.col] as string | number;
      const vb = (b as Record<string, unknown>)[ordem.col] as string | number;
      const r = va < vb ? -1 : va > vb ? 1 : 0;
      return ordem.asc ? r : -r;
    });
  }
  return rows;
}

async function upsert<K extends NomeTabela>(t: K, row: Tabelas[K]): Promise<Tabelas[K]> {
  const sb = supabase();
  if (sb) {
    const { data, error } = await sb.from(TABELA[t]).upsert(row).select().single();
    if (error) throw new Error(`[${t}] ${error.message}`);
    return data as Tabelas[K];
  }
  return serial(async () => {
    const db = await lerArquivo();
    const arr = db[t] as Tabelas[K][];
    const i = arr.findIndex((r) => (r as { id: unknown }).id === (row as { id: unknown }).id);
    if (i >= 0) arr[i] = row;
    else arr.push(row);
    await salvarArquivo();
    return row;
  });
}

async function remover(t: NomeTabela, id: string | number) {
  const sb = supabase();
  if (sb) {
    const { error } = await sb.from(TABELA[t]).delete().eq("id", id);
    if (error) throw new Error(`[${t}] ${error.message}`);
    return;
  }
  await serial(async () => {
    const db = await lerArquivo();
    (db[t] as { id: unknown }[]) = (db[t] as { id: unknown }[]).filter((r) => r.id !== id);
    await salvarArquivo();
  });
}

export const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

// ---------- Empreendimentos ----------
export async function listarEmpreendimentos(apenasPublicados = true) {
  const rows = await listar("empreendimentos", { col: "ordem", asc: true });
  return apenasPublicados ? rows.filter((e) => e.publicado) : rows;
}
export async function buscarEmpreendimento(slug: string) {
  const rows = await listarEmpreendimentos(false);
  return rows.find((e) => e.slug === slug) ?? null;
}
export async function salvarEmpreendimento(e: Empreendimento) {
  return upsert("empreendimentos", { ...e, updated_at: now() });
}
export const removerEmpreendimento = (id: string) => remover("empreendimentos", id);

// ---------- Slides ----------
export async function listarSlides(apenasAtivos = true) {
  const rows = await listar("slides", { col: "ordem", asc: true });
  return apenasAtivos ? rows.filter((s) => s.ativo) : rows;
}
export const salvarSlide = (s: Slide) => upsert("slides", s);
export const removerSlide = (id: string) => remover("slides", id);

// ---------- Leads ----------
export const listarLeads = () => listar("leads", { col: "updated_at", asc: false });
export async function buscarLeadPorSessao(sessionId: string) {
  const sb = supabase();
  if (sb) {
    const { data } = await sb.from(TABELA.leads).select("*").eq("session_id", sessionId).maybeSingle();
    return (data as Lead) ?? null;
  }
  const rows = await listar("leads");
  return rows.find((l) => l.session_id === sessionId) ?? null;
}
export async function buscarLead(id: string) {
  const rows = await listar("leads");
  return rows.find((l) => l.id === id) ?? null;
}
export function novoLead(p: Partial<Lead>): Lead {
  return {
    id: uid(),
    session_id: null,
    nome: "",
    telefone: "",
    email: "",
    busca: "",
    objetivo: "",
    tipo_imovel: "",
    regiao: "",
    empreendimento_interesse: "",
    orcamento: "",
    prazo: "",
    forma_pagamento: "",
    temperatura: "frio",
    pontuacao: 0,
    etapa: "novo",
    origem: "site",
    conversa: [],
    notas: "",
    encaminhado_whatsapp: false,
    created_at: now(),
    updated_at: now(),
    ...p,
  };
}
export async function salvarLead(l: Lead) {
  return upsert("leads", { ...l, updated_at: now() });
}
export const removerLead = (id: string) => remover("leads", id);

// ---------- Configurações ----------
export async function lerConfig(): Promise<Configuracoes> {
  const rows = await listar("configuracoes");
  return { ...SEED_CONFIG, ...(rows[0] ?? {}) };
}
export async function salvarConfig(c: Configuracoes) {
  return upsert("configuracoes", { ...c, id: 1, updated_at: now() });
}
