"use client";

import {useEffect,useState} from "react";
import PlansInteractive from "@/app/(app)/planos/plans-interactive";

type Plan={
  id:string;
  name:string;
  monthly_price_brl:number;
  annual_price_brl:number;
  daily_credits:number;
  history_messages:number;
  radar_enabled:boolean;
  voice_enabled:boolean;
  photo_enabled:boolean;
};

export default function SubscriptionEntryOffer({plans,currentPlanId}:{plans:Plan[];currentPlanId:string}) {
  const [open,setOpen]=useState(false);

  useEffect(()=>{
    if(currentPlanId!=="free" || plans.length===0) return;
    try {
      if(window.sessionStorage.getItem("viva-entry-subscription-offer-seen")!=="1") setOpen(true);
    } catch {
      setOpen(true);
    }
  },[currentPlanId,plans.length]);

  function dismiss(){
    try { window.sessionStorage.setItem("viva-entry-subscription-offer-seen","1"); } catch {}
    setOpen(false);
  }

  if(!open || currentPlanId!=="free" || plans.length===0) return null;

  return (
    <div className="viva-entry-offer-layer" role="presentation">
      <button className="viva-entry-offer-backdrop" type="button" aria-label="Fechar oferta" onClick={dismiss}/>
      <section className="viva-entry-offer-card" role="dialog" aria-modal="true" aria-labelledby="viva-entry-offer-title">
        <button className="viva-entry-offer-close" type="button" onClick={dismiss} aria-label="Continuar com plano grátis">×</button>
        <div className="viva-entry-offer-brand">VIVA<span>+</span></div>
        <span className="viva-entry-offer-kicker">UM NOVO JEITO DE CUIDAR DO SEU DINHEIRO</span>
        <h2 id="viva-entry-offer-title">Sua vida financeira merece mais inteligência.</h2>
        <p className="viva-entry-offer-description">Conheça os planos e desbloqueie mais recursos da sua assistente financeira. Você escolhe quando fazer upgrade.</p>
        <div className="viva-entry-offer-plans">
          <PlansInteractive plans={plans} currentPlanId={currentPlanId}/>
        </div>
        <button className="viva-entry-offer-free" type="button" onClick={dismiss}>Continuar com o plano grátis</button>
        <p className="viva-entry-offer-footnote">Sem cobrança automática. A assinatura só começa quando você escolhe um plano e confirma o pagamento.</p>
      </section>
    </div>
  );
}
