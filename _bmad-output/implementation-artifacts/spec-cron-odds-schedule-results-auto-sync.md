---
title: 'Cron auto-sync Odds schedule/results (canonical NflGame)'
type: 'feature'
created: '2026-08-04'
status: 'done'
baseline_commit: '7804b3828567d934825850e6c9fdd244d80c6e3a'
context:
  - '{project-root}/docs/project-context.md'
  - '{project-root}/docs/nfl-odds-integration.md'
  - '{project-root}/docs/adr/001-hybrid-canonical-live-league-sim-schedule.md'
  - '{project-root}/docs/deployment.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Real leagues only get Odds-backed schedule and scores when an admin (or automation bearer) hits sync routes, so the canonical live slate can lag without manual action.

**Approach:** Add two Vercel Cron routes that call the existing system-scope Odds sync libs once each (schedule `/events`, results `/scores`) into canonical `NflGame` only; keep admin sync routes as manual override.

## Boundaries & Constraints

**Always:**
- Cron handlers call `syncNflScheduleFromOdds` / `syncNflResultsFromOdds` with `getCurrentNflSeasonYear()` and `ODDS_API_KEY` — same libs as admin; write/delete **canonical `NflGame` only**.
- One system-scope schedule sync + one results sync per invocation (never per-league Odds pulls).
- Auth via `assertCronRequest` (`CRON_SECRET`); GET delegates to POST; structured `logEvent` (`domain: "cron"`); export `maxDuration = 300`.
- Hobby-safe: **at most one cron fire per UTC calendar day**. New schedules must not share UTC days with existing email crons (Tue/Thu/Fri UTC already taken).
- Recommended cadence (document + implement):
  - **Schedule:** Monday UTC (e.g. `0 15 * * 1`) + Eastern window Mon ~10–16 ET — refresh slate before midweek.
  - **Results:** Wednesday UTC (e.g. `0 16 * * 3`) + Eastern window Wed ~11–17 ET — after MNF, still inside Odds `/scores` **`daysFrom=3`** lookback before Thursday.
- Results cron omits `weekNumber` (sync all games matching the lookback onto existing rows). Idempotency = sync lib upserts/finalize (no new sent-flags).
- Document the **3-day scores lookback** ops implication in `docs/nfl-odds-integration.md` and `docs/deployment.md` (missed Wed run → admin `sync-results` override before lookback slides past completed games).
- Outside Eastern window → `{ status: "skipped", reason: "outside_window" }` with 200 (same as email crons). Sync lib failure → non-2xx + structured log (use sync result `httpStatus` / 500 for unexpected).

**Ask First:**
- Changing cadence to a UTC day already used by email crons.
- Combining schedule + results into a single cron path.
- Auto-triggering Tuesday odds snapshot / jailed from these new crons.

**Never:**
- Touch `LeagueSimGame`, sim odds, or `LeagueWeekJailedTeam`.
- Multiply Odds `/events` or `/scores` pulls per league.
- Expand simulation fixture volume (still deferred).
- Remove or weaken admin `POST /api/admin/nfl/sync-schedule` and `sync-results` overrides.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Authorized schedule in window | Bearer `CRON_SECRET`; Mon ET window; `ODDS_API_KEY` set | Calls schedule sync once for current season year; JSON with upserted/deleted; 200 | N/A |
| Authorized results in window | Bearer `CRON_SECRET`; Wed ET window; key set | Calls results sync once (`daysFrom=3`, no week filter); JSON with synced/skipped; 200 | N/A |
| Outside window | Valid secret; wrong ET day/hour | Skip JSON `outside_window`; no Odds call | 200 |
| Missing/wrong secret | No/invalid Bearer | 401 from `assertCronRequest` | No Odds call |
| Missing `ODDS_API_KEY` | In window, authorized | Structured log; 503 `ODDS_API_NOT_CONFIGURED` | No sync |
| Sync lib soft failure | Provider/mapping error from lib | Propagate code/message/`httpStatus`; log failure | Non-2xx |
| Re-run same day | Second authorized hit in window | Idempotent upserts/finalize; safe counts | N/A |
| Open test leagues exist | Sim rows present; cron runs | Canonical `NflGame` updated; sim tables untouched | N/A |

</frozen-after-approval>

## Code Map

- `src/app/api/cron/tuesday-email/route.ts` — pattern: auth → ET window → work → `logEvent` → `cronJobHttpStatus`
- `src/lib/cron/assert-cron-request.ts`, `eastern-window.ts`, `cron-job-http-status.ts` — reuse as-is
- `src/lib/nfl/sync-nfl-schedule-from-odds.ts` — canonical `/events` upsert + gated orphan-delete
- `src/lib/nfl/sync-nfl-results-from-odds.ts` — canonical `/scores` finalize (`daysFrom: 3`)
- `src/lib/league/nfl-season.ts` — `getCurrentNflSeasonYear()`
- `src/app/api/admin/nfl/sync-schedule/route.ts`, `sync-results/route.ts` — manual override (unchanged behavior)
- `vercel.json` — add two cron entries on free UTC days
- `docs/deployment.md`, `docs/nfl-odds-integration.md` — ops + lookback; clear deferred cron note
- `_bmad-output/implementation-artifacts/deferred-work.md` — strike/resolve cron bullet under Option B hybrid split

