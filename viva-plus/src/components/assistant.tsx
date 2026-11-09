"use client";
import { useState, type FormEvent } from "react";
import { Sparkles, Send, Bot, LoaderCircle, UserRound, RotateCcw } from "lucide-react";

type Message={role:"user"|"assistant";content:string};
const suggestions=["Me ajude a organizar meu dia","Como posso controlar melhor meus gastos?","Me ajude a definir uma meta de economia"];
export default function Assistant(){
 const [input,setInput]=useState("");const [messages,setMessages]=useState<Message[]>([]);const [busy,setBusy]=useState(false);
 async function send(e?:FormEvent, text?:string){
  e?.preventDefault();const content=(text??input).trim();if(!content||busy)return;
  const next=[...messages,{role:"user" as const,content}];setMessages(next);setInput("");setBusy(true);
  try{const res=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:content,history:messages.slice(-8)})});const data=await res.json();if(!res.ok)throw new Error(data.error||"Não foi possível consultar o assistente.");setMessages([...next,{role:"assistant",content:data.answer||"Não consegui gerar uma resposta agora."}]);}
  catch(err){setMessages([...next,{role:"assistant",content:err instanceof Error?err.message:"Não foi possível consultar o assistente."}]);}
  finally{setBusy(false);}
 }
 return <section className="card mx-auto flex min-h-[min(690px,calc(100svh-190px))] max-w-4xl flex-col overflow-hidden">
  <header className="flex items-center gap-3 border-b px-5 py-4 sm:px-6" style={{borderColor:"var(--viva-line)"}}>
   <span className="icon-surface h-10 w-10"><Sparkles size={19}/></span><div className="min-w-0 flex-1"><p className="text-sm font-bold text-neutral-900">Assistente VIVA+</p><p className="mt-0.5 text-xs text-neutral-400">Ideias claras para decisões melhores</p></div>
   {messages.length>0&&<button onClick={()=>setMessages([])} className="btn-secondary min-h-9 px-3 text-xs"><RotateCcw size={14}/> Nova conversa</button>}
  </header>
  <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
   {messages.length===0?<div className="mx-auto flex max-w-md flex-col items-center py-12 text-center sm:py-16"><span className="icon-surface h-14 w-14 rounded-2xl"><Bot size={26}/></span><p className="mt-5 text-lg font-bold tracking-tight text-neutral-900">O que podemos resolver juntos?</p><p className="mt-2 text-sm leading-6 text-neutral-500">Conte o que você precisa. Vou ajudar a organizar as ideias e encontrar próximos passos.</p><div className="mt-7 flex w-full flex-col gap-2">{suggestions.map(s=><button key={s} onClick={()=>send(undefined,s)} className="rounded-xl border px-4 py-3 text-left text-sm font-medium text-neutral-600 transition-colors hover:border-[#D7C6E9] hover:bg-[#FBF9FE]" style={{borderColor:"var(--viva-line)"}}>{s}</button>)}</div></div>:
    messages.map((m,i)=><div key={i} className={`flex gap-3 ${m.role==="user"?"justify-end":""}`}>{m.role==="assistant"&&<span className="icon-surface h-8 w-8 shrink-0"><Sparkles size={15}/></span>}<div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-7 ${m.role==="user"?"bg-[var(--viva-purple)] text-white":"border bg-[#FBFAFC] text-neutral-700"}`} style={m.role==="assistant"?{borderColor:"var(--viva-line)"}:{}}><p className="whitespace-pre-wrap">{m.content}</p></div>{m.role==="user"&&<span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-500"><UserRound size={15}/></span>}</div>)}
   {busy&&<div className="flex items-center gap-3 text-sm text-neutral-400"><span className="icon-surface h-8 w-8"><Sparkles size={15}/></span><LoaderCircle size={16} className="animate-spin"/> Pensando...</div>}
  </div>
  <form onSubmit={e=>send(e)} className="border-t bg-white p-3 sm:p-4" style={{borderColor:"var(--viva-line)"}}><div className="flex items-center gap-2 rounded-2xl border bg-[#FBFAFC] p-1.5 pl-3 focus-within:border-[#BFA5DE]" style={{borderColor:"var(--viva-line)"}}><input className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-neutral-400" value={input} onChange={e=>setInput(e.target.value)} placeholder="Escreva sua mensagem..." aria-label="Mensagem para o Assistente VIVA+"/><button disabled={busy||!input.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--viva-purple)] text-white transition-colors hover:bg-[var(--viva-purple-deep)] disabled:opacity-40" aria-label="Enviar mensagem">{busy?<LoaderCircle size={17} className="animate-spin"/>:<Send size={17}/>}</button></div><p className="mt-2 px-1 text-[10px] text-neutral-400">O assistente pode cometer erros. Confirme informações importantes antes de agir.</p></form>
 </section>;
}
