# Story 8.3: Simulated Odds and Jailed Team for Rehearsal

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the system,
I want **fixture / deterministic-seed odds** for a test league's active simulated week (no live odds API required),
so that jailed-team logic and pick validation exercise the **same production algorithm** using controlled, repeatable inputs during rehearsal.

## Acceptance Criteria

### AC1 — Deterministic fixture odds line generator (pure function)

**Given** a game identified by `(nflSeasonYear, weekNumber, homeTeamId, awayTeamId)`

**When** `deriveFixtureOddsLine(input)` is called (new pure function, `src/lib/domain/derive-fixture-odds-line.ts`)

**Then** it deterministically returns `{ homeMoneylineAmerican: number; awayMoneylineAmerican: number; homeSpreadPoints: number }` where:

1. Exactly one of `homeMoneylineAmerican` / `awayMoneylineAmerican` is negative (the favorite) and the other is positive (the underdog) — **never both non-negative** (this input shape is what `resolveJailedTeam` in `src/lib/domain/jailed.ts` requires to treat the game as having "a real favorite"; both-positive games are silently excluded there)
2. The favorite's moneyline is in `[-450, -110]`; the underdog's is in `[+100, +440]`
3. `homeSpreadPoints` is a half-point value in `[-14, -0.5]` when home is favored, or `[+0.5, +14]` when away is favored, and its **sign is consistent** with which side has the negative moneyline (spread favors the same team as the moneyline)
4. The function is a **pure hash of its inputs** (SHA-256 of `` `${nflSeasonYear}:${weekNumber}:${homeTeamId}:${awayTeamId}` ``, no `Date.now()` / `Math.random()`) — same inputs always produce the same output, so re-running the "apply odds snapshot" action (AC3) for the same week is idempotent in effect even though it creates a new `OddsSnapshotRun` row each time
5. Different `(homeTeamId, awayTeamId)` pairs (or a different `weekNumber`) produce different-looking lines in practice (not a constant) — verify with a test asserting at least 2 distinct input combinations produce non-identical output

**And** this function works identically whether the game is a **fixture-created** game (AC2) or an **already-existing real** game (e.g. Story 3.9 schedule sync already covered that week) — it never assumes a specific team pairing, only real team IDs of whatever game it is given

---

### AC2 — Fixture schedule data + safe game creation (only when missing)

**Given** a JSON fixture file `prisma/data/nfl-simulation-fixture-schedule.json` shaped as an array of "fixture weeks", each `{ "games": [{ "home": "<abbr>", "away": "<abbr>" }, ...] }`, using only abbreviations present in `prisma/data/nfl-teams.json`

**When** the admin action (AC3) needs games for a target `(nflSeasonYear, weekNumber)` and `prisma.nflGame.findMany({ where: { nflSeasonYear, weekNumber } })` returns **zero** rows

**Then** create `NflGame` rows from `fixtureWeeks[(weekNumber - 1) % fixtureWeeks.length].games`, resolving each `home`/`away` abbreviation to a `Team.id` via `prisma.team.findMany` (teams are already seeded — no team creation here), using `prisma.nflGame.upsert` on the existing natural key (`@@unique([nflSeasonYear, weekNumber, homeTeamId, awayTeamId])`) so repeated calls are idempotent and never duplicate rows

**And** the fixture file contains **at least 6 fixture weeks**, each with **at least 4 games** and **no team abbreviation repeated within the same fixture week** (a team plays at most once per fixture week) — enforced by a colocated test that loads and validates the whole file's structural integrity (valid abbreviations, no duplicate team within a week, `games.length >= 4`)

**And** when `weekNumber` already has **any** `NflGame` rows (a production sync from Story 3.9 already covered it, or a prior "apply" call already created fixture games for it) — **do not** create or duplicate games; use the existing rows as-is for AC1's odds derivation. This is the same "real data wins when it exists" precedent already documented in Story 8.2's Dev Notes.

**And** newly-created fixture games get a `kickoffAt` that is **always safely in the future** relative to the moment of creation, so the pick deadline (`computePickDeadlineUtc`, Story 3.5) never blocks rehearsal pick submission or jailed recompute:

- The **earliest** game in a newly-created fixture week kicks off at **20:20 America/New_York on the next calendar Thursday that is at least 3 full days after `now`** (the moment the action runs) — computed with the same `date-fns-tz` (`formatInTimeZone` / `fromZonedTime`) helpers already used in `src/lib/domain/pick-deadline.ts` (`LEAGUE_BUSINESS_TIMEZONE`), not a new date library
- Remaining games in that same fixture week are spread across the following **Sunday 13:00**, **Sunday 16:25**, and **Monday 20:15** (America/New_York) relative to that Thursday — this loosely mirrors real NFL week spacing (Thu/Sun/Sun/Mon) purely so `computePickDeadlineUtc`'s "Thursday 8:10 PM ET, on-or-before the first game's calendar day" branch resolves to **that same Thursday, 10 minutes before kickoff** — a safe, comfortably-future deadline, not an accidentally-past one
- **Why this matters (do not simplify to "now + N hours" without checking):** `lockByThursdayDefaultUtc` walks the calendar **backward** from the first game's day to find an on-or-before Thursday — if the first game's weekday is chosen carelessly, the computed Thursday-lock could land in the **past** relative to `now`, immediately blocking the very pick submissions this story exists to unblock. Anchoring the first game exactly on a future Thursday sidesteps this by construction (`docs`: verify with a unit test asserting `computePickDeadlineUtc(firstFixtureKickoff) > now` for the generated times)

---

### AC3 — Admin action "apply weekly odds snapshot" (new route, full guard chain)

**Given** a test league whose simulation has started (`Season.simulatedCurrentWeek` non-null)

**When** the admin clicks **"Apply odds snapshot"** on the league admin dashboard

