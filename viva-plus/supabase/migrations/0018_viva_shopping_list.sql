-- VIVA+ — Lista de compras inteligente (usa as tabelas já existentes viva_shopping_lists / viva_shopping_list_items).
-- Somente adições: seção do mercado, unidade, preço estimado, ordem e origem do item.
alter table public.viva_shopping_lists
  add column if not exists kind text not null default 'mercado' check (kind in ('mercado','farmacia','outros')),
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.viva_shopping_list_items
  add column if not exists category text not null default 'Outros' check (char_length(category) between 1 and 40),
  add column if not exists unit text check (unit is null or char_length(unit) <= 12),
  add column if not exists estimated_price numeric(12,2) check (estimated_price is null or estimated_price >= 0),
  add column if not exists note text check (note is null or char_length(note) <= 200),
  add column if not exists source text not null default 'manual' check (source in ('manual','chat')),
  add column if not exists purchased_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'viva_shopping_list_items_title_len') then
    alter table public.viva_shopping_list_items add constraint viva_shopping_list_items_title_len check (char_length(title) between 1 and 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'viva_shopping_list_items_qty') then
    alter table public.viva_shopping_list_items add constraint viva_shopping_list_items_qty check (quantity > 0 and quantity <= 10000);
  end if;
end $$;

create index if not exists viva_shopping_list_items_list on public.viva_shopping_list_items(list_id, is_purchased, category);
create index if not exists viva_shopping_lists_user on public.viva_shopping_lists(user_id, created_at);

-- O item só pode ficar numa lista do próprio usuário (impede vincular a lista de outra pessoa).
create or replace function public.viva_shopping_item_owner_check()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.viva_shopping_lists l where l.id = new.list_id and l.user_id = new.user_id) then
    raise exception 'list_not_owned' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists viva_shopping_item_owner on public.viva_shopping_list_items;
create trigger viva_shopping_item_owner before insert or update on public.viva_shopping_list_items
  for each row execute function public.viva_shopping_item_owner_check();
revoke all on function public.viva_shopping_item_owner_check() from public, anon, authenticated;
