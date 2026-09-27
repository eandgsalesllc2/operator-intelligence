-- Operator Intelligence accounts. Only the server (service role) reads or writes these tables;
-- RLS is on with no policies, so the anon/public key cannot touch them.
create table if not exists oi_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  full_name text not null,
  company text not null,
  job_role text not null,
  use_case text not null,
  accepted_terms_at timestamptz not null default now(),
  onboarded_at timestamptz,
  failed_logins int not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists oi_users_email_key on oi_users (lower(email));
alter table oi_users enable row level security;

-- Machine tokens for scripts (e.g. bulk case import). Only a SHA-256 hash is stored.
create table if not exists oi_api_tokens (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table oi_api_tokens enable row level security;
