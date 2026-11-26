-- Academias credenciadas VIVA+: o dono cadastra a academia, a equipe confere o CNPJ e aprova,
-- e ela aparece no Radar (aba Academias) com distância, modalidades, preço e personais que atendem lá.

create table if not exists public.viva_gym_profiles (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  cnpj text not null check (cnpj ~ '^\d{14}$'),
  city text not null check (char_length(city) between 2 and 80),
  state text not null check (state ~ '^[A-Z]{2}$'),
  neighborhood text check (neighborhood is null or char_length(neighborhood) between 2 and 60),
  address text check (address is null or char_length(address) between 4 and 160),
  lat double precision not null check (lat between -35 and 7),
  lon double precision not null check (lon between -75 and -28),
  modalities text[] not null default array['musculacao']::text[] check (
    cardinality(modalities) between 1 and 10 and
    modalities <@ array['musculacao','funcional','crossfit','pilates','yoga','natacao','lutas','danca','spinning','ginastica']::text[]),
  price_from_cents integer check (price_from_cents is null or price_from_cents between 1000 and 500000),
  hours text check (hours is null or char_length(hours) <= 120),
  whatsapp text check (whatsapp is null or whatsapp ~ '^\d{10,13}$'),
  instagram text check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  photo_url text check (photo_url is null or char_length(photo_url) <= 500),
  bio text check (bio is null or char_length(bio) <= 200),
  perk text check (perk is null or char_length(perk) <= 100),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 300),
  consent_at timestamptz not null default now(),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists viva_gym_profiles_point on public.viva_gym_profiles(status, lat, lon);
alter table public.viva_gym_profiles enable row level security;
drop policy if exists viva_gym_profiles_own on public.viva_gym_profiles;
create policy viva_gym_profiles_own on public.viva_gym_profiles for select to authenticated
  using ((select auth.uid()) = owner_id or public.viva_is_admin());
revoke all on public.viva_gym_profiles from anon, authenticated;
grant select on public.viva_gym_profiles to authenticated;

