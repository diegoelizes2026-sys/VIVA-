"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Status = { available: boolean; linked: boolean; number: string | null; chatLink: string | null };

export default function WhatsAppConnect() {
  const [status, setStatus] = useState<Status | null>(null);
  const [code, setCode] = useState<{ code: string; waLink: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const poll = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/link", { cache: "no-store" });
      if (!res.ok) return null;
      const data = (await res.json()) as Status;
      setStatus(data);
      return data;
    } catch { return null; }
  }, []);

  useEffect(() => { load(); return () => { if (poll.current) window.clearInterval(poll.current); }; }, [load]);

  async function connect() {
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/whatsapp/link", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível gerar o código.");
      setCode({ code: data.code, waLink: data.waLink });
      window.open(data.waLink, "_blank", "noopener");
      if (poll.current) window.clearInterval(poll.current);
      const started = Date.now();
      poll.current = window.setInterval(async () => {
        const s = await load();
        if (s?.linked || Date.now() - started > 15 * 60000) {
          if (poll.current) window.clearInterval(poll.current);
          poll.current = null;
          if (s?.linked) { setCode(null); setMsg("WhatsApp conectado! Já pode falar com a VIVA por lá. 💜"); }
        }
      }, 4000);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Erro ao conectar."); }
    finally { setBusy(false); }
  }

  async function disconnect() {
    if (!window.confirm("Desconectar seu WhatsApp da VIVA+?")) return;
    setBusy(true);
    try { await fetch("/api/whatsapp/link", { method: "DELETE" }); await load(); setMsg("WhatsApp desconectado."); }
    finally { setBusy(false); }
  }

  if (!status?.available) return null;

  return (
    <section className="vc-card" aria-labelledby="wa-title">
      <div className="md-head"><h2 id="wa-title">VIVA no WhatsApp</h2></div>
      {status.linked ? (
        <>
          <p className="vc-muted">Conectado ao número <b>{status.number}</b>. Mande mensagem, áudio ou foto do comprovante e a VIVA resolve por lá. Nada é salvo sem você confirmar.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            {status.chatLink && <a className="btn-primary" href={status.chatLink} target="_blank" rel="noopener noreferrer">Abrir conversa</a>}
            <button className="md-danger" onClick={disconnect} disabled={busy}>Desconectar</button>
          </div>
        </>
      ) : (
        <>
          <p className="vc-muted">Anote gastos, mande o comprovante, pergunte se uma compra cabe no mês e receba lembretes direto no seu WhatsApp. Usa os mesmos créditos do app.</p>
          {code && <p className="vc-muted" style={{ marginTop: 8 }}>Envie a mensagem que abriu no WhatsApp com o código <b>{code.code}</b> (vale 15 minutos). Não abriu? <a href={code.waLink} target="_blank" rel="noopener noreferrer">Toque aqui</a>.</p>}
          <button className="btn-primary" style={{ marginTop: 12 }} onClick={connect} disabled={busy}>{busy ? "Gerando código…" : code ? "Gerar novo código" : "Conectar meu WhatsApp"}</button>
        </>
      )}
      {msg && <p className="md-msg" role="status" style={{ marginTop: 10 }}>{msg}</p>}
    </section>
  );
}
