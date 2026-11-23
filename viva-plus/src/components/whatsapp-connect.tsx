"use client";
import { useCallback, useEffect, useState } from "react";

type Status = { linked: boolean; number: string | null; chatUrl: string };

/** Cartão "VIVA no WhatsApp": liga o WhatsApp da pessoa à conta para conversar com a VIVA por lá. */
export default function WhatsappConnect() {
  const [status, setStatus] = useState<Status | null>(null);
  const [link, setLink] = useState<{ code: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/link", { cache: "no-store" });
      if (res.ok) setStatus(await res.json());
    } catch { /* sem conexão */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Enquanto o código está aberto, confere de tempos em tempos se a pessoa já mandou a mensagem.
  useEffect(() => {
    if (!link || status?.linked) return;
    const timer = setInterval(load, 4000);
    const stop = setTimeout(() => clearInterval(timer), 10 * 60 * 1000);
    return () => { clearInterval(timer); clearTimeout(stop); };
  }, [link, status?.linked, load]);

  async function connect() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/whatsapp/link", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não consegui gerar o código.");
      setLink({ code: data.code, url: data.url });
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e) { setError(e instanceof Error ? e.message : "Não consegui gerar o código."); }
    finally { setBusy(false); }
  }

  async function disconnect() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/whatsapp/link", { method: "DELETE" });
      if (!res.ok) throw new Error("Não consegui desconectar agora.");
      setLink(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Não consegui desconectar agora."); }
    finally { setBusy(false); }
  }

  return (
    <section className="card mt-5 max-w-2xl p-6">
      <b>💬 VIVA no WhatsApp</b>
      {status?.linked ? (
        <>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Conectado ao número {status.number}. Fale com a VIVA pelo WhatsApp do mesmo jeito que no app: “gastei 35 na farmácia”, “quanto posso gastar hoje?”.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a className="btn-primary" href={status.chatUrl} target="_blank" rel="noopener noreferrer">Abrir conversa com a VIVA</a>
            <button type="button" className="btn-secondary" onClick={disconnect} disabled={busy}>Desconectar</button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Anote gastos e tire dúvidas sobre o seu dinheiro direto pelo WhatsApp, sem abrir o app. Usa os mesmos créditos do seu plano.
          </p>
          {link ? (
            <div className="mt-4 text-sm">
              <p>Abrimos o WhatsApp com a mensagem pronta. É só <b>enviar</b>.</p>
              <p className="mt-2" style={{ color: "var(--muted)" }}>Se não abriu, mande esta mensagem para a VIVA: <b>Conectar VIVA {link.code}</b> (vale por 30 minutos).</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a className="btn-primary" href={link.url} target="_blank" rel="noopener noreferrer">Abrir o WhatsApp</a>
                <button type="button" className="btn-secondary" onClick={load}>Já enviei</button>
              </div>
            </div>
          ) : (
            <div className="mt-4"><button type="button" className="btn-primary" onClick={connect} disabled={busy || !status}>{busy ? "Gerando…" : "Conectar WhatsApp"}</button></div>
          )}
        </>
      )}
      {error && <p className="mt-3 text-sm" style={{ color: "#b42318" }}>{error}</p>}
    </section>
  );
}
