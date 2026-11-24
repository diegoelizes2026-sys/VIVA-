import { Suspense } from "react";
import AuthForm from "@/components/auth-form";

export const metadata = { title: "Criar conta grátis", description: "Crie sua conta grátis no VIVA+ e ganhe 7 dias de Pro: descubra quanto pode gastar por dia sem faltar dinheiro até o salário.", alternates: { canonical: "/cadastro" } };

export default function Page() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-white" />}>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
