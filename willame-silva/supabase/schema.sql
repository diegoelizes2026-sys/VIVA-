-- Willame Silva Imóveis — execute no SQL Editor do Supabase (uma vez).
-- O site acessa o banco só pelo servidor com a service_role key; RLS fica ligado e sem políticas
-- públicas, então ninguém lê leads direto pelo navegador.

create table if not exists empreendimentos (
  id text primary key,
  slug text unique not null,
  nome text not null,
  chamada text default '',
  descricao text default '',
  cidade text default '',
  bairro text default '',
  tipo text default '',
  status text default 'Lançamento',
  preco_a_partir numeric,
  area_min numeric,
  area_max numeric,
  quartos text default '',
  diferenciais jsonb default '[]'::jsonb,
  capa text default '',
  imagens jsonb default '[]'::jsonb,
  video_url text default '',
  endereco_mapa text default '',
  construtora text default '',
  destaque boolean default false,
  publicado boolean default true,
  ordem int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists slides (
  id text primary key,
  sobretitulo text default '',
  titulo text not null,
  subtitulo text default '',
  imagem text default '',
  cta_texto text default '',
  cta_link text default '',
  ordem int default 0,
  ativo boolean default true,
  created_at timestamptz default now()
);

create table if not exists leads (
  id text primary key,
  session_id text unique,
  nome text default '',
  telefone text default '',
  email text default '',
  busca text default '',
  objetivo text default '',
  tipo_imovel text default '',
  regiao text default '',
  empreendimento_interesse text default '',
  orcamento text default '',
  prazo text default '',
  forma_pagamento text default '',
  temperatura text default 'frio',
  pontuacao int default 0,
  etapa text default 'novo',
  origem text default 'site',
  conversa jsonb default '[]'::jsonb,
  notas text default '',
  encaminhado_whatsapp boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists leads_updated_idx on leads (updated_at desc);

create table if not exists configuracoes (
  id int primary key default 1,
  corretor_nome text, creci text, whatsapp text, instagram text, email text,
  regiao_atuacao text, bio text, foto text, manifesto text,
  anos_mercado text, familias_atendidas text, vgv_negociado text,
  agente_nome text, agente_boas_vindas text,
  updated_at timestamptz default now()
);

alter table empreendimentos enable row level security;
alter table slides enable row level security;
alter table leads enable row level security;
alter table configuracoes enable row level security;

-- Bucket público para fotos enviadas pelo painel
insert into storage.buckets (id, name, public) values ('midia', 'midia', true)
on conflict (id) do nothing;
