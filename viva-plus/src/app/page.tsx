import Link from "next/link";
import { ArrowUpRight, CalendarDays, Wallet, ShoppingBag, Sparkles, Check, ShieldCheck } from "lucide-react";

const features = [
  { title: "Minha vida", description: "Agenda, tarefas e hábitos.", Icon: CalendarDays },
  { title: "Meu dinheiro", description: "Receitas, despesas e metas.", Icon: Wallet },
  { title: "Minhas economias", description: "Compras com mais consciência.", Icon: ShoppingBag },
  { title: "Assistente VIVA+", description: "Ideias para organizar decisões.", Icon: Sparkles }
];

export default function Home() {
  return <main className="min-h-screen overflow-hidden bg-white">
    <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-8">
      <Link href="/" className="brand-mark text-3xl">VIVA<span>+</span></Link>
      <nav className="flex items-center gap-2"><Link href="/login" className="rounded-xl px-4 py-3 text-sm font-bold text-neutral-600 transition-colors hover:text-[var(--color-primary)]">Entrar</Link><Link href="/cadastro" className="btn-primary text-sm">Começar agora <ArrowUpRight size={16}/></Link></nav>
    </header>

    <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-10 md:grid-cols-[1.05fr_.95fr] md:px-8 md:pb-28 md:pt-20">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-4 py-2 text-xs font-bold tracking-wide" style={{ color: "var(--color-primary)" }}><Sparkles size={14}/> SUA VIDA, EM HARMONIA</span>
        <h1 className="mt-7 max-w-2xl text-[clamp(2.8rem,6vw,5.4rem)] font-black leading-[1.02] tracking-[-.055em] text-neutral-950">Mais clareza para <span style={{ color: "var(--color-primary)" }}>viver.</span><br/>Mais leveza para escolher.</h1>
        <p className="mt-7 max-w-xl text-base leading-8 text-neutral-500 md:text-lg">Organize sua rotina, acompanhe seu dinheiro e planeje suas compras. Tudo em um espaço simples, seguro e feito para você.</p>
        <div className="mt-9 flex flex-wrap gap-3"><Link href="/cadastro" className="btn-primary">Criar minha conta <ArrowUpRight size={18}/></Link><Link href="/login" className="rounded-xl border px-5 py-3 text-sm font-bold text-neutral-700 transition-colors hover:bg-neutral-50" style={{ borderColor: "var(--color-gray)" }}>Já tenho uma conta</Link></div>
        <div className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-xs font-medium text-neutral-500">{["Simples de usar", "Seus dados protegidos", "Feito para o seu dia"].map(item => <span key={item} className="inline-flex items-center gap-2"><Check size={15} style={{ color: "var(--color-primary)" }}/>{item}</span>)}</div>
      </div>

      <div className="relative">
        <div className="absolute -inset-5 rounded-[36px] bg-neutral-100"/>
        <div className="relative rounded-[30px] border bg-white p-5 shadow-[0_24px_70px_rgba(25,21,31,.09)] md:p-7" style={{ borderColor: "var(--color-gray)" }}>
          <div className="flex items-center justify-between"><span className="brand-mark text-2xl">VIVA+</span><span className="rounded-full bg-neutral-100 px-3 py-1.5 text-[10px] font-bold tracking-wider text-neutral-500">VISÃO GERAL</span></div>
          <div className="mt-8 rounded-2xl p-5 text-white" style={{ background: "var(--color-primary)" }}><p className="text-xs font-semibold text-white/75">UM NOVO DIA, NOVAS POSSIBILIDADES</p><h2 className="mt-3 text-2xl font-extrabold leading-tight md:text-3xl">Tudo que importa,<br/>em um só lugar.</h2><div className="mt-5 flex items-center gap-2 text-xs text-white/80"><ShieldCheck size={15}/> Seu espaço pessoal</div></div>
          <div className="mt-4 grid grid-cols-2 gap-3">{features.map(({ title, description, Icon }) => <article key={title} className="interactive-card rounded-2xl border p-4" style={{ borderColor: "var(--color-gray)" }}><span className="icon-surface h-10 w-10"><Icon size={19}/></span><h3 className="mt-4 text-sm font-extrabold text-neutral-900">{title}</h3><p className="mt-1 text-xs leading-5 text-neutral-500">{description}</p></article>)}</div>
          <p className="mt-4 rounded-xl bg-neutral-100 px-4 py-3 text-center text-xs font-semibold text-neutral-600">Organize hoje. Viva melhor amanhã.</p>
        </div>
      </div>
    </section>

    <section className="border-t bg-neutral-50 px-5 py-16 md:px-8" style={{ borderColor: "var(--color-gray)" }}><div className="mx-auto max-w-7xl"><p className="text-center text-xs font-bold tracking-[.2em]" style={{ color: "var(--color-primary)" }}>UM ESPAÇO PARA SUA VIDA</p><h2 className="mt-3 text-center text-2xl font-black tracking-tight text-neutral-900 md:text-3xl">Organização que acompanha você.</h2><div className="mt-9 grid gap-4 md:grid-cols-3">{[["01", "Sua rotina", "Tenha uma visão clara de compromissos e prioridades."], ["02", "Seu dinheiro", "Acompanhe seus lançamentos e cuide dos seus objetivos."], ["03", "Suas escolhas", "Planeje compras e encontre oportunidades com fontes confiáveis."]].map(([number, title, description]) => <article key={number} className="card interactive-card p-6"><span className="text-sm font-black" style={{ color: "var(--color-primary)" }}>{number}</span><h3 className="mt-4 text-lg font-extrabold text-neutral-900">{title}</h3><p className="mt-2 text-sm leading-6 text-neutral-500">{description}</p></article>)}</div></div></section>
    <footer className="px-5 py-8 text-center text-xs text-neutral-400">VIVA+ · Sua vida mais inteligente.</footer>
  </main>;
}