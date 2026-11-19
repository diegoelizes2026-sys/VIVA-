"use client";

export const EVENTO_AGENTE = "agente24h:abrir";

/** Abre o Agente 24h de qualquer lugar do site, opcionalmente já enviando uma mensagem. */
export function abrirAgente(mensagem?: string) {
  window.dispatchEvent(new CustomEvent(EVENTO_AGENTE, { detail: { mensagem } }));
}
