import Link from "next/link";
import LegalPage, { Section } from "@/components/legal-page";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP_DISPLAY, supportEmailUrl, supportWhatsAppUrl } from "@/lib/support";

export const metadata = { title: "Cancelamento e reembolso", description: "Como cancelar o VIVA+ e pedir reembolso: arrependimento em 7 dias, Pix e cartão.", alternates: { canonical: "/reembolso" } };

export default function RefundPage() {
  return <LegalPage title="Política de Cancelamento e Reembolso" current="/reembolso">
    <Section title="1. Direito de arrependimento: 7 dias">
      <p>Comprou pela internet e desistiu? Você pode cancelar em até <b>7 dias</b> a partir do pagamento e recebe <b>100% do valor de volta</b>, sem precisar explicar o motivo (art. 49 do Código de Defesa do Consumidor). Isso vale para a primeira contratação de cada plano e também para cobranças anuais.</p>
    </Section>

    <Section title="2. Como cancelar">
      <ul>
        <li>Fale com a gente pelo e-mail <a href={supportEmailUrl("Cancelamento - VIVA+")}>{SUPPORT_EMAIL}</a> ou WhatsApp <a href={supportWhatsAppUrl("Olá! Quero cancelar meu plano VIVA+.")} target="_blank" rel="noopener noreferrer">{SUPPORT_WHATSAPP_DISPLAY}</a>, informando o e-mail da conta. Confirmamos o cancelamento imediatamente, com um protocolo.</li>
        <li>Assinatura no cartão: você também pode cancelar direto na sua conta do Mercado Pago (Assinaturas).</li>
        <li>Não há multa nem fidelidade.</li>
      </ul>
    </Section>

    <Section title="3. Depois dos 7 dias">
      <ul>
        <li><b>Cartão (renovação automática):</b> o cancelamento impede as próximas cobranças. Você continua com o plano até o fim do período já pago, e não há reembolso proporcional desse período.</li>
        <li><b>Pix:</b> o pagamento vale pelo período contratado e não renova sozinho. Não há reembolso proporcional depois dos 7 dias.</li>
        <li><b>Plano anual:</b> depois dos 7 dias, analisamos com boa vontade pedidos de reembolso proporcional em casos especiais.</li>
      </ul>
    </Section>

    <Section title="4. Falhas e cobranças indevidas">
      <p>Se você foi cobrado em duplicidade, por engano, ou se o serviço não funcionou por falha nossa, devolvemos o valor cobrado indevidamente, independentemente do prazo.</p>
    </Section>

    <Section title="5. Prazo e forma de devolução">
      <p>O reembolso é feito pelo mesmo meio de pagamento, pelo Mercado Pago, em até <b>10 dias úteis</b> após a confirmação. No cartão, o crédito aparece na fatura conforme o prazo da operadora (pode levar até 2 faturas). Com o reembolso, o plano volta para o grátis e os créditos do período pago são retirados.</p>
    </Section>

    <Section title="6. Teste grátis e créditos">
      <p>O teste grátis do Pro (7 dias) não gera cobrança. Créditos de boas-vindas, de indicação ou de teste são bônus e não podem ser trocados por dinheiro. Recompensas em dinheiro do Indique e ganhe seguem as regras dos <Link href="/termos#indicacao">Termos de Uso</Link>.</p>
    </Section>
  </LegalPage>;
}
