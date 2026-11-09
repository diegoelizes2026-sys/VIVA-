"use client";
import { useState, type FormEvent } from "react";
import { Sparkles, Send, Bot, LoaderCircle } from "lucide-react";

export default function Assistant() {
  const [input, setInput] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  async function send(e: FormEvent) {
    e.preventDefault(); if (!input.trim() || busy) return;
    setBusy(true); setAnswer("");
    try {
      const res = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: input }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || "Falha ao consultar o assistente.");
      setAnswer(data.answer);
    } catch (err) { setAnswer(err instanceof Error ? err.message : "Não foi possível consultar o assistente."); }
    finally { setBusy(false); }
  }
  return <div className="card max-w-3xl overflow-hidden">
    <div className="flex items-center gap-4 border-b p-5 md:p-7" style={{ borderColor: "var(--color-gray)" }}>
      <span className="icon-surface h-12 w-12"><Sparkles size={23}/></span>
      <div><p className="font-extrabold text-neutral-900">Assistente VIVA+</p><p className="mt-1 text-xs text-neutral-500">Seu apoio para planejar, organizar e decidir.</p></div>
      <span className="ml-auto rounded-full bg-neutral-100 px-3 py-1 text-[10px] font-bold text-neutral-500">IA</span>
    </div>
    <div className="min-h-52 p-5 md:p-7">
      {!answer && <div className="mx-auto flex max-w-sm flex-col items-center py-8 text-center"><span className="icon-surface h-14 w-14 rounded-2xl"><Bot size={27}/></span><p className="mt-4 font-bold text-neutral-800">Como posso ajudar hoje?</p><p className="mt-2 text-sm leading-6 text-neutral-500">Escreva sua dúvida ou conte qual objetivo você quer organizar.</p></div>}
      {answer && <div className="rounded-2xl border p-4 md:p-5" style={{ borderColor: "var(--color-gray)", background: "#FAFAFB" }}><div className="mb-3 flex items-center gap-2 text-xs font-bold" style={{ color: "var(--color-primary)" }}><Sparkles size={15}/> RESPOSTA VIVA+</div><p className="whitespace-pre-wrap text-sm leading-7 text-neutral-700">{answer}</p></div>}
    </div>
    <form onSubmit={send} className="flex items-center gap-2 border-t bg-neutral-50 p-4 md:p-5" style={{ borderColor: "var(--color-gray)" }}>
      <input className="field bg-white" value={input} onChange={e => setInput(e.target.value)} placeholder="Escreva sua mensagem..." aria-label="Mensagem para o assistente"/>
      <button disabled={busy || !input.trim()} className="btn-primary h-11 w-12 shrink-0 px-0" aria-label="Enviar mensagem">{busy ? <LoaderCircle size={18} className="animate-spin"/> : <Send size={18}/>}</button>
    </form>
    <p className="px-5 pb-4 text-[11px] text-neutral-400">O assistente não altera seus dados nem substitui orientação profissional.</p>
  </div>;
}