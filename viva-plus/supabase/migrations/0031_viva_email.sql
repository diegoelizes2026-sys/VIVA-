-- E-mails da VIVA (Resend): preferência para parar de receber.
alter table public.viva_notification_settings add column if not exists email_enabled boolean not null default true;
