-- VIVA+ Saúde e Bem-estar
-- Dados pessoais de saúde: acesso restrito ao próprio titular via RLS.
create table if not exists public.viva_health_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  age integer not null check (age between 13 and 110),
  sex text not null check (sex in ('female','male','other')),
  height_cm numeric(5,2) not null check (height_cm between 100 and 250),
  current_weight_kg numeric(6,2) not null check (current_weight_kg between 25 and 350),
  goal_weight_kg numeric(6,2) check (goal_weight_kg is null or goal_weight_kg between 25 and 350),
  activity_level text not null check (activity_level in ('sedentary','light','moderate','high')),
  water_goal_ml integer not null default 2000 check (water_goal_ml between 500 and 8000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.viva_water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_ml integer not null check (amount_ml between 50 and 2000),
  logged_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.viva_weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weight_kg numeric(6,2) not null check (weight_kg between 25 and 350),
  logged_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.viva_sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sleep_hours numeric(4,2) not null check (sleep_hours between 0.5 and 24),
  sleep_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique(user_id,sleep_date)
);

alter table public.viva_health_profiles enable row level security;
alter table public.viva_water_logs enable row level security;
alter table public.viva_weight_logs enable row level security;
alter table public.viva_sleep_logs enable row level security;

drop policy if exists viva_health_profiles_owner on public.viva_health_profiles;
create policy viva_health_profiles_owner on public.viva_health_profiles for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists viva_water_logs_owner on public.viva_water_logs;
create policy viva_water_logs_owner on public.viva_water_logs for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists viva_weight_logs_owner on public.viva_weight_logs;
create policy viva_weight_logs_owner on public.viva_weight_logs for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists viva_sleep_logs_owner on public.viva_sleep_logs;
create policy viva_sleep_logs_owner on public.viva_sleep_logs for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select,insert,update,delete on public.viva_health_profiles to authenticated;
grant select,insert,update,delete on public.viva_water_logs to authenticated;
grant select,insert,update,delete on public.viva_weight_logs to authenticated;
grant select,insert,update,delete on public.viva_sleep_logs to authenticated;
