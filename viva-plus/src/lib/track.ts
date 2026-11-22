// Registro leve de uso (telas e ações) para o painel do admin. Nunca bloqueia nem mostra erro.
export function track(path: string) {
  try {
    const p = path.toLowerCase().slice(0, 60);
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    const key = "viva-track:" + day + ":" + p;
    if (!p.startsWith("acao:") && sessionStorage.getItem(key)) return; // tela: uma vez por dia
    if (!p.startsWith("acao:")) sessionStorage.setItem(key, "1");
    void fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: p }), keepalive: true }).catch(() => {});
  } catch { /* sem storage */ }
}
export const trackAction = (name: string) => track("acao:" + name);
