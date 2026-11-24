-- Ativação: lembretes nos 3 primeiros dias e resgate de quem parou de anotar.
alter table public.viva_notification_deliveries drop constraint if exists viva_notification_deliveries_notification_type_check;
alter table public.viva_notification_deliveries add constraint viva_notification_deliveries_notification_type_check
  check (notification_type in ('morning','agenda','bill','test','evening','trial','report','activation'));
