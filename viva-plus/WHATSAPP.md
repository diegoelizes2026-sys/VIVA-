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

## Caminho principal: 360dialog (parceiro oficial da Meta)
Não precisa de conta de desenvolvedor na Meta. O formato das mensagens é o mesmo da API oficial.

1. Crie a conta em **https://hub.360dialog.com** (cadastro com e-mail).
2. No painel, conecte o número: abre uma janela da Meta (login no Facebook), você cria ou escolhe
   o portfólio empresarial, digita o **número da VIVA** (um chip que **não** esteja no app do WhatsApp)
   e confirma o código por SMS ou ligação.
3. No número conectado, gere a **API Key** → `D360_API_KEY`.
4. Cadastre as variáveis na Vercel (tabela abaixo) e faça o redeploy.
5. Logado no app como **administrador**, abra `https://SEU-APP/api/whatsapp/setup`.
   Isso cadastra o webhook na 360dialog com o cabeçalho secreto. Deve aparecer `"ok": true`.
6. Teste: no app, **Configurações > Notificações > Conectar WhatsApp**.

### Variáveis (360dialog)
| Variável | O que é |
|---|---|
| `D360_API_KEY` | API Key do número, gerada no painel da 360dialog |
| `WHATSAPP_WEBHOOK_SECRET` | Senha longa que você inventa (ex.: 30 letras e números). Valida que a mensagem veio da 360dialog |
| `WHATSAPP_DISPLAY_NUMBER` | Telefone da VIVA com DDI, ex.: `5585999999999` (o botão do app só aparece com isso preenchido) |
| `NEXT_PUBLIC_APP_URL` | Endereço do app, ex.: `https://vivamais.app` |
| `SUPABASE_SERVICE_ROLE_KEY` | Já existente, e obrigatória para o robô |

## Caminho alternativo: Meta direto (sem mensalidade de parceiro)
Use **ou** a 360dialog **ou** a Meta direto. Se `D360_API_KEY` estiver preenchida, o app usa a 360dialog.

1. Acesse **developers.facebook.com** → **Meus apps** → **Criar app** → caso de uso "Conectar-se com clientes pelo WhatsApp".
2. Em **WhatsApp > Configuração da API**: anote o **Phone Number ID** e gere um token.
3. Token permanente: business.facebook.com → **Usuários do sistema** → Admin → **Gerar token**
   (`whatsapp_business_messaging`, `whatsapp_business_management`).
4. **Configurações do app > Básico > Chave secreta do app**.
5. Webhook: `https://SEU-APP/api/whatsapp/webhook`, token de verificação = `WHATSAPP_VERIFY_TOKEN`, assinar `messages`.

| Variável | O que é |
|---|---|
| `WHATSAPP_TOKEN` | Token permanente do usuário do sistema |
| `WHATSAPP_PHONE_NUMBER_ID` | ID do número (não é o telefone) |
| `WHATSAPP_APP_SECRET` | Chave secreta do app (valida a assinatura da Meta) |
| `WHATSAPP_VERIFY_TOKEN` | Senha que você inventou para o webhook |
| `WHATSAPP_DISPLAY_NUMBER`, `NEXT_PUBLIC_APP_URL` | Iguais aos da 360dialog |

## Banco de dados
Rode `supabase/migrations/0021_viva_whatsapp.sql` no SQL Editor do Supabase.

## Custos
A 360dialog cobra uma mensalidade fixa por número (veja https://360dialog.com/pricing) e repassa as taxas da Meta sem acréscimo. Pela regra atual da Meta, as respostas enviadas dentro de 24h depois de uma mensagem do cliente não
são cobradas. Mensagens que a VIVA iniciar por conta própria (lembretes, resumo da manhã) exigem
modelos aprovados e são cobradas por mensagem. Isso fica para uma próxima etapa. Confira a tabela de
preços da Meta antes de ativar.

## Arquivos
- `src/app/api/whatsapp/webhook/route.ts`: recebe as mensagens (valida a assinatura e responde 200 na hora)
- `src/lib/whatsapp/handler.ts`: conversa, rascunhos com Salvar/Cancelar, áudio e comprovantes
- `src/lib/whatsapp/session.ts`: sessão do usuário para as regras de segurança (RLS) valerem
- `src/lib/whatsapp/api.ts`: envio de mensagens, botões e download de mídia (360dialog ou Meta direto)
- `src/app/api/whatsapp/setup/route.ts`: cadastra o webhook na 360dialog (só administrador)
- `src/app/api/whatsapp/link/route.ts` + `src/components/whatsapp-connect.tsx`: conectar e desconectar no app
