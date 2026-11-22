-- 0023: lembrete da noite + registro de uso do app (painel do admin).
-- Tudo aditivo: colunas novas com padrão, uma tabela nova e funções novas.

-- 1) Lembrete da noite ------------------------------------------------------
alter table public.viva_notification_settings
  add column if not exists evening_enabled boolean not null default true,
  add column if not exists evening_time time not null default '20:00';

alter table public.viva_notification_deliveries drop constraint if exists viva_notification_deliveries_notification_type_check;
alter table public.viva_notification_deliveries add constraint viva_notification_deliveries_notification_type_check
  check (notification_type in ('morning','agenda','bill','test','evening'));

-- 2) Uso do app: uma linha por pessoa, dia e tela/ação --------------------------
create table if not exists public.viva_app_visits(
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  path text not null check (char_length(path) between 1 and 60),
  hits integer not null default 1,
  last_at timestamptz not null default now(),
  primary key (user_id, day, path)
);
create index if not exists viva_app_visits_day_idx on public.viva_app_visits(day);
alter table public.viva_app_visits enable row level security;
revoke all on public.viva_app_visits from anon, authenticated;

-- Registra uma visita (tela) ou ação ("acao:1-toque"). Só a própria pessoa.
create or replace function public.viva_track_visit(p_path text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_path text := lower(trim(coalesce(p_path, '')));
begin
  if v_uid is null then return; end if;
  if v_path !~ '^[a-z0-9/_:-]{1,60}$' then return; end if;
  insert into public.viva_app_visits(user_id, day, path)
  values (v_uid, (now() at time zone 'America/Sao_Paulo')::date, v_path)
  on conflict (user_id, day, path) do update set hits = public.viva_app_visits.hits + 1, last_at = now();
end $$;
revoke all on function public.viva_track_visit(text) from public, anon;
grant execute on function public.viva_track_visit(text) to authenticated;

-- Números do painel: ativos, novos cadastros, retenção (volta no dia 1 e na 2ª semana) e telas mais usadas.
create or replace function public.viva_admin_usage()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_today date := (now() at time zone 'America/Sao_Paulo')::date; v jsonb;
begin
  if not coalesce(public.viva_is_admin(), false) then raise exception 'forbidden' using errcode = '42501'; end if;
  with signups as (
    select id as user_id, (created_at at time zone 'America/Sao_Paulo')::date as d0 from auth.users
  ), active as (
    select distinct user_id, day from public.viva_app_visits where day >= v_today - 60
  ), d1 as (
    select count(*) filter (where exists (select 1 from active a where a.user_id = s.user_id and a.day = s.d0 + 1)) as back, count(*) as total
    from signups s where s.d0 between v_today - 30 and v_today - 1 and s.d0 >= (select coalesce(min(day), v_today) from public.viva_app_visits)
  ), d7 as (
    select count(*) filter (where exists (select 1 from active a where a.user_id = s.user_id and a.day between s.d0 + 7 and s.d0 + 13)) as back, count(*) as total
    from signups s where s.d0 between v_today - 44 and v_today - 7 and s.d0 >= (select coalesce(min(day), v_today) from public.viva_app_visits)
  )
  select jsonb_build_object(
    'today', v_today,
    'tracking_since', (select min(day) from public.viva_app_visits),
    'active_today', (select count(distinct user_id) from active where day = v_today),
    'active_7d', (select count(distinct user_id) from active where day > v_today - 7),
    'active_30d', (select count(distinct user_id) from active where day > v_today - 30),
    'users_total', (select count(*) from auth.users),
    'd1', (select jsonb_build_object('back', back, 'total', total) from d1),
    'd7', (select jsonb_build_object('back', back, 'total', total) from d7),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', g.day,
        'active', (select count(distinct user_id) from active a where a.day = g.day),
        'new', (select count(*) from signups s where s.d0 = g.day)) order by g.day), '[]'::jsonb)
      from (select generate_series(v_today - 13, v_today, interval '1 day')::date as day) g),
    'top', (select coalesce(jsonb_agg(t order by t.users desc, t.hits desc), '[]'::jsonb) from (
      select path, count(distinct user_id) as users, sum(hits)::int as hits
      from public.viva_app_visits where day > v_today - 7 group by path order by 2 desc, 3 desc limit 15) t)
  ) into v;
  return v;
end $$;
revoke all on function public.viva_admin_usage() from public, anon;
grant execute on function public.viva_admin_usage() to authenticated;
