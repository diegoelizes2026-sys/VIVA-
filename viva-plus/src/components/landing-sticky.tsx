"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

// Botão fixo da página de vendas (celular): aparece só depois que o botão principal sai da tela.
export default function LandingSticky() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = document.querySelector(".lp") as HTMLElement | null;
    const on = () => setShow(((el && el.scrollHeight > el.clientHeight ? el.scrollTop : window.scrollY) || 0) > 650);
    el?.addEventListener("scroll", on, { passive: true }); window.addEventListener("scroll", on, { passive: true });
    return () => { el?.removeEventListener("scroll", on); window.removeEventListener("scroll", on); };
  }, []);
  return <div className={"lp-sticky" + (show ? " on" : "")} aria-hidden={!show}><Link href="/cadastro" className="lp-btn" tabIndex={show ? 0 : -1}>Começar grátis</Link></div>;
}
