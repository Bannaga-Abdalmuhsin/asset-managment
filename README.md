# stc COW National Asset Status

Internal-facing prototype for managing STC Cells on Wheels (COWs) across Saudi Arabia. The application combines an authenticated national map, CMDB asset records, engineering risk flags, CAPEX/OPEX requests, fuel-plan status, warehouse location logic, and user profile controls.

> This repository is a prototype hosted on public GitHub Pages. It is not an STC production security boundary. Do not store confidential operational data, service-role credentials, passwords, or unrestricted API keys in browser-delivered files.

## Live application

- Application: https://bannaga-abdalmuhsin.github.io/asset-managment/
- Repository: https://github.com/Bannaga-Abdalmuhsin/asset-managment

## Functional scope

| Area | Implementation |
| --- | --- |
| National map | Google Maps JavaScript API, Saudi border overlay, search, status filters and COW markers |
| Map styles | Clean, Roadmap, Satellite, Hybrid and Terrain |
| Marker status | Green tower tag for ON-AIR; orange tower tag for OFF-AIR/other non-active records |
| Asset directory | Counts, regional breakdown, warehouse proximity and searchable site catalogue |
| Site record | CMDB fields grouped into Radio, Microwave, Tower, Overview, Power, HVAC, DC Power and Fire |
| Risk flags | Local S1–S4 engineering model joined to authorized CMDB site IDs |
| CAPEX/OPEX | Authenticated Supabase records, equipment categories, latest CAPEX request per site/category |
| Fuel status | Dated Central/East plans synchronized to Supabase and shown nationally and per site |
| Account | Supabase-authenticated profile, password update and optional avatar |

## Architecture

```text
Google Sheet / controlled import files
                |
        GitHub Actions importers
                |
        Supabase PostgreSQL + RLS
                |
Authenticated browser session
                |
GitHub Pages frontend + Google Maps
```

The frontend is static HTML, CSS and JavaScript. Runtime data is requested directly from Supabase with the signed-in user's access token. Administrative imports use the Supabase service-role key only inside GitHub Actions.

## Application pages

| File | Purpose |
| --- | --- |
| `login.html` | Username/password sign-in |
| `index.html` | National Google map and primary navigation |
| `asset-details.html` | National inventory, status counts, regions and warehouse view |
| `site.html?site=COW001` | One authorized site record |
| `cow-risk.html` | National COW risk directory and S1–S4 flag summary |
| `status.html?view=capex` | CAPEX requests |
| `status.html?view=opex` | OPEX requests |
| `status.html?view=fuel` | Fuel-plan summary and site-wise status |
| `account.html` | Authentication profile settings |

Invalid or missing status views are normalized to CAPEX without displaying obsolete placeholder content. Loading, empty and error states are rendered explicitly, and elements carrying `hidden` remain hidden until their corresponding module is ready.

## Frontend code

| File | Responsibility |
| --- | --- |
| `auth.js` | Session restore, route protection, account menu, logout and profile state |
| `login.js` | Login form and Supabase authentication request |
| `app.js` | Asset loading/cache, Google Maps initialization, markers, search and status filters |
| `dashboard.js` | Shared asset directory, counts, region logic, warehouse calculations and status routing |
| `site.js` | Site validation, detailed CMDB fetch and categorized asset cards |
| `cow-risk.js` | National risk directory joined to current asset catalogue |
| `site-risk.js` | Site-level risk input and S1–S4 scenario presentation |
| `risk-engine.js` | Deterministic S1–S4 engineering calculations and flag classification |
| `fuel-plan.mjs` | Fuel CSV parsing, date normalization and fuel-status classification |
| `fuel-view.mjs` | Supabase fuel queries and national/site rendering |
| `em-view.mjs` | CAPEX/OPEX queries, filters and latest-CAPEX-per-category logic |
| `account.js` | Account-page bootstrap; profile actions are provided by `auth.js` |
| `config.js` | Build-generated public runtime configuration |

Presentation is divided across `styles.css`, `dashboard.css`, `site.css`, `risk.css`, `fuel.css`, `em.css`, `login.css`, and `account.css`.

## Data model

### `public.assets`

Defined in `supabase/schema.sql`.

- `id`: normalized COW identifier and primary key
- `lat`, `lon`: map coordinates
- `status`: source operational status
- `region`, `district`, `city`: location hierarchy
- `details`: full CMDB row stored as JSONB
- `source_updated_at`, `updated_at`: synchronization timestamps

The list/map query fetches only the small summary columns. The heavier `details` JSON is requested only when a site is opened.

### `public.fuel_plans`

Defined in `supabase/fuel-plans.sql`. One current dated plan is stored per site. The frontend classifies each date as overdue, today, coming soon, healthy, or unavailable.

### `public.em_work_orders`

Defined in `supabase/em-work-orders.sql`. Stores CAPEX/OPEX requests and normalized workflow groups. The UI:

- includes only IDs present in the current asset catalogue;
- separates completed from not-completed requests;
- preserves the original workflow status;
- keeps only the latest CAPEX request for each site and equipment category in the CAPEX view.

### Risk snapshot

`risk-sites.json` contains surveyed engineering inputs. `risk-engine.js` applies S1–S4 only. A site is safe only when all evaluated scenario areas are safe; one or more flags classifies the site as flagged. See `RISK_MODEL.md` for formulas and assumptions.

## Map behavior

`app.js` provides:

