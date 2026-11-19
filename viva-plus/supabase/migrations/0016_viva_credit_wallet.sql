-- VIVA+ — Carteira mensal de créditos de IA (planos Free / Pro)
-- Evolui o motor de créditos existente (viva_reserve_ai_credits / viva_settle_ai_usage /
-- viva_release_ai_reservation / viva_get_ai_quota) de créditos DIÁRIOS para uma CARTEIRA
-- mensal compartilhada entre o assistente financeiro e o Personal com IA.
-- Mantém: viva_plans, viva_subscriptions, viva_payments, viva_ai_reservations, viva_usage_log,
-- viva_extra_credits, rate limit, teto de custo e pausa global/por usuário.

-- ---------------------------------------------------------------------------
-- 1. Planos: créditos mensais, bônus de cadastro, histórico e visibilidade
-- ---------------------------------------------------------------------------
alter table public.viva_plans
  add column if not exists monthly_credits integer not null default 0 check (monthly_credits between 0 and 100000),
  add column if not exists signup_credits integer not null default 0 check (signup_credits between 0 and 100000),
  add column if not exists history_days integer check (history_days is null or history_days between 1 and 3650),
  add column if not exists rollover_credits boolean not null default false,
  add column if not exists is_public boolean not null default true;

update public.viva_plans set monthly_credits=10, signup_credits=20, history_days=30, rollover_credits=false, is_public=true, name='Free' where id='free';
update public.viva_plans set monthly_credits=150, signup_credits=0, history_days=null, rollover_credits=false, is_public=true, monthly_price_brl=29.90, annual_price_brl=299.00 where id='pro';
-- Plano legado: continua valendo para quem já assina, mas sai da vitrine.
update public.viva_plans set monthly_credits=80, signup_credits=0, history_days=90, rollover_credits=false, is_public=false where id='essential';

-- ---------------------------------------------------------------------------
-- 2. Configurações gerais (proteção financeira)
-- ---------------------------------------------------------------------------
alter table public.viva_admin_settings
  add column if not exists rate_limit_per_minute integer not null default 12 check (rate_limit_per_minute between 1 and 600),
  add column if not exists abnormal_credits_per_hour integer not null default 40 check (abnormal_credits_per_hour between 1 and 100000),
  add column if not exists warn_threshold_1 integer not null default 70 check (warn_threshold_1 between 1 and 99),
  add column if not exists warn_threshold_2 integer not null default 90 check (warn_threshold_2 between 1 and 99);

-- ---------------------------------------------------------------------------
-- 3. Custo por operação (configurável pelo admin)
-- ---------------------------------------------------------------------------
create table if not exists public.viva_credit_operations (
  key text primary key check (key ~ '^[a-z_]{2,40}$'),
  label text not null check (char_length(label) between 2 and 80),
  description text,
  credits integer not null check (credits between 0 and 1000),
  pro_only boolean not null default false,
  enabled boolean not null default true,
  sort integer not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.viva_credit_operations(key,label,description,credits,pro_only,sort) values
 ('simple_question','Pergunta simples','Perguntas e registros rápidos com a VIVA ou o Personal.',1,false,10),
 ('elaborate_answer','Resposta elaborada','Respostas longas, explicações e orientações detalhadas.',2,false,20),
 ('financial_analysis','Análise financeira','Análise de gastos, saldo, metas e decisões de compra.',3,false,30),
 ('debt_planning','Planejamento de dívidas','Organização e plano para quitar dívidas.',4,false,40),
 ('workout_creation','Criação de treino','Montagem de treino personalizado pelo Personal.',3,false,50),
 ('personalized_analysis','Análise personalizada','Análise completa e personalizada da sua evolução.',5,true,60),
 ('voice_message','Mensagem de voz','Transcrição de áudio enviado à VIVA.',2,false,70),
 ('receipt_reading','Leitura de comprovante','Leitura de nota fiscal ou comprovante por foto/PDF.',2,false,80),
 ('price_radar','Radar de preços','Pesquisa e comparação de preços.',3,false,90),
 ('auto_insight','Resumo automático','Resumo gerado sozinho ao abrir a tela. Nunca é cobrado do usuário.',0,false,100)
on conflict (key) do nothing;
alter table public.viva_credit_operations enable row level security;
drop policy if exists viva_credit_operations_read on public.viva_credit_operations;
create policy viva_credit_operations_read on public.viva_credit_operations for select to authenticated using (true);
drop policy if exists viva_credit_operations_admin on public.viva_credit_operations;
create policy viva_credit_operations_admin on public.viva_credit_operations for update to authenticated using (public.viva_is_admin()) with check (public.viva_is_admin());
revoke all on public.viva_credit_operations from anon, authenticated;
grant select, update on public.viva_credit_operations to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Carteira e extrato (somente leitura para o usuário; escrita só via funções)
-- ---------------------------------------------------------------------------
create table if not exists public.viva_credit_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text not null default 'free' references public.viva_plans(id),
  balance integer not null default 0 check (balance >= 0),
  reserved integer not null default 0 check (reserved >= 0),
  total_received integer not null default 0,
  total_used integer not null default 0,
  cycle_granted integer not null default 0,
  cycle_used integer not null default 0,
  cycle_ref text,
  cycle_started_at timestamptz,
  last_renewal_at timestamptz,
  next_renewal_at timestamptz,
  last_warning_level integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint viva_credit_wallets_reserved_le_balance check (reserved <= balance)
);
create index if not exists viva_credit_wallets_next_renewal on public.viva_credit_wallets(next_renewal_at);
alter table public.viva_credit_wallets enable row level security;
drop policy if exists viva_credit_wallets_read on public.viva_credit_wallets;
create policy viva_credit_wallets_read on public.viva_credit_wallets for select to authenticated using (user_id = (select auth.uid()) or public.viva_is_admin());
revoke all on public.viva_credit_wallets from anon, authenticated;
grant select on public.viva_credit_wallets to authenticated;

