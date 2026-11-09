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
