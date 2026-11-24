-- Rede de Personais VIVA+: cadastro do personal, aprovação no painel, vitrine por cidade e bônus automático.

-- 1) Perfil público do parceiro (personal trainer).
create table if not exists public.viva_partner_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  kind text not null default 'personal' check (kind in ('personal')),
  display_name text not null check (char_length(display_name) between 2 and 80),
  cref text not null check (char_length(cref) between 4 and 30),
  city text not null check (char_length(city) between 2 and 80),
  state text not null check (state ~ '^[A-Z]{2}$'),
  instagram text check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  whatsapp text check (whatsapp is null or whatsapp ~ '^\d{10,13}$'),
  photo_url text check (photo_url is null or char_length(photo_url) <= 500),
  bio text check (bio is null or char_length(bio) <= 160),
  desired_code text check (desired_code is null or desired_code ~ '^[A-Z0-9]{4,12}$'),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewer boolean not null default false,
  admin_note text check (admin_note is null or char_length(admin_note) <= 300),
  consent_at timestamptz not null default now(),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists viva_partner_profiles_city on public.viva_partner_profiles(status, state, lower(city));
alter table public.viva_partner_profiles enable row level security;
drop policy if exists viva_partner_profiles_own on public.viva_partner_profiles;
create policy viva_partner_profiles_own on public.viva_partner_profiles for select to authenticated
  using ((select auth.uid()) = user_id or public.viva_is_admin());
revoke all on public.viva_partner_profiles from anon, authenticated;
grant select on public.viva_partner_profiles to authenticated;

