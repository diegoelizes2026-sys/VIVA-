-- VIVA+ Etapa A: contexto financeiro e decisões de compra.
create table if not exists public.viva_finance_ai_feature_flags(flag_key text primary key check(flag_key in ('finance_context','purchase_decisions','radar','goal_plans')),enabled boolean not null default false,updated_at timestamptz not null default now(),updated_by uuid references auth.users(id) on delete set null);
create table if not exists public.viva_finance_ai_user_access(user_id uuid primary key references auth.users(id) on delete cascade,enabled boolean not null default true,reason text not null default 'test',created_at timestamptz not null default now());
create table if not exists public.viva_finance_ai_preferences(user_id uuid primary key references auth.users(id) on delete cascade,use_financial_data boolean not null default true,updated_at timestamptz not null default now());
create table if not exists public.viva_finance_ai_context_cache(user_id uuid primary key references auth.users(id) on delete cascade,payload jsonb not null,expires_at timestamptz not null,updated_at timestamptz not null default now());
create table if not exists public.viva_finance_ai_decision_cache(user_id uuid not null references auth.users(id) on delete cascade,cache_key text not null,payload jsonb not null,created_at timestamptz not null default now(),primary key(user_id,cache_key));
alter table public.viva_finance_ai_feature_flags enable row level security;
alter table public.viva_finance_ai_user_access enable row level security;
alter table public.viva_finance_ai_preferences enable row level security;
alter table public.viva_finance_ai_context_cache enable row level security;
alter table public.viva_finance_ai_decision_cache enable row level security;
drop policy if exists finance_ai_flags_admin on public.viva_finance_ai_feature_flags;
create policy finance_ai_flags_admin on public.viva_finance_ai_feature_flags for all to authenticated using(public.viva_is_admin()) with check(public.viva_is_admin());
drop policy if exists finance_ai_access_admin on public.viva_finance_ai_user_access;
create policy finance_ai_access_admin on public.viva_finance_ai_user_access for all to authenticated using(public.viva_is_admin()) with check(public.viva_is_admin());
drop policy if exists finance_ai_preferences_owner on public.viva_finance_ai_preferences;
create policy finance_ai_preferences_owner on public.viva_finance_ai_preferences for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists finance_ai_context_owner on public.viva_finance_ai_context_cache;
create policy finance_ai_context_owner on public.viva_finance_ai_context_cache for select to authenticated using(auth.uid()=user_id);
drop policy if exists finance_ai_decision_owner on public.viva_finance_ai_decision_cache;
create policy finance_ai_decision_owner on public.viva_finance_ai_decision_cache for select to authenticated using(auth.uid()=user_id);
insert into public.viva_finance_ai_feature_flags(flag_key,enabled) values('finance_context',true),('purchase_decisions',true),('radar',false),('goal_plans',false) on conflict(flag_key) do nothing;
insert into public.viva_finance_ai_user_access(user_id,enabled,reason) values('4549aa38-82eb-44da-8c7c-50e63959b300',true,'admin-test') on conflict(user_id) do update set enabled=true,reason='admin-test';
create or replace function public.viva_invalidate_finance_ai_context() returns trigger language plpgsql security definer set search_path=public as $$
begin if tg_op='DELETE' then delete from public.viva_finance_ai_context_cache where user_id=old.user_id;return old;end if;delete from public.viva_finance_ai_context_cache where user_id=new.user_id;return new;end;$$;
drop trigger if exists viva_finance_ai_tx_invalidate on public.viva_transactions;
create trigger viva_finance_ai_tx_invalidate after insert or update or delete on public.viva_transactions for each row execute function public.viva_invalidate_finance_ai_context();
drop trigger if exists viva_finance_ai_bills_invalidate on public.viva_bills;
create trigger viva_finance_ai_bills_invalidate after insert or update or delete on public.viva_bills for each row execute function public.viva_invalidate_finance_ai_context();
drop trigger if exists viva_finance_ai_goals_invalidate on public.viva_financial_goals;
create trigger viva_finance_ai_goals_invalidate after insert or update or delete on public.viva_financial_goals for each row execute function public.viva_invalidate_finance_ai_context();
drop trigger if exists viva_finance_ai_limits_invalidate on public.viva_daily_limits;
create trigger viva_finance_ai_limits_invalidate after insert or update or delete on public.viva_daily_limits for each row execute function public.viva_invalidate_finance_ai_context();

-- Leitura de flags e acesso individual, com escrita sempre restrita ao admin ou ao próprio usuário.
drop policy if exists finance_ai_flags_read on public.viva_finance_ai_feature_flags;
create policy finance_ai_flags_read on public.viva_finance_ai_feature_flags for select to authenticated using(true);
drop policy if exists finance_ai_access_self_read on public.viva_finance_ai_user_access;
create policy finance_ai_access_self_read on public.viva_finance_ai_user_access for select to authenticated using(auth.uid()=user_id);
drop policy if exists finance_ai_context_owner on public.viva_finance_ai_context_cache;
drop policy if exists finance_ai_context_owner_write on public.viva_finance_ai_context_cache;
create policy finance_ai_context_owner_write on public.viva_finance_ai_context_cache for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists finance_ai_decision_owner on public.viva_finance_ai_decision_cache;
drop policy if exists finance_ai_decision_owner_write on public.viva_finance_ai_decision_cache;
create policy finance_ai_decision_owner_write on public.viva_finance_ai_decision_cache for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