create table if not exists public.viva_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('signup_bonus','monthly_renewal','plan_renewal','consumption','expiration','admin_grant','admin_revoke','extra_purchase','adjustment')),
  amount integer not null,
  balance_after integer not null check (balance_after >= 0),
  plan_id text,
  operation_key text,
  reservation_id uuid,
  idempotency_key text not null,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  cost_brl numeric(14,6) not null default 0,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz not null default now(),
  constraint viva_credit_ledger_idempotency unique (idempotency_key)
);
create index if not exists viva_credit_ledger_user_time on public.viva_credit_ledger(user_id, created_at desc);
alter table public.viva_credit_ledger enable row level security;
drop policy if exists viva_credit_ledger_read on public.viva_credit_ledger;
create policy viva_credit_ledger_read on public.viva_credit_ledger for select to authenticated using (user_id = (select auth.uid()) or public.viva_is_admin());
revoke all on public.viva_credit_ledger from anon, authenticated;
grant select on public.viva_credit_ledger to authenticated;

-- Reservas: operação, parte da carteira, chave de idempotência e resposta guardada.
alter table public.viva_ai_reservations
  add column if not exists operation_key text,
  add column if not exists wallet_credits_reserved integer not null default 0 check (wallet_credits_reserved >= 0),
  add column if not exists request_key text,
  add column if not exists response_text text;
create unique index if not exists viva_ai_reservations_request_key on public.viva_ai_reservations(user_id, request_key) where request_key is not null;
create index if not exists viva_ai_reservations_open on public.viva_ai_reservations(status, created_at) where status = 'reserved';

-- ---------------------------------------------------------------------------
-- 5. Funções internas
-- ---------------------------------------------------------------------------
-- Plano efetivo: assinatura ativa e dentro do período, ou cancelada mas ainda no período pago.
create or replace function public.viva_effective_subscription(p_uid uuid)
returns public.viva_subscriptions language sql stable security definer set search_path = '' as $$
  select s.* from public.viva_subscriptions s
  where s.user_id = p_uid
    and ((s.status in ('active','trialing') and (s.current_period_end is null or s.current_period_end > now()))
      or (s.status = 'canceled' and s.current_period_end is not null and s.current_period_end > now()))
  order by s.current_period_end desc nulls last, s.created_at desc
  limit 1;
$$;

