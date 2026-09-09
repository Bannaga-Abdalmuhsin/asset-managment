# ACES Asset Management

A focused Saudi Arabia asset map for ACES COW sites. The page reads the CMDB Google Sheet live, displays ON-AIR sites in green and all non-ON-AIR sites in red, and opens the complete available CMDB record when a site is searched or selected.

## Data source

The app opens from a repository snapshot for fast initial rendering, then refreshes silently from Google Sheet `gid=2046046325`, so searches and site details reflect the current CMDB without delaying the map.

## GitHub Pages

In repository settings, open **Pages**, select **Deploy from a branch**, then choose the `main` branch and `/ (root)`.
