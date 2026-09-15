-- Run in Supabase SQL Editor when the prototype is ready to enforce authenticated reads.
drop policy if exists "Public read-only asset catalogue" on public.assets;
revoke all on table public.assets from anon;
grant select on table public.assets to authenticated;

drop policy if exists "Authenticated users can read asset catalogue" on public.assets;
create policy "Authenticated users can read asset catalogue"
on public.assets
for select
to authenticated
using (true);
