# ACES Asset Management

A Saudi Arabia COW asset management prototype with an interactive regional Leaflet map and dedicated, system-categorized CMDB asset records. ON-AIR sites are green and all non-ON-AIR sites are red.

The public GitHub Pages deployment is a prototype only. Review [SECURITY.md](SECURITY.md) before any STC system integration; production requires private hosting, STC SSO/RBAC, and a secured CMDB API rather than browser-direct spreadsheet access.

## Data source

The app opens from a repository snapshot for fast initial rendering, then refreshes silently from Google Sheet `gid=2046046325`, so searches and site details reflect the current CMDB without delaying the map.

## GitHub Pages

In repository settings, open **Pages**, select **Deploy from a branch**, then choose the `main` branch and `/ (root)`.
