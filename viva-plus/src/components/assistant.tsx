"use client";
import { useState, type FormEvent } from "react";
import { Sparkles, Send, Bot, LoaderCircle, UserRound } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

export default function Assistant() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Olá! Como posso ajudar você hoje?" },
  ]);
  const [busy, setBusy] = useState(false);

  async function send(e: FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || busy) return;

    setMessages(current => [...current, { role: "user", content: message }]);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Falha ao consultar o assistente (HTTP ${res.status}).`);
      if (typeof data.answer !== "string" || !data.answer.trim()) {
        throw new Error("A IA não retornou uma resposta. Tente novamente.");
      }
      setMessages(current => [...current, { role: "assistant", content: data.answer }]);
    } catch (err) {
      setMessages(current => [...current, {
        role: "assistant",
        content: err instanceof Error ? err.message : "Não foi possível consultar o assistente. Tente novamente.",
      }]);
    } finally {
      setBusy(false);
    }
  }

  return <div className="card max-w-3xl overflow-hidden">
    <div className="flex items-center gap-4 border-b p-5 md:p-7" style={{ borderColor: "var(--color-gray)" }}>
      <span className="icon-surface h-12 w-12"><Sparkles size={23}/></span>
      <div><p className="font-extrabold text-neutral-900">Assistente VIVA+</p><p className="mt-1 text-xs text-neutral-500">Seu apoio para planejar, organizar e decidir.</p></div>
      <span className="ml-auto rounded-full bg-neutral-100 px-3 py-1 text-[10px] font-bold text-neutral-500">IA</span>
    </div>
    <div className="max-h-[520px] min-h-52 space-y-4 overflow-y-auto p-5 md:p-7" aria-live="polite">
      {messages.map((item, index) => <div key={index} className={`flex gap-3 ${item.role === "user" ? "justify-end" : "justify-start"}`}>
        {item.role === "assistant" && <span className="icon-surface mt-1 h-8 w-8 shrink-0 rounded-xl"><Bot size={17}/></span>}
        <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-7 whitespace-pre-wrap ${item.role === "user" ? "bg-[var(--color-primary)] text-white" : "border text-neutral-700"}`} style={item.role === "assistant" ? { borderColor: "var(--color-gray)", background: "#FAFAFB" } : undefined}>
          {item.role === "assistant" && <div className="mb-1 flex items-center gap-2 text-[10px] font-bold" style={{ color: "var(--color-primary)" }}><Sparkles size={13}/> RESPOSTA VIVA+</div>}
          {item.content}
        </div>
        {item.role === "user" && <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600"><UserRound size={17}/></span>}
      </div>)}
      {busy && <div className="flex items-center gap-2 text-sm text-neutral-500"><span className="icon-surface h-8 w-8 rounded-xl"><Bot size={17}/></span><LoaderCircle size={16} className="animate-spin"/> VIVA+ está respondendo...</div>}
    </div>
    <form onSubmit={send} className="flex items-center gap-2 border-t bg-neutral-50 p-4 md:p-5" style={{ borderColor: "var(--color-gray)" }}>
      <input className="field bg-white" value={input} onChange={e => setInput(e.target.value)} placeholder="Escreva sua mensagem..." aria-label="Mensagem para o assistente" disabled={busy}/>
      <button type="submit" disabled={busy || !input.trim()} className="btn-primary h-11 w-12 shrink-0 px-0" aria-label="Enviar mensagem">{busy ? <LoaderCircle size={18} className="animate-spin"/> : <Send size={18}/>}</button>
    </form>
    <p className="px-5 pb-4 text-[11px] text-neutral-400">O assistente não altera seus dados nem substitui orientação profissional.</p>
  </div>;
}
