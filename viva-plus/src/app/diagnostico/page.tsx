import LifeDiagnostic from "@/components/life-diagnostic";

// /diagnostico agora abre o diagnóstico do funil de venda (o mesmo de /diagnostico-vida),
// que termina na oferta do Pro. O quiz antigo (components/diagnostic-quiz) ficou sem uso.
export const metadata = {
  title: { absolute: "Diagnóstico Grátis · VIVA+" },
  description: "9 perguntas rápidas sobre dinheiro, tempo, rotina, alimentação e sono. Descubra onde a sua vida está desequilibrada. Grátis, resultado na hora.",
  alternates: { canonical: "/diagnostico" },
  openGraph: { title: "Faça seu diagnóstico grátis", description: "Descubra onde a sua vida está desequilibrada. Grátis, em 1 minuto.", url: "/diagnostico" },
};

export default function Page() { return <LifeDiagnostic />; }
