import { NextResponse } from "next/server";
import { COOKIE, cookieOpts, criarToken, senhaAdmin } from "@/lib/auth";

export async function POST(req: Request) {
  const { senha } = ((await req.json().catch(() => ({}))) ?? {}) as { senha?: string };
  const certa = senhaAdmin();
  if (!certa) {
    return NextResponse.json(
      { erro: "Defina a variável ADMIN_PASSWORD na Vercel para liberar o painel." },
      { status: 500 },
    );
  }
  if (!senha || senha !== certa) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ erro: "Senha incorreta." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await criarToken(), cookieOpts);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { ...cookieOpts, maxAge: 0 });
  return res;
}
