-- Camila Severiano Imóveis — banco de dados (Supabase)
-- Rode este arquivo inteiro no SQL Editor do Supabase.

create table if not exists public.cs_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists public.cs_properties (
  id text primary key,
  data jsonb not null,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cs_leads (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.cs_settings (
  id text primary key,
  data jsonb not null
);

create or replace function public.cs_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.cs_admins where user_id = auth.uid());
$$;

alter table public.cs_admins     enable row level security;
alter table public.cs_properties enable row level security;
alter table public.cs_leads      enable row level security;
alter table public.cs_settings   enable row level security;

-- Imóveis: público vê só os publicados; admin faz tudo
drop policy if exists "props_public_read" on public.cs_properties;
create policy "props_public_read" on public.cs_properties for select using (published or public.cs_is_admin());
drop policy if exists "props_admin_write" on public.cs_properties;
create policy "props_admin_write" on public.cs_properties for all using (public.cs_is_admin()) with check (public.cs_is_admin());

-- Leads: qualquer visitante pode CRIAR (formulário/assistente); só o admin lê e edita
drop policy if exists "leads_public_insert" on public.cs_leads;
create policy "leads_public_insert" on public.cs_leads for insert with check (
  length(data::text) < 20000 and coalesce(data->>'name','') <> '' and length(coalesce(data->>'phone','')) between 10 and 13
);
drop policy if exists "leads_admin_all" on public.cs_leads;
create policy "leads_admin_all" on public.cs_leads for all using (public.cs_is_admin()) with check (public.cs_is_admin());

-- Configurações: leitura pública (WhatsApp, Instagram), escrita do admin
drop policy if exists "settings_public_read" on public.cs_settings;
create policy "settings_public_read" on public.cs_settings for select using (true);
drop policy if exists "settings_admin_write" on public.cs_settings;
create policy "settings_admin_write" on public.cs_settings for all using (public.cs_is_admin()) with check (public.cs_is_admin());

drop policy if exists "admins_self_read" on public.cs_admins;
create policy "admins_self_read" on public.cs_admins for select using (user_id = auth.uid());

-- Fotos: bucket público para leitura, upload só do admin
insert into storage.buckets (id, name, public) values ('imoveis', 'imoveis', true) on conflict (id) do nothing;
drop policy if exists "imoveis_admin_upload" on storage.objects;
create policy "imoveis_admin_upload" on storage.objects for insert with check (bucket_id = 'imoveis' and public.cs_is_admin());
drop policy if exists "imoveis_admin_delete" on storage.objects;
create policy "imoveis_admin_delete" on storage.objects for delete using (bucket_id = 'imoveis' and public.cs_is_admin());

-- DEPOIS: crie o usuário da Camila em Authentication > Users (e-mail + senha)
-- e rode, trocando o e-mail:
-- insert into public.cs_admins (user_id) select id from auth.users where email = 'email-da-camila@exemplo.com';
