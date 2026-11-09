# VIVA+ — projeto preparado para Vercel

Identidade visual: roxo saturado `#7028D8`, amarelo `#FFD43B`, branco acinzentado `#F4F3F6` e cinza `#E4E1E9`.

## Stack
- Next.js 15 + React 19 + TypeScript
- Tailwind CSS 4
- Supabase Auth + PostgreSQL + RLS
- OpenAI Responses API (opcional, via backend)
- Vercel

## Rodar localmente
1. Instale Node.js 20.9+.
2. `npm install`
3. Copie `.env.example` para `.env.local`.
4. Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Execute `supabase/migrations/0001_viva_foundation.sql` no SQL Editor do Supabase.
6. `npm run dev` e abra http://localhost:3000.

## Publicar na Vercel
1. Envie esta pasta para um repositório GitHub.
2. Na Vercel, escolha **Add New → Project** e importe o repositório.
3. Configure as variáveis de ambiente:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `OPENAI_API_KEY` (opcional; somente no servidor)
   - `OPENAI_MODEL` (opcional; padrão `gpt-4.1-mini`)
4. Faça Deploy.
5. No Supabase Auth → URL Configuration, configure Site URL e Redirect URLs para o domínio Vercel, incluindo `/auth/callback`.

**Nunca** exponha `service_role` ou `OPENAI_API_KEY` em variáveis `NEXT_PUBLIC_`.

## O que funciona nesta base
- Landing page responsiva com identidade VIVA+.
- Cadastro, login, recuperação de senha e callback OAuth/e-mail pelo Supabase Auth.
- Área privada com proteção de sessão no servidor/proxy.
- Dashboard Meu Dia com consultas reais de eventos, tarefas e transações.
- Cadastro de compromissos e lançamentos financeiros no Supabase.
- Assistente com endpoint backend protegido por sessão, quando a chave OpenAI estiver configurada.
- Schema PostgreSQL com RLS para os dados privados.

## O que ainda exige configuração/desenvolvimento
- O banco só funciona após executar a migração SQL no seu projeto Supabase.
- O assistente responde sem ler dados privados e não executa operações; ações com confirmação serão uma etapa posterior.
- Pesquisa de preços nacional/regional ainda depende de conectores comerciais autorizados e não está simulada.
- Hábitos, notificações push, cartões/parcelamentos, metas e listas estão com estrutura inicial no banco, mas ainda precisam das telas e fluxos completos.
- Antes de produção: adicionar testes automatizados, rate limiting, auditoria, política de retenção, revisão de segurança e validação LGPD.

Não considerar este pacote como o MVP completo enquanto os itens acima não estiverem implementados e testados.
