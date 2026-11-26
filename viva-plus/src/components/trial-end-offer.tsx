"use client";
import { Hourglass } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PlansInteractive from "@/app/(app)/planos/plans-interactive";

type Plan = { id: string; name: string; monthly_price_brl: number; annual_price_brl: number; daily_credits: number; history_messages: number; radar_enabled: boolean; voice_enabled: boolean; photo_enabled: boolean };
type TrialInfo = { active?: boolean; ends_at?: string | null; followup?: { ends_at: string } | null };
const SEEN = "viva-trial-end-offer-seen";

/**
 * Teste grátis do Pro (7 dias): mostra o tempo restante e, quando o teste acaba,
 * abre os planos na hora para a pessoa fechar a assinatura. Reaparece a cada sessão até assinar.
 */
export default function TrialEndOffer({ plans }: { plans: Plan[] }) {
  const router = useRouter();
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/trial", { cache: "no-store" });
      if (!r.ok) return;
      const t = (await r.json()) as TrialInfo;
      if (t.active && t.ends_at) { setEndsAt(new Date(t.ends_at).getTime()); return; }
      setEndsAt(null);
      // Teste já acabou e a pessoa ainda não assinou: mostra os planos (uma vez por sessão).
      const ended = t.followup?.ends_at ? new Date(t.followup.ends_at).getTime() : 0;
      let seen = false; try { seen = sessionStorage.getItem(SEEN) === "1"; } catch { /* sem armazenamento */ }
      if (ended && ended <= Date.now() && !seen) setOpen(true);
    } catch { /* sem conexão */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const on = () => load(); window.addEventListener("viva:trial-started", on); return () => window.removeEventListener("viva:trial-started", on); }, [load]);

  // Contagem regressiva; no fim do teste, abre os planos.
  useEffect(() => {
    if (!endsAt) return;
    const tick = setInterval(() => {
      const n = Date.now(); setNow(n);
      if (n >= endsAt) {
        clearInterval(tick); setEndsAt(null); setOpen(true);
        window.dispatchEvent(new Event("viva:credits-updated"));
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [endsAt, router]);

  function dismiss() { try { sessionStorage.setItem(SEEN, "1"); } catch { /* sem armazenamento */ } setOpen(false); }

  const paid = plans.filter(p => p.id !== "free" && Number(p.monthly_price_brl) > 0);
  if (endsAt && !open) {
    const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
    const days = Math.ceil(left / 86400), h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60);
    const label = left > 86400 ? `${days} dias` : h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m}:${String(left % 60).padStart(2, "0")}`;
    return <div className="viva-trial-timer" role="status"><Hourglass aria-hidden /> Teste do Pro: <b>{label}</b> restantes</div>;
  }
  if (!open || paid.length === 0) return null;
  return (
    <div className="viva-entry-offer-layer" role="presentation">
      <button className="viva-entry-offer-backdrop" type="button" aria-label="Fechar" onClick={dismiss} />
      <section className="viva-entry-offer-card" role="dialog" aria-modal="true" aria-labelledby="viva-trial-end-title">
        <button className="viva-entry-offer-close" type="button" onClick={dismiss} aria-label="Fechar">×</button>
        <div className="viva-entry-offer-brand">VIVA<span>+</span></div>
        <span className="viva-entry-offer-kicker">SEU TESTE DO PRO ACABOU</span>
        <h2 id="viva-trial-end-title">Gostou? Feche seu plano e continue com tudo.</h2>
        <p className="viva-entry-offer-description">Assine para manter a VIVA completa: VIVA no WhatsApp, voz, foto de comprovante, análises e mais créditos. Pix ou cartão, ativa assim que o pagamento é confirmado.</p>
        <div className="viva-entry-offer-plans"><PlansInteractive plans={paid} currentPlanId="free" /></div>
        <button className="viva-entry-offer-free" type="button" onClick={dismiss}>Agora não</button>
      </section>
    </div>
  );
}
