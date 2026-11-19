import { Agente24h } from "@/components/agente-24h";
import { Rodape } from "@/components/rodape";
import { lerConfig, listarEmpreendimentos } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [cfg, emps] = await Promise.all([lerConfig(), listarEmpreendimentos()]);
  return (
    <>
      {children}
      <Rodape cfg={cfg} emps={emps} />
      <Agente24h nome={cfg.agente_nome || "Agente 24h"} boasVindas={cfg.agente_boas_vindas} corretor={cfg.corretor_nome} />
    </>
  );
}