-- Lança um movimento no extrato (idempotente pela chave). Retorna false se a chave já existia.
create or replace function public.viva_wallet_post(p_uid uuid, p_kind text, p_amount integer, p_key text, p_description text default null,
  p_operation text default null, p_reservation uuid default null, p_tokens_in integer default 0, p_tokens_out integer default 0,
  p_cost_brl numeric default 0, p_actor uuid default null, p_metadata jsonb default '{}'::jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_wallet public.viva_credit_wallets%rowtype; v_new integer;
begin
  if exists (select 1 from public.viva_credit_ledger where idempotency_key = p_key) then return false; end if;
  select * into v_wallet from public.viva_credit_wallets where user_id = p_uid for update;
  if not found then raise exception 'wallet_not_found'; end if;
  v_new := v_wallet.balance + p_amount;
  if v_new < 0 then raise exception 'negative_balance' using errcode = '23514'; end if;
  insert into public.viva_credit_ledger(user_id,kind,amount,balance_after,plan_id,operation_key,reservation_id,idempotency_key,tokens_in,tokens_out,cost_brl,description,metadata,actor_id)
  values (p_uid,p_kind,p_amount,v_new,v_wallet.plan_id,p_operation,p_reservation,p_key,greatest(0,coalesce(p_tokens_in,0)),greatest(0,coalesce(p_tokens_out,0)),greatest(0,coalesce(p_cost_brl,0)),left(p_description,240),coalesce(p_metadata,'{}'::jsonb),p_actor)
  on conflict (idempotency_key) do nothing;
  if not found then return false; end if;
  update public.viva_credit_wallets set
    balance = v_new,
    total_received = total_received + greatest(p_amount,0) * (case when p_kind in ('signup_bonus','monthly_renewal','plan_renewal','admin_grant','extra_purchase','adjustment') then 1 else 0 end),
    cycle_granted = case when p_kind in ('admin_grant','extra_purchase','adjustment') then cycle_granted + greatest(p_amount,0)
                         when p_kind = 'admin_revoke' then greatest(0, cycle_granted + p_amount) else cycle_granted end,
    updated_at = now()
  where user_id = p_uid;
  return true;
end $$;

-- Inicia um ciclo de créditos (renovação mensal, novo ciclo Pro, troca de plano). Idempotente.
create or replace function public.viva_wallet_start_cycle(p_uid uuid, p_plan_id text, p_key text, p_next timestamptz)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_wallet public.viva_credit_wallets%rowtype; v_plan public.viva_plans%rowtype; v_expire integer; v_kind text;
begin
  select * into v_wallet from public.viva_credit_wallets where user_id = p_uid for update;
  if not found then return false; end if;
  if exists (select 1 from public.viva_credit_ledger where idempotency_key = p_key) then return false; end if;
  select * into v_plan from public.viva_plans where id = p_plan_id;
  if not found then select * into v_plan from public.viva_plans where id = 'free'; end if;
  update public.viva_credit_wallets set plan_id = v_plan.id where user_id = p_uid;
  if not v_plan.rollover_credits then
    v_expire := v_wallet.balance - v_wallet.reserved;
    if v_expire > 0 then
      perform public.viva_wallet_post(p_uid,'expiration',-v_expire,p_key||':expire','Créditos não utilizados do ciclo anterior');
    end if;
  end if;
  v_kind := case when v_plan.id = 'free' then 'monthly_renewal' else 'plan_renewal' end;
  perform public.viva_wallet_post(p_uid,v_kind,v_plan.monthly_credits,p_key,
    case when v_plan.id = 'free' then 'Renovação mensal do plano Free' else 'Créditos do ciclo do plano '||v_plan.name end);
  update public.viva_credit_wallets set
    cycle_granted = case when v_plan.rollover_credits then balance - reserved else v_plan.monthly_credits end,
    cycle_used = 0, cycle_ref = p_key, cycle_started_at = now(), last_renewal_at = now(),
    next_renewal_at = p_next, last_warning_level = 0, updated_at = now()
  where user_id = p_uid;
  return true;
end $$;

-- Cria a carteira (com o bônus de cadastro do plano Free) se ainda não existir.
create or replace function public.viva_ensure_wallet(p_uid uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_free public.viva_plans%rowtype; v_sub public.viva_subscriptions%rowtype;
begin
  if p_uid is null then return; end if;
  if exists (select 1 from public.viva_credit_wallets where user_id = p_uid) then return; end if;
  select * into v_free from public.viva_plans where id = 'free';
  insert into public.viva_credit_wallets(user_id, plan_id, cycle_ref, cycle_started_at, last_renewal_at, next_renewal_at)
  values (p_uid, 'free', 'signup:'||p_uid, now(), now(), now() + interval '1 month')
  on conflict (user_id) do nothing;
  if not found then return; end if;
  v_sub := public.viva_effective_subscription(p_uid);
  if v_sub.id is null and coalesce(v_free.signup_credits,0) > 0 then
    perform public.viva_wallet_post(p_uid,'signup_bonus',v_free.signup_credits,'signup:'||p_uid,'Créditos de boas-vindas');
    update public.viva_credit_wallets set cycle_granted = v_free.signup_credits where user_id = p_uid;
  end if;
end $$;

-- Sincroniza a carteira com o plano efetivo e executa a renovação vencida. Idempotente.
create or replace function public.viva_sync_wallet(p_uid uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_wallet public.viva_credit_wallets%rowtype; v_sub public.viva_subscriptions%rowtype; v_start timestamptz; v_key text; v_next timestamptz; v_guard integer := 0;
begin
  perform public.viva_ensure_wallet(p_uid);
  select * into v_wallet from public.viva_credit_wallets where user_id = p_uid for update;
  if not found then return; end if;
  v_sub := public.viva_effective_subscription(p_uid);

  if v_sub.id is not null and v_sub.plan_id <> 'free' then
    -- Ciclo pago confirmado: uma concessão por período de assinatura.
    v_start := coalesce(v_sub.current_period_start, v_sub.created_at);
    v_key := 'sub:'||v_sub.id||':'||to_char(v_start at time zone 'UTC','YYYYMMDDHH24MI');
    if not exists (select 1 from public.viva_credit_ledger where idempotency_key = v_key) then
      v_next := least(v_start + interval '1 month', coalesce(v_sub.current_period_end, v_start + interval '1 month'));
      if v_next <= now() then v_next := coalesce(v_sub.current_period_end, now() + interval '1 month'); end if;
      perform public.viva_wallet_start_cycle(p_uid, v_sub.plan_id, v_key, v_next);
      return;
    end if;
    -- Assinatura anual (ou período maior que 1 mês): renova mês a mês dentro do período pago.
    if v_wallet.next_renewal_at is not null and v_wallet.next_renewal_at <= now()
       and v_sub.current_period_end is not null and v_sub.current_period_end > now() then
      v_key := 'sub:'||v_sub.id||':'||to_char(v_wallet.next_renewal_at at time zone 'UTC','YYYYMMDDHH24MI');
      perform public.viva_wallet_start_cycle(p_uid, v_sub.plan_id, v_key, least(v_wallet.next_renewal_at + interval '1 month', v_sub.current_period_end));
    end if;
    return;
  end if;

  -- Sem assinatura paga válida: plano Free.
  if v_wallet.plan_id <> 'free' then
    v_key := 'free:'||p_uid||':downgrade:'||coalesce(v_wallet.cycle_ref,'none');
    perform public.viva_wallet_start_cycle(p_uid, 'free', v_key, now() + interval '1 month');
    return;
  end if;
  if v_wallet.next_renewal_at is not null and v_wallet.next_renewal_at <= now() then
    v_next := v_wallet.next_renewal_at;
    while v_next <= now() and v_guard < 240 loop v_next := v_next + interval '1 month'; v_guard := v_guard + 1; end loop;
    v_key := 'free:'||p_uid||':'||to_char(v_wallet.next_renewal_at at time zone 'UTC','YYYYMMDD');
    perform public.viva_wallet_start_cycle(p_uid, 'free', v_key, v_next);
  end if;
end $$;

-- Retrato da carteira para telas e respostas da API.
create or replace function public.viva_wallet_snapshot(p_uid uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_wallet public.viva_credit_wallets%rowtype; v_plan public.viva_plans%rowtype; v_settings public.viva_admin_settings%rowtype;
  v_extra integer := 0; v_available integer; v_base integer; v_pct integer; v_level integer;
begin
  select * into v_wallet from public.viva_credit_wallets where user_id = p_uid;
  if not found then return null; end if;
  select * into v_plan from public.viva_plans where id = v_wallet.plan_id;
  select * into v_settings from public.viva_admin_settings where id = true;
  select coalesce(sum(remaining_credits),0) into v_extra from public.viva_extra_credits where user_id = p_uid and payment_status = 'paid';
  v_available := greatest(0, v_wallet.balance - v_wallet.reserved);
  v_base := greatest(v_wallet.cycle_granted, v_available, 1);
  v_pct := least(100, greatest(0, round((1 - v_available::numeric / v_base) * 100)))::int;
  v_level := case when v_available + v_extra <= 0 then 100
                  when v_pct >= coalesce(v_settings.warn_threshold_2,90) then 90
                  when v_pct >= coalesce(v_settings.warn_threshold_1,70) then 70 else 0 end;
  return jsonb_build_object(
    'plan_id', v_wallet.plan_id, 'plan_name', v_plan.name, 'is_free', v_wallet.plan_id = 'free',
    'balance', v_wallet.balance, 'reserved', v_wallet.reserved, 'available', v_available, 'extra_credits', v_extra,
    'cycle_granted', v_wallet.cycle_granted, 'cycle_used', v_wallet.cycle_used, 'percent_used', v_pct, 'warning_level', v_level,
    'total_received', v_wallet.total_received, 'total_used', v_wallet.total_used,
    'last_renewal_at', v_wallet.last_renewal_at, 'next_renewal_at', v_wallet.next_renewal_at,
    'monthly_credits', v_plan.monthly_credits, 'history_days', v_plan.history_days);
end $$;

-- ---------------------------------------------------------------------------
-- 6. Motor de créditos (mesmos nomes usados pelo app; novos parâmetros opcionais)
-- ---------------------------------------------------------------------------
drop function if exists public.viva_reserve_ai_credits(text, integer, boolean);
create or replace function public.viva_reserve_ai_credits(p_feature text default 'chat', p_estimated_input_tokens integer default 1000,
  p_prefer_cheap boolean default false, p_operation text default null, p_request_key text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_plan public.viva_plans%rowtype; v_control public.viva_ai_user_controls%rowtype; v_settings public.viva_admin_settings%rowtype;
  v_sub public.viva_subscriptions%rowtype; v_price public.viva_model_pricing%rowtype; v_wallet public.viva_credit_wallets%rowtype;
  v_op public.viva_credit_operations%rowtype; v_prior public.viva_ai_reservations%rowtype;
  v_month_cost numeric(14,6) := 0; v_month_reserved numeric(14,6) := 0; v_today_cost numeric(14,6) := 0; v_today_reserved numeric(14,6) := 0; v_estimate numeric(14,6) := 0;
  v_plan_id text := 'free'; v_paid boolean := false; v_op_key text; v_required integer;
  v_wallet_available integer; v_from_wallet integer; v_extra_needed integer; v_extra_available integer;
  v_model text; v_output integer; v_history integer; v_reservation uuid; v_row record; v_rate_count integer; v_key text;
begin
  if v_uid is null then return jsonb_build_object('allowed',false,'reason','unauthenticated'); end if;
  if p_feature not in ('chat','voice','photo','radar') then return jsonb_build_object('allowed',false,'reason','invalid_feature'); end if;
  v_key := nullif(left(trim(coalesce(p_request_key,'')),80),'');
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text,0));

  -- Repetição da mesma requisição (atualização de página, reenvio, falha de conexão): nunca cobra duas vezes.
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

  -- Limite de requisições por minuto (proteção contra spam).
  insert into public.viva_ai_rate_limits(user_id,window_started_at,request_count) values (v_uid,now(),1)
  on conflict (user_id) do update set
    request_count = case when public.viva_ai_rate_limits.window_started_at < now() - interval '1 minute' then 1 else public.viva_ai_rate_limits.request_count + 1 end,
    window_started_at = case when public.viva_ai_rate_limits.window_started_at < now() - interval '1 minute' then now() else public.viva_ai_rate_limits.window_started_at end,
    updated_at = now()
  returning request_count into v_rate_count;
  if v_rate_count > coalesce(v_settings.rate_limit_per_minute,12) then return jsonb_build_object('allowed',false,'reason','rate_limit'); end if;

  -- Requisições simultâneas: só uma operação de IA em andamento por usuário.
  if exists (select 1 from public.viva_ai_reservations where user_id = v_uid and status = 'reserved' and credits > 0 and created_at > now() - interval '2 minutes') then
    return jsonb_build_object('allowed',false,'reason','concurrent');
  end if;

  perform public.viva_sync_wallet(v_uid);
  v_sub := public.viva_effective_subscription(v_uid);
  if v_sub.id is not null then v_plan_id := v_sub.plan_id; v_paid := v_plan_id <> 'free'; end if;
  select * into v_plan from public.viva_plans where id = v_plan_id and enabled = true;
  if not found then select * into v_plan from public.viva_plans where id = 'free'; v_plan_id := 'free'; v_paid := false; end if;
  if p_feature = 'radar' and not v_plan.radar_enabled then return jsonb_build_object('allowed',false,'reason','feature_not_in_plan','required_plan','pro'); end if;
  if p_feature = 'voice' and not v_plan.voice_enabled then return jsonb_build_object('allowed',false,'reason','feature_not_in_plan','required_plan','pro'); end if;
  if p_feature = 'photo' and not v_plan.photo_enabled then return jsonb_build_object('allowed',false,'reason','feature_not_in_plan','required_plan','pro'); end if;

  -- Custo da operação (tabela configurável).
  v_op_key := coalesce(nullif(p_operation,''), case p_feature when 'voice' then 'voice_message' when 'photo' then 'receipt_reading' when 'radar' then 'price_radar' else 'simple_question' end);
  select * into v_op from public.viva_credit_operations where key = v_op_key and enabled = true;
  if not found then select * into v_op from public.viva_credit_operations where key = 'simple_question'; v_op_key := 'simple_question'; end if;
  if v_op.pro_only and not v_paid then
    return jsonb_build_object('allowed',false,'reason','feature_not_in_plan','required_plan','pro','operation',v_op_key,'operation_label',v_op.label);
  end if;
  v_required := coalesce(v_op.credits,1);

  -- Tetos de custo (mantidos do motor anterior).
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

  -- Saldo: carteira primeiro, depois créditos extras pagos. Nunca negativo.
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
  insert into public.viva_ai_reservations(user_id,feature,credits,daily_credits_reserved,extra_credits_reserved,wallet_credits_reserved,model_key,max_output_tokens,history_messages,estimated_cost_brl,operation_key,request_key)
  values (v_uid,p_feature,v_required,0,v_required - v_from_wallet,v_from_wallet,v_model,v_output,v_history,v_estimate,v_op_key,v_key)
  returning id into v_reservation;
  return jsonb_build_object('allowed',true,'reservation_id',v_reservation,'credits_cost',v_required,'operation',v_op_key,'operation_label',v_op.label,
    'model_key',v_model,'model_id',v_price.model_id,'input_usd_per_million',v_price.input_usd_per_million,'output_usd_per_million',v_price.output_usd_per_million,
    'usd_brl_rate',coalesce(v_settings.usd_brl_rate,6.5),'max_output_tokens',v_output,'history_messages',v_history,'plan_id',v_plan_id,'is_free',not v_paid,
    'automatic_mode',v_settings.automatic_mode,'estimated_cost_brl',v_estimate,
    'daily_used',v_wallet.cycle_used + v_required,'daily_limit',v_wallet.cycle_granted,'warning_80',false);
end $$;

drop function if exists public.viva_settle_ai_usage(uuid, text, integer, integer, numeric, numeric);
create or replace function public.viva_settle_ai_usage(p_reservation_id uuid, p_model text, p_tokens_in integer, p_tokens_out integer,
  p_cost_usd numeric, p_cost_brl numeric, p_response_text text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_res public.viva_ai_reservations%rowtype; v_settings public.viva_admin_settings%rowtype; v_hour integer; v_snap jsonb; v_op_label text;
begin
  select * into v_res from public.viva_ai_reservations where id = p_reservation_id and user_id = v_uid for update;
  if not found or v_res.status <> 'reserved' then raise exception 'Reserva inválida ou já finalizada'; end if;
  select label into v_op_label from public.viva_credit_operations where key = v_res.operation_key;
  if v_res.wallet_credits_reserved > 0 then
    update public.viva_credit_wallets set reserved = greatest(0, reserved - v_res.wallet_credits_reserved), updated_at = now() where user_id = v_uid;
  end if;
  perform public.viva_wallet_post(v_uid,'consumption',-v_res.wallet_credits_reserved,'res:'||v_res.id,coalesce(v_op_label,'Uso de IA'),
    v_res.operation_key,v_res.id,p_tokens_in,p_tokens_out,p_cost_brl,null,
    jsonb_build_object('feature',v_res.feature,'model',p_model,'credits',v_res.credits,'extra_credits',v_res.extra_credits_reserved));
  update public.viva_credit_wallets set total_used = total_used + v_res.credits, cycle_used = cycle_used + v_res.wallet_credits_reserved, updated_at = now() where user_id = v_uid;
  -- Reservas antigas do modelo diário (compatibilidade).
  if v_res.daily_credits_reserved > 0 then
    update public.viva_credit_usage_daily set reserved_credits = greatest(0,reserved_credits - v_res.daily_credits_reserved), used_credits = used_credits + v_res.daily_credits_reserved, updated_at = now() where user_id = v_uid and usage_date = v_res.usage_date;
  end if;
  insert into public.viva_usage_log(user_id,reservation_id,model,feature,tokens_in,tokens_out,cost_usd,cost_brl,credits)
  values (v_uid,p_reservation_id,p_model,coalesce(v_res.operation_key,v_res.feature),greatest(0,p_tokens_in),greatest(0,p_tokens_out),greatest(0,p_cost_usd),greatest(0,p_cost_brl),v_res.credits);
  update public.viva_ai_reservations set status = 'settled', settled_at = now(), response_text = left(p_response_text, 20000) where id = p_reservation_id;
  -- Alerta de consumo anormal (no máximo um por usuário por hora).
  select * into v_settings from public.viva_admin_settings where id = true;
  select coalesce(sum(credits),0) into v_hour from public.viva_usage_log where user_id = v_uid and created_at > now() - interval '1 hour';
  if v_hour >= coalesce(v_settings.abnormal_credits_per_hour,40)
     and not exists (select 1 from public.viva_admin_alerts where alert_type = 'abnormal_usage' and detail like '%'||v_uid::text||'%' and created_at > now() - interval '1 hour') then
    insert into public.viva_admin_alerts(alert_type,detail) values ('abnormal_usage', 'Usuário '||v_uid||' consumiu '||v_hour||' créditos na última hora.');
  end if;
  v_snap := public.viva_wallet_snapshot(v_uid);
  update public.viva_credit_wallets set last_warning_level = coalesce((v_snap->>'warning_level')::int,0) where user_id = v_uid;
  return jsonb_build_object('settled',true,'credits',v_res.credits,'operation',v_res.operation_key,'wallet',v_snap);
end $$;

create or replace function public.viva_release_ai_reservation(p_reservation_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_res public.viva_ai_reservations%rowtype; v_row record; v_restore integer; v_restore_now integer;
begin
  select * into v_res from public.viva_ai_reservations where id = p_reservation_id and (user_id = v_uid or v_uid is null) for update;
  if not found or v_res.status <> 'reserved' then return false; end if;
  if v_res.wallet_credits_reserved > 0 then
    update public.viva_credit_wallets set reserved = greatest(0, reserved - v_res.wallet_credits_reserved), updated_at = now() where user_id = v_res.user_id;
  end if;
  if v_res.daily_credits_reserved > 0 then
    update public.viva_credit_usage_daily set reserved_credits = greatest(0,reserved_credits - v_res.daily_credits_reserved), updated_at = now() where user_id = v_res.user_id and usage_date = v_res.usage_date;
  end if;
  v_restore := v_res.extra_credits_reserved;
  for v_row in select id, package_credits, remaining_credits from public.viva_extra_credits where user_id = v_res.user_id and payment_status = 'paid' order by created_at desc for update loop
    exit when v_restore <= 0;
    v_restore_now := least(v_row.package_credits - v_row.remaining_credits, v_restore);
    update public.viva_extra_credits set remaining_credits = remaining_credits + v_restore_now where id = v_row.id;
    v_restore := v_restore - v_restore_now;
  end loop;
  update public.viva_ai_reservations set status = 'released', settled_at = now() where id = p_reservation_id;
  return true;
end $$;

create or replace function public.viva_get_ai_quota()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_snap jsonb;
begin
  if v_uid is null then return jsonb_build_object('authenticated',false); end if;
  perform public.viva_sync_wallet(v_uid);
  v_snap := public.viva_wallet_snapshot(v_uid);
  return v_snap || jsonb_build_object('authenticated',true,
    -- chaves antigas usadas pelas telas existentes
    'used', (v_snap->>'cycle_used')::int, 'daily_limit', (v_snap->>'cycle_granted')::int, 'remaining', (v_snap->>'available')::int,
    'used_credits', (v_snap->>'cycle_used')::int, 'daily_credits', (v_snap->>'cycle_granted')::int, 'reset_at', v_snap->'next_renewal_at');
end $$;

-- Extrato do próprio usuário (respeita o histórico do plano: Free limitado, Pro completo).
create or replace function public.viva_get_credit_history(p_limit integer default 50, p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_days integer; v_since timestamptz;
begin
  if v_uid is null then return '[]'::jsonb; end if;
  select p.history_days into v_days from public.viva_credit_wallets w join public.viva_plans p on p.id = w.plan_id where w.user_id = v_uid;
  v_since := case when v_days is null then '-infinity'::timestamptz else now() - make_interval(days => v_days) end;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
    select l.id, l.kind, l.amount, l.balance_after, l.operation_key, l.description, l.created_at, o.label as operation_label
    from public.viva_credit_ledger l left join public.viva_credit_operations o on o.key = l.operation_key
    where l.user_id = v_uid and l.created_at >= v_since and not (l.kind = 'consumption' and l.amount = 0 and coalesce((l.metadata->>'credits')::int,0) = 0)
    order by l.created_at desc limit greatest(1,least(p_limit,200)) offset greatest(0,p_offset)) x), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------------
-- 7. Pagamentos e renovação no servidor
-- ---------------------------------------------------------------------------
-- Chamado pelo webhook (service role) depois que o pagamento é confirmado.
create or replace function public.viva_grant_subscription_cycle(p_subscription_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
  select user_id into v_uid from public.viva_subscriptions where id = p_subscription_id;
  if v_uid is null then return jsonb_build_object('ok',false,'reason','subscription_not_found'); end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text,0));
  perform public.viva_sync_wallet(v_uid);
  return jsonb_build_object('ok',true,'wallet',public.viva_wallet_snapshot(v_uid));
end $$;

-- Job do pg_cron: libera reservas travadas e executa todas as renovações vencidas.
create or replace function public.viva_run_credit_renewals()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row record; v_released integer := 0; v_synced integer := 0; v_failed integer := 0;
begin
  for v_row in select id from public.viva_ai_reservations where status = 'reserved' and created_at < now() - interval '15 minutes' loop
    if public.viva_release_ai_reservation(v_row.id) then v_released := v_released + 1; end if;
  end loop;
  for v_row in
    select w.user_id from public.viva_credit_wallets w
    where w.next_renewal_at <= now()
       or (w.plan_id <> 'free' and (select s.id from public.viva_effective_subscription(w.user_id) s) is null)
       or exists (select 1 from public.viva_subscriptions s where s.user_id = w.user_id and s.status = 'active' and s.plan_id <> w.plan_id
                  and (s.current_period_end is null or s.current_period_end > now()))
  loop
    begin
      perform pg_advisory_xact_lock(hashtextextended(v_row.user_id::text,0));
      perform public.viva_sync_wallet(v_row.user_id);
      v_synced := v_synced + 1;
    exception when others then
      v_failed := v_failed + 1;
      insert into public.viva_admin_alerts(alert_type,detail) values ('credit_renewal_failed', 'Usuário '||v_row.user_id||': '||left(sqlerrm,300));
    end;
  end loop;
  return jsonb_build_object('released',v_released,'synced',v_synced,'failed',v_failed);
end $$;

-- Novo cadastro do VIVA+ (termos aceitos) já nasce com a carteira e os créditos de boas-vindas.
create or replace function public.viva_wallet_on_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.terms_accepted_at is not null then
    begin perform public.viva_ensure_wallet(new.id);
    exception when others then insert into public.viva_admin_alerts(alert_type,detail) values ('wallet_create_failed', 'Usuário '||new.id||': '||left(sqlerrm,300)); end;
  end if;
  return new;
end $$;
drop trigger if exists viva_wallet_after_profile on public.viva_profiles;
create trigger viva_wallet_after_profile after insert or update of terms_accepted_at on public.viva_profiles
  for each row execute function public.viva_wallet_on_profile();

-- ---------------------------------------------------------------------------
-- 8. Administração
-- ---------------------------------------------------------------------------
create or replace function public.viva_admin_credit_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_month timestamptz := date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'; v jsonb;
begin
  if not public.viva_is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  with usage_m as (select coalesce(sum(credits),0) credits, coalesce(sum(cost_brl),0) cost, coalesce(sum(tokens_in),0) tin, coalesce(sum(tokens_out),0) tout from public.viva_usage_log where created_at >= v_month),
       usage_all as (select coalesce(sum(cost_brl),0) cost from public.viva_usage_log),
       rev as (select coalesce(sum(amount_brl),0) total from public.viva_payments where status = 'approved' and paid_at >= v_month),
       plans as (select w.plan_id, count(*) n from public.viva_credit_wallets w group by w.plan_id),
       heavy as (select count(*) n from (select user_id from public.viva_usage_log where created_at > now() - interval '24 hours' group by user_id
                 having sum(credits) >= (select coalesce(abnormal_credits_per_hour,40) from public.viva_admin_settings where id = true)) h)
  select jsonb_build_object(
    'free_users', coalesce((select n from plans where plan_id = 'free'),0),
    'pro_users', coalesce((select sum(n) from plans where plan_id <> 'free'),0),
    'users_by_plan', coalesce((select jsonb_object_agg(plan_id, n) from plans),'{}'::jsonb),
    'credits_month', (select credits from usage_m), 'ai_cost_month_brl', (select cost from usage_m), 'ai_cost_total_brl', (select cost from usage_all),
    'tokens_in_month', (select tin from usage_m), 'tokens_out_month', (select tout from usage_m),
    'revenue_month_brl', (select total from rev), 'margin_month_brl', (select total from rev) - (select cost from usage_m),
    'heavy_users_24h', (select n from heavy),
    'plans', (select jsonb_agg(to_jsonb(p) order by p.monthly_price_brl) from public.viva_plans p),
    'operations', (select jsonb_agg(to_jsonb(o) order by o.sort) from public.viva_credit_operations o),
    'settings', (select to_jsonb(s) from public.viva_admin_settings s where id = true)
  ) into v;
  return v;
end $$;

create or replace function public.viva_admin_credit_users(p_search text default null, p_plan text default null, p_sort text default 'cost',
  p_limit integer default 25, p_offset integer default 0)
returns table(user_id uuid, full_name text, email text, plan_id text, balance integer, reserved integer, cycle_granted integer, cycle_used integer,
  next_renewal_at timestamptz, credits_month bigint, tokens_in_month bigint, tokens_out_month bigint, cost_month_brl numeric, cost_total_brl numeric,
  credits_24h bigint, high_usage boolean, total_count bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v_month timestamptz := date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'; v_heavy integer;
begin
  if not public.viva_is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select coalesce(abnormal_credits_per_hour,40) into v_heavy from public.viva_admin_settings where id = true;
  return query
  with u as (
    select l.user_id uid,
      coalesce(sum(l.credits) filter (where l.created_at >= v_month),0)::bigint cm,
      coalesce(sum(l.tokens_in) filter (where l.created_at >= v_month),0)::bigint ti,
      coalesce(sum(l.tokens_out) filter (where l.created_at >= v_month),0)::bigint tt,
      coalesce(sum(l.cost_brl) filter (where l.created_at >= v_month),0)::numeric co,
      coalesce(sum(l.cost_brl),0)::numeric ca,
      coalesce(sum(l.credits) filter (where l.created_at > now() - interval '24 hours'),0)::bigint c24
    from public.viva_usage_log l group by l.user_id)
  select w.user_id, coalesce(p.full_name, au.raw_user_meta_data->>'full_name','')::text, au.email::text, w.plan_id, w.balance, w.reserved, w.cycle_granted, w.cycle_used,
    w.next_renewal_at, coalesce(u.cm,0)::bigint, coalesce(u.ti,0)::bigint, coalesce(u.tt,0)::bigint, coalesce(u.co,0)::numeric, coalesce(u.ca,0)::numeric, coalesce(u.c24,0)::bigint,
    coalesce(u.c24,0) >= v_heavy, count(*) over()
  from public.viva_credit_wallets w
  join auth.users au on au.id = w.user_id
  left join public.viva_profiles p on p.id = w.user_id
  left join u on u.uid = w.user_id
  where (p_search is null or p_search = '' or coalesce(p.full_name,'') ilike '%'||p_search||'%' or coalesce(au.email::text,'') ilike '%'||p_search||'%')
    and (p_plan is null or p_plan = '' or w.plan_id = p_plan)
  order by case when p_sort = 'balance' then w.balance end asc nulls last,
           case when p_sort = 'credits' then coalesce(u.cm,0) end desc nulls last,
           case when p_sort = 'recent' then extract(epoch from au.created_at) end desc nulls last,
           coalesce(u.co,0) desc, au.created_at desc
  limit greatest(1,least(p_limit,100)) offset greatest(0,p_offset);
end $$;

create or replace function public.viva_admin_adjust_credits(p_user_id uuid, p_amount integer, p_reason text, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_admin uuid := auth.uid(); v_wallet public.viva_credit_wallets%rowtype; v_amount integer := p_amount; v_ok boolean;
begin
  if v_admin is null or not public.viva_is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_amount = 0 or abs(p_amount) > 100000 then raise exception 'invalid_amount' using errcode = '22023'; end if;
  if char_length(trim(coalesce(p_reason,''))) < 3 then raise exception 'reason_required' using errcode = '22023'; end if;
  if char_length(coalesce(p_idempotency_key,'')) < 8 then raise exception 'idempotency_key_required' using errcode = '22023'; end if;
  perform public.viva_ensure_wallet(p_user_id);
  select * into v_wallet from public.viva_credit_wallets where user_id = p_user_id for update;
  if not found then raise exception 'wallet_not_found'; end if;
  if v_amount < 0 then v_amount := -least(-v_amount, v_wallet.balance - v_wallet.reserved); end if;
  if v_amount = 0 then return jsonb_build_object('ok',false,'reason','nothing_to_remove','wallet',public.viva_wallet_snapshot(p_user_id)); end if;
  v_ok := public.viva_wallet_post(p_user_id, case when v_amount > 0 then 'admin_grant' else 'admin_revoke' end, v_amount, 'admin:'||p_idempotency_key,
    left(trim(p_reason),240), null, null, 0, 0, 0, v_admin, jsonb_build_object('requested',p_amount));
  if v_ok then
    insert into public.viva_admin_actions(actor_user_id,target_user_id,action,reason,details)
    values (v_admin,p_user_id,case when v_amount > 0 then 'credits_grant' else 'credits_revoke' end,left(trim(p_reason),240),jsonb_build_object('amount',v_amount,'requested',p_amount));
  end if;
  return jsonb_build_object('ok',v_ok,'applied',v_amount,'duplicate',not v_ok,'wallet',public.viva_wallet_snapshot(p_user_id));
end $$;

create or replace function public.viva_admin_user_ledger(p_user_id uuid, p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.viva_is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object('wallet', public.viva_wallet_snapshot(p_user_id), 'ledger', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
    select l.id, l.kind, l.amount, l.balance_after, l.operation_key, l.description, l.tokens_in, l.tokens_out, l.cost_brl, l.created_at, l.actor_id
    from public.viva_credit_ledger l where l.user_id = p_user_id order by l.created_at desc limit greatest(1,least(p_limit,200))) x), '[]'::jsonb));
end $$;

-- Vitrine de planos: somente planos públicos, com os novos campos.
create or replace function public.viva_get_public_plans()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'plans', (select coalesce(jsonb_agg(to_jsonb(p) - 'updated_at' order by p.monthly_price_brl), '[]'::jsonb) from public.viva_plans p where p.enabled = true and p.is_public = true),
    'extra_credits', (select jsonb_build_object('amount', extra_credit_amount, 'price_brl', extra_credit_price_brl) from public.viva_admin_settings where id = true),
    'operations', (select coalesce(jsonb_agg(jsonb_build_object('key',o.key,'label',o.label,'credits',o.credits,'pro_only',o.pro_only) order by o.sort), '[]'::jsonb) from public.viva_credit_operations o where o.enabled = true)
  );
$$;

-- ---------------------------------------------------------------------------
-- 9. Permissões das funções
-- ---------------------------------------------------------------------------
revoke all on function public.viva_effective_subscription(uuid) from public, anon, authenticated;
revoke all on function public.viva_wallet_post(uuid,text,integer,text,text,text,uuid,integer,integer,numeric,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.viva_wallet_start_cycle(uuid,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.viva_ensure_wallet(uuid) from public, anon, authenticated;
revoke all on function public.viva_sync_wallet(uuid) from public, anon, authenticated;
revoke all on function public.viva_wallet_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.viva_grant_subscription_cycle(uuid) from public, anon, authenticated;
revoke all on function public.viva_run_credit_renewals() from public, anon, authenticated;
revoke all on function public.viva_wallet_on_profile() from public, anon, authenticated;
grant execute on function public.viva_grant_subscription_cycle(uuid) to service_role;
grant execute on function public.viva_run_credit_renewals() to service_role;

revoke all on function public.viva_reserve_ai_credits(text,integer,boolean,text,text) from public, anon;
revoke all on function public.viva_settle_ai_usage(uuid,text,integer,integer,numeric,numeric,text) from public, anon;
revoke all on function public.viva_release_ai_reservation(uuid) from public, anon;
revoke all on function public.viva_get_ai_quota() from public, anon;
revoke all on function public.viva_get_credit_history(integer,integer) from public, anon;
revoke all on function public.viva_admin_credit_overview() from public, anon;
revoke all on function public.viva_admin_credit_users(text,text,text,integer,integer) from public, anon;
revoke all on function public.viva_admin_adjust_credits(uuid,integer,text,text) from public, anon;
revoke all on function public.viva_admin_user_ledger(uuid,integer) from public, anon;
revoke all on function public.viva_get_public_plans() from public, anon;
grant execute on function public.viva_reserve_ai_credits(text,integer,boolean,text,text) to authenticated;
grant execute on function public.viva_settle_ai_usage(uuid,text,integer,integer,numeric,numeric,text) to authenticated;
grant execute on function public.viva_release_ai_reservation(uuid) to authenticated;
grant execute on function public.viva_get_ai_quota() to authenticated;
grant execute on function public.viva_get_credit_history(integer,integer) to authenticated;
grant execute on function public.viva_admin_credit_overview() to authenticated;
grant execute on function public.viva_admin_credit_users(text,text,text,integer,integer) to authenticated;
grant execute on function public.viva_admin_adjust_credits(uuid,integer,text,text) to authenticated;
grant execute on function public.viva_admin_user_ledger(uuid,integer) to authenticated;
grant execute on function public.viva_get_public_plans() to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Carteiras dos usuários atuais e agendamento da renovação
-- ---------------------------------------------------------------------------
do $$ declare r record; begin
  for r in select id from public.viva_profiles where terms_accepted_at is not null loop
    perform public.viva_sync_wallet(r.id);
  end loop;
end $$;

do $$ begin
  if exists (select 1 from cron.job where jobname = 'viva-credit-renewals') then perform cron.unschedule('viva-credit-renewals'); end if;
  perform cron.schedule('viva-credit-renewals', '*/15 * * * *', 'select public.viva_run_credit_renewals();');
end $$;
