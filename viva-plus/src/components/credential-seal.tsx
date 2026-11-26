import { ShieldCheck } from "lucide-react";

const since = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { month: "short", year: "numeric", timeZone: "America/Fortaleza" }).replace(".", "");
};

/** Selo "Credenciado VIVA+": profissional com registro (CREF) conferido e aprovado pela equipe da VIVA+. */
export default function CredentialSeal({ size = "sm", credentialedAt, cref }: { size?: "sm" | "lg"; credentialedAt?: string | null; cref?: string }) {
  const s = since(credentialedAt);
  if (size === "lg") return <div className="cs-lg" role="img" aria-label={`Profissional credenciado VIVA+${s ? " desde " + s : ""}`}>
    <span className="cs-shield"><ShieldCheck aria-hidden /></span>
    <div><b>Profissional credenciado VIVA+</b><small>{cref ? `CREF ${cref} conferido` : "Registro profissional conferido"}{s ? ` · desde ${s}` : ""}</small></div>
  </div>;
  return <span className="cs-sm" title={`Credenciado VIVA+: registro profissional${cref ? " (CREF " + cref + ")" : ""} conferido pela equipe VIVA+${s ? " desde " + s : ""}.`}>
    <ShieldCheck aria-hidden />Credenciado VIVA+
  </span>;
}
