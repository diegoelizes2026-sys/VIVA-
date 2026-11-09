"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Wallet, Search, Sparkles, House, UserRound, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/meu-dia", label: "Início", icon: House },
  { href: "/economizar", label: "Buscar", icon: Search },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/financas", label: "Dinheiro", icon: Wallet },
  { href: "/assistente", label: "Assistente", icon: Sparkles },
];

export default function AppShell({ children, email }: { children: React.ReactNode; email: string }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try { const supabase = createClient(); await supabase.auth.signOut(); router.replace("/login"); router.refresh(); }
    finally { setLoggingOut(false); }
  }
  const activeLink = links.find(({href}) => path === href || path.startsWith(href + "/"));
  return <div className="min-h-screen bg-[var(--viva-canvas)] md:flex">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r bg-white px-4 py-5 transition-transform duration-200 md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`} style={{borderColor:"var(--viva-line)"}}>
      <div className="flex items-center justify-between px-3 pb-8 pt-1">
        <Link href="/meu-dia" className="brand-mark text-[29px]">VIVA<span>+</span></Link>
        <button className="rounded-xl p-2 text-neutral-500 hover:bg-neutral-100 md:hidden" onClick={()=>setOpen(false)} aria-label="Fechar menu"><X size={19}/></button>
      </div>
      <p className="px-3 pb-3 text-[10px] font-bold tracking-[.17em] text-neutral-400">SEU ESPAÇO</p>
      <nav className="space-y-1">
        {links.map(({href,label,icon:Icon})=>{
          const active=path===href || (href!=="/meu-dia" && path.startsWith(href+"/"));
          return <Link key={href} href={href} onClick={()=>setOpen(false)} aria-current={active?"page":undefined}
            className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold transition-colors"
            style={{background:active?"var(--viva-purple-soft)":"transparent",color:active?"var(--viva-purple)":"#77727F"}}>
            <Icon size={18} strokeWidth={active?2.3:1.8}/>{label}
            {active&&<span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--viva-purple)]"/>}
          </Link>;
        })}
      </nav>
      <div className="mt-auto border-t pt-4" style={{borderColor:"var(--viva-line)"}}>
        <Link href="/perfil" className="flex min-w-0 items-center gap-3 rounded-xl p-3 transition-colors hover:bg-neutral-50">
          <span className="icon-surface h-9 w-9 shrink-0"><UserRound size={17}/></span>
          <span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold text-neutral-400">SUA CONTA</span><span className="mt-0.5 block truncate text-xs font-semibold text-neutral-700">{email}</span></span>
        </Link>
        <button onClick={logout} disabled={loggingOut} className="mt-1 flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-xs font-semibold text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900">
          <LogOut size={16}/>{loggingOut?"Saindo...":"Sair da conta"}
        </button>
      </div>
    </aside>
    {open&&<button aria-label="Fechar menu" onClick={()=>setOpen(false)} className="fixed inset-0 z-30 bg-black/25 md:hidden"/>}
    <main className="min-w-0 flex-1 md:ml-[248px]">
      <header className="sticky top-0 z-20 flex h-[62px] items-center justify-between border-b bg-white/90 px-4 backdrop-blur-xl md:px-8" style={{borderColor:"var(--viva-line)"}}>
        <button className="rounded-xl p-2 text-neutral-600 hover:bg-neutral-100 md:hidden" onClick={()=>setOpen(true)} aria-label="Abrir menu"><Menu size={20}/></button>
        <div className="hidden items-center gap-2 text-xs font-medium text-neutral-400 md:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"/>{activeLink?.label || "Seu espaço"}</div>
        <Link href="/perfil" className="ml-auto flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-50" style={{borderColor:"var(--viva-line)"}}>
          <UserRound size={15}/><span className="hidden sm:inline">Minha conta</span>
        </Link>
      </header>
      <div className="mx-auto max-w-[1320px] px-4 pb-28 pt-6 sm:px-6 md:px-9 md:pb-10 md:pt-8">{children}</div>
      <nav aria-label="Navegação principal" className="fixed bottom-0 left-0 right-0 z-20 grid grid-cols-5 border-t bg-white/95 px-1 pb-[max(7px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden" style={{borderColor:"var(--viva-line)"}}>
        {links.map(({href,label,icon:Icon})=>{
          const active=path===href || (href!=="/meu-dia" && path.startsWith(href+"/"));
          return <Link key={href} href={href} aria-current={active?"page":undefined} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-semibold" style={{color:active?"var(--viva-purple)":"#8C8792"}}>
            <Icon size={19} strokeWidth={active?2.35:1.8}/><span>{label}</span>
          </Link>;
        })}
      </nav>
    </main>
  </div>;
}
