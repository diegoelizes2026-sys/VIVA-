"use client";
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { MessageCircle } from "lucide-react";

/** Foto da VIVA como no perfil do WhatsApp, com o pontinho verde de "online". */
function VivaAvatar() {
  return <span className="wa-avatar" aria-hidden><Image src="/icons/viva-192.svg" alt="" width={52} height={52} unoptimized /><i /></span>;
}

type Status = { linked: boolean; subscribed?: boolean; number: string | null; chatUrl: string };

/**
 * "VIVA no WhatsApp": liga o WhatsApp da pessoa à conta com um toque.
 * variant="home": cartão em destaque no Meu dia (conectado vira um atalho para a conversa).
 * variant="profile": cartão completo em Meu perfil (com opção de desconectar).
 */
export default function WhatsappConnect({ variant = "profile" }: { variant?: "home" | "profile" }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [link, setLink] = useState<{ code: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<"conectado" | "expirado" | "erro" | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/link", { cache: "no-store" });
      if (res.ok) setStatus(await res.json());
    } catch { /* sem conexão */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Aviso vindo do link de um toque (/whatsapp/conectar → /meu-dia?whatsapp=...).
  useEffect(() => {
    if (variant !== "home") return;
    const value = new URLSearchParams(window.location.search).get("whatsapp");
    if (value === "conectado" || value === "expirado" || value === "erro") setNotice(value);
  }, [variant]);

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

  // Sem plano pago, a VIVA no WhatsApp funciona com o limite do Free (10 mensagens por semana).
  const isFree = status !== null && status.subscribed === false;

  if (variant === "home") {
    if (!status) return null;
    if (status.linked) {
      return (
        <a className="wa-home linked" href={status.chatUrl} target="_blank" rel="noopener noreferrer" aria-label="Abrir conversa com a VIVA no WhatsApp">
          <VivaAvatar />
          <span className="wa-home-text">
            <span className="wa-home-name"><b>VIVA+</b><span className="wa-online-label">online</span></span>
            <span className="wa-bubble">{notice === "conectado" ? "WhatsApp conectado! ✅ Agora é só me mandar mensagem por aqui." : "Oi! Me conta o que você gastou hoje que eu anoto pra você 💜"}</span>
            {isFree ? <small>Grátis: 10 mensagens por semana</small> : null}
          </span>
          <span className="wa-home-go"><MessageCircle size={18} aria-hidden /> Abrir conversa</span>
        </a>
      );
    }
    return (
      <section className="wa-home">
        <VivaAvatar />
        <div className="wa-home-text">
          <span className="wa-home-name"><b>Fale com a VIVA+ no WhatsApp</b><span className="wa-online-label">online</span></span>
          <small>
            {notice === "expirado" ? "Aquele link expirou. Toque abaixo para conectar de novo." : notice === "erro" ? "Não deu certo agora. Tente de novo abaixo." : `Mande “gastei 35 na farmácia” e ela anota na hora, sem abrir o app.${isFree ? " Grátis: 10 mensagens por semana." : ""}`}
          </small>
          {link ? (
            <small className="wa-home-hint">Abrimos o WhatsApp com a mensagem pronta: é só <b>enviar</b>. Se não abriu, mande <b>Conectar VIVA {link.code}</b>.</small>
          ) : null}
          {error ? <small className="wa-home-error">{error}</small> : null}
        </div>
        {link ? (
          <a className="wa-home-btn" href={link.url} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} aria-hidden /> Abrir o WhatsApp</a>
        ) : (
          <button type="button" className="wa-home-btn" onClick={connect} disabled={busy}>{busy ? "Abrindo…" : <><MessageCircle size={18} aria-hidden /> Conectar meu WhatsApp</>}</button>
        )}
      </section>
    );
  }

  return (
    <section className="card mt-5 max-w-2xl p-6">
      <b>💬 VIVA no WhatsApp</b>
      {status?.linked ? (
        <>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Conectado ao número {status.number}. Fale com a VIVA pelo WhatsApp do mesmo jeito que no app: “gastei 35 na farmácia”, “quanto posso gastar hoje?”.
          </p>
          {isFree && <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>No plano Free são <b>10 mensagens por semana</b>. <a href="/planos?whatsapp=assinar" style={{ color: "var(--purple, #6410C9)", fontWeight: 700 }}>Sem limite no Pro</a> (teste grátis por 7 dias).</p>}
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