-- Fotos públicas dos parceiros.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('viva-partner-photos', 'viva-partner-photos', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- Pedido/atualização do cadastro pelo próprio personal (volta para "pendente" se mudar algo depois de aprovado? não: só nome/bio/foto/contatos podem mudar sem reanálise; CREF/cidade pedem nova análise).
create or replace function public.viva_partner_apply(p_display_name text, p_cref text, p_city text, p_state text, p_instagram text, p_whatsapp text, p_bio text, p_desired_code text, p_photo_url text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_old public.viva_partner_profiles%rowtype; v_status text := 'pending';
  v_ig text := nullif(regexp_replace(btrim(coalesce(p_instagram,'')), '^@', ''), '');
  v_wa text := nullif(regexp_replace(coalesce(p_whatsapp,''), '\D', '', 'g'), '');
  v_code text := nullif(upper(btrim(coalesce(p_desired_code,''))), '');
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if v_wa is not null and char_length(v_wa) in (10, 11) then v_wa := '55' || v_wa; end if;
  select * into v_old from public.viva_partner_profiles where user_id = v_uid;
  if found and v_old.status = 'approved' and upper(btrim(p_cref)) = v_old.cref and lower(btrim(p_city)) = lower(v_old.city) and upper(btrim(p_state)) = v_old.state then
    v_status := 'approved';
  end if;
  insert into public.viva_partner_profiles(user_id, display_name, cref, city, state, instagram, whatsapp, bio, desired_code, photo_url, status, consent_at, updated_at)
  values (v_uid, btrim(p_display_name), upper(btrim(p_cref)), btrim(p_city), upper(btrim(p_state)), v_ig, v_wa, nullif(btrim(coalesce(p_bio,'')), ''), v_code, nullif(btrim(coalesce(p_photo_url,'')), ''), v_status, now(), now())
  on conflict (user_id) do update set display_name = excluded.display_name, cref = excluded.cref, city = excluded.city, state = excluded.state,
    instagram = excluded.instagram, whatsapp = excluded.whatsapp, bio = excluded.bio, desired_code = excluded.desired_code,
    photo_url = coalesce(excluded.photo_url, public.viva_partner_profiles.photo_url), status = excluded.status, consent_at = now(), updated_at = now();
  return jsonb_build_object('ok', true, 'status', v_status);
end $$;
revoke all on function public.viva_partner_apply(text,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.viva_partner_apply(text,text,text,text,text,text,text,text,text) to authenticated;

-- Vitrine: personais aprovados (primeiro os da cidade da pessoa). Só dados que o personal autorizou mostrar.
create or replace function public.viva_partner_directory(p_city text default null, p_state text default null, p_limit integer default 6)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) from (
    select p.display_name, p.cref, p.city, p.state, p.instagram, p.whatsapp, p.photo_url, p.bio, p.reviewer,
      (lower(p.city) = lower(coalesce(p_city, '')) and p.state = upper(coalesce(p_state, ''))) as same_city,
      (p.state = upper(coalesce(p_state, ''))) as same_state
    from public.viva_partner_profiles p
    where p.status = 'approved'
    order by (lower(p.city) = lower(coalesce(p_city, '')) and p.state = upper(coalesce(p_state, ''))) desc,
             (p.state = upper(coalesce(p_state, ''))) desc, random()
    limit greatest(1, least(coalesce(p_limit, 6), 20))
  ) x;
$$;
revoke all on function public.viva_partner_directory(text, text, integer) from public, anon;
grant execute on function public.viva_partner_directory(text, text, integer) to authenticated;

-- Admin: lista dos cadastros.
create or replace function public.viva_admin_partner_profiles(p_status text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.viva_is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(row_to_json(x) order by x.status = 'pending' desc, x.created_at desc) from (
    select p.*, u.email, c.code,
      (select count(*) from public.viva_referrals r where r.referrer_id = p.user_id) as signups,
      (select count(*) from public.viva_referral_earnings e where e.referrer_id = p.user_id and e.kind = 'referral' and e.status <> 'canceled') as paying
    from public.viva_partner_profiles p join auth.users u on u.id = p.user_id left join public.viva_referral_codes c on c.user_id = p.user_id
    where p_status is null or p.status = p_status) x), '[]'::jsonb);
end $$;
revoke all on function public.viva_admin_partner_profiles(text) from public, anon;
grant execute on function public.viva_admin_partner_profiles(text) to authenticated;

-- Admin: aprovar/recusar. Aprovar cria o código e as condições de parceiro (R$ 10 + bônus de R$ 50 a cada 10, sem limite).
create or replace function public.viva_admin_decide_partner(p_user_id uuid, p_decision text, p_code text default null, p_reviewer boolean default false, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.viva_partner_profiles%rowtype; v_code text;
begin
  if not public.viva_is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'invalid_decision' using errcode = 'P0001'; end if;
  select * into v from public.viva_partner_profiles where user_id = p_user_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if p_decision = 'rejected' then
    update public.viva_partner_profiles set status = 'rejected', reviewer = false, admin_note = left(nullif(btrim(coalesce(p_note,'')),''), 300), updated_at = now() where user_id = p_user_id;
    update public.viva_partners set active = false, updated_at = now() where user_id = p_user_id;
    return jsonb_build_object('ok', true, 'status', 'rejected');
  end if;
  v_code := upper(btrim(coalesce(nullif(p_code,''), v.desired_code, (select code from public.viva_referral_codes where user_id = p_user_id), '')));
  if v_code = '' then v_code := upper(left(regexp_replace(translate(v.display_name, 'ÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç', 'AAAAEEIOOOUCaaaaeeiooouc'), '[^A-Za-z0-9]', '', 'g'), 8)) || '10'; end if;
  perform public.viva_admin_set_partner(p_user_id, v_code, coalesce((select reward_cents from public.viva_partners where user_id = p_user_id), 1000), null, true, 'Personal parceiro');
  update public.viva_partners set bonus_every = coalesce(bonus_every, 10), bonus_cents = coalesce(bonus_cents, 5000), updated_at = now() where user_id = p_user_id;
  if coalesce(p_reviewer, false) then update public.viva_partner_profiles set reviewer = false where reviewer and user_id <> p_user_id; end if;
  update public.viva_partner_profiles set status = 'approved', reviewer = coalesce(p_reviewer, false), approved_at = coalesce(approved_at, now()),
    admin_note = left(nullif(btrim(coalesce(p_note,'')),''), 300), updated_at = now() where user_id = p_user_id;
  return jsonb_build_object('ok', true, 'status', 'approved', 'code', v_code);
end $$;
revoke all on function public.viva_admin_decide_partner(uuid, text, text, boolean, text) from public, anon;
grant execute on function public.viva_admin_decide_partner(uuid, text, text, boolean, text) to authenticated;

-- 2) Bônus automático: a cada N assinantes do parceiro, um valor extra (mesmo fluxo de liberação/saque).
alter table public.viva_partners add column if not exists bonus_every integer check (bonus_every is null or bonus_every between 1 and 1000);
alter table public.viva_partners add column if not exists bonus_cents integer check (bonus_cents is null or bonus_cents between 0 and 1000000);
alter table public.viva_referral_earnings add column if not exists kind text not null default 'referral';
alter table public.viva_referral_earnings drop constraint if exists viva_referral_earnings_kind_check;
alter table public.viva_referral_earnings add constraint viva_referral_earnings_kind_check check (kind in ('referral','bonus'));
alter table public.viva_referral_earnings alter column referred_id drop not null;

create or replace function public.viva_referral_cash_on_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r public.viva_referrals%rowtype; p public.viva_partners%rowtype; v_month_cents integer; v_paid timestamptz;
  v_reward integer := 1000; v_limit integer := 20000; v_over boolean; v_partner boolean := false; v_count integer;
begin
  if new.status <> 'approved' or new.plan_id <> 'pro' or coalesce(new.amount_brl, 0) <= 0
     or new.billing_interval = 'one_time' or coalesce(new.gateway, '') = 'trial' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'approved' then return new; end if;
  select * into r from public.viva_referrals where referred_id = new.user_id;
  if not found then return new; end if;
  if exists (select 1 from public.viva_referral_earnings where referred_id = new.user_id) then return new; end if;
  select * into p from public.viva_partners where user_id = r.referrer_id and active;
  if found then v_partner := true; v_reward := p.reward_cents; v_limit := p.monthly_limit_cents; end if;
  v_paid := coalesce(new.paid_at, now());
  select coalesce(sum(amount_cents), 0) into v_month_cents from public.viva_referral_earnings
   where referrer_id = r.referrer_id and status <> 'canceled' and created_at >= date_trunc('month', now());
  v_over := v_limit is not null and v_month_cents + v_reward > v_limit;
  insert into public.viva_referral_earnings(referrer_id, referred_id, payment_id, amount_cents, status, available_at, note, kind)
  values (r.referrer_id, new.user_id, new.id,
          case when v_over then 0 else v_reward end,
          case when v_over then 'limit' else 'pending' end,
          v_paid + interval '30 days',
          case when v_over then 'Limite mensal atingido' else null end, 'referral')
  on conflict (referred_id) do nothing;
  -- Bônus do parceiro: ao completar cada bloco de N assinantes.
  if v_partner and coalesce(p.bonus_every, 0) > 0 and coalesce(p.bonus_cents, 0) > 0 and not v_over then
    select count(*) into v_count from public.viva_referral_earnings where referrer_id = r.referrer_id and kind = 'referral' and status <> 'canceled';
    if v_count > 0 and v_count % p.bonus_every = 0 then
      insert into public.viva_referral_earnings(referrer_id, referred_id, payment_id, amount_cents, status, available_at, note, kind)
      values (r.referrer_id, null, new.id, p.bonus_cents, 'pending', v_paid + interval '30 days', 'Bônus de ' || v_count || ' assinantes', 'bonus');
    end if;
  end if;
  return new;
end $$;
revoke all on function public.viva_referral_cash_on_payment() from public, anon, authenticated;

create or replace function public.viva_my_referral_cash()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); p public.viva_partners%rowtype; v_partner boolean;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  perform public.viva_referral_cash_release(v_uid);
  select * into p from public.viva_partners where user_id = v_uid and active;
  v_partner := found;
  return jsonb_build_object(
    'pending_cents', (select coalesce(sum(amount_cents),0) from public.viva_referral_earnings where referrer_id = v_uid and status = 'pending'),
    'available_cents', (select coalesce(sum(amount_cents),0) from public.viva_referral_earnings where referrer_id = v_uid and status = 'available'),
    'requested_cents', (select coalesce(sum(amount_cents),0) from public.viva_referral_earnings where referrer_id = v_uid and status = 'requested'),
    'paid_cents', (select coalesce(sum(amount_cents),0) from public.viva_referral_earnings where referrer_id = v_uid and status = 'paid'),
    'paying_friends', (select count(*) from public.viva_referral_earnings where referrer_id = v_uid and kind = 'referral' and status <> 'canceled'),
    'next_release', (select min(available_at) from public.viva_referral_earnings where referrer_id = v_uid and status = 'pending'),
    'open_payout', (select jsonb_build_object('amount_cents', amount_cents, 'created_at', created_at) from public.viva_referral_payouts where user_id = v_uid and status = 'requested'),
    'last_payout', (select jsonb_build_object('status', status, 'amount_cents', amount_cents, 'decided_at', decided_at, 'note', admin_note) from public.viva_referral_payouts where user_id = v_uid and status <> 'requested' order by decided_at desc nulls last limit 1),
    'reward_cents', case when v_partner then p.reward_cents else 1000 end,
    'min_payout_cents', 3000,
    'monthly_limit_cents', case when v_partner then p.monthly_limit_cents else 20000 end,
    'hold_days', 30,
    'partner', v_partner,
    'bonus_every', case when v_partner then p.bonus_every else null end,
    'bonus_cents', case when v_partner then p.bonus_cents else null end
  );
