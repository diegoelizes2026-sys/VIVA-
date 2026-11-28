-- Aviso de venda aprovada no celular dos administradores (estilo Kiwify).
alter table public.viva_notification_deliveries drop constraint if exists viva_notification_deliveries_notification_type_check;
alter table public.viva_notification_deliveries add constraint viva_notification_deliveries_notification_type_check
  check (notification_type in ('morning','agenda','bill','test','evening','trial','report','activation','sale'));
