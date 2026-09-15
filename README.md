# ACES Asset Management

A Saudi Arabia COW asset management prototype with an interactive Google map and dedicated, system-categorized CMDB asset records. ON-AIR sites are green and all non-ON-AIR sites are red.

## Google Maps setup

Enable **Maps JavaScript API** in Google Cloud, create a browser key, and restrict it to `https://bannaga-abdalmuhsin.github.io/asset-managment/*`. Restrict the key to the Maps JavaScript API only, then place it in `config.js`. A browser key is visible by design; domain and API restrictions are mandatory.

The public GitHub Pages deployment is a prototype only. Review [SECURITY.md](SECURITY.md) before any STC system integration; production requires private hosting, STC SSO/RBAC, and a secured CMDB API rather than browser-direct spreadsheet access.

## Prototype CMDB connection

This prototype reads the current Google Sheet directly. The map uses a lightweight column query for faster loading; the full CMDB row is downloaded only when opening a site record. This direct connection must be replaced by an authenticated CMDB API gateway before production or STC integration.

## GitHub Pages

In repository settings, open **Pages**, select **Deploy from a branch**, then choose the `main` branch and `/ (root)`.
