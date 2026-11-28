"use client";
import {useEffect,useState} from "react";
function PixIcon(){return <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="m7.2 3.8-3.4 3.4a2.4 2.4 0 0 0 0 3.4l7.1 7.1a1.6 1.6 0 0 0 2.2 0l7.1-7.1a2.4 2.4 0 0 0 0-3.4l-3.4-3.4a2.4 2.4 0 0 0-3.4 0L12 5.2l-1.4-1.4a2.4 2.4 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.8"/><path d="m8 8 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
function CardIcon(){return <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none"><rect x="2.5" y="4.5" width="19" height="15" rx="3" stroke="currentColor" strokeWidth="1.8"/><path d="M3 9h18M6.5 14.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>}
function Spinner(){return <span className="viva-pay-spinner" aria-hidden="true"/>}
export type PixData={paymentId:string;pixCopyPaste:string;qrCodeBase64?:string|null;expiresAt?:string|null;planName?:string;amount?:number;reused?:boolean};
const money=(v?:number)=>typeof v==="number"?v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}):"";
function timeLeft(iso?:string|null){if(!iso)return "";const ms=new Date(iso).getTime()-Date.now();if(ms<=0)return "expirado";const h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000);return h>0?`${h}h ${m}min`:`${m} min`;}
export function PixSheet({pix,onClose,onCard,successHref="/meu-dia",successLabel="Começar a usar"}:{pix:PixData;onClose:()=>void;onCard?:()=>void;successHref?:string;successLabel?:string}){
 const [copied,setCopied]=useState(false),[status,setStatus]=useState("pending"),[,tick]=useState(0);
 useEffect(()=>{let alive=true;const check=async()=>{try{const r=await fetch("/api/billing/checkout?paymentId="+encodeURIComponent(pix.paymentId),{cache:"no-store"});const d=await r.json();if(alive&&d.status)setStatus(d.status);}catch{}};
  const id=setInterval(()=>{if(document.visibilityState==="visible")check();tick(x=>x+1);},4000);const onVis=()=>{if(document.visibilityState==="visible")check();};document.addEventListener("visibilitychange",onVis);check();
  return()=>{alive=false;clearInterval(id);document.removeEventListener("visibilitychange",onVis);};},[pix.paymentId]);
 async function copy(){try{await navigator.clipboard.writeText(pix.pixCopyPaste);}catch{const t=document.querySelector<HTMLTextAreaElement>(".viva-pix-sheet textarea");t?.select();document.execCommand?.("copy");}setCopied(true);setTimeout(()=>setCopied(false),2500);}
 const paid=status==="approved";
 return <div className="viva-pix-layer" role="dialog" aria-modal="true" aria-label="Pagamento Pix"><button type="button" className="viva-pix-backdrop" onClick={onClose} aria-label="Fechar Pix"/><section className={"viva-pix-sheet"+(paid?" is-paid":"")}><button type="button" className="viva-pix-close" onClick={onClose} aria-label="Fechar">×</button>
 {paid?<div className="viva-pix-success" role="status"><span className="viva-pix-party" aria-hidden="true">🎉</span><h2>Pagamento confirmado!</h2><p>Seu plano {pix.planName} está sendo liberado agora. Se você conectou o WhatsApp, a VIVA já vai te mandar uma mensagem por lá. 💜</p><a className="viva-pix-go" href={successHref}>{successLabel}</a></div>
 :<>{pix.reused&&<span className="viva-pix-resume">Seu Pix continua te esperando</span>}<h2>Falta só o Pix</h2>{pix.planName&&<p className="viva-pix-plan">Plano <b>{pix.planName}</b>{pix.amount?<> · <b>{money(pix.amount)}</b></>:null}</p>}
 <ol className="viva-pix-steps"><li>Toque em <b>Copiar código Pix</b></li><li>Abra o app do seu banco → <b>Pix</b> → <b>Copia e Cola</b></li><li>Cole o código e confirme. <b>Pronto!</b> Seu plano ativa sozinho</li></ol>
 <button type="button" className={"viva-pix-copy"+(copied?" is-copied":"")} onClick={copy}>{copied?"✓ Código copiado! Agora abra seu banco":"Copiar código Pix"}</button>
 <details className="viva-pix-qr"><summary>Pagar pelo QR Code (em outro aparelho)</summary>{pix.qrCodeBase64&&<img alt="QR Code Pix" src={"data:image/png;base64,"+pix.qrCodeBase64}/>}<textarea readOnly value={pix.pixCopyPaste} aria-label="Código Pix copia e cola"/></details>
 <b className="viva-pix-wait"><span className="viva-pay-spinner" aria-hidden="true"/> Aguardando o pagamento… esta tela confirma sozinha</b>
 {pix.expiresAt&&<small>O código vale por mais {timeLeft(pix.expiresAt)}. Pode sair e voltar: ele fica guardado aqui.</small>}
 {onCard&&<button type="button" className="viva-pix-card-alt" onClick={onCard}>Prefere não lembrar todo mês? <b>Assine no cartão</b>: renova sozinho</button>}</>}
 </section></div>;
}
export default function CheckoutActions({planId,interval}:{planId:string;interval:"monthly"|"annual"}) {
 const [loading,setLoading]=useState<"pix"|"card"|null>(null),[error,setError]=useState(""),[pix,setPix]=useState<PixData|null>(null);
 async function start(method:"pix"|"card"){if(loading)return;setLoading(method);setError("");if(method==="card")setPix(null);try{const r=await fetch("/api/billing/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({planId,interval,method})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Não foi possível iniciar o pagamento.");if(method==="card"&&d.checkoutUrl){window.location.assign(d.checkoutUrl);return;}setPix(d);}catch(e){setError(e instanceof Error?e.message:"Erro ao iniciar pagamento.");}finally{setLoading(null);}}
 return <div className="viva-checkout-actions"><button type="button" className="viva-pay-pix" disabled={!!loading} onClick={()=>start("pix")}>{loading==="pix"?<Spinner/>:<PixIcon/>}{loading==="pix"?"Gerando Pix...":"Assinar com Pix"}</button><button type="button" className="viva-pay-card" disabled={!!loading} onClick={()=>start("card")}>{loading==="card"?<Spinner/>:<CardIcon/>}{loading==="card"?"Abrindo checkout...":"Assinar com cartão"}</button>{error&&<p className="viva-pay-error" role="alert">{error}</p>}{pix&&<PixSheet pix={pix} onClose={()=>setPix(null)} onCard={()=>start("card")}/>}</div>;
}
export function PendingPix(){
 const [pending,setPending]=useState<(PixData&{planId:string;interval:"monthly"|"annual"})|null>(null),[open,setOpen]=useState(false),[,setNow]=useState(0);
 useEffect(()=>{fetch("/api/billing/checkout",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(d=>{if(d?.pending){setPending(d.pending);if(new URLSearchParams(location.search).get("pix")==="retomar")setOpen(true);}}).catch(()=>{});const id=setInterval(()=>setNow(x=>x+1),60000);return()=>clearInterval(id);},[]);
 if(!pending)return null;
 return <><div className="viva-pix-pending" role="status"><div><b>⏳ Seu Pix do plano {pending.planName} está te esperando</b><span>{money(pending.amount)} · vale por mais {timeLeft(pending.expiresAt)}</span></div><button type="button" onClick={()=>setOpen(true)}>Pagar agora</button></div>{open&&<PixSheet pix={{...pending,reused:true}} onClose={()=>setOpen(false)}/>}</>;
}
