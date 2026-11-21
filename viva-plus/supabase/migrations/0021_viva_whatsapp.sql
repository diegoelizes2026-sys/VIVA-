-- VIVA+ no WhatsApp: vínculo do número com a conta, códigos de conexão,
-- estado da conversa (histórico + rascunho pendente) e deduplicação de mensagens.

-- Vínculo número ↔ conta. O dono pode ver e desconectar; só o servidor cria.
create table if not exists public.viva_whatsapp_links(
  user_id uuid primary key references auth.users(id) on delete cascade,
  wa_id text not null unique,
  linked_at timestamptz not null default now(),
  last_message_at timestamptz
);
alter table public.viva_whatsapp_links enable row level security;
drop policy if exists viva_whatsapp_links_owner_select on public.viva_whatsapp_links;
create policy viva_whatsapp_links_owner_select on public.viva_whatsapp_links for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists viva_whatsapp_links_owner_delete on public.viva_whatsapp_links;
create policy viva_whatsapp_links_owner_delete on public.viva_whatsapp_links for delete to authenticated using(user_id=(select auth.uid()));
grant select,delete on public.viva_whatsapp_links to authenticated;

-- Códigos de conexão de uso único (15 min). Só o servidor (service role) acessa.
create table if not exists public.viva_whatsapp_link_codes(
  code text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now()+interval '15 minutes'),
  created_at timestamptz not null default now()
);
create index if not exists viva_whatsapp_link_codes_user_idx on public.viva_whatsapp_link_codes(user_id);
alter table public.viva_whatsapp_link_codes enable row level security;

-- Estado da conversa e sessão do robô. Contém tokens: nenhum acesso para usuários.
create table if not exists public.viva_whatsapp_state(
  user_id uuid primary key references auth.users(id) on delete cascade,
  history jsonb not null default '[]'::jsonb,
  pending jsonb,
  session_access_token text,
  session_refresh_token text,
  session_expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.viva_whatsapp_state enable row level security;

-- Deduplicação: a Meta pode reenviar a mesma mensagem.
create table if not exists public.viva_whatsapp_inbox(
  message_id text primary key,
  wa_id text not null,
  received_at timestamptz not null default now()
);
create index if not exists viva_whatsapp_inbox_received_idx on public.viva_whatsapp_inbox(received_at);
alter table public.viva_whatsapp_inbox enable row level security;

revoke all on public.viva_whatsapp_link_codes from anon, authenticated;
revoke all on public.viva_whatsapp_state from anon, authenticated;
revoke all on public.viva_whatsapp_inbox from anon, authenticated;
