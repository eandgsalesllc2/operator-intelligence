-- Per-user watchlists, weekly snapshots of watched brands, and the changes detected between snapshots.
create table if not exists oi_watchlist (
  user_id uuid not null references oi_users(id) on delete cascade,
  investigation_id text not null references investigations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, investigation_id)
);
create table if not exists oi_watch_snapshots (
  id uuid primary key default gen_random_uuid(),
  investigation_id text not null references investigations(id) on delete cascade,
  taken_at timestamptz not null default now(),
  data jsonb not null
);
create index if not exists oi_watch_snapshots_inv on oi_watch_snapshots (investigation_id, taken_at desc);
create table if not exists oi_watch_changes (
  id uuid primary key default gen_random_uuid(),
  investigation_id text not null references investigations(id) on delete cascade,
  detected_at timestamptz not null default now(),
  kind text not null,
  severity text not null default 'info' check (severity in ('info','notable','major')),
  title text not null,
  detail text
);
create index if not exists oi_watch_changes_inv on oi_watch_changes (investigation_id, detected_at desc);
alter table oi_users add column if not exists watch_seen_at timestamptz;
alter table oi_watchlist enable row level security;
alter table oi_watch_snapshots enable row level security;
alter table oi_watch_changes enable row level security;
