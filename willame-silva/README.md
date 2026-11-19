# Willame Silva · Corretor de Imóveis

Site do corretor com vitrine de empreendimentos, painel administrativo com CRM e o **Agente 24h**: um assistente que conversa com o visitante, filtra o lead, salva tudo no CRM e entrega o cliente no WhatsApp do corretor já com o resumo do que ele procura.

## O que tem

| Área | O que faz |
|---|---|
| **Site** (`/`) | Carrossel em tela cheia, busca que alimenta o Agente 24h, vitrine com filtros, página do corretor, método, contato |
| **Empreendimento** (`/empreendimentos/[slug]`) | Capa, ficha técnica, diferenciais, galeria com lightbox, vídeo, mapa, formulário "receber tabela" |
| **Agente 24h** (bolinha no canto) | Conversa com Claude, qualifica (objetivo, tipo, região, orçamento, prazo, pagamento), pede nome + WhatsApp, mostra empreendimentos que combinam e gera o botão para chamar o corretor |
| **Painel** (`/admin`) | Visão geral com KPIs, **CRM em kanban** (arrasta entre etapas), lista de leads com busca/exportação CSV, conversa completa de cada lead, cadastro de empreendimentos, editor do carrossel, configurações (WhatsApp, CRECI, bio, textos do agente) |

## Variáveis de ambiente

| Variável | Para quê |
|---|---|
| `ADMIN_PASSWORD` | Senha do painel `/admin` (obrigatória em produção) |
| `ADMIN_SECRET` | Texto aleatório longo para assinar a sessão do painel |
| `ANTHROPIC_API_KEY` | Liga a IA do Agente 24h. Sem ela o agente funciona em **modo roteiro** (perguntas prontas, mesma qualificação) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Banco de dados definitivo. Sem eles os dados ficam num arquivo temporário (bom para testar, **não** para produção) |

## Ativar o banco (Supabase)

1. Crie um projeto em supabase.com.
2. No **SQL Editor**, rode `supabase/schema.sql`.
3. Em *Project Settings → API*, copie a URL e a `service_role` key para as variáveis da Vercel.
4. Faça um redeploy, entre no painel e toque em **Importar exemplos** (ou cadastre do zero).

## Rodar localmente

```bash
npm install
npm run dev
```

Painel em http://localhost:3000/admin — em desenvolvimento, sem `ADMIN_PASSWORD`, a senha é `willame`.

## Conteúdo de exemplo

Os empreendimentos iniciais (Lagoar, Moradas, Terra Brasilis, Eco Residencial) e as fotos são **ilustrativos**: revise textos, cidades, status e troque as imagens pelas oficiais no painel. Nenhum preço foi inventado — tudo aparece como "sob consulta" até ser preenchido. Os números do corretor (anos, famílias, VGV) só aparecem no site depois de preenchidos em Configurações.

## Stack

Next.js 15 · React 19 · Tailwind CSS 4 · Supabase · Claude (Anthropic SDK) · Vercel
