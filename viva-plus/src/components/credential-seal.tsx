import { ShieldCheck } from "lucide-react";

const since = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { month: "short", year: "numeric", timeZone: "America/Fortaleza" }).replace(".", "");
};

/** Selo "Credenciado VIVA+": profissional com registro (CREF) conferido e aprovado pela equipe da VIVA+. */
export default function CredentialSeal({ size = "sm", credentialedAt, cref, kind = "pro" }: { size?: "sm" | "lg"; credentialedAt?: string | null; cref?: string; kind?: "pro" | "gym" }) {
  const s = since(credentialedAt);
  const gym = kind === "gym";
  if (size === "lg") return <div className="cs-lg" role="img" aria-label={`${gym ? "Academia credenciada" : "Profissional credenciado"} VIVA+${s ? " desde " + s : ""}`}>
    <span className="cs-shield"><ShieldCheck aria-hidden /></span>
    <div><b>{gym ? "Academia credenciada VIVA+" : "Profissional credenciado VIVA+"}</b><small>{gym ? "CNPJ conferido pela equipe VIVA+" : cref ? `CREF ${cref} conferido` : "Registro profissional conferido"}{s ? ` · desde ${s}` : ""}</small></div>
  </div>;
  return <span className="cs-sm" title={gym ? `Academia credenciada VIVA+: CNPJ conferido pela equipe VIVA+${s ? " desde " + s : ""}.` : `Credenciado VIVA+: registro profissional${cref ? " (CREF " + cref + ")" : ""} conferido pela equipe VIVA+${s ? " desde " + s : ""}.`}>
    <ShieldCheck aria-hidden />{gym ? "Academia credenciada VIVA+" : "Credenciado VIVA+"}
  </span>;
}
