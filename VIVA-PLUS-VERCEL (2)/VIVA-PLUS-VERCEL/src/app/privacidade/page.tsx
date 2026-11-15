import Link from "next/link";

export default function PrivacyPage() {
  return <main className="min-h-screen bg-white px-5 py-12 text-neutral-800"><article className="mx-auto max-w-3xl space-y-6">
    <Link href="/cadastro" className="font-semibold text-[#6410C9]">← Voltar ao cadastro</Link>
    <header><p className="text-sm font-bold uppercase tracking-wider text-[#6410C9]">VIVA+</p><h1 className="mt-3 text-3xl font-black">Política de Privacidade</h1><p className="mt-2 text-sm text-neutral-500">Última atualização: 15/11/2026</p></header>
    <section className="space-y-3"><h2 className="text-xl font-bold">1. Dados tratados</h2><p>Para oferecer o serviço, o VIVA+ pode tratar dados de cadastro e autenticação, informações que o usuário registra sobre sua rotina e finanças, preferências e dados técnicos necessários à segurança e funcionamento do aplicativo.</p></section>
    <section className="space-y-3"><h2 className="text-xl font-bold">2. Finalidades</h2><p>Os dados são utilizados para criar e proteger a conta, disponibilizar as funcionalidades solicitadas, personalizar a experiência, prestar suporte, manter a segurança e cumprir obrigações legais aplicáveis.</p></section>
    <section className="space-y-3"><h2 className="text-xl font-bold">3. Compartilhamento</h2><p>Dados podem ser processados por fornecedores de infraestrutura e serviços essenciais ao funcionamento do VIVA+, observadas as finalidades informadas e as medidas de proteção aplicáveis. Não comercializamos dados pessoais.</p></section>
    <section className="space-y-3"><h2 className="text-xl font-bold">4. Segurança e retenção</h2><p>Adotamos medidas razoáveis para proteger os dados. As informações são mantidas pelo período necessário às finalidades do serviço e ao cumprimento de obrigações legais, respeitados os direitos dos titulares.</p></section>
    <section className="space-y-3"><h2 className="text-xl font-bold">5. Direitos do titular</h2><p>O usuário pode solicitar informações sobre o tratamento de seus dados, correção, acesso e exclusão quando aplicável, pelos canais de atendimento do VIVA+ ou pelas configurações da conta.</p></section>
    <section className="space-y-3"><h2 className="text-xl font-bold">6. Atualizações e contato</h2><p>Esta política pode ser atualizada para refletir mudanças no serviço ou na legislação. A versão vigente ficará disponível nesta página.</p></section>
    <p className="border-t border-neutral-200 pt-5 text-xs text-neutral-500">Esta política deve ser revisada para refletir com precisão todos os fornecedores, integrações, prazos de retenção e operações reais de dados do VIVA+ antes do uso comercial definitivo.</p>
  </article></main>;
}
