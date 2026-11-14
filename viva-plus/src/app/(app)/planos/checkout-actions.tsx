"use client";
import { useState } from "react";
export default function CheckoutActions({planId,interval}:{planId:string;interval:"monthly"|"annual"}) {
 const [loading,setLoading]=useState(false),[error,setError]=useState(""),[pix,setPix]=useState<{pixCopyPaste:string;qrCodeBase64?:string|null}|null>(null);
 async function start(method:"pix"|"card") {
  setLoading(true);setError("");setPix(null);
  try { const r=await fetch("/api/billing/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({planId,interval,method})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Falha no pagamento");
   if(method==="card"&&d.checkoutUrl){window.location.assign(d.checkoutUrl);return;}setPix(d);
  } catch(e){setError(e instanceof Error?e.message:"Erro ao iniciar pagamento");} finally{setLoading(false);}
 }
 return <div className="viva-checkout-actions">
  <button type="button" disabled={loading} onClick={()=>start("card")}>{loading?"Aguarde...":"Assinar com cartão"}</button>
  <button type="button" className="secondary" disabled={loading} onClick={()=>start("pix")}>{loading?"Aguarde...":"Pagar com Pix"}</button>
  {error&&<p role="alert">{error}</p>}
  {pix&&<div className="viva-pix-result"><b>Pix gerado — aguardando confirmação</b>{pix.qrCodeBase64&&<img alt="QR Code Pix" src={`data:image/png;base64,${pix.qrCodeBase64}`}/>}<textarea readOnly value={pix.pixCopyPaste} aria-label="Código Pix copia e cola"/><button type="button" onClick={()=>navigator.clipboard.writeText(pix.pixCopyPaste)}>Copiar código Pix</button><small>O plano será liberado após a confirmação.</small></div>}
 </div>;
}