## Tasks & Acceptance

**Execution:**
- [x] `src/app/api/cron/sync-nfl-schedule/route.ts` -- thin GET/POST cron: `assertCronRequest` → Mon ET window → require `ODDS_API_KEY` → `syncNflScheduleFromOdds(prisma, { apiKey, nflSeasonYear: getCurrentNflSeasonYear() })` → `logEvent` + JSON — system-scope schedule auto-sync
- [x] `src/app/api/cron/sync-nfl-results/route.ts` -- same pattern with Wed ET window → `syncNflResultsFromOdds` without `weekNumber` — system-scope results auto-sync within 3-day lookback
- [x] `vercel.json` -- register `/api/cron/sync-nfl-schedule` (Mon UTC) and `/api/cron/sync-nfl-results` (Wed UTC); do not collide with email cron UTC days
- [x] `docs/deployment.md` -- list new cron routes, curl smoke examples, Hobby day map, **3-day `/scores` lookback** ops note + admin override fallback
- [x] `docs/nfl-odds-integration.md` -- document cron cadence; remove/replace deferred cron bullet; keep admin override; note lookback
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- mark **Cron auto-sync Odds schedule/results** resolved/struck under the Option B hybrid split section
- [x] Colocated route unit tests (or thin handler tests) -- cover matrix: outside window (no sync call), missing key 503, happy-path delegates to sync lib once, unauthorized 401 — prove gating without live Odds

**Acceptance Criteria:**
- Given a valid `CRON_SECRET` inside the schedule Eastern window, when the schedule cron runs, then `syncNflScheduleFromOdds` is invoked exactly once for the current NFL season year and only `NflGame` rows change.
- Given a valid secret inside the results Eastern window, when the results cron runs, then `syncNflResultsFromOdds` is invoked once with no `weekNumber` and completed scores within the provider lookback finalize matching canonical games.
- Given an open test league with `LeagueSimGame` rows, when either cron succeeds, then sim tables are unchanged.
- Given Hobby scheduling, when `vercel.json` is deployed, then the two new crons fire on distinct UTC days unused by the three email crons.
- Given docs updated, when an ops reader checks deployment + odds integration, then they see the 3-day scores lookback implication and that admin sync remains the override.
- Given `npm test`, when the change lands, then suite is green including new cron gate tests.

## Spec Change Log

## Design Notes

**Why two routes (not one):** Hobby allows one cron invocation per UTC day; schedule refresh (Mon) and post-MNF results (Wed) need different calendar days and Eastern windows. Combining would either miss MNF lookback or collide with email UTC days.

**Why no new idempotency table:** Schedule upserts and results finalize are already safe to re-run; email-style `sentAt` flags are unnecessary.

**Golden route skeleton (schedule):** auth → `isInEasternWindow(now, 1, 10, 16)` → missing key 503 → sync → `logEvent` job_complete → JSON `{ nflSeasonYear, upserted, deleted, provider }` or error body matching admin codes.

## Verification

**Commands:**
- `npm test` -- expected: green, including new cron gate tests
- Manual: `curl` schedule/results cron with Bearer outside window → `outside_window`; with secret + forced window in unit tests → sync mocked once

**Manual checks (if no CLI):**
- After deploy: Vercel Cron Jobs shows five paths; Mon/Wed entries present; production smoke with secret once in-window or accept unit coverage + admin override still works.

## Suggested Review Order

**Cron entry points**

- Schedule cron: auth → Mon ET window → one system-scope Odds `/events` sync
  [`route.ts:28`](../../src/app/api/cron/sync-nfl-schedule/route.ts#L28)

- Results cron: Wed ET window; no `weekNumber`; documents 3-day lookback
  [`route.ts:29`](../../src/app/api/cron/sync-nfl-results/route.ts#L29)

**Hobby scheduling**

- Mon/Wed UTC slots leave Tue/Thu/Fri free for email crons
  [`vercel.json:1`](../../vercel.json#L1)

**Ops docs**

- Cron table + `/scores` lookback override guidance
  [`deployment.md:77`](../../docs/deployment.md#L77)

- Cron + admin override in odds summary; `CRON_SECRET` vs snapshot secret
  [`nfl-odds-integration.md:96`](../../docs/nfl-odds-integration.md#L96)

**Tests**

- Gate matrix for schedule route (401 / window / key / once / failure)
  [`route.test.ts:39`](../../src/app/api/cron/sync-nfl-schedule/route.test.ts#L39)

- Results route parity including failure propagation
  [`route.test.ts:39`](../../src/app/api/cron/sync-nfl-results/route.test.ts#L39)
