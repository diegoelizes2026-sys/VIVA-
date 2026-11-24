"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const KEY = "viva-cookie-notice-v1";

/** Aviso de cookies: o VIVA+ só usa itens essenciais, então é um aviso (sem bloquear o uso). */
export default function CookieNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => { try { setShow(localStorage.getItem(KEY) !== "1"); } catch { setShow(true); } }, []);
  if (!show) return null;
  const ok = () => { try { localStorage.setItem(KEY, "1"); } catch { /* sem armazenamento */ } setShow(false); };
  return <div className="cookie-notice" role="region" aria-label="Aviso de cookies">
    <p>Usamos apenas cookies essenciais para manter você conectado e o app funcionando. Nada de publicidade ou rastreamento de terceiros. <Link href="/cookies">Saiba mais</Link>.</p>
    <button type="button" onClick={ok}>Entendi</button>
  </div>;
}
