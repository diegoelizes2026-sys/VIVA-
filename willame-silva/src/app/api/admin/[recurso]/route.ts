import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import * as db from "@/lib/db";
import { SEED_EMPREENDIMENTOS, SEED_SLIDES } from "@/lib/seed";
import { slugify } from "@/lib/format";
import type { Configuracoes, Empreendimento, Lead, Slide } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ recurso: string }> };
const ok = (data: unknown) => NextResponse.json(data);
const erro = (msg: string, status = 400) => NextResponse.json({ erro: msg }, { status });

function atualizarSite() {
  revalidatePath("/", "layout");
}

export async function GET(_req: Request, { params }: Ctx) {
  const { recurso } = await params;
  switch (recurso) {
    case "leads":
      return ok(await db.listarLeads());
    case "empreendimentos":
      return ok(await db.listarEmpreendimentos(false));
    case "slides":
      return ok(await db.listarSlides(false));
    case "config":
      return ok({ ...(await db.lerConfig()), _banco: db.modoBanco(), _ia: Boolean(process.env.ANTHROPIC_API_KEY) });
    default:
      return erro("Recurso desconhecido", 404);
  }
}

export async function POST(req: Request, { params }: Ctx) {
  const { recurso } = await params;
  const body = await req.json().catch(() => null);
  if (!body && recurso !== "seed") return erro("JSON inválido");

  try {
    switch (recurso) {
      case "empreendimentos": {
        const e = body as Empreendimento;
        if (!e.nome?.trim()) return erro("Dê um nome ao empreendimento.");
        const todos = await db.listarEmpreendimentos(false);
        const id = e.id || db.uid();
        let slug = slugify(e.slug || e.nome);
        if (todos.some((x) => x.slug === slug && x.id !== id)) slug = `${slug}-${id.slice(0, 4)}`;
        const atual = todos.find((x) => x.id === id);
        const salvo = await db.salvarEmpreendimento({
          ...(atual ?? {}),
          ...e,
          id,
          slug,
          preco_a_partir: e.preco_a_partir ? Number(e.preco_a_partir) : null,
          area_min: e.area_min ? Number(e.area_min) : null,
          area_max: e.area_max ? Number(e.area_max) : null,
          diferenciais: (e.diferenciais ?? []).map((d) => d.trim()).filter(Boolean),
          imagens: (e.imagens ?? []).map((d) => d.trim()).filter(Boolean),
          capa: e.capa || e.imagens?.[0] || "",
          ordem: Number(e.ordem ?? todos.length + 1),
          created_at: atual?.created_at ?? new Date().toISOString(),
        } as Empreendimento);
        atualizarSite();
        return ok(salvo);
      }
      case "slides": {
        const s = body as Slide;
        if (!s.titulo?.trim()) return erro("O slide precisa de um título.");
        const todos = await db.listarSlides(false);
        const salvo = await db.salvarSlide({
          ...s,
          id: s.id || db.uid(),
          ordem: Number(s.ordem ?? todos.length + 1),
          created_at: s.created_at || new Date().toISOString(),
        });
        atualizarSite();
        return ok(salvo);
      }
      case "slides-ordem": {
        const ids = (body as { ids: string[] }).ids ?? [];
        const todos = await db.listarSlides(false);
        await Promise.all(
          ids.map((id, i) => {
            const s = todos.find((x) => x.id === id);
            return s ? db.salvarSlide({ ...s, ordem: i + 1 }) : null;
          }),
        );
        atualizarSite();
        return ok({ ok: true });
      }
      case "leads": {
        const l = body as Partial<Lead>;
        if (l.id) {
          const atual = await db.buscarLead(l.id);
          if (!atual) return erro("Lead não encontrado", 404);
          return ok(await db.salvarLead({ ...atual, ...l, id: atual.id } as Lead));
        }
        if (!l.nome) return erro("Informe o nome do lead.");
        return ok(await db.salvarLead(db.novoLead({ ...l, origem: l.origem || "Cadastro manual" })));
      }
      case "config": {
        const atual = await db.lerConfig();
        const c = { ...atual, ...(body as Configuracoes) };
        delete (c as Record<string, unknown>)._banco;
        delete (c as Record<string, unknown>)._ia;
        const salvo = await db.salvarConfig(c);
        atualizarSite();
        return ok(salvo);
      }
      case "seed": {
        const [e, s] = await Promise.all([db.listarEmpreendimentos(false), db.listarSlides(false)]);
        if (!e.length) for (const x of SEED_EMPREENDIMENTOS) await db.salvarEmpreendimento(x);
        if (!s.length) for (const x of SEED_SLIDES) await db.salvarSlide(x);
        atualizarSite();
        return ok({ empreendimentos: e.length ? 0 : SEED_EMPREENDIMENTOS.length, slides: s.length ? 0 : SEED_SLIDES.length });
      }
      default:
        return erro("Recurso desconhecido", 404);
    }
  } catch (e) {
    console.error(e);
    return erro(e instanceof Error ? e.message : "Erro ao salvar", 500);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { recurso } = await params;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return erro("id obrigatório");
  if (recurso === "empreendimentos") await db.removerEmpreendimento(id);
  else if (recurso === "slides") await db.removerSlide(id);
  else if (recurso === "leads") await db.removerLead(id);
  else return erro("Recurso desconhecido", 404);
  atualizarSite();
  return ok({ ok: true });
}
