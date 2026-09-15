# ACES Asset Management

A Saudi Arabia COW asset management prototype with an interactive Google map and dedicated, system-categorized CMDB asset records. ON-AIR sites are green and all non-ON-AIR sites are red.

## Google Maps setup

Enable **Maps JavaScript API** in Google Cloud, create a browser key, and restrict it to `https://bannaga-abdalmuhsin.github.io/asset-managment/*`. Restrict the key to the Maps JavaScript API only, then place it in `config.js`. A browser key is visible by design; domain and API restrictions are mandatory.

The public GitHub Pages deployment is a prototype only. Review [SECURITY.md](SECURITY.md) before any STC system integration; production requires private hosting, STC SSO/RBAC, and a secured CMDB API rather than browser-direct spreadsheet access.

## Supabase CMDB connection

The frontend reads a read-only `assets` view through Supabase REST. Full CMDB details are stored in the `details` JSONB column and fetched only when a site record is opened.

1. Run `supabase/schema.sql` once in the Supabase SQL editor.
2. Add GitHub Actions secrets: `GOOGLE_MAPS_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
3. Optionally add `CMDB_CSV_URL`; otherwise the current CMDB Google Sheet export is used.
4. Run the **Migrate CMDB to Supabase** workflow.
5. Configure GitHub Pages to use **GitHub Actions** as its source, then run **Deploy GitHub Pages**.

`SUPABASE_SERVICE_ROLE_KEY` is used only by the manual migration workflow. It must never be placed in `config.js` or any browser-delivered file. The anon key is public by design; security is enforced by Supabase RLS and its read-only grant.

## GitHub Pages

In repository settings, open **Pages**, select **Deploy from a branch**, then choose the `main` branch and `/ (root)`.
