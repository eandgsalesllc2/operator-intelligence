-- Category taxonomy lives in lib/categories.ts ("Vertical · Category"); empty means uncategorized.
alter table investigations add column if not exists category text not null default '';
create index if not exists investigations_category_idx on investigations(category);
