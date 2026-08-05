---
title: 'Hybrid canonical live NFL schedule + league-scoped sim games'
type: 'feature'
created: '2026-08-04'
status: 'done'
baseline_commit: '6c6a45152e9a4d327d8677a5b21cb97e57fd5d9b'
context:
  - '{project-root}/docs/project-context.md'
  - '{project-root}/docs/nfl-odds-integration.md'
  - '{project-root}/_bmad-output/planning-artifacts/research/technical-league-scoped-vs-canonical-nfl-schedule-research-2026-08-04.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Test-league rehearsal fixtures share the global `NflGame` natural key with Odds-backed live sync, so orphan-delete and uniqueness collide; a real league created after a test league can inherit or fight rehearsal matchups, and sim odds/jailed can stamp the shared week.

**Approach:** Hybrid Option B — keep global `NflGame` as the canonical Odds-backed live slate for real leagues; put test-league schedules (and their odds/jailed side effects) in league-scoped sim storage; route all league game reads through `resolveGamesForLeague`.

## Boundaries & Constraints

**Always:**
- Odds schedule/results/orphan-delete and production odds snapshots write **only** canonical `NflGame` (never sim rows).
- Test-league ensure/sim-results/sim-odds write **only** league-scoped sim games (+ sim odds); never insert fixture rows into `NflGame`.
- `resolveGamesForLeague({ leagueId, nflSeasonYear, weekNumber? })` is the single read seam: real → canonical `NflGame`; test → that league’s sim games.
- Creating a real league after a test league must show the live/Odds slate (or empty until synced) — **zero** fixture-only matchups.
- Two test leagues must not share mutable sim game rows (cascade delete with `League`).
- Test-league jailed compute must not overwrite global `NflWeekJailedTeam` used by real leagues (league-scoped jailed for test, or equivalent isolation).
- Existing fixture JSON volume (~4 games/week) stays for this change; expand later (deferred).
- Prefer new table(s) over nullable `leagueId` on `NflGame`.

**Ask First:**
- Changing Odds orphan-delete gate semantics beyond “canonical-only”.
- Making real-league schedules league-scoped copies (Option A).
- Expanding fixture JSON to full NFL week volume (deferred intentionally).
- Adding Vercel cron for Odds schedule/results auto-sync (deferred intentionally).

**Never:**
- Provenance-only coexistence of live + rehearsal on one mutable `NflGame` keyspace as the long-term design.
- Per-real-league copies of the live slate in this change.
- Multiplying Odds `/events` or `/scores` pulls per league.
- Expanding fixtures or shipping cron auto-sync in this PR.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Real league week view | `isTestLeague=false`; live games exist | Facade returns canonical `NflGame` for year/week | N/A |
| Test league ensure | `isTestLeague=true`; empty sim week | Upsert fixture matchups into sim store for that `leagueId` only | Structured error if fixture/teams invalid |
| Real after test | Test league has sim weeks; then create real | Real picks week has no fixture-only games | N/A |
| Odds schedule sync | Full events map; leftover global `test_fixture` rows exist | Upsert/delete **canonical only**; sim tables untouched | Keep fail-closed on map failure (no partial orphan delete) |
| Two test leagues | League A and B both advance same week | Independent sim rows; deleting A does not wipe B | Cascade only A’s sim data |
| Finalize sim week | Test advance results | Updates sim game scores/status; scoring still league-scoped via existing `leagueId` pick filter | Do not require canonical week completeness for test finalize |
| Test jailed | Sim odds applied for test league week | Jailed persisted in league-scoped store; global `NflWeekJailedTeam` unchanged | Fail closed if sim odds incomplete |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` + migration `20260805010000_league_sim_schedule_hybrid_b` — `LeagueSimGame`, `LeagueSimOddsSnapshotRun`, `LeagueSimGameOddsLine`, `LeagueWeekJailedTeam`
- `src/lib/nfl/resolve-games-for-league.ts` — facade (+ tests)
- `src/lib/nfl/apply-simulation-odds-snapshot.ts` — ensure + odds → sim store only
- `src/lib/nfl/apply-simulation-week-results.ts` — finalize sim rows by id
- `src/lib/nfl/cleanup-rehearsal-fixtures.ts` — legacy global `test_fixture` cleanup; sim cascades with League
- `src/lib/nfl/sync-nfl-schedule-from-odds.ts` — canonical-only (documented)
- `src/lib/nfl/jailed-computation.ts` (`computeAndPersistLeagueWeekJailed`) + `league-jailed.ts`
- League loaders (picks/admin/email/scoring/export) — via facade + jailed helpers
- `src/lib/nfl/effective-odds.ts` — `getEffectiveOddsLinesForLeague` / sim week
- `docs/adr/001-hybrid-canonical-live-league-sim-schedule.md` + `docs/nfl-odds-integration.md`

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma` (+ migration) -- `LeagueSimGame` mirroring `NflGame` fields + `leagueId` unique `(leagueId, year, week, home, away)`, `onDelete: Cascade`; add sim-odds linkage and league-scoped jailed for test
- [x] `src/lib/nfl/resolve-games-for-league.ts` (+ tests) -- branch on `isTestLeague`; stable shape for kickoff/status/scores/team ids
- [x] Sim writers (`apply-simulation-odds-snapshot.ts`, `apply-simulation-week-results.ts`) -- write/read sim tables only; never upsert global fixture `NflGame`
- [x] Jailed + effective-odds paths -- test leagues use sim games/odds + league-scoped jailed; real unchanged on global tables
- [x] Call-site migration -- grep-driven: picks, admin, email, scoring week loaders use facade (or thin wrappers)
- [x] `cleanup-rehearsal-fixtures.ts` (+ one-off cleanup) -- remove leftover global `test_fixture`-only `NflGame` / snapshot runs; stop relying on shared-table retention for open test leagues
- [x] Isolation + matrix unit tests -- real-after-test, two-test-league independence, Odds sync ignores sim, ensure no longer stamps odds on live slate
- [x] Docs/ADR -- hybrid B decision; point deferred cron + full-volume fixtures to `deferred-work.md`

