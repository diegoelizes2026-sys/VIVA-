-- VIVA+ Perto de mim — lugares adicionados pelos usuários e avaliações com estrelas.
-- Somente adições. Quem criou um lugar ou escreveu uma avaliação nunca é exposto a outros usuários
-- (as leituras públicas passam por funções que devolvem só o primeiro nome e dados agregados).

-- 1. Lugares adicionados manualmente
create table if not exists public.viva_places (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('mercado','farmacia','restaurante','academia')),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  address text check (address is null or char_length(address) <= 160),
  phone text check (phone is null or char_length(phone) <= 30),
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists viva_places_geo on public.viva_places(kind, lat, lon) where not hidden;
create index if not exists viva_places_creator on public.viva_places(created_by, created_at);
alter table public.viva_places enable row level security;
drop policy if exists viva_places_insert_own on public.viva_places;
create policy viva_places_insert_own on public.viva_places for insert to authenticated with check ((select auth.uid()) = created_by and not hidden);
drop policy if exists viva_places_owner_rw on public.viva_places;
create policy viva_places_owner_rw on public.viva_places for all to authenticated
  using ((select auth.uid()) = created_by or public.viva_is_admin()) with check ((select auth.uid()) = created_by or public.viva_is_admin());
revoke all on public.viva_places from anon;
grant select, insert, update, delete on public.viva_places to authenticated;

-- Limites: até 10 lugares por dia por pessoa e nada de lugar repetido (mesmo nome a menos de ~80 m).
create or replace function public.viva_places_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
  if tg_op = 'INSERT' then
    if (select count(*) from public.viva_places where created_by = new.created_by and created_at > now() - interval '1 day') >= 10 then
      raise exception 'places_daily_limit' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.viva_places p where not p.hidden and p.kind = new.kind and lower(p.name) = lower(new.name)
               and abs(p.lat - new.lat) < 0.0008 and abs(p.lon - new.lon) < 0.0008) then
      raise exception 'place_duplicate' using errcode = 'P0001';
    end if;
  elsif tg_op = 'UPDATE' and not public.viva_is_admin() then
    new.hidden := old.hidden;            -- só a administração esconde ou mostra um lugar
    new.created_by := old.created_by;
  end if;
  return new;
end $$;
drop trigger if exists viva_places_guard on public.viva_places;
create trigger viva_places_guard before insert or update on public.viva_places for each row execute function public.viva_places_guard();
revoke all on function public.viva_places_guard() from public, anon, authenticated;

-- 2. Avaliações (1 por pessoa por lugar; o lugar pode ser do OpenStreetMap "osm:node/123" ou do VIVA+ "viva:<uuid>")
create table if not exists public.viva_place_reviews (
  id uuid primary key default gen_random_uuid(),
  place_ref text not null check (place_ref ~ '^(osm:(node|way|relation)/[0-9]{1,20}|viva:[0-9a-f-]{36})$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 280),
  place_name text check (place_name is null or char_length(place_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (place_ref, user_id)
);
create index if not exists viva_place_reviews_ref on public.viva_place_reviews(place_ref);
alter table public.viva_place_reviews enable row level security;
drop policy if exists viva_place_reviews_owner on public.viva_place_reviews;
create policy viva_place_reviews_owner on public.viva_place_reviews for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists viva_place_reviews_admin_delete on public.viva_place_reviews;
create policy viva_place_reviews_admin_delete on public.viva_place_reviews for delete to authenticated using (public.viva_is_admin());
revoke all on public.viva_place_reviews from anon;
grant select, insert, update, delete on public.viva_place_reviews to authenticated;

create or replace function public.viva_place_reviews_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if new.comment is not null then new.comment := nullif(btrim(new.comment), ''); end if;
  return new;
end $$;
drop trigger if exists viva_place_reviews_touch on public.viva_place_reviews;
create trigger viva_place_reviews_touch before insert or update on public.viva_place_reviews for each row execute function public.viva_place_reviews_touch();

-- 3. Leituras públicas (para quem está logado), sem expor quem é quem.
create or replace function public.viva_places_nearby(p_lat double precision, p_lon double precision, p_radius integer, p_kind text)
returns table (id uuid, kind text, name text, address text, phone text, lat double precision, lon double precision, is_mine boolean, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.kind, p.name, p.address, p.phone, p.lat, p.lon, p.created_by = (select auth.uid()), p.created_at
  from public.viva_places p
  where (select auth.uid()) is not null and not p.hidden and p.kind = p_kind
    and p.lat between p_lat - (least(greatest(p_radius, 100), 5000) / 111000.0) and p_lat + (least(greatest(p_radius, 100), 5000) / 111000.0)
    and p.lon between p_lon - (least(greatest(p_radius, 100), 5000) / (111000.0 * greatest(cos(radians(p_lat)), 0.01))) and p_lon + (least(greatest(p_radius, 100), 5000) / (111000.0 * greatest(cos(radians(p_lat)), 0.01)))
  order by p.created_at desc
  limit 60
$$;
revoke all on function public.viva_places_nearby(double precision, double precision, integer, text) from public, anon;
grant execute on function public.viva_places_nearby(double precision, double precision, integer, text) to authenticated;

create or replace function public.viva_place_ratings(p_refs text[])
returns table (place_ref text, avg_rating numeric, reviews integer, my_rating smallint, my_comment text, recent jsonb)
language sql stable security definer set search_path = '' as $$
  with refs as (select distinct unnest(p_refs[1:80]) as ref)
  select r.ref,
    round(avg(v.rating)::numeric, 1),
    count(v.id)::int,
    max(v.rating) filter (where v.user_id = (select auth.uid())),
    max(v.comment) filter (where v.user_id = (select auth.uid())),
    coalesce((select jsonb_agg(x order by x->>'at' desc) from (
        select jsonb_build_object('rating', c.rating, 'comment', c.comment, 'at', c.updated_at,
                                  'name', coalesce(nullif(split_part(btrim(pr.full_name), ' ', 1), ''), 'Usuário VIVA+')) x
        from public.viva_place_reviews c left join public.viva_profiles pr on pr.id = c.user_id
        where c.place_ref = r.ref and c.comment is not null order by c.updated_at desc limit 3) s), '[]'::jsonb)
  from refs r left join public.viva_place_reviews v on v.place_ref = r.ref
  where (select auth.uid()) is not null
  group by r.ref
$$;
revoke all on function public.viva_place_ratings(text[]) from public, anon;
grant execute on function public.viva_place_ratings(text[]) to authenticated;
