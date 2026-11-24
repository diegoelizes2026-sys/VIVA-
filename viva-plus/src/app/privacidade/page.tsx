import Link from "next/link";
import LegalPage, { Section } from "@/components/legal-page";
import { COMPANY, PRIVACY_VERSION } from "@/lib/legal";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP_DISPLAY, supportEmailUrl, supportWhatsAppUrl } from "@/lib/support";

export const metadata = { title: "Política de Privacidade", description: "Como o VIVA+ (Vivamais) cuida dos seus dados, conforme a LGPD: o que coletamos, por quê e seus direitos.", alternates: { canonical: "/privacidade" } };

export default function PrivacyPage() {
  return <LegalPage title="Política de Privacidade" version={PRIVACY_VERSION} current="/privacidade">
    <Section title="1. Quem cuida dos seus dados">
      <p>O controlador dos dados é <b>{COMPANY.legalName}</b>, CNPJ {COMPANY.cnpj}, {COMPANY.address || COMPANY.city}. Para qualquer assunto de privacidade, inclusive como canal do encarregado (LGPD, art. 41), fale pelo e-mail <a href={supportEmailUrl("Privacidade - VIVA+")}>{SUPPORT_EMAIL}</a>.</p>
      <p>Esta política explica, em linguagem simples, quais dados o {COMPANY.product} usa, por quê, com quem compartilha e quais são seus direitos pela Lei Geral de Proteção de Dados (Lei 13.709/2018 – LGPD).</p>
    </Section>

    <Section title="2. Quais dados usamos e para quê">
      <table>
        <thead><tr><th scope="col">Dado</th><th scope="col">Para quê</th><th scope="col">Base legal (LGPD)</th></tr></thead>
        <tbody>
          <tr><td>Nome, e-mail e senha (guardada de forma criptografada)</td><td>Criar e proteger sua conta, falar com você</td><td>Execução de contrato (art. 7º, V)</td></tr>
          <tr><td>Informações financeiras que você registra (gastos, entradas, contas, dívidas, metas, salário)</td><td>Organizar seu dinheiro, calcular quanto pode gastar, lembretes e análises</td><td>Execução de contrato</td></tr>
          <tr><td>Mensagens, áudios e fotos de comprovante enviados à VIVA</td><td>Responder, transcrever o áudio e ler o comprovante</td><td>Execução de contrato</td></tr>
          <tr><td><b>Dados de saúde</b> (objetivo, peso, limitações, treinos, água)</td><td>Montar e ajustar treinos e hábitos no Personal</td><td><b>Consentimento específico</b> (art. 11, I), pedido antes de configurar o Personal</td></tr>
          <tr><td>Localização aproximada (só quando você usa “Perto de mim”)</td><td>Mostrar lugares próximos</td><td>Consentimento (permissão do navegador)</td></tr>
          <tr><td>Número e mensagens do WhatsApp (se você conectar)</td><td>Atender você pela VIVA no WhatsApp</td><td>Execução de contrato</td></tr>
          <tr><td>Dados de pagamento: plano, valor, status e identificador da transação. <b>Não guardamos número de cartão</b>.</td><td>Liberar o plano, emitir comprovantes, prevenir fraude</td><td>Execução de contrato e obrigação legal</td></tr>
          <tr><td>Chave Pix e indicações (Indique e ganhe)</td><td>Pagar recompensas e evitar fraude</td><td>Execução de contrato e legítimo interesse</td></tr>
          <tr><td>Registros de acesso (data, hora, IP) e telas usadas</td><td>Segurança, suporte e melhoria do app (estatísticas internas)</td><td>Obrigação legal (Marco Civil, art. 15) e legítimo interesse</td></tr>
          <tr><td>Aparelho para notificações (se você ativar)</td><td>Enviar lembretes e avisos</td><td>Consentimento (permissão do navegador)</td></tr>
        </tbody>
      </table>
      <p>Pedimos só o necessário: para criar a conta bastam nome, e-mail e senha. Todo o resto é opcional e você decide o que contar à VIVA.</p>
    </Section>

    <Section title="3. Inteligência artificial">
      <p>As respostas da VIVA e do Personal, a transcrição de áudio e a leitura de comprovantes usam a API da <b>OpenAI</b>. Enviamos apenas o conteúdo necessário para cada resposta. Segundo as políticas do fornecedor, os dados enviados pela API não são usados para treinar os modelos dele. Não tomamos decisões automatizadas que produzam efeitos jurídicos sobre você; você pode pedir revisão de qualquer análise (art. 20).</p>
    </Section>

    <Section title="4. Com quem compartilhamos">
      <p><b>Não vendemos seus dados.</b> Compartilhamos só com fornecedores necessários para o serviço funcionar, que tratam os dados em nosso nome:</p>
      <ul>
        <li><b>Supabase</b> – banco de dados, login e arquivos (servidores nos EUA);</li>
        <li><b>Vercel</b> – hospedagem do site e do app (EUA);</li>
        <li><b>OpenAI</b> – inteligência artificial (EUA);</li>
        <li><b>Meta / WhatsApp</b> – mensagens, se você conectar o WhatsApp;</li>
        <li><b>Mercado Pago</b> – pagamentos por Pix e cartão (ele trata os dados do cartão sob a política dele);</li>
        <li><b>OpenStreetMap, Overpass e Photon (Komoot)</b> – busca de lugares próximos, com a localização arredondada (cerca de 100 metros), sem nome ou e-mail;</li>
        <li>Serviços de notificação do seu navegador (Google, Apple ou Mozilla), se você ativar notificações.</li>
      </ul>
      <p>Também podemos compartilhar dados quando a lei ou uma autoridade exigir.</p>
    </Section>

    <Section title="5. Transferência internacional">
      <p>Alguns fornecedores ficam fora do Brasil (principalmente nos EUA). Essas transferências são feitas para executar o contrato com você e com fornecedores que adotam cláusulas contratuais e medidas de segurança compatíveis com a LGPD (art. 33).</p>
    </Section>

    <Section title="6. Cookies e armazenamento no aparelho">
      <p>Usamos apenas cookies e armazenamento <b>essenciais</b> (login, segurança e preferências). Não usamos cookies de publicidade nem ferramentas de rastreamento de terceiros. Detalhes na <Link href="/cookies">Política de Cookies</Link>.</p>
    </Section>

    <Section title="7. Por quanto tempo guardamos">
      <ul>
        <li>Dados da conta e o que você registra: enquanto a conta existir. Após pedido de exclusão, apagamos em até 30 dias.</li>
        <li>Fotos de comprovante não salvas num lançamento: apagadas automaticamente.</li>
        <li>Registros de acesso: 6 meses (Marco Civil da Internet).</li>
        <li>Dados de pagamento e fiscais: pelo prazo exigido em lei (em geral, 5 anos).</li>
      </ul>
    </Section>

    <Section title="8. Segurança">
      <p>Usamos conexão criptografada (HTTPS), controle de acesso por conta (cada pessoa só vê os próprios dados), senhas criptografadas e acesso restrito da equipe. Nenhum sistema é 100% seguro: se ocorrer um incidente relevante, avisaremos você e a ANPD, conforme a lei.</p>
    </Section>

    <Section title="9. Seus direitos">
      <p>Você pode, a qualquer momento: confirmar se tratamos seus dados; acessar e baixar seus dados; corrigir; pedir anonimização, bloqueio ou exclusão; pedir a portabilidade; saber com quem compartilhamos; revogar consentimentos (por exemplo, dados de saúde, localização e notificações); e se opor a tratamentos. Em <b>Meus dados</b>, no app, você vê, corrige e exclui seus perfis financeiro e de saúde. Para receber uma cópia de tudo, excluir a conta ou qualquer outro pedido, use o e-mail <a href={supportEmailUrl("Direitos do titular - VIVA+")}>{SUPPORT_EMAIL}</a> ou WhatsApp <a href={supportWhatsAppUrl()} target="_blank" rel="noopener noreferrer">{SUPPORT_WHATSAPP_DISPLAY}</a>. Respondemos em até 15 dias. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (<a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer">ANPD</a>).</p>
    </Section>

    <Section title="10. Menores de idade">
      <p>O VIVA+ é para maiores de 18 anos. Não coletamos dados de crianças e adolescentes de propósito; se identificarmos uma conta assim, ela será excluída.</p>
    </Section>

    <Section title="11. Mudanças nesta política">
      <p>Podemos atualizar esta política. Quando a mudança for importante, avisaremos no app e pediremos um novo aceite.</p>
    </Section>
  </LegalPage>;
}
