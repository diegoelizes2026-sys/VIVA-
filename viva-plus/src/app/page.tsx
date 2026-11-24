import { redirect } from "next/navigation";
import Link from "next/link";
import { BadgeDollarSign, CalendarClock, Receipt, MessageCircleHeart, ShieldCheck, Mic, Gift, Check, ChevronDown, Target, PiggyBank } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import LandingSticky from "@/components/landing-sticky";
import { LEGAL_LINKS, companyLine } from "@/lib/legal";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP_DISPLAY, supportEmailUrl, supportWhatsAppUrl } from "@/lib/support";

export const metadata = {
  title: "VIVA+ · Chega de o mês acabar antes do salário",
  description: "Todo dia a VIVA te diz quanto você pode gastar sem faltar dinheiro até o próximo pagamento. Você só manda mensagem no WhatsApp. Comece grátis.",
};

type Plan = { id: string; name: string; monthly_price_brl: number; annual_price_brl: number; monthly_credits: number; signup_credits: number; voice_enabled: boolean; photo_enabled: boolean; radar_enabled: boolean };
const brl = (n: number) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Página de vendas: visitantes veem a VIVA; quem já tem conta vai direto para a conversa.
export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/meu-dia");
  const { data } = await supabase.rpc("viva_public_pricing");
  const plans = ((data as Plan[] | null) || []).filter(p => p && p.id);

  const steps = [
    { n: "1", t: "Conte quanto ganha e suas contas", d: "Uma conversa de 2 minutos. Pode pular o que não souber." },
    { n: "2", t: "Receba seu número do dia", d: "A VIVA calcula quanto você pode gastar por dia sem faltar nada até o próximo pagamento." },
    { n: "3", t: "Mande seus gastos pelo WhatsApp", d: "“Gastei 20 no lanche.” A cada gasto o número se ajusta, e no fim do mês sobra dinheiro." },
  ];
  const features = [
    { i: <PiggyBank />, t: "Seu número do dia", d: "Quanto você pode gastar hoje sem faltar no fim do mês. Simples assim." },
    { i: <MessageCircleHeart />, t: "Direto no seu WhatsApp", d: "“Gastei 35 na farmácia”, “quanto posso gastar hoje?”. Sem baixar app novo." },
    { i: <BadgeDollarSign />, t: "Lembra do seu pagamento", d: "No dia em que cai, a VIVA pergunta quanto entrou e sugere quanto separar para as contas." },
    { i: <CalendarClock />, t: "Contas em dia", d: "Avisos antes do vencimento para não pagar juros nem multa." },
    { i: <Receipt />, t: "Gasto anotado em 3 toques", d: "Valor, com o quê e como pagou. Sem planilha, sem complicação." },
    { i: <Target />, t: "Metas que andam", d: "Sair das dívidas, montar uma reserva ou comprar algo, com o valor por mês." },
  ];
  const faq = [
    { q: "Preciso ligar minha conta do banco?", a: "Não. A VIVA não pede senha de banco nem acesso à sua conta. Você conta o que quiser e ela organiza." },
    { q: "É seguro?", a: "Seus dados ficam protegidos e só você acessa. Você pode ver, corrigir ou apagar tudo em Meus dados." },
    { q: "Quanto custa?", a: "Começar é grátis, sem cartão. Se quiser mais conversas com a VIVA, existem planos pagos, e o Pro pode ser testado grátis por 7 dias, sem cartão. A VIVA no WhatsApp já funciona no plano grátis, com 10 mensagens por semana." },
    { q: "O que são créditos?", a: "Cada conversa com a inteligência da VIVA usa créditos. Anotar gastos pelo atalho, ver contas, lista de compras e lembretes não gastam créditos." },
    { q: "Ganho dinheiro indicando?", a: "Sim. Você ganha R$ 10 por amigo indicado que assinar e pagar o plano Pro (o teste grátis não conta). O valor é liberado 30 dias depois do pagamento e você saca por Pix a partir de R$ 30, até R$ 200 por mês." },
    { q: "Funciona no celular?", a: "Sim. Abra no navegador do celular e adicione à tela de início para usar como um aplicativo." },
  ];

  return <main id="conteudo" className="lp">
    <header className="lp-nav">
      <span className="lp-logo">VIVA<span>+</span></span>
      <nav><a href="#como-funciona">Como funciona</a><a href="#planos">Planos</a><a href="#duvidas">Dúvidas</a></nav>
      <div className="lp-nav-cta"><Link href="/login" className="lp-link">Entrar</Link><Link href="/cadastro" className="lp-btn sm">Criar conta grátis</Link></div>
    </header>

    <section className="lp-hero">
      <div className="lp-hero-copy">
        <span className="lp-pill">💬 Funciona no seu WhatsApp</span>
        <h1>Chega de o mês acabar <em>antes do salário.</em></h1>
        <p>Todo dia a VIVA te diz <b>quanto você pode gastar</b> sem faltar dinheiro até o próximo pagamento. Você só manda mensagem: “gastei 20 no lanche”. Ela organiza o resto e lembra das contas por você.</p>
        <div className="lp-hero-cta">
          <Link href="/cadastro" className="lp-btn">Quero fechar o mês no azul</Link>
          <a href="https://wa.me/558588252048?text=Oi%20VIVA!%20Quero%20conhecer" target="_blank" rel="noopener noreferrer" className="lp-btn wa">💬 Falar com a VIVA no WhatsApp</a>
        </div>
        <ul className="lp-trust"><li><Check size={16} /> Grátis para começar</li><li><Check size={16} /> Sem cartão</li><li><Check size={16} /> Não pede senha de banco</li></ul>
      </div>
      <div className="lp-hero-art" aria-hidden="true">
        <div className="ap-stage">
          <div className="ap-phone"><span className="ap-notch" />
            <div className="ap-screen">
              <div className="ap-bar"><b>VIVA<span>+</span></b></div>
              <div className="ap-card"><b>Oi, Ana!</b><small>Seu número de hoje</small><em>Você pode gastar até</em><strong>R$ 42,00</strong><i>e ainda chega no dia 5 no azul ✓</i></div>
              <div className="ap-tiles">{([["Lancei um gasto", <Receipt key="a" />], ["Recebi dinheiro", <BadgeDollarSign key="b" />], ["Contas", <CalendarClock key="c" />], ["Metas", <Target key="d" />], ["Meu dia", <CalendarClock key="e" />], ["Guardar", <PiggyBank key="f" />]] as const).map(([t, ic]) => <span key={t}><i>{ic}</i>{t}</span>)}</div>
              <div className="ap-input">Converse com a VIVA…<span><Mic size={13} /></span></div>
            </div>
          </div>
          <div className="ap-bubble b1"><span className="ap-orb" />Anotado: R$ 35,90 em Farmácia ✅</div>
          <div className="ap-bubble b2"><CalendarClock size={18} />Conta de luz vence amanhã. Já separei!</div>
        </div>
        <small className="lp-note">Tela ilustrativa, com nome e valores de exemplo.</small>
      </div>
    </section>

    <section className="lp-pain">
      <h2>Sabe quando o mês acaba antes do salário?</h2>
      <p>Você não está sozinho. A maioria das pessoas não sabe para onde o dinheiro foi, esquece uma conta e paga juros, e desiste da planilha na segunda semana. A VIVA resolve isso com <b>um número só: quanto você pode gastar hoje.</b> E você usa pelo WhatsApp, como se fosse falar com uma amiga.</p>
    </section>

    <section className="lp-sec" id="como-funciona">
      <span className="lp-kicker">Como funciona</span>
      <h2>Em 2 minutos você sabe quanto pode gastar hoje</h2>
      <div className="lp-steps">{steps.map(s => <div key={s.n} className="lp-step"><b>{s.n}</b><h3>{s.t}</h3><p>{s.d}</p></div>)}</div>
      <div className="lp-video">
        <video src="/videos/viva-anuncio.mp4" poster="/videos/viva-anuncio.jpg" autoPlay muted loop playsInline preload="metadata" aria-label="Vídeo mostrando a VIVA+" />
        <div><h3>Veja a VIVA em ação</h3><p>Anotar gasto, lembrar do pagamento, cuidar das contas: tudo numa conversa.</p><Link href="/cadastro" className="lp-btn">Quero meu número do dia</Link></div>
      </div>
    </section>

    <section className="lp-sec">
      <span className="lp-kicker">Tudo para fechar o mês no azul</span>
      <h2>O que a VIVA faz por você</h2>
      <div className="lp-features">{features.map(f => <div key={f.t} className="lp-feat"><span aria-hidden>{f.i}</span><h3>{f.t}</h3><p>{f.d}</p></div>)}</div>
      <p className="lp-small">E ainda: lista de compras, lugares perto de você e Personal com treinos, tudo no mesmo app.</p>
    </section>

    {plans.length > 0 && <section className="lp-sec" id="planos">
      <span className="lp-kicker">Planos</span>
      <h2>Comece grátis. Quando quiser, leve a VIVA para o seu WhatsApp.</h2>
      <div className="lp-plans">{plans.map(p => {
        const free = Number(p.monthly_price_brl) === 0; const pro = p.id === "pro";
        return <div key={p.id} className={"lp-plan" + (pro ? " hot" : "")}>
          {pro && <span className="lp-plan-tag">Mais completo · teste grátis</span>}
          <h3>{p.name}</h3>
          <p className="lp-price">{free ? <b>Grátis</b> : <><b>{brl(p.monthly_price_brl)}</b><span>/mês</span></>}</p>
          {!free && Number(p.annual_price_brl) > 0 && <small className="lp-annual">ou {brl(p.annual_price_brl)} por ano</small>}
          <ul>
            <li><Check size={16} /> Seu número do dia: quanto pode gastar</li>
            {free ? <li><Check size={16} /> Anote gastos e veja suas contas no app</li> : <li><Check size={16} /> <b>VIVA no seu WhatsApp, todo dia</b></li>}
            <li><Check size={16} /> Aviso antes das contas vencerem</li>
            {!free && <li><Check size={16} /> Plano para sair das dívidas e metas</li>}
            {p.radar_enabled && <li><Check size={16} /> Radar financeiro preventivo</li>}
            {p.voice_enabled && <li><Check size={16} /> Converse por voz</li>}
            {p.photo_enabled && <li><Check size={16} /> Foto de comprovante</li>}
            <li className="lp-muted">{free && p.signup_credits > 0 ? `${p.signup_credits} créditos para começar + ` : ""}{p.monthly_credits} créditos de IA por mês</li>
          </ul>
          <Link href="/cadastro" className={"lp-btn" + (pro ? "" : " ghost")}>{free ? "Criar conta grátis" : pro ? "Testar o Pro grátis" : `Começar com o ${p.name}`}</Link>
        </div>;
      })}</div>
      <p className="lp-small">O teste grátis do Pro é ativado dentro do app, uma vez por conta, sem cartão. Planos pagos são confirmados pelo Mercado Pago.</p>
    </section>}

    <section className="lp-sec lp-first">
      <Gift size={30} aria-hidden />
      <h2>Seja um dos primeiros</h2>
      <p>A VIVA acabou de chegar. Quem entra agora ajuda a decidir as próximas funções e ainda pode <b>ganhar créditos indicando amigos</b> e <b>R$ 10 no Pix por amigo que assinar o Pro</b>.</p>
      <Link href="/cadastro" className="lp-btn light">Criar minha conta grátis</Link>
    </section>

    <section className="lp-sec" id="duvidas">
      <span className="lp-kicker">Dúvidas</span>
      <h2>Perguntas frequentes</h2>
      <div className="lp-faq">{faq.map(f => <details key={f.q}><summary>{f.q}<ChevronDown size={18} aria-hidden /></summary><p>{f.a}</p></details>)}</div>
    </section>

    <footer className="lp-foot">
      <span className="lp-logo">VIVA<span>+</span></span>
      <p><ShieldCheck size={15} aria-hidden /> Não pedimos senha de banco. Seus dados são seus.</p>
      <nav aria-label="Documentos legais" className="lp-foot-links">{LEGAL_LINKS.map(l => <Link key={l.href} href={l.href}>{l.label}</Link>)}<Link href="/login">Entrar</Link></nav>
      <small className="lp-legal">{companyLine()} · Atendimento: <a href={supportEmailUrl()}>{SUPPORT_EMAIL}</a> · WhatsApp <a href={supportWhatsAppUrl()} target="_blank" rel="noopener noreferrer">{SUPPORT_WHATSAPP_DISPLAY}</a></small><small className="lp-legal">A VIVA+ é uma assistente de organização com inteligência artificial e não substitui orientação financeira, médica ou de outros profissionais. Para maiores de 18 anos.</small>
    </footer>
    <LandingSticky />
  </main>;
}
