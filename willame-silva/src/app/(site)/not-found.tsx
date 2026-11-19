import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <main className="grid min-h-[70vh] place-items-center px-4 pt-24 text-center">
      <div>
        <p className="rotulo text-lagoa-2">Erro 404</p>
        <h1 className="font-display mt-4 text-6xl font-light">
          Esse endereço <em className="text-lagoa-2">não existe</em>.
        </h1>
        <Link href="/" className="mt-8 inline-block rounded-full bg-ink px-6 py-3 font-semibold text-osso">
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
