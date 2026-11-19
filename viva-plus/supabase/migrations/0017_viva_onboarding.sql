-- VIVA+ — Experiência inteligente de primeiro acesso
-- Onboarding conversacional (financeiro e Personal), perfil financeiro estruturado (memória do usuário),
-- campos do Personal no perfil de saúde existente e indicadores administrativos.
-- Somente adições. Dados financeiros e de saúde ficam em tabelas separadas.

-- 1. Sessões de onboarding (uma por usuário e tipo) — salvamento automático e retomada.
create table if not exists public.viva_onboarding (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('finance','personal')),
  status text not null default 'in_progress' check (status in ('in_progress','completed','skipped')),
  step text,
  answers jsonb not null default '{}'::jsonb,
  skipped_questions text[] not null default '{}',
  summary jsonb not null default '{}'::jsonb,
  consent_at timestamptz,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  applied_at timestamptz,
  pro_offer_shown_at timestamptz,
  legacy boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind),
  constraint viva_onboarding_answers_size check (pg_column_size(answers) < 20000)
);
alter table public.viva_onboarding enable row level security;
drop policy if exists viva_onboarding_owner on public.viva_onboarding;
create policy viva_onboarding_owner on public.viva_onboarding for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists viva_onboarding_admin_read on public.viva_onboarding;
create policy viva_onboarding_admin_read on public.viva_onboarding for select to authenticated using (public.viva_is_admin());
revoke all on public.viva_onboarding from anon;
grant select, insert, update, delete on public.viva_onboarding to authenticated;

-- 2. Perfil financeiro estruturado (memória contextual do assistente financeiro).
create table if not exists public.viva_finance_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_income numeric(14,2) check (monthly_income is null or monthly_income between 0 and 100000000),
  income_type text check (income_type in ('fixed','variable','mixed')),
  income_min numeric(14,2) check (income_min is null or income_min >= 0),
  income_max numeric(14,2) check (income_max is null or income_max >= 0),
  work_type text check (work_type in ('clt','servidor','autonomo','empreendedor','desempregado','aposentado','estudante','outro')),
  has_other_income boolean,
  other_income_amount numeric(14,2) check (other_income_amount is null or other_income_amount >= 0),
  monthly_expenses numeric(14,2) check (monthly_expenses is null or monthly_expenses >= 0),
  housing_cost numeric(14,2) check (housing_cost is null or housing_cost >= 0),
  food_cost numeric(14,2) check (food_cost is null or food_cost >= 0),
  transport_cost numeric(14,2) check (transport_cost is null or transport_cost >= 0),
  main_expenses text[] not null default '{}',
  has_debts boolean,
  debt_total numeric(14,2) check (debt_total is null or debt_total >= 0),
  has_overdue boolean,
  debt_types text[] not null default '{}',
  debt_payment_capacity numeric(14,2) check (debt_payment_capacity is null or debt_payment_capacity >= 0),
  main_difficulty text check (main_difficulty is null or char_length(main_difficulty) <= 300),
  goals text[] not null default '{}',
  purchase_goal text check (purchase_goal is null or char_length(purchase_goal) <= 120),
  purchase_amount numeric(14,2) check (purchase_amount is null or purchase_amount > 0),
  -- 'confirmed' | 'estimated' | 'unknown' por campo
  certainty jsonb not null default '{}'::jsonb,
  focus text check (focus in ('debts','spending','variable','saving','organize')),
  diagnosis jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.viva_finance_profiles enable row level security;
drop policy if exists viva_finance_profiles_owner on public.viva_finance_profiles;
create policy viva_finance_profiles_owner on public.viva_finance_profiles for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.viva_finance_profiles from anon;
grant select, insert, update, delete on public.viva_finance_profiles to authenticated;

-- 3. Personal: campos do diagnóstico no perfil de saúde existente.
alter table public.viva_health_profiles
  add column if not exists practices_exercise boolean,
  add column if not exists experience_level text check (experience_level in ('iniciante','intermediario','avancado')),
  add column if not exists train_location text check (train_location in ('casa','academia','ar_livre','misto')),
  add column if not exists session_minutes integer check (session_minutes is null or session_minutes between 10 and 240),
  add column if not exists limitations text check (limitations is null or char_length(limitations) <= 500),
  add column if not exists personal_onboarded_at timestamptz;

