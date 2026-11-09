-- VIVA+ MVP 1.0 — esquema inicial. Execute no SQL Editor do Supabase.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text,
 city text,
 state text,
 avatar_url text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.events (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null,
 description text,
 start_at timestamptz not null,
 end_at timestamptz,
 priority text not null default 'normal' check(priority in ('low','normal','high')),
 created_at timestamptz not null default now()
);
create table if not exists public.tasks (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null,
 description text,
 due_at timestamptz,
 priority text not null default 'normal' check(priority in ('low','normal','high')),
 is_done boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists public.habits (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null,
 frequency text not null default 'daily',
 reminder_time time,
 created_at timestamptz not null default now()
);
create table if not exists public.reminders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null,
 remind_at timestamptz not null,
 is_done boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists public.transactions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 kind text not null check(kind in ('income','expense')),
 description text not null,
 amount numeric(14,2) not null check(amount >= 0),
 occurred_on date not null default current_date,
 category text,
 payment_method text,
 created_at timestamptz not null default now()
);
create table if not exists public.budgets (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 category text not null,
 monthly_limit numeric(14,2) not null check(monthly_limit >= 0),
 month date not null,
 created_at timestamptz not null default now(),
 unique(user_id,category,month)
);
create table if not exists public.financial_goals (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null,
 target_amount numeric(14,2) not null check(target_amount > 0),
 current_amount numeric(14,2) not null default 0,
 target_date date,
 created_at timestamptz not null default now()
);
create table if not exists public.shopping_lists (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null default 'Minha lista',
 budget numeric(14,2),
 created_at timestamptz not null default now()
);
create table if not exists public.shopping_list_items (
 id uuid primary key default gen_random_uuid(),
 list_id uuid not null references public.shopping_lists(id) on delete cascade,
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null,
 quantity numeric(12,3) not null default 1,
 is_purchased boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists public.stores (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 address text,
 city text,
 state text,
 phone text,
 website text,
 source_name text,
 created_at timestamptz not null default now()
);
create table if not exists public.products (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 brand text,
 model text,
 image_url text,
 created_at timestamptz not null default now()
);
create table if not exists public.price_observations (
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.products(id) on delete cascade,
 store_id uuid references public.stores(id) on delete set null,
 price numeric(14,2) not null check(price >= 0),
 currency text not null default 'BRL',
 product_url text,
 shipping numeric(14,2),
 observed_at timestamptz not null default now(),
 source_name text not null
);
create table if not exists public.ai_conversations (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text,
 created_at timestamptz not null default now()
);
create table if not exists public.ai_messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 role text not null check(role in ('user','assistant')),
 content text not null,
 created_at timestamptz not null default now()
);

-- RLS: private tables are accessible only by their owner.
do $$
declare t text;
begin
 foreach t in array array['events','tasks','habits','reminders','transactions','budgets','financial_goals','shopping_lists','shopping_list_items','ai_conversations','ai_messages'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists owner_all on public.%I',t);
  execute format('create policy owner_all on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',t);
 end loop;
end $$;

-- profiles uses id rather than user_id.
alter table public.profiles enable row level security;
drop policy if exists profile_owner on public.profiles;
create policy profile_owner on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);

-- Product catalog and price observations are public-readable; writes are reserved for service/admin integrations.
alter table public.products enable row level security;
alter table public.price_observations enable row level security;
alter table public.stores enable row level security;
drop policy if exists products_read on public.products;
create policy products_read on public.products for select using (true);
drop policy if exists prices_read on public.price_observations;
create policy prices_read on public.price_observations for select using (true);
drop policy if exists stores_read on public.stores;
create policy stores_read on public.stores for select using (true);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 insert into public.profiles(id,full_name) values(new.id,new.raw_user_meta_data->>'full_name')
 on conflict(id) do nothing;
 return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
