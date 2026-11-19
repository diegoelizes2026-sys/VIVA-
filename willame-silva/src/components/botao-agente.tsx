"use client";

import { abrirAgente } from "./agente-eventos";

export function BotaoAgente({
  mensagem,
  className,
  children,
}: {
  mensagem?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={() => abrirAgente(mensagem)} className={className}>
      {children}
    </button>
  );
}