- Google map styles: Clean, Roadmap, Satellite, Hybrid and Terrain;
- Clean as the default, with road/street labels hidden;
- Saudi Arabia border overlay;
- status filtering for All, ON-AIR and OFF-AIR;
- COW image markers with compact raised status tags;
- site-ID search and direct navigation to the site record;
- session-only summary caching to improve repeat load performance.

The Google Maps browser key is public by design and must be restricted to:

- HTTP referrer: `https://bannaga-abdalmuhsin.github.io/asset-managment/*`
- API: Maps JavaScript API only

Never place a Google service-account credential in the frontend.

## Authentication and authorization

Supabase Auth supplies the browser session. Access tokens are stored in `sessionStorage`, not persistent local storage. Protected pages begin with the `auth-pending` class and remain hidden until session validation completes, preventing protected content from flashing before authentication.

Database authorization must be enforced with Supabase Row Level Security. Hiding buttons or pages is not an authorization control. Production should use STC SSO, managed RBAC, audit logging and private hosting.

## Runtime configuration

GitHub Actions generates `config.js` during deployment from repository/environment secrets:

- `GOOGLE_MAPS_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Importer-only secrets:

- `SUPABASE_SERVICE_ROLE_KEY`
- optional `CMDB_CSV_URL`
- optional `FUEL_CSV_URL`

The service-role key must never appear in `config.js`, repository files, Pages artifacts, browser storage or client requests.

## Database setup

Run these files in the Supabase SQL editor:

1. `supabase/schema.sql`
2. `supabase/fuel-plans.sql`
3. `supabase/em-work-orders.sql`

If an earlier CAPEX/OPEX import included sites absent from the asset catalogue, run `supabase/em-assets-only.sql`.

After setup, verify that RLS policies expose only the data intended for the authenticated role used by the application.

## Data synchronization

### CMDB

The **Migrate CMDB to Supabase** workflow runs `scripts/migrate-cmdb.mjs`. It:

1. downloads the configured CSV/Google Sheet export;
2. validates and normalizes identifiers, coordinates, status and locations;
3. stores the full source row in `details`;
4. upserts current assets through the service role;
5. removes stale records only after a valid source is available.

### Fuel plan

The **Sync fuel plans to Supabase** workflow runs hourly and on demand. `scripts/sync-fuel.mjs`:

1. fetches the configured fuel CSV;
2. rejects HTML/error responses and unexpectedly small imports;
3. keeps eligible rows with usable next-fueling dates;
4. upserts by site ID;
5. removes stale plans only after successful validation.

Central and East are currently represented. West and South can be included when valid plans become available.

### CAPEX/OPEX

The source workbook is private and must be imported through a controlled database session. Do not commit the workbook, generated import statements or operational request data to the public repository.

## GitHub Actions

| Workflow | Purpose |
| --- | --- |
| `.github/workflows/deploy-pages.yml` | Generates public config and deploys the static Pages artifact |
| `.github/workflows/migrate-cmdb.yml` | Imports the current CMDB into Supabase |
| `.github/workflows/sync-fuel.yml` | Synchronizes valid fuel plans hourly/on demand |
| `.github/workflows/codeql.yml` | Scans JavaScript/TypeScript and workflow code |

GitHub Pages must use **GitHub Actions** as its deployment source.

## SEO and privacy policy

This is an authenticated internal prototype, so discoverability would be a security and privacy mistake. Every page carries:

- `noindex,nofollow,noarchive,nosnippet,noimageindex`;
- a strict referrer policy;
- a page-specific title and description;
- a restrictive Content Security Policy;
- a consistent STC theme color.

`robots.txt` disallows crawling of the complete site. A public sitemap is intentionally not provided.

## Performance decisions

- summary columns are loaded separately from full CMDB details;
- asset summaries use short-lived session caching;
- map icons are local SVG wrappers around the optimized COW image;
- scripts and styles are static and cache-versioned;
- fuel and CAPEX/OPEX requests are paginated from Supabase;
- DOM values from source systems are rendered with `textContent`;
- long tables render bounded batches rather than unlimited rows.

## Error handling

The UI shows controlled operational messages and does not expose Supabase project details, database errors, keys, query text or stack traces. Network requests use timeouts where supported. Empty data is distinct from a failed request.

## Local review

Serve the repository through a local HTTP server; do not open files directly with `file://` because ES modules and browser security rules differ.

```bash
python -m http.server 8080
```

Provide a safe local `config.js` containing only the browser-restricted Maps key, Supabase URL and anon key. Then open `http://localhost:8080/login.html`.

## Validation checklist

Before deployment:

- JavaScript files parse without syntax errors.
- Every local script, stylesheet and image reference resolves.
- No obsolete “Under development” content remains.
- CAPEX, OPEX and Fuel routes show only their loading/data/empty/error states.
- Google Maps key restrictions cover the exact Pages origin.
- Supabase RLS is enabled and tested with an authenticated non-admin user.
- No service-role key or operational workbook is present in the Pages artifact.
- Login, logout, search, filters, site navigation and account actions are tested.
- GitHub Actions deployment and import jobs complete successfully.

## Production boundary

Before STC integration, move the application to an approved private environment and complete the controls in `SECURITY.md`, including SSO/MFA, least-privilege RBAC, WAF/API gateway, private CMDB APIs, secrets management, centralized audit logs, vulnerability/dependency scanning, backup/recovery, monitoring and formal cybersecurity approval.

## Related documentation

- `SECURITY.md` — prototype controls and production security requirements
- `RISK_MODEL.md` — engineering scenario inputs, formulas and classification
