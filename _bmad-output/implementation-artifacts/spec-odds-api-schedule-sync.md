---
title: 'Odds API as NFL schedule + results authority'
type: 'feature'
created: '2026-08-03'
status: 'done'
baseline_commit: '408b4459869bb535ffebc9378b4ca80f6628bb17'
context:
  - '{project-root}/docs/project-context.md'
  - '{project-root}/docs/nfl-odds-integration.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** API-Sports free tier cannot access season 2026, so production has orphan fixture matchups and cannot sync real schedule or results. The Odds API already exposes full-slate events plus recent scores with explicit home/away.

**Approach:** Make The Odds API the operational source for both **schedule** (`/events` → upsert `NflGame`, delete season orphans) and **results** (`/scores?daysFrom=3` → finalize scores on existing games). Admin UI + routes use Odds only; leave API-Sports code in-repo unused for ops (do not require `API_SPORTS_KEY` for the happy path).

## Boundaries & Constraints

**Always:**
- Schedule: quota-free `/v4/sports/americanfootball_nfl/events` (`home_team`, `away_team`, `commence_time`); never use markets `/odds` solely for schedule.
- Results: `/v4/sports/americanfootball_nfl/scores` with `daysFrom=3`; map `completed` + per-team `scores` onto existing `NflGame` rows (home/away via canonical names); set status/scores/`finalizedAt` consistent with current results sync semantics.
- Upsert schedule by `(nflSeasonYear, weekNumber, homeTeamId, awayTeamId)`; update **`kickoffAt` only** on conflict.
- After successful schedule map (≥1 game), delete that year’s `NflGame` rows absent from the mapped set.
- Infer week 1–18 from kickoffs (ET Tue–Mon buckets from week-1 Tuesday); drop out-of-range events.
- Auth: league-admin session or `Authorization: Bearer ODDS_SNAPSHOT_SECRET`; `ODDS_API_KEY` server-only.
- Unknown teams / missing key → structured error; schedule sync must not partial-delete on map failure.
- Document the **3-day** scores lookback: operators (or cron later) must sync results within ~3 days of completion.

**Ask First:**
- Deleting `API_SPORTS_KEY` from env/Vercel or deleting `api-sports-nfl` packages/routes.
- Changing week-inference after ship if flex games mis-bucket.
- Broadening scores lookback workarounds (manual score entry is already available via admin if needed).

**Never:**
- Requiring a paid API-Sports plan for 2026 schedule/results ops.
- Writing snapshot/jailed rows from schedule or results sync.
- Client-side Odds calls / exposing `ODDS_API_KEY`.
- Leaving rehearsal fixture games beside real games for a synced season year.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Schedule happy path | Events full slate; teams seeded | Upsert ~272 games wks 1–18; orphans deleted | N/A |
| Schedule missing key | No `ODDS_API_KEY` | `503`; no writes | `ODDS_API_NOT_CONFIGURED` |
| Schedule unknown team | Unmapped name | `422`; no deletes | Log mapping failures |
| Results happy path | Completed scores within 3 days; games exist | Matching games → FINAL + scores + `finalizedAt` once | N/A |
| Results no match | Score event with no `NflGame` | Skip + count/log; others still apply | Soft skip per game |
| Results incomplete window | Game finished >3 days ago, never synced | Not returned by provider; game stays non-FINAL until manual/admin fix | Document ops risk |
| Results re-run | Already FINAL | Idempotent score/status update; don’t regress finalizedAt incorrectly | Match existing semantics |

</frozen-after-approval>

## Code Map

