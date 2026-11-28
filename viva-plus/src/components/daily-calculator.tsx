"use client";
import { useMemo, useState } from "react";
import Link from "next/link";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (s: string) => {
  const v = Number(String(s).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(v) && v > 0 ? v : 0;
};

/** Dias de hoje até o próximo pagamento (contando hoje). */
function daysUntil(payDay: number) {
  const today = new Date();
  const d = today.getDate();
  let target = new Date(today.getFullYear(), today.getMonth(), payDay);
  if (payDay <= d) target = new Date(today.getFullYear(), today.getMonth() + 1, payDay);
  const ms = target.getTime() - new Date(today.getFullYear(), today.getMonth(), d).getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

// Calculadora pública: quanto a pessoa pode gastar por dia até o próximo salário.
export default function DailyCalculator() {
  const [saldo, setSaldo] = useState("");
  const [contas, setContas] = useState("");
  const [guardar, setGuardar] = useState("");
  const [dia, setDia] = useState("5");

  const r = useMemo(() => {
    const payDay = Math.min(31, Math.max(1, Math.round(Number(dia) || 5)));
    const dias = daysUntil(payDay);
    const livre = num(saldo) - num(contas) - num(guardar);
    return { dias, livre, porDia: livre / dias, porSemana: (livre / dias) * 7 };
  }, [saldo, contas, guardar, dia]);

  const filled = num(saldo) > 0;
  return <div className="calc-box">
    <div className="calc-grid">
      <label>Quanto você tem hoje (conta + carteira)<input inputMode="decimal" placeholder="Ex.: 1.200" value={saldo} onChange={e => setSaldo(e.target.value)} /></label>
      <label>Contas que ainda vencem até o pagamento<input inputMode="decimal" placeholder="Ex.: 450 (luz, internet, cartão)" value={contas} onChange={e => setContas(e.target.value)} /></label>
      <label>Quanto quer guardar (opcional)<input inputMode="decimal" placeholder="Ex.: 100" value={guardar} onChange={e => setGuardar(e.target.value)} /></label>
      <label>Dia do mês em que você recebe<input inputMode="numeric" placeholder="Ex.: 5" value={dia} onChange={e => setDia(e.target.value.replace(/\D/g, "").slice(0, 2))} /></label>
    </div>
    <div className="calc-result" aria-live="polite">
      {!filled ? <p>Preencha quanto você tem hoje para ver o seu número do dia.</p>
        : r.livre <= 0 ? <><p className="calc-big neg">{brl(r.livre)}</p><p>O dinheiro de hoje não cobre as contas até o pagamento. Vale cortar gastos que não são essenciais e ver quais contas dá para negociar ou pagar depois sem juros.</p></>
        : <><p className="calc-label">Você pode gastar por dia</p><p className="calc-big">{brl(r.porDia)}</p><p>São {r.dias} {r.dias === 1 ? "dia" : "dias"} até o pagamento, cerca de {brl(r.porSemana)} por semana, já sem as contas{num(guardar) > 0 ? " e com a reserva separada" : ""}.</p></>}
    </div>
    <div className="calc-cta">
      <p><b>Quer esse número atualizado todo dia, sem fazer conta?</b> A VIVA+ te manda pelo WhatsApp e recalcula a cada gasto que você anota.</p>
      <Link href="/cadastro?origem=calculadora" className="lp-btn">Receber meu número do dia grátis</Link>
    </div>
  </div>;
}
