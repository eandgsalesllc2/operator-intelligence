-- Structured profile and marketing per investigation, filter tags, and the identifier index
-- used to link investigations that share tracking IDs, accounts, contacts, companies or people.
alter table investigations add column if not exists profile jsonb not null default '{}'::jsonb;
alter table investigations add column if not exists marketing jsonb not null default '{}'::jsonb;
alter table investigations add column if not exists tags text[] not null default '{}';
create index if not exists investigations_tags_idx on investigations using gin(tags);
create table if not exists oi_identifiers (
  id bigint generated always as identity primary key,
  investigation_id text not null references investigations(id) on delete cascade,
  kind text not null,
  value text not null,
  normalized text not null,
  created_at timestamptz default now()
);
create index if not exists oi_identifiers_normalized_idx on oi_identifiers(normalized);
create index if not exists oi_identifiers_investigation_idx on oi_identifiers(investigation_id);
alter table oi_identifiers enable row level security;