-- Cadastro/atualização pelo dono. Mudar nome, CNPJ ou cidade volta para análise; o resto não.
create or replace function public.viva_gym_apply(p_name text, p_cnpj text, p_city text, p_state text, p_neighborhood text, p_address text,
  p_lat double precision, p_lon double precision, p_modalities text[], p_price_from_cents integer, p_hours text,
  p_whatsapp text, p_instagram text, p_bio text, p_perk text, p_photo_url text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_old public.viva_gym_profiles%rowtype; v_status text := 'pending';
  v_cnpj text := regexp_replace(coalesce(p_cnpj,''), '\D', '', 'g');
  v_wa text := nullif(regexp_replace(coalesce(p_whatsapp,''), '\D', '', 'g'), '');
  v_ig text := nullif(regexp_replace(btrim(coalesce(p_instagram,'')), '^@', ''), '');
  v_mods text[];
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if v_wa is not null and char_length(v_wa) in (10, 11) then v_wa := '55' || v_wa; end if;
  select coalesce(array_agg(distinct m), array[]::text[]) into v_mods from unnest(coalesce(p_modalities, array[]::text[])) m;
  select * into v_old from public.viva_gym_profiles where owner_id = v_uid;
  if found and v_old.status = 'approved' and v_old.cnpj = v_cnpj and lower(v_old.name) = lower(btrim(p_name))
     and lower(v_old.city) = lower(btrim(p_city)) and v_old.state = upper(btrim(p_state)) then v_status := 'approved'; end if;
  insert into public.viva_gym_profiles(owner_id, name, cnpj, city, state, neighborhood, address, lat, lon, modalities, price_from_cents, hours, whatsapp, instagram, photo_url, bio, perk, status, consent_at, updated_at)
  values (v_uid, btrim(p_name), v_cnpj, btrim(p_city), upper(btrim(p_state)), nullif(btrim(coalesce(p_neighborhood,'')), ''), nullif(btrim(coalesce(p_address,'')), ''),
    round(p_lat::numeric, 5)::double precision, round(p_lon::numeric, 5)::double precision, v_mods, p_price_from_cents, nullif(btrim(coalesce(p_hours,'')), ''),
    v_wa, v_ig, nullif(btrim(coalesce(p_photo_url,'')), ''), nullif(btrim(coalesce(p_bio,'')), ''), nullif(btrim(coalesce(p_perk,'')), ''), v_status, now(), now())
  on conflict (owner_id) do update set name = excluded.name, cnpj = excluded.cnpj, city = excluded.city, state = excluded.state, neighborhood = excluded.neighborhood,
    address = excluded.address, lat = excluded.lat, lon = excluded.lon, modalities = excluded.modalities, price_from_cents = excluded.price_from_cents, hours = excluded.hours,
    whatsapp = excluded.whatsapp, instagram = excluded.instagram, photo_url = coalesce(excluded.photo_url, public.viva_gym_profiles.photo_url), bio = excluded.bio, perk = excluded.perk,
    status = excluded.status, consent_at = now(), updated_at = now();
  return jsonb_build_object('ok', true, 'status', v_status);
end $$;
revoke all on function public.viva_gym_apply(text,text,text,text,text,text,double precision,double precision,text[],integer,text,text,text,text,text,text) from public, anon;
grant execute on function public.viva_gym_apply(text,text,text,text,text,text,double precision,double precision,text[],integer,text,text,text,text,text,text) to authenticated;

-- Radar de academias: aprovadas perto de um ponto. Conta os personais credenciados que marcaram esta academia
-- (mesmo nome, a menos de 300 m). O ponto de quem busca não é gravado.
create or replace function public.viva_gym_radar(p_lat double precision, p_lon double precision, p_radius_km integer default 10, p_modality text default null, p_limit integer default 30)
returns jsonb language sql stable security definer set search_path = '' as $$
  with g as (
    select g.*, 6371 * 2 * asin(sqrt(power(sin(radians(g.lat - p_lat) / 2), 2) + cos(radians(p_lat)) * cos(radians(g.lat)) * power(sin(radians(g.lon - p_lon) / 2), 2))) as km
    from public.viva_gym_profiles g
    where g.status = 'approved' and (p_modality is null or p_modality = any(g.modalities))
  )
  select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) from (
    select g.name, g.city, g.state, g.neighborhood, g.address, g.lat, g.lon, g.modalities, g.price_from_cents, g.hours, g.whatsapp, g.instagram, g.photo_url, g.bio, g.perk,
      g.approved_at as credentialed_at, round(g.km::numeric, 1) as distance_km,
      (select count(*) from public.viva_partner_profiles p
        where p.status = 'approved' and p.service_lat is not null and lower(btrim(p.gym_name)) = lower(btrim(g.name))
          and abs(p.service_lat - g.lat) < 0.003 and abs(p.service_lon - g.lon) < 0.003) as personal_count
    from g
    where g.km <= greatest(1, least(coalesce(p_radius_km, 10), 100))
    order by g.km
    limit greatest(1, least(coalesce(p_limit, 30), 60))
  ) x;
$$;
revoke all on function public.viva_gym_radar(double precision, double precision, integer, text, integer) from public, anon;
grant execute on function public.viva_gym_radar(double precision, double precision, integer, text, integer) to authenticated;

-- Admin: lista e decisão.
create or replace function public.viva_admin_gym_profiles()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.viva_is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(row_to_json(x) order by x.status = 'pending' desc, x.created_at desc) from (
    select g.*, u.email from public.viva_gym_profiles g join auth.users u on u.id = g.owner_id) x), '[]'::jsonb);
end $$;
revoke all on function public.viva_admin_gym_profiles() from public, anon;
grant execute on function public.viva_admin_gym_profiles() to authenticated;

create or replace function public.viva_admin_decide_gym(p_owner_id uuid, p_decision text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.viva_is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'invalid_decision' using errcode = 'P0001'; end if;
  update public.viva_gym_profiles set status = p_decision,
    approved_at = case when p_decision = 'approved' then coalesce(approved_at, now()) else approved_at end,
    admin_note = left(nullif(btrim(coalesce(p_note,'')),''), 300), updated_at = now()
  where owner_id = p_owner_id;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  return jsonb_build_object('ok', true, 'status', p_decision);
end $$;
revoke all on function public.viva_admin_decide_gym(uuid, text, text) from public, anon;
grant execute on function public.viva_admin_decide_gym(uuid, text, text) to authenticated;
