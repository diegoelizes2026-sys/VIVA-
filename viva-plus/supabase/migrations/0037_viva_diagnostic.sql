-- Diagnóstico Financeiro Grátis (/diagnostico): leads do quiz, eventos do funil, mensagens do acompanhamento
-- no WhatsApp (API oficial da Meta) e configuração com pausa geral. Tudo só acessível pelo servidor (service role).
-- LGPD: guarda só nome, WhatsApp, respostas do quiz e consentimento; a pessoa pode apagar com o token.

create table if not exists public.viva_diag_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  whatsapp text not null check (whatsapp ~ '^55\d{10,11}$'),
  answers jsonb not null,
  result jsonb not null,
  goal text not null check (goal in ('dividas','reserva','comprar','organizar')),
  wants_health text not null check (wants_health in ('sim','talvez','nao')),
  marketing_opt_in boolean not null default false,
  consent_text text check (consent_text is null or char_length(consent_text) <= 300),
  consent_at timestamptz,
  utm_source text check (utm_source is null or char_length(utm_source) <= 80),
  utm_medium text check (utm_medium is null or char_length(utm_medium) <= 80),
  utm_campaign text check (utm_campaign is null or char_length(utm_campaign) <= 80),
  utm_content text check (utm_content is null or char_length(utm_content) <= 80),
  device_hash text check (device_hash is null or char_length(device_hash) <= 64),
  ip_hash text check (ip_hash is null or char_length(ip_hash) <= 64),
  delete_token uuid not null default gen_random_uuid(),
  -- Acompanhamento: 0 = nada enviado; 1 = boas-vindas; 2 = dia 1; 3 = dia 3; 4 = dia 7 (fim).
  followup_status text not null default 'pending' check (followup_status in ('pending','active','done','opted_out','converted','not_eligible','failed')),
  followup_step integer not null default 0 check (followup_step between 0 and 4),
  next_send_at timestamptz,
  last_sent_at timestamptz,
  opted_out_at timestamptz,
  opt_out_text text check (opt_out_text is null or char_length(opt_out_text) <= 300),
  converted_user_id uuid references auth.users(id) on delete set null,
  converted_at timestamptz,
  replies_count integer not null default 0,
  last_reply_at timestamptz,
  needs_human boolean not null default false,
  ai_day date,
  ai_replies_day integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists viva_diag_leads_whatsapp on public.viva_diag_leads(whatsapp, created_at desc);
create index if not exists viva_diag_leads_due on public.viva_diag_leads(followup_status, next_send_at);
create index if not exists viva_diag_leads_device on public.viva_diag_leads(device_hash, created_at desc);
create index if not exists viva_diag_leads_ip on public.viva_diag_leads(ip_hash, created_at desc);

create table if not exists public.viva_diag_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.viva_diag_leads(id) on delete cascade,
  direction text not null check (direction in ('out','in')),
  kind text not null check (kind in ('template','text','ai','system')),
  step integer check (step is null or step between 1 and 4),
  body text not null check (char_length(body) <= 4000),
  status text not null check (status in ('sent','failed','received','skipped','test')),
  wa_message_id text check (wa_message_id is null or char_length(wa_message_id) <= 200),
  error text check (error is null or char_length(error) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists viva_diag_messages_lead on public.viva_diag_messages(lead_id, created_at);

create table if not exists public.viva_diag_events (
  id bigserial primary key,
  session_id text not null check (char_length(session_id) between 8 and 64),
  event text not null check (event in ('quiz_start','question','lead','result','cta_signup','cta_whatsapp','share')),
  step integer check (step is null or step between 1 and 7),
  utm_source text check (utm_source is null or char_length(utm_source) <= 80),
  utm_medium text check (utm_medium is null or char_length(utm_medium) <= 80),
  utm_campaign text check (utm_campaign is null or char_length(utm_campaign) <= 80),
  created_at timestamptz not null default now()
);
create index if not exists viva_diag_events_day on public.viva_diag_events(created_at desc, event);

-- Configuração (linha única). Os envios automáticos começam PAUSADOS até a aprovação dos textos.
create table if not exists public.viva_diag_settings (
  id boolean primary key default true check (id),
  followup_paused boolean not null default true,
  test_whatsapp text check (test_whatsapp is null or test_whatsapp ~ '^55\d{10,11}$'),
  updated_at timestamptz not null default now()
);
insert into public.viva_diag_settings(id) values (true) on conflict (id) do nothing;

-- Só o servidor (service role) lê e grava. Nenhum acesso pelo navegador.
alter table public.viva_diag_leads enable row level security;
alter table public.viva_diag_messages enable row level security;
alter table public.viva_diag_events enable row level security;
alter table public.viva_diag_settings enable row level security;
revoke all on public.viva_diag_leads, public.viva_diag_messages, public.viva_diag_events, public.viva_diag_settings from anon, authenticated;
revoke all on sequence public.viva_diag_events_id_seq from anon, authenticated;

-- Acompanhamento automático: a cada 15 minutos o banco chama o site (mesmo padrão das outras tarefas).
-- Enquanto followup_paused = true, a rota não envia nada.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'viva-diag-followup-15min';
    perform cron.schedule('viva-diag-followup-15min', '*/15 * * * *', $cron$
 select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name='viva_notifications_url') || '/api/cron/diag-followup',
  headers := jsonb_build_object(
   'Content-Type','application/json',
   'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='viva_notifications_cron_secret')
  ),
  body := jsonb_build_object('source','pg_cron'),
  timeout_milliseconds := 30000
 );
$cron$);
  end if;
end $$;
