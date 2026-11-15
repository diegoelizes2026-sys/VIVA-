import Link from "next/link";

export default function ResponsibilityTermsPage() {
  return <main className="min-h-screen bg-white px-5 py-12 text-neutral-800">
    <article className="mx-auto max-w-3xl space-y-6">
      <Link href="/cadastro" className="text-sm font-semibold text-[var(--color-primary)]">← Voltar ao cadastro</Link>
      <header><p className="text-sm font-bold uppercase tracking-wider text-[var(--color-primary)]">VIVA+ · Versão 1.0 · 15/11/2026</p><h1 className="mt-3 text-3xl font-black">Termos de Responsabilidade</h1><p className="mt-3 text-sm text-neutral-500">Leia antes de criar sua conta.</p></header>
      <section className="space-y-3"><h2 className="text-xl font-bold">1. Finalidade do VIVA+</h2><p>O VIVA+ oferece recursos digitais para apoiar a organização da rotina, o acompanhamento de informações financeiras, o planejamento de objetivos e o acesso a conteúdos e sugestões automatizadas.</p></section>
      <section className="space-y-3"><h2 className="text-xl font-bold">2. Uso das informações e sugestões</h2><p>Relatórios, cálculos, alertas e sugestões automatizadas são ferramentas de apoio e podem depender dos dados informados pelo próprio usuário. O usuário deve conferir valores, datas, lançamentos e resultados antes de tomar decisões.</p><p>O VIVA+ não substitui aconselhamento financeiro, contábil, jurídico, médico ou de qualquer outro profissional habilitado. Não há garantia de resultado financeiro ou de adequação de uma sugestão a uma situação individual.</p></section>
      <section className="space-y-3"><h2 className="text-xl font-bold">3. Responsabilidade do usuário</h2><p>O usuário é responsável pela veracidade e atualização dos dados inseridos, pela proteção de suas credenciais e pela avaliação das decisões tomadas com base nas informações exibidas no aplicativo.</p></section>
      <section className="space-y-3"><h2 className="text-xl font-bold">4. Planos e pagamentos</h2><p>Recursos pagos, valores, periodicidade, condições de renovação e formas de pagamento serão apresentados na área de contratação antes da confirmação. A criação de conta, por si só, não representa contratação de plano pago.</p></section>
      <section className="space-y-3"><h2 className="text-xl font-bold">5. Privacidade e dados</h2><p>O tratamento de dados pessoais deve observar o Aviso de Privacidade do VIVA+ e a legislação aplicável. Estes termos não substituem o aviso de privacidade nem autorizam o uso de dados para finalidades não informadas.</p></section>
      <section className="space-y-3"><h2 className="text-xl font-bold">6. Aceite</h2><p>Ao marcar a caixa de confirmação no cadastro, o usuário declara que leu, compreendeu e aceita esta versão dos Termos de Responsabilidade.</p></section>
      <p className="border-t border-neutral-200 pt-5 text-xs text-neutral-500">Este texto é uma base operacional de responsabilidade e deve ser revisado por assessoria jurídica antes do uso comercial definitivo.</p>
    </article>
  </main>;
}