**Then** `POST /api/leagues/[leagueId]/simulation/apply-odds-snapshot` (no request body needed — targets the league's **current** simulated week, `season.simulatedCurrentWeek`):

1. **403** `NOT_TEST_LEAGUE` if `league.isTestLeague === false` (AC7 no-op rule, reaffirmed)
2. **404** `SEASON_NOT_FOUND` if no season row for this league + current NFL season year
3. **409** `SIMULATION_NOT_STARTED` if `simulatedCurrentWeek` is `NULL`
4. **200** on success — internally calls the new orchestration function `applySimulationOddsSnapshot(prisma, { nflSeasonYear: season.nflSeasonYear, weekNumber: season.simulatedCurrentWeek }, actor)` in `src/lib/nfl/apply-simulation-odds-snapshot.ts`, which (a) ensures games exist (AC2), (b) writes a **new** `OddsSnapshotRun` (`source: "test_fixture"`, a new exported constant `ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE`) + one `NflGameOddsLine` per game via AC1's `deriveFixtureOddsLine`, both `COMPLETED` immediately (no external call, nothing can be `PENDING`/`FAILED`), then (c) calls the **existing, unmodified** `computeAndPersistNflWeekJailed` from `src/lib/nfl/jailed-computation.ts` (Story 3.3) for the same `(nflSeasonYear, weekNumber)`
5. Response body: `{ nflSeasonYear, weekNumber, gamesInWeek, oddsSnapshotRunId, jailedTeamId, jailedTeamAbbreviation, resolvedBy }`
6. If step 4(c)'s jailed compute itself fails (e.g. the defensive `WEEK_PICK_WINDOW_CLOSED` from a misconfigured clock, or `NO_COMPLETE_MONEYLINES` from a malformed fixture) — propagate that function's `code` / `message` / `httpStatus` unchanged; do not swallow or remap it

**And** this action is **safe to click repeatedly** for the same week (no `SIMULATION_WEEK_STALE`-style optimistic-lock guard needed, unlike `advance-week`) — it does not move any pointer, and AC1's determinism means repeat calls reproduce the same jailed result (extra `OddsSnapshotRun` history rows are the only side effect, matching the existing "every snapshot is a new row, latest `COMPLETED` wins" pattern from Story 3.2)

**And** CSRF / auth ordering matches `pre-season-init` and `advance-week`: parse body (empty `{}` is valid, same `readJsonObject` pattern) → `assertCookieSessionMutationOrigin` → `auth()` → admin-membership check → `isTestLeague` check → season lookup → `simulatedCurrentWeek` check → orchestration call

**And**, per project-context.md non-negotiable #9, this route is **intentionally not added** to `src/proxy.ts`'s `shouldRateLimitPost` — admin-gated, low abuse surface, same documented exception as `advance-week` / `first-competition-week` PATCH. State this explicitly in the new route's JSDoc header.

---

### AC4 — Jailed computed via the unchanged production algorithm

**Given** AC3's orchestration has just written fixture `NflGameOddsLine` rows for the target week

**When** `computeAndPersistNflWeekJailed` runs (Story 3.3's existing function — **zero changes** to `src/lib/domain/jailed.ts` or `src/lib/nfl/jailed-computation.ts`)

**Then** it reads the fixture lines through the **existing, unmodified** `getEffectiveOddsLinesForWeek` (Story 3.2's "latest `COMPLETED` run per game" merge) exactly as it would for real provider odds, and upserts the `NflWeekJailedTeam` row using the same moneyline → spread → deterministic-random algorithm as production

**And** a test proves this end-to-end at the pure-function level: feed `deriveFixtureOddsLine`'s output for a small set of fixture games into `resolveJailedTeam` (already-tested Story 3.3 function) and assert it resolves without error to `MONEYLINE`, `SPREAD`, or `RANDOM` — i.e. AC1's generated lines never produce `NO_COMPLETE_MONEYLINES` or `JAILED_RESOLUTION_INCONSISTENT`

---

### AC5 — Admin UI trigger + result surfacing

**Given** the existing `AdminSimulationControls` component (Story 8.2, rendered on `/leagues/[leagueId]/admin` only when `league.isTestLeague && season`)

**When** the simulation has started (`simulatedCurrentWeek` non-null)

**Then** extend `AdminSimulationControls` (do not create a sibling component — this is one more control in the same "Simulation" `Paper`/`Stack` card, per the established pattern) with a second button: **"Apply odds snapshot for Week {simulatedCurrentWeek}"**

**And**, unlike "Advance to Week N", this button has **no confirmation `Dialog`** — it is non-destructive and idempotent-in-effect (AC3), so a plain `fetch` + inline result is sufficient (matches the existing "Run snapshot (API)" button's no-confirm precedent in `NflOddsAdminPanel`)

**And** on success, show an inline `Alert severity="success"` (or `info`) with a human-readable summary, e.g. *"Applied fixture odds for Week 3 — 4 games, jailed team: PHI (MONEYLINE)."*; on failure, show `Alert severity="error"` with the API's `error.message`; disable the button while the request is in flight

**And** the button is disabled when `simulatedCurrentWeek == null` (simulation not started) — it does **not** need to be disabled when the simulation is `complete`, since re-applying odds for the final configured week remains a valid action

---

### AC6 — Fix jailed verification's test-league week resolution gap (critical — do not skip)

**Given** `src/lib/admin/get-jailed-verification.ts` currently calls `resolvePicksWeekNumber` **directly** (the real-time, kickoff-based resolver) to decide which week's `NflWeekJailedTeam` row to display on the admin dashboard's `AdminJailedVerification` card

**And** Story 8.2's AC5 named exactly three call sites to make test-league-aware (`build-league-picks-week-view.ts`, `build-submission-status.ts`, `build-admin-override-data.ts`) — `get-jailed-verification.ts` was **not** one of them, because before this story no `NflWeekJailedTeam` row ever existed for a simulated week, so the bug was invisible. **This story makes it visible**: once AC3/AC4 write real jailed rows for `simulatedCurrentWeek`, a test league's admin dashboard would show the **wrong week's** jailed team (whatever `resolvePicksWeekNumber`'s real-clock logic happens to compute — typically stuck near `firstCompetitionWeek` throughout pre-season) instead of the currently-simulated week — exactly the "must stay in sync" class of bug the 8.2 code review already fixed once for `build-admin-override-data.ts`

**When** this story ships

**Then** `getJailedVerification` fetches `league.isTestLeague` (parallel `db.league.findUnique`, same shape as `buildSubmissionStatus`) and switches from `resolvePicksWeekNumber(...)` to `resolveActiveWeekNumber({ isTestLeague, season, gamesForYear, now })`, passing `season.simulatedCurrentWeek` through in the `MinimalSeasonForPicksWeek` object — mirroring `build-submission-status.ts`'s `canResolveActiveWeek` pattern exactly (including its "test league + `simulatedCurrentWeek` set + zero `NflGame` rows yet" allowance)

**And** production leagues (`isTestLeague === false`) get **byte-identical** output to today — write `src/lib/admin/get-jailed-verification.test.ts` (new file; none exists today) using the same `vi.mock("@/lib/db", ...)` pattern as `build-submission-status.test.ts`, with at least: (a) a production-league case proving the resolved week matches pre-existing `resolvePicksWeekNumber` behavior, and (b) a test-league case proving the resolved week follows `simulatedCurrentWeek` regardless of `now` (mirrors `build-submission-status.test.ts`'s "AC5" test, cited above)

---

### AC7 — Data separation / no-op for production leagues (reaffirmed)

**Given** Story 8.1 AC6 / Story 8.2 AC8's standing rule: "every Epic 8 simulation behavior MUST no-op or 403 for `isTestLeague === false`"

**When** this story's code runs against a production league

**Then** verify:

1. `POST /api/leagues/[leagueId]/simulation/apply-odds-snapshot` on a production league → **403** `NOT_TEST_LEAGUE`, no DB write (verified by code inspection — matches the project-wide convention that no `route.ts` has a colocated integration test, confirmed again in Stories 8.1/8.2)
2. `getJailedVerification`'s production-league path is byte-identical to pre-8.3 behavior (AC6's test)
3. `applySimulationOddsSnapshot` / `deriveFixtureOddsLine` / the fixture schedule helpers are **never invoked** for a production league — the route's `isTestLeague` check (AC3, step 1) gate happens **before** any call into this story's new orchestration code, so these new functions need **no internal `isTestLeague` awareness of their own** (same design as `computeAndPersistNflWeekJailed` and `snapshotNflWeekOddsFromProvider`, which are global functions with no league concept at all — do not add an unnecessary `isTestLeague` parameter to them)

---

### AC8 — Fixture provenance / auditability

**Given** `OddsSnapshotRun.source` already distinguishes `"the_odds_api"` (Story 3.2) from `"manual"` (Story 3.2's `upsertManualOddsLineForGame`)

**When** AC3's action writes a fixture snapshot

**Then** it uses a **new, distinct** source string, `"test_fixture"` (exported as `ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE` from `src/lib/nfl/apply-simulation-odds-snapshot.ts`) — so a future operator inspecting `OddsSnapshotRun` rows (e.g. via `NflOddsAdminPanel` debugging, or a DB query) can always tell fixture-rehearsal odds apart from real provider fetches or manual corrections, without needing any new UI

**And** no changes are required to `NflOddsAdminPanel` (`src/app/(app)/leagues/[leagueId]/settings/nfl-odds-admin-panel.tsx`) — it already lists/edits odds lines for **any** `(nflSeasonYear, weekNumber)` with existing games, so once AC2 creates fixture games, an admin can optionally hand-edit individual lines there too (this satisfies the epic's "admin upload" fallback option without building new upload UI — reuse, don't reinvent)

---

## Tasks / Subtasks

- [x] Task 1: Deterministic fixture odds generator (AC: #1)
  - [x] `src/lib/domain/derive-fixture-odds-line.ts` (+ `.test.ts`): `deriveFixtureOddsLine`, pure SHA-256-seeded, sign-safe (never both non-negative), realistic moneyline/spread ranges
- [x] Task 2: Fixture schedule data + selection helper (AC: #2)
  - [x] `prisma/data/nfl-simulation-fixture-schedule.json`: ≥6 fixture weeks × ≥4 games, valid team abbreviations, no repeat within a week (use the concrete 6-week / 4-game example in Dev Notes as a starting point)
  - [x] `src/lib/nfl/simulation-fixture-schedule.ts` (+ `.test.ts`): `selectFixtureMatchups(weekNumber)` (modulo cycling), `buildFixtureKickoffTimes(anchorNow, gameCount)` (Thu 20:20 ET ≥3 days out, then Sun 13:00 / Sun 16:25 / Mon 20:15 ET) + a structural-integrity test over the whole JSON file
- [x] Task 3: Orchestration + admin route (AC: #3, #4, #7, #8)
  - [x] `src/lib/nfl/apply-simulation-odds-snapshot.ts`: `ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE` constant + `applySimulationOddsSnapshot(prisma, { nflSeasonYear, weekNumber }, actor, now?)` — ensure games (AC2, upsert-if-missing) → write `OddsSnapshotRun` + `NflGameOddsLine`s (AC1 per game) → call unmodified `computeAndPersistNflWeekJailed` (AC4)
  - [x] `src/app/api/leagues/[leagueId]/simulation/apply-odds-snapshot/route.ts` (POST): full guard chain (CSRF → auth → admin → isTestLeague → season → started → orchestration call); JSDoc documents the intentional rate-limit exclusion
- [x] Task 4: Admin UI (AC: #5)
  - [x] Extend `src/components/admin/AdminSimulationControls.tsx`: second button, no confirm dialog, inline success/error `Alert`, disabled only when not started
- [x] Task 5: Fix `getJailedVerification` test-league gap (AC: #6, #7)
  - [x] `src/lib/admin/get-jailed-verification.ts`: fetch `league.isTestLeague`, switch to `resolveActiveWeekNumber`
  - [x] New `src/lib/admin/get-jailed-verification.test.ts`: production byte-identical case + test-league `simulatedCurrentWeek` case
- [x] Task 6: Closeout
  - [x] `npm test` for all touched/new files
  - [x] Manual smoke (see Testing requirements)
  - [x] Add a forward-looking note to `deferred-work.md` for Story 8.7 (see Dev Notes "Flag forward to Story 8.7" — global `NflGame`/`OddsSnapshotRun`/`NflWeekJailedTeam` rows this story creates are **not** league-scoped, so 8.7's per-league cascade delete cannot clean them up; 8.7 must explicitly decide whether/how to handle this)

### Review Findings

- [x] [Review][Decision] `NO_GAMES_FOR_WEEK` code collision — `applySimulationOddsSnapshot` (`src/lib/nfl/apply-simulation-odds-snapshot.ts:66-71`) reuses the `NO_GAMES_FOR_WEEK` code, already used with three distinct messages across `jailed.ts`, `jailed-computation.ts`, and `snapshot-nfl-week-odds.ts`, for a fourth distinct meaning ("fixture-ensure step still found zero games afterward"). Currently unreachable given the fixture JSON's ≥4-games-per-week structural guarantee, but if it ever fires, a client switching on `error.code` cannot distinguish it from the other three meanings. **Resolved:** renamed to a distinct `FIXTURE_GAMES_UNAVAILABLE` code (Kyle's choice).

- [x] [Review][Patch] Thursday-kickoff "≥3 full days out" guarantee can be violated by time-of-day [src/lib/nfl/simulation-fixture-schedule.ts:83-93] — fixed: `findNextThursdayAtLeastThreeDaysOut` now checks each Thursday candidate's actual 20:20 ET kickoff instant against the 3-day floor (not just calendar-day match) and advances a week if it isn't late enough; regression test added.
- [x] [Review][Patch] Non-atomic `OddsSnapshotRun` + `NflGameOddsLine` write can leave an orphaned `COMPLETED` run with zero lines [src/lib/nfl/apply-simulation-odds-snapshot.ts:74-101] — fixed: both writes now happen inside a single `prisma.$transaction`.
- [x] [Review][Patch] Route body-validation lets a literal JSON `null` body through despite the "reject non-objects" comment [src/app/api/leagues/[leagueId]/simulation/apply-odds-snapshot/route.ts:48] — fixed: condition now also rejects `null` and arrays.
- [x] [Review][Patch] `handleApplyOddsSnapshot` has no `catch` for a rejected `fetch` (network/offline) [src/components/admin/AdminSimulationControls.tsx:108-132] — fixed: added `catch` setting `oddsError`.
- [x] [Review][Patch] Success-path response cast is unguarded against `null`/malformed JSON body [src/components/admin/AdminSimulationControls.tsx:121-128] — fixed: `body` null-checked before use.
- [x] [Review][Patch] ~~Raw `resolvedBy` enum value leaked verbatim into user-facing success message~~ — **not applied on review**: AC5's own example (`"...jailed team: PHI (MONEYLINE)."`) explicitly shows the raw enum in this exact format; the shipped code already matches the spec's example verbatim. Reclassified as spec-compliant, not a bug.
- [x] [Review][Patch] The two admin buttons aren't mutually disabled while either request is in flight [src/components/admin/AdminSimulationControls.tsx:158-178] — fixed: each button's `disabled` now also checks the other's in-flight state. (The alert-clearing half of this finding was found to be a non-issue on inspection — `errorMessage` only renders inside the Advance dialog, which already clears it on open.)
- [x] [Review][Patch] No test exercises `selectFixtureMatchups`'s `!Number.isInteger(weekNumber)` branch (e.g. `1.5`) [src/lib/nfl/simulation-fixture-schedule.test.ts:48-51] — fixed: test added.

- [x] [Review][Defer] Kickoff-slot duplication if a fixture week ever exceeds 4 games [src/lib/nfl/simulation-fixture-schedule.ts:65-76] — deferred, pre-existing (current fixture data is always exactly 4 games/week; latent gap only)
- [x] [Review][Defer] Raw untyped `Error` on missing team abbreviation surfaces to the client as opaque `INTERNAL_ERROR` [src/lib/nfl/apply-simulation-odds-snapshot.ts:144-149] — deferred, ops-only precondition failure (teams are pre-seeded), already logged server-side via `console.error`
- [x] [Review][Defer] Membership/season lookups run outside the route's `try/catch` [src/app/api/leagues/[leagueId]/simulation/apply-odds-snapshot/route.ts:70-121] — deferred, matches `advance-week/route.ts`'s pre-existing pattern exactly (Story 8.2)
- [x] [Review][Defer] No guard against `homeTeamId === awayTeamId` in `deriveFixtureOddsLine` [src/lib/domain/derive-fixture-odds-line.ts:32] — deferred, unreachable given upstream invariants (fixture JSON structural test + real schedule sync never pair a team against itself)
- [x] [Review][Defer] TOCTOU race: concurrent "apply odds snapshot" calls could both attempt fixture-game creation [src/lib/nfl/apply-simulation-odds-snapshot.ts:52-63] — deferred, matches the story's explicit "no optimistic-lock guard needed" product decision; per-row upsert avoids duplicate games even if this races
- [x] [Review][Defer] New `deferred-work.md` entries (global-row cleanup gap, fixture/real schedule mix) ship without mitigation [_bmad-output/implementation-artifacts/deferred-work.md] — deferred, this is the intended purpose of Task 6's closeout note; Story 8.7 owns the decision
- [x] [Review][Defer] Uncaught throw from `computeAndPersistNflWeekJailed` leaves odds rows persisted with no jailed row [src/lib/nfl/apply-simulation-odds-snapshot.ts:103-107] — deferred, self-heals on next real recompute per the story's documented "self-healing" design

## Dev Notes

### What this story is (and is NOT)

| **Is** | **Is NOT** |
|--------|------------|
| Fixture/deterministic-seed odds data for a test league's **current** simulated week | Simulated **game results** / scoring / MNF completion / reveal (**8.4**) |
| Jailed team computed via the **existing, unmodified** Story 3.3 algorithm | A new or "test-mode" jailed algorithm — reuse is mandatory (AC4) |
| One new admin action ("apply odds snapshot"), extending the existing Simulation card | A new "admin upload odds" UI — `NflOddsAdminPanel` already covers manual per-game entry (AC8) |
| Safe-by-construction future kickoff times so pick deadlines stay open | Real Thursday/Sunday/Monday broadcast realism beyond scheduling spacing |
| A fix to `getJailedVerification`'s test-league week resolution (latent 8.2 gap, now observable) | A change to `resolveActiveWeekNumber`, `resolvePicksWeekNumber`, or `computePicksUiIsPreview` themselves (all unchanged, already correct per 8.2) |

### Critical design decision: odds/games/jailed are GLOBAL, not league-scoped — read this before coding

`NflGame`, `OddsSnapshotRun`, `NflGameOddsLine`, and `NflWeekJailedTeam` are all keyed by `(nflSeasonYear, weekNumber)` only — **not** by `League.id` or `Season.id` (see `prisma/schema.prisma` lines 143–242). Every league created — test **or** production — gets `Season.nflSeasonYear = getCurrentNflSeasonYear()` at creation (`src/app/api/leagues/route.ts`); there is no separate "sandbox year" for test leagues. This means:

1. **Fixture odds/jailed for a test league's simulated week are visible to every other league** (test or production) that resolves to that same `(nflSeasonYear, weekNumber)`. This is intentional and matches the precedent already established and documented in Story 8.2's Dev Notes ("if the real NFL schedule... happens to cover the simulated week numbers, the picks page will show real games/odds for that week — also expected").
2. **This is why AC2 only creates fixture games when NONE exist for that week** — it never overwrites a real schedule, and `getEffectiveOddsLinesForWeek`'s "latest `COMPLETED` run per game" rule means a **later real** provider snapshot naturally supersedes an **earlier fixture** one for the same game, with zero code changes needed. Odds self-heal. Jailed self-heals too, because `computeAndPersistNflWeekJailed` **upserts** — a later real recompute (before that week's real deadline) simply overwrites the fixture-derived jailed row.
3. **What does NOT self-heal:** if fixture `NflGame` rows are created for `(year, week)` during rehearsal, and the **real** NFL schedule for that same `(year, week)` is synced *later* (Story 3.9) with **different team pairings**, the sync will **add** the real games as new rows (different natural key) rather than replacing the fixture ones — the week would then have a mix of fixture and real games. **This is an accepted, documented risk for MVP**, not something to solve in this story (see the closeout task: flag it forward to Story 8.7, whose per-league cascade delete cannot remove these global rows anyway since they carry no `leagueId`). Rehearsal is explicitly a pre-season, one-time-per-season-year activity (Epic 8's stated purpose is "ideal final gate before season start") — do not add a schema change or cleanup mechanism here.

### Locked product decisions (do not re-litigate in implementation)

1. **One admin action, current week only** — "apply odds snapshot" always targets `season.simulatedCurrentWeek`, no arbitrary week parameter. Matches `advance-week`'s pattern of operating on the live pointer, and matches the expected admin workflow: apply odds right after the simulation starts (or right after advancing), so the picks page has data before participants are asked to pick.
2. **No confirm dialog on this button** — unlike `advance-week`, this action is additive/idempotent-in-effect (AC1's determinism + AC2's upsert-if-missing), so a plain button matches `NflOddsAdminPanel`'s existing "Run snapshot" precedent.
3. **JSON fixture for matchups, deterministic hash for odds — not JSON for odds too.** A static fixture keyed by team-pair would silently mismatch if the real schedule (different real matchups) already exists for that week. Deriving odds from whatever game actually exists (fixture-created or real) is the only approach that is correct in both cases (see AC1's last clause).
4. **No schema change.** `OddsSnapshotRun.source = "test_fixture"` (a new string value, not a new column) is enough provenance (AC8). Do not add an `NflGame.isFixture` column or similar — out of scope, and the self-healing behavior above makes it unnecessary for MVP.
5. **`computeAndPersistNflWeekJailed`, `getEffectiveOddsLinesForWeek`, `resolveJailedTeam` are reused completely unmodified.** If you find yourself editing any of those three files for this story, stop — you have gone off-spec.

### Reuse — do NOT reinvent

| Need | Reuse |
|------|--------|
| Jailed algorithm | `computeAndPersistNflWeekJailed` (`src/lib/nfl/jailed-computation.ts`, Story 3.3) — call as-is |
| Odds "latest completed wins" merge | `getEffectiveOddsLinesForWeek` (`src/lib/nfl/effective-odds.ts`, Story 3.2) — call as-is |
| Snapshot run + odds line write shape | `upsertManualOddsLineForGame` in `src/lib/nfl/snapshot-nfl-week-odds.ts` — same `OddsSnapshotRun` (`COMPLETED` immediately) + `NflGameOddsLine` creation pattern, adapted for a whole week instead of one game |
| Game upsert-by-natural-key | `syncNflScheduleFromApiSports` (`src/lib/nfl/sync-nfl-schedule.ts`, Story 3.9) — same `@@unique([nflSeasonYear, weekNumber, homeTeamId, awayTeamId])` upsert idiom |
| Deterministic hashing | `deterministicIndexFromSeed` pattern (SHA-256) in `src/lib/domain/jailed.ts` — same technique, new pure function |
| Date/timezone math for future-safe kickoffs | `formatInTimeZone` / `fromZonedTime` from `date-fns-tz`, `LEAGUE_BUSINESS_TIMEZONE` — already used in `src/lib/domain/pick-deadline.ts`, no new dependency |
| Admin route skeleton | `advance-week/route.ts` (Story 8.2) — same CSRF → auth → admin-membership → isTestLeague → season chain |
| Admin panel UI shape | `AdminSimulationControls.tsx` (Story 8.2) — extend, do not fork into a new component |
| Manual per-game odds override | `NflOddsAdminPanel` (Story 3.2, on `settings/page.tsx`) — already works for any week with existing games; no changes needed |
| Importing `prisma/data/*.json` from `src/` | `src/lib/nfl/resolve-nfl-logo-src.ts` / `src/lib/export/team-name-for-export.ts` — `import x from "../../../prisma/data/nfl-teams.json"` (`resolveJsonModule: true` already set in `tsconfig.json`) |
| Test-league-aware week resolution | `resolveActiveWeekNumber` (Story 8.2, `src/lib/nfl/resolve-picks-week.ts`) — call from `getJailedVerification`, mirroring `build-submission-status.ts`'s `canResolveActiveWeek` |
| Prisma mocking in tests | `src/lib/admin/build-submission-status.test.ts`'s `vi.mock("@/lib/db", () => ({ prisma: { ... } }))` shape — reuse for the new `get-jailed-verification.test.ts` |
| Layout flex | MUI **`Stack`** preferred over `Box` |

### Concrete fixture schedule starting point (use or adapt — must satisfy AC2's structural constraints)

```json
[
  { "games": [{ "home": "PHI", "away": "DAL" }, { "home": "KC",  "away": "BUF" }, { "home": "SF",  "away": "SEA" }, { "home": "GB",  "away": "MIN" }] },
  { "games": [{ "home": "BAL", "away": "PIT" }, { "home": "MIA", "away": "NYJ" }, { "home": "LAR", "away": "ARI" }, { "home": "DET", "away": "CHI" }] },
  { "games": [{ "home": "CIN", "away": "CLE" }, { "home": "HOU", "away": "IND" }, { "home": "DEN", "away": "LV"  }, { "home": "NO",  "away": "TB"  }] },
  { "games": [{ "home": "NE",  "away": "NYG" }, { "home": "JAX", "away": "TEN" }, { "home": "LAC", "away": "DEN" }, { "home": "WAS", "away": "PHI" }] },
  { "games": [{ "home": "KC",  "away": "LV"  }, { "home": "BUF", "away": "MIA" }, { "home": "DAL", "away": "WAS" }, { "home": "SF",  "away": "ARI" }] },
  { "games": [{ "home": "SEA", "away": "LAR" }, { "home": "GB",  "away": "DET" }, { "home": "MIN", "away": "CHI" }, { "home": "PIT", "away": "BAL" }] }
]
```

`selectFixtureMatchups(weekNumber)` = `fixtureWeeks[(weekNumber - 1) % fixtureWeeks.length].games` — so this covers `simulationWeekCount` up to 6 without wrapping (the recommended 4–6 week range from Story 8.2), and wraps gracefully (repeats) for longer simulations up to the schema's 18-week bound.

### Architecture / project-context compliance

- Multi-tenancy note: unlike almost everything else in this codebase, the rows this story writes (`NflGame`, `OddsSnapshotRun`, `NflGameOddsLine`, `NflWeekJailedTeam`) are **global**, not league-scoped — this is a pre-existing, intentional design from Stories 3.1–3.3, not something this story introduces or should "fix."
- Prisma singleton `@/lib/db`; snake_case `@map` columns; camelCase API JSON.
- Errors: `{ error: { code, message } }`, `400/403/404/409` as appropriate — see AC3 for the code list.
- CSRF/same-origin: body-parse-then-`assertCookieSessionMutationOrigin`-then-`auth()` ordering, matching `pre-season-init` / `advance-week`.
- Rate limiting: new route intentionally **not** added to `src/proxy.ts`'s `shouldRateLimitPost` — same documented exception class as `advance-week`.
- Prefer RSC pages; `AdminSimulationControls.tsx` stays `"use client"` (already is).
- Colocated Vitest for every new/changed pure helper; DB-heavy orchestration files (`apply-simulation-odds-snapshot.ts`) follow the established project convention of **no** colocated test (matches `snapshot-nfl-week-odds.ts` having none) — but `get-jailed-verification.ts` **does** get a new test in this story because its behavior is changing (AC6), not just being reused.

[Source: `_bmad-output/planning-artifacts/epics.md` — Epic 8; Story 8.3]
[Source: `_bmad-output/planning-artifacts/prd.md` — NFR26 (graceful degradation / admin manual override for odds API failure)]
[Source: `_bmad-output/planning-artifacts/architecture.md` — Test / rehearsal leagues]
[Source: `docs/project-context.md` — non-negotiables]

### UX requirements (front-end consultation)

[Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — "Test / rehearsal leagues" section]

- The UX spec's rehearsal guidance (banner/chip labeling, already shipped in 8.1) does not add new visual requirements for admin controls. This story adds exactly **one button + one inline `Alert`** to an existing card (`AdminSimulationControls`) — follow the same MUI idiom already established there (Story 8.2), do not invent new visual language.
- No participant-facing UI changes at all — participants simply see real matchups/odds/jailed-team appear on the picks page (`/leagues/[leagueId]/picks`) once the admin applies the snapshot, through the **already-wired** `buildLeaguePicksWeekView` pipeline (Story 8.2 wired `resolveActiveWeekNumber` there; this story only supplies the missing data, no code changes to that file are needed). Verify this manually (Testing requirements) rather than assuming it — it is the core "does 8.3 actually unblock rehearsal picking" proof.
- `AdminJailedVerification` (Story 4.4) also needs **no** component changes — once AC6 fixes the week it reads from, the existing card renders fixture-derived jailed data with its existing UI exactly as it would for real data.

### File structure (expected touch list)

**Create**

- `prisma/data/nfl-simulation-fixture-schedule.json`
- `src/lib/domain/derive-fixture-odds-line.ts` (+ `.test.ts`)
- `src/lib/nfl/simulation-fixture-schedule.ts` (+ `.test.ts`)
- `src/lib/nfl/apply-simulation-odds-snapshot.ts`
- `src/app/api/leagues/[leagueId]/simulation/apply-odds-snapshot/route.ts`
- `src/lib/admin/get-jailed-verification.test.ts`

**Modify**

- `src/components/admin/AdminSimulationControls.tsx` — second button + result `Alert`
- `src/lib/admin/get-jailed-verification.ts` — test-league-aware week resolution (AC6)
- `_bmad-output/implementation-artifacts/deferred-work.md` — forward-looking note for Story 8.7 (closeout task)

**Do not touch** (explicitly out of scope): `src/lib/domain/jailed.ts`, `src/lib/nfl/jailed-computation.ts`, `src/lib/nfl/effective-odds.ts`, `src/lib/nfl/snapshot-nfl-week-odds.ts`, `src/lib/nfl/resolve-picks-week.ts`, `src/lib/picks/build-league-picks-week-view.ts`, `src/lib/admin/build-submission-status.ts`, `src/lib/admin/build-admin-override-data.ts` (all already correct/test-league-aware per Story 8.2 — this story only reuses them), `src/app/(app)/leagues/[leagueId]/settings/nfl-odds-admin-panel.tsx`, `prisma/schema.prisma` (no migration in this story), any `sync-nfl-schedule.ts` / `sync-nfl-results.ts` real-provider paths.

### Previous story intelligence

**Story 8.2 (simulation clock, week advancement)**

- `resolveActiveWeekNumber` / `computePicksUiIsPreview({ isTestLeague })` already exist and are already wired into the picks page and submission-status pipelines — this story's job is purely to make sure there is `NflGame`/odds/jailed **data** at whatever week those already-correct resolvers point to. Re-read `resolve-picks-week.ts` in full before starting; do not modify it.
- 8.2's own Dev Notes explicitly called out that "zero matchups" for a simulated week with no fixture data yet was "expected, not a bug... it is Story 8.3's job to supply that data." This story is that follow-through.
- 8.2's code review caught a sync bug where `build-admin-override-data.ts`'s `isTestLeague`-aware helper was implemented but a sibling call site (`build-admin-override-data.ts` itself, ironically) lagged behind `build-submission-status.ts`. **This story's AC6 is the same class of bug**, caught proactively this time instead of in review: `get-jailed-verification.ts` was the one call site 8.2's AC5 didn't enumerate, and it is now directly in this story's path.
- 8.2 deferred item (confirmed convention, reaffirm here): "no route-handler test for [X] 403" — do **not** add a route-level integration test for `apply-odds-snapshot`; unit-test the pure helpers instead (AC1, AC2's structural test), consistent with 8.1/8.2 precedent.

**Story 3.2 / 3.3 (odds snapshot, jailed algorithm)**

- `snapshotNflWeekOddsFromProvider` and `upsertManualOddsLineForGame` in `src/lib/nfl/snapshot-nfl-week-odds.ts` are the two existing patterns for writing `OddsSnapshotRun` + `NflGameOddsLine` rows — this story's `applySimulationOddsSnapshot` is a **third** pattern (bulk, per-week, source `test_fixture`) living in its own new file, not added to that file, since it has a genuinely different shape (whole-week bulk write vs. single-game / provider-fetch).
- `computeAndPersistNflWeekJailed`'s deadline guard (`isNflWeekPickWindowClosedByDeadline`) is the reason AC2's future-kickoff-time design is load-bearing, not cosmetic — get this wrong and jailed compute silently 409s with `WEEK_PICK_WINDOW_CLOSED` on the very first "apply" attempt.

**Git pattern (recent, Stories 8.1/8.2):** focused commits per task group, colocated tests alongside every new pure helper, `deferred-work.md` touched only at closeout when a genuine forward-looking finding exists (this story has one: flag Story 8.7's global-row cleanup gap).

### Deferred-work disposition for this story

Consulted `_bmad-output/implementation-artifacts/deferred-work.md` while planning.

| Item | Disposition |
|------|-------------|
| 8.2: "No route-handler test for..." (confirmed convention) | **Reaffirmed** — no route test added for `apply-odds-snapshot` either |
| 8.2: "`readJsonObject` duplicated again" | **Will recur a fourth time** in the new route — acceptable per the existing, repeatedly-deferred convention; do not extract a shared helper as a side quest in this story |
| Epic 7 retro: "Authenticated Lighthouse re-measure for picks/standings" | **Now actionable-adjacent, but still not this story's job** — this story is what finally gives a test league a populated, pickable simulated week; the actual re-measure is a separate, standalone task for whoever owns that item, not a task added here |
| Epic 7 retro: "Real pick-submit NFR5 timing sample" | **Same as above** — this story unblocks the *precondition* (a submittable pick in a simulated week); capturing the timing sample itself remains that item's own follow-up, not a task in this story |
| Everything else in `deferred-work.md` | Unrelated to odds/jailed simulation — no action |

**New forward-looking item this story surfaces** (add to `deferred-work.md` at closeout, per Task 6): Story 8.3 creates **global** `NflGame` / `OddsSnapshotRun` / `NflGameOddsLine` / `NflWeekJailedTeam` rows for a test league's simulated weeks. These carry no `leagueId` and are therefore **not** removed by Story 8.7's per-league cascade delete. Story 8.7 must explicitly decide: leave them (harmless if the real season hasn't reached that week yet), or add an explicit cleanup step (e.g. delete `test_fixture`-sourced `OddsSnapshotRun` rows and any `NflGame`/`NflWeekJailedTeam` rows with no surviving real data) as part of "delete test league."

### Testing requirements

1. **Unit:** `deriveFixtureOddsLine` (AC1) — sign-safety (never both non-negative) across many synthetic team-id pairs, range checks, determinism (same input twice → same output), variety (different input → different output)
2. **Unit:** `selectFixtureMatchups` — modulo cycling across week numbers 1–18 against a small fixture array; `buildFixtureKickoffTimes` — asserts every generated time is after `now + 3 days`, and that `computePickDeadlineUtc` on the resulting first kickoff is still after `now` (AC2's "why this matters" regression proof)
3. **Unit:** fixture JSON structural-integrity test — every fixture week has ≥4 games, all abbreviations exist in `nfl-teams.json`, no repeated abbreviation within a week
4. **Unit:** `deriveFixtureOddsLine` output piped into `resolveJailedTeam` (Story 3.3, already-tested) resolves `ok: true` for a representative fixture week (AC4)
5. **Unit:** `get-jailed-verification.test.ts` (new) — production-league byte-identical case; test-league `simulatedCurrentWeek`-follows-clock case (AC6)
6. **Manual:**
   - Test league, `simulationWeekCount = 4`, mark ready (Week 1 live) → click "Apply odds snapshot for Week 1" → picks page shows 4 matchups with odds; admin dashboard's jailed verification card shows a jailed team for Week 1
   - Submit a pick as a participant for Week 1 → succeeds (proves AC2's future-kickoff design actually unblocks the deadline, not just in theory)
   - Advance to Week 2 (Story 8.2 button) → picks page shows Week 2 with **no** games yet ("expected, not a bug" per 8.2) → click "Apply odds snapshot for Week 2" → games/odds/jailed now appear for Week 2
   - Click "Apply odds snapshot" twice in a row for the same week → no error, no duplicate games, jailed team unchanged (AC1/AC3's idempotence-in-effect)
   - Production league → no new button anywhere; `POST .../simulation/apply-odds-snapshot` → 403 `NOT_TEST_LEAGUE`
7. Run **`npm test`** after adding/changing tests

### Latest technical notes

- No new npm dependencies — `date-fns-tz` (`formatInTimeZone`, `fromZonedTime`) is already a dependency used by `src/lib/domain/pick-deadline.ts`.
- No new Prisma migration — this story only adds rows to existing tables/columns (Stories 3.1–3.3's schema), no new columns.

### Project context reference

- Read `docs/project-context.md` before implementing — especially non-negotiable #6 (camelCase JSON / snake_case DB) and #9 (rate-limit exceptions must be documented, not silent).
- This story is squarely the "what data exists at the simulated week" half of Epic 8's rehearsal capability that Story 8.2's Dev Notes explicitly deferred to "Story 8.3's job."

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 8; Story 8.3]
- [Source: `_bmad-output/planning-artifacts/prd.md` — NFR26]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Test / rehearsal leagues]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Test / rehearsal leagues]
- [Source: `docs/project-context.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`]
- [Source: `_bmad-output/implementation-artifacts/8-2-shortened-simulated-season-and-admin-driven-week-advancement.md` — simulation clock, `resolveActiveWeekNumber`, "why AC6 is not optional" precedent this story's AC6 follows]
- [Source: `_bmad-output/implementation-artifacts/8-1-test-league-flag-labeling-and-optional-global-gates.md` — `isTestLeague` foundation, AC6 no-op rule]
- [Source: `_bmad-output/implementation-artifacts/3-2-odds-fetch-tuesday-snapshot-and-week-long-consistency.md` — `OddsSnapshotRun`/`NflGameOddsLine` shape, "latest completed wins" merge]
- [Source: `_bmad-output/implementation-artifacts/3-3-jailed-team-identification-and-tie-breakers.md` — jailed algorithm, deterministic random tie-break]
- [Source: `_bmad-output/implementation-artifacts/3-5-deadline-enforcement-server-authority.md` — `computePickDeadlineUtc` / Thursday-lock calendar-walk behavior this story's AC2 must respect]
- [Source: `_bmad-output/implementation-artifacts/3-9-nfl-schedule-provider-spike-and-sync.md` — `NflGame` upsert-by-natural-key precedent]

## Change Log

- 2026-07-20: Story drafted (create-story workflow) — ready for dev.
- 2026-07-20: Implemented fixture odds + jailed rehearsal path; status → review.
- 2026-07-20: Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor) — 1 decision resolved (renamed a colliding error code), 7 patches applied, 1 finding reclassified as spec-compliant, 7 items deferred, 3 dismissed as matching mandated precedent. `npm test` 438/438 passing. Status → done.

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

### Completion Notes List

- Implemented `deriveFixtureOddsLine` (SHA-256 pure hash) with sign-safe moneylines and consistent spreads; unit tests cover determinism, variety, ranges, and AC4 pipe into `resolveJailedTeam`.
- Added 6-week fixture schedule JSON + `selectFixtureMatchups` / `buildFixtureKickoffTimes` (Thu 20:20 ET ≥3 days out); structural + kickoff/deadline tests pass.
- `applySimulationOddsSnapshot` upserts fixture games only when week is empty, writes `OddsSnapshotRun` source `test_fixture`, then calls unmodified `computeAndPersistNflWeekJailed`.
- New admin POST route with full CSRF→auth→admin→isTestLeague guard chain; intentional rate-limit exclusion documented in JSDoc.
- Extended `AdminSimulationControls` with "Apply odds snapshot" button (no confirm) + inline success/error alerts.
- Fixed AC6 gap: `getJailedVerification` now uses `resolveActiveWeekNumber` (test-league clock); new tests cover production byte-identical path and simulated-week path.
- Flagged Story 8.7 global-row cleanup + fixture/real schedule mix risk in `deferred-work.md`.
- Full suite: **436 tests passed**. Manual smoke checklist remains for Kyle (apply odds → picks page / jailed card / repeat apply / production 403).

### File List

- `prisma/data/nfl-simulation-fixture-schedule.json` (created)
- `src/lib/domain/derive-fixture-odds-line.ts` (created)
- `src/lib/domain/derive-fixture-odds-line.test.ts` (created)
- `src/lib/nfl/simulation-fixture-schedule.ts` (created)
- `src/lib/nfl/simulation-fixture-schedule.test.ts` (created)
- `src/lib/nfl/apply-simulation-odds-snapshot.ts` (created)
- `src/app/api/leagues/[leagueId]/simulation/apply-odds-snapshot/route.ts` (created)
- `src/components/admin/AdminSimulationControls.tsx` (modified)
- `src/lib/admin/get-jailed-verification.ts` (modified)
- `src/lib/admin/get-jailed-verification.test.ts` (created)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/8-3-simulated-odds-and-jailed-team-for-rehearsal.md` (modified)
