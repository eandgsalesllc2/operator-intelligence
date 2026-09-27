-- Traffic and revenue forecast per investigation (sourced from BrandSearch; see lib/metrics.ts).
alter table investigations add column if not exists metrics jsonb not null default '{}'::jsonb;
alter table investigations add column if not exists monthly_visits bigint;
create index if not exists investigations_monthly_visits_idx on investigations(monthly_visits desc nulls last);
