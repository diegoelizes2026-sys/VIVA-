-- VIVA+ — Indicação paga: R$ 10 por amigo indicado que paga o Pro. Somente adições.
-- Regras: só o plano Pro (pagamento aprovado, nunca o teste grátis); fica "a liberar" por 30 dias e só libera
-- se o pagamento não foi estornado; saque a partir de R$ 30 por Pix, aprovado manualmente pela administração;
-- limite de R$ 200 por pessoa por mês (pela data do pagamento do amigo). Valores em centavos.

create table if not exists public.viva_referral_earnings (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_id uuid not null unique references auth.users(id) on delete cascade, -- uma recompensa em dinheiro por amigo
  payment_id uuid references public.viva_payments(id) on delete set null,
  amount_cents integer not null check (amount_cents >= 0 and amount_cents <= 100000),
  status text not null default 'pending' check (status in ('pending','available','requested','paid','canceled','limit')),
  available_at timestamptz not null,
  payout_id uuid,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists viva_referral_earnings_referrer on public.viva_referral_earnings(referrer_id, status, created_at);
alter table public.viva_referral_earnings enable row level security;
drop policy if exists viva_referral_earnings_read on public.viva_referral_earnings;
create policy viva_referral_earnings_read on public.viva_referral_earnings for select to authenticated
  using ((select auth.uid()) = referrer_id or public.viva_is_admin());
revoke all on public.viva_referral_earnings from anon, authenticated;
grant select on public.viva_referral_earnings to authenticated;

create table if not exists public.viva_referral_payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 3000),
  pix_key_type text not null check (pix_key_type in ('cpf','email','phone','random')),
  pix_key text not null check (char_length(pix_key) between 5 and 120),
  status text not null default 'requested' check (status in ('requested','paid','rejected')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 300),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists viva_referral_payouts_one_open on public.viva_referral_payouts(user_id) where status = 'requested';
alter table public.viva_referral_payouts enable row level security;
drop policy if exists viva_referral_payouts_read on public.viva_referral_payouts;
create policy viva_referral_payouts_read on public.viva_referral_payouts for select to authenticated
  using ((select auth.uid()) = user_id or public.viva_is_admin());
revoke all on public.viva_referral_payouts from anon, authenticated;
grant select on public.viva_referral_payouts to authenticated;

-- Pagamento do Pro aprovado → R$ 10 "a liberar" para quem indicou (só o primeiro pagamento do amigo conta).
create or replace function public.viva_referral_cash_on_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r public.viva_referrals%rowtype; v_month_cents integer; v_paid timestamptz;
begin
  if new.status <> 'approved' or new.plan_id <> 'pro' or coalesce(new.amount_brl, 0) <= 0
     or new.billing_interval = 'one_time' or coalesce(new.gateway, '') = 'trial' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'approved' then return new; end if;
  select * into r from public.viva_referrals where referred_id = new.user_id;
  if not found then return new; end if;
  if exists (select 1 from public.viva_referral_earnings where referred_id = new.user_id) then return new; end if;
  v_paid := coalesce(new.paid_at, now());
  select coalesce(sum(amount_cents), 0) into v_month_cents from public.viva_referral_earnings
   where referrer_id = r.referrer_id and status <> 'canceled' and created_at >= date_trunc('month', now());
  insert into public.viva_referral_earnings(referrer_id, referred_id, payment_id, amount_cents, status, available_at, note)
  values (r.referrer_id, new.user_id, new.id,
          case when v_month_cents + 1000 > 20000 then 0 else 1000 end,
          case when v_month_cents + 1000 > 20000 then 'limit' else 'pending' end,
          v_paid + interval '30 days',
          case when v_month_cents + 1000 > 20000 then 'Limite de R$ 200 no mês atingido' else null end)
  on conflict (referred_id) do nothing;
  return new;
end $$;
drop trigger if exists viva_referral_cash_on_payment on public.viva_payments;
create trigger viva_referral_cash_on_payment after insert or update of status on public.viva_payments
  for each row execute function public.viva_referral_cash_on_payment();
revoke all on function public.viva_referral_cash_on_payment() from public, anon, authenticated;

