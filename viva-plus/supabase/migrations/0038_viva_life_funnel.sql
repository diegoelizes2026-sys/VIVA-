-- Funil do tráfego pago: Diagnóstico da Vida (/diagnostico-vida) → resultado parcial → cadastro → Pro por R$19,90 (/oferta-pro).
-- Reaproveita a tabela de eventos do Diagnóstico Financeiro, com os novos passos.
alter table public.viva_diag_events drop constraint if exists viva_diag_events_event_check;
alter table public.viva_diag_events add constraint viva_diag_events_event_check check (event in (
  'quiz_start','question','lead','result','cta_signup','cta_whatsapp','share',
  'vida_start','vida_question','vida_result','vida_cta','offer_view','offer_checkout'));
alter table public.viva_diag_events drop constraint if exists viva_diag_events_step_check;
alter table public.viva_diag_events add constraint viva_diag_events_step_check check (step is null or step between 1 and 12);
