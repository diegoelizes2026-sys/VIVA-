-- 1) Teste grátis do Pro volta a durar 7 dias (antes 5 minutos). Uma vez por conta, sem cartão.
--    Em 7 dias a pessoa vê o valor de verdade: o número do dia mudando, aviso de conta e o fim de semana no azul.
create or replace function public.viva_trial_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'eligible', auth.uid() is not null and not exists (select 1 from public.viva_subscriptions s where s.user_id = auth.uid() and s.plan_id <> 'free'),
    'active', exists (select 1 from public.viva_subscriptions s where s.user_id = auth.uid() and s.gateway = 'trial' and s.status = 'trialing' and s.current_period_end > now()),
    'ends_at', (select max(s.current_period_end) from public.viva_subscriptions s where s.user_id = auth.uid() and s.gateway = 'trial' and s.status = 'trialing' and s.current_period_end > now()),
    'days', 7, 'credits', 60
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
  perform public.viva_wallet_post(v_uid, 'plan_renewal', 60, v_key, 'Teste grátis do Pro (7 dias)');
  update public.viva_credit_wallets set cycle_granted = balance - reserved, cycle_used = 0, cycle_ref = v_key, cycle_started_at = now(),
    last_renewal_at = now(), next_renewal_at = v_sub.current_period_end, last_warning_level = 0, updated_at = now()
  where user_id = v_uid;
  return jsonb_build_object('ok', true, 'ends_at', v_sub.current_period_end, 'credits', 60);
end $$;
revoke all on function public.viva_start_pro_trial() from public, anon;
grant execute on function public.viva_start_pro_trial() to authenticated;

-- 2) Lembrete do 5º dia do teste (push no celular).
alter table public.viva_notification_deliveries drop constraint if exists viva_notification_deliveries_notification_type_check;
alter table public.viva_notification_deliveries add constraint viva_notification_deliveries_notification_type_check
  check (notification_type in ('morning','agenda','bill','test','evening','trial'));

-- 3) VIVA no WhatsApp para quem está no Free: 10 mensagens por semana (semana começa na segunda, horário de Brasília).
alter table public.viva_whatsapp_links
  add column if not exists free_week_start date,
  add column if not exists free_week_count integer not null default 0,
  add column if not exists trial_reminder_sent_at timestamptz;

-- Conta uma mensagem do Free e diz se ainda está dentro do limite. Só o servidor (service_role) chama.
create or replace function public.viva_whatsapp_free_use(p_user_id uuid, p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_week date := date_trunc('week', (now() at time zone 'America/Sao_Paulo'))::date; v_count integer;
begin
  update public.viva_whatsapp_links
     set free_week_count = case when free_week_start = v_week then free_week_count + 1 else 1 end,
         free_week_start = v_week, updated_at = now()
   where user_id = p_user_id
     and (free_week_start is distinct from v_week or free_week_count < p_limit)
  returning free_week_count into v_count;
  if v_count is null then
    return jsonb_build_object('allowed', false, 'used', p_limit, 'limit', p_limit, 'resets_on', v_week + 7);
  end if;
  return jsonb_build_object('allowed', true, 'used', v_count, 'limit', p_limit, 'left', p_limit - v_count, 'resets_on', v_week + 7);
end $$;
revoke all on function public.viva_whatsapp_free_use(uuid, integer) from public, anon, authenticated;
grant execute on function public.viva_whatsapp_free_use(uuid, integer) to service_role;
