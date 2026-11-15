create table if not exists public.viva_family_goals (
 id uuid primary key default gen_random_uuid(),
 family_id uuid not null references public.viva_family_groups(id) on delete cascade,
 created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null check(char_length(title) between 1 and 120),
 target_amount numeric(14,2) not null check(target_amount>0),
 current_amount numeric(14,2) not null default 0 check(current_amount>=0),
 target_date date,
 created_at timestamptz not null default now()
);
alter table public.viva_family_goals enable row level security;
drop policy if exists viva_family_goals_member_read on public.viva_family_goals;
create policy viva_family_goals_member_read on public.viva_family_goals for select to authenticated using(public.viva_is_family_member(family_id));
drop policy if exists viva_family_goals_member_insert on public.viva_family_goals;
create policy viva_family_goals_member_insert on public.viva_family_goals for insert to authenticated with check(public.viva_is_family_member(family_id) and created_by=(select auth.uid()));
drop policy if exists viva_family_goals_manage on public.viva_family_goals;
create policy viva_family_goals_manage on public.viva_family_goals for update to authenticated using(public.viva_is_family_member(family_id) and (created_by=(select auth.uid()) or exists(select 1 from public.viva_family_groups g where g.id=family_id and g.owner_id=(select auth.uid())))) with check(public.viva_is_family_member(family_id) and (created_by=(select auth.uid()) or exists(select 1 from public.viva_family_groups g where g.id=family_id and g.owner_id=(select auth.uid()))));
