// Contatos oficiais do suporte VIVA+ (um único lugar para trocar quando precisar).
export const SUPPORT_EMAIL = "vivamais597@gmail.com";
export const SUPPORT_WHATSAPP = "5585988252048";
export const SUPPORT_WHATSAPP_DISPLAY = "(85) 98825-2048";

export function supportWhatsAppUrl(message = "Olá! Preciso de ajuda com o VIVA+.") {
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

export function supportEmailUrl(subject = "Suporte VIVA+") {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
