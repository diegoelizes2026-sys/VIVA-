-- VIVA+ — Crescimento: preços públicos (página de vendas), Indique e ganhe e teste grátis do Pro.
-- Somente adições. Créditos sempre lançados pelo extrato oficial (viva_wallet_post), com chave de idempotência.

-- 1. Preços para a página de vendas (visitantes sem login). Só campos de vitrine.
create or replace function public.viva_public_pricing()
returns table (id text, name text, monthly_price_brl numeric, annual_price_brl numeric, monthly_credits integer, signup_credits integer,
               voice_enabled boolean, photo_enabled boolean, radar_enabled boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, p.monthly_price_brl, p.annual_price_brl, p.monthly_credits, p.signup_credits, p.voice_enabled, p.photo_enabled, p.radar_enabled
  from public.viva_plans p where p.enabled and p.is_public
  order by p.monthly_price_brl nulls first
$$;
revoke all on function public.viva_public_pricing() from public;
grant execute on function public.viva_public_pricing() to anon, authenticated;

-- 2. Indique e ganhe
create table if not exists public.viva_referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  created_at timestamptz not null default now()
);
alter table public.viva_referral_codes enable row level security;
drop policy if exists viva_referral_codes_own on public.viva_referral_codes;
create policy viva_referral_codes_own on public.viva_referral_codes for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.viva_referral_codes from anon, authenticated;
grant select on public.viva_referral_codes to authenticated;

create table if not exists public.viva_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','rewarded','limit')),
  created_at timestamptz not null default now(),
  rewarded_at timestamptz,
  check (referrer_id <> referred_id)
);
create index if not exists viva_referrals_referrer on public.viva_referrals(referrer_id, status, rewarded_at);
alter table public.viva_referrals enable row level security;
drop policy if exists viva_referrals_own on public.viva_referrals;
create policy viva_referrals_own on public.viva_referrals for select to authenticated
  using ((select auth.uid()) = referrer_id or (select auth.uid()) = referred_id or public.viva_is_admin());
revoke all on public.viva_referrals from anon, authenticated;
grant select on public.viva_referrals to authenticated;

