import { UserRound, ShieldCheck, Mail, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
export default async function Page(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 const name=user?.user_metadata?.full_name||"Nome não informado";
 return <div><p className="page-eyebrow">PREFERÊNCIAS E CONTA</p><h1 className="page-title">Seu perfil</h1><p className="page-description">Confira as informações básicas da sua conta VIVA+.</p>
  <section className="card mt-7 max-w-2xl overflow-hidden"><div className="flex items-center gap-4 border-b p-5 sm:p-6" style={{borderColor:"var(--viva-line)"}}><span className="icon-surface h-14 w-14 rounded-2xl"><UserRound size={25}/></span><div><p className="text-lg font-bold text-neutral-900">{name}</p><p className="mt-1 text-xs text-neutral-400">Membro VIVA+</p></div></div>
   <div className="divide-y px-5 sm:px-6" style={{borderColor:"var(--viva-line)"}}><div className="flex items-center gap-3 py-4"><Mail size={17} className="text-neutral-400"/><div><p className="text-[11px] font-semibold text-neutral-400">E-MAIL</p><p className="mt-1 text-sm font-medium text-neutral-800">{user?.email||"Não informado"}</p></div></div><div className="flex items-center gap-3 py-4"><MapPin size={17} className="text-neutral-400"/><div><p className="text-[11px] font-semibold text-neutral-400">LOCALIZAÇÃO</p><p className="mt-1 text-sm font-medium text-neutral-500">Ainda não cadastrada</p></div></div><div className="flex items-center gap-3 py-4"><ShieldCheck size={17} className="text-emerald-600"/><div><p className="text-[11px] font-semibold text-neutral-400">SEGURANÇA</p><p className="mt-1 text-sm font-medium text-neutral-800">Conta autenticada pelo Supabase</p></div></div></div>
  </section>
 </div>;
}
