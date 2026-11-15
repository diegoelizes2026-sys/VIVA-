import Link from "next/link";

export default function TermsPage() {
  return <main className="min-h-screen bg-white px-5 py-12 text-neutral-800"><article className="mx-auto max-w-3xl space-y-6">
    <Link href="/cadastro" className="font-semibold text-[#6410C9]">← Voltar ao cadastro</Link>
    <header><p className="text-sm font-bold uppercase tracking-wider text-[#6410C9]">VIVA+</p><h1 className="mt-3 text-3xl font-black">Termos de Uso</h1><p className="mt-2 text-sm text-neutral-500">Última atualização: 15/11/2026</p></header>
    <section className="space-y-3"><h2 className="text-xl font-bold">1. Sobre o serviço</h2><p>O VIVA+ oferece ferramentas digitais para organização da rotina, acompanhamento financeiro, planejamento de metas e acesso a recursos automatizados de apoio.</p></section>
    <section className="space-y-3"><h2 className="text-xl font-bold">2. Cadastro e conta</h2><p>O usuário deve fornecer informações verdadeiras, manter seus dados atualizados e proteger suas credenciais de acesso. O aceite destes termos é necessário para criar uma conta.</p></section>
    <section className="space-y-3"><h2 className="text-xl font-bold">3. Uso responsável</h2><p>O usuário é responsável por conferir os dados inseridos e avaliar as sugestões e informações apresentadas. O VIVA+ é uma ferramenta de apoio e não substitui orientação financeira, contábil, jurídica ou de outros profissionais habilitados.</p></section>
    <section className="space-y-3"><h2 className="text-xl font-bold">4. Planos e pagamentos</h2><p>Os recursos incluídos em cada plano, preços, periodicidade, renovação e meios de pagamento são apresentados na página de planos antes da contratação. Criar uma conta não significa contratar automaticamente um plano pago.</p></section>
    <section className="space-y-3"><h2 className="text-xl font-bold">5. Segurança e disponibilidade</h2><p>Adotamos medidas técnicas e organizacionais para proteger o serviço. Recursos podem receber atualizações ou ficar temporariamente indisponíveis para manutenção.</p></section>
    <section className="space-y-3"><h2 className="text-xl font-bold">6. Contato</h2><p>Para dúvidas sobre estes termos, utilize os canais de atendimento informados no próprio VIVA+.</p></section>
  </article></main>;
}
