import type { Lead } from "./types";

export function soDigitos(s: string) {
  return (s || "").replace(/\D/g, "");
}

/** Normaliza para formato internacional brasileiro (55 + DDD + número). */
export function telefoneWa(s: string) {
  let d = soDigitos(s);
  if (!d) return "";
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (d.length <= 11) d = "55" + d;
  return d;
}

export function telefoneBonito(s: string) {
  const d = soDigitos(s).replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return s;
}

export function linkWhatsapp(numero: string, texto: string) {
  const n = telefoneWa(numero);
  const q = `?text=${encodeURIComponent(texto)}`;
  return n ? `https://wa.me/${n}${q}` : `https://wa.me/${q}`;
}

export function moeda(v: number | null | undefined) {
  if (v == null) return "";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function dataCurta(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Renderiza *trecho* como <em> nos títulos (destaque em itálico). */
export function partesTitulo(t: string) {
  return t.split(/(\*[^*]+\*)/g).filter(Boolean).map((p) =>
    p.startsWith("*") && p.endsWith("*") ? { em: true, txt: p.slice(1, -1) } : { em: false, txt: p },
  );
}

export function mensagemParaCorretor(l: Partial<Lead>, corretor: string) {
  const linhas = [
    `Olá, ${corretor.split(" ")[0]}! Vim pelo Agente 24h do seu site.`,
    l.nome && `Sou ${l.nome}.`,
    l.busca && `Estou buscando: ${l.busca}.`,
    l.empreendimento_interesse && `Tenho interesse em: ${l.empreendimento_interesse}.`,
  ];
  return linhas.filter(Boolean).join("\n");
}


export function corStatus(s: string) {
  if (s === "100% vendido") return "bg-coral text-white";
  if (/lançamento/i.test(s)) return "bg-sol text-ink";
  if (s === "Últimas unidades") return "bg-white text-coral";
  return "bg-osso text-ink";
}

