import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK", "opsz"],
  style: ["normal", "italic"],
  display: "swap",
});
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const plex = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Willame Silva · Corretor de Imóveis",
    template: "%s · Willame Silva Imóveis",
  },
  description:
    "Lançamentos, lotes, casas e empreendimentos de alto padrão no Ceará, com curadoria e atendimento do corretor Willame Silva. Agente 24h no site.",
  openGraph: {
    title: "Willame Silva · Corretor de Imóveis",
    description: "Curadoria dos melhores empreendimentos do Ceará. Fale agora com o Agente 24h.",
    locale: "pt_BR",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#0b1f1e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${manrope.variable} ${plex.variable}`}>
      <body>{children}</body>
    </html>
  );
}
