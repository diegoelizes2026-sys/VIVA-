-- Parceiros (influenciadores) e "Liberar Pro" pelo painel administrativo.
-- 1) Código de convite personalizado (4 a 12 letras/números, ex.: JOAO10).
-- 2) Parceiro: valor por assinante e limite mensal próprios (sem limite = null).
-- 3) Liberar Pro de presente por N dias (gateway 'gift'), sem pagamento.

-- 1) Códigos de 4 a 12 caracteres (os de 6 continuam valendo).
alter table public.viva_referral_codes drop constraint if exists viva_referral_codes_code_check;
alter table public.viva_referral_codes add constraint viva_referral_codes_code_check check (code ~ '^[A-Z0-9]{4,12}$');

create or replace function public.viva_claim_referral(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_ref uuid; v_created timestamptz; v_code text := upper(btrim(coalesce(p_code, '')));
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if v_code !~ '^[A-Z0-9]{4,12}$' then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  select user_id into v_ref from public.viva_referral_codes where code = v_code;
  if v_ref is null then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  if v_ref = v_uid then return jsonb_build_object('ok', false, 'reason', 'self'); end if;
  if exists (select 1 from public.viva_referrals where referred_id = v_uid) then return jsonb_build_object('ok', false, 'reason', 'already'); end if;
  select created_at into v_created from auth.users where id = v_uid;
  if v_created < now() - interval '7 days' then return jsonb_build_object('ok', false, 'reason', 'too_old'); end if;
  insert into public.viva_referrals(referrer_id, referred_id) values (v_ref, v_uid) on conflict (referred_id) do nothing;
  if exists (select 1 from public.viva_onboarding where user_id = v_uid and kind = 'finance' and status = 'completed') then
    perform public.viva_reward_referral(v_uid);
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.viva_claim_referral(text) from public, anon;
grant execute on function public.viva_claim_referral(text) to authenticated;

-- 2) Parceiros.
create table if not exists public.viva_partners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reward_cents integer not null default 1000 check (reward_cents between 0 and 100000),
  monthly_limit_cents integer check (monthly_limit_cents is null or monthly_limit_cents between 0 and 100000000),
  active boolean not null default true,
  note text check (note is null or char_length(note) <= 300),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.viva_partners enable row level security;
drop policy if exists viva_partners_read on public.viva_partners;
create policy viva_partners_read on public.viva_partners for select to authenticated
  using ((select auth.uid()) = user_id or public.viva_is_admin());
revoke all on public.viva_partners from anon, authenticated;
grant select on public.viva_partners to authenticated;

-- Pagamento do Pro aprovado → recompensa para quem indicou (parceiro usa o valor e o limite dele).
create or replace function public.viva_referral_cash_on_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r public.viva_referrals%rowtype; p public.viva_partners%rowtype; v_month_cents integer; v_paid timestamptz;
  v_reward integer := 1000; v_limit integer := 20000; v_over boolean;
begin
  if new.status <> 'approved' or new.plan_id <> 'pro' or coalesce(new.amount_brl, 0) <= 0
     or new.billing_interval = 'one_time' or coalesce(new.gateway, '') = 'trial' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'approved' then return new; end if;
  select * into r from public.viva_referrals where referred_id = new.user_id;
  if not found then return new; end if;
  if exists (select 1 from public.viva_referral_earnings where referred_id = new.user_id) then return new; end if;
  select * into p from public.viva_partners where user_id = r.referrer_id and active;
  if found then v_reward := p.reward_cents; v_limit := p.monthly_limit_cents; end if;
  v_paid := coalesce(new.paid_at, now());
  select coalesce(sum(amount_cents), 0) into v_month_cents from public.viva_referral_earnings
   where referrer_id = r.referrer_id and status <> 'canceled' and created_at >= date_trunc('month', now());
  v_over := v_limit is not null and v_month_cents + v_reward > v_limit;
  insert into public.viva_referral_earnings(referrer_id, referred_id, payment_id, amount_cents, status, available_at, note)
  values (r.referrer_id, new.user_id, new.id,
          case when v_over then 0 else v_reward end,
          case when v_over then 'limit' else 'pending' end,
          v_paid + interval '30 days',
          case when v_over then 'Limite mensal atingido' else null end)
  on conflict (referred_id) do nothing;
  return new;
end $$;
revoke all on function public.viva_referral_cash_on_payment() from public, anon, authenticated;

-- Meu saldo em dinheiro (com o valor e o limite do parceiro, quando for o caso).
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
    'paying_friends', (select count(*) from public.viva_referral_earnings where referrer_id = v_uid and status <> 'canceled'),
    'next_release', (select min(available_at) from public.viva_referral_earnings where referrer_id = v_uid and status = 'pending'),
    'open_payout', (select jsonb_build_object('amount_cents', amount_cents, 'created_at', created_at) from public.viva_referral_payouts where user_id = v_uid and status = 'requested'),
    'last_payout', (select jsonb_build_object('status', status, 'amount_cents', amount_cents, 'decided_at', decided_at, 'note', admin_note) from public.viva_referral_payouts where user_id = v_uid and status <> 'requested' order by decided_at desc nulls last limit 1),
    'reward_cents', case when v_partner then p.reward_cents else 1000 end,
    'min_payout_cents', 3000,
    'monthly_limit_cents', case when v_partner then p.monthly_limit_cents else 20000 end,
    'hold_days', 30,
    'partner', v_partner
  );
