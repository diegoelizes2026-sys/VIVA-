-- Relatório semanal (domingo 19h) e mensal (dia 1º, 9h), por notificação no celular e pelo WhatsApp.
alter table public.viva_notification_settings
  add column if not exists reports_enabled boolean not null default true;

alter table public.viva_notification_deliveries drop constraint if exists viva_notification_deliveries_notification_type_check;
alter table public.viva_notification_deliveries add constraint viva_notification_deliveries_notification_type_check
  check (notification_type in ('morning','agenda','bill','test','evening','trial','report'));

-- Último relatório enviado pelo WhatsApp (evita mandar o mesmo duas vezes).
alter table public.viva_whatsapp_links
  add column if not exists last_report_key text;
