import { redirect } from "next/navigation";
import AppShell from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
export default async function ProtectedLayout({children}:{children:React.ReactNode}) {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:isAdmin}=await supabase.rpc("viva_is_admin");
  return <AppShell email={user.email||"Minha conta"} isAdmin={Boolean(isAdmin)}>{children}</AppShell>;
}
