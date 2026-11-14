import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegister from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "VIVA+ | Sua vida mais inteligente",
  description: "Organize sua rotina, cuide do seu dinheiro e descubra oportunidades para economizar.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icons/viva-192.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
    apple: [{ url: "/icons/apple-touch-icon.svg", sizes: "180x180", type: "image/svg+xml" }],
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
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#6410C9" },
    { media: "(prefers-color-scheme: dark)", color: "#6410C9" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body><PwaRegister />{children}</body>
    </html>
  );
}
