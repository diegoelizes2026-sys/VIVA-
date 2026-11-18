-- VIVA+ Saúde e Bem-Estar: perfil de saúde e registros diários (água, sono, peso, alimentação, atividade e treinos).
create table if not exists public.viva_health_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 goal text not null default 'saude' check (goal in ('hipertrofia','emagrecimento','condicionamento','saude')),
 trainer text not null default 'mulher' check (trainer in ('mulher','homem')),
 water_goal_ml integer not null default 2000 check (water_goal_ml between 500 and 8000),
 weekly_workouts integer not null default 5 check (weekly_workouts between 1 and 7),
 weekly_activity_min integer not null default 150 check (weekly_activity_min between 10 and 2000),
 target_weight_kg numeric(5,1) check (target_weight_kg is null or target_weight_kg between 20 and 400),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.viva_health_profiles enable row level security;
drop policy if exists viva_health_profiles_owner on public.viva_health_profiles;
create policy viva_health_profiles_owner on public.viva_health_profiles
 for all to authenticated
 using ((select auth.uid()) = user_id)
 with check ((select auth.uid()) = user_id);
grant select,insert,update,delete on public.viva_health_profiles to authenticated;

create table if not exists public.viva_health_logs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('water','sleep','weight','meal','activity','workout')),
 value numeric(10,2) not null default 0 check (value >= 0 and value <= 100000),
 note text check (note is null or char_length(note) <= 500),
 logged_on date not null default ((now() at time zone 'America/Fortaleza')::date),
 created_at timestamptz not null default now()
);
create index if not exists viva_health_logs_user_day on public.viva_health_logs(user_id,logged_on desc);
alter table public.viva_health_logs enable row level security;
drop policy if exists viva_health_logs_owner on public.viva_health_logs;
create policy viva_health_logs_owner on public.viva_health_logs
 for all to authenticated
 using ((select auth.uid()) = user_id)
 with check ((select auth.uid()) = user_id);
grant select,insert,update,delete on public.viva_health_logs to authenticated;
