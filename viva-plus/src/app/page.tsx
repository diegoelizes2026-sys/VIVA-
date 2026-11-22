import { redirect } from "next/navigation";
import Link from "next/link";
import { BadgeDollarSign, CalendarClock, Receipt, ShoppingCart, MapPin, MessageCircleHeart, ShieldCheck, Mic, Gift, Check, ChevronDown, HeartPulse, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import LandingSticky from "@/components/landing-sticky";

export const metadata = {
  title: "VIVA+ · Seu dinheiro em dia, sem planilha",
  description: "Converse com a VIVA, registre gastos em segundos, lembre do dia do pagamento e saiba quanto pode gastar até o fim do mês. Comece grátis.",
};

type Plan = { id: string; name: string; monthly_price_brl: number; annual_price_brl: number; monthly_credits: number; signup_credits: number; voice_enabled: boolean; photo_enabled: boolean; radar_enabled: boolean };
const brl = (n: number) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Página de vendas: visitantes veem a VIVA; quem já tem conta vai direto para a conversa.
export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/assistente");
  const { data } = await supabase.rpc("viva_public_pricing");
  const plans = ((data as Plan[] | null) || []).filter(p => p && p.id);

  const steps = [
    { n: "1", t: "Conte como está seu dinheiro", d: "Uma conversa de 2 minutos: quanto entra, quanto sai, se tem dívida. Pode pular o que não souber." },
    { n: "2", t: "Receba seu plano", d: "A VIVA mostra seu foco, quanto dá para gastar por dia e monta metas como “sair das dívidas”." },
    { n: "3", t: "Use no dia a dia", d: "Anote gastos em segundos, receba o lembrete do pagamento e das contas, e pergunte o que quiser." },
  ];
  const features = [
    { i: <MessageCircleHeart />, t: "Converse como no WhatsApp", d: "“Gastei 35 na farmácia”, “quanto posso gastar hoje?”. Escreva ou fale." },
    { i: <BadgeDollarSign />, t: "Lembra do seu pagamento", d: "No dia em que cai, a VIVA pergunta quanto entrou e sugere quanto separar para as contas." },
    { i: <CalendarClock />, t: "Contas em dia", d: "Avisos antes do vencimento para não pagar juros nem multa." },
    { i: <Receipt />, t: "Gasto anotado em 3 toques", d: "Valor, com o quê e como pagou. Sem planilha, sem complicação." },
    { i: <Target />, t: "Metas que andam", d: "Sair das dívidas, montar uma reserva ou comprar algo, com o valor por mês." },
    { i: <ShoppingCart />, t: "Lista de compras", d: "Monte a lista pelo chat e registre o gasto quando terminar a compra." },
    { i: <MapPin />, t: "Perto de mim", d: "Mercados, farmácias, restaurantes e academias perto, com avaliações." },
    { i: <HeartPulse />, t: "Saúde e Personal", d: "Treinos e hábitos para cuidar de você também." },
  ];
  const faq = [
    { q: "Preciso ligar minha conta do banco?", a: "Não. A VIVA não pede senha de banco nem acesso à sua conta. Você conta o que quiser e ela organiza." },
    { q: "É seguro?", a: "Seus dados ficam protegidos e só você acessa. Você pode ver, corrigir ou apagar tudo em Meus dados." },
    { q: "Quanto custa?", a: "Começar é grátis, sem cartão. Se quiser mais conversas com a VIVA, existem planos pagos, e o Pro pode ser testado grátis por 7 dias." },
    { q: "O que são créditos?", a: "Cada conversa com a inteligência da VIVA usa créditos. Anotar gastos pelo atalho, ver contas, lista de compras e lembretes não gastam créditos." },
    { q: "Funciona no celular?", a: "Sim. Abra no navegador do celular e adicione à tela de início para usar como um aplicativo." },
  ];

  return <main className="lp">
    <header className="lp-nav">
      <span className="lp-logo">VIVA<span>+</span></span>
      <nav><a href="#como-funciona">Como funciona</a><a href="#planos">Planos</a><a href="#duvidas">Dúvidas</a></nav>
      <div className="lp-nav-cta"><Link href="/login" className="lp-link">Entrar</Link><Link href="/cadastro" className="lp-btn sm">Criar conta grátis</Link></div>
    </header>

    <section className="lp-hero">
      <div className="lp-hero-copy">
        <span className="lp-pill">Sua assistente financeira pessoal</span>
        <h1>Seu dinheiro em dia, <em>sem planilha.</em></h1>
        <p>Converse com a VIVA, anote gastos em segundos e saiba quanto pode gastar até o próximo pagamento. Ela lembra das contas por você.</p>
        <div className="lp-hero-cta">
          <Link href="/cadastro" className="lp-btn">Começar grátis</Link>
          <a href="#como-funciona" className="lp-btn ghost">Ver como funciona</a>
        </div>
        <ul className="lp-trust"><li><Check size={16} /> Grátis para começar</li><li><Check size={16} /> Sem cartão</li><li><Check size={16} /> Não pede senha de banco</li></ul>
      </div>
      <div className="lp-hero-art" aria-hidden="true">
        <div className="ap-stage">
          <div className="ap-phone"><span className="ap-notch" />
            <div className="ap-screen">
              <div className="ap-bar"><b>VIVA<span>+</span></b></div>
              <div className="ap-card"><b>Oi, Ana!</b><small>O que vamos resolver hoje?</small><em>Saldo do mês</em><strong>R$ 2.076,70</strong><i>2 contas na semana · R$ 248,80</i></div>
              <div className="ap-tiles">{([["Lancei um gasto", <Receipt key="a" />], ["Recebi dinheiro", <BadgeDollarSign key="b" />], ["Contas", <CalendarClock key="c" />], ["Lista de compras", <ShoppingCart key="d" />], ["Meu dia", <CalendarClock key="e" />], ["Perto de mim", <MapPin key="f" />]] as const).map(([t, ic]) => <span key={t}><i>{ic}</i>{t}</span>)}</div>
              <div className="ap-input">Converse com a VIVA…<span><Mic size={13} /></span></div>
            </div>
          </div>
          <div className="ap-bubble b1"><span className="ap-orb" />Anotado: R$ 35,90 em Farmácia ✅</div>
          <div className="ap-bubble b2"><BadgeDollarSign size={18} />Dia de pagamento! Já caiu?</div>
        </div>
        <small className="lp-note">Tela ilustrativa, com valores de exemplo.</small>
      </div>
    </section>

    <section className="lp-pain">
      <h2>Sabe quando o mês acaba antes do salário?</h2>
      <p>Você não está sozinho. A maioria das pessoas não sabe para onde o dinheiro foi, esquece uma conta e paga juros, e desiste da planilha na segunda semana. A VIVA foi feita para isso: <b>simples como mandar uma mensagem.</b></p>
    </section>

    <section className="lp-sec" id="como-funciona">
      <span className="lp-kicker">Como funciona</span>
      <h2>Em 2 minutos você já sabe para onde vai seu dinheiro</h2>
      <div className="lp-steps">{steps.map(s => <div key={s.n} className="lp-step"><b>{s.n}</b><h3>{s.t}</h3><p>{s.d}</p></div>)}</div>
      <div className="lp-video">
        <video src="/videos/viva-anuncio.mp4" poster="/videos/viva-anuncio.jpg" autoPlay muted loop playsInline preload="metadata" aria-label="Vídeo mostrando a VIVA+" />
        <div><h3>Veja a VIVA em ação</h3><p>Anotar gasto, lembrar do pagamento, cuidar das contas: tudo numa conversa.</p><Link href="/cadastro" className="lp-btn">Quero organizar meu dinheiro</Link></div>
      </div>
    </section>

    <section className="lp-sec">
      <span className="lp-kicker">Tudo num lugar só</span>
      <h2>O que a VIVA faz por você</h2>
      <div className="lp-features">{features.map(f => <div key={f.t} className="lp-feat"><span aria-hidden>{f.i}</span><h3>{f.t}</h3><p>{f.d}</p></div>)}</div>
    </section>

    {plans.length > 0 && <section className="lp-sec" id="planos">
      <span className="lp-kicker">Planos</span>
      <h2>Comece grátis. Evolua quando quiser.</h2>
      <div className="lp-plans">{plans.map(p => {
        const free = Number(p.monthly_price_brl) === 0; const pro = p.id === "pro";
        return <div key={p.id} className={"lp-plan" + (pro ? " hot" : "")}>
          {pro && <span className="lp-plan-tag">Mais completo · 7 dias grátis</span>}
          <h3>{p.name}</h3>
          <p className="lp-price">{free ? <b>Grátis</b> : <><b>{brl(p.monthly_price_brl)}</b><span>/mês</span></>}</p>
          {!free && Number(p.annual_price_brl) > 0 && <small className="lp-annual">ou {brl(p.annual_price_brl)} por ano</small>}
          <ul>
            {free && p.signup_credits > 0 && <li><Check size={16} /> {p.signup_credits} créditos para começar</li>}
            <li><Check size={16} /> {p.monthly_credits} créditos por mês</li>
            <li><Check size={16} /> Gastos, contas, metas e lista de compras</li>
            {p.radar_enabled && <li><Check size={16} /> Radar financeiro preventivo</li>}
            {p.voice_enabled && <li><Check size={16} /> Converse por voz</li>}
            {p.photo_enabled && <li><Check size={16} /> Foto de comprovante</li>}
          </ul>
          <Link href="/cadastro" className={"lp-btn" + (pro ? "" : " ghost")}>{free ? "Criar conta grátis" : pro ? "Testar 7 dias grátis" : `Começar com o ${p.name}`}</Link>
        </div>;
      })}</div>
      <p className="lp-small">O teste grátis do Pro é ativado dentro do app, uma vez por conta, sem cartão. Planos pagos são confirmados pelo Mercado Pago.</p>
    </section>}

    <section className="lp-sec lp-first">
      <Gift size={30} aria-hidden />
      <h2>Seja um dos primeiros</h2>
      <p>A VIVA acabou de chegar. Quem entra agora ajuda a decidir as próximas funções e ainda pode <b>ganhar créditos indicando amigos</b>.</p>
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
      <nav><Link href="/termos">Termos de Uso</Link><Link href="/privacidade">Privacidade</Link><Link href="/login">Entrar</Link></nav>
    </footer>
    <LandingSticky />
  </main>;
}
