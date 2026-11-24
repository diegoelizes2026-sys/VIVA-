import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Imagem que aparece quando o link do site é compartilhado (WhatsApp, Instagram, Facebook, Google).
export const alt = "VIVA+ · Chega de o mês acabar antes do salário";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const dir = join(process.cwd(), "src/assets/fonts");
  const [black, bold] = await Promise.all([readFile(join(dir, "Inter-Black.otf")), readFile(join(dir, "Inter-Bold.otf"))]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", padding: 70, background: "linear-gradient(150deg,#3d0a86 0%,#6410C9 58%,#8b3de8 100%)", color: "#fff", fontFamily: "Inter" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 700 }}>
          <div style={{ display: "flex", fontSize: 56, fontWeight: 900, letterSpacing: -2 }}>VIVA<span style={{ color: "#FFD43B" }}>+</span></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", fontSize: 64, fontWeight: 900, lineHeight: 1.05, letterSpacing: -2 }}>Chega de o mês acabar antes do salário.</div>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 700, opacity: 0.92, lineHeight: 1.3 }}>Todo dia a VIVA te diz quanto você pode gastar. Pelo WhatsApp.</div>
          </div>
          <div style={{ display: "flex", alignSelf: "flex-start", padding: "16px 30px", borderRadius: 999, background: "#FFD43B", color: "#2a1050", fontSize: 30, fontWeight: 900 }}>Comece grátis</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", marginLeft: 40, width: 330 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 34, borderRadius: 36, background: "rgba(255,255,255,.14)", border: "2px solid rgba(255,255,255,.25)" }}>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 700, opacity: 0.9 }}>Hoje você pode gastar</div>
            <div style={{ display: "flex", fontSize: 84, fontWeight: 900, letterSpacing: -3 }}>R$ 47</div>
            <div style={{ display: "flex", alignSelf: "flex-start", padding: "8px 16px", borderRadius: 999, background: "#d9fbe8", color: "#0b6b37", fontSize: 22, fontWeight: 800 }}>até o salário</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Inter", data: black, weight: 900, style: "normal" }, { name: "Inter", data: bold, weight: 700, style: "normal" }] },
  );
}
