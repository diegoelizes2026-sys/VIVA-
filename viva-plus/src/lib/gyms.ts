// Academias credenciadas VIVA+: modalidades e utilidades compartilhadas.
export const MODALITIES: [string, string][] = [
  ["musculacao", "Musculação"], ["funcional", "Funcional"], ["crossfit", "CrossFit"], ["pilates", "Pilates"], ["yoga", "Yoga"],
  ["natacao", "Natação"], ["lutas", "Lutas"], ["danca", "Dança"], ["spinning", "Spinning"], ["ginastica", "Ginástica"],
];
export const MODALITY_IDS = MODALITIES.map(m => m[0]) as [string, ...string[]];
export const modalityLabel = (id: string) => MODALITIES.find(m => m[0] === id)?.[1] ?? id;
export const brlFromCents = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: c % 100 ? 2 : 0 });

/** CNPJ: confere os dois dígitos verificadores. */
export function validCnpj(raw: string) {
  const c = raw.replace(/\D/g, "");
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const dv = (base: string) => { const w = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; const s = base.split("").reduce((a, d, i) => a + Number(d) * w[i], 0) % 11; return s < 2 ? 0 : 11 - s; };
  return dv(c.slice(0, 12)) === Number(c[12]) && dv(c.slice(0, 13)) === Number(c[13]);
}
export const formatCnpj = (c: string) => c.replace(/\D/g, "").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, "$1.$2.$3/$4-$5");
