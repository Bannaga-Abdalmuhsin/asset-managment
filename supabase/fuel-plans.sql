-- Apply once in the Supabase SQL editor before running the fuel import.
-- One current plan per site. All valid dates are retained, including overdue plans.
create table if not exists public.fuel_plans (
  site_id text primary key,
  region text not null check (region in ('Central','East','West','South')),
  cow_status text not null,
  next_fueling_date date not null,
  last_fueling_date date,
  last_fueling_qty numeric,
  district text,
  city text,
  site_label text,
  source_updated_at timestamptz not null default now()
);
create index if not exists fuel_plans_date_idx on public.fuel_plans(next_fueling_date);
create index if not exists fuel_plans_region_date_idx on public.fuel_plans(region,next_fueling_date);
alter table public.fuel_plans enable row level security;
revoke all on public.fuel_plans from anon;
grant select on public.fuel_plans to authenticated;
drop policy if exists "Authenticated fuel plan read" on public.fuel_plans;
create policy "Authenticated fuel plan read" on public.fuel_plans
  for select to authenticated using (true);
