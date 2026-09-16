# COW Risk model in Asset Management

Source: [Cow-Risk-Dashboard_new](https://github.com/Bannaga-Abdalmuhsin/Cow-Risk-Dashboard_new), `artifacts/hajj-dashboard/src/lib/calculations.ts` and `realSiteData.ts`. This implementation uses the source's 79 surveyed Hajj sites, keyed by exact normalized COW ID. `risk-sites.json` is a snapshot, not a live CMDB update. The national CMDB directory shows other sites as **Awaiting inputs**, never as safe.

## Inputs

`risk-sites.json` stores site ID, source configuration (SG, SB or DG), raw nameplates and ages, spreadsheet net power, telecom load and heat, rectifier power, battery string count/capacity and measured/calculated useful hours. The original transformation uses spreadsheet net power, then divides by `0.8 × 0.87 × 0.9` to form an equivalent generator kVA. Both source and port set generator age to zero for this dataset. S1–S4 use prime power: generator 1 for SG/DG sites and SEC for SB sites.

## Formula definitions

| Quantity | Source formula |
| --- | --- |
| Generator net power, kW | kVA × 0.8 power factor × 0.87 alternator efficiency × 0.9 risk factor × (1 − 0.03 × age in years) |
| AC net cooling, Btu/h | AC nameplate Btu/h × 0.83 T3 factor × (1 − 0.015 × age in years) |
| AC electrical demand, kW | AC net cooling ÷ 3412 ÷ 3.5 COP |
| Battery charging demand, kW | 0.05 × (Ah per string × number of strings) × 48 V ÷ 1000 |
| Power margin, kW | available prime power − telecom load − applicable AC demand − battery charge demand when charging |
| Rectifier margin, kW | rectifier capacity − telecom load − battery charge demand when charging |
| Cooling margin, Btu/h | active AC net cooling − telecom heat dissipation |

Power, rectifier and shelter cooling are flagged when their margin is **below zero**. Outdoor cabinets are exempt from cooling risk. At zero margin, the source engine labels the dimension safe. Dashboard risk-area cards count distinct assessed sites with a flag in any of S1–S4. Battery useful time remains visible in the site record, but S1–S4 have no battery outage-risk test; the dashboard marks Battery **N/A**.

| Scenarios | Source | Cooling | Battery |
| --- | --- | --- | --- |
| S1–S2 | Prime | AC1 / AC1+AC2 | Normal |
| S3–S4 | Prime | AC1 / AC1+AC2 | Charging |

The source power equation for S3 uses **AC1 only**, although its cooling comparison includes AC1+AC2. The port retains this behavior. A scenario is flagged if any of its power, rectifier, or applicable cooling margins are below zero. A surveyed site is **At risk** when at least one of S1–S4 is flagged; it is **Assessed safe** when all four are clear. The site record shows the number of flagged scenarios out of four and the four scenario margins. Sites with no engineering survey remain **Awaiting inputs**. Source field-status lists do not override this calculation.

## Files

- `risk-engine.js`: S1–S4 scenario formulas and derived classification.
- `risk-sites.json`: immutable source assessment inputs for the 79 surveyed sites.
- `cow-risk.html`, `cow-risk.js`, `risk.css`: national risk directory joined to authorized CMDB site IDs.
- `site-risk.js`: per-site Site List detail card embedded in `site.html`.

To assess more sites, collect the same engineering inputs, validate them with the field team, then extend the input dataset or provide a secured backend endpoint. CMDB site status and map location alone do not establish generator, telecom, cooling or battery margins.
