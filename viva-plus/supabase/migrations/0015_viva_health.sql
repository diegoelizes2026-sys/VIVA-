-- VIVA+ Saúde e Bem-Estar (Personal): complementa as tabelas de saúde já existentes
-- (viva_health_profiles, viva_water_logs, viva_sleep_logs, viva_weight_logs, viva_food_logs, viva_activity_logs).
-- Somente adições: nenhuma coluna ou registro existente é removido.

-- Perfil: objetivo do treino, personal escolhido e metas semanais.
alter table public.viva_health_profiles
  add column if not exists goal text not null default 'saude',
  add column if not exists trainer text not null default 'mulher',
  add column if not exists weekly_workouts integer not null default 5,
  add column if not exists weekly_activity_min integer not null default 150;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='viva_health_profiles_goal_check') then
    alter table public.viva_health_profiles add constraint viva_health_profiles_goal_check check (goal in ('hipertrofia','emagrecimento','condicionamento','saude'));
  end if;
  if not exists (select 1 from pg_constraint where conname='viva_health_profiles_trainer_check') then
    alter table public.viva_health_profiles add constraint viva_health_profiles_trainer_check check (trainer in ('mulher','homem'));
  end if;
  if not exists (select 1 from pg_constraint where conname='viva_health_profiles_weekly_workouts_check') then
    alter table public.viva_health_profiles add constraint viva_health_profiles_weekly_workouts_check check (weekly_workouts between 1 and 7);
  end if;
  if not exists (select 1 from pg_constraint where conname='viva_health_profiles_weekly_activity_min_check') then
    alter table public.viva_health_profiles add constraint viva_health_profiles_weekly_activity_min_check check (weekly_activity_min between 10 and 2000);
  end if;
end $$;

-- Os dados corporais passam a ser opcionais, para o usuário começar a usar o Personal sem preencher tudo.
alter table public.viva_health_profiles
  alter column age drop not null,
  alter column sex drop not null,
  alter column height_cm drop not null,
  alter column current_weight_kg drop not null,
  alter column activity_level drop not null;

-- Treinos concluídos do plano semanal do Personal.
create table if not exists public.viva_workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  focus text not null check (char_length(focus) between 1 and 120),
  duration_minutes integer not null check (duration_minutes between 1 and 600),
  logged_on date not null default ((now() at time zone 'America/Fortaleza')::date),
  created_at timestamptz not null default now()
);
create index if not exists viva_workout_logs_user_day on public.viva_workout_logs(user_id, logged_on desc);
alter table public.viva_workout_logs enable row level security;
drop policy if exists viva_workout_logs_owner on public.viva_workout_logs;
create policy viva_workout_logs_owner on public.viva_workout_logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.viva_workout_logs to authenticated;
