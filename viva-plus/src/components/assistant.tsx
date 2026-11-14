"use client";
import { useState, type FormEvent } from "react";
import { Sparkles, Send, Bot, LoaderCircle, UserRound, Mic, MicOff } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

export default function Assistant() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Oi! Eu sou a VIVA+, sua companheira para organizar a vida. Pode falar comigo ou escrever. Posso ajudar com seu dia, suas contas, seus planos e suas escolhas. Por onde começamos?" },
  ]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);

  function toggleMic() {
    if (listening) return;
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) {
      setMessages(current => [...current, { role: "assistant", content: "Seu navegador não oferece reconhecimento de voz. Você pode digitar sua mensagem ou usar o Chrome atualizado." }]);
      return;
    }
    const recognition = new Speech();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.onresult = event => {
      const transcript = Array.from(event.results).map(result => result[0].transcript).join(" ");
      setInput(current => current ? current + " " + transcript : transcript);
    };
    recognition.onerror = () => setMessages(current => [...current, { role: "assistant", content: "Não consegui entender o áudio. Tente novamente ou digite sua mensagem." }]);
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || busy) return;
    const history = [...messages, { role: "user" as const, content: message }];
    setMessages(history);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: history.slice(-12) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Falha ao consultar a VIVA+ (HTTP ${res.status}).`);
      if (typeof data.answer !== "string" || !data.answer.trim()) throw new Error("Não consegui gerar uma resposta agora.");
      setMessages(current => [...current, { role: "assistant", content: data.answer }]);
    } catch (err) {
      setMessages(current => [...current, { role: "assistant", content: err instanceof Error ? err.message : "Não foi possível responder. Tente novamente." }]);
    } finally {
      setBusy(false);
    }
  }

  return <div className="card max-w-3xl overflow-hidden">
    <div className="flex items-center gap-4 border-b p-5 md:p-7" style={{ borderColor: "var(--color-gray)" }}>
      <span className="icon-surface h-12 w-12"><Sparkles size={23}/></span>
      <div><p className="font-extrabold text-neutral-900">VIVA+ · Sua agente pessoal</p><p className="mt-1 text-xs text-neutral-500">Converse, planeje e cuide melhor da sua rotina.</p></div>
      <span className="ml-auto rounded-full bg-neutral-100 px-3 py-1 text-[10px] font-bold text-neutral-500">IA</span>
    </div>
    <div className="max-h-[520px] min-h-64 space-y-4 overflow-y-auto p-5 md:p-7" aria-live="polite">
      {messages.map((item, index) => <div key={index} className={`flex gap-3 ${item.role === "user" ? "justify-end" : "justify-start"}`}>
        {item.role === "assistant" && <span className="icon-surface mt-1 h-8 w-8 shrink-0 rounded-xl"><Bot size={17}/></span>}
        <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-7 whitespace-pre-wrap ${item.role === "user" ? "bg-[var(--color-primary)] text-white" : "border text-neutral-700"}`} style={item.role === "assistant" ? { borderColor: "var(--color-gray)", background: "#FAFAFB" } : undefined}>
          {item.role === "assistant" && <div className="mb-1 flex items-center gap-2 text-[10px] font-bold" style={{ color: "var(--color-primary)" }}><Sparkles size={13}/> VIVA+</div>}
          {item.content}
        </div>
        {item.role === "user" && <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600"><UserRound size={17}/></span>}
      </div>)}
      {busy && <div className="flex items-center gap-2 text-sm text-neutral-500"><span className="icon-surface h-8 w-8 rounded-xl"><Bot size={17}/></span><LoaderCircle size={16} className="animate-spin"/> VIVA+ está pensando...</div>}
    </div>
    <form onSubmit={send} className="flex items-center gap-2 border-t bg-neutral-50 p-4 md:p-5" style={{ borderColor: "var(--color-gray)" }}>
      <button type="button" onClick={toggleMic} disabled={busy} aria-label={listening ? "Microfone ativo" : "Falar com a VIVA+"} title="Falar com a VIVA+" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${listening ? "border-red-300 bg-red-50 text-red-600" : "border-neutral-200 bg-white text-neutral-600"}`}>{listening ? <MicOff size={19}/> : <Mic size={19}/>}</button>
      <input className="field bg-white" value={input} onChange={e => setInput(e.target.value)} placeholder={listening ? "Estou ouvindo..." : "Fale ou escreva para a VIVA..."} aria-label="Mensagem para a VIVA+" disabled={busy}/>
      <button type="submit" disabled={busy || !input.trim()} className="btn-primary h-11 w-12 shrink-0 px-0" aria-label="Enviar mensagem">{busy ? <LoaderCircle size={18} className="animate-spin"/> : <Send size={18}/>}</button>
    </form>
    <p className="px-5 pb-4 text-[11px] text-neutral-400">A VIVA+ ajuda a organizar suas escolhas. Confirme antes de registrar ou executar ações importantes.</p>
  </div>;
}
