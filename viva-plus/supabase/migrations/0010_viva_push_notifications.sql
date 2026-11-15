-- VIVA+ push, alarmes da agenda e resumo matinal
create extension if not exists pg_cron;
create extension if not exists pg_net;

alter table public.viva_events
 add column if not exists reminder_enabled boolean not null default true,
 add column if not exists reminder_before_minutes integer not null default 30,
 add column if not exists reminder_at_start boolean not null default true;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='viva_events_reminder_before_range') then
  alter table public.viva_events add constraint viva_events_reminder_before_range check(reminder_before_minutes between 0 and 1440);
 end if;
end $$;

create table if not exists public.viva_notification_settings(
 user_id uuid primary key references auth.users(id) on delete cascade,
 timezone text not null default 'America/Sao_Paulo',
 morning_enabled boolean not null default true,
 morning_time time not null default '07:30',
 agenda_enabled boolean not null default true,
 bills_enabled boolean not null default true,
 silent_start time,
 silent_end time,
 updated_at timestamptz not null default now()
);
create table if not exists public.viva_push_subscriptions(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique,
 p256dh text not null,
 auth_key text not null,
 user_agent text,
 created_at timestamptz not null default now(),
 last_success_at timestamptz
);
create table if not exists public.viva_notification_deliveries(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 event_id uuid references public.viva_events(id) on delete cascade,
 notification_type text not null check(notification_type in ('morning','agenda','bill','test')),
 group_key text,
 dedupe_key text not null unique,
 scheduled_for timestamptz not null,
 title text not null,
 body text not null,
 target_url text not null default '/assistente',
 payload jsonb not null default '{}'::jsonb,
 status text not null default 'pending' check(status in ('pending','processing','sent','failed','acknowledged','snoozed','cancelled')),
 attempt_index smallint not null default 0 check(attempt_index between 0 and 2),
 attempts integer not null default 0,
 last_error text,
 sent_at timestamptz,
 acknowledged_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.viva_notification_logs(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 delivery_id uuid references public.viva_notification_deliveries(id) on delete set null,
 notification_type text not null,
 status text not null check(status in ('sent','failed','opened','acknowledged','snoozed')),
 title text,
 detail text,
 created_at timestamptz not null default now()
);
create index if not exists viva_notification_deliveries_due_idx on public.viva_notification_deliveries(status,scheduled_for);
create index if not exists viva_notification_deliveries_user_idx on public.viva_notification_deliveries(user_id,created_at desc);
create index if not exists viva_notification_logs_created_idx on public.viva_notification_logs(created_at desc);
create index if not exists viva_push_subscriptions_user_idx on public.viva_push_subscriptions(user_id);

alter table public.viva_notification_settings enable row level security;
alter table public.viva_push_subscriptions enable row level security;
alter table public.viva_notification_deliveries enable row level security;
alter table public.viva_notification_logs enable row level security;

drop policy if exists viva_notification_settings_owner on public.viva_notification_settings;
create policy viva_notification_settings_owner on public.viva_notification_settings for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists viva_push_subscriptions_owner on public.viva_push_subscriptions;
create policy viva_push_subscriptions_owner on public.viva_push_subscriptions for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists viva_notification_deliveries_owner_read on public.viva_notification_deliveries;
create policy viva_notification_deliveries_owner_read on public.viva_notification_deliveries for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists viva_notification_logs_owner_read on public.viva_notification_logs;
create policy viva_notification_logs_owner_read on public.viva_notification_logs for select to authenticated using(user_id=(select auth.uid()) or public.viva_is_admin());

grant select,insert,update,delete on public.viva_notification_settings to authenticated;
grant select,insert,update,delete on public.viva_push_subscriptions to authenticated;
grant select on public.viva_notification_deliveries to authenticated;
grant select on public.viva_notification_logs to authenticated;
grant all on public.viva_notification_settings,public.viva_push_subscriptions,public.viva_notification_deliveries,public.viva_notification_logs to service_role;

insert into public.viva_notification_settings(user_id)
select id from public.viva_profiles
on conflict(user_id) do nothing;
