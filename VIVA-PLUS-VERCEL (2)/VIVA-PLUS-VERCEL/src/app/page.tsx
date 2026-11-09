import Link from "next/link";
import { ArrowUpRight, CalendarDays, Wallet, ShoppingBag, Sparkles, Check } from "lucide-react";
export default function Home(){
 return <main className="min-h-screen overflow-hidden">
  <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6"><Link href="/" className="text-3xl font-black" style={{color:"var(--purple)"}}>VIVA<span style={{color:"var(--yellow)"}}>+</span></Link><div className="flex gap-3"><Link href="/login" className="rounded-xl px-4 py-3 text-sm font-bold">Entrar</Link><Link href="/cadastro" className="btn-primary text-sm">Começar agora</Link></div></header>
  <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-12 md:grid-cols-2 md:pt-24">
   <div><span className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold" style={{background:"var(--purple-soft)",color:"var(--purple)"}}><Sparkles size={14}/> SUA VIDA, EM HARMONIA</span>
    <h1 className="mt-7 text-5xl font-black leading-[1.04] tracking-tight md:text-7xl">Mais clareza para <span style={{color:"var(--purple)"}}>viver.</span><br/>Mais inteligência para <span style={{background:"var(--yellow)"}}>escolher.</span></h1>
    <p className="mt-7 max-w-xl text-lg leading-8" style={{color:"var(--muted)"}}>Organize sua rotina, acompanhe seu dinheiro e encontre caminhos para economizar. Tudo conectado em um só lugar.</p>
    <div className="mt-9 flex flex-wrap gap-3"><Link href="/cadastro" className="btn-primary inline-flex items-center gap-2">Criar minha conta <ArrowUpRight size={18}/></Link><Link href="/login" className="rounded-xl border bg-white px-5 py-3 font-bold" style={{borderColor:"var(--line)"}}>Já tenho uma conta</Link></div>
    <div className="mt-8 flex flex-wrap gap-5 text-sm" style={{color:"var(--muted)"}}>{["Simples de usar","Seus dados protegidos","Feito para o seu dia"].map(x=><span key={x} className="inline-flex items-center gap-1"><Check size={15} style={{color:"var(--purple)"}}/>{x}</span>)}</div>
   </div>
   <div className="relative"><div className="absolute -right-10 -top-10 h-64 w-64 rounded-full blur-3xl" style={{background:"#DCC4FA",opacity:.65}}/><div className="relative rounded-[32px] p-6 shadow-2xl" style={{background:"#292333"}}>
    <div className="flex items-center justify-between text-white"><span className="font-black text-xl">VIVA<span style={{color:"var(--yellow)"}}>+</span></span><span className="rounded-full px-3 py-1 text-xs" style={{background:"#FFFFFF18"}}>MEU DIA</span></div>
    <p className="mt-9 text-sm text-white/60">UM NOVO DIA, NOVAS POSSIBILIDADES</p><h2 className="mt-2 text-3xl font-bold text-white">Vamos organizar<br/>suas prioridades?</h2>
    <div className="mt-7 grid grid-cols-2 gap-3">{[{t:"Minha vida",d:"Agenda e hábitos",I:CalendarDays},{t:"Meu dinheiro",d:"Finanças e metas",I:Wallet},{t:"Minhas economias",d:"Compras inteligentes",I:ShoppingBag},{t:"Assistente VIVA+",d:"Ajuda inteligente",I:Sparkles}].map(({t,d,I})=><div key={t} className="rounded-2xl p-4 text-white" style={{background:"#FFFFFF12"}}><I size={21} style={{color:"var(--yellow)"}}/><p className="mt-4 font-bold text-sm">{t}</p><p className="mt-1 text-xs text-white/55">{d}</p></div>)}</div>
    <div className="mt-4 rounded-2xl p-4" style={{background:"var(--yellow)",color:"#342A12"}}><p className="text-xs font-bold">UM PASSO DE CADA VEZ</p><p className="mt-1 text-sm font-semibold">Organize hoje. Viva melhor amanhã.</p></div>
   </div></div>
  </section>
  <section className="border-t bg-white px-5 py-16" style={{borderColor:"var(--line)"}}><div className="mx-auto max-w-7xl"><p className="text-center text-xs font-bold tracking-[.2em]" style={{color:"var(--purple)"}}>TRÊS PILARES. UMA VIDA MAIS LEVE.</p><div className="mt-8 grid gap-5 md:grid-cols-3">{[["01","Minha vida","Agenda, tarefas, hábitos e lembretes."],["02","Meu dinheiro","Receitas, despesas, orçamento e metas."],["03","Minhas economias","Listas de compras e comparação de preços com fontes verificadas."]].map(([n,t,d])=><article key={n} className="card p-6"><span className="text-sm font-black" style={{color:"var(--purple)"}}>{n}</span><h3 className="mt-4 text-xl font-extrabold">{t}</h3><p className="mt-2 text-sm leading-6" style={{color:"var(--muted)"}}>{d}</p></article>)}</div></div></section>
  <footer className="px-5 py-8 text-center text-xs" style={{color:"var(--muted)"}}>VIVA+ · Sua vida mais inteligente.</footer>
 </main>
}
