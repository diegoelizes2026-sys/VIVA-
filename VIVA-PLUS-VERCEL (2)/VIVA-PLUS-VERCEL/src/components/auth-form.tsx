"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthForm({mode}:{mode:"login"|"signup"|"reset"}) {
  const router=useRouter(); const params=useSearchParams();
  const [name,setName]=useState(""); const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
  async function submit(e:FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const supabase=createClient();
      if(mode==="signup") {
        const {error}=await supabase.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:`${location.origin}/auth/callback`}});
        if(error) throw error;
        setMessage("Cadastro enviado. Confira seu e-mail para confirmar a conta, se a confirmação estiver ativada.");
      } else if(mode==="login") {
        const {error}=await supabase.auth.signInWithPassword({email,password}); if(error) throw error;
        router.replace(params.get("next") || "/meu-dia"); router.refresh();
      } else {
        const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${location.origin}/login`}); if(error) throw error;
        setMessage("Se o endereço estiver cadastrado, você receberá as instruções de recuperação.");
      }
    } catch(err) { setMessage(err instanceof Error?err.message:"Não foi possível concluir."); }
    finally {setBusy(false);}
  }
  const title=mode==="signup"?"Crie sua conta":mode==="reset"?"Recuperar senha":"Que bom ter você de volta";
  return <main className="min-h-screen grid place-items-center p-5">
    <form onSubmit={submit} className="card w-full max-w-md p-7 md:p-9">
      <Link href="/" className="font-black text-2xl" style={{color:"var(--purple)"}}>VIVA<span style={{color:"var(--yellow)"}}>+</span></Link>
      <h1 className="mt-7 text-3xl font-extrabold">{title}</h1>
      <p className="mt-2 text-sm" style={{color:"var(--muted)"}}>Sua vida mais organizada. Seu dinheiro mais inteligente.</p>
      {mode==="signup"&&<label className="block mt-6 text-sm font-semibold">Nome completo<input className="field mt-2" required value={name} onChange={e=>setName(e.target.value)} placeholder="Como podemos chamar você?"/></label>}
      <label className="block mt-5 text-sm font-semibold">E-mail<input className="field mt-2" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@email.com"/></label>
      {mode!=="reset"&&<label className="block mt-5 text-sm font-semibold">Senha<input className="field mt-2" type="password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo de 8 caracteres"/></label>}
      <button className="btn-primary w-full mt-7" disabled={busy}>{busy?"Aguarde...":mode==="signup"?"Criar conta":mode==="reset"?"Enviar instruções":"Entrar"}</button>
      {message&&<p role="status" className="mt-4 rounded-xl p-3 text-sm bg-violet-50 text-violet-900">{message}</p>}
      <div className="mt-6 flex flex-wrap justify-between gap-3 text-sm" style={{color:"var(--muted)"}}>
        {mode==="login"?<><Link href="/cadastro">Criar conta</Link><Link href="/recuperar-senha">Esqueci minha senha</Link></>:<Link href="/login">Voltar ao login</Link>}
      </div>
    </form>
  </main>;
}
