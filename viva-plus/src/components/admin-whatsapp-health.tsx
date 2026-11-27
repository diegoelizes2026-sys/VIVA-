"use client";
import { useCallback, useEffect, useState } from "react";

type H = { ok: boolean; error: string | null; verifiedName: string | null; nameStatus: string | null; quality: string | null; phone: string | null; lastInbound: string | null; checkedAt: string; since: string };
const NAME: Record<string, string> = { APPROVED: "aprovado", AVAILABLE_WITHOUT_REVIEW: "em uso (aguardando análise)", PENDING_REVIEW: "em análise", DECLINED: "recusado", EXPIRED: "expirado", NONE: "sem nome" };
const QUALITY: Record<string, string> = { GREEN: "Alta", YELLOW: "Média", RED: "Baixa", UNKNOWN: "—" };
const dt = (s: string | null) => (s ? new Date(s).toLocaleString("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");

/** Topo do painel: o WhatsApp da VIVA está funcionando? (checa a Meta na hora; a cada 15 min há checagem automática com e-mail). */
export default function AdminWhatsappHealth() {
  const [h, setH] = useState<H | null>(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    setBusy(true); setErr("");
    fetch("/api/admin/whatsapp-health", { cache: "no-store" }).then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Erro."); setH(j); })
      .catch(e => setErr(e instanceof Error ? e.message : "Erro.")).finally(() => setBusy(false));
  }, []);
  useEffect(() => { load(); }, [load]);
  const bad = h ? !h.ok : false;
  const nameBad = h?.nameStatus && ["DECLINED", "EXPIRED"].includes(h.nameStatus);
  return <section className="viva-admin-section" style={{ borderColor: bad ? "#f2c4c4" : nameBad ? "#f5d38b" : undefined, background: bad ? "#fff5f5" : undefined }}>
    <div className="viva-admin-section-title"><div>
      <h2>{!h && !err ? "WhatsApp da VIVA: verificando…" : bad ? "🚨 WhatsApp da VIVA FORA DO AR" : err ? "WhatsApp da VIVA: não consegui verificar" : "✅ WhatsApp da VIVA funcionando"}</h2>
      <p>Checagem automática com a Meta a cada 15 minutos. Se cair, você recebe um e-mail.</p>
    </div><button className="viva-admin-save" onClick={load} disabled={busy}>{busy ? "Verificando…" : "Verificar agora"}</button></div>
    {err && <p role="alert" style={{ color: "#b42318" }}>{err}</p>}
    {h && <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
      {bad && <>
        <p style={{ margin: 0, color: "#b42318", fontWeight: 800 }}>A Meta está recusando o acesso desde {dt(h.since)}: {h.error}</p>
        <p style={{ margin: 0 }}>Como resolver: gere um token novo do usuário do sistema (validade <b>Nunca</b>, permissões <b>whatsapp_business_messaging</b> e <b>whatsapp_business_management</b>) em <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noopener noreferrer">Usuários do sistema</a>, cole em <b>WHATSAPP_TOKEN</b> na Vercel e faça <b>Redeploy</b>.</p>
      </>}
      {!bad && <span>Número {h.phone || "—"} · Nome: <b>{h.verifiedName || "—"}</b> ({NAME[h.nameStatus || ""] || h.nameStatus || "—"}) · Qualidade: <b>{QUALITY[h.quality || ""] || h.quality || "—"}</b></span>}
      {nameBad && <span style={{ color: "#8a5300", fontWeight: 700 }}>O nome de exibição foi recusado. Envie de novo em <a href="https://business.facebook.com/wa/manage/phone-numbers/" target="_blank" rel="noopener noreferrer">Números de telefone</a>.</span>}
      <span style={{ color: "#6f6680" }}>Última mensagem recebida: {dt(h.lastInbound)} · Verificado em {dt(h.checkedAt)}</span>
    </div>}
  </section>;
}
