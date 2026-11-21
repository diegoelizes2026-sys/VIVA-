# VIVA+ no WhatsApp

A pessoa conversa com a VIVA por um número de WhatsApp e ela faz o mesmo que o chat do app:
anota gastos e receitas, lê **foto ou PDF de comprovante**, entende **áudio**, marca compromissos,
cadastra contas a pagar, mexe na lista de compras e responde perguntas. Antes de salvar
qualquer coisa, ela mostra um resumo com os botões **✅ Salvar** e **❌ Cancelar**.

Os créditos de IA, os limites e as regras de segurança são os mesmos do app, porque o robô usa a
mesma assistente (`/api/assistant`) já autenticado como o usuário.

## Como o usuário conecta
1. No app: **Configurações > Notificações > Conectar WhatsApp**.
2. O WhatsApp abre com uma mensagem pronta contendo um código `VIVA-XXXXXX` (vale 15 min). É só enviar.
3. Pronto: aquele número fica ligado à conta. Para sair, ele toca em **Desconectar** no app ou manda `desconectar` no WhatsApp.

## Passo a passo na Meta (uma vez só)
1. Acesse **developers.facebook.com** → **Meus apps** → **Criar app** → tipo **Empresa** (Business).
2. No app criado, adicione o produto **WhatsApp**. Em **WhatsApp > Configuração da API** você vê:
   - um **número de teste** (dá para testar com até 5 números cadastrados como destinatários);
   - o **Phone Number ID** → `WHATSAPP_PHONE_NUMBER_ID`;
   - um **token temporário** (dura 24h, serve só para testar).
3. **Token permanente**: em business.facebook.com → **Configurações do negócio > Usuários do sistema** →
   crie um usuário **Admin** → **Gerar token** para este app, com as permissões
   `whatsapp_business_messaging` e `whatsapp_business_management` → `WHATSAPP_TOKEN`.
4. **Chave secreta do app**: **Configurações do app > Básico > Chave secreta do app** → `WHATSAPP_APP_SECRET`.
5. Invente uma senha qualquer para o webhook (ex.: `viva-zap-2026-xyz`) → `WHATSAPP_VERIFY_TOKEN`.
6. Cadastre as variáveis na Vercel (abaixo) e faça o deploy.
7. Em **WhatsApp > Configuração > Webhook**:
   - URL de retorno: `https://SEU-DOMINIO/api/whatsapp/webhook`
   - Token de verificação: o mesmo de `WHATSAPP_VERIFY_TOKEN`
   - Clique em **Verificar e salvar** e depois **assine o campo `messages`**.
8. Para valer de verdade: adicione o **número oficial da VIVA** (um chip que **não** esteja em uso no
   app do WhatsApp), verifique a empresa e aguarde a aprovação do **nome de exibição** "VIVA+".

## Variáveis de ambiente (Vercel → Settings → Environment Variables)
| Variável | O que é |
|---|---|
| `WHATSAPP_TOKEN` | Token permanente do usuário do sistema |
| `WHATSAPP_PHONE_NUMBER_ID` | ID do número (não é o telefone) |
| `WHATSAPP_APP_SECRET` | Chave secreta do app, usada para validar que a mensagem veio da Meta |
| `WHATSAPP_VERIFY_TOKEN` | Senha que você inventou para o webhook |
| `WHATSAPP_DISPLAY_NUMBER` | Telefone da VIVA com DDI, ex.: `5585999999999` (o botão do app só aparece com isso preenchido) |
| `NEXT_PUBLIC_APP_URL` | Endereço do app, ex.: `https://vivamais.app`, usado nos links enviados no WhatsApp |
| `SUPABASE_SERVICE_ROLE_KEY` | Já existente, e obrigatória para o robô |

## Banco de dados
Rode `supabase/migrations/0021_viva_whatsapp.sql` no SQL Editor do Supabase.

## Custos
Pela regra atual da Meta, as respostas enviadas dentro de 24h depois de uma mensagem do cliente não
são cobradas. Mensagens que a VIVA iniciar por conta própria (lembretes, resumo da manhã) exigem
modelos aprovados e são cobradas por mensagem. Isso fica para uma próxima etapa. Confira a tabela de
preços da Meta antes de ativar.

## Arquivos
- `src/app/api/whatsapp/webhook/route.ts`: recebe as mensagens (valida a assinatura e responde 200 na hora)
- `src/lib/whatsapp/handler.ts`: conversa, rascunhos com Salvar/Cancelar, áudio e comprovantes
- `src/lib/whatsapp/session.ts`: sessão do usuário para as regras de segurança (RLS) valerem
- `src/lib/whatsapp/api.ts`: envio de mensagens, botões e download de mídia
- `src/app/api/whatsapp/link/route.ts` + `src/components/whatsapp-connect.tsx`: conectar e desconectar no app
