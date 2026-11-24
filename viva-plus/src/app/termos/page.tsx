import Link from "next/link";
import LegalPage, { Section } from "@/components/legal-page";
import { COMPANY, TERMS_VERSION } from "@/lib/legal";
import { SUPPORT_EMAIL, supportEmailUrl } from "@/lib/support";

export const metadata = { title: "Termos de Uso · VIVA+" };

export default function TermsPage() {
  return <LegalPage title="Termos de Uso" version={TERMS_VERSION} current="/termos">
    <Section title="1. Quem somos e aceite">
      <p>Estes Termos regulam o uso do {COMPANY.product} (site {COMPANY.site}, aplicativo web e atendimento pelo WhatsApp), oferecido por <b>{COMPANY.legalName}</b>, CNPJ {COMPANY.cnpj}, com sede em {COMPANY.address || COMPANY.city} (“VIVA+”, “nós”).</p>
      <p>Ao criar uma conta e marcar o aceite, você concorda com estes Termos, com a <Link href="/privacidade">Política de Privacidade</Link>, a <Link href="/cookies">Política de Cookies</Link> e a <Link href="/reembolso">Política de Cancelamento e Reembolso</Link>. Se não concordar, não use o serviço.</p>
    </Section>

    <Section title="2. Quem pode usar">
      <p>O VIVA+ é destinado a pessoas com <b>18 anos ou mais</b>, capazes de contratar. Ao se cadastrar, você declara ter essa idade e informar dados verdadeiros. Você é responsável por manter sua senha em sigilo e pelo que for feito na sua conta.</p>
    </Section>

    <Section title="3. O que o VIVA+ faz">
      <p>O VIVA+ é uma assistente digital de organização: registro de gastos e entradas, contas a pagar, metas, planejamento, lista de compras, agenda, lugares próximos, hábitos e sugestões de treino (“Personal”). Parte das respostas é gerada por <b>inteligência artificial</b> e pode conter erros.</p>
      <p><b>O VIVA+ não é banco, corretora nem consultoria.</b> As sugestões são informativas e não substituem orientação de profissional habilitado (financeiro, contábil, jurídico, médico, nutricional ou de educação física). Confira valores, cálculos e alertas antes de decidir. Antes de iniciar atividade física, especialmente se você tem alguma condição de saúde, procure um médico. Não garantimos resultados financeiros ou físicos.</p>
      <p>O VIVA+ não pede nem acessa senha de banco.</p>
    </Section>

    <Section title="4. Planos, créditos e teste grátis">
      <ul>
        <li><b>Plano grátis:</b> criar conta não gera cobrança. O plano grátis tem recursos e créditos limitados.</li>
        <li><b>Créditos:</b> conversas com a inteligência da VIVA consomem créditos conforme a tabela exibida no app. Créditos do plano renovam a cada ciclo pago, não acumulam entre ciclos, não têm valor em dinheiro e não podem ser transferidos.</li>
        <li><b>Teste grátis do Pro:</b> dura <b>7 dias</b>, uma vez por conta, sem cartão e sem cobrança. Ao terminar, a conta volta ao plano grátis, e mostramos os planos para você decidir se quer assinar.</li>
        <li><b>Planos pagos:</b> preço, periodicidade (mensal ou anual), créditos e recursos de cada plano aparecem na página de planos antes da contratação. O pagamento é processado pelo <b>Mercado Pago</b> (Pix ou cartão). O plano é liberado após a confirmação do pagamento.</li>
        <li><b>Renovação:</b> no cartão, a assinatura renova automaticamente na mesma periodicidade até você cancelar. No Pix, o pagamento vale para o período contratado, sem renovação automática.</li>
        <li><b>Preços:</b> podem mudar para novos períodos, com aviso prévio no app. O valor do período já pago não muda.</li>
      </ul>
    </Section>

    <Section title="5. Cancelamento, arrependimento e reembolso">
      <p>Você pode cancelar quando quiser, sem multa. Nas contratações pela internet, você tem <b>7 dias para desistir</b> com devolução integral do valor pago (art. 49 do Código de Defesa do Consumidor). Todas as regras estão na <Link href="/reembolso">Política de Cancelamento e Reembolso</Link>.</p>
    </Section>

    <Section title="6. VIVA no WhatsApp">
      <p>A VIVA no WhatsApp funciona ligada a uma conta criada no site. No plano <b>Free</b>, são até <b>10 mensagens por semana</b> com a VIVA (a contagem recomeça toda segunda-feira, no horário de Brasília); com plano pago ou durante o teste grátis do Pro, o uso segue os créditos do plano, sem esse limite semanal. Ela usa os mesmos créditos e regras do app. Para usar, você também precisa seguir os termos do WhatsApp (Meta). Você pode desconectar a qualquer momento mandando “desconectar” ou pelo app. Quando as mensagens grátis da semana acabam, a VIVA avisa e mostra os planos.</p>
    </Section>

    <Section id="indicacao" title="7. Indique e ganhe">
      <p>Ao indicar um amigo pelo seu link, você ganha 20 créditos e ele ganha 10 quando ele conclui o primeiro acesso (até 10 recompensas em créditos por mês). Além disso, você ganha R$ 10,00 por amigo indicado que assinar e pagar o plano Pro; o teste grátis e outros planos não contam, e cada amigo gera essa recompensa uma única vez. O valor fica &quot;a liberar&quot; por 30 dias após o pagamento do amigo e é cancelado se esse pagamento for estornado, contestado ou cancelado nesse período. O limite é de R$ 200,00 por pessoa por mês. O saque é feito por Pix, a partir de R$ 30,00, para uma chave no nome do titular da conta, e é conferido e pago pela equipe do VIVA+ em até 5 dias úteis. Indicações falsas, contas criadas para si mesmo ou qualquer tentativa de fraude levam ao cancelamento dos valores e podem levar ao bloqueio da conta. A recompensa não é salário nem vínculo de qualquer natureza, e o programa pode ser alterado ou encerrado com aviso no aplicativo, preservando os valores já liberados.</p>
    </Section>

    <Section title="8. Conteúdo que você publica e avaliações">
      <p>Você é responsável pelo que escreve no VIVA+, inclusive avaliações e comentários de lugares em “Perto de mim”, que podem aparecer para outras pessoas com o seu primeiro nome. As avaliações devem refletir uma experiência real: é proibido publicar avaliações falsas, pagas, ofensivas, discriminatórias ou com dados de terceiros. Podemos remover conteúdo que viole estas regras. Nós não criamos, compramos nem alteramos avaliações.</p>
    </Section>

    <Section title="9. Uso proibido">
      <p>É proibido usar o serviço para atividades ilegais, fraudes, tentar acessar contas ou sistemas de outras pessoas, sobrecarregar ou burlar limites técnicos e de créditos, revender o acesso ou copiar o serviço. Podemos suspender ou encerrar contas que violem estes Termos, com aviso quando possível.</p>
    </Section>

    <Section title="10. Propriedade intelectual">
      <p>Marca, nome, logotipo, textos, telas, código e materiais do VIVA+ pertencem ao titular ou a seus licenciantes. As imagens e vídeos usados no site são próprios ou licenciados. Você mantém os direitos sobre os dados que registra e nos autoriza a usá-los só para prestar o serviço, conforme a Política de Privacidade.</p>
    </Section>

    <Section title="11. Disponibilidade e responsabilidade">
      <p>Trabalhamos para manter o serviço disponível e seguro, mas podem ocorrer falhas, manutenções e interrupções, inclusive de fornecedores (internet, WhatsApp, meios de pagamento, inteligência artificial). Nada nestes Termos limita os direitos que você tem pelo Código de Defesa do Consumidor.</p>
    </Section>

    <Section title="12. Exclusão da conta">
      <p>Você pode pedir a exclusão da conta e dos seus dados pelo e-mail <a href={supportEmailUrl("Exclusão de conta - VIVA+")}>{SUPPORT_EMAIL}</a>. Excluir a conta não cancela automaticamente uma assinatura no cartão: cancele a assinatura também (veja a <Link href="/reembolso">Política de Cancelamento</Link>).</p>
    </Section>

    <Section title="13. Mudanças nestes Termos">
      <p>Podemos atualizar estes Termos. Mudanças importantes serão avisadas no app, e pediremos um novo aceite antes de você continuar usando.</p>
    </Section>

    <Section title="14. Lei aplicável e atendimento">
      <p>Aplicam-se as leis do Brasil, em especial o Código de Defesa do Consumidor, a Lei Geral de Proteção de Dados (Lei 13.709/2018), o Marco Civil da Internet (Lei 12.965/2014) e o Decreto 7.962/2013. Fica eleito o foro do domicílio do consumidor. Antes de qualquer medida, fale com a gente: respondemos em até 5 dias úteis. Você também pode usar a plataforma pública <a href="https://www.consumidor.gov.br" target="_blank" rel="noopener noreferrer">consumidor.gov.br</a>.</p>
    </Section>
  </LegalPage>;
}
