import { SUPPORT_EMAIL, SUPPORT_WHATSAPP_DISPLAY, supportEmailUrl, supportWhatsAppUrl } from "@/lib/support";

export default function SupportCard() {
  return (
    <section className="card mt-5 max-w-2xl p-6">
      <b>Falar com o suporte</b>
      <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
        Dúvidas, problemas com a conta, pagamentos ou pedidos sobre seus dados? Fale com a gente.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <a className="btn-primary" href={supportWhatsAppUrl()} target="_blank" rel="noopener noreferrer">💬 WhatsApp {SUPPORT_WHATSAPP_DISPLAY}</a>
        <a className="btn-secondary" href={supportEmailUrl()}>✉️ {SUPPORT_EMAIL}</a>
      </div>
    </section>
  );
}
