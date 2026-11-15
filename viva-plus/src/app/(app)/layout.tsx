import { redirect } from "next/navigation";
import AppShell from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
export default async function ProtectedLayout({children}:{children:React.ReactNode}) {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:profile,error:profileError}=await supabase.from("viva_profiles").select("terms_of_use_version,privacy_policy_version,terms_accepted_at").eq("id",user.id).maybeSingle();
  if(profileError || !profile?.terms_of_use_version || !profile?.privacy_policy_version || !profile?.terms_accepted_at) redirect("/aceite-termos");
  const {data:isAdmin}=await supabase.rpc("viva_is_admin");
  return <AppShell email={user.email||"Minha conta"} isAdmin={Boolean(isAdmin)}>{children}</AppShell>;
}
