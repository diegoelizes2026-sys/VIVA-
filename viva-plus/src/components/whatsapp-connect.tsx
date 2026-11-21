"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Status = { available: boolean; linked: boolean; phone: string | null };

export default function WhatsAppConnect() {
  const [status, setStatus] = useState<Status | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/link", { cache: "no-store" });
      if (!res.ok) return null;
      const data = (await res.json()) as Status;
      setStatus(data);
      return data;
    } catch { return null; }
  }, []);

  useEffect(() => { void load(); return () => { if (poll.current) clearInterval(poll.current); }; }, [load]);

  async function connect() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/whatsapp/link", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível gerar o código.");
      setCode(data.code);
      window.open(data.url, "_blank", "noopener");
      if (poll.current) clearInterval(poll.current);
      const started = Date.now();
      poll.current = setInterval(async () => {
        const s = await load();
        if (s?.linked || Date.now() - started > 15 * 60000) { if (poll.current) clearInterval(poll.current); if (s?.linked) setCode(""); }
      }, 4000);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível conectar."); }
    finally { setBusy(false); }
  }

  async function disconnect() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/whatsapp/link", { method: "DELETE" });
      if (!res.ok) throw new Error("Não foi possível desconectar.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível desconectar."); }
    finally { setBusy(false); }
  }

  if (!status || !status.available) return null;

  return (
    <section className="card space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-extrabold">VIVA+ no WhatsApp</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            {status.linked
              ? <>Conectado ao número <b>{status.phone}</b>. Mande gastos, áudios, fotos de comprovante e lembretes direto pelo WhatsApp.</>
              : "Fale com a VIVA pelo WhatsApp: anote gastos, mande áudio ou foto do comprovante e marque lembretes sem abrir o app."}
          </p>
        </div>
        {status.linked
          ? <button type="button" className="btn-secondary" disabled={busy} onClick={disconnect}>Desconectar</button>
          : <button type="button" className="btn-primary" disabled={busy} onClick={connect}>{busy ? "Gerando…" : "Conectar WhatsApp"}</button>}
      </div>
      {code && !status.linked && (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Abrimos o WhatsApp com a mensagem pronta. É só tocar em <b>enviar</b>. Se não abriu, mande este código para a VIVA: <b>{code}</b> (vale por 15 minutos).
        </p>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
