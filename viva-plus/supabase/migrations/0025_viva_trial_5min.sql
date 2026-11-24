-- Teste grátis do Pro: agora dura 5 minutos (antes 7 dias). Uma vez por conta, sem cartão.
-- Quando acaba, a assinatura "trialing" vence, a conta volta ao Free e o app mostra os planos para assinar.
create or replace function public.viva_trial_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'eligible', auth.uid() is not null and not exists (select 1 from public.viva_subscriptions s where s.user_id = auth.uid() and s.plan_id <> 'free'),
    'active', exists (select 1 from public.viva_subscriptions s where s.user_id = auth.uid() and s.gateway = 'trial' and s.status = 'trialing' and s.current_period_end > now()),
    'ends_at', (select max(s.current_period_end) from public.viva_subscriptions s where s.user_id = auth.uid() and s.gateway = 'trial' and s.status = 'trialing' and s.current_period_end > now()),
    'minutes', 5, 'credits', 40
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
  values (v_uid, 'pro', 'trialing', 'monthly', 'trial', now(), now() + interval '5 minutes', 'viva_trial_'||v_uid)
  returning * into v_sub;
  -- Mesma chave que a sincronização usaria: ela não concede de novo os 150 créditos do ciclo pago.
  v_key := 'sub:'||v_sub.id||':'||to_char(v_sub.current_period_start at time zone 'UTC','YYYYMMDDHH24MI');
  update public.viva_credit_wallets set plan_id = 'pro' where user_id = v_uid;
  perform public.viva_wallet_post(v_uid, 'plan_renewal', 40, v_key, 'Teste grátis do Pro (5 minutos)');
  update public.viva_credit_wallets set cycle_granted = balance - reserved, cycle_used = 0, cycle_ref = v_key, cycle_started_at = now(),
    last_renewal_at = now(), next_renewal_at = v_sub.current_period_end, last_warning_level = 0, updated_at = now()
  where user_id = v_uid;
  return jsonb_build_object('ok', true, 'ends_at', v_sub.current_period_end, 'credits', 40);
end $$;
revoke all on function public.viva_start_pro_trial() from public, anon;
grant execute on function public.viva_start_pro_trial() to authenticated;
