-- VIVA+ no WhatsApp (somente adições).
-- Vincula um número de WhatsApp a uma conta, guarda o fio da conversa e registra contatos novos (leads).
-- As tabelas de apoio só são acessadas pelo servidor (service role); o usuário só lê o próprio vínculo.

create table if not exists public.viva_whatsapp_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wa_id text not null unique,
  profile_name text,
  history jsonb not null default '[]'::jsonb,
  pending jsonb,
  linked_at timestamptz not null default now(),
  last_message_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.viva_whatsapp_links enable row level security;
drop policy if exists viva_whatsapp_links_read_own on public.viva_whatsapp_links;
create policy viva_whatsapp_links_read_own on public.viva_whatsapp_links
  for select to authenticated using (user_id = (select auth.uid()));

-- Códigos de vínculo de uso único (válidos por 15 minutos).
create table if not exists public.viva_whatsapp_link_codes (
  code text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists viva_whatsapp_link_codes_user_idx on public.viva_whatsapp_link_codes(user_id);
alter table public.viva_whatsapp_link_codes enable row level security;

-- Sessão usada pelo servidor para agir em nome do usuário vinculado (sem políticas: só service role).
create table if not exists public.viva_whatsapp_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text,
  expires_at bigint not null,
  updated_at timestamptz not null default now()
);
alter table public.viva_whatsapp_sessions enable row level security;

-- Evita processar a mesma mensagem duas vezes (a Meta pode reenviar).
create table if not exists public.viva_whatsapp_inbound (
  wamid text primary key,
  wa_id text not null,
  received_at timestamptz not null default now()
);
create index if not exists viva_whatsapp_inbound_received_idx on public.viva_whatsapp_inbound(received_at);
alter table public.viva_whatsapp_inbound enable row level security;

-- Pessoas que chamaram a VIVA no WhatsApp sem ter conta (prospecção).
create table if not exists public.viva_whatsapp_leads (
  wa_id text primary key,
  profile_name text,
  first_message text,
  messages_count integer not null default 1,
  converted_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
alter table public.viva_whatsapp_leads enable row level security;
drop policy if exists viva_whatsapp_leads_admin_read on public.viva_whatsapp_leads;
create policy viva_whatsapp_leads_admin_read on public.viva_whatsapp_leads
  for select to authenticated using (public.viva_is_admin());

revoke all on public.viva_whatsapp_link_codes, public.viva_whatsapp_sessions, public.viva_whatsapp_inbound from anon, authenticated;
revoke insert, update, delete on public.viva_whatsapp_links, public.viva_whatsapp_leads from anon, authenticated;
