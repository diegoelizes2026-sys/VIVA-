import AuthForm from "@/components/auth-form";
import { Suspense } from "react";
export const metadata = { title: "Entrar", description: "Entre na sua conta VIVA+.", alternates: { canonical: "/login" } };
export default function Page(){return <Suspense><AuthForm mode="login"/></Suspense>}
