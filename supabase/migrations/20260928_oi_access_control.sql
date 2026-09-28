-- Approval queue, roles, per-user research limits and password resets.
alter table oi_users add column if not exists status text not null default 'pending' check (status in ('pending','approved','rejected'));
alter table oi_users add column if not exists role text not null default 'member' check (role in ('owner','admin','member'));
alter table oi_users add column if not exists daily_research_limit int; -- null = default limit
update oi_users set status='approved'; -- accounts created before the approval queue stay in
create table if not exists oi_password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references oi_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table oi_password_resets enable row level security;
alter table oi_research_jobs add column if not exists user_id uuid;
create index if not exists oi_research_jobs_user_day on oi_research_jobs (user_id, created_at);