end $$;
revoke all on function public.viva_my_referral_cash() from public, anon;
grant execute on function public.viva_my_referral_cash() to authenticated;

-- Admin: transformar uma conta em parceiro (código próprio, valor e limite).
create or replace function public.viva_admin_set_partner(p_user_id uuid, p_code text, p_reward_cents integer, p_monthly_limit_cents integer, p_active boolean default true, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_code text := upper(btrim(coalesce(p_code, ''))); v_owner uuid;
begin
  if not public.viva_is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from auth.users where id = p_user_id) then raise exception 'user_not_found' using errcode = 'P0001'; end if;
  if v_code !~ '^[A-Z0-9]{4,12}$' then raise exception 'invalid_code' using errcode = 'P0001'; end if;
  select user_id into v_owner from public.viva_referral_codes where code = v_code;
  if v_owner is not null and v_owner <> p_user_id then raise exception 'code_taken' using errcode = 'P0001'; end if;
  insert into public.viva_referral_codes(user_id, code) values (p_user_id, v_code)
  on conflict (user_id) do update set code = excluded.code;
  insert into public.viva_partners(user_id, reward_cents, monthly_limit_cents, active, note, created_by)
  values (p_user_id, greatest(0, coalesce(p_reward_cents, 1000)), p_monthly_limit_cents, coalesce(p_active, true), nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  on conflict (user_id) do update set reward_cents = excluded.reward_cents, monthly_limit_cents = excluded.monthly_limit_cents,
    active = excluded.active, note = excluded.note, updated_at = now();
  return jsonb_build_object('ok', true, 'code', v_code);
end $$;
revoke all on function public.viva_admin_set_partner(uuid, text, integer, integer, boolean, text) from public, anon;
grant execute on function public.viva_admin_set_partner(uuid, text, integer, integer, boolean, text) to authenticated;

-- Admin: lista de parceiros com resultados.
create or replace function public.viva_admin_partners()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.viva_is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(row_to_json(x) order by x.created_at desc) from (
    select p.user_id, coalesce(pr.full_name, '') as full_name, u.email, c.code, p.reward_cents, p.monthly_limit_cents, p.active, p.note, p.created_at,
      (select count(*) from public.viva_referrals r where r.referrer_id = p.user_id) as signups,
      (select count(*) from public.viva_referral_earnings e where e.referrer_id = p.user_id and e.status <> 'canceled') as paying,
      (select coalesce(sum(amount_cents), 0) from public.viva_referral_earnings e where e.referrer_id = p.user_id and e.status in ('pending','available','requested','paid')) as earned_cents
    from public.viva_partners p
    join auth.users u on u.id = p.user_id
    left join public.viva_profiles pr on pr.id = p.user_id
    left join public.viva_referral_codes c on c.user_id = p.user_id
  ) x), '[]'::jsonb);
end $$;
revoke all on function public.viva_admin_partners() from public, anon;
grant execute on function public.viva_admin_partners() to authenticated;

-- 3) Admin: liberar o Pro de presente por N dias (soma ao presente que já estiver ativo).
create or replace function public.viva_admin_grant_pro(p_user_id uuid, p_days integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_days integer := least(greatest(coalesce(p_days, 30), 1), 366); v_gift public.viva_subscriptions%rowtype; v_end timestamptz;
begin
  if not public.viva_is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from auth.users where id = p_user_id) then raise exception 'user_not_found' using errcode = 'P0001'; end if;
  if exists (select 1 from public.viva_subscriptions where user_id = p_user_id and gateway not in ('trial','gift') and status = 'active'
             and plan_id <> 'free' and current_period_end > now()) then
    raise exception 'already_paid' using errcode = 'P0001';
  end if;
  select * into v_gift from public.viva_subscriptions where user_id = p_user_id and gateway = 'gift' and status = 'active' and current_period_end > now()
   order by current_period_end desc limit 1;
  if found then
    update public.viva_subscriptions set current_period_end = current_period_end + make_interval(days => v_days), updated_at = now()
     where id = v_gift.id returning current_period_end into v_end;
  else
    -- Encerra um teste em andamento para o presente valer no lugar dele.
    update public.viva_subscriptions set status = 'expired', current_period_end = now(), updated_at = now()
     where user_id = p_user_id and gateway = 'trial' and status = 'trialing' and current_period_end > now();
    insert into public.viva_subscriptions(user_id, plan_id, status, billing_interval, gateway, current_period_start, current_period_end, external_reference)
    values (p_user_id, 'pro', 'active', 'monthly', 'gift', now(), now() + make_interval(days => v_days), 'viva_gift_'||p_user_id||'_'||extract(epoch from now())::bigint)
    returning current_period_end into v_end;
  end if;
  perform public.viva_sync_wallet(p_user_id);
  return jsonb_build_object('ok', true, 'ends_at', v_end, 'days', v_days);
end $$;
revoke all on function public.viva_admin_grant_pro(uuid, integer) from public, anon;
grant execute on function public.viva_admin_grant_pro(uuid, integer) to authenticated;
