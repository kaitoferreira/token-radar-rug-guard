# Rug-Guard Radar — token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/kaitoferreira/token-radar-rug-guard/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/kaitoferreira/token-radar-rug-guard/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Pre-token protocols ranked by **risk-adjusted implied value**: size,
growth and maturity, discounted by a five-signal rug score. The angle is
rug detection: a protocol whose TVL is fleeing, that is young, single-chain
and thin gets demoted before you ever deposit — not hidden, flagged.

## Model (`rug-guard-1`, `lib/model.ts`)

Raw implied value = TVL × 0.25 × growth × maturity (growth clamped
−60%…+120%, maturity 0.6–1.0 over 3 years), as in the starter.

Rug score (0–100, weighted sum, every signal from the sealed snapshot
only, no name ever special-cased):

| Signal | Weight | What scores high |
| --- | --- | --- |
| Flight (7d TVL change) | 35% | Outflow past −15%, or inflow past +50% |
| Youth (age / listed date) | 20% | Under 30 days (92); unknown date (70) |
| Concentration (chain count) | 20% | One chain (58); five or more (10) |
| Category base risk | 15% | Bridges 72, derivatives 66, yield 60, lending 34 |
| Thinness (TVL size) | 10% | Under $10M (72); over $1B (16) |

Adjusted value = raw × (1 − 0.8 × score/100), floored at 15% of raw.
Bands: LOW <30, GUARDED 30–44, ELEVATED 45–57, HIGH 58–69, SEVERE ≥70.
The board (all 40 watchlist slugs + 160 early rows below the $50M floor)
is ranked by adjusted value.

Farm plans are rug-aware: step 1 is always a rug check (contract,
admin keys, withdrawal test), HIGH/SEVERE rows farm with $25 test
sizes and a 7–14 day hold, and every plan carries an exit trigger —
leave at once on a 10% weekly TVL fall (HIGH/SEVERE) or 25% (others).

## Dashboard (`dashboard/`)

Static page, no network. Risk-band chips with counts, search, category
and chain filters, sorting (risk-adjusted value, safest first, riskiest
first, TVL, 7d change), a hide-HIGH/SEVERE toggle, a click-through
detail view with the five-signal breakdown and the rug-aware farm plan,
a live-token view (already trading, at market value), and the full
methodology. Views: `?view=board`, `?view=detail&slug=<slug>`,
`?view=filtered&band=LOW`.

## Run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <kit>/input/snapshot.json
```

Writes `out/board.json`, `out/data.js`, `out/dashboard/`,
`out/screenshots/` and `out/dossier.json`.

## Honest limit

This radar cannot prove a protocol is safe. It shows, from public TVL
figures only, which protocols have the observable shape of a rug.
Verify contracts and admin keys yourself before depositing.