end $$;
revoke all on function public.viva_my_referral_cash() from public, anon;
grant execute on function public.viva_my_referral_cash() to authenticated;

-- Contagem de "assinaram" na lista de parceiros ignora as linhas de bônus.
create or replace function public.viva_admin_partners()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.viva_is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(row_to_json(x) order by x.created_at desc) from (
    select p.user_id, coalesce(pr.full_name, '') as full_name, u.email, c.code, p.reward_cents, p.monthly_limit_cents, p.active, p.note, p.created_at, p.bonus_every, p.bonus_cents,
      (select count(*) from public.viva_referrals r where r.referrer_id = p.user_id) as signups,
      (select count(*) from public.viva_referral_earnings e where e.referrer_id = p.user_id and e.kind = 'referral' and e.status <> 'canceled') as paying,
      (select coalesce(sum(amount_cents), 0) from public.viva_referral_earnings e where e.referrer_id = p.user_id and e.status in ('pending','available','requested','paid')) as earned_cents
    from public.viva_partners p
    join auth.users u on u.id = p.user_id
    left join public.viva_profiles pr on pr.id = p.user_id
    left join public.viva_referral_codes c on c.user_id = p.user_id
  ) x), '[]'::jsonb);
end $$;
revoke all on function public.viva_admin_partners() from public, anon;
grant execute on function public.viva_admin_partners() to authenticated;
