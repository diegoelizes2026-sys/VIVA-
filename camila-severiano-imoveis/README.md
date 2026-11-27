# Camila Severiano Imóveis: site, assistente IA e painel com CRM

Site da corretora **Camila Severiano** (@camilaseveriano_imoveis), especialista no Aquiraz Riviera.
É um site estático (HTML, CSS e JS puros), sem build: abre direto no navegador e pode ser publicado em qualquer hospedagem.

## O que tem
- **Site** (`index.html`): hero com busca, filtros (tipo, região, preço, quartos, texto, ordenação), cards e ficha completa do imóvel com galeria, regiões (Aquiraz Riviera, Eusébio, Porto das Dunas, Caponga, Aquiraz), "Sobre", método de trabalho e formulário de contato.
- **Assistente IA "Aurora"** (botão flutuante): entende pedidos em linguagem natural, como *"casa com 3 quartos no Eusébio até 900 mil"*, e pergunta só o que falta. Também responde dúvidas sobre financiamento, visita, permuta, documentação e venda. Busca os imóveis mais compatíveis (amplia a busca sozinha quando não acha nada exato), pontua o lead, salva no CRM e abre o **WhatsApp da corretora** com a mensagem pronta.
- **Painel** (`admin.html`, ou "Área da corretora" no rodapé):
  - Visão geral: leads quentes, leads da semana, imóveis ativos com VGV, taxa de conversão, funil, follow-ups, origem e regiões mais procuradas.
  - CRM: funil arrastável (Novo, Em contato, Visita, Proposta, Fechado, Perdido), lista, busca, filtro por temperatura e exportação para CSV (Excel). Cada lead tem pontuação, histórico, anotações, data de follow-up e mensagens prontas de WhatsApp.
  - Imóveis: cadastrar, editar, publicar/despublicar, destacar e excluir; status Disponível/Reservado/Vendido; upload de várias fotos com compressão automática, capa e reordenação.
  - Configurações: WhatsApp, CRECI, Instagram, e-mail, nome da assistente, backup/restauração e troca de senha.
- **Identidade visual**: azul-noite e ouro metálico. Monograma **CS** com telhado, chaminé e janela sobre o C (`assets/img/logo-mark.svg`), logo completa para fundo claro (`logo.svg`) e escuro (`logo-light.svg`), e favicon. O hero mostra um pôr do sol no litoral desenhado em código, com mar, coqueiros e casa moderna iluminada.

## Antes de publicar
1. Em `assets/js/config.js`, troque **WhatsApp**, **CRECI** e **e-mail** (ou altere depois em Configurações no painel).
2. Fotos da Camila:
   - `assets/img/camila-retrato.jpg`: retrato vertical em boa resolução (de pé, de frente). Aparece inteiro, com o fundo original, à direita do hero.
   - `assets/img/camila.jpg`: retrato vertical para a seção "Sobre mim".
   - `assets/img/hero-bg.jpg` e `hero-bg-mobile.jpg`: fotografia de fundo do hero (litoral ao pôr do sol e mansão com piscina). Troque por fotos próprias quando quiser.
3. Os 8 imóveis que vêm no site são **exemplos**. Exclua e cadastre os reais pelo painel.

## Modo local x nuvem (importante)
- **Sem configurar nada (modo local):** o painel salva no navegador em que é usado. Serve para testar e apresentar, mas o que você cadastra só aparece nesse navegador, e os leads de visitantes vão direto para o WhatsApp sem chegar ao CRM.
- **Com Supabase (produção, plano gratuito):** imóveis, fotos e leads ficam na nuvem, aparecem para todos e o CRM recebe os leads de qualquer visitante.
  1. Crie um projeto em supabase.com.
  2. Abra o **SQL Editor** e rode `supabase/schema.sql`.
  3. Em **Authentication > Users**, crie o usuário da Camila (e-mail e senha). Depois rode a linha `insert into public.cs_admins ...` do final do SQL, com o e-mail dela.
  4. Em **Authentication > Sign In / Providers**, desative "Allow new users to sign up".
  5. Copie a *Project URL* e a *anon/publishable key* para `supabase.url` e `supabase.anonKey` em `config.js`.
  6. Entre no painel com e-mail e senha. Em Configurações > "Restaurar backup", você pode importar o que cadastrou no modo local.

## Publicar (Vercel)
Importe o repositório na Vercel, defina **Root Directory = `camila-severiano-imoveis`** e Framework **Other**. Não há comando de build. Também funciona em Netlify, GitHub Pages ou Hostinger: basta enviar a pasta.

## Testar localmente
```bash
cd camila-severiano-imoveis && python3 -m http.server 8080
```
Abra http://localhost:8080 (site) e http://localhost:8080/admin.html (painel).
