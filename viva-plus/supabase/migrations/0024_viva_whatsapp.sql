-- VIVA no WhatsApp: liga o número de WhatsApp da pessoa à conta dela no VIVA+.
create table if not exists public.viva_whatsapp_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wa_id text unique,
  link_code text unique,
  code_expires_at timestamptz,
  linked_at timestamptz,
  history jsonb not null default '[]'::jsonb,
  last_transaction_id uuid,
  last_transaction_at timestamptz,
  last_inbound_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.viva_whatsapp_links enable row level security;
drop policy if exists "viva own whatsapp link" on public.viva_whatsapp_links;
create policy "viva own whatsapp link" on public.viva_whatsapp_links for select using (user_id = (select auth.uid()));

-- Mensagens já recebidas (a Meta pode reenviar a mesma mensagem; processa só uma vez).
create table if not exists public.viva_whatsapp_inbound (
  message_id text primary key,
  wa_id text,
  received_at timestamptz not null default now()
);
alter table public.viva_whatsapp_inbound enable row level security;
