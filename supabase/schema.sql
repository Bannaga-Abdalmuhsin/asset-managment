create table if not exists public.assets (
  id text primary key,
  lat double precision,
  lon double precision,
  status text,
  region text,
  district text,
  city text,
  details jsonb not null default '{}'::jsonb,
  source_updated_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists assets_region_idx on public.assets (region);
create index if not exists assets_status_idx on public.assets (status);

alter table public.assets enable row level security;

drop policy if exists "Public read-only asset catalogue" on public.assets;
create policy "Public read-only asset catalogue"
on public.assets for select
to anon
using (true);

revoke all on table public.assets from anon;
grant select on table public.assets to anon;

