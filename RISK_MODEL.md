# COW Risk model in Asset Management

Source: [Cow-Risk-Dashboard_new](https://github.com/Bannaga-Abdalmuhsin/Cow-Risk-Dashboard_new), `artifacts/hajj-dashboard/src/lib/calculations.ts` and `realSiteData.ts`. This implementation uses the source's 79 surveyed Hajj sites, keyed by exact normalized COW ID. `risk-sites.json` is a snapshot, not a live CMDB update. The national CMDB directory shows other sites as **Awaiting inputs**, never as safe.

## Inputs

`risk-sites.json` stores site ID, source configuration (SG, SB or DG), raw nameplates and ages, spreadsheet net power, telecom load and heat, rectifier power, battery string count/capacity and measured/calculated useful hours. The original transformation uses spreadsheet net power, then divides by `0.8 × 0.87 × 0.9` to form an equivalent generator kVA. Both source and port set generator age to zero for this dataset. DG uses generator 1 for S1–S4 and generator 2 for S5–S8; SB uses SEC for S1–S4 and backup generator for S5–S8. SG has no available backup in S5–S8.

## Formula definitions

| Quantity | Source formula |
| --- | --- |
| Generator net power, kW | kVA × 0.8 power factor × 0.87 alternator efficiency × 0.9 risk factor × (1 − 0.03 × age in years) |
| AC net cooling, Btu/h | AC nameplate Btu/h × 0.83 T3 factor × (1 − 0.015 × age in years) |
| AC electrical demand, kW | AC net cooling ÷ 3412 ÷ 3.5 COP |
| Battery charging demand, kW | 0.05 × (Ah per string × number of strings) × 48 V ÷ 1000 |
| Power margin, kW | available prime/backup power − telecom load − applicable AC demand − battery charge demand when charging |
| Rectifier margin, kW | rectifier capacity − telecom load − battery charge demand when charging |
| Cooling margin, Btu/h | active AC net cooling − telecom heat dissipation |
| S9 battery risk | useful backup time < 1 hour |

Power, rectifier and shelter cooling are flagged when their margin is **below zero**. Outdoor cabinets are exempt from cooling risk except for the displayed S9 outage state. In S9, the original engine flags power, rectifier and cooling as unavailable but counts **battery time only** as an actionable outage risk. At zero margin, the source engine labels the dimension safe.

| Scenarios | Source | Cooling | Battery |
| --- | --- | --- | --- |
| S1–S2 | Prime | AC1 / AC1+AC2 | Normal |
| S3–S4 | Prime | AC1 / AC1+AC2 | Charging |
| S5–S6 | Backup | AC1 / AC1+AC2 | Normal |
| S7–S8 | Backup | AC1 / AC1+AC2 | Charging |
| S9 | Outage | None | Discharging |

The source power equation for S3 and S7 uses **AC1 only**, although their cooling comparison includes AC1+AC2. The port retains this behavior. CWN915 omits S6 and S8. Field-confirmed overrides in the source designate exactly 19 sites at risk and hold all other surveyed sites safe. A confirmed field risk may have no computed flagged scenario; the UI states this explicitly instead of inventing one. The site panel shows only flagged, actionable scenarios for a site classified at risk.

## Files

- `risk-engine.js`: scenario formulas, classification, field overrides.
- `risk-sites.json`: immutable source assessment inputs for the 79 surveyed sites.
- `cow-risk.html`, `cow-risk.js`, `risk.css`: national risk directory joined to authorized CMDB site IDs.
- `site-risk.js`: per-site scenario display embedded in `site.html`.

To assess more sites, collect the same engineering inputs, validate them with the field team, then extend the input dataset or provide a secured backend endpoint. CMDB site status and map location alone do not establish generator, telecom, cooling or battery margins.
