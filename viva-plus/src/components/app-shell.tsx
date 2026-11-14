"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Wallet, ShoppingBag, Sparkles, LayoutDashboard, UserRound, LogOut, Menu, X, MessageCircle } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/meu-dia", label: "Meu Dia", icon: LayoutDashboard },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/financas", label: "Finanças", icon: Wallet },
  { href: "/economizar", label: "Economizar", icon: ShoppingBag },
  { href: "/assistente", label: "Assistente IA", icon: Sparkles }
];

export default function AppShell({ children, email }: { children: React.ReactNode; email: string }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const mobileTitle = path.startsWith("/agenda") ? "Agenda financeira" : path.startsWith("/assistente") ? "Assistente VIVA+" : path.startsWith("/financas") ? "Finanças" : path.startsWith("/economizar") ? "Economizar" : "Boa tarde!";
  const mobileSubtitle = path.startsWith("/agenda") ? "Toque em um dia para ver detalhes" : path.startsWith("/assistente") ? "Sempre por perto para ajudar" : "Seu resumo financeiro e sua rotina";

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return <div className="min-h-screen bg-white md:flex">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[286px] flex-col border-r bg-white p-5 transition-transform duration-200 md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`} style={{ borderColor: "var(--color-gray)" }}>
      <div className="flex items-center justify-between px-2 py-3">
        <Link href="/meu-dia" className="brand-mark text-[30px]">VIVA<span className="text-[var(--color-primary)]">+</span></Link>
        <button className="rounded-xl p-2 text-neutral-500 hover:bg-neutral-100 md:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu"><X size={20}/></button>
      </div>
      <p className="mb-3 mt-9 px-3 text-[10px] font-bold tracking-[.2em] text-neutral-400">SEU ESPAÇO</p>
      <nav className="space-y-1.5">
        {links.map(({ href, label, icon: Icon }) => {
          const active = path === href || (href !== "/meu-dia" && path.startsWith(href + "/"));
          return <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
            className="group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors"
            style={{ background: active ? "var(--color-primary-soft)" : "transparent", color: active ? "var(--color-primary)" : "var(--color-muted)" }}>
            <Icon size={19} strokeWidth={active ? 2.4 : 1.9}/>{label}
            {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]"/>}
          </Link>;
        })}
      </nav>
      <div className="mt-auto pt-6">
        <Link href="/perfil" className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-neutral-50" style={{ borderColor: "var(--color-gray)" }}>
          <span className="icon-surface h-9 w-9 shrink-0"><UserRound size={18}/></span>
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-neutral-700">{email}</span>
        </Link>
        <button onClick={logout} disabled={loggingOut} className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900">
          <LogOut size={18}/>{loggingOut ? "Saindo..." : "Sair da conta"}
        </button>
      </div>
    </aside>

    {open && <button aria-label="Fechar menu" onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-black/30 md:hidden"/>}
    <main className="min-w-0 flex-1 md:ml-[286px]">
      <header className="desktop-topbar sticky top-0 z-20 flex h-[68px] items-center justify-between border-b bg-white/95 px-4 backdrop-blur-xl md:px-9" style={{ borderColor: "var(--color-gray)" }}>
        <button className="rounded-xl p-2 text-neutral-600 hover:bg-neutral-100 md:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu size={21}/></button>
        <div className="hidden text-sm font-medium text-neutral-500 md:block">Seu espaço pessoal</div>
        <div className="ml-auto flex items-center gap-2 rounded-full bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-600">
          <span className="h-2 w-2 rounded-full bg-emerald-500"/> Conta conectada
        </div>
      </header>
      <div className="mobile-brand-header md:hidden"><div className="flex items-center justify-between"><Link href="/meu-dia" className="text-[28px] font-black tracking-tight text-white">VIVA+</Link><Link href="/perfil" className="grid h-10 w-10 place-items-center rounded-full bg-white/20 text-sm font-bold text-white">M</Link></div><h1 className="mt-3 text-xl font-bold text-white">{mobileTitle}</h1><p className="mt-0.5 text-xs text-white/75">{mobileSubtitle}</p></div><div className="app-content mx-auto max-w-7xl p-4 pb-28 md:p-9">{children}</div>
      <Link href="/assistente" aria-label="Conversar com a VIVA+" title="Conversar com a VIVA+" className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition-transform hover:scale-105 md:bottom-8 md:right-8" style={{ background: "var(--color-primary)" }}><MessageCircle size={25}/><span className="absolute -left-28 top-1/2 -translate-y-1/2 rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">Fale com a VIVA</span></Link>
      <nav aria-label="Navegação principal" className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-20 grid grid-cols-3 border-t bg-white px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 md:hidden" style={{ borderColor: "var(--color-gray)" }}>
        {[links[0], links[1], links[4]].map(({ href, label, icon: Icon }) => {
          const active = path === href || (href !== "/meu-dia" && path.startsWith(href + "/"));
          return <Link key={href} href={href} aria-current={active ? "page" : undefined} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition-colors" style={{ color: active ? "var(--color-primary)" : "var(--color-muted)" }}>
            <Icon size={21} strokeWidth={active ? 2.5 : 1.8}/>{href === "/meu-dia" ? "Início" : href === "/agenda" ? "Agenda" : "Assistente"}
          </Link>;
        })}
      </nav>
    </main>
  </div>;
}
