-- Recuperação de senha da VIVA (e-mail próprio pelo Resend): controle de pedidos para evitar abuso.
create table if not exists public.viva_password_resets (
  id bigint generated always as identity primary key,
  email_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists viva_password_resets_email on public.viva_password_resets(email_hash, created_at desc);
alter table public.viva_password_resets enable row level security;
revoke all on public.viva_password_resets from anon, authenticated;
