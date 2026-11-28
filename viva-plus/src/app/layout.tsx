import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegister from "@/components/pwa-register";
import CookieNotice from "@/components/cookie-notice";

const SITE_URL = "https://www.vivamaiss.app.br";
const DESCRIPTION = "Controle financeiro pelo WhatsApp: todo dia a VIVA+ te diz quanto você pode gastar sem faltar dinheiro até o salário. Anote gastos por mensagem, áudio ou foto. Comece grátis.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "VIVA+ (Vivamais) · Chega de o mês acabar antes do salário", template: "%s · VIVA+" },
  description: DESCRIPTION,
  applicationName: "Vivamais",
  keywords: ["controle financeiro", "controle de gastos pelo WhatsApp", "app de finanças pessoais", "organizar dinheiro", "quanto posso gastar por dia", "planilha de gastos", "orçamento pessoal", "sair das dívidas", "controle financeiro pelo WhatsApp", "app para controlar gastos", "regra 50 30 20", "VIVA+", "Vivamais", "Viva Mais"],
  authors: [{ name: "VIVA+ (Vivamais)" }],
  creator: "VIVA+ (Vivamais)",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website", locale: "pt_BR", url: SITE_URL, siteName: "Vivamais",
    title: "VIVA+ · Chega de o mês acabar antes do salário",
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: "VIVA+ · Chega de o mês acabar antes do salário", description: DESCRIPTION },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  // Google Search Console (método "tag HTML"): coloque o código em GOOGLE_SITE_VERIFICATION na Vercel.
  verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
  category: "finance",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icons/viva-192.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
  },
  appleWebApp: {
    capable: true,
    title: "VIVA+",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "only light",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#6410C9" },
    { media: "(prefers-color-scheme: dark)", color: "#6410C9" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body><a href="#conteudo" className="skip-link">Pular para o conteúdo</a><PwaRegister />{children}<CookieNotice /></body>
    </html>
  );
}
