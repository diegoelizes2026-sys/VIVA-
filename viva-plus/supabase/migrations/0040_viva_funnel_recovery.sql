-- Recuperação do funil: quem chegou na tela de pagamento do Pro (/oferta-pro) e não pagou recebe até 2 lembretes.
create table if not exists public.viva_funnel_checkouts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_view_at timestamptz not null default now(),
  offer_until timestamptz,
  worst_area text check (worst_area is null or char_length(worst_area) <= 20),
  reminders integer not null default 0 check (reminders between 0 and 5),
  last_reminder_at timestamptz,
  paid_at timestamptz
);
create index if not exists viva_funnel_checkouts_pending on public.viva_funnel_checkouts(first_view_at) where paid_at is null;
alter table public.viva_funnel_checkouts enable row level security;
revoke all on public.viva_funnel_checkouts from anon, authenticated;
