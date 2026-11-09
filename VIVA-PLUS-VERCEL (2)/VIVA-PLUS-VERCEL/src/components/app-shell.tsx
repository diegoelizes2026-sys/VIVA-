"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Wallet, ShoppingBag, Sparkles, LayoutDashboard, UserRound, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const links=[
  {href:"/meu-dia",label:"Meu Dia",icon:LayoutDashboard},
  {href:"/agenda",label:"Agenda",icon:CalendarDays},
  {href:"/financas",label:"Finanças",icon:Wallet},
  {href:"/economizar",label:"Economizar",icon:ShoppingBag},
  {href:"/assistente",label:"Assistente IA",icon:Sparkles}
];
export default function AppShell({children,email}:{children:React.ReactNode,email:string}) {
  const path=usePathname(); const router=useRouter(); const [open,setOpen]=useState(false);
  async function logout(){const s=createClient();await s.auth.signOut();router.replace("/login");router.refresh();}
  return <div className="min-h-screen md:flex">
    <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-white border-r p-5 transition-transform md:translate-x-0 ${open?"translate-x-0":"-translate-x-full"}`} style={{borderColor:"var(--line)"}}>
      <div className="flex items-center justify-between px-2 py-3">
        <Link href="/meu-dia" className="text-3xl font-black" style={{color:"var(--purple)"}}>VIVA<span style={{color:"var(--yellow)"}}>+</span></Link>
        <button className="md:hidden p-2" onClick={()=>setOpen(false)} aria-label="Fechar menu"><X/></button>
      </div>
      <p className="px-3 mt-9 mb-3 text-[11px] font-bold tracking-[.18em]" style={{color:"var(--muted)"}}>SEU ESPAÇO</p>
      <nav className="space-y-1">{links.map(({href,label,icon:Icon})=>{
        const active=path===href;
        return <Link key={href} href={href} onClick={()=>setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold" style={{background:active?"var(--purple-soft)":"transparent",color:active?"var(--purple)":"var(--muted)"}}><Icon size={19}/>{label}</Link>
      })}</nav>
      <div className="absolute bottom-5 left-5 right-5">
        <Link href="/perfil" className="flex items-center gap-3 rounded-xl p-3" style={{background:"var(--paper)"}}><UserRound size={19}/><span className="min-w-0 flex-1 truncate text-sm">{email}</span></Link>
        <button onClick={logout} className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm" style={{color:"var(--muted)"}}><LogOut size={18}/> Sair da conta</button>
      </div>
    </aside>
    {open&&<button aria-label="Fechar menu" onClick={()=>setOpen(false)} className="fixed inset-0 z-30 bg-black/30 md:hidden"/>}
    <main className="min-w-0 flex-1 md:ml-72">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-white/90 px-4 backdrop-blur md:px-9" style={{borderColor:"var(--line)"}}>
        <button className="md:hidden p-2" onClick={()=>setOpen(true)} aria-label="Abrir menu"><Menu/></button>
        <div className="hidden md:block text-sm" style={{color:"var(--muted)"}}>Seu espaço pessoal</div>
        <div className="ml-auto flex items-center gap-2 text-sm font-semibold"><span className="h-2 w-2 rounded-full" style={{background:"#25B879"}}/> Conta conectada</div>
      </header>
      <div className="mx-auto max-w-7xl p-4 pb-24 md:p-9">{children}</div>
      <nav className="fixed bottom-0 left-0 right-0 z-20 grid grid-cols-5 border-t bg-white px-1 py-2 md:hidden" style={{borderColor:"var(--line)"}}>
        {links.map(({href,label,icon:Icon})=><Link key={href} href={href} className="flex flex-col items-center gap-1 py-1 text-[10px] font-semibold" style={{color:path===href?"var(--purple)":"var(--muted)"}}><Icon size={19}/>{label==="Assistente IA"?"IA":label}</Link>)}
      </nav>
    </main>
  </div>;
}
