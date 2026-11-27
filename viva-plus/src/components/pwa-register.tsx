"use client";
import {useEffect,useRef,useState} from "react";
type InstallPromptEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:"accepted"|"dismissed"}>};
type Platform="ios"|"android"|"other";

const SESSION_KEY="viva-install-guide-dismissed";
const DONE_KEY="viva-install-done";

function safeGet(store:"local"|"session",key:string){try{return (store==="local"?localStorage:sessionStorage).getItem(key);}catch{return null;}}
function safeSet(store:"local"|"session",key:string,value:string){try{(store==="local"?localStorage:sessionStorage).setItem(key,value);}catch{/* storage indisponível */}}

function detectPlatform():Platform{
 const ua=navigator.userAgent;
 const iPadOS=navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1;
 if(/iphone|ipad|ipod/i.test(ua)||iPadOS)return "ios";
 if(/android/i.test(ua))return "android";
 return "other";
}
function isStandalone(){
 return window.matchMedia("(display-mode: standalone)").matches||window.matchMedia("(display-mode: minimal-ui)").matches||("standalone" in navigator&&(navigator as Navigator&{standalone?:boolean}).standalone===true);
}

export default function PwaRegister(){
 const [installEvent,setInstallEvent]=useState<InstallPromptEvent|null>(null);
 const [guide,setGuide]=useState<Platform|null>(null);
 const [updateReady,setUpdateReady]=useState(false);
 const reloading=useRef(false);

 // Service worker
 useEffect(()=>{
  if(!window.isSecureContext||typeof navigator.serviceWorker==="undefined")return;
  let registration:ServiceWorkerRegistration|undefined;
  const onControllerChange=()=>{if(reloading.current){window.location.reload();}};
  navigator.serviceWorker.addEventListener("controllerchange",onControllerChange);
  const register=()=>navigator.serviceWorker.register("/sw.js",{scope:"/",updateViaCache:"none"}).then(reg=>{
   registration=reg;reg.update().catch(()=>undefined);
   if(reg.waiting&&navigator.serviceWorker.controller)setUpdateReady(true);
   reg.addEventListener("updatefound",()=>{const worker=reg.installing;if(!worker)return;worker.addEventListener("statechange",()=>{if(worker.state==="installed"&&navigator.serviceWorker.controller)setUpdateReady(true);});});
   return reg;
  }).catch(error=>{console.error("VIVA service worker registration failed",error);});
  if(document.readyState==="complete")void register();else window.addEventListener("load",()=>void register(),{once:true});
  const refresh=()=>{if(document.visibilityState==="visible")registration?.update().catch(()=>undefined);};
  document.addEventListener("visibilitychange",refresh);
  return()=>{document.removeEventListener("visibilitychange",refresh);navigator.serviceWorker.removeEventListener("controllerchange",onControllerChange);};
 },[]);

 // Instruções para adicionar à tela de início: aparecem ao entrar no site (celular/tablet)
 useEffect(()=>{
  // Na página de campanha (/diagnostico, vinda do Instagram) o convite de instalar atrapalharia o quiz.
  if(window.location.pathname.startsWith("/diagnostico"))return;
  if(isStandalone()||safeGet("local",DONE_KEY)||safeGet("session",SESSION_KEY))return;
  const platform=detectPlatform();
  const mobile=platform!=="other"||window.matchMedia("(pointer: coarse) and (max-width: 1024px)").matches;
  if(!mobile)return;
  const timer=window.setTimeout(()=>setGuide(platform==="ios"?"ios":"android"),1200);
  const onPrompt=(event:Event)=>{event.preventDefault();setInstallEvent(event as InstallPromptEvent);};
  const onInstalled=()=>{safeSet("local",DONE_KEY,"1");setGuide(null);setInstallEvent(null);};
  window.addEventListener("beforeinstallprompt",onPrompt);window.addEventListener("appinstalled",onInstalled);
  return()=>{window.clearTimeout(timer);window.removeEventListener("beforeinstallprompt",onPrompt);window.removeEventListener("appinstalled",onInstalled);};
 },[]);

 function closeGuide(){setGuide(null);safeSet("session",SESSION_KEY,"1");}
 function markDone(){setGuide(null);safeSet("local",DONE_KEY,"1");}
 async function install(){if(!installEvent)return;await installEvent.prompt();const choice=await installEvent.userChoice;if(choice.outcome==="accepted")markDone();setInstallEvent(null);}
 function update(){navigator.serviceWorker?.getRegistration("/").then(reg=>{if(reg?.waiting){reloading.current=true;reg.waiting.postMessage({type:"SKIP_WAITING"});}else{reg?.update().catch(()=>undefined);setUpdateReady(false);}});}

 return <>
  {updateReady&&<div role="status" className="fixed left-3 right-3 z-[10000] mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-[#24103f] px-4 py-3 text-sm font-semibold text-white shadow-xl" style={{bottom:"calc(env(safe-area-inset-bottom, 0px) + 12px)"}}><span>✨ Nova versão do VIVA+ disponível</span><button className="rounded-xl bg-white px-3 py-2 font-bold text-[#6410C9]" onClick={update}>Atualizar</button></div>}
  {guide&&<div className="viva-install-layer" role="dialog" aria-modal="true" aria-labelledby="viva-install-title">
   <button className="viva-install-backdrop" onClick={closeGuide} aria-label="Fechar"/>
   <section className="viva-install-sheet">
    <div className="viva-install-handle"/>
    <button className="viva-install-close" onClick={closeGuide} aria-label="Fechar">×</button>
    <div className="viva-install-brand">V<span>+</span></div>
    {guide==="ios"?<>
     <span className="viva-install-kicker">ATALHO NO SEU IPHONE</span>
     <h2 id="viva-install-title">Coloque a VIVA+ na sua Tela de Início</h2>
     <p>Abra a VIVA+ com um toque, como um aplicativo. Siga os passos no <b>Safari</b>:</p>
     <ol className="viva-ios-steps">
      <li><em>1</em><span>Toque em <b>Compartilhar</b> na barra do navegador</span><i aria-hidden>⬆︎</i></li>
      <li><em>2</em><span>Role e toque em <b>Adicionar à Tela de Início</b></span><i aria-hidden>＋</i></li>
      <li><em>3</em><span>Toque em <b>Adicionar</b> no canto superior</span><i aria-hidden>✓</i></li>
     </ol>
    </>:<>
     <span className="viva-install-kicker">ATALHO NO SEU CELULAR</span>
     <h2 id="viva-install-title">Coloque a VIVA+ na sua tela inicial</h2>
     <p>Abra a VIVA+ com um toque, como um aplicativo.</p>
     {installEvent?<button className="viva-install-primary" onClick={install}>Adicionar à tela inicial</button>:
     <ol className="viva-ios-steps">
      <li><em>1</em><span>Toque no menu <b>⋮</b> do navegador</span><i aria-hidden>⋮</i></li>
      <li><em>2</em><span>Toque em <b>Adicionar à tela inicial</b> ou <b>Instalar app</b></span><i aria-hidden>＋</i></li>
      <li><em>3</em><span>Confirme em <b>Adicionar</b></span><i aria-hidden>✓</i></li>
     </ol>}
    </>}
    <button className={installEvent&&guide==="android"?"viva-install-later":"viva-install-primary"} onClick={closeGuide}>{installEvent&&guide==="android"?"Agora não":"Entendi"}</button>
    <button className="viva-install-later" onClick={markDone}>Já adicionei, não mostrar mais</button>
   </section>
  </div>}
 </>;
}
