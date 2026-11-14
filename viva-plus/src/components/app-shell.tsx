"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
function Mark(){return <span className="viva-wordmark">VIVA<span>+</span></span>}
function Glyph({name}:{name:string}){return <svg viewBox="0 0 28 28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">{name==="menu"?<path d="M5 8h18M5 14h18M5 20h18"/>:name==="close"?<path d="m7 7 14 14M21 7 7 21"/>:name==="agenda"?<><path d="M5 8h18v15H5zM9 5v6M19 5v6M8 16l3 3 7-7"/></>:name==="money"?<><circle cx="14" cy="14" r="10"/><path d="M14 8v12M18 11c-1-2-7-2-7 1 0 4 8 1 8 5 0 3-6 4-9 1M22 6l2-2"/></>:<><path d="M7 8h14l2 4v9H5v-9zM9 8V5h10v3M10 15c0 3 8 3 8 0"/></>}</svg>}
export default function AppShell({children,email,isAdmin=false}:{children:React.ReactNode;email:string;isAdmin?:boolean}){
 const path=usePathname();const router=useRouter();const [open,setOpen]=useState(false);const [loggingOut,setLoggingOut]=useState(false);const touchStart=useRef<{x:number;y:number}|null>(null);
 async function logout(){if(loggingOut)return;setLoggingOut(true);try{const supabase=createClient();await supabase.auth.signOut();router.replace("/login");router.refresh()}finally{setLoggingOut(false)}}
 const links=[{href:"/assistente",label:"Conversar com a VIVA",kind:"viva"},{href:"/agenda",label:"Minha agenda",kind:"agenda"},{href:"/financas",label:"Meu dinheiro",kind:"money"},{href:"/economizar",label:"Radar de preços",kind:"save"},{href:"/planos",label:"Planos e créditos",kind:"profile"},{href:"/perfil",label:"Minha conta",kind:"profile"},...(isAdmin?[{href:"/admin",label:"Painel administrativo",kind:"admin"}]:[])];
 function startTouch(e:React.TouchEvent){const t=e.touches[0];touchStart.current={x:t.clientX,y:t.clientY}}
 function endTouch(e:React.TouchEvent){if(!touchStart.current)return;const t=e.changedTouches[0];const dx=t.clientX-touchStart.current.x;const dy=Math.abs(t.clientY-touchStart.current.y);if(dy<90&&touchStart.current.x<24&&dx>75)setOpen(true);if(dy<90&&open&&dx< -75)setOpen(false);touchStart.current=null}
 function newChat(){window.dispatchEvent(new Event("viva:new-chat"));if(path!=="/assistente")router.push("/assistente")}
 return <div className="viva-app" onTouchStart={startTouch} onTouchEnd={endTouch}>
  <header className="viva-topbar">
   <Link href="/assistente" aria-label="VIVA+ início" className="viva-desktop-brand"><Mark/></Link>
   <div className="viva-top-actions viva-desktop-actions"><button className="viva-menu-button" onClick={()=>setOpen(true)} aria-label="Abrir menu"><Glyph name="menu"/></button><Link href="/perfil" className="viva-user-avatar" title={email}>{email.slice(0,1).toUpperCase()}</Link></div>
   <div className="viva-mobile-header"><button className="viva-mobile-icon" onClick={()=>setOpen(true)} aria-label="Abrir menu"><Glyph name="menu"/></button><span>VIVA<span>+</span></span><button className="viva-mobile-icon" onClick={newChat} aria-label="Nova conversa"><svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M14 5v18M5 14h18"/></svg></button></div>
  </header>
  <main className="viva-main">{children}</main>
  {open&&<><button className="viva-drawer-backdrop" aria-label="Fechar menu" onClick={()=>setOpen(false)}/><aside className="viva-drawer" role="dialog" aria-modal="true" aria-label="Menu principal"><div className="viva-drawer-head"><Mark/><button onClick={()=>setOpen(false)} aria-label="Fechar menu"><Glyph name="close"/></button></div><p className="viva-drawer-label">SEU ESPAÇO</p><nav>{links.map(item=><Link key={item.href} href={item.href} onClick={()=>setOpen(false)} className={path===item.href?"active":""}>{item.kind==="viva"?<span className="viva-mini-orb"/>:<Glyph name={item.kind}/>}<span>{item.label}</span></Link>)}</nav><div className="viva-drawer-bottom"><div className="viva-drawer-email">{email}</div><button onClick={logout} disabled={loggingOut}>{loggingOut?"Saindo...":"Sair da conta"}</button></div></aside></>}
 </div>
}
