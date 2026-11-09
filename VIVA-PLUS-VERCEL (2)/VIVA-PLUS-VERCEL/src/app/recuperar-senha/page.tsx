import { Suspense } from "react";
import AuthForm from "@/components/auth-form";

export default function Page() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-white" />}>
      <AuthForm mode="reset" />
    </Suspense>
  );
}
