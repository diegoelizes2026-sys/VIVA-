"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, RotateCcw, ShieldCheck, X } from "lucide-react";
import { EVENTO_AGENTE } from "./agente-eventos";
import { IconeWhatsapp, Monograma } from "./marca";

type Msg = { role: "user" | "assistant"; content: string; at?: string };
type EmpMini = { slug: string; nome: string; capa: string; status: string; cidade: string };
type Estado = {
  mensagens: Msg[];
  sugestoes: string[];
  whatsapp: string | null;
  cards: Record<number, EmpMini[]>;
};

const CHAVE = "agente24h:v1";

function novaSessao() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function Agente24h({ nome, boasVindas, corretor }: { nome: string; boasVindas: string; corretor: string }) {
  const inicial: Estado = {
    mensagens: [{ role: "assistant", content: boasVindas }],
    sugestoes: ["Para morar", "Para investir", "Quero ver lançamentos"],
    whatsapp: null,
    cards: {},
  };
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<Estado>(inicial);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [convite, setConvite] = useState(false);
  const sessao = useRef<string>("");
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;

  // Restaura conversa
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAVE);
      if (raw) {
        const salvo = JSON.parse(raw) as { sessao: string; estado: Estado };
        sessao.current = salvo.sessao;
        if (salvo.estado?.mensagens?.length) setEstado(salvo.estado);
      }
    } catch {}
    if (!sessao.current) sessao.current = novaSessao();
    const t = setTimeout(() => setConvite(true), 6000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ sessao: sessao.current, estado }));
    } catch {}
  }, [estado]);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [estado.mensagens.length, pensando, aberto]);

  const enviar = useCallback(
    async (conteudo: string) => {
      const c = conteudo.trim();
      if (!c || pensando) return;
      const msgs: Msg[] = [...estadoRef.current.mensagens, { role: "user", content: c, at: new Date().toISOString() }];
      setEstado((e) => ({ ...e, mensagens: msgs, sugestoes: [] }));
      setTexto("");
      setPensando(true);
      try {
        const r = await fetch("/api/agente", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessao.current, mensagens: msgs, pagina: location.pathname }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.erro || "Erro");
        setEstado((e) => {
          const mensagens: Msg[] = [...msgs, { role: "assistant", content: d.resposta, at: new Date().toISOString() }];
          return {
            mensagens,
            sugestoes: d.sugestoes ?? [],
            whatsapp: d.whatsapp ?? e.whatsapp,
            cards: d.empreendimentos?.length ? { ...e.cards, [mensagens.length - 1]: d.empreendimentos } : e.cards,
          };
        });
      } catch (err) {
        setEstado((e) => ({
          ...e,
          mensagens: [
            ...msgs,
            {
              role: "assistant",
              content:
                err instanceof Error && err.message.includes("minutinho")
                  ? err.message
                  : `Tive um probleminha de conexão aqui. Pode tentar de novo? Se preferir, fale direto com o ${corretor} no WhatsApp.`,
            },
          ],
        }));
      } finally {
        setPensando(false);
        setTimeout(() => campo.current?.focus(), 50);
      }
    },
    [pensando, corretor],
  );

  // Abre a partir de qualquer botão do site
  useEffect(() => {
    const f = (ev: Event) => {
      const m = (ev as CustomEvent<{ mensagem?: string }>).detail?.mensagem;
      setAberto(true);
      setConvite(false);
      if (m) setTimeout(() => enviar(m), 250);
    };
    window.addEventListener(EVENTO_AGENTE, f);
    return () => window.removeEventListener(EVENTO_AGENTE, f);
  }, [enviar]);

  function recomecar() {
    sessao.current = novaSessao();
    setEstado(inicial);
  }

  function chamarZap() {
    fetch("/api/agente", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessao.current }),
    }).catch(() => {});
  }

  const respostasUsuario = estado.mensagens.filter((m) => m.role === "user").length;

  return (
    <>
      {/* Painel */}
      <div
        className={`fixed z-50 flex flex-col overflow-hidden bg-osso shadow-[0_30px_80px_-20px_rgba(11,31,30,.55)] transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)]
          inset-0 sm:inset-auto sm:bottom-28 sm:right-6 sm:h-[min(680px,calc(100svh-140px))] sm:w-[410px] sm:rounded-[28px] sm:border sm:border-ink/10
          ${aberto ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"}`}
        role="dialog"
        aria-label={nome}
        aria-hidden={!aberto}
      >
        {/* Cabeçalho */}
        <div className="grao relative shrink-0 overflow-hidden bg-ink px-5 pb-5 pt-5 text-osso">
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-lagoa-2/50 blur-3xl" />
          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="relative grid h-12 w-12 place-items-center rounded-full bg-lagoa text-osso">
                <Monograma className="h-8 w-8" />
                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-ink bg-zap" />
              </span>
              <div>
                <p className="font-display text-[20px] font-bold leading-none">{nome}</p>
                <p className="mt-1.5 text-[12.5px] text-osso/65">Online agora · responde na hora</p>
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={recomecar} className="grid h-9 w-9 place-items-center rounded-full text-osso/60 hover:bg-osso/10 hover:text-osso" title="Nova conversa">
                <RotateCcw className="h-4 w-4" />
              </button>
              <button onClick={() => setAberto(false)} className="grid h-9 w-9 place-items-center rounded-full text-osso/60 hover:bg-osso/10 hover:text-osso" aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          {/* Progresso da qualificação */}
          <div className="relative mt-4 flex items-center gap-3">
            <div className="flex flex-1 gap-1">
              {[0, 1, 2, 3, 4].map((k) => (
                <span key={k} className={`h-1 flex-1 rounded-full transition-colors duration-700 ${k < Math.min(5, respostasUsuario) || estado.whatsapp ? "bg-sol" : "bg-osso/15"}`} />
              ))}
            </div>
            <span className="rotulo !text-[9.5px] text-osso/55">{estado.whatsapp ? "Perfil pronto" : "Entendendo seu perfil"}</span>
          </div>
        </div>

        {/* Mensagens */}
        <div className="flex-1 space-y-3 overflow-y-auto bg-[radial-gradient(circle_at_1px_1px,rgba(11,31,30,.07)_1px,transparent_0)] bg-[length:18px_18px] px-4 py-5">
          {estado.mensagens.map((m, k) => (
            <div key={k}>
              <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-line px-4 py-3 text-[14.5px] leading-relaxed ${
                    m.role === "user"
                      ? "rounded-[20px] rounded-br-md bg-lagoa text-osso"
                      : "rounded-[20px] rounded-bl-md border border-ink/8 bg-white text-ink shadow-[0_1px_0_rgba(11,31,30,.04)]"
                  }`}
                >
                  {m.content}
                </div>
              </div>
              {estado.cards[k] && (
                <div className="sem-barra mt-2 flex gap-2 overflow-x-auto pb-1">
                  {estado.cards[k].map((e) => (
                    <Link
                      key={e.slug}
                      href={`/empreendimentos/${e.slug}`}
                      onClick={() => setAberto(window.innerWidth >= 640)}
                      className="group w-44 shrink-0 overflow-hidden rounded-2xl border border-ink/10 bg-white"
                    >
                      <div className="foto-fallback h-24 overflow-hidden">
                        {e.capa && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={e.capa} alt="" onError={(ev) => (ev.currentTarget.style.display = "none")} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                        )}
                      </div>
                      <div className="p-3">
                        <p className="font-display text-[17px] leading-tight">{e.nome}</p>
                        <p className="mt-0.5 text-[11.5px] text-ink/55">{e.status}{e.cidade ? ` · ${e.cidade}` : ""}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          {pensando && (
            <div className="flex">
              <div className="flex items-center gap-1.5 rounded-[20px] rounded-bl-md border border-ink/8 bg-white px-4 py-4">
                {[0, 1, 2].map((k) => (
                  <span key={k} className="ponto-digitando h-1.5 w-1.5 rounded-full bg-lagoa" style={{ animationDelay: `${k * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}

          {estado.whatsapp && !pensando && (
            <a
              href={estado.whatsapp}
              target="_blank"
              rel="noopener"
              onClick={chamarZap}
              className="group mt-2 flex items-center gap-3 rounded-2xl bg-zap p-3 pr-4 text-white shadow-lg shadow-zap/25 transition hover:brightness-110"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15">
                <IconeWhatsapp className="h-6 w-6" />
              </span>
              <span className="flex-1 leading-tight">
                <span className="block text-[15px] font-semibold">Chamar o {corretor.split(" ")[0]} no WhatsApp</span>
                <span className="block text-[12px] text-white/80">Ele já recebe o resumo do que você busca</span>
              </span>
              <ArrowUp className="h-5 w-5 rotate-45 transition group-hover:rotate-90" />
            </a>
          )}
          <div ref={fim} />
        </div>

        {/* Sugestões + entrada */}
        <div className="shrink-0 border-t border-ink/10 bg-osso px-3 pb-3 pt-2.5">
          {estado.sugestoes.length > 0 && !pensando && (
            <div className="sem-barra mb-2.5 flex gap-2 overflow-x-auto">
              {estado.sugestoes.map((s) => (
                <button
                  key={s}
                  onClick={() => enviar(s)}
                  className="shrink-0 rounded-full border border-lagoa/25 bg-white px-3.5 py-2 text-[13px] font-medium text-lagoa transition hover:border-lagoa hover:bg-lagoa hover:text-osso"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar(texto);
            }}
            className="flex items-end gap-2 rounded-[22px] border border-ink/12 bg-white p-1.5 pl-4 focus-within:border-lagoa"
          >
            <textarea
              ref={campo}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar(texto);
                }
              }}
              rows={1}
              placeholder="Escreva sua mensagem…"
              className="max-h-28 min-h-[40px] flex-1 resize-none bg-transparent py-2.5 text-[15px] focus:outline-none"
            />
            <button
              disabled={!texto.trim() || pensando}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-osso transition enabled:hover:bg-lagoa disabled:opacity-30"
              aria-label="Enviar"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          </form>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-ink/45">
            <ShieldCheck className="h-3.5 w-3.5" /> Seus dados vão só para o {corretor}.
          </p>
        </div>
      </div>

      {/* Bolinha */}
      <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 sm:bottom-6 sm:right-6 ${aberto ? "max-sm:hidden" : ""}`}>
        {convite && !aberto && (
          <button
            onClick={() => {
              setAberto(true);
              setConvite(false);
            }}
            className="subir hidden max-w-[260px] rounded-2xl rounded-br-sm border border-ink/10 bg-white px-4 py-3 text-left text-[13.5px] leading-snug text-ink shadow-xl sm:block"
          >
            <span className="rotulo mb-1 block !text-[9.5px] text-lagoa-2">{nome} · online</span>
            Procurando imóvel? Me conta o que você quer que eu filtro para você agora. 👋
          </button>
        )}
        <button
          onClick={() => {
            setAberto((v) => !v);
            setConvite(false);
          }}
          className={`group relative flex items-center rounded-full bg-ink text-white shadow-[0_14px_40px_-8px_rgba(15,26,44,.7)] ring-1 ring-white/10 transition hover:scale-[1.03] ${aberto ? "p-1.5" : "p-1.5 sm:pr-6"}`}
          aria-label={aberto ? "Fechar Agente 24h" : "Abrir Agente 24h"}
        >
          <span className={`relative grid h-14 w-14 place-items-center rounded-full ${aberto ? "bg-white/10" : "bg-zap"} ${aberto ? "" : "pulso"}`}>
            {aberto ? <X className="h-6 w-6" /> : <IconeWhatsapp className="h-8 w-8" />}
          </span>
          {!aberto && (
            <span className="ml-3 hidden text-left leading-tight sm:block">
              <span className="font-display block text-[18px] font-bold">{nome}</span>
              <span className="block text-[13px] text-white/80">Fale conosco agora!</span>
            </span>
          )}
          {!aberto && <span className="absolute right-1.5 top-1 h-3.5 w-3.5 rounded-full border-2 border-ink bg-zap" />}
        </button>
      </div>
    </>
  );
}
