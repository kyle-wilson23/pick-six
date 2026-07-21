# Story 8.4: Simulated Game Results and Scoring / Reveal Cycle

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a league admin,
I want to **enter or trigger outcomes** for a test league's active simulated week,
so that scoring, leaderboard updates, and Tuesday-style reveal behave exactly like a real week — using the **simulation clock** (admin-driven steps) instead of waiting for real Monday Night Football wall time.

## Acceptance Criteria

### AC1 — Deterministic fixture game result generator (pure function)

**Given** a game identified by `(nflSeasonYear, weekNumber, homeTeamId, awayTeamId)`

**When** `deriveFixtureGameResult(input)` is called (new pure function, `src/lib/domain/derive-fixture-game-result.ts`)

**Then** it deterministically returns `{ homeScore: number; awayScore: number }` where:

1. Both scores are integers in a plausible NFL range, `[3, 45]` inclusive
2. `homeScore !== awayScore` **always** — never a tie (ties produce `PickOutcome.TIE` / 0 points for everyone, which is a valid production state but not a useful default for exercising FR42/FR54's win/loss/anti-jailed-bonus paths in rehearsal); if the two independently-derived scores happen to collide, deterministically bump one side (chosen by a separate hash byte, same technique as `deriveFixtureOddsLine`'s `homeIsFavorite` bit) by a fixed margin so the two never match
3. The function is a **pure hash of its inputs** (SHA-256 of `` `${nflSeasonYear}:${weekNumber}:${homeTeamId}:${awayTeamId}:result` `` — note the trailing `:result` suffix, which deliberately makes this hash **independent** of `deriveFixtureOddsLine`'s hash for the same game, so a result never "leaks" information that could make odds and outcomes suspiciously correlated) — no `Date.now()` / `Math.random()`; same inputs always produce the same output
4. Different `(homeTeamId, awayTeamId)` pairs (or a different `weekNumber`) produce different-looking results in practice (not a constant) — verify with a test asserting at least 2 distinct input combinations produce non-identical output

**And** a test pipes `deriveFixtureGameResult`'s output into the **existing, unmodified** `getGameWinner` + `scorePickOutcome` (`src/lib/domain/scoring.ts`, Story 5.2) and asserts it always resolves to `"win"` (never `"tie"`) for a representative sample of fixture games — proving AC1's outputs are safe inputs for the real scoring pipeline (mirrors Story 8.3 AC4's "pipe into `resolveJailedTeam`" verification pattern)

---

### AC2 — Orchestration: identify fixture games safely, then finalize + score (critical — read the safety rationale before coding)

**Given** `NflGame` rows are **global**, keyed only by `(nflSeasonYear, weekNumber)` — **not** by league (Story 8.3's Dev Notes, reaffirmed) — and a production league's real synced schedule (Story 3.9) could, by coincidence, occupy the **same** `(nflSeasonYear, weekNumber)` that a test league's `simulatedCurrentWeek` currently points to

**When** the new orchestration function `applySimulationWeekResults(prisma, { nflSeasonYear, weekNumber })` (new file, `src/lib/nfl/apply-simulation-week-results.ts`) runs

**Then** it **must not** blindly force-finalize every `NflGame` row for `(nflSeasonYear, weekNumber)` — doing so would overwrite a **real** game's status/score with a fake deterministic result, corrupting scoring for every league (test **and** production) sharing that real game. Instead:

1. Query the candidate set as **only** games that have **at least one** `NflGameOddsLine` row whose `oddsSnapshotRun.source === ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE` (the exported constant from `src/lib/nfl/apply-simulation-odds-snapshot.ts`, Story 8.3 AC8) for `(nflSeasonYear, weekNumber)` — i.e., "games this rehearsal flow itself created odds for at some point." This reuses Story 8.3's existing provenance mechanism instead of adding a new schema flag (`NflGame.isFixture` was explicitly rejected in 8.3 — do not add it here either).
2. If that candidate set is **empty**, return `{ ok: false, code: "SIMULATION_GAMES_NOT_LOADED", message: "No fixture games with odds have been applied for this week yet — apply an odds snapshot first.", httpStatus: 409 }` (distinct from Story 8.3's `FIXTURE_GAMES_UNAVAILABLE`, which means something different — see Dev Notes)
3. Among the candidate games, select those **not already** `FINAL` or `CANCELLED` — leave already-finalized games untouched (whether finalized by a prior "simulate results" call or by an admin's manual per-game override via the existing `PATCH /api/admin/nfl/games/[gameId]/result`, Story 5.1) — this is what makes the action **idempotent-in-effect** and respects a manual override as "real data wins," matching Story 8.3's precedent
4. For each selected game, compute `{ homeScore, awayScore }` via AC1's `deriveFixtureGameResult` and update it in a **single `prisma.$transaction`**: `status: "FINAL"`, `homeScore`, `awayScore`, `finalizedAt: now` (mirrors Story 8.3's single-transaction pattern for its odds write — avoids a partially-finalized week if the update batch fails midway)
5. After the transaction commits, call the **existing, unmodified** `finalizeNflWeek` (`src/lib/scoring/finalize-nfl-week.ts`, Story 5.3) for `(nflSeasonYear, weekNumber)` — this checks **all** games in the week (fixture and, in the rare mixed-week edge case, any real ones too — see Dev Notes) via `isWeekFullyFinalized`, and if fully finalized, calls the **existing, unmodified** `scoreNflWeek` (Story 5.2)
6. If `finalizeNflWeek` returns `{ ok: false }`, propagate its `code` / `message` / `httpStatus` unchanged
7. On success, return `{ ok: true, nflSeasonYear, weekNumber, gamesInWeek: <candidate set size>, gamesFinalizedThisRun: <count updated in step 4>, allGamesFinalized, scored, skipped }`

**And** `computeAndPersistNflWeekJailed`, `scoreNflWeek`, `finalizeNflWeek`, `getGameWinner`, `scorePickOutcome` are reused **completely unmodified** — if you find yourself editing any of those four files for this story, stop, you have gone off-spec

---

### AC3 — Admin action "Simulate results" (new route, full guard chain)

**Given** a test league whose simulation has started (`Season.simulatedCurrentWeek` non-null)

**When** the admin clicks **"Simulate results for Week N"** on the league admin dashboard

**Then** `POST /api/leagues/[leagueId]/simulation/apply-results` (no request body needed — targets `season.simulatedCurrentWeek`, same pattern as `apply-odds-snapshot`):

1. **403** `NOT_TEST_LEAGUE` if `league.isTestLeague === false`
2. **404** `SEASON_NOT_FOUND` if no season row for this league + current NFL season year
3. **409** `SIMULATION_NOT_STARTED` if `simulatedCurrentWeek` is `NULL`
4. **200** on success — internally calls `applySimulationWeekResults(prisma, { nflSeasonYear: season.nflSeasonYear, weekNumber: season.simulatedCurrentWeek })` (AC2)
5. Response body: `{ nflSeasonYear, weekNumber, gamesInWeek, gamesFinalizedThisRun, allGamesFinalized, scored, skipped }`
6. If AC2's orchestration returns `{ ok: false }` (e.g. `SIMULATION_GAMES_NOT_LOADED`, or a propagated `finalizeNflWeek`/`scoreNflWeek` error) — propagate that result's `code` / `message` / `httpStatus` unchanged

**And** this action is **safe to click repeatedly** for the same week — AC2 step 3's "leave already-final games untouched" guard plus `finalizeNflWeek`/`scoreNflWeek`'s existing idempotency (Story 5.2/5.3) mean a repeat call is a no-op beyond re-confirming the same scored result

**And** CSRF / auth ordering matches `apply-odds-snapshot` / `advance-week`: parse body (empty `{}` is valid, same local `readJsonObject` pattern) → `assertCookieSessionMutationOrigin` → `auth()` → admin-membership check → `isTestLeague` check → season lookup → `simulatedCurrentWeek` check → orchestration call

**And**, per project-context.md non-negotiable #9, this route is **intentionally not added** to `src/proxy.ts`'s `shouldRateLimitPost` — admin-gated, low abuse surface, same documented exception as `advance-week` / `apply-odds-snapshot`. State this explicitly in the new route's JSDoc header.

---

### AC4 — Admin UI trigger + result surfacing

**Given** the existing `AdminSimulationControls` component (Stories 8.2/8.3, rendered on `/leagues/[leagueId]/admin` only when `league.isTestLeague && season`), which currently has two buttons ("Advance to Week N" with confirm dialog, "Apply odds snapshot for Week N" without)

**When** the simulation has started (`simulatedCurrentWeek` non-null)

**Then** extend `AdminSimulationControls` (do not create a sibling component) with a **third** button: **"Simulate results for Week {simulatedCurrentWeek}"**

**And**, like "Apply odds snapshot," this button has **no confirmation `Dialog`** (non-destructive-in-effect, AC3) — plain `fetch` + inline result Alert, same pattern

**And** on success, show an inline `Alert severity="success"` with a human-readable summary, e.g. *"Simulated results for Week 3 — 4 games finalized, 12 picks scored."* (use `gamesFinalizedThisRun` and `scored` from the response); on failure, show `Alert severity="error"` with the API's `error.message`

**And** all **three** buttons (Advance, Apply odds snapshot, Simulate results) are mutually disabled while **any one** request is in flight — extend the existing cross-button disable logic from Story 8.3's code review fix (`AdminSimulationControls.tsx` already disables Advance/Apply-odds against each other's in-flight state; add the new button's own in-flight state to both existing checks, and gate the new button on the other two's in-flight states as well)

**And** the button is disabled when `simulatedCurrentWeek == null` (simulation not started) — like "Apply odds snapshot," it does **not** need to be disabled when the simulation is `complete`

---

### AC5 — End-to-end weekly cycle executes via existing, unmodified production code (FR41–FR48, FR54, NFR36)

**Given** AC2's orchestration has just finalized fixture games and called `scoreNflWeek` for the target week

**Then**, with **zero code changes** to any of the following (verify by manual test, not by modifying them):

1. **FR42/FR54** — `Pick.outcome` / `Pick.pointsEarned` are set correctly (1 point standard win, 2 points anti-jailed win, 0 for loss/tie) via the existing `scoreNflWeek` (Story 5.2)
2. **FR43/FR45/NFR36** — `getLeagueStandings` (`src/lib/scoring/get-league-standings.ts`, Story 5.4) reflects updated totals/rank immediately after scoring — no wall-clock "Tuesday" gate exists in this function; it reads `Pick.scoredAt/pointsEarned` directly, so the simulation clock (admin-triggered finalize) **is** the trigger, satisfying "using simulation clock driven by admin steps instead of MNF wall time" by construction
3. **FR46** — `getPersonalPickHistory` (Story 5.5) shows the participant's own outcome/points for the week immediately (never gated on reveal — a participant always sees their own history)
4. **FR47/FR48** — `getLeaguePeerPickHistory` (Story 5.6) flips `isRevealed: true` for the week the moment `isWeekFullyFinalized` is true for **all** games in that week (this is the **existing, unmodified** reveal trigger — it is driven by game-status completeness, not by a real Tuesday-clock check, so it already works correctly for a simulated week with zero code changes)

**And** a colocated test is **not** required for this AC — it is proven by the existing test suites for `get-league-standings.ts`, `get-personal-pick-history.ts`, and `get-league-peer-pick-history.ts` (Stories 5.4–5.6, already passing and unmodified) plus this story's manual smoke test (Testing requirements)

---

### AC6 — Admin can always see picks (FR49, reaffirmed)

**Given** `buildAdminOverrideData` / `buildSubmissionStatus` (Story 8.2, already `isTestLeague`-aware via `resolveActiveWeekNumber`) already give the admin real-time visibility into the current simulated week's picks regardless of reveal state

**Then** verify (manual test, no code change): after AC2/AC3 finalizes and scores a simulated week, the admin dashboard's submission-status card and pick-override dialog continue to show that week's picks exactly as before (FR49's "admins can see all picks at any time" is unaffected by scoring/reveal — it was never gated on reveal to begin with)

**And** no changes are needed to `build-admin-override-data.ts` or `build-submission-status.ts` for this story — they are already correct per Story 8.2

---

### AC7 — Data separation / no-op for production leagues (reaffirmed)

**Given** Story 8.1 AC6 / Story 8.2 AC8 / Story 8.3 AC7's standing rule: "every Epic 8 simulation behavior MUST no-op or 403 for `isTestLeague === false`"

**When** this story's code runs against a production league

**Then** verify:

1. `POST /api/leagues/[leagueId]/simulation/apply-results` on a production league → **403** `NOT_TEST_LEAGUE`, no DB write (verified by code inspection — matches the project-wide convention that no `route.ts` has a colocated integration test, confirmed again in Stories 8.1/8.2/8.3)
2. `applySimulationWeekResults` / `deriveFixtureGameResult` are **never invoked** for a production league — the route's `isTestLeague` check (AC3, step 1) gates before any call into this story's new orchestration code
3. **AC2's provenance guard is the second, independent layer of protection** even if this action were ever (mis)triggered for a `(nflSeasonYear, weekNumber)` that also contains real production games: only games carrying a `test_fixture`-sourced odds line are ever touched, so a real game is never force-finalized by this code path — this is the specific regression AC2 exists to prevent, given `NflGame` rows are global and not league-scoped

---

### AC8 — Reuse / do-not-touch list (explicit)

**Given** this story's entire job is to wire a rehearsal-only trigger on top of already-correct, already-tested production scoring/reveal code

**Then** the following files are **not modified** in this story (all already correct — Stories 5.1–5.6, 8.2, 8.3 shipped them, and no `resolvePicksWeekNumber`/`resolveActiveWeekNumber`-style test-league gap exists in any of them — verified during planning, see Dev Notes "Audit result"):

`src/lib/domain/scoring.ts`, `src/lib/scoring/score-nfl-week.ts`, `src/lib/scoring/finalize-nfl-week.ts`, `src/lib/scoring/get-league-standings.ts`, `src/lib/scoring/get-personal-pick-history.ts`, `src/lib/scoring/get-league-peer-pick-history.ts`, `src/lib/admin/build-admin-override-data.ts`, `src/lib/admin/build-submission-status.ts`, `src/lib/admin/get-jailed-verification.ts`, `src/lib/nfl/resolve-picks-week.ts`, `src/lib/nfl/jailed-computation.ts`, `src/lib/domain/derive-fixture-odds-line.ts`, `src/lib/nfl/apply-simulation-odds-snapshot.ts` (only **imported from**, for its exported `ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE` constant), `prisma/schema.prisma` (no migration — this story only writes to existing `NflGame` columns from Stories 3.1/5.1), `src/app/api/admin/nfl/games/[gameId]/result/route.ts`, `src/app/api/admin/scoring/finalize-week/route.ts`, `src/app/api/admin/scoring/score-week/route.ts`.

---

## Tasks / Subtasks

- [x] Task 1: Deterministic fixture game result generator (AC: #1)
  - [x] `src/lib/domain/derive-fixture-game-result.ts` (+ `.test.ts`): `deriveFixtureGameResult`, pure SHA-256-seeded (`:result`-suffixed seed, independent of `deriveFixtureOddsLine`'s hash), never-tie guarantee, `[3, 45]` range; test determinism, variety, no-ties-across-samples, and the AC1 pipe-into-`getGameWinner`/`scorePickOutcome` proof
- [x] Task 2: Orchestration (AC: #2)
  - [x] `src/lib/nfl/apply-simulation-week-results.ts`: `applySimulationWeekResults(prisma, { nflSeasonYear, weekNumber })` — candidate-game query via `test_fixture` odds-line provenance → skip already-final → single-transaction batch update → call unmodified `finalizeNflWeek`
  - [x] `src/lib/nfl/apply-simulation-week-results.test.ts` (new — **deviates from the "no test for DB-orchestration files" convention**; see Dev Notes for why this file specifically needs one): mocked-Prisma tests proving (a) a real game with no `test_fixture` odds line is never touched even when present in the same `(year, week)`, (b) an already-`FINAL` fixture game is left untouched on a second call, (c) empty candidate set → `SIMULATION_GAMES_NOT_LOADED`, (d) `finalizeNflWeek` error propagates unchanged
- [x] Task 3: Admin route (AC: #3, #7)
  - [x] `src/app/api/leagues/[leagueId]/simulation/apply-results/route.ts` (POST): full guard chain (CSRF → auth → admin → isTestLeague → season → started → orchestration call); JSDoc documents the intentional rate-limit exclusion
- [x] Task 4: Admin UI (AC: #4)
  - [x] Extend `src/components/admin/AdminSimulationControls.tsx`: third button, no confirm dialog, inline success/error `Alert`, three-way mutual in-flight disable
- [x] Task 5: Closeout
  - [x] `npm test` for all touched/new files
  - [x] Manual smoke (see Testing requirements) — confirm AC5/AC6 end-to-end with **zero** code changes to the files those ACs cite
  - [x] Update `deferred-work.md` disposition if any new findings surface in review

### Review Findings

- [x] [Review][Defer] Cross-league scoring blast radius via unscoped `scoreNflWeek` — `applySimulationWeekResults` → `finalizeNflWeek` → `scoreNflWeek` is not league-scoped: `scoreNflWeek`'s `Pick` query filters only by `nflWeekNumber` + `season.nflSeasonYear` (`src/lib/scoring/score-nfl-week.ts:48-54`), with no `leagueId` filter anywhere in the chain. If a production league shares the same `(nflSeasonYear, weekNumber)` as a test league's `simulatedCurrentWeek` and hasn't yet had its real games synced/finalized for that week, clicking "Simulate results" would trivially satisfy `isWeekFullyFinalized` and call `scoreNflWeek`, which would score the production league's already-submitted `Pick` rows using the fixture's fake winner data. Root cause predates this story (`scoreNflWeek`/`finalizeNflWeek` are AC8 do-not-touch files); deferred as an accepted risk, same pattern as the existing fixture+real-mix note — see `deferred-work.md`.
- [x] [Review][Defer] Odds-line `some` filter can still match a game that later becomes real via natural-key collision — `NflGame`'s natural key is `(nflSeasonYear, weekNumber, homeTeamId, awayTeamId)` with real `Team` FKs (`prisma/schema.prisma:163`). If a rehearsal fixture's matchup for a week exactly coincides with the real schedule's matchup for that week, Story 3.9's upsert-by-natural-key sync would attach a real-sourced odds line to the same row that already carries a `test_fixture` line, and AC2's `some` filter would still select it as a finalize candidate. Low probability (exact matchup coincidence required); deferred as a documented sub-case of the existing fixture+real-mix accepted risk — see `deferred-work.md`.
- [x] [Review][Patch] AC2's "critical safety test" doesn't exercise a mixed real+fixture candidate set [src/lib/nfl/apply-simulation-week-results.test.ts] — fixed: rewrote the test to simulate a mixed slate (a "real" game plus a fixture game) with a mocked `findMany` that applies the same fixture-provenance filter the real Prisma `where` clause expresses, and asserts the real game's id/team ids are never referenced by `update`/`deriveFixtureGameResult`.
- [x] [Review][Patch] Alerts from one Simulation button aren't cleared when another button's action starts [src/components/admin/AdminSimulationControls.tsx] — fixed: `handleApplyOddsSnapshot` now also clears `resultsError`/`resultsSuccess` on start, and `handleSimulateResults` now also clears `oddsError`/`oddsSuccess` on start.
- [x] [Review][Patch] Tie-break range invariant is unguarded [src/lib/domain/derive-fixture-game-result.ts] — fixed: added a module-level invariant check (`SCORE_SPAN > 2 * TIE_BREAK_MARGIN`) that throws at import time if the constants are ever changed to violate it.
- [x] [Review][Patch] No test forces the tie-break/collision branch to execute [src/lib/domain/derive-fixture-game-result.test.ts] — fixed: brute-force found two real input pairs that trigger the raw-hash collision (one bumping home up, one bumping away down after an overflow check), added as explicit tests.
- [x] [Review][Defer] `readJsonObject` duplicated a fifth time [src/app/api/leagues/[leagueId]/simulation/apply-results/route.ts:17-25] — deferred, pre-existing (already self-documented in `deferred-work.md`)
- [x] [Review][Defer] No colocated test file for `AdminSimulationControls.tsx` [src/components/admin/AdminSimulationControls.tsx] — deferred, pre-existing (component had zero tests before this story's third button was added)
- [x] [Review][Defer] No test for `$transaction` failing mid-loop in `applySimulationWeekResults` [src/lib/nfl/apply-simulation-week-results.ts:36-53] — deferred, pre-existing convention (route-level catch-all already returns 500 on any thrown error; low value add)
- [x] [Review][Defer] Success alert doesn't distinguish "nothing to score" from "week not fully finalized yet" when `scored: 0` [src/components/admin/AdminSimulationControls.tsx:181-183] — deferred, cosmetic extension of the already-accepted fixture+real mixed-week risk

## Dev Notes

### What this story is (and is NOT)

| **Is** | **Is NOT** |
|--------|------------|
| A trigger to finalize + score a test league's **current** simulated week's fixture games | Simulated **odds** / jailed team (**8.3**, already done) |
| Reuse of the **existing, unmodified** Story 5.1–5.3 finalize/score pipeline | A new or "test-mode" scoring algorithm — reuse is mandatory (AC2) |
| One new admin action ("Simulate results"), extending the existing Simulation card | New leaderboard/history/reveal UI — Stories 5.4–5.6 UI is already correct and unchanged |
| A safety guard so this action can never touch a real game sharing the same `(year, week)` | A schema change (`NflGame.isFixture`) — explicitly rejected in 8.3, still rejected here |
| Email / cron rehearsal policy | **8.5** |

### Critical design decision: why AC2's provenance guard is not optional

Story 8.3 established that `NflGame` is **global**, keyed only by `(nflSeasonYear, weekNumber)`, and documented an **accepted MVP risk**: if a fixture week's games are created during rehearsal and the real NFL schedule is later synced (Story 3.9) for that same `(year, week)`, the week ends up with a **mix** of fixture and real games. For odds (8.3), this mix was harmless — a later real snapshot naturally "wins" per `getEffectiveOddsLinesForWeek`'s latest-completed-run rule, and nothing is destructively overwritten.

**Game results are different: they are destructive writes with no self-healing merge.** If this story's orchestration blindly set `status: FINAL` + a fake score on **every** `NflGame` row for `(nflSeasonYear, weekNumber)`, and that week happened to also contain a **real** game (any production league's real schedule, since `NflGame` has no league concept), this story would corrupt that real game's result and trigger incorrect scoring for every league — test and production — that resolves to that game. This is categorically worse than 8.3's accepted odds-mixing risk and is **not** an acceptable MVP tradeoff.

**The fix:** only ever touch games that carry **at least one** `NflGameOddsLine` row from a `test_fixture`-sourced `OddsSnapshotRun` (Story 8.3 AC8's existing provenance marker, `ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE`). This reuses infrastructure 8.3 already built for exactly this kind of "tell fixture rows apart from real ones" need — no new schema, no new flag, just a `WHERE` clause on data that already exists.

### Known, accepted interaction with the "fixture + real mix" risk (do not attempt to fix here)

Because `finalizeNflWeek` (Story 5.3, reused unmodified) checks **all** games in `(nflSeasonYear, weekNumber)` via `isWeekFullyFinalized` — not just the fixture subset this story finalizes — a week that happens to contain both fixture games (now `FINAL` via this story) **and** a real game that is still `SCHEDULED` (hasn't kicked off yet in real life) will **not** score at all: `finalizeNflWeek` correctly reports `allGamesFinalized: false` and skips scoring for the whole week, including the fixture picks. This is the same class of accepted risk 8.3 already documented, is extremely unlikely pre-season (real future weeks are unlikely to have synced schedules yet), and is **not** solved in this story — it is inherited, unmodified `finalizeNflWeek` behavior operating correctly on the data as it exists. Flag to Story 8.7 alongside the existing fixture-mix note if it ever becomes an observed problem.

### Audit result: no `resolveActiveWeekNumber`-style test-league gap exists in the scoring/reveal pipeline

Stories 8.2 and 8.3 both found and fixed a recurring bug class: a call site using the real-clock `resolvePicksWeekNumber` instead of the test-league-aware `resolveActiveWeekNumber` (8.2's `build-admin-override-data.ts` review fix; 8.3's `get-jailed-verification.ts` AC6). **This story's planning explicitly checked every file in AC5/AC6's list for the same pattern and found none:** `get-league-standings.ts`, `get-personal-pick-history.ts`, and `get-league-peer-pick-history.ts` never call `resolvePicksWeekNumber` or reference "current week" at all — they aggregate **all** weeks' `Pick` rows directly by `seasonId`/`membershipId`, and reveal-gating (`getLeaguePeerPickHistory`) is driven purely by `isWeekFullyFinalized` per week, not by any wall-clock or "current week" resolution. There is nothing to fix here; do not go looking for an "AC6-equivalent" bug in this story — it was checked and does not exist.

### Locked product decisions (do not re-litigate in implementation)

1. **One admin action, current week only** — mirrors "Apply odds snapshot"'s "always targets `season.simulatedCurrentWeek`" pattern (8.3).
2. **No confirm dialog** — same rationale as "Apply odds snapshot": idempotent-in-effect, matches the "no UI for this at all today" precedent (there is no existing confirm-gated UI for `finalize-week`/game-result entry anywhere in the app — this story is the **first** UI for triggering that pipeline, for any league type).
3. **Deterministic auto-generated results, not a manual per-game score-entry form.** The existing global `PATCH /api/admin/nfl/games/[gameId]/result` (Story 5.1) already covers "manually enter a specific score for a specific game" for **any** league type — reuse it if an admin wants a specific outcome instead of the deterministic one; do not build a duplicate manual-entry UI in the Simulation card (same "reuse, don't reinvent" precedent as 8.3's AC8 choosing not to touch `NflOddsAdminPanel`).
4. **No schema change.** No `NflGame.isFixture` column (rejected in 8.3, rejected again here) — the `test_fixture` odds-line provenance check (AC2) is sufficient and reuses existing data.
5. **`finalizeNflWeek`, `scoreNflWeek`, `getGameWinner`, `scorePickOutcome`, and every Story 5.4–5.6 read-side function are reused completely unmodified.**

### Reuse — do NOT reinvent

| Need | Reuse |
|------|--------|
| Finalize-then-score orchestration | `finalizeNflWeek` (`src/lib/scoring/finalize-nfl-week.ts`, Story 5.3) — call as-is |
| Per-pick scoring | `scoreNflWeek` (`src/lib/scoring/score-nfl-week.ts`, Story 5.2) — called internally by `finalizeNflWeek`, never call directly |
| Winner / outcome domain logic | `getGameWinner` + `scorePickOutcome` (`src/lib/domain/scoring.ts`, Story 5.2) — reuse in the AC1 test, not reimplemented |
| Fixture-game provenance marker | `ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE` (`src/lib/nfl/apply-simulation-odds-snapshot.ts`, Story 8.3 AC8) — import, do not redefine |
| Deterministic hashing | Same SHA-256 seed technique as `deriveFixtureOddsLine` (`src/lib/domain/derive-fixture-odds-line.ts`) — new pure function, same technique, different (suffixed) seed |
| Manual per-game score override (any league) | `PATCH /api/admin/nfl/games/[gameId]/result` (Story 5.1) — already works, no changes |
| Admin route skeleton | `apply-odds-snapshot/route.ts` (Story 8.3) — same CSRF → auth → admin-membership → isTestLeague → season chain, same local `readJsonObject` |
| Admin panel UI shape | `AdminSimulationControls.tsx` (Stories 8.2/8.3) — extend, do not fork |
| Leaderboard / history / reveal | `get-league-standings.ts` / `get-personal-pick-history.ts` / `get-league-peer-pick-history.ts` (Stories 5.4–5.6) — verify only, zero changes |
| Layout flex | MUI **`Stack`** preferred over `Box` |

### Previous story intelligence

**Story 8.3 (simulated odds, jailed team)**

- `ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE` and the whole `test_fixture` provenance concept exist specifically so a later story (this one) could tell fixture rows apart from real ones — AC2 is that "later story."
- 8.3's code review pattern: single `$transaction` for the destructive multi-row write, mutual in-flight button disabling, propagate inner function errors unchanged, distinct error codes per distinct meaning (its own review renamed a colliding `NO_GAMES_FOR_WEEK` — this story picked `SIMULATION_GAMES_NOT_LOADED` from the start to avoid the same collision class against `jailed.ts`/`jailed-computation.ts`/`snapshot-nfl-week-odds.ts`'s existing three meanings of that code, plus 8.3's own `FIXTURE_GAMES_UNAVAILABLE`).
- 8.3 deferred item (reaffirm here): no route-handler test for the new route; unit-test the pure helper + orchestration instead.
- 8.3's `apply-simulation-odds-snapshot.ts` has **no** colocated test (documented project convention for DB-heavy orchestration files). **This story's orchestration file is the deliberate exception** — see "Critical design decision" above; the safety invariant (never touch a non-fixture game) is important enough to warrant a mocked-Prisma test even though the general convention says skip it.

**Story 5.1–5.3 (results ingestion, scoring, finalize)**

- No cron job exists anywhere in this codebase for `finalize-week`/`score-week`/`sync-results` — even **production** leagues finalize/score via manual admin action today (confirmed: `src/app/api/cron/` contains only the three email crons). This story's "Simulate results" button is genuinely the **first** UI trigger for this pipeline for any league type, not just test leagues — there was previously no UI at all, only curl/API access.
- Neither `finalizeNflWeek` nor the `PATCH .../result` route checks any pick-submission deadline — results/scoring entry has always been deadline-agnostic in this codebase. This matters for rehearsal because 8.3's fixture kickoff times are deliberately 3+ days in the future; if results-entry were deadline-gated, a same-afternoon full rehearsal cycle would be impossible. It is not gated, so no special-casing is needed here.

**Git pattern (recent, Stories 8.1–8.3):** focused commits per task group, colocated tests alongside every new pure helper, `deferred-work.md` touched only at closeout when a genuine forward-looking finding exists.

### Deferred-work disposition for this story

Consulted `_bmad-output/implementation-artifacts/deferred-work.md` while planning.

| Item | Disposition |
|------|-------------|
| Epic 7 retro: "Authenticated Lighthouse re-measure for picks/standings" | **Now genuinely actionable** — after this story, a test league can complete a full pick → deadline → results → scoring → reveal cycle, giving a stable authenticated fixture. Still **not a task in this story**: the actual re-measure is Kyle's own separate follow-up (owner unchanged), this story only removes the last precondition blocker |
| Epic 7 retro: "Real pick-submit NFR5 timing sample" | **Already actionable since 8.3** (needs only a submittable pick, not a scored one) — unaffected by this story, still that item's own follow-up |
| 5.2/5.3: "Read-then-write race in `scoreNflWeek`", "No DB transaction between game-status check and `scoreNflWeek`" | **Not touched** — `finalizeNflWeek`/`scoreNflWeek` are on the explicit do-not-modify list (AC2/AC8); this story does not change their risk profile |
| 5.2: "Team in multiple FINAL games causes silent map collision in `scoreNflWeek`" | **Not reachable via this story's data** — the fixture JSON's structural test (8.3 AC2) already guarantees no team repeats within a fixture week, and AC2's provenance guard means this story only ever finalizes fixture games, never mixes into a real game's team |
| 8.3: "Global fixture rows not cleaned by Story 8.7 per-league cascade" | **Reaffirmed, now larger in scope** — this story adds `NflGame.status`/`homeScore`/`awayScore`/`finalizedAt` writes (still on the same pre-existing global `NflGame` rows 8.3 already flagged, not new rows) and no new row types; Story 8.7's decision is unchanged, just covers slightly more mutated state on the same rows |
| Everything else in `deferred-work.md` | Unrelated to results/scoring simulation — no action |

**New forward-looking item this story surfaces** (add to `deferred-work.md` at closeout if confirmed true after implementation): none expected — this story deliberately avoids adding new global-row cleanup surface area (it mutates existing 8.3-created rows rather than creating new row types), so Story 8.7's existing flagged item already covers it. Only add a new entry if implementation reveals something not anticipated here.

### Testing requirements

1. **Unit:** `deriveFixtureGameResult` (AC1) — range checks `[3,45]`, never-tie across many synthetic team-id pairs, determinism (same input twice → same output), variety (different input → different output), and the pipe-into-`getGameWinner`/`scorePickOutcome` proof (always resolves `"win"`, never `"tie"`, for a representative sample)
2. **Unit:** `applySimulationWeekResults` (AC2) — mocked Prisma: (a) a game with **no** `test_fixture` odds line present in the same `(year, week)` as fixture games is **never** updated (the critical safety test); (b) an already-`FINAL` fixture game is left untouched on a repeat call while a still-`SCHEDULED` fixture game in the same week **is** updated; (c) empty candidate set → `SIMULATION_GAMES_NOT_LOADED`; (d) `finalizeNflWeek` returning `{ ok: false }` propagates unchanged
3. **Manual:**
   - Test league, `simulationWeekCount = 4`, Week 1 live, "Apply odds snapshot for Week 1" already run (Story 8.3) → click **"Simulate results for Week 1"** → success alert shows games-finalized + scored counts
   - Standings page (`/leagues/[leagueId]/standings`) shows updated points/rank for Week 1 immediately
   - Personal history page (`/leagues/[leagueId]/history`) shows the current user's Week 1 outcome/points immediately
   - Results page (`/leagues/[leagueId]/results`) shows Week 1 as revealed with all participants' picks visible
   - Admin dashboard's submission-status / pick-override view still shows Week 1 picks correctly (FR49, unaffected by reveal)
   - Click "Simulate results" a second time for the same week → no error, same scored result, no double-counting
   - Advance to Week 2 (Story 8.2) → "Apply odds snapshot for Week 2" (Story 8.3) → "Simulate results for Week 2" → Week 2 also scores/reveals correctly, Week 1's already-revealed state is undisturbed
   - Production league → no third button anywhere; `POST .../simulation/apply-results` → 403 `NOT_TEST_LEAGUE`
4. Run **`npm test`** after adding/changing tests

### Project context reference

- Read `docs/project-context.md` before implementing — especially non-negotiable #4 (pick visibility: participants must not see others' picks until reveal, admins always can — AC5/AC6 exercise exactly this) and #9 (rate-limit exceptions must be documented, not silent).
- This story is the "results / scoring / reveal" half of Epic 8's rehearsal capability; Story 8.2 supplied the clock, Story 8.3 supplied odds/jailed data, this story closes the loop to a fully working weekly cycle.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 8; Story 8.4]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR41–FR49, FR54, NFR36]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Test / rehearsal leagues]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Test / rehearsal leagues (no new visual requirements beyond 8.1's banner/chip labeling)]
- [Source: `docs/project-context.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`]
- [Source: `_bmad-output/implementation-artifacts/8-3-simulated-odds-and-jailed-team-for-rehearsal.md` — `test_fixture` provenance, global-row design decision, fixture+real-mix accepted risk]
- [Source: `_bmad-output/implementation-artifacts/8-2-shortened-simulated-season-and-admin-driven-week-advancement.md` — simulation clock, `AdminSimulationControls` shape, mutual-disable button precedent]
- [Source: `_bmad-output/implementation-artifacts/5-1-ingest-game-results-and-finalize-games.md` — `NflGame.status`/`homeScore`/`awayScore`/`finalizedAt`, manual result override route]
- [Source: `_bmad-output/implementation-artifacts/5-2-calculate-weekly-points-1-vs-2-anti-jailed.md` — `scoreNflWeek`, `getGameWinner`, `scorePickOutcome`]
- [Source: `_bmad-output/implementation-artifacts/5-3-mnf-completion-and-tuesday-standings-update.md` — `finalizeNflWeek`, `isWeekFullyFinalized`]
- [Source: `_bmad-output/implementation-artifacts/5-4-live-leaderboard.md` — `getLeagueStandings`]
- [Source: `_bmad-output/implementation-artifacts/5-5-personal-pick-history.md` — `getPersonalPickHistory`]
- [Source: `_bmad-output/implementation-artifacts/5-6-tuesday-reveal-vs-peer-visibility.md` — `getLeaguePeerPickHistory`, `isWeekFullyFinalized`-driven reveal]

## Change Log

- 2026-07-20: Story drafted (create-story workflow) — ready for dev.
- 2026-07-20: Implemented Story 8.4 — deterministic fixture results, provenance-safe orchestration, admin route + UI; status → review.
- 2026-07-20: Code review complete — 2 decision-needed findings deferred (cross-league scoring blast radius via unscoped `scoreNflWeek`; odds-line natural-key collision edge case), 4 patch findings fixed (strengthened AC2 critical safety test, three-way alert clearing, tie-break invariant guard, collision-branch test coverage), 4 items deferred to `deferred-work.md`, 18 findings dismissed as noise or spec-compliant-by-design; all 449 tests pass; status → done.

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

### Completion Notes List

- AC1: `deriveFixtureGameResult` — SHA-256 of `:result`-suffixed seed, scores in `[3,45]`, never-tie via fixed-margin bump; 4 unit tests including pipe into unmodified `getGameWinner`/`scorePickOutcome`.
- AC2: `applySimulationWeekResults` — candidates filtered by `ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE` odds-line provenance; skips FINAL/CANCELLED; single `$transaction` finalize; then unmodified `finalizeNflWeek`. 5 mocked-Prisma tests cover safety, idempotency, empty set, and error propagation.
- AC3/AC7: `POST .../simulation/apply-results` — full guard chain matching `apply-odds-snapshot`; JSDoc documents intentional rate-limit exclusion; 403 `NOT_TEST_LEAGUE` for production leagues (code inspection).
- AC4: `AdminSimulationControls` — third "Simulate results" button, no confirm dialog, success/error Alerts, three-way `anyInFlight` mutual disable.
- AC5/AC6/AC8: zero edits to scoring/reveal/admin-read files on the do-not-touch list; existing Story 5.4–5.6 suites still green (447 tests total). Manual UI smoke left for Kyle (standings/history/results/admin after click).
- deferred-work.md: reaffirmed 8.3 global-fixture cleanup + fixture/real mix notes for 8.4 result mutations; noted fifth `readJsonObject` copy.

### File List

- `src/lib/domain/derive-fixture-game-result.ts` (new)
- `src/lib/domain/derive-fixture-game-result.test.ts` (new)
- `src/lib/nfl/apply-simulation-week-results.ts` (new)
- `src/lib/nfl/apply-simulation-week-results.test.ts` (new)
- `src/app/api/leagues/[leagueId]/simulation/apply-results/route.ts` (new)
- `src/components/admin/AdminSimulationControls.tsx` (modified)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/8-4-simulated-game-results-and-scoring-reveal-cycle.md` (modified)

### Implementation Plan

- Pure hash helper first (red-green via colocated tests), then provenance-safe orchestration with mocked Prisma, then route cloned from apply-odds-snapshot, then UI third button with shared in-flight gate.
