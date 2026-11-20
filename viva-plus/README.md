# VIVA+ — aplicação e identidade visual oficial

Paleta oficial centralizada em `src/app/globals.css`:
- Roxo principal: `#6410C9`
- Branco: `#FFFFFF`
- Cinza-claro: `#E9E9E9`

## Stack
Next.js 15, React 19, TypeScript, Tailwind CSS 4, Supabase Auth/PostgreSQL e Vercel.

## Executar localmente
1. Use Node.js 24.x.
2. Rode `npm install`.
3. Copie `.env.example` para `.env.local` e configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Execute o SQL `supabase/migrations/0001_viva_foundation.sql` no Supabase.
5. Rode `npm run dev`.

## Publicação
Este diretório contém a aplicação Next.js completa. A Vercel deve usar este diretório como Root Directory: `VIVA-PLUS-VERCEL (2)/VIVA-PLUS-VERCEL`, com Node.js 24.x.

## Identidade aplicada
Tokens globais e componentes atualizados para login/cadastro, landing page, navegação responsiva, Meu Dia e Assistente VIVA+. Agenda, finanças, economia e perfil herdam os tokens globais sem alteração de regras de negócio.

## Limites funcionais conhecidos
A pesquisa de preços depende de conectores comerciais reais; tarefas e hábitos têm estrutura inicial de banco, mas não possuem telas completas nesta versão. Não exibir preços simulados. Configure variáveis Supabase na Vercel antes de validar autenticação e dados reais.

## VIVA+ no WhatsApp

A VIVA responde no WhatsApp usando o mesmo assistente do app (mesmas regras, créditos e confirmação antes de salvar). Aceita texto, áudio e foto/PDF de comprovante. Quem chama sem conta recebe o convite de cadastro e fica salvo em `viva_whatsapp_leads` (prospecção).

### Como ativar
1. Rode `supabase/migrations/0021_viva_whatsapp.sql` no SQL Editor do Supabase.
2. No [Meta for Developers](https://developers.facebook.com/), crie um app do tipo *Business*, adicione o produto **WhatsApp** e cadastre o número da VIVA.
3. Na Vercel, configure (Production):
   - `WHATSAPP_TOKEN` – token permanente de um *System User* com permissão `whatsapp_business_messaging`
   - `WHATSAPP_PHONE_NUMBER_ID` – ID do número (WhatsApp → API Setup)
   - `WHATSAPP_APP_SECRET` – App Secret (Configurações do app → Básico)
   - `WHATSAPP_VERIFY_TOKEN` – qualquer senha que você inventar
   - `WHATSAPP_DISPLAY_NUMBER` – o número com DDI e DDD, só dígitos (ex.: `5585999999999`)
   - `NEXT_PUBLIC_APP_URL` – `https://vivamaiss.app.br`
   - `SUPABASE_SERVICE_ROLE_KEY` e `OPENAI_API_KEY` (já usados pelo app)
4. Em WhatsApp → Configuration → Webhook, use a URL `https://vivamaiss.app.br/api/whatsapp/webhook`, o mesmo `WHATSAPP_VERIFY_TOKEN` e assine o campo **messages**.
5. No app, em **Meus dados → VIVA no WhatsApp**, toque em **Conectar**: o WhatsApp abre com um código de 15 minutos; ao enviar, o número fica ligado à conta.

Comandos no WhatsApp: `ajuda` mostra exemplos e `desconectar` desliga o número. Leads: `select * from viva_whatsapp_leads order by created_at desc;`
