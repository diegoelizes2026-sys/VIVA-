import Link from "next/link";
import { BadgeCheck, MapPin, Banknote, Gift, Users, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PartnerApply from "@/components/partner-apply";

export const metadata = {
  title: "Seja Personal Parceiro",
  description: "Personal trainer: apareça para os usuários da VIVA+ da sua cidade, ganhe R$ 10 por assinante (mais bônus) e use o Pro de graça.",
  alternates: { canonical: "/parceiros" },
};
export const dynamic = "force-dynamic";

// Rede de Personais VIVA+: página pública de convite + cadastro (para quem está logado).
export default async function ParceirosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const perks = [
    { icon: MapPin, t: "Alunos da sua cidade", d: "Seu perfil aparece na área de Saúde da VIVA para quem mora perto de você, com WhatsApp e Instagram." },
    { icon: Banknote, t: "R$ 10 por assinante", d: "Cada aluno ou seguidor que assinar o Pro pelo seu link rende R$ 10 no Pix, sem limite por mês." },
    { icon: Gift, t: "R$ 50 de bônus", d: "A cada 10 assinantes pelo seu link, mais R$ 50 caem para você." },
    { icon: Sparkles, t: "VIVA+ Pro grátis", d: "Use a VIVA para organizar o seu próprio dinheiro, de graça." },
    { icon: BadgeCheck, t: "Selo de profissional", d: "Seu CREF aparece junto do seu nome. Mais confiança para quem te procura." },
    { icon: Users, t: "Sem custo e sem contrato longo", d: "Você não paga nada. Pode sair quando quiser." },
  ];
  return <main id="conteudo" className="pa-page">
    <header className="pa-top"><Link href="/" className="pa-logo">VIVA<span>+</span></Link>{!user && <Link href="/login?next=%2Fparceiros" className="pa-top-link">Entrar</Link>}</header>
    <section className="pa-hero">
      <span className="pa-eyebrow">REDE DE PERSONAIS VIVA+</span>
      <h1>Personal trainer: ganhe alunos e uma renda extra com a VIVA+</h1>
      <p>A VIVA+ ajuda as pessoas a organizar o dinheiro e cuidar da saúde. Na área de treinos, mostramos <b>personais parceiros da cidade</b> de cada usuário.</p>
    </section>
    <section className="pa-perks">{perks.map(p => { const I = p.icon; return <div key={p.t}><I aria-hidden /><b>{p.t}</b><span>{p.d}</span></div>; })}</section>
    <section className="pa-card" id="cadastro">
      <h2>{user ? "Seu cadastro de parceiro" : "Como entrar na rede"}</h2>
      {user ? <PartnerApply /> : <>
        <ol className="pa-steps"><li>Crie sua conta grátis na VIVA+ (1 minuto).</li><li>Preencha seus dados: nome, CREF, cidade, foto e contatos.</li><li>A gente confere seu CREF e aprova em até 2 dias úteis.</li></ol>
        <div className="pa-cta"><Link className="pa-btn" href="/cadastro?next=%2Fparceiros">Criar conta e me cadastrar</Link><Link className="pa-ghost" href="/login?next=%2Fparceiros">Já tenho conta</Link></div>
      </>}
    </section>
    <p className="pa-foot">Os treinos da VIVA são sugestões gerais e não substituem o acompanhamento individual de um profissional. É exigido CREF ativo. <Link href="/termos">Termos de Uso</Link></p>
  </main>;
}
