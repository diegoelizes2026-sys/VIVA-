import LifeDiagnostic from "@/components/life-diagnostic";

export const metadata = {
  title: { absolute: "Diagnóstico da Vida · VIVA+" },
  description: "9 perguntas rápidas sobre dinheiro, tempo, rotina, alimentação e sono. Descubra onde a sua vida está desequilibrada.",
  alternates: { canonical: "/diagnostico-vida" },
  // Página de campanha (tráfego pago): não entra na busca.
  robots: { index: false, follow: false },
  openGraph: { title: "Descubra onde a sua vida está desequilibrada", description: "Diagnóstico grátis em 1 minuto.", url: "/diagnostico-vida" },
};

export default function Page() { return <LifeDiagnostic />; }
