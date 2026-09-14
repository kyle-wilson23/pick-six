---
title: 'Cron Tuesday week-close (results → finalize → odds → jailed)'
type: 'feature'
created: '2026-09-13'
status: 'done'
baseline_commit: '7cf12b00463c9be54c2e68fd289090d98d152cca'
context:
  - '{project-root}/docs/project-context.md'
  - '{project-root}/docs/deployment.md'
  - '{project-root}/docs/nfl-odds-integration.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Admins still manually sync results, finalize/score the closed week, snapshot next-week odds, and compute the jailed team, so Tuesday standings and the new pick slate depend on a human.

**Approach:** Dedicated Tuesday ~7am ET cron: results sync → `finalizeNflWeek` (closed week) → odds snapshot → global jailed (opening week). Admin routes stay as overrides. Wednesday results cron stays and also finalizes so late MNF still scores.

## Boundaries & Constraints

**Always:**
- New `/api/cron/week-close` — do **not** fold into `reminder-tick-am`. `assertCronRequest`; GET → POST; `maxDuration = 300`; `logEvent` `domain: "cron"`.
- Schedule `0 11 * * 2`. Gate Tuesday **5:00–11:00** ET. Outside window → 200 `{ status: "skipped", reason: "outside_window" }`, no work.
- System-scope only (no `leagueId`, no per-league Odds): `syncNflResultsFromOdds` (no `weekNumber`) → `finalizeNflWeek` (closed) → `snapshotNflWeekOddsFromProvider` (opening) → `computeAndPersistNflWeekJailed` (opening, `{ via: "automation" }`). Canonical `NflGame` / `NflWeekJailedTeam` only.
- Opening week = `resolvePicksWeekNumber` on canonical games (initialized season, FCW `1`). Closed = opening − 1 when opening > 1. All kickoffs past → finalize that last week; skip snapshot/jailed. Week 1 still upcoming → skip finalize; still snapshot + jailed week 1.
- Incomplete finalize (`allGamesFinalized: false`) is not a hard failure: continue snapshot + jailed. Snapshot fail → skip jailed. Results hard fail → skip finalize; still attempt snapshot + jailed. Any hard step failure → non-2xx.
- Wednesday `/api/cron/sync-nfl-results` stays. After **successful** Wed sync, `finalizeNflWeek` for the closed week (no snapshot/jailed).
- Missing `ODDS_API_KEY` in window → 503. Re-runs safe (sync/finalize idempotent; snapshot may add a run). Document Tue vs Wed and that admin `sync-results` / `finalize-week` / `snapshot-odds` / `week-jailed` remain overrides.

**Ask First:**
- Removing the Wednesday results cron.
- Folding this into `reminder-tick-am` or `tuesday-email`.
- Auto-finalizing test/sim leagues from production cron.

**Never:**
- Touch `LeagueSimGame`, sim odds, or `LeagueWeekJailedTeam`.
- Call `scoreNflWeek` without the `finalizeNflWeek` completeness gate.
- Remove or weaken admin override routes.
- Mid-week automatic odds re-fetch from this job.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path | Secret; Tue 5–11 ET; closed week FINAL | Results → finalize → snapshot → jailed; 200 | N/A |
| Outside window / unauthorized | Wrong ET window or bad Bearer | No libs | 200 skip / 401 |
| Missing `ODDS_API_KEY` | In window | No work | 503 |
| Incomplete MNF | Closed week not all FINAL | Scored 0; still snapshot + jailed | 200 |
| Results hard fail | Sync lib error | Skip finalize; attempt snapshot + jailed | Non-2xx |
| Snapshot hard fail | Snapshot lib error | Skip jailed | Non-2xx |
| Week 1 not started | Opening = 1 | Skip finalize; snapshot + jailed week 1 | 200 |
| Season complete | All kickoffs past | Finalize last week; skip snapshot + jailed | 200 |
| Re-run / test leagues | Second hit; sim rows exist | Canonical only; sim untouched | N/A |
| Wed catch-up | Tue left MNF open; now FINAL | Sync then finalize closed week only | Sync fail → no finalize; non-2xx |

</frozen-after-approval>

## Code Map

