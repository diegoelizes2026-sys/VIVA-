"use client";

export async function api<T = unknown>(caminho: string, opts?: { method?: string; body?: unknown }): Promise<T> {
  const r = await fetch(`/api/admin/${caminho}`, {
    method: opts?.method ?? "GET",
    headers: opts?.body ? { "Content-Type": "application/json" } : undefined,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  if (r.status === 401) {
    location.href = "/admin/login";
    throw new Error("Sessão expirada");
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erro || "Erro inesperado");
  return d as T;
}

export async function enviarArquivo(file: File): Promise<string> {
  const f = new FormData();
  f.append("file", file);
  const r = await fetch("/api/admin/upload", { method: "POST", body: f });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erro || "Falha no envio");
  return d.url as string;
}