- `src/lib/integrations/the-odds-api/client.ts` -- add `/events` + `/scores` fetchers
- `src/lib/integrations/the-odds-api/schemas.ts` -- event + scores Zod shapes
- `src/lib/integrations/the-odds-api/team-names.ts` -- `canonicalTeamDisplayName`
- `src/lib/integrations/api-sports-nfl/map-schedule.ts` -- `ScheduleUpsertInput` / lookup patterns to reuse
- `src/lib/nfl/sync-nfl-schedule.ts` -- upsert pattern to mirror
- `src/lib/nfl/sync-nfl-results.ts` -- result update / FINAL semantics to preserve or rehome
- `src/app/api/admin/nfl/sync-schedule/route.ts` -- auth pattern; either wrap Odds or add sibling route and point UI at Odds
- `src/app/api/admin/nfl/sync-results/route.ts` -- switch implementation to Odds scores (keep URL if possible)
- `src/app/(app)/leagues/[leagueId]/settings/nfl-odds-admin-panel.tsx` -- Schedule + Results controls for Odds
- `docs/nfl-odds-integration.md` + `docs/deployment.md` -- Odds as schedule/results authority; API-Sports legacy

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/integrations/the-odds-api/client.ts` (+ schemas) -- `fetchAmericanFootballNflEvents` + `fetchAmericanFootballNflScores({ daysFrom: 3 })`
- [x] `src/lib/integrations/the-odds-api/map-schedule-from-events.ts` (+ tests) -- events → `ScheduleUpsertInput[]` with week inference + team resolve
- [x] `src/lib/nfl/sync-nfl-schedule-from-odds.ts` (+ tests) -- fetch/map/upsert + delete season orphans
- [x] `src/lib/integrations/the-odds-api/map-results-from-scores.ts` (+ tests) -- completed scores → result updates matched to existing games (home/away + season; closest kickoff if needed)
- [x] `src/lib/nfl/sync-nfl-results-from-odds.ts` (or rewire `sync-nfl-results.ts`) (+ tests) -- apply FINAL/scores/`finalizedAt` like Story 5.1
- [x] Admin routes -- Odds schedule POST (new or replace operator path); `POST .../sync-results` uses Odds scores + `ODDS_API_KEY`
- [x] `nfl-odds-admin-panel.tsx` -- Sync schedule + Sync results (Odds); no API-Sports dependency in UI copy
- [x] Docs -- Odds authority for schedule/results; 3-day scores window; API-Sports left unused unless Ask First removal

**Acceptance Criteria:**
- Given seeded teams and Odds events, when admin runs schedule sync for 2026, then week 1 has a full real slate (~16) and fixture orphans for that year are gone.
- Given completed Odds scores within `daysFrom=3` for scheduled games, when admin runs results sync, then matching `NflGame` rows become FINAL with home/away scores suitable for existing `scoreNflWeek`.
- Given missing `ODDS_API_KEY`, when either sync runs, then structured `503` and no destructive schedule deletes.
- Given this ships, when operators run season data syncs, then they do not need `API_SPORTS_KEY` for schedule or results.

## Spec Change Log

## Design Notes

**Week inference:** Earliest kickoff defines week 1’s ET week; each game → `1 + floor((kickoff - week1Tuesday00ET) / 7d)`, clamp 1–18; drop others. Unit-test multi-week fixtures.

**Results matching:** Prefer unique `(homeTeamId, awayTeamId)` within `nflSeasonYear`; if ambiguous, nearest `kickoffAt` to `commence_time`. Only apply when `completed === true` and both scores parse as integers.

**API-Sports:** Do not delete code/env in this change. Operator docs + UI must not depend on it. Removal is Ask First.

**Ops:** After deploy, run Odds schedule sync once; during season, run results sync after each week’s games complete (within 3 days), then existing scoring jobs.

## Verification

**Commands:**
- `npm test` -- new map/sync tests green; suite green
- Manual: Settings → Odds schedule sync → picks week 1 ~16 games; (later) results sync on completed week → games FINAL with scores

## Suggested Review Order

**Schedule pipeline**

- Odds `/events` fetch (quota-free schedule source)
  [`client.ts:77`](../../src/lib/integrations/the-odds-api/client.ts#L77)

- Week inference + team resolve → upsert inputs
  [`map-schedule-from-events.ts:64`](../../src/lib/integrations/the-odds-api/map-schedule-from-events.ts#L64)

- Upsert + gated orphan delete (≥200 games; SCHEDULED only)
  [`sync-nfl-schedule-from-odds.ts:14`](../../src/lib/nfl/sync-nfl-schedule-from-odds.ts#L14)

- Admin route wired to Odds + `ODDS_API_KEY`
  [`sync-schedule/route.ts:71`](../../src/app/api/admin/nfl/sync-schedule/route.ts#L71)

**Results pipeline**

- Odds `/scores?daysFrom=3` fetch
  [`client.ts:104`](../../src/lib/integrations/the-odds-api/client.ts#L104)

- Completed scores → match existing games
  [`map-results-from-scores.ts:60`](../../src/lib/integrations/the-odds-api/map-results-from-scores.ts#L60)

- FINAL + scores + `finalizedAt` apply
  [`sync-nfl-results-from-odds.ts:38`](../../src/lib/nfl/sync-nfl-results-from-odds.ts#L38)

- Admin results route
  [`sync-results/route.ts:56`](../../src/app/api/admin/nfl/sync-results/route.ts#L56)

**UI / docs**

- Settings Sync schedule / Sync results buttons
  [`nfl-odds-admin-panel.tsx:240`](../../src/app/(app)/leagues/[leagueId]/settings/nfl-odds-admin-panel.tsx#L240)

- Operator docs: Odds as schedule/results authority
  [`nfl-odds-integration.md:95`](../../docs/nfl-odds-integration.md#L95)
