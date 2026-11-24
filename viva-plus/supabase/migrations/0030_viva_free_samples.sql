-- Amostra grátis para quem está no Free: 5 áudios e 3 leituras de comprovante por mês (horário de Brasília),
-- sem gastar os créditos de conversa. Depois disso, áudio e foto ficam no Pro.
alter table public.viva_ai_reservations add column if not exists is_sample boolean not null default false;

create or replace function public.viva_reserve_ai_credits(p_feature text DEFAULT 'chat'::text, p_estimated_input_tokens integer DEFAULT 1000, p_prefer_cheap boolean DEFAULT false, p_operation text DEFAULT NULL::text, p_request_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_plan public.viva_plans%rowtype; v_control public.viva_ai_user_controls%rowtype; v_settings public.viva_admin_settings%rowtype;
  v_sub public.viva_subscriptions%rowtype; v_price public.viva_model_pricing%rowtype; v_wallet public.viva_credit_wallets%rowtype;
  v_op public.viva_credit_operations%rowtype; v_prior public.viva_ai_reservations%rowtype;
  v_month_cost numeric(14,6) := 0; v_month_reserved numeric(14,6) := 0; v_today_cost numeric(14,6) := 0; v_today_reserved numeric(14,6) := 0; v_estimate numeric(14,6) := 0;
  v_plan_id text := 'free'; v_paid boolean := false; v_op_key text; v_required integer;
  v_wallet_available integer; v_from_wallet integer; v_extra_needed integer; v_extra_available integer;
  v_model text; v_output integer; v_history integer; v_reservation uuid; v_row record; v_rate_count integer; v_key text;
  v_sample boolean := false; v_sample_used integer := 0; v_sample_limit integer := 0;
begin
  if v_uid is null then return jsonb_build_object('allowed',false,'reason','unauthenticated'); end if;
  if p_feature not in ('chat','voice','photo','radar') then return jsonb_build_object('allowed',false,'reason','invalid_feature'); end if;
  v_key := nullif(left(trim(coalesce(p_request_key,'')),80),'');
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text,0));

  if v_key is not null then
    select * into v_prior from public.viva_ai_reservations where user_id = v_uid and request_key = v_key;
    if found then
      if v_prior.status = 'settled' then
        return jsonb_build_object('allowed',false,'reason','duplicate','cached_answer',v_prior.response_text,'wallet',public.viva_wallet_snapshot(v_uid));
      elsif v_prior.status = 'reserved' then
        return jsonb_build_object('allowed',false,'reason','in_progress');
      else
        update public.viva_ai_reservations set request_key = null where id = v_prior.id;
      end if;
    end if;
  end if;

  select * into v_settings from public.viva_admin_settings where id = true;
  if coalesce(v_settings.ai_paused,false) then return jsonb_build_object('allowed',false,'reason','paused_global'); end if;
  select * into v_control from public.viva_ai_user_controls where user_id = v_uid;
  if coalesce(v_control.paused,false) then return jsonb_build_object('allowed',false,'reason','paused_user'); end if;

  insert into public.viva_ai_rate_limits(user_id,window_started_at,request_count) values (v_uid,now(),1)
  on conflict (user_id) do update set
    request_count = case when public.viva_ai_rate_limits.window_started_at < now() - interval '1 minute' then 1 else public.viva_ai_rate_limits.request_count + 1 end,
    window_started_at = case when public.viva_ai_rate_limits.window_started_at < now() - interval '1 minute' then now() else public.viva_ai_rate_limits.window_started_at end,
    updated_at = now()
  returning request_count into v_rate_count;
  if v_rate_count > coalesce(v_settings.rate_limit_per_minute,12) then return jsonb_build_object('allowed',false,'reason','rate_limit'); end if;

  if exists (select 1 from public.viva_ai_reservations where user_id = v_uid and status = 'reserved' and credits > 0 and created_at > now() - interval '2 minutes') then
    return jsonb_build_object('allowed',false,'reason','concurrent');
  end if;

  perform public.viva_sync_wallet(v_uid);
  v_sub := public.viva_effective_subscription(v_uid);
  if v_sub.id is not null then v_plan_id := v_sub.plan_id; v_paid := v_plan_id <> 'free'; end if;
  select * into v_plan from public.viva_plans where id = v_plan_id and enabled = true;
  if not found then select * into v_plan from public.viva_plans where id = 'free'; v_plan_id := 'free'; v_paid := false; end if;
  if p_feature = 'radar' and not v_plan.radar_enabled then return jsonb_build_object('allowed',false,'reason','feature_not_in_plan','required_plan','pro'); end if;
  if (p_feature = 'voice' and not v_plan.voice_enabled) or (p_feature = 'photo' and not v_plan.photo_enabled) then
    -- Amostra grátis do mês: 5 áudios e 3 comprovantes, sem gastar créditos.
    v_sample_limit := case p_feature when 'voice' then 5 else 3 end;
    select count(*) into v_sample_used from public.viva_ai_reservations
     where user_id = v_uid and feature = p_feature and is_sample and status <> 'released'
       and created_at >= (date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo');
    if v_sample_used >= v_sample_limit then
      return jsonb_build_object('allowed',false,'reason','feature_not_in_plan','required_plan','pro',
        'sample_used',v_sample_used,'sample_limit',v_sample_limit,'sample_feature',p_feature);
    end if;
    v_sample := true;
  end if;

  v_op_key := coalesce(nullif(p_operation,''), case p_feature when 'voice' then 'voice_message' when 'photo' then 'receipt_reading' when 'radar' then 'price_radar' else 'simple_question' end);
  select * into v_op from public.viva_credit_operations where key = v_op_key and enabled = true;
  if not found then select * into v_op from public.viva_credit_operations where key = 'simple_question'; v_op_key := 'simple_question'; end if;
  if v_op.pro_only and not v_paid then
    return jsonb_build_object('allowed',false,'reason','feature_not_in_plan','required_plan','pro','operation',v_op_key,'operation_label',v_op.label);
  end if;
  v_required := coalesce(v_op.credits,1);
  if v_sample then v_required := 0; end if;

  select coalesce(sum(cost_brl),0) into v_month_cost from public.viva_usage_log where user_id = v_uid and created_at >= date_trunc('month',now());
  select coalesce(sum(estimated_cost_brl),0) into v_month_reserved from public.viva_ai_reservations where user_id = v_uid and status = 'reserved' and created_at >= date_trunc('month',now());
  select coalesce(sum(cost_brl),0) into v_today_cost from public.viva_usage_log where created_at >= ((now() at time zone 'America/Sao_Paulo')::date::timestamp at time zone 'America/Sao_Paulo');
  select coalesce(sum(estimated_cost_brl),0) into v_today_reserved from public.viva_ai_reservations where status = 'reserved' and created_at >= ((now() at time zone 'America/Sao_Paulo')::date::timestamp at time zone 'America/Sao_Paulo');
  v_model := case when coalesce(v_settings.automatic_mode,false) and p_prefer_cheap then 'cheap' else coalesce(v_control.model_key_override,v_plan.model_key,'cheap') end;
  if v_paid and v_plan.monthly_price_brl > 0 and v_month_cost + v_month_reserved >= v_plan.monthly_price_brl * 0.60 then v_model := 'cheap'; end if;
  select * into v_price from public.viva_model_pricing where model_key = v_model and enabled = true;
  if not found or v_price.input_usd_per_million <= 0 or v_price.output_usd_per_million <= 0 then return jsonb_build_object('allowed',false,'reason','model_pricing_not_configured'); end if;
  v_output := coalesce(v_control.max_output_tokens_override,v_plan.max_output_tokens,300);
  v_history := coalesce(v_control.history_messages_override,v_plan.history_messages,8);
  v_estimate := ((greatest(1,least(20000,p_estimated_input_tokens)) * v_price.input_usd_per_million + v_output * v_price.output_usd_per_million) / 1000000) * coalesce(v_settings.usd_brl_rate,6.5) * 1.25;
  if v_paid and v_plan.monthly_price_brl > 0 and v_month_cost + v_month_reserved + v_estimate > v_plan.monthly_price_brl then return jsonb_build_object('allowed',false,'reason','monthly_cost_cap'); end if;
  if not v_paid and v_today_cost + v_today_reserved + v_estimate > coalesce(v_settings.global_daily_budget_brl,50) then return jsonb_build_object('allowed',false,'reason','global_budget'); end if;

  select * into v_wallet from public.viva_credit_wallets where user_id = v_uid for update;
  v_wallet_available := greatest(0, v_wallet.balance - v_wallet.reserved);
  select coalesce(sum(remaining_credits),0) into v_extra_available from public.viva_extra_credits where user_id = v_uid and payment_status = 'paid' and remaining_credits > 0;
  if v_wallet_available + v_extra_available < v_required then
    return jsonb_build_object('allowed',false,'reason','no_credits','plan_id',v_plan_id,'is_free',not v_paid,'credits_required',v_required,
      'operation',v_op_key,'operation_label',v_op.label,'wallet',public.viva_wallet_snapshot(v_uid),
      'used_credits',v_wallet.cycle_used,'daily_credits',v_wallet.cycle_granted,'extra_credits',v_extra_available,'reset_at',v_wallet.next_renewal_at);
  end if;
  v_from_wallet := least(v_wallet_available, v_required);
  v_extra_needed := v_required - v_from_wallet;
  update public.viva_credit_wallets set reserved = reserved + v_from_wallet, updated_at = now() where user_id = v_uid;
  if v_extra_needed > 0 then
    for v_row in select id, remaining_credits from public.viva_extra_credits where user_id = v_uid and payment_status = 'paid' and remaining_credits > 0 order by created_at for update loop
      exit when v_extra_needed <= 0;
      update public.viva_extra_credits set remaining_credits = remaining_credits - least(remaining_credits, v_extra_needed) where id = v_row.id;
      v_extra_needed := v_extra_needed - least(v_row.remaining_credits, v_extra_needed);
    end loop;
  end if;
  insert into public.viva_ai_reservations(user_id,feature,credits,daily_credits_reserved,extra_credits_reserved,wallet_credits_reserved,model_key,max_output_tokens,history_messages,estimated_cost_brl,operation_key,request_key,is_sample)
  values (v_uid,p_feature,v_required,0,v_required - v_from_wallet,v_from_wallet,v_model,v_output,v_history,v_estimate,v_op_key,v_key,v_sample)
  returning id into v_reservation;
  return jsonb_build_object('allowed',true,'reservation_id',v_reservation,'credits_cost',v_required,'operation',v_op_key,'operation_label',v_op.label,
    'model_key',v_model,'model_id',v_price.model_id,'input_usd_per_million',v_price.input_usd_per_million,'output_usd_per_million',v_price.output_usd_per_million,
    'usd_brl_rate',coalesce(v_settings.usd_brl_rate,6.5),'max_output_tokens',v_output,'history_messages',v_history,'plan_id',v_plan_id,'is_free',not v_paid,
    'automatic_mode',v_settings.automatic_mode,'estimated_cost_brl',v_estimate,
    'daily_used',v_wallet.cycle_used + v_required,'daily_limit',v_wallet.cycle_granted,'warning_80',false,
    'sample',v_sample,'sample_limit',v_sample_limit,'sample_left',case when v_sample then greatest(0, v_sample_limit - v_sample_used - 1) else null end);
end $function$;