- `src/app/api/cron/sync-nfl-results/route.ts` (+ `route.test.ts`) — copy shell; add finalize after ok sync
- `src/lib/cron/assert-cron-request.ts`, `eastern-window.ts` — reuse
- `src/lib/nfl/resolve-picks-week.ts` — `resolvePicksWeekNumber`
- `src/lib/nfl/sync-nfl-results-from-odds.ts`, `src/lib/scoring/finalize-nfl-week.ts`, `src/lib/nfl/snapshot-nfl-week-odds.ts`, `src/lib/nfl/jailed-computation.ts` — existing libs
- `src/lib/league/nfl-season.ts` — `getCurrentNflSeasonYear`
- `vercel.json`, `docs/deployment.md`, `docs/nfl-odds-integration.md`
- Admin overrides (behavior unchanged): `src/app/api/admin/nfl/sync-results/route.ts`, `scoring/finalize-week/route.ts`, `nfl/snapshot-odds/route.ts`, `nfl/week-jailed/route.ts`

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/cron/week-close-targets.ts` (+ `.test.ts`) -- `resolveWeekCloseTargets(games, now)` → `{ openingWeek, closedWeek, snapshotWeek }`; tests: week 1, mid-season, post-season
- [x] `src/lib/cron/run-week-close.ts` (+ `.test.ts`) -- four-step orchestrator with continue/skip rules; mock libs for matrix (incomplete MNF, results fail, snapshot fail)
- [x] `src/app/api/cron/week-close/route.ts` (+ `.test.ts`) -- auth → Tue 5–11 ET → key → `runWeekClose` → `logEvent` + status; tests: 401 / skip / 503 / delegates once
- [x] `src/app/api/cron/sync-nfl-results/route.ts` (+ `.test.ts`) -- after ok sync, finalize closed week; no finalize on sync fail or outside window
- [x] `vercel.json` -- `{ "path": "/api/cron/week-close", "schedule": "0 11 * * 2" }`
- [x] `docs/deployment.md`, `docs/nfl-odds-integration.md` -- week-close row, curl smoke, Tue vs Wed finalize; admin overrides remain

**Acceptance Criteria:**
- Given a valid secret in Tuesday 5–11 ET and a fully final closed week, when week-close runs, then results, finalize (no `leagueId`), opening snapshot, and automation jailed run in that order.
- Given incomplete closed-week games, when week-close runs, then scoring is skipped and opening snapshot + jailed still run.
- Given Wednesday results cron after late MNF, when sync succeeds, then `finalizeNflWeek` runs for the closed week and odds/jailed do not.
- Given an open test league, when either cron succeeds, then sim tables are unchanged.
- Given `npm test`, when the change lands, then the suite is green including new week-close tests.

## Spec Change Log

## Design Notes

**Dedicated route:** Global NFL pipeline vs per-league AM reminder email. Same UTC minute as `reminder-tick-am` is OK (no shared Odds call). Do not serialize in one handler.

**Incomplete finalize continues:** Next week still needs odds + jailed at 7am. Scoring catch-up is Wednesday (and admin).

**Order:** `syncNflResultsFromOdds` → `finalizeNflWeek({ weekNumber: closed })` → `snapshotNflWeekOddsFromProvider({ weekNumber: opening })` → `computeAndPersistNflWeekJailed(..., { via: "automation" })`.

## Verification

**Commands:**
- `npm test` -- expected: green, including week-close-targets, run-week-close, week-close route, and updated results-cron tests

**Manual checks (if no CLI):**
- After deploy: Vercel Cron Jobs lists `/api/cron/week-close` on `0 11 * * 2`. Curl with secret outside the Tuesday window returns `outside_window`. Admin settings buttons still call the same four libs.

## Suggested Review Order

**Pipeline**

- Sequential results → finalize → snapshot → jailed with continue/skip rules
  [`run-week-close.ts:97`](../../src/lib/cron/run-week-close.ts#L97)

- Closed vs opening week from canonical kickoffs
  [`week-close-targets.ts:21`](../../src/lib/cron/week-close-targets.ts#L21)

- Incomplete MNF skips scoring; still opens next week
  [`run-week-close.ts:115`](../../src/lib/cron/run-week-close.ts#L115)

**Cron entry**

- Dedicated Tuesday 5–11 ET gate; does not fold into reminder-tick-am
  [`route.ts:29`](../../src/app/api/cron/week-close/route.ts#L29)

- Hobby schedule at the 7am ET UTC instant
  [`vercel.json:12`](../../vercel.json#L12)

**Wednesday catch-up**

- After successful `/scores` sync, finalize closed week only
  [`route.ts:90`](../../src/app/api/cron/sync-nfl-results/route.ts#L90)

**Ops docs**

- Tue vs Wed roles and admin overrides
  [`deployment.md:85`](../../docs/deployment.md#L85)

**Tests**

- Orchestrator matrix including incomplete MNF and hard fails
  [`run-week-close.test.ts:75`](../../src/lib/cron/run-week-close.test.ts#L75)

