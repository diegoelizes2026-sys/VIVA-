create table if not exists public.viva_daily_limits (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
 limit_amount numeric(14,2) not null check(limit_amount>0),
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.viva_habit_logs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 habit_id uuid not null references public.viva_habits(id) on delete cascade,
 completed_on date not null default current_date,
 created_at timestamptz not null default now(),
 unique(habit_id,completed_on)
);
alter table public.viva_daily_limits enable row level security;
alter table public.viva_habit_logs enable row level security;
drop policy if exists viva_daily_limits_owner on public.viva_daily_limits;
create policy viva_daily_limits_owner on public.viva_daily_limits for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists viva_habit_logs_owner on public.viva_habit_logs;
create policy viva_habit_logs_owner on public.viva_habit_logs for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
