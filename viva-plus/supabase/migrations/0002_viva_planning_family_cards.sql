-- VIVA+ planning features: credit cards and shared household finances
create table if not exists public.viva_credit_cards (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check(char_length(name) between 1 and 100), brand text not null default 'Outro',
 credit_limit numeric(14,2) not null default 0 check(credit_limit>=0), current_balance numeric(14,2) not null default 0 check(current_balance>=0),
 closing_day integer not null default 1 check(closing_day between 1 and 31), due_day integer not null default 10 check(due_day between 1 and 31),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.viva_card_purchases (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 card_id uuid not null references public.viva_credit_cards(id) on delete cascade, description text not null,
 amount numeric(14,2) not null check(amount>0), purchase_date date not null default current_date,
 installments integer not null default 1 check(installments between 1 and 120), created_at timestamptz not null default now()
);
create table if not exists public.viva_family_groups (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check(char_length(name) between 1 and 100), invite_code text not null unique default upper(substr(encode(gen_random_bytes(8),'hex'),1,10)),
 created_at timestamptz not null default now()
);
create table if not exists public.viva_family_members (
 id uuid primary key default gen_random_uuid(), family_id uuid not null references public.viva_family_groups(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, role text not null default 'member' check(role in ('owner','member')),
 created_at timestamptz not null default now(), unique(family_id,user_id)
);
create table if not exists public.viva_family_expenses (
 id uuid primary key default gen_random_uuid(), family_id uuid not null references public.viva_family_groups(id) on delete cascade,
 created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
 description text not null check(char_length(description) between 1 and 200), amount numeric(14,2) not null check(amount>0),
 category text not null default 'Outros', expense_date date not null default current_date,
 responsible_user_id uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
alter table public.viva_credit_cards enable row level security;
alter table public.viva_card_purchases enable row level security;
alter table public.viva_family_groups enable row level security;
alter table public.viva_family_members enable row level security;
alter table public.viva_family_expenses enable row level security;
drop policy if exists viva_credit_cards_owner on public.viva_credit_cards;
create policy viva_credit_cards_owner on public.viva_credit_cards for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists viva_card_purchases_owner on public.viva_card_purchases;
create policy viva_card_purchases_owner on public.viva_card_purchases for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create or replace function public.viva_is_family_member(p_family_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.viva_family_members m where m.family_id=p_family_id and m.user_id=(select auth.uid())); $$;
revoke all on function public.viva_is_family_member(uuid) from public;
grant execute on function public.viva_is_family_member(uuid) to authenticated;
drop policy if exists viva_family_groups_member_read on public.viva_family_groups;
create policy viva_family_groups_member_read on public.viva_family_groups for select to authenticated using(public.viva_is_family_member(id) or owner_id=(select auth.uid()));
drop policy if exists viva_family_groups_owner_insert on public.viva_family_groups;
create policy viva_family_groups_owner_insert on public.viva_family_groups for insert to authenticated with check(owner_id=(select auth.uid()));
drop policy if exists viva_family_groups_owner_update on public.viva_family_groups;
create policy viva_family_groups_owner_update on public.viva_family_groups for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
drop policy if exists viva_family_members_read on public.viva_family_members;
create policy viva_family_members_read on public.viva_family_members for select to authenticated using(public.viva_is_family_member(family_id) or user_id=(select auth.uid()));
drop policy if exists viva_family_members_owner_insert on public.viva_family_members;
create policy viva_family_members_owner_insert on public.viva_family_members for insert to authenticated with check(user_id=(select auth.uid()) and (role='member' or exists(select 1 from public.viva_family_groups g where g.id=family_id and g.owner_id=(select auth.uid()))));
drop policy if exists viva_family_expenses_member_all on public.viva_family_expenses;
create policy viva_family_expenses_member_all on public.viva_family_expenses for all to authenticated using(public.viva_is_family_member(family_id)) with check(public.viva_is_family_member(family_id) and created_by=(select auth.uid()));
create or replace function public.viva_join_family(p_code text)
returns uuid language plpgsql security definer set search_path=''
as $$ declare v_family_id uuid; begin
 if auth.uid() is null then raise exception 'Faça login para entrar no grupo.'; end if;
 select id into v_family_id from public.viva_family_groups where invite_code=upper(trim(p_code));
 if v_family_id is null then raise exception 'Código de convite inválido.'; end if;
 insert into public.viva_family_members(family_id,user_id,role) values(v_family_id,auth.uid(),'member') on conflict(family_id,user_id) do nothing;
 return v_family_id;
end; $$;
revoke all on function public.viva_join_family(text) from public;
grant execute on function public.viva_join_family(text) to authenticated;
