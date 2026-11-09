# VIVA+ — aplicação inicial

Identidade visual: roxo saturado `#7028D8`, amarelo `#FFD43B` e branco acinzentado `#F4F3F6`.

## Stack
- Next.js 15, React 19 e TypeScript
- Tailwind CSS 4
- Supabase Auth e PostgreSQL com Row Level Security
- Vercel (Node.js 24.x)

## Executar localmente
1. Instale Node.js 24 LTS.
2. Execute `npm install`.
3. Copie `.env.example` para `.env.local`.
4. Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Execute `supabase/migrations/0001_viva_foundation.sql` no SQL Editor do Supabase.
6. Execute `npm run dev` e abra http://localhost:3000.

## Publicar na Vercel
O projeto está configurado para Next.js e Node.js 24.x. Importe este repositório, mantenha Root Directory na raiz e configure as duas variáveis do Supabase em Production e Preview. No Supabase Auth, configure Site URL e Redirect URLs para o domínio Vercel.

## Incluído
- Landing page responsiva com paleta oficial.
- Cadastro/login preparados para Supabase Auth.
- Área inicial autenticada.
- Migração inicial com perfis, tarefas, eventos, transações e RLS.
- Manifest básico para instalação como PWA.

## Próximas implementações
Agenda e finanças ainda precisam de CRUD completo; comparação real de preços, listas inteligentes, notificações e IA não estão implementadas. O banco só funciona após executar a migração e configurar as variáveis. Não publique chaves secretas no GitHub.
