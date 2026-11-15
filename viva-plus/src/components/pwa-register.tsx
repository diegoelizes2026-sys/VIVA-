"use client";
import {useEffect,useRef,useState} from "react";
type InstallPromptEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:"accepted"|"dismissed"}>};
export default function PwaRegister(){
 const [installEvent,setInstallEvent]=useState<InstallPromptEvent|null>(null);
 const [showAndroid,setShowAndroid]=useState(false),[showIos,setShowIos]=useState(false),[updateReady,setUpdateReady]=useState(false);
 const reloading=useRef(false);
 useEffect(()=>{
  if(!window.isSecureContext)return;
  let registration:ServiceWorkerRegistration|undefined;
  const onControllerChange=()=>{if(reloading.current){window.location.reload();}};
  navigator.serviceWorker?.addEventListener("controllerchange",onControllerChange);
  if(typeof navigator.serviceWorker !== "undefined"){
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
  }
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent),standalone=window.matchMedia("(display-mode: standalone)").matches||("standalone" in navigator&&(navigator as Navigator&{standalone?:boolean}).standalone===true);
  const visits=Number(localStorage.getItem("viva-visits")||"0")+1;localStorage.setItem("viva-visits",String(visits));
  if(ios&&!standalone&&!sessionStorage.getItem("viva-ios-guide-dismissed"))setShowIos(true);
  const onPrompt=(event:Event)=>{event.preventDefault();setInstallEvent(event as InstallPromptEvent);if(window.matchMedia("(max-width: 768px)").matches&&visits>=2&&!localStorage.getItem("viva-install-dismissed"))setShowAndroid(true);};
  const onInstalled=()=>{setShowAndroid(false);setShowIos(false);setInstallEvent(null);};
  window.addEventListener("beforeinstallprompt",onPrompt);window.addEventListener("appinstalled",onInstalled);
  return()=>{window.removeEventListener("beforeinstallprompt",onPrompt);window.removeEventListener("appinstalled",onInstalled);};
 },[]);
 async function install(){if(!installEvent)return;await installEvent.prompt();const choice=await installEvent.userChoice;if(choice.outcome==="accepted")setShowAndroid(false);setInstallEvent(null);}
 function update(){const waiting=navigator.serviceWorker?.controller?undefined:undefined;void waiting;registrationUpdate();}
 function registrationUpdate(){navigator.serviceWorker?.getRegistration("/").then(reg=>{if(reg?.waiting){reloading.current=true;reg.waiting.postMessage({type:"SKIP_WAITING"});}});setUpdateReady(false);}
 return <>{updateReady&&<div role="status" className="fixed left-3 right-3 top-3 z-[10000] flex items-center justify-between gap-3 rounded-2xl bg-[#24103f] px-4 py-3 text-sm font-semibold text-white shadow-xl"><span>Nova versão disponível. Atualizar</span><button className="rounded-xl bg-white px-3 py-2 font-bold text-[#6410C9]" onClick={update}>Atualizar</button></div>}
 {(showAndroid||showIos)&&<div className="viva-install-layer" role="dialog" aria-modal="true" aria-label="Instalar VIVA+"><button className="viva-install-backdrop" onClick={()=>{setShowAndroid(false);setShowIos(false);sessionStorage.setItem("viva-ios-guide-dismissed","1");localStorage.setItem("viva-install-dismissed","1")}} aria-label="Fechar"/><section className="viva-install-sheet"><div className="viva-install-handle"/><div className="viva-install-brand">V<span>+</span></div>{showIos?<><span className="viva-install-kicker">VIVA+ NO SEU IPHONE</span><h2>Tenha a VIVA na sua Tela de Início</h2><p>No Safari, toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.</p><div className="viva-ios-steps"><span>1 <b>Compartilhar</b> <i>□↑</i></span><span>2 <b>Adicionar à Tela de Início</b> <i>＋</i></span></div><button className="viva-install-primary" onClick={()=>{setShowIos(false);sessionStorage.setItem("viva-ios-guide-dismissed","1")}}>Entendi</button></>:<><span className="viva-install-kicker">SEU APP PESSOAL</span><h2>Instale o VIVA+</h2><p>Abra direto na conversa, com uma experiência de aplicativo no seu celular.</p><button className="viva-install-primary" onClick={install}>Instalar VIVA+</button><button className="viva-install-later" onClick={()=>{setShowAndroid(false);localStorage.setItem("viva-install-dismissed","1")}}>Agora não</button></>}</section></div>}</>;
}
