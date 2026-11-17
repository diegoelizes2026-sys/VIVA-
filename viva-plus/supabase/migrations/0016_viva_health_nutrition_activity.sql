-- VIVA+ Saúde - Etapa 2: alimentação e atividade física
-- Registros inseridos voluntariamente pelo titular; acesso isolado por RLS.

create table if not exists public.viva_food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  food_name text not null check (char_length(food_name) between 2 and 120),
  quantity text not null check (char_length(quantity) between 1 and 40),
  calories numeric(7,2) check (calories is null or calories between 0 and 5000),
  protein_g numeric(7,2) check (protein_g is null or protein_g between 0 and 500),
  carbs_g numeric(7,2) check (carbs_g is null or carbs_g between 0 and 1000),
  fat_g numeric(7,2) check (fat_g is null or fat_g between 0 and 500),
  fiber_g numeric(7,2) check (fiber_g is null or fiber_g between 0 and 200),
  logged_on date not null default current_date,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.viva_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null check (activity_type in ('walking','running','gym','cycling','sports','yoga','other')),
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  intensity text not null check (intensity in ('light','moderate','vigorous')),
  notes text check (notes is null or char_length(notes) <= 240),
  logged_on date not null default current_date,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists viva_food_logs_user_day_idx on public.viva_food_logs(user_id, logged_on desc, logged_at desc);
create index if not exists viva_activity_logs_user_day_idx on public.viva_activity_logs(user_id, logged_on desc, logged_at desc);

alter table public.viva_food_logs enable row level security;
alter table public.viva_activity_logs enable row level security;

drop policy if exists viva_food_logs_owner on public.viva_food_logs;
create policy viva_food_logs_owner on public.viva_food_logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists viva_activity_logs_owner on public.viva_activity_logs;
create policy viva_activity_logs_owner on public.viva_activity_logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.viva_food_logs to authenticated;
grant select, insert, update, delete on public.viva_activity_logs to authenticated;