**Acceptance Criteria:**
- Given a test league with ensured sim weeks, when a real league is created for the same NFL year, then the real league’s week view contains no fixture-only matchups.
- Given Odds schedule sync runs with open test leagues, when orphan-delete executes, then `LeagueSimGame` rows are unchanged and only canonical `NflGame` orphans are considered.
- Given two test leagues, when both ensure the same week and one is deleted, then the other’s sim games remain.
- Given a test league advances odds/jailed for a week, when a real league reads that week’s jailed team, then it still sees the global/production jailed row (or null), not the test league’s sim jailed result.
- Given `npm test`, when the change lands, then suite is green including new isolation tests.

## Spec Change Log

## Design Notes

**Why separate table:** Prisma upsert/`@@unique` stay clean for Odds on `NflGame`; sim uniqueness includes `leagueId`. Avoid nullable `leagueId` + partial uniques.

**Facade return shape:** Prefer a small shared DTO (`id`, `nflSeasonYear`, `weekNumber`, `homeTeamId`, `awayTeamId`, `kickoffAt`, `status`, scores, `finalizedAt`, `source: "canonical" | "sim"`) so picks/email don’t import Prisma model unions everywhere. **Shipped:** `LeagueResolvedGame` in `resolve-games-for-league.ts`.

**Sim odds:** Parallel models shipped — `LeagueSimOddsSnapshotRun` + `LeagueSimGameOddsLine` (no FK to `NflGame` / global `OddsSnapshotRun`).

**Jailed:** Global `NflWeekJailedTeam` remains the authority for real leagues. Test path persists `LeagueWeekJailedTeam`; readers use `getJailedTeamIdForLeagueWeek` / `getJailedWithTeamForLeagueWeek`.

**Out of scope this PR:** fixture volume expansion; cron auto-sync (see deferred-work).

## Code Map (post-implementation)

- `prisma/schema.prisma` + `prisma/migrations/20260805010000_league_sim_schedule_hybrid_b/`
- `src/lib/nfl/resolve-games-for-league.ts`, `effective-odds.ts`, `league-jailed.ts`, `jailed-computation.ts` (`computeAndPersistLeagueWeekJailed`)
- Sim writers: `apply-simulation-odds-snapshot.ts`, `apply-simulation-week-results.ts`
- Cleanup: `cleanup-rehearsal-fixtures.ts` (legacy global `test_fixture` only; sim cascades)
- Docs: `docs/adr/001-hybrid-canonical-live-league-sim-schedule.md`

## Verification

**Commands:**
- `npm test` -- expected: all green, including new facade/isolation/sim-writer tests
- `npx prisma validate` -- expected: schema valid after migration

**Manual checks (if no CLI):**
- Create test league → advance a week → create real league → confirm real picks week is live slate (or empty), not 4-game fixture cycle.
- Confirm admin Odds schedule sync still updates only `nfl_games`.

## Suggested Review Order

**Read facade (start here)**

- Single league schedule seam: real → canonical, test → sim
  [`resolve-games-for-league.ts:102`](../../src/lib/nfl/resolve-games-for-league.ts#L102)

- Fail closed if league missing; exclude leftover fixture-only canonical rows
  [`resolve-games-for-league.ts:48`](../../src/lib/nfl/resolve-games-for-league.ts#L48)

**Schema**

- League-scoped sim games + cascade from League
  [`schema.prisma:256`](../../prisma/schema.prisma#L256)

- Sim odds lines keyed to sim game ids (not NflGame)
  [`schema.prisma:302`](../../prisma/schema.prisma#L302)

- Test-league jailed isolation
  [`schema.prisma:319`](../../prisma/schema.prisma#L319)

**Sim writers**

- Odds snapshot writes only LeagueSimGame / sim odds / league jailed
  [`apply-simulation-odds-snapshot.ts:45`](../../src/lib/nfl/apply-simulation-odds-snapshot.ts#L45)

- Results finalize sim rows; require completed test_fixture sim odds
  [`apply-simulation-week-results.ts:36`](../../src/lib/nfl/apply-simulation-week-results.ts#L36)

- League jailed never touches global NflWeekJailedTeam; no wall-clock deadline
  [`jailed-computation.ts:229`](../../src/lib/nfl/jailed-computation.ts#L229)

**Cutover / cleanup**

- Backfill open test leagues from legacy global fixtures before purge
  [`backfill-league-sim-from-legacy-fixtures.ts:30`](../../src/lib/nfl/backfill-league-sim-from-legacy-fixtures.ts#L30)

- Purge leftover global test_fixture rows after backfill
  [`cleanup-rehearsal-fixtures.ts:30`](../../src/lib/nfl/cleanup-rehearsal-fixtures.ts#L30)

**Scoring / odds isolation**

- Unscoped score excludes test-league picks
  [`score-nfl-week.ts:20`](../../src/lib/scoring/score-nfl-week.ts#L20)

- Canonical effective odds ignore test_fixture provenance
  [`effective-odds.ts:15`](../../src/lib/nfl/effective-odds.ts#L15)

**Docs**

- ADR for Hybrid B decision
  [`001-hybrid-canonical-live-league-sim-schedule.md:1`](../../docs/adr/001-hybrid-canonical-live-league-sim-schedule.md#L1)

**Tests**

- Acceptance isolation matrix
  [`hybrid-schedule-isolation.test.ts:13`](../../src/lib/nfl/hybrid-schedule-isolation.test.ts#L13)
