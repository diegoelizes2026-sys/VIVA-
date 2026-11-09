# VIVA+ — aplicação inicial

Identidade visual: roxo saturado `#7028D8`, amarelo `#FFD43B` e branco acinzentado `#F4F3F6`.

## Stack
- Next.js 15, React 19 e TypeScript
- Tailwind CSS 4
- Supabase Auth e PostgreSQL com Row Level Security
- Vercel

## Executar localmente
1. Instale Node.js 20.9 ou superior.
2. Execute `npm install`.
3. Copie `.env.example` para `.env.local`.
4. Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` com os dados do projeto Supabase.
5. Execute o SQL de `supabase/migrations/0001_viva_foundation.sql` no SQL Editor do Supabase.
6. Execute `npm run dev` e abra http://localhost:3000.

## Publicar na Vercel
1. Importe este repositório no painel da Vercel.
2. Framework: Next.js; Root Directory: `./`.
3. Configure as duas variáveis públicas do Supabase no ambiente Production e Preview.
4. Faça o deploy.
5. No Supabase Auth, ajuste Site URL e Redirect URLs para o domínio publicado.

## O que já está no repositório
- Landing page responsiva com paleta oficial VIVA+.
- Páginas de cadastro e login ligadas ao Supabase Auth.
- Área inicial autenticada.
- Migração inicial com perfis, tarefas, eventos e transações e políticas RLS.
- Manifest básico para instalação como PWA.

## Limites desta primeira entrega
A agenda e o controle financeiro ainda não possuem todas as telas de CRUD; comparação de preços, listas inteligentes, notificações e IA ainda não estão implementadas. O deploy também depende da configuração do Supabase. Nunca publique chaves secretas no GitHub; use apenas variáveis de ambiente da Vercel.
