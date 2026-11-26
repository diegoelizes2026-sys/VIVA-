import Link from "next/link";
import { BadgeCheck, MapPin, Users, Gift, MessageCircle, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import GymApply from "@/components/gym-apply";

export const metadata = {
  title: "Cadastre sua academia",
  description: "Dono de academia: apareça de graça no Radar VIVA+ para quem procura academia perto de casa, com selo de academia credenciada.",
  alternates: { canonical: "/academias" },
};
export const dynamic = "force-dynamic";

// Academias credenciadas VIVA+: página pública de convite + cadastro (para quem está logado).
export default async function AcademiasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const perks = [
    { icon: MapPin, t: "Alunos perto de você", d: "Sua academia aparece no Radar para quem está procurando academia no bairro, com a distância em km." },
    { icon: BadgeCheck, t: "Selo de academia credenciada", d: "Conferimos o CNPJ e sua academia ganha o selo Academia credenciada VIVA+." },
    { icon: MessageCircle, t: "Contato direto", d: "Botões de WhatsApp, Instagram e “Como chegar”. O aluno fala direto com você." },
    { icon: Users, t: "Seus personais junto", d: "Personais credenciados que atendem na sua academia aparecem no seu card." },
    { icon: Gift, t: "Sua oferta em destaque", d: "Mostre uma vantagem para quem vem pela VIVA+, como uma semana grátis." },
    { icon: Sparkles, t: "Sem custo", d: "Cadastro e aparição no Radar são gratuitos. Pode sair quando quiser." },
  ];
  return <main id="conteudo" className="pa-page">
    <header className="pa-top"><Link href="/" className="pa-logo">VIVA<span>+</span></Link>{!user && <Link href="/login?next=%2Facademias" className="pa-top-link">Entrar</Link>}</header>
    <section className="pa-hero">
      <span className="pa-eyebrow">ACADEMIAS CREDENCIADAS VIVA+</span>
      <h1>Dono de academia: apareça para quem procura academia perto de casa</h1>
      <p>A VIVA+ ajuda as pessoas a cuidar da saúde e do dinheiro. No <b>Radar Fitness</b>, mostramos as academias credenciadas mais próximas de cada usuário.</p>
    </section>
    <section className="pa-perks">{perks.map(p => { const I = p.icon; return <div key={p.t}><I aria-hidden /><b>{p.t}</b><span>{p.d}</span></div>; })}</section>
    <section className="pa-card" id="cadastro">
      <h2>{user ? "Cadastro da sua academia" : "Como entrar no Radar"}</h2>
      {user ? <GymApply /> : <>
        <ol className="pa-steps"><li>Crie sua conta grátis na VIVA+ (1 minuto).</li><li>Cadastre a academia: nome, CNPJ, modalidades, preço, horário e contatos. Marque a localização de dentro da academia.</li><li>A gente confere o CNPJ e aprova em até 2 dias úteis.</li></ol>
        <div className="pa-cta"><Link className="pa-btn" href="/cadastro?next=%2Facademias">Criar conta e cadastrar</Link><Link className="pa-ghost" href="/login?next=%2Facademias">Já tenho conta</Link></div>
      </>}
    </section>
    <p className="pa-foot">É personal? <Link href="/parceiros">Cadastre-se como Personal Parceiro</Link>. A VIVA+ divulga, mas não presta o serviço da academia. <Link href="/termos">Termos de Uso</Link></p>
  </main>;
}
