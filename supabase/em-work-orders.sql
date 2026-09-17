-- Apply in the asset project's Supabase SQL editor before importing the workbook.
-- One row per source request; a site and element may have multiple requests.
create table if not exists public.em_work_orders (
  id bigint primary key,
  site_id text not null,
  site_name text,
  expense_type text not null check (expense_type in ('CAPEX','OPEX')),
  em_type text not null,
  element text not null,
  workflow_status text,
  status_group text not null check (status_group in ('completed','pending','closed','unknown')),
  source_region text,
  source_district text,
  created_at timestamptz,
  last_modified_at timestamptz,
  source_details jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now()
);
create index if not exists em_work_orders_type_group_idx on public.em_work_orders(expense_type,status_group,element);
create index if not exists em_work_orders_site_idx on public.em_work_orders(site_id,expense_type);
alter table public.em_work_orders enable row level security;
revoke all on public.em_work_orders from anon;
grant select on public.em_work_orders to authenticated;
drop policy if exists "Authenticated users can read EM requests" on public.em_work_orders;
create policy "Authenticated users can read EM requests"
  on public.em_work_orders for select to authenticated using (true);
