# ACES Asset Management

A Saudi Arabia COW asset management prototype with an interactive Google map and dedicated, system-categorized CMDB asset records. ON-AIR sites are green and all non-ON-AIR sites are red.

## Google Maps setup

Enable **Maps JavaScript API** in Google Cloud, create a browser key, and restrict it to `https://bannaga-abdalmuhsin.github.io/asset-managment/*`. Restrict the key to the Maps JavaScript API only, then place it in `config.js`. A browser key is visible by design; domain and API restrictions are mandatory.

The public GitHub Pages deployment is a prototype only. Review [SECURITY.md](SECURITY.md) before any STC system integration; production requires private hosting, STC SSO/RBAC, and a secured CMDB API rather than browser-direct spreadsheet access.

## Supabase CMDB connection

The frontend reads the `assets` table through Supabase REST. Full CMDB details are stored in the `details` JSONB column and fetched only when a site record is opened.

1. Run `supabase/schema.sql` once in the Supabase SQL editor.
2. Add GitHub Actions secrets: `GOOGLE_MAPS_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
3. Optionally add `CMDB_CSV_URL`; otherwise the current CMDB Google Sheet export is used.
4. Run the **Migrate CMDB to Supabase** workflow.
5. Configure GitHub Pages to use **GitHub Actions** as its source, then run **Deploy GitHub Pages**.

`SUPABASE_SERVICE_ROLE_KEY` is used only by the migration and scheduled fuel import workflows. It must never be placed in `config.js` or any browser-delivered file. The anon key is public by design; security is enforced by Supabase RLS and its read-only grant.

## Fuel status (Central and East)

Fuel status is implemented directly in this repository. The importer copies the source fuel-plan field mapping and date classification; the page reads Supabase only, not the other repository or Google Sheet. The source tab is **Energy Dashboard** (`gid=1149576218`). All rows with a valid next fueling date and an eligible COW status for Central/East are retained, including overdue dates. West and South are not imported until their plans are available.

1. In the same Supabase project, run [supabase/fuel-plans.sql](supabase/fuel-plans.sql) once in **SQL Editor**. The GitHub Actions service-role key cannot create the table through PostgREST.
2. Run **Sync fuel plans to Supabase** in GitHub Actions (or wait for its hourly schedule). It uses the existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` secrets from the `github-pages` environment. Optional `FUEL_CSV_URL` overrides the source export.
3. Check the action log for a nonzero synchronized count. Open `status.html?view=fuel` after login, or a site record for its fuel status.

The sync upserts by site ID and removes stale Central/East plans after a successful source fetch. Invalid dates are skipped. RLS grants fuel-plan reads only to authenticated users; the service-role key stays on the GitHub runner. A source failure or unexpectedly small import stops without clearing existing records.

## CAPEX and OPEX requests

The CAPEX/OPEX status pages and each site record read the authenticated `public.em_work_orders` table. Import the private user-provided workbook through a controlled database session:

1. Run [supabase/em-work-orders.sql](supabase/em-work-orders.sql) in the **same Supabase project** as the asset catalogue.
2. Run the generated private `CAPEX-OPEX Supabase import.sql` provided separately with the workbook. It is deliberately excluded from this public repository and Pages deployment. It upserts by source request ID.
3. Check the grouped count query at the end of that script. Expected source counts are **1,035 CAPEX** (413 completed, 622 not completed) and **88 OPEX** (36 completed, 52 not completed), totaling **1,123** requests.

The website defaults to **Not completed** by equipment category for each expense type, with **Completed** separate. Rejected and cancelled requests remain visible among not completed records with their original workflow status. These are request statuses and do not independently verify physical installation. Reads require an authenticated Supabase session; the service-role key and workbook data must never be committed to the public repository.

## GitHub Pages

In repository settings, select **GitHub Actions** as the Pages source. The deploy workflow generates the public browser configuration.
