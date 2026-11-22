"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AlarmOverlay from "@/components/alarm-overlay";
import PermissionOnboarding from "@/components/permission-onboarding";
import { track } from "@/lib/track";
function Mark(){return <span className="viva-wordmark">VIVA<span>+</span></span>}
// Ícone próprio para cada ferramenta (nenhum repetido).
const ICONS:Record<string,React.ReactNode>={
 menu:<path d="M5 8h18M5 14h18M5 20h18"/>,
 close:<path d="m7 7 14 14M21 7 7 21"/>,
 wallet:<><path d="M5 9.5A2.5 2.5 0 0 1 7.5 7H21a1 1 0 0 1 1 1v3"/><path d="M5 9.5V20a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3"/><path d="M23 11h-5a3 3 0 0 0 0 6h5z"/><circle cx="18.5" cy="14" r=".8" fill="currentColor"/></>,
 planning:<><circle cx="14" cy="14" r="9.5"/><circle cx="14" cy="14" r="5.5"/><circle cx="14" cy="14" r="1.6" fill="currentColor"/><path d="m20 8 3-3M20 5h3v3"/></>,
 bills:<><path d="M7 4h14v20l-2.5-1.6L16 24l-2-1.6-2 1.6-2.5-1.6L7 24z"/><path d="M11 10h6M11 14h6M11 18h3"/></>,
 cart:<><path d="M3.5 5h3l2.6 12.2a1.5 1.5 0 0 0 1.5 1.2h9.6a1.5 1.5 0 0 0 1.5-1.1L24 9H8"/><circle cx="11.5" cy="22.5" r="1.4"/><circle cx="20" cy="22.5" r="1.4"/></>,
 price:<><path d="M4 14.6V5.5A1.5 1.5 0 0 1 5.5 4h9.1a2 2 0 0 1 1.4.6l8 8a2 2 0 0 1 0 2.8l-8.5 8.5a2 2 0 0 1-2.8 0l-8-8A2 2 0 0 1 4 14.6Z"/><circle cx="9.5" cy="9.5" r="1.8"/></>,
 nearby:<><path d="M14 24.5s7.5-6.6 7.5-13a7.5 7.5 0 0 0-15 0c0 6.4 7.5 13 7.5 13Z"/><circle cx="14" cy="11.5" r="2.8"/></>,
 gift:<><rect x="4.5" y="10.5" width="19" height="13" rx="2"/><path d="M3.5 10.5h21v-3.5h-21zM14 7v16.5"/><path d="M14 7c-2-4-7-4-6.5-1 .4 2 4 1.5 6.5 1ZM14 7c2-4 7-4 6.5-1-.4 2-4 1.5-6.5 1Z"/></>,
 agenda:<><rect x="4.5" y="6" width="19" height="17" rx="3"/><path d="M9 3.5v5M19 3.5v5M4.5 11.5h19M9.5 16h3"/></>,
 notifications:<><path d="M19 10a5 5 0 0 0-10 0c0 7-3 8-3 9.5h16c0-1.5-3-2.5-3-9.5"/><path d="M11.5 23a2.6 2.6 0 0 0 5 0"/></>,
 credits:<><circle cx="11" cy="14" r="7.5"/><path d="M11 10v8M8.5 12.5c.5-1.6 4.5-1.6 4.5.6 0 2.3-4.8 1.3-4.8 3.6 0 1.8 4.3 1.8 5-.2"/><path d="M19 7.5a7.5 7.5 0 0 1 0 13"/></>,
 plans:<><path d="m4 10 5 4 5-8 5 8 5-4-2 11H6z"/><path d="M6.5 24h15"/></>,
 mydata:<><path d="M14 3.5 5 7v6.5c0 5.3 3.8 9.3 9 11 5.2-1.7 9-5.7 9-11V7z"/><circle cx="14" cy="12" r="2.6"/><path d="M9.8 19a5 5 0 0 1 8.4 0"/></>,
 account:<><circle cx="14" cy="9.5" r="4.5"/><path d="M5 24c.9-4.6 4.4-7 9-7s8.1 2.4 9 7"/></>,
 admin:<><circle cx="14" cy="14" r="3.4"/><path d="M14 3.5v3M14 21.5v3M24.5 14h-3M6.5 14h-3M21.4 6.6l-2.1 2.1M8.7 19.3l-2.1 2.1M21.4 21.4l-2.1-2.1M8.7 8.7 6.6 6.6"/></>,
 health:<path d="M14 23s-9-5.5-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.5-9 12-9 12ZM6 14h4l2-3 3 6 2-3h5"/>,
 chat:<path d="M6 5.5h16a2.5 2.5 0 0 1 2.5 2.5v10a2.5 2.5 0 0 1-2.5 2.5h-8l-6 4v-4H6A2.5 2.5 0 0 1 3.5 18V8A2.5 2.5 0 0 1 6 5.5Z"/>,
};
function Glyph({name}:{name:string}){return <svg viewBox="0 0 28 28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">{ICONS[name]??ICONS.account}</svg>}
type EntryOfferPlan={id:string;name:string;monthly_price_brl:number;annual_price_brl:number;daily_credits:number;history_messages:number;radar_enabled:boolean;voice_enabled:boolean;photo_enabled:boolean};
// Entrada sem barreira: o usuário novo entra no plano grátis e experimenta a VIVA; os planos ficam em "Planos" no menu.
export default function AppShell({children,email,isAdmin=false}:{children:React.ReactNode;email:string;isAdmin?:boolean;entryOfferPlans?:EntryOfferPlan[];currentPlanId?:string}){
 // Marca que o app já abriu nesta sessão (o chat usa isso para não redirecionar de novo).
 useEffect(()=>{try{sessionStorage.setItem("viva-launched","1")}catch{}},[]);
 const path=usePathname();const router=useRouter();const [open,setOpen]=useState(false);const [loggingOut,setLoggingOut]=useState(false);const touchStart=useRef<{x:number;y:number}|null>(null);
 // Painel de uso: registra a tela (primeiro trecho do endereço), uma vez por dia.
 useEffect(()=>{const seg="/"+(path.split("/")[1]||"");track(seg);const onShow=()=>{if(document.visibilityState==="visible")track(seg)};document.addEventListener("visibilitychange",onShow);return()=>document.removeEventListener("visibilitychange",onShow)},[path]);
 async function logout(){if(loggingOut)return;setLoggingOut(true);try{const supabase=createClient();await supabase.auth.signOut();router.replace("/login");router.refresh()}finally{setLoggingOut(false)}}
 // Menu organizado: destaques (VIVA e Saúde) e ferramentas agrupadas por assunto.
 const groups:{title:string;items:{href:string;label:string;kind:string}[]}[]=[
  {title:"Dinheiro",items:[{href:"/financas",label:"Meu dinheiro",kind:"wallet"},{href:"/planejamento",label:"Planejamento financeiro",kind:"planning"},{href:"/contas",label:"Contas a pagar",kind:"bills"},{href:"/lista-de-compras",label:"Lista de compras",kind:"cart"},{href:"/perto",label:"Perto de mim",kind:"nearby"},{href:"/economizar",label:"Radar de preços",kind:"price"}]},
  {title:"Organização",items:[{href:"/agenda",label:"Minha agenda",kind:"agenda"},{href:"/configuracoes/notificacoes",label:"Notificações",kind:"notifications"}]},
  {title:"Conta",items:[{href:"/creditos",label:"Meus créditos",kind:"credits"},{href:"/indique",label:"Indique e ganhe",kind:"gift"},{href:"/planos",label:"Planos",kind:"plans"},{href:"/meus-dados",label:"Meus dados",kind:"mydata"},{href:"/perfil",label:"Minha conta",kind:"account"},...(isAdmin?[{href:"/admin",label:"Painel administrativo",kind:"admin"}]:[])]},
 ];
 function startTouch(e:React.TouchEvent){const t=e.touches[0];touchStart.current={x:t.clientX,y:t.clientY}}
 function endTouch(e:React.TouchEvent){if(!touchStart.current)return;const t=e.changedTouches[0];const dx=t.clientX-touchStart.current.x;const dy=Math.abs(t.clientY-touchStart.current.y);if(dy<90&&touchStart.current.x<24&&dx>75)setOpen(true);if(dy<90&&open&&dx< -75)setOpen(false);touchStart.current=null}
 function newChat(){window.dispatchEvent(new Event("viva:new-chat"));if(path!=="/assistente")router.push("/assistente")}
 return <div className="viva-app" onTouchStart={startTouch} onTouchEnd={endTouch}>
  <header className="viva-topbar">
   <Link href="/meu-dia" aria-label="VIVA+ início" className="viva-desktop-brand"><Mark/></Link>
   <div className="viva-top-actions viva-desktop-actions"><button className="viva-menu-button" onClick={()=>setOpen(true)} aria-label="Abrir menu"><Glyph name="menu"/></button><Link href="/perfil" className="viva-user-avatar" title={email}>{email.slice(0,1).toUpperCase()}</Link></div>
   <div className="viva-mobile-header"><button className="viva-mobile-icon" onClick={()=>setOpen(true)} aria-label="Abrir menu"><Glyph name="menu"/></button><span className="viva-mobile-brand">VIVA<span>+</span><i className="viva-mobile-online" aria-label="Online"/></span><button className="viva-mobile-icon" onClick={newChat} aria-label="Nova conversa"><svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 5.5h16a2.5 2.5 0 0 1 2.5 2.5v10a2.5 2.5 0 0 1-2.5 2.5h-8l-6 4v-4H6A2.5 2.5 0 0 1 3.5 18V8A2.5 2.5 0 0 1 6 5.5Z"/><path d="M14 9v8M10 13h8"/></svg></button></div>
  </header>
  <main className="viva-main">{children}</main><AlarmOverlay/><PermissionOnboarding/>
  {open&&<><button className="viva-drawer-backdrop" aria-label="Fechar menu" onClick={()=>setOpen(false)}/><aside className="viva-drawer" role="dialog" aria-modal="true" aria-label="Menu principal"><div className="viva-drawer-head"><Mark/><button onClick={()=>setOpen(false)} aria-label="Fechar menu"><Glyph name="close"/></button></div><nav aria-label="Menu principal">
  <div className="viva-drawer-featured"><Link href="/meu-dia" onClick={()=>setOpen(false)} className={"viva-feature viva-feature-today"+(path==="/meu-dia"?" active":"")}><span className="viva-feature-icon">☀️</span><b>Meu dia</b><small>Quanto posso gastar hoje</small></Link>
   <Link href="/assistente" onClick={()=>setOpen(false)} className={"viva-feature viva-feature-chat"+(path==="/assistente"?" active":"")}><span className="viva-feature-icon"><span className="viva-mini-orb"/></span><b>Conversar com a VIVA</b><small>Dinheiro, agenda e dia a dia</small></Link>
   <Link href="/saude" onClick={()=>setOpen(false)} className={"viva-feature viva-feature-health"+(path==="/saude"?" active":"")}><span className="viva-feature-icon"><Glyph name="health"/></span><b>Saúde e bem-estar</b><small>Personal com IA e rotina</small></Link>
  </div>
  {groups.map(g=><div key={g.title} className="viva-drawer-group"><p className="viva-drawer-label">{g.title.toUpperCase()}</p>{g.items.map(item=><Link key={item.href} href={item.href} onClick={()=>setOpen(false)} className={path===item.href?"active":""}><span className={"viva-nav-icon viva-nav-"+item.kind}><Glyph name={item.kind}/></span><span>{item.label}</span></Link>)}</div>)}
 </nav><div className="viva-drawer-bottom"><div className="viva-drawer-email">{email}</div><button onClick={logout} disabled={loggingOut}>{loggingOut?"Saindo...":"Sair da conta"}</button></div></aside></>}
 </div>
}
