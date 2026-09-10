# ACES Asset Management

A Saudi Arabia COW asset management prototype with an interactive regional Leaflet map and dedicated, system-categorized CMDB asset records. ON-AIR sites are green and all non-ON-AIR sites are red.

The public GitHub Pages deployment is a prototype only. Review [SECURITY.md](SECURITY.md) before any STC system integration; production requires private hosting, STC SSO/RBAC, and a secured CMDB API rather than browser-direct spreadsheet access.

## Secure API contract

The frontend uses same-origin authenticated endpoints: `GET /api/assets/map` for the least-privilege map projection and `GET /api/assets/{siteId}` for an authorized full record. The production gateway is responsible for STC SSO, RBAC, audit logging, rate limits, and transforming the CMDB source. No CMDB address or credential is published in browser code.

## GitHub Pages

In repository settings, open **Pages**, select **Deploy from a branch**, then choose the `main` branch and `/ (root)`.
