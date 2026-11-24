// Dados da empresa e versões dos documentos legais (um único lugar para trocar).
// Sem dependências: usado também no middleware.
export const COMPANY = {
  product: "VIVA+",
  // Nome por extenso (o mesmo do perfil do WhatsApp Business).
  brandName: "Vivamais",
  legalName: "70.254.525 ISAQUE BATISTA SOARES",
  cnpj: "70.254.525/0001-39",
  city: "Aquiraz, CE",
  // Endereço completo exigido pelo Decreto 7.962/2013 (comércio eletrônico).
  address: "Rua Tibúrcio Targino, 389, Centro, Aquiraz – CE",
  site: "www.vivamaiss.app.br",
} as const;

// Ao mudar uma versão, todas as contas precisam aceitar de novo (tela /aceite-termos).
export const TERMS_VERSION = "2026-11-24-v2";
export const PRIVACY_VERSION = "2026-11-24-v2";
export const LEGAL_UPDATED_AT = "24/11/2026";

export const LEGAL_LINKS = [
  { href: "/termos", label: "Termos de Uso" },
  { href: "/privacidade", label: "Privacidade" },
  { href: "/cookies", label: "Cookies" },
  { href: "/reembolso", label: "Cancelamento e reembolso" },
] as const;

export function companyLine() {
  return `${COMPANY.product} (${COMPANY.brandName}) é um produto de ${COMPANY.legalName} · CNPJ ${COMPANY.cnpj} · ${COMPANY.address || COMPANY.city}`;
}