-- Recompensa (interna): quem indicou +20, quem entrou +10. Até 10 recompensas por mês por pessoa.
create or replace function public.viva_reward_referral(p_referred uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.viva_referrals%rowtype; v_month integer;
begin
  select * into r from public.viva_referrals where referred_id = p_referred and status = 'pending' for update;
  if not found then return; end if;
  select count(*) into v_month from public.viva_referrals
   where referrer_id = r.referrer_id and status = 'rewarded' and rewarded_at >= date_trunc('month', now());
  if v_month >= 10 then
    -- Limite de quem indicou atingido: o amigo ainda recebe o bônus dele.
    perform public.viva_ensure_wallet(r.referred_id);
    perform public.viva_wallet_post(r.referred_id, 'adjustment', 10, 'referral:'||r.id||':referred', 'Bônus por entrar com convite',
      null, null, 0, 0, 0, null, jsonb_build_object('referral', r.id));
    update public.viva_referrals set status = 'limit' where id = r.id;
    return;
  end if;
  perform public.viva_ensure_wallet(r.referrer_id);
  perform public.viva_ensure_wallet(r.referred_id);
  perform public.viva_wallet_post(r.referrer_id, 'adjustment', 20, 'referral:'||r.id||':referrer', 'Indique e ganhe: um amigo começou a usar a VIVA',
    null, null, 0, 0, 0, null, jsonb_build_object('referral', r.id));
  perform public.viva_wallet_post(r.referred_id, 'adjustment', 10, 'referral:'||r.id||':referred', 'Bônus por entrar com convite',
    null, null, 0, 0, 0, null, jsonb_build_object('referral', r.id));
  update public.viva_referrals set status = 'rewarded', rewarded_at = now() where id = r.id;
end $$;
revoke all on function public.viva_reward_referral(uuid) from public, anon, authenticated;

-- O amigo ganha (e quem indicou recebe) quando ele conclui o primeiro acesso financeiro.
create or replace function public.viva_referral_on_onboarding()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'finance' and new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    perform public.viva_reward_referral(new.user_id);
  end if;
  return new;
end $$;
drop trigger if exists viva_referral_on_onboarding on public.viva_onboarding;
create trigger viva_referral_on_onboarding after insert or update of status on public.viva_onboarding
  for each row execute function public.viva_referral_on_onboarding();
revoke all on function public.viva_referral_on_onboarding() from public, anon, authenticated;

-- Meu convite: cria o código na primeira vez e devolve os números.
create or replace function public.viva_my_referral()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_code text; v_try integer := 0;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select code into v_code from public.viva_referral_codes where user_id = v_uid;
  while v_code is null and v_try < 8 loop
    v_try := v_try + 1;
    v_code := upper(substr(translate(md5(gen_random_uuid()::text), '01', 'XY'), 1, 6));
    begin
      insert into public.viva_referral_codes(user_id, code) values (v_uid, v_code);
    exception when unique_violation then
      select code into v_code from public.viva_referral_codes where user_id = v_uid; -- outro pedido criou ao mesmo tempo
    end;
  end loop;
  return jsonb_build_object(
    'code', v_code,
    'invited', (select count(*) from public.viva_referrals where referrer_id = v_uid),
    'rewarded', (select count(*) from public.viva_referrals where referrer_id = v_uid and status = 'rewarded'),
    'pending', (select count(*) from public.viva_referrals where referrer_id = v_uid and status = 'pending'),
    'credits_earned', (select coalesce(sum(amount), 0) from public.viva_credit_ledger where user_id = v_uid and idempotency_key like 'referral:%:referrer'),
    'reward_referrer', 20, 'reward_friend', 10, 'monthly_limit', 10,
    'invited_by_someone', exists (select 1 from public.viva_referrals where referred_id = v_uid)
  );
end $$;
revoke all on function public.viva_my_referral() from public, anon;
grant execute on function public.viva_my_referral() to authenticated;

-- Usar um convite (conta nova, até 7 dias, uma vez, nunca o próprio).
create or replace function public.viva_claim_referral(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_ref uuid; v_created timestamptz; v_code text := upper(btrim(coalesce(p_code, '')));
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if v_code !~ '^[A-Z0-9]{6}$' then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  select user_id into v_ref from public.viva_referral_codes where code = v_code;
  if v_ref is null then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  if v_ref = v_uid then return jsonb_build_object('ok', false, 'reason', 'self'); end if;
  if exists (select 1 from public.viva_referrals where referred_id = v_uid) then return jsonb_build_object('ok', false, 'reason', 'already'); end if;
  select created_at into v_created from auth.users where id = v_uid;
  if v_created < now() - interval '7 days' then return jsonb_build_object('ok', false, 'reason', 'too_old'); end if;
  insert into public.viva_referrals(referrer_id, referred_id) values (v_ref, v_uid) on conflict (referred_id) do nothing;
  -- Se o primeiro acesso já foi concluído, a recompensa sai na hora.
  if exists (select 1 from public.viva_onboarding where user_id = v_uid and kind = 'finance' and status = 'completed') then
    perform public.viva_reward_referral(v_uid);
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.viva_claim_referral(text) from public, anon;
grant execute on function public.viva_claim_referral(text) to authenticated;

-- 3. Teste grátis do Pro: 7 dias, 40 créditos, uma vez por conta, sem cartão. Volta ao Free sozinho
--    (a assinatura "trialing" vence e a renovação normal faz a volta ao plano Free).
create or replace function public.viva_trial_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'eligible', auth.uid() is not null and not exists (select 1 from public.viva_subscriptions s where s.user_id = auth.uid() and s.plan_id <> 'free'),
    'active', exists (select 1 from public.viva_subscriptions s where s.user_id = auth.uid() and s.gateway = 'trial' and s.status = 'trialing' and s.current_period_end > now()),
    'ends_at', (select max(s.current_period_end) from public.viva_subscriptions s where s.user_id = auth.uid() and s.gateway = 'trial' and s.status = 'trialing' and s.current_period_end > now()),
    'days', 7, 'credits', 40
  )
$$;
revoke all on function public.viva_trial_status() from public, anon;
grant execute on function public.viva_trial_status() to authenticated;

create or replace function public.viva_start_pro_trial()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_sub public.viva_subscriptions%rowtype; v_key text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('viva_trial:'||v_uid));
  if exists (select 1 from public.viva_subscriptions where user_id = v_uid and plan_id <> 'free') then
    raise exception 'trial_unavailable' using errcode = 'P0001';
  end if;
  perform public.viva_ensure_wallet(v_uid);
  insert into public.viva_subscriptions(user_id, plan_id, status, billing_interval, gateway, current_period_start, current_period_end, external_reference)
  values (v_uid, 'pro', 'trialing', 'monthly', 'trial', now(), now() + interval '7 days', 'viva_trial_'||v_uid)
  returning * into v_sub;
  -- Mesma chave que a sincronização usaria: ela não concede de novo os 150 créditos do ciclo pago.
  v_key := 'sub:'||v_sub.id||':'||to_char(v_sub.current_period_start at time zone 'UTC','YYYYMMDDHH24MI');
  update public.viva_credit_wallets set plan_id = 'pro' where user_id = v_uid;
  perform public.viva_wallet_post(v_uid, 'plan_renewal', 40, v_key, 'Teste grátis do Pro (7 dias)');
  update public.viva_credit_wallets set cycle_granted = balance - reserved, cycle_used = 0, cycle_ref = v_key, cycle_started_at = now(),
    last_renewal_at = now(), next_renewal_at = v_sub.current_period_end, last_warning_level = 0, updated_at = now()
  where user_id = v_uid;
  return jsonb_build_object('ok', true, 'ends_at', v_sub.current_period_end, 'credits', 40);
end $$;
revoke all on function public.viva_start_pro_trial() from public, anon;
grant execute on function public.viva_start_pro_trial() to authenticated;
