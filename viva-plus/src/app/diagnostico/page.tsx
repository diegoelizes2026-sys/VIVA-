import DiagnosticQuiz from "@/components/diagnostic-quiz";

export const metadata = {
  title: { absolute: "Diagnóstico Financeiro Grátis · VIVA+" },
  description: "Em 2 minutos você descobre quanto pode gastar por dia sem faltar dinheiro até o salário. Grátis, sem cartão e sem senha de banco.",
  alternates: { canonical: "/diagnostico" },
  openGraph: { title: "Faça seu diagnóstico financeiro grátis", description: "Em 2 minutos você descobre quanto pode gastar por dia sem faltar dinheiro até o salário.", url: "/diagnostico" },
};

// Página estática (carrega rápido no celular); todo o quiz roda no navegador.
export default function Page() { return <DiagnosticQuiz />; }
