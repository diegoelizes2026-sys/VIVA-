-- Radar de Personais: o personal marca onde atende (academia ou bairro) e como atende;
-- o usuário vê os personais perto dele, com a distância em km. Somente adições.

alter table public.viva_partner_profiles
  add column if not exists gym_name text,
  add column if not exists neighborhood text,
  add column if not exists service_lat double precision,
  add column if not exists service_lon double precision,
  add column if not exists modes text[] not null default array['academia']::text[],
  add column if not exists home_radius_km integer;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'viva_partner_profiles_gym_name_check') then
    alter table public.viva_partner_profiles add constraint viva_partner_profiles_gym_name_check check (gym_name is null or char_length(gym_name) between 2 and 80);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'viva_partner_profiles_neighborhood_check') then
    alter table public.viva_partner_profiles add constraint viva_partner_profiles_neighborhood_check check (neighborhood is null or char_length(neighborhood) between 2 and 60);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'viva_partner_profiles_service_point_check') then
    alter table public.viva_partner_profiles add constraint viva_partner_profiles_service_point_check check (
      (service_lat is null and service_lon is null) or (service_lat between -35 and 7 and service_lon between -75 and -28));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'viva_partner_profiles_modes_check') then
    alter table public.viva_partner_profiles add constraint viva_partner_profiles_modes_check check (
      cardinality(modes) between 1 and 4 and modes <@ array['academia','domicilio','online','ar_livre']::text[]);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'viva_partner_profiles_home_radius_check') then
    alter table public.viva_partner_profiles add constraint viva_partner_profiles_home_radius_check check (home_radius_km is null or home_radius_km between 1 and 50);
  end if;
end $$;
create index if not exists viva_partner_profiles_point on public.viva_partner_profiles(status, service_lat, service_lon);

-- O próprio personal define onde e como atende (não precisa de nova análise).
-- O ponto é arredondado (~10 m na academia; ~1 km quando é só o bairro) e nunca é mostrado: só a distância.
create or replace function public.viva_partner_set_location(p_gym_name text, p_neighborhood text, p_lat double precision, p_lon double precision,
  p_modes text[], p_home_radius_km integer, p_precise boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_modes text[]; v_digits integer := case when coalesce(p_precise, true) then 4 else 2 end;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if not exists (select 1 from public.viva_partner_profiles where user_id = v_uid) then raise exception 'not_partner' using errcode = 'P0001'; end if;
  select coalesce(array_agg(distinct m), array[]::text[]) into v_modes from unnest(coalesce(p_modes, array[]::text[])) m where m in ('academia','domicilio','online','ar_livre');
  if cardinality(v_modes) = 0 then raise exception 'modes_required' using errcode = 'P0001'; end if;
  if (p_lat is null) <> (p_lon is null) then raise exception 'invalid_point' using errcode = 'P0001'; end if;
  if p_lat is null and v_modes <> array['online'] then raise exception 'point_required' using errcode = 'P0001'; end if;
  update public.viva_partner_profiles set
    gym_name = nullif(left(btrim(coalesce(p_gym_name, '')), 80), ''),
    neighborhood = nullif(left(btrim(coalesce(p_neighborhood, '')), 60), ''),
    service_lat = case when p_lat is null then null else round(p_lat::numeric, v_digits)::double precision end,
    service_lon = case when p_lon is null then null else round(p_lon::numeric, v_digits)::double precision end,
    modes = v_modes,
    home_radius_km = case when 'domicilio' = any(v_modes) then greatest(1, least(50, coalesce(p_home_radius_km, 5))) else null end,
    updated_at = now()
  where user_id = v_uid;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.viva_partner_set_location(text, text, double precision, double precision, text[], integer, boolean) from public, anon;
grant execute on function public.viva_partner_set_location(text, text, double precision, double precision, text[], integer, boolean) to authenticated;

-- Radar: personais aprovados perto de um ponto (o ponto de quem busca não é gravado).
-- Entra quem atende dentro do raio buscado, quem vai a domicílio até a pessoa, e quem atende online.
create or replace function public.viva_partner_radar(p_lat double precision, p_lon double precision, p_radius_km integer default 10, p_mode text default null, p_limit integer default 30)
returns jsonb language sql stable security definer set search_path = '' as $$
  with base as (
    select p.*,
      case when p.service_lat is null or p_lat is null then null else
        6371 * 2 * asin(sqrt(power(sin(radians(p.service_lat - p_lat) / 2), 2) + cos(radians(p_lat)) * cos(radians(p.service_lat)) * power(sin(radians(p.service_lon - p_lon) / 2), 2)))
      end as km
    from public.viva_partner_profiles p
    where p.status = 'approved' and (p_mode is null or p_mode = any(p.modes))
  ), hits as (
    select *, (km is not null and km <= greatest(1, least(coalesce(p_radius_km, 10), 100))) as in_radius,
      ('domicilio' = any(modes) and km is not null and km <= coalesce(home_radius_km, 0)) as comes_to_you
    from base
  )
  select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) from (
    select display_name, cref, city, state, instagram, whatsapp, photo_url, bio, reviewer, gym_name, neighborhood, modes, home_radius_km,
      case when km is null then null else round(km::numeric, 1) end as distance_km, comes_to_you,
      (not in_radius and not comes_to_you) as online_only
    from hits
    where in_radius or comes_to_you or ('online' = any(modes) and (p_mode is null or p_mode = 'online'))
    order by (in_radius or comes_to_you) desc, km nulls last, random()
    limit greatest(1, least(coalesce(p_limit, 30), 60))
  ) x;
$$;
revoke all on function public.viva_partner_radar(double precision, double precision, integer, text, integer) from public, anon;
grant execute on function public.viva_partner_radar(double precision, double precision, integer, text, integer) to authenticated;