-- Libera o que passou dos 30 dias (se o pagamento não foi estornado). Chamado ao abrir as telas.
create or replace function public.viva_referral_cash_release(p_user uuid default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_n integer := 0;
begin
  update public.viva_referral_earnings e set status = 'canceled', note = 'Pagamento do amigo estornado ou cancelado', updated_at = now()
   where e.status = 'pending' and (p_user is null or e.referrer_id = p_user)
     and exists (select 1 from public.viva_payments p where p.id = e.payment_id and p.status <> 'approved');
  update public.viva_referral_earnings e set status = 'available', updated_at = now()
   where e.status = 'pending' and e.available_at <= now() and (p_user is null or e.referrer_id = p_user)
     and exists (select 1 from public.viva_payments p where p.id = e.payment_id and p.status = 'approved');
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.viva_referral_cash_release(uuid) from public, anon, authenticated;

-- Meu saldo em dinheiro.
create or replace function public.viva_my_referral_cash()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  perform public.viva_referral_cash_release(v_uid);
  return jsonb_build_object(
    'pending_cents', (select coalesce(sum(amount_cents),0) from public.viva_referral_earnings where referrer_id = v_uid and status = 'pending'),
    'available_cents', (select coalesce(sum(amount_cents),0) from public.viva_referral_earnings where referrer_id = v_uid and status = 'available'),
    'requested_cents', (select coalesce(sum(amount_cents),0) from public.viva_referral_earnings where referrer_id = v_uid and status = 'requested'),
    'paid_cents', (select coalesce(sum(amount_cents),0) from public.viva_referral_earnings where referrer_id = v_uid and status = 'paid'),
    'paying_friends', (select count(*) from public.viva_referral_earnings where referrer_id = v_uid and status <> 'canceled'),
    'next_release', (select min(available_at) from public.viva_referral_earnings where referrer_id = v_uid and status = 'pending'),
    'open_payout', (select jsonb_build_object('amount_cents', amount_cents, 'created_at', created_at) from public.viva_referral_payouts where user_id = v_uid and status = 'requested'),
    'last_payout', (select jsonb_build_object('status', status, 'amount_cents', amount_cents, 'decided_at', decided_at, 'note', admin_note) from public.viva_referral_payouts where user_id = v_uid and status <> 'requested' order by decided_at desc nulls last limit 1),
    'reward_cents', 1000, 'min_payout_cents', 3000, 'monthly_limit_cents', 20000, 'hold_days', 30
  );
end $$;
revoke all on function public.viva_my_referral_cash() from public, anon;
grant execute on function public.viva_my_referral_cash() to authenticated;

-- Pedir saque (tudo o que está disponível, mínimo R$ 30, um pedido aberto por vez).
create or replace function public.viva_request_referral_payout(p_pix_type text, p_pix_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_total integer; v_key text := btrim(coalesce(p_pix_key, '')); v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('viva_payout:'||v_uid));
  perform public.viva_referral_cash_release(v_uid);
  if p_pix_type not in ('cpf','email','phone','random') then raise exception 'pix_invalid' using errcode = 'P0001'; end if;
  if p_pix_type = 'cpf' then v_key := regexp_replace(v_key, '\D', '', 'g'); if v_key !~ '^\d{11}$' then raise exception 'pix_invalid' using errcode = 'P0001'; end if; end if;
  if p_pix_type = 'phone' then v_key := regexp_replace(v_key, '\D', '', 'g'); if v_key !~ '^\d{10,13}$' then raise exception 'pix_invalid' using errcode = 'P0001'; end if; end if;
  if p_pix_type = 'email' and v_key !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'pix_invalid' using errcode = 'P0001'; end if;
  if p_pix_type = 'random' and v_key !~* '^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$' then raise exception 'pix_invalid' using errcode = 'P0001'; end if;
  if exists (select 1 from public.viva_referral_payouts where user_id = v_uid and status = 'requested') then raise exception 'payout_open' using errcode = 'P0001'; end if;
  select coalesce(sum(amount_cents), 0) into v_total from public.viva_referral_earnings where referrer_id = v_uid and status = 'available';
  if v_total < 3000 then raise exception 'payout_min' using errcode = 'P0001'; end if;
  insert into public.viva_referral_payouts(user_id, amount_cents, pix_key_type, pix_key) values (v_uid, v_total, p_pix_type, v_key) returning id into v_id;
  update public.viva_referral_earnings set status = 'requested', payout_id = v_id, updated_at = now() where referrer_id = v_uid and status = 'available';
  return jsonb_build_object('ok', true, 'amount_cents', v_total);
end $$;
revoke all on function public.viva_request_referral_payout(text, text) from public, anon;
grant execute on function public.viva_request_referral_payout(text, text) to authenticated;

-- Administração: lista e decisão dos saques.
create or replace function public.viva_admin_referral_payouts(p_status text default 'requested')
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.viva_is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  perform public.viva_referral_cash_release(null);
  return coalesce((select jsonb_agg(x order by x->>'created_at') from (
    select jsonb_build_object(
      'id', p.id, 'user_id', p.user_id, 'amount_cents', p.amount_cents, 'pix_key_type', p.pix_key_type, 'pix_key', p.pix_key,
      'status', p.status, 'created_at', p.created_at, 'decided_at', p.decided_at, 'admin_note', p.admin_note,
      'name', coalesce(pr.full_name, ''), 'email', u.email,
      'friends', (select jsonb_agg(jsonb_build_object('email', fu.email, 'created_at', fu.created_at, 'paid_at', pay.paid_at, 'amount_brl', pay.amount_brl, 'payment_status', pay.status))
                  from public.viva_referral_earnings e join auth.users fu on fu.id = e.referred_id left join public.viva_payments pay on pay.id = e.payment_id where e.payout_id = p.id)
    ) x
    from public.viva_referral_payouts p join auth.users u on u.id = p.user_id left join public.viva_profiles pr on pr.id = p.user_id
    where p_status is null or p.status = p_status
    order by p.created_at limit 200) s), '[]'::jsonb);
end $$;
revoke all on function public.viva_admin_referral_payouts(text) from public, anon;
grant execute on function public.viva_admin_referral_payouts(text) to authenticated;

create or replace function public.viva_admin_decide_payout(p_id uuid, p_decision text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.viva_referral_payouts%rowtype;
begin
  if not public.viva_is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_decision not in ('paid','rejected') then raise exception 'invalid_decision' using errcode = 'P0001'; end if;
  select * into v from public.viva_referral_payouts where id = p_id for update;
  if not found or v.status <> 'requested' then raise exception 'payout_not_open' using errcode = 'P0001'; end if;
  update public.viva_referral_payouts set status = p_decision, admin_note = left(nullif(btrim(coalesce(p_note,'')),''), 300), decided_by = auth.uid(), decided_at = now() where id = p_id;
  if p_decision = 'paid' then
    update public.viva_referral_earnings set status = 'paid', updated_at = now() where payout_id = p_id;
  else
    -- Recusado (ex.: chave Pix errada): o valor volta a ficar disponível para um novo pedido.
    update public.viva_referral_earnings set status = 'available', payout_id = null, updated_at = now() where payout_id = p_id;
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.viva_admin_decide_payout(uuid, text, text) from public, anon;
grant execute on function public.viva_admin_decide_payout(uuid, text, text) to authenticated;
