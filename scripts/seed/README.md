# Seed / maintenance scripts

One-off Node scripts (Node 18+, native `fetch`) used to populate and maintain the
Supabase database with coherent demo data. They talk to the REST API and require
the **service_role** key — run them locally only, never ship the key to the client.

All credentials come from environment variables; **nothing is hardcoded**.

```bash
export SB_URL="https://<project>.supabase.co"
export SB_SERVICE_KEY="<service_role key>"      # server-side only
export SEASON_ID="<uuid of the target season>"  # for the seed scripts

node scripts/seed/seed.mjs             # 40 players, 5 teams, 10 single matches (~50 avg)
node scripts/seed/seed_encounters.mjs  # championship encounters (4 singles / 2 doubles / 4 singles)
node scripts/seed/seed_more.mjs        # extra single matches (mixed 501/601, varied averages)
node scripts/seed/spread_dates.mjs     # spread created_at/finished_at across the season
```

## `spread_dates.mjs` — date fix

Matches were originally inserted with `finished_at` set to staged dates but
`created_at` left at the DB default (`now()`), so the app — which displays
`created_at` — showed every match on the insertion day. This script realigns
`created_at` with `finished_at` and spreads both realistically across the
2026/2027 season (one tie every ~2 weeks; a tie's fixtures share its evening).
Idempotent: safe to re-run. Uses only narrow per-row / `encounter_id` updates.