-- 4. Operação gratuita: o diagnóstico do onboarding nunca consome créditos.
insert into public.viva_credit_operations(key,label,description,credits,pro_only,sort)
values ('onboarding_diagnosis','Diagnóstico inicial','Resumo do diagnóstico de primeiro acesso. Nunca é cobrado.',0,false,110)
on conflict (key) do nothing;

-- 5. Usuários que já usavam o app não são forçados ao onboarding (podem iniciá-lo quando quiserem).
insert into public.viva_onboarding(user_id, kind, status, legacy, started_at)
select p.id, 'finance', 'skipped', true, now() from public.viva_profiles p
where p.terms_accepted_at is not null
on conflict (user_id, kind) do nothing;

-- 6. Indicadores administrativos (dados agregados; nada individual sobre finanças ou saúde).
create or replace function public.viva_admin_onboarding_overview(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 3650))); v jsonb;
begin
  if not public.viva_is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  with signups as (select p.id, p.created_at from public.viva_profiles p where p.terms_accepted_at is not null and p.created_at >= v_since),
       fin as (select * from public.viva_onboarding where kind = 'finance' and not legacy and started_at >= v_since),
       per as (select * from public.viva_onboarding where kind = 'personal' and started_at >= v_since),
       conv as (select distinct s.user_id from public.viva_subscriptions s
                join public.viva_credit_wallets w on w.user_id = s.user_id
                where s.plan_id <> 'free' and s.status in ('active','canceled') and s.current_period_start is not null
                  and s.created_at >= v_since and s.created_at > w.created_at),
       onboard_credits as (select coalesce(sum(-l.amount),0) c from public.viva_credit_ledger l join fin f on f.user_id = l.user_id
                where l.kind = 'consumption' and l.created_at between f.started_at and coalesce(f.completed_at, now())),
       cost as (select count(distinct user_id) u, coalesce(sum(cost_brl),0) c from public.viva_usage_log where created_at >= v_since),
       goals as (select g, count(*) n from public.viva_finance_profiles fp, unnest(fp.goals) g group by g),
       focus as (select focus, count(*) n from public.viva_finance_profiles where focus is not null group by focus),
       daily as (select d::date as dia,
                   (select count(*) from signups s where s.created_at::date = d::date) signups,
                   (select count(*) from fin f where f.completed_at::date = d::date) completed
                 from generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') d)
  select jsonb_build_object(
    'days', p_days,
    'signups', (select count(*) from signups),
    'started', (select count(*) from fin),
    'completed', (select count(*) from fin where status = 'completed'),
    'skipped', (select count(*) from fin where status = 'skipped'),
    'in_progress', (select count(*) from fin where status = 'in_progress'),
    'abandoned', (select count(*) from fin where status = 'in_progress' and updated_at < now() - interval '24 hours'),
    'abandon_rate', case when (select count(*) from fin) = 0 then 0 else round(100.0 * (select count(*) from fin where status = 'skipped' or (status = 'in_progress' and updated_at < now() - interval '24 hours')) / (select count(*) from fin), 1) end,
    'personal_completed', (select count(*) from per where status = 'completed'),
    'free_users', (select count(*) from public.viva_credit_wallets where plan_id = 'free'),
    'pro_users', (select count(*) from public.viva_credit_wallets where plan_id <> 'free'),
    'conversions', (select count(*) from conv),
    'conversion_rate', case when (select count(*) from signups) = 0 then 0 else round(100.0 * (select count(*) from conv) / (select count(*) from signups), 1) end,
    'onboarding_credits', (select c from onboard_credits),
    'ai_cost_per_user_brl', case when (select u from cost) = 0 then 0 else round((select c from cost) / (select u from cost), 4) end,
    'top_goals', coalesce((select jsonb_agg(jsonb_build_object('goal', g, 'users', n) order by n desc) from goals), '[]'::jsonb),
    'focus', coalesce((select jsonb_object_agg(focus, n) from focus), '{}'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', dia, 'signups', signups, 'completed', completed) order by dia) from daily), '[]'::jsonb)
  ) into v;
  return v;
end $$;
revoke all on function public.viva_admin_onboarding_overview(integer) from public, anon;
grant execute on function public.viva_admin_onboarding_overview(integer) to authenticated;
