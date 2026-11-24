import Link from "next/link";
import LegalPage, { Section } from "@/components/legal-page";

export const metadata = { title: "Política de Cookies · VIVA+" };

export default function CookiesPage() {
  return <LegalPage title="Política de Cookies" current="/cookies">
    <Section title="1. O que são cookies">
      <p>Cookies e o armazenamento local do navegador são pequenos arquivos guardados no seu aparelho para o site lembrar de você, manter o login e funcionar direito.</p>
    </Section>

    <Section title="2. O que o VIVA+ usa">
      <p>Usamos <b>somente cookies e armazenamento essenciais</b>. Não usamos cookies de publicidade, pixels de redes sociais, Google Analytics ou qualquer rastreamento de terceiros.</p>
      <table>
        <thead><tr><th scope="col">Nome / tipo</th><th scope="col">Para quê</th><th scope="col">Duração</th></tr></thead>
        <tbody>
          <tr><td>sb-…-auth-token (cookie)</td><td>Manter você logado com segurança</td><td>Até sair da conta ou expirar a sessão</td></tr>
          <tr><td>viva_wa_connect (cookie)</td><td>Concluir a conexão do WhatsApp depois do login</td><td>1 hora</td></tr>
          <tr><td>Armazenamento local e de sessão</td><td>Preferências e avisos já vistos (ex.: este aviso de cookies, ofertas fechadas, código de convite)</td><td>Até você limpar os dados do navegador</td></tr>
          <tr><td>viva-track (armazenamento de sessão)</td><td>Estatística interna de quais telas são usadas, para melhorar o app. Não é compartilhada com terceiros.</td><td>Até fechar o navegador</td></tr>
          <tr><td>Service worker / cache do app</td><td>Abrir o app mais rápido e mostrar uma tela quando estiver sem internet</td><td>Até você remover o app ou limpar os dados</td></tr>
        </tbody>
      </table>
    </Section>

    <Section title="3. Preciso aceitar?">
      <p>Como só usamos itens essenciais para o serviço funcionar, eles não dependem de consentimento (LGPD, art. 7º, V e IX). Mostramos um aviso para você saber que eles existem. Se no futuro usarmos cookies não essenciais, pediremos sua permissão antes.</p>
    </Section>

    <Section title="4. Como controlar">
      <p>Você pode apagar ou bloquear cookies nas configurações do navegador. Se bloquear os essenciais, não será possível ficar logado. Saiba mais sobre como tratamos seus dados na <Link href="/privacidade">Política de Privacidade</Link>.</p>
    </Section>
  </LegalPage>;
}
