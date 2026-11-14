"use client";
import { useEffect, useState } from "react";
type InstallPromptEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:"accepted"|"dismissed"}>};
export default function PwaRegister(){
 const [installEvent,setInstallEvent]=useState<InstallPromptEvent|null>(null);
 const [showAndroid,setShowAndroid]=useState(false);const [showIos,setShowIos]=useState(false);
 useEffect(()=>{
  if("serviceWorker" in navigator){const register=()=>navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(()=>undefined);if(document.readyState==="complete")register();else window.addEventListener("load",register,{once:true})}
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);const standalone=window.matchMedia("(display-mode: standalone)").matches||("standalone" in navigator&&(navigator as Navigator&{standalone?:boolean}).standalone===true);
  const visits=Number(localStorage.getItem("viva-visits")||"0")+1;localStorage.setItem("viva-visits",String(visits));
  if(ios&&!standalone&&!sessionStorage.getItem("viva-ios-guide-dismissed"))setShowIos(true);
  const onPrompt=(event:Event)=>{event.preventDefault();setInstallEvent(event as InstallPromptEvent);if(visits>=2&&!localStorage.getItem("viva-install-dismissed"))setShowAndroid(true)};
  window.addEventListener("beforeinstallprompt",onPrompt);
  const onInstalled=()=>{setShowAndroid(false);setShowIos(false);setInstallEvent(null)};
  window.addEventListener("appinstalled",onInstalled);
  return()=>{window.removeEventListener("beforeinstallprompt",onPrompt);window.removeEventListener("appinstalled",onInstalled)};
 },[]);
 async function install(){if(!installEvent)return;await installEvent.prompt();const choice=await installEvent.userChoice;if(choice.outcome==="accepted")setShowAndroid(false);setInstallEvent(null)}
 if(!showAndroid&&!showIos)return null;
 return <div className="viva-install-layer" role="dialog" aria-modal="true" aria-label="Instalar VIVA+">
  <button className="viva-install-backdrop" onClick={()=>{setShowAndroid(false);setShowIos(false);sessionStorage.setItem("viva-ios-guide-dismissed","1");localStorage.setItem("viva-install-dismissed","1")}} aria-label="Fechar"/>
  <section className="viva-install-sheet"><div className="viva-install-handle"/><div className="viva-install-brand">V<span>+</span></div>
   {showIos?<><span className="viva-install-kicker">VIVA+ NO SEU IPHONE</span><h2>Tenha a VIVA na sua Tela de Início</h2><p>No Safari, toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.</p><div className="viva-ios-steps"><span>1 <b>Compartilhar</b> <i>□↑</i></span><span>2 <b>Adicionar à Tela de Início</b> <i>＋</i></span></div><button className="viva-install-primary" onClick={()=>{setShowIos(false);sessionStorage.setItem("viva-ios-guide-dismissed","1")}}>Entendi</button></>:<><span className="viva-install-kicker">SEU APP PESSOAL</span><h2>Instale o VIVA+</h2><p>Abra direto na conversa, com uma experiência de aplicativo no seu celular.</p><button className="viva-install-primary" onClick={install}>Instalar VIVA+</button><button className="viva-install-later" onClick={()=>{setShowAndroid(false);localStorage.setItem("viva-install-dismissed","1")}}>Agora não</button></>}
  </section>
 </div>
}
