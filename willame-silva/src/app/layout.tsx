import type { Metadata, Viewport } from "next";
import { Montserrat, Open_Sans } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", weight: ["400", "500", "600", "700", "800"], display: "swap" });
const openSans = Open_Sans({ subsets: ["latin"], variable: "--font-open", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Willame Negócios Imobiliário · Seu imóvel, nosso compromisso",
    template: "%s · Willame Negócios Imobiliário",
  },
  description:
    "Compra, venda e locação de imóveis com segurança, transparência e atendimento personalizado. Fale agora com o Agente 24h.",
  openGraph: {
    title: "Willame Negócios Imobiliário",
    description: "Curadoria dos melhores empreendimentos do Ceará. Fale agora com o Agente 24h.",
    locale: "pt_BR",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#0f1a2c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${montserrat.variable} ${openSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
