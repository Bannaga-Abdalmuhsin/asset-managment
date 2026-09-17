-- Run after the CAPEX/OPEX import if only catalogued COWs should remain.
-- The source workbook can be re-imported; this is an idempotent cleanup.
select count(*) as excluded_requests
from public.em_work_orders w
where not exists (
  select 1 from public.assets a
  where upper(btrim(a.id)) = upper(btrim(w.site_id))
);

delete from public.em_work_orders w
where not exists (
  select 1 from public.assets a
  where upper(btrim(a.id)) = upper(btrim(w.site_id))
);

select expense_type, status_group, count(*) as requests
from public.em_work_orders
group by expense_type, status_group
order by expense_type, status_group;
