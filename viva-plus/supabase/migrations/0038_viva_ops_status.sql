-- Saúde dos serviços externos (por enquanto: WhatsApp/Meta). A cada 15 minutos o site pergunta à Meta
-- se o token e o número estão funcionando; se falhar, mostra aviso no painel e manda e-mail ao administrador.
create table if not exists public.viva_ops_status (
  key text primary key check (char_length(key) between 2 and 40),
  ok boolean not null default true,
  error text check (error is null or char_length(error) <= 500),
  detail jsonb not null default '{}'::jsonb,
  since timestamptz not null default now(),        -- desde quando está no estado atual
  checked_at timestamptz not null default now(),
  alerted_at timestamptz                          -- último e-mail de alerta deste incidente
);
alter table public.viva_ops_status enable row level security;
revoke all on public.viva_ops_status from anon, authenticated;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'viva-whatsapp-health-15min';
    perform cron.schedule('viva-whatsapp-health-15min', '*/15 * * * *', $cron$
 select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name='viva_notifications_url') || '/api/cron/whatsapp-health',
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
