import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Ícone em PNG para iPhone/iPad (o iOS não aceita SVG na tela de início) e para o Google.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const black = await readFile(join(process.cwd(), "src/assets/fonts/Inter-Black.otf"));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#6410C9", color: "#fff", fontFamily: "Inter", fontSize: 92, fontWeight: 900, letterSpacing: -4 }}>
        V<span style={{ color: "#FFD43B" }}>+</span>
      </div>
    ),
    { ...size, fonts: [{ name: "Inter", data: black, weight: 900, style: "normal" }] },
  );
}
