-- VIVA+ Etapa C: planos de ação vinculados às metas financeiras existentes.
create table if not exists public.viva_financial_goal_plans (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 goal_id uuid not null references public.viva_financial_goals(id) on delete cascade,
 monthly_target numeric(14,2) not null check (monthly_target >= 0),
 weekly_target numeric(14,2) not null check (weekly_target >= 0),
 remaining_amount numeric(14,2) not null check (remaining_amount >= 0),
 months_remaining integer not null check (months_remaining >= 1),
 steps jsonb not null default '[]'::jsonb,
 status text not null default 'active' check (status in ('active','completed','paused')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,goal_id)
);
alter table public.viva_financial_goal_plans enable row level security;
drop policy if exists viva_goal_plans_owner_all on public.viva_financial_goal_plans;
create policy viva_goal_plans_owner_all on public.viva_financial_goal_plans
 for all to authenticated
 using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
 with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
grant select,insert,update,delete on public.viva_financial_goal_plans to authenticated;
insert into public.viva_finance_ai_feature_flags(flag_key,enabled)
values ('goal_plans',true)
on conflict(flag_key) do update set enabled=true,updated_at=now();
