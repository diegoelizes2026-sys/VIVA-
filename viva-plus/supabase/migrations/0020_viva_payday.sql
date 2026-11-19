-- VIVA+ — Quando a pessoa recebe (para o lembrete "Recebi meu pagamento"). Somente adições.
alter table public.viva_finance_profiles
  add column if not exists pay_frequency text check (pay_frequency in ('monthly','biweekly','weekly','irregular')),
  add column if not exists pay_days smallint[] not null default '{}' check (cardinality(pay_days) <= 2 and 1 <= all(pay_days) and 31 >= all(pay_days)),
  add column if not exists pay_weekday smallint check (pay_weekday between 0 and 6),
  add column if not exists pay_business_day boolean not null default false;
