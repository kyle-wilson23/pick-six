# Deferred Work

Items surfaced during code review that are intentionally deferred. Each entry cites the source review and links back to the story spec.

## Deferred from: code review of pre-epic-7-observability-scope-decision (2026-07-05)

- **NFR46 MVP stance covers email only, not scoring/deadline failures** — `docs/observability-scope-decision.md` documents manual ops for email cron windows; PRD NFR46 also lists deadline enforcement and scoring. Explicit out-of-scope table defers scoring/pick-deadline structured logging to post-launch; acceptable for hybrid MVP scope.

## Deferred from: code review of pre-epic-7-manual-email-flow-smoke-test (2026-07-05)

- **AC8 Resend message IDs not captured** — Smoke test results confirm delivery in inbox/dashboard but do not record per-send message IDs; optional hardening before production smoke test (`post-epic-8-production-smoke-test`).
- **Thin unit coverage for `acceptLeagueInvitation`** — Only error-class tests exist; membership upsert and invite consumption paths verified manually during AC3 smoke test.
- **No unit test for `already_registered` signup preview branch** — New preview status branch covered by manual invite flow only.
- **Concurrent duplicate accept requests** — Parallel accept POSTs can race on invite consumption; defer to Epic 7.4 (TOCTOU hardening).

## Deferred from: code review of 5-1-ingest-game-results-and-finalize-games (2026-06-11)

- **N+1 queries in sync transaction** — `src/lib/nfl/sync-nfl-results.ts`. Per-game `findUnique` + `update` inside a single transaction (up to ~288 calls for a full-season 18-week sync). Correctness is unaffected; risk is transaction timeout on very large syncs. Refactor to batch-fetch all matching `NflGame` rows up front and reduce round-trips when quota or performance becomes a concern.
- **Duplicate `readJsonObject` helper in both route files** — `src/app/api/admin/nfl/sync-results/route.ts` and `src/app/api/admin/nfl/games/[gameId]/result/route.ts`. Same 8-line function copied verbatim. Extract to a shared `src/lib/request-utils.ts` (or similar) when a third admin route needs it.
- **NaN/Infinity not explicitly guarded in `getGameWinner`** — `src/lib/domain/scoring.ts:15`. The `== null` check does not catch `NaN`. Upstream `parseScoreTotal` guards against non-finite values, so runtime risk is low; add an explicit `Number.isFinite` guard if `getGameWinner` gains call sites outside the mapped-results pipeline.
- **`skipped` count conflates team-match failures with DB-not-found** — `src/lib/nfl/sync-nfl-results.ts`. The `skipped` field in the sync response counts both mapping-level errors (unknown team names) and DB-level misses (no matching `NflGame` row). Split into separate counters (`skippedUnknownTeam`, `skippedNotFound`) when sync observability becomes important.

## Deferred from: code review of story 3-3-jailed-team-identification-and-tie-breakers (2026-04-25)

- **Picks-lock guard on jailed POST (done in 3.5)** — `computeAndPersistNflWeekJailed` returns **409** `WEEK_PICK_WINDOW_CLOSED` when the pick window is past the story 3.5 deadline (schedule + kickoff data present). A future option: `force=true` + audit (Epic 4 / one-line follow-up) if recompute is ever required after lock.
- **Transactional read+resolve+upsert for jailed compute** — `src/lib/nfl/jailed-computation.ts`. Wrap `nflGame.findMany` + `getEffectiveOddsLinesForWeek` + `randomBytes` + `prisma.nflWeekJailedTeam.upsert` in a `prisma.$transaction` with row-level locking on `(nflSeasonYear, weekNumber)` so two concurrent admin POSTs cannot generate independent random seeds and silently overwrite each other. Low practical risk on an admin-only endpoint but real once an automation runner exists; needs a refactor of `getEffectiveOddsLinesForWeek` to accept the transaction client.
- **Per-stage survivors in jailed `audit`** — `src/lib/domain/jailed.ts` `buildResult`. Persist `afterMoneyline` and `afterSpread` slices alongside the full `candidates` array so a verifier (Story 4.4 jailed verification view) can see exactly which candidates reached the SPREAD or RANDOM stage without re-running the algorithm in their head.

## Deferred from: code review of 3-4-pick-api-with-server-side-validation (2026-04-26)

- **Concurrent `isCreate` 201/200 status code race** — `src/app/api/leagues/[leagueId]/picks/route.ts` lines 234–244. Under READ COMMITTED, two concurrent first-time POSTs for the same `(leagueMembershipId, seasonId, nflWeekNumber)` both see `existing = null` and both return 201. Pick data is correct (upsert wins); only the status code is wrong for the second caller. Fix requires SERIALIZABLE isolation for the transaction or extracting create/update from upsert side-effects (not directly supported in Prisma). Semantic-only error; low practical risk given single-user pick flow.
- **No route-layer test for 201/200 and idempotency** — `src/app/api/leagues/[leagueId]/picks/route.ts`. The "idempotent repeat of same body → 200" clause in AC1 and the 201-on-create branch are uncovered at the route level. Spec explicitly says "Prisma optional in route tests." Defer to when integration/e2e test infrastructure is established.

## Follow-up for Story 3.5 (from 3.4)

- *(Resolved in 3.5 — see `checkPickMutationDeadline`, `src/lib/domain/pick-deadline.ts`, and jailed `WEEK_PICK_WINDOW_CLOSED`.)*

## Planned follow-on: Story 3.10 — kickoff-time weather forecast (deferred from 3.6, 2026-04-28)

**Context:** Story 3.6 ships **current-conditions** weather (`/data/2.5/weather`) — conditions at the moment the picks page loads. This is a useful approximation but not a kickoff-time forecast.

**Goal:** Replace or supplement the current-conditions call with a **point-in-time forecast** for each game's `kickoffAt` at the home team's stadium coordinates.

**Key design decisions to resolve in 3.10:**

- **Provider choice** — must support lat/lon + target datetime. OpenWeatherMap options:
  - `/data/2.5/forecast` (free): 3-hour-step forecasts, up to **5 days out**. Adequate for games within the week; useless for games > 5 days away.
  - One Call API 3.0 (`/data/3.0/onecall`): hourly up to **48 h**, daily up to **8 days**. Free tier requires credit card; 1,000 calls/day free. Better fit for full-week previews.
  - Any other provider returning hourly lat/lon forecast is a drop-in behind `fetchWeatherForTeam`.
- **Fallback window:** When `kickoffAt` is outside the provider's forecast horizon (e.g. week loaded on Monday, game on Sunday +10 days), fail-soft to `null` (no chip) rather than returning stale current conditions — **do not silently show the wrong data**.
- **Dependency on 3.9:** Reliable UTC `kickoffAt` per `NflGame` row is a hard prerequisite. Until 3.9 ships, seed-only Week 1 games have fixed kickoff times — workable for a limited pilot but not for the full 18-week season.

**Interface change is minimal — already isolated:** `fetchWeatherForTeam` in `src/lib/integrations/weather/client.ts` currently ignores the game's time. Signature change to `fetchWeatherForGame(abbreviation: string, kickoffAt: Date): Promise<WeatherData | null>` and updating the one call site in `src/lib/picks/build-league-picks-week-view.ts` is the full surface area.

**No schema change required** — `WeatherData` shape (`tempF`, `condition`, `windMph`) is sufficient; forecast APIs return the same fields in different endpoints.

**Suggested acceptance criteria for 3.10:**
1. Weather chip reflects **forecast conditions at `kickoffAt`**, not page-load time.
2. Games with `kickoffAt` beyond the provider's horizon render **no weather chip** (fail-soft, no crash).
3. `WEATHER_API_KEY` still the only secret; no `NEXT_PUBLIC_*`.
4. `npm test` passes; weather client covered by fixture-based unit test for the forecast path.

**Blocked by:** Story 3.9 (real `kickoffAt` data for all weeks).

---

## Deferred from: code review of 3-6-picks-ui-matchups-odds-spread-weather-optional (2026-04-28)

- **Keyboard/a11y for clickable team selection** — `MatchupCard` propagates `onClick` but has no `role="button"`, `tabIndex`, or `onKeyDown`; story 3.6 is display-only so this is deferred to Story 3.7 when `onTeamSelect` is wired.
- **Weather caching** — `cache: "no-store"` on every SSR render will exhaust the OpenWeatherMap free-tier quota under any meaningful traffic. Spec open questions explicitly defer caching to performance testing. Add `next: { revalidate }` or an in-process TTL cache in a future iteration.
- **Domed stadium weather display** — Weather conditions are fetched and shown for fully-enclosed stadiums (Allegiant/LV, US Bank/MIN, SoFi/LAC+LAR, Lucas Oil/IND, Ford Field/DET, NRG/HOU). Showing temperature and wind for a climate-controlled game is misleading. Add a `dome: true` flag to `NFL_STADIUM_BY_TEAM_ABBR` and skip weather fetch for dome stadiums. Product decision required before implementing.

## Deferred from: code review of 3-7-jailed-and-already-picked-ux-with-countdown-and-status (2026-05-09)

- **Prisma patch-level bump + seed session note** — `package.json` / `package-lock.json` move `@prisma/client` and `prisma` from 7.7.x to 7.8.x; `prisma/seed.cjs` adds a console reminder to re-auth after migrate reset. Unrelated to 3.7 acceptance criteria; treat as repo hygiene when convenient.
- **44×44 touch target for anti-jailed “2 PTS” chip** — `MatchupCard` uses MUI `Chip` `size="small"`, which may be under NFR8. Defer sizing pass until a11y QA or explicit design direction.

## Deferred from: code review of 3-5-deadline-enforcement-server-authority (2026-04-26)

- **`GAMES_NOT_LOADED` message misleading for null-`kickoffAt` case** — `src/app/api/leagues/[leagueId]/picks/route.ts`. When games exist but one has a null kickoff, the message says "No game schedule data is available" — implying no ingestion occurred. A distinct message or code for the partial-ingestion case would be clearer, but the spec sanctions reusing this validation.
- **`checkPickMutationDeadline` returns null for empty games — latent bypass** — `src/lib/picks/assert-pick-mutation-allowed.ts`. The documented precondition ("call only after games are loaded") prevents this in practice, but any future caller that omits the route-level guard silently bypasses deadline enforcement. Consider an invariant throw on empty input.
- **`now` not injectable in `computeAndPersistNflWeekJailed`** — `src/lib/nfl/jailed-computation.ts`. The jailed recompute path captures `now` internally, making the deadline check path difficult to unit test deterministically. Align with `checkPickMutationDeadline`'s injected `now` pattern in a future refactor.
- **Thursday 8:10 PM cutoff is a magic literal, not a named constant** — `src/lib/domain/pick-deadline.ts`. The `20, 10` hour/minute values in `lockByThursdayDefaultUtc` and the associated test assertions are scattered. A named export (`THURSDAY_LOCK_HOUR`, `THURSDAY_LOCK_MINUTE`) would create a single authoritative source.
- **`gamesWithKickoff` manually reconstructed rather than type-narrowed** — `src/app/api/leagues/[leagueId]/picks/route.ts`. The loop that rebuilds each game as `{ homeTeamId, awayTeamId, kickoffAt }` sheds future Prisma fields. A type-narrowing filter (`.filter((g): g is ... => g.kickoffAt != null)`) avoids the parallel allocation.

## Deferred from: code review of 3-8-nfl-team-logos-discovery-and-implementation.md (2026-05-10)

- **`resolveNflLogoSrc` imports full `nfl-teams.json` into the client bundle** via `TeamLogo` — file is small (~32 teams); acceptable MVP tradeoff. Optional follow-up: codegen or a static uppercase `Set` so the client never imports full JSON metadata.

## Deferred from: code review of 3-9-nfl-schedule-provider-spike-and-sync.md (2026-05-23)

- **Serial `for-await` upserts inside `$transaction`** (`src/lib/nfl/sync-nfl-schedule.ts`) — N sequential DB round-trips for up to 280+ games; `Promise.all` or a batch upsert strategy would improve throughput. Admin-only low-frequency operation; acceptable at MVP scale.
- **Overly permissive Zod schemas** (`src/lib/integrations/api-sports-nfl/schemas.ts`) — all team/date fields are optional; validation errors surface only at the mapping layer with less precise messages. Consistent with existing `the-odds-api` integration pattern; revisit if schema drift causes mapping noise.
- **Rename migration adds noise** (`prisma/migrations/20260511022811_2026_first_games_migration/migration.sql`) — only truncates an index name to fit Postgres identifier limits; already applied to DB; no functional change.
- **All 32 teams loaded from DB on every sync call** (`src/lib/nfl/sync-nfl-schedule.ts`) — negligible at current scale; worth caching or narrowing if team table ever grows meaningfully.

## Deferred from: code review of 3-10-kickoff-time-weather-forecast (2026-05-24)

- **`scripts/test-weather.ts` unhandled promise rejection** — `main()` is called without `.catch()`; an uncaught rejection will silently exit with a non-zero code. Dev utility only; add `.catch(console.error)` if the script sees repeated use.
- **SoFi Stadium (LAC/LAR) "retractable" classification** — The roof is a fixed translucent canopy with open sides rather than a true retractable mechanism. Whether weather "applies" is debatable. Revisit stadium metadata accuracy when the roof feature is formally specced.
- **Non-deterministic `Date.now()` in horizon tests** — Tests compute future offsets from live `Date.now()`, creating a theoretical flake at the 5-day boundary window. Replace with `vi.useFakeTimers()` if this becomes a CI reliability concern.

## Deferred from: code review of 4-1-pick-submission-status-dashboard (2026-05-24)

- **Multiple picks per same `leagueMembershipId`** — `mergeSubmissionStatusParticipants` silently overwrites earlier pick with later one if two picks share the same membershipId for a week. DB unique constraint prevents this in production; address if constraint is ever relaxed.
- **Empty string `user.email` yields blank `displayName`** — `displayName: user.name ?? user.email` renders as empty string if email is `""`. Schema marks email as required/non-empty; revisit if that constraint changes.
- **Sequential DB calls in admin page** — `prisma.league.findUnique` and `buildSubmissionStatus` run sequentially after the membership guard resolves; they could be parallelized with `Promise.all` for a minor latency gain.
- **nflGame with null `weekNumber` passes kickoffAt-only filter** — The type guard `g.kickoffAt != null` doesn't also check `g.weekNumber != null`; a row with null weekNumber (impossible under current schema) would pass through to `resolvePicksWeekNumber`. Tighten the filter if schema ever allows nullable weekNumber.

## Deferred from: code review of story 4-2-submit-or-change-pick-on-behalf-including-post-deadline (2026-05-30)

- **`validateJailedLineupAndBonus` unconditional opponent lookup** — `src/lib/domain/picks.ts:79-88`. The function calls `getOpponentOfJailedInWeek` unconditionally; if it returns `{ ok: false }`, all picks are blocked (not just anti-jailed). In practice the jailed team is always selected from active-week games so the `{ ok: false }` path requires a data anomaly (cancelled game, out-of-sync load). Fix: gate the opponent lookup behind `if (antiJailedBonus)`. Tracked as `pre-epic-5-fix-jailed-lineup-bonus-bug` (defensive correctness, low production risk).
- **Concurrent admin submissions produce silent last-write-wins** — `submit-pick-on-behalf.ts` + `route.ts`. Two concurrent admin overrides for the same participant+week both see no existing pick, both upsert, both return 201. Requires optimistic locking (e.g., `updatedAt` ETag passed in request, checked inside transaction) or a `SELECT ... FOR UPDATE` advisory lock. Low practical risk on admin-only flow; revisit if automation or multi-admin leagues become common.
- **`priorSeasonPickCount` fetched before `existing` check** — `submit-pick-on-behalf.ts:130-167`. Theoretical: if a concurrent delete empties season picks between count and findUnique, the lock fires on an update path. The `updateMany` guard (`firstCompetitionWeekLockedAt: null`) prevents double-lock; negligible real-world risk given pick deletes don't exist in the product today.
- **TOCTOU role check outside transaction** — `route.ts:78-90`. Admin role fetched before the transaction opens; a membership role change between the check and the write would not be caught. Pre-existing pattern across all admin routes; fix when the codebase adopts a middleware-level role guard.
- **`allSeasonPicks` over-fetch in `buildAdminOverrideData`** — `build-admin-override-data.ts:101-108`. Loads all picks for the season across all participants. For large leagues late in an 18-week season this grows O(participants × weeks). Add pagination or a `leagueId`-scoped filter joining through `LeagueMembership` if performance degrades.

## Deferred from: code review of pre-epic-5-thursday-lockout-constant (2026-06-11)

- **Magic `0` for seconds survives in `lockByThursdayDefaultUtc`** — `src/lib/domain/pick-deadline.ts`. The call `new Date(ty, tm - 1, td, THURSDAY_LOCK_HOUR, THURSDAY_LOCK_MINUTE, 0)` still has an inline `0` for seconds. If the lock time ever shifts to a non-zero second, there is no constant to update and no test to catch the omission. Extract `THURSDAY_LOCK_SECOND = 0` alongside the existing constants when this file is next touched.
- **No DST-boundary test for Thursday lockout hour** — `src/lib/domain/pick-deadline.test.ts`. The new and existing tests use October dates (summer time). The first Thursday of November — when clocks fall back — changes the UTC equivalent of 8:10 PM ET by one hour. Add a test fixture for a DST-transition Thursday when test coverage for this function is next expanded.
- **Exported constants create implicit public API with no deprecation path** — `src/lib/domain/pick-deadline.ts`. `THURSDAY_LOCK_HOUR` and `THURSDAY_LOCK_MINUTE` are public exports that any module can import and build arithmetic against. If FR26 changes, updating the constants alone is insufficient — silent breakage in any consumer that hard-coded derived values. Consider an `@internal` annotation or barrel-export gating if the constants gain external consumers.
- **Kickoff exactly at `THURSDAY_LOCK_HOUR:THURSDAY_LOCK_MINUTE` untested** — `src/lib/domain/pick-deadline.test.ts`. A Thursday kickoff at exactly 8:10 PM Eastern produces a first-game lock at 8:05 PM; `computePickDeadlineUtc` should pick 8:05 (first-game wins). The boundary where the two lock times converge is not exercised. Add when broadening `computePickDeadlineUtc` coverage.

## Deferred from: code review of pre-epic-5-fix-jailed-lineup-bonus-bug (2026-06-11)

- **Third new test redundant to AC3 / bye-scenario precondition mismatch** — `picks.test.ts`. The "rejects direct jailed pick even when jailed team has no game in week games" test exercises the `teamId === jailedTeamId` guard (unchanged code). AC3 requires a jailed-team-in-game precondition; existing pre-diff tests already cover that. The new test adds bye-scenario confidence but is not a strict AC3 test.
- **Test assertions on exact user-facing copy are brittle** — `picks.test.ts`. New tests assert the full 140-char message string inline rather than against a named constant. Fragile to copywriting; revisit when a shared error-constants module is introduced.
- **`JAILED_NOT_IN_WEEK_GAMES` error code name semantically misleading** — `picks.ts:85`. Code name implies a general schedule-data anomaly but is now only reachable on the `antiJailedBonus: true` path. Rename (e.g. `ANTI_JAILED_UNAVAILABLE`) when the API error contract can be versioned and all callers updated.
- **No determinism test for `getOpponentOfJailedInWeek` with duplicate game rows** — `picks.ts`. If `jailedTeamId` appeared in two games (data corruption), the helper returns the first match silently. Test should live in `getOpponentOfJailedInWeek`'s own unit coverage, not in the validator.

## Deferred from: code review of 4-4-jailed-team-verification-view (2026-05-30)

- **`jailed.randomSeed` (DB) vs `audit.randomSeed` (JSON) not cross-validated** — `src/lib/admin/get-jailed-verification.ts`. The route returns `jailed.randomSeed` (the DB column) rather than `audit.randomSeed` (the value inside `auditJson`). If they diverge, the FR52 audit display shows the wrong seed. Fix when FR52 audit compliance is hardened.
- **`resolvePicksWeekNumber` called independently in page and `getJailedVerification`** — `src/app/(app)/leagues/[leagueId]/admin/page.tsx`. At a week-boundary crossing the page's `weekNumber` (used in the jailed empty-state message) and the jailed section's internal `weekNumber` could diverge by 1. Fix by threading a shared `now` if the mismatch becomes observable.
- **No fallback to the most recently computed jailed week** — `src/lib/admin/get-jailed-verification.ts`. Once `resolvePicksWeekNumber` advances to week N+1, the jailed section shows null until computation runs for N+1, even though week N's record exists. Revisit when "view prior-week jailed" is requested.
- **Backward-compat rows show no stage chips with no UI hint** — `src/components/admin/AdminJailedVerification.tsx`. Old `NflWeekJailedTeam` rows missing `afterMoneyline`/`afterSpread` display no stage chips, with no indication to admins that stage data is simply unavailable (vs. a clean single-winner MONEYLINE result). Add a "(legacy data — stage breakdown unavailable)" hint if UX feedback warrants it.
- **`jailed.jailedTeamId` (DB) vs `audit.jailedTeamId` (JSON) never cross-checked** — `src/lib/admin/get-jailed-verification.ts`. A corrupt row where the DB column and the JSON diverge would silently show inconsistent data. Fix when a data-consistency validation layer is added.
- **`.passthrough()` on `AuditJsonV1Schema` allows unknown fields** — `src/lib/admin/get-jailed-verification.ts`. Intentional for forward-compat, but weakens strictness. Revisit if schema drift causes runtime issues.
- **`afterMoneyline`/`afterSpread` optional in Zod but required in domain type** — `src/lib/admin/get-jailed-verification.ts`. A future persistence path that omits these fields would pass Zod but show null in the UI silently. Monitor if new computation paths are added.

## Deferred from: code review of 5-3-mnf-completion-and-tuesday-standings-update (2026-06-14)

- **Timing-safe comparison on bearer token** — `src/lib/nfl/authorize-odds-admin.ts:14`. `isOddsAutomationRequest` uses `===` for secret comparison rather than `crypto.timingSafeEqual`. Pre-existing in both original route copies; moved unchanged. Low practical risk on an admin endpoint behind infrastructure; swap when a broader auth hardening pass is done.
- **Unconditional `auth()` call for automation requests** — `src/app/api/admin/scoring/finalize-week/route.ts`. `auth()` fires a session lookup even when the bearer token already identifies the caller; `assertAuthorizedForNflOddsOps` short-circuits before using userId, so it is harmless. Pre-existing from `score-week` pattern. Skip the `auth()` call when `isOddsAutomationRequest` is true if request latency becomes a concern.
- **No try/catch in route handler** — `src/app/api/admin/scoring/finalize-week/route.ts`. Uncaught exception from `auth()`, `assertAuthorizedForNflOddsOps`, or `readJsonObject` propagates as an unhandled Next.js 500. Pre-existing from `score-week` pattern; address when a global error-handling layer is introduced.
- **`z.coerce.number()` accepts boolean values as integers** — `src/app/api/admin/scoring/finalize-week/route.ts:17`. `true` coerces to `1`, silently passing Zod's `min(1).max(18)` check and running finalization against week 1. Pre-existing pattern; spec explicitly specifies `z.coerce.number()`. Switch to `z.number()` (no coerce) across all admin scoring routes if strict JSON typing is later desired.
- **Authorization header trailing whitespace not handled** — `src/lib/nfl/authorize-odds-admin.ts:14`. A token value with a trailing space would be rejected. Pre-existing in original route copies; add `.trim()` to `request.headers.get("authorization")` when the function is next touched.
- **No DB transaction between game-status check and `scoreNflWeek`** — `src/lib/scoring/finalize-nfl-week.ts`. Games are fetched with `findMany`, finalization gate is checked, then `scoreNflWeek` is called as a separate operation; a concurrent sync correcting a game status in that gap would not be caught. Same class as the read-then-write race deferred from 5.2.
- **`weekNumber` max of 18 excludes playoff rounds** — `src/app/api/admin/scoring/finalize-week/route.ts`. NFL playoff weeks use values above 18 in many data providers. Spec-specified at `.max(18)` for MVP; raise when playoff scoring is in scope.
- **Non-object JSON body coerced to `{}`** — `src/app/api/admin/scoring/finalize-week/route.ts`. A JSON array or `null` body becomes `{}`, yielding "weekNumber is required" rather than a type-mismatch error. Pre-existing from `score-week` pattern; cosmetic.

> **Note:** The 5.2 deferred item "**`isOddsAutomationRequest` duplicated across two route files**" was resolved in this story (5.3, AC4).

## Deferred from: code review of 5-2-calculate-weekly-points-1-vs-2-anti-jailed (2026-06-14)

- **No DB atomicity CHECK constraint on three scoring columns** — `outcome`, `points_earned`, and `scored_at` on the `picks` table have no `CHECK` constraint enforcing all-or-nothing writes. A future bug could leave a row with `outcome = 'WIN'` and `points_earned = NULL`. Adding `CHECK ((outcome IS NULL AND points_earned IS NULL AND scored_at IS NULL) OR (outcome IS NOT NULL AND points_earned IS NOT NULL AND scored_at IS NOT NULL))` via a new migration would close this.
- **No range CHECK constraint on `points_earned`** — column is a plain `INTEGER`; domain only ever produces 0, 1, or 2. Add `CHECK (points_earned >= 0 AND points_earned <= 2)` via a future migration when scoring rules solidify.
- **`isOddsAutomationRequest` duplicated across two route files** — identical function in `sync-results/route.ts` and `score-week/route.ts`. Extract to a shared `src/lib/nfl/authorize-odds-admin.ts` or `src/lib/request-utils.ts` when a third automation route is added.
- **Team in multiple FINAL games causes silent map collision in `scoreNflWeek`** — `winnerByTeamId` maps `teamId → GameWinnerResult` with no collision guard; if a team somehow appears in two FINAL games in the same week (data corruption), the second result silently overwrites the first and picks are scored against the wrong game. Add a guard or early return when this is detected.
- **FINAL game with null scores silently counted as `skipped`** — `score-nfl-week.ts` skips games where `homeScore == null || awayScore == null` via `continue`, incrementing no counter; picks for those games fall through to the `skipped` increment as if the game were not FINAL. Operator cannot distinguish a data anomaly from a legitimately not-yet-final game from the response alone.
- **Read-then-write race in `scoreNflWeek`** — picks are loaded via `findMany` before the `$transaction` opens; a pick submitted in the gap between the two DB calls is invisible to the run and appears in neither `scored` nor `skipped`. Low practical risk for an admin-triggered operation; resolve by moving the picks query inside the transaction when a batch/serializable approach is adopted.

## Deferred from: code review of 5-4-live-leaderboard (2026-06-14)

- **Missing `generateMetadata` export on standings page** — `src/app/(app)/leagues/[leagueId]/standings/page.tsx`. Browser tab uses layout default title. Add a `generateMetadata` function that includes the league name once that pattern is adopted across pages.
- **Current user row: color-only highlight lacks WCAG 1.4.1 non-color indicator** — `src/components/standings/StandingsTable.tsx`. Background color alone does not satisfy WCAG 1.4.1. Add `aria-current="row"` and a visually-hidden "You" label. Address in Story 7.3 (accessibility baseline).
- **Outcome comparisons use raw string literals instead of Prisma-generated enum** — `src/lib/scoring/get-league-standings.ts:43`. `p.outcome === "WIN"` / `"LOSS"` / `"TIE"` — enum rename silently breaks comparisons. Pre-existing pattern across all scoring files (5.2, 5.3); fix in a single enum-import pass across the scoring module.
- **`user.email` may be null in OAuth scenarios; null displayName crashes `localeCompare`** — `src/lib/scoring/get-league-standings.ts:36`. Same as the roster page pattern. If email is non-nullable in the schema this is a non-issue; otherwise add `?? m.id` as ultimate fallback. Verify schema nullability before acting.
- **All `leagueMembership` rows included in standings regardless of role** — `src/lib/scoring/get-league-standings.ts:22`. Non-playing roles (e.g., COMMISSIONER without picks) appear in standings with zeros. Story 2.6 made admin a full participant, but if non-participant roles exist they surface here. Filter by participant roles in a future story if the role model expands.

## Deferred from: code review of 5-6-tuesday-reveal-vs-peer-visibility (2026-06-16)

- **notFound() on unauthenticated session should redirect to sign-in** — `src/app/(app)/leagues/[leagueId]/results/page.tsx`. Same pre-existing pattern deferred from 5-5; fix when a unified auth-redirect middleware is introduced.
- **Email-as-display-name fallback exposes PII to all league members** — `src/lib/scoring/get-league-peer-pick-history.ts`. `user.name ?? user.email` is spec-mandated but email is visible to every participant after a week reveals. Revisit when a user profile / display-name story is scoped.
- **No `generateMetadata` on results page** — `src/app/(app)/leagues/[leagueId]/results/page.tsx`. Pre-existing pattern across all protected app pages; add when a global SEO/title pass is done.
- **Test mocks do not validate Prisma WHERE clauses** — `src/lib/scoring/get-league-peer-pick-history.test.ts`. Mocked Prisma returns fixed data regardless of query params; a wrong `leagueId` or `seasonId` would pass all tests. Address with integration/e2e tests against a real DB or a Prisma mock that validates inputs.

## Deferred from: code review of 5-5-personal-pick-history (2026-06-16)

- **scoredAt/outcome field inconsistency on partial DB writes** — `src/lib/scoring/get-personal-pick-history.ts`. PENDING is determined solely by `outcome == null`; if a future scoring bug sets `outcome` without `scored_at` (or vice versa), the display diverges from the intent. AC1 says "scoredAt IS NULL / outcome IS NULL" are equivalent indicators; add a CHECK constraint (see 5.2 deferred) or check both fields when data integrity is hardened.
- **season.findFirst non-deterministic on duplicate records** — `src/lib/scoring/get-personal-pick-history.ts`. If two Season rows share `(leagueId, nflSeasonYear)`, `findFirst` silently picks one. Schema likely enforces uniqueness; switch to `findUnique` and get a compile-time guarantee in a future scoring refactor pass.
- **notFound() on unauthenticated session should redirect to sign-in** — `src/app/(app)/leagues/[leagueId]/history/page.tsx`. A 404 provides no recovery path for logged-out users. Pre-existing pattern across all protected app pages; fix when a unified auth-redirect middleware is introduced.
- **minHeight: "100vh" on page Stack inside nested layout** — `src/app/(app)/leagues/[leagueId]/history/page.tsx`. Mirrors the standings page exactly per spec; may cause double-full-height subtrees if the app shell already occupies a full-height container. Revisit in a layout/UX pass.
- **Breadcrumb link accessibility polish** — `src/app/(app)/leagues/[leagueId]/history/page.tsx`. "← {league.name}" link lacks a `<nav>` landmark and aria annotations for the arrow character. Deferred to Story 7.3 (accessibility baseline).
- **React key on nflWeekNumber** — `src/components/history/PickHistoryTable.tsx`. DB unique constraint on `(leagueMembershipId, seasonId, nflWeekNumber)` prevents duplicates in practice; exposing a stable DB row ID in `PickHistoryEntry` would be safer if the constraint is ever relaxed.
- **Unhandled Prisma rejections propagate as 500** — `src/app/(app)/leagues/[leagueId]/history/page.tsx` and `src/lib/scoring/get-personal-pick-history.ts`. No try/catch; DB errors surface as unhandled Next.js 500. Pre-existing pattern across all server components; address when a global error-handling layer is introduced.

## Deferred from: Epic 5 retrospective (2026-06-16)

- **`AdminPickOverrideDialog.tsx` pre-existing lint errors** — `src/components/admin/AdminPickOverrideDialog.tsx`. Two lint errors present since at least Story 4.2; noted as "pre-existing, unrelated" in completion notes for Stories 5.1–5.6 but never added here. Fix at start of next story that touches the admin panel. Success criteria: `npm run lint` reports zero errors project-wide.

- **N+1 pattern in `score-nfl-week.ts` `$transaction` loop** — `src/lib/scoring/score-nfl-week.ts`. Per-pick sequential `tx.pick.update` calls inside a single transaction (up to `participants × weeks` calls per season scoring run). Same class as the `sync-nfl-results.ts` N+1 already documented above. At ≤14 participants MVP scale this is acceptable; batch with `updateMany` or a raw SQL update when participant count grows. Flag for Epic 7 hardening.

- **Prisma `$transaction` counter double-counting footgun** — Counters (e.g. `scored`, `skipped`) declared in outer function scope and mutated inside the `$transaction` callback will accumulate across Prisma serialization-failure retries. Pattern fix: declare and return counters *inside* the transaction callback. First caught in Story 5.2 review; Story 5.3 corrected its implementation. Reference this item in future story specs that use `$transaction` with mutable counters.

## Deferred from: code review of 4-3-audit-trail-for-overrides-and-admin-pick-visibility (2026-05-30)

- **No pagination/limit on `getAuditLog`** — `src/lib/admin/get-audit-log.ts:23`. Unbounded `findMany` fetches entire override history on every page load and API call. Add a `take` limit (e.g., 100) and cursor-based pagination when audit trails grow beyond a single season of overrides.
- **RESTRICT FK on membership deletes will block future member-removal features** — `prisma/schema.prisma`, `migration.sql`. `onDelete: Restrict` on `admin_membership_id` and `target_membership_id` FKs means any future member-removal story will hit a DB constraint error. Revisit when a member-removal or soft-delete story is scoped; options include `SET NULL` with nullable FK or application-level nulling before delete.
- **Missing secondary index on `adminMembershipId`** — `prisma/schema.prisma`. Current index is `(leagueId, createdAt DESC)`. A future "show all overrides performed by this admin" query will full-scan. Add `@@index([adminMembershipId])` when that feature is built.
- **Update test asserts same team ID before and after** — `src/lib/admin/submit-pick-on-behalf.test.ts`. The "updates existing pick → 200" test uses `team-away` for both existing and submitted team; the meaningful case (admin changes pick to a different team) is not covered. Add a test case with distinct before/after teams.
- **Email fallback in `adminName`/`targetName` exposes PII in admin UI** — `src/lib/admin/get-audit-log.ts:36-37`. When `user.name` is null, the user's email is displayed in the admin audit log. Email is PII; mask or replace with a non-identifying handle if GDPR compliance is required in future.
- **`adminMembershipId` function parameter not validated to calling session** — `src/lib/admin/submit-pick-on-behalf.ts`. The function accepts `adminMembershipId` as an argument and trusts it without verifying it belongs to the caller. Current route always passes `adminMembership.id` fetched from DB, so no actual risk today; consider an internal assertion or encapsulation if the function gains additional call sites.
- **`AuditLogEntryView.createdAt` typed as `string`** — `src/lib/admin/get-audit-log.ts`. Serialization to ISO string happens inside the data-access layer rather than at the API/serialization boundary. Future callers needing timestamp comparison must re-parse. Consider keeping `Date` in the domain type and serializing only at the route response layer.

## Deferred from: code review of pre-epic-6-email-provider-spike (2026-07-04)

- ~~**Resend idempotency rolling window duration unspecified**~~ — Resolved in Story 6.1: 24-hour window documented in `src/lib/email/resend-client.ts` (see [Resend idempotency docs](https://resend.com/docs/dashboard/emails/idempotency-keys)).
- ~~**NFR32 webhook owner unassigned**~~ — **Owner: Story 7.2** (`docs/observability-scope-decision.md`, 2026-07-05). Scope: log-only `POST /api/webhooks/resend` with Svix signature verification; delivery/bounce events logged to structured console. Admin UI for per-recipient delivery status deferred post-MVP.
- ~~**HTTP 429 retry should be differentiated from transient errors**~~ — Resolved in Story 6.1: `send-with-retry.ts` short-circuits on `statusCode === 429`.
- ~~**`RESEND_API_KEY` absent at SDK construction — no startup guard**~~ — Resolved in Story 6.1: `resend-client.ts` throws at module load.
- **Hobby ±1 hr negative-drift silent-skip risk** — `docs/email-provider-decision.md`. If Vercel fires the cron an hour early (negative drift), the ET time-gate check rejects the invocation and emails are silently skipped for the week. The idempotency sent-flag cannot distinguish "not yet sent" from "skipped". **Mitigation (Story 7.2):** `AdminWeeklyEmailStatus` card shows missing timestamps; ops runbook documents manual log spot-check. **Automated alert:** deferred to Story 7.4 (non-200 on `failed > 0` + external monitor). Manual admin send routes remain the immediate fallback.
- ~~**Hyphen delimiter in idempotency key ambiguous with hyphenated IDs**~~ — Resolved in Story 6.1: colon delimiter (`invitation:${rawToken}`).

## Deferred from: Story 6.1 — transactional email integration (2026-07-04)

- **Replace placeholder Resend `from` domain before production go-live** — `src/lib/email/send-invitation-email.ts` uses `Pick Six <noreply@yourdomain.com>` with a `// TODO: replace with verified Resend domain` comment. Real delivery to non-sandbox recipients requires a **verified sending domain** in Resend (SPF/DKIM DNS records; propagation can take up to 48 hours). Until configured: update the `from` address to your verified domain (e.g. `noreply@yourdomain.com`) and confirm sends in the Resend dashboard. Setup steps: [Resend domain docs](https://resend.com/docs/dashboard/domains/introduction); prerequisites also in `docs/email-provider-decision.md`. For local/dev smoke tests only, Resend's sandbox `from` (`onboarding@resend.dev`) can be used temporarily — do not ship that to production.
- ~~**Invites page copy still references console logs**~~ — Resolved in Story 6.6: `invite-participants-form.tsx` and `invites/page.tsx` now reflect that invitation emails are sent to recipients.

## Deferred from: code review of 6-2-tuesday-6-00-pm-league-email-content-and-admin-preview (2026-07-04)

- **TOCTOU race on concurrent sends** — `src/app/api/leagues/[leagueId]/email/tuesday-send/route.ts`: two concurrent POST requests (double-click or cron+admin overlap) can both pass the `sentAt=null` check before either upserts, potentially triggering duplicate send loops. Resend idempotency keys mitigate within 24h. Proper fix requires DB-level advisory lock or atomic conditional-upsert pattern.
- **Sequential per-member send may exceed serverless timeout** — `src/lib/email/send-tuesday-digest.ts`: sends are strictly sequential with up to 4 retry attempts each; no `maxDuration` export on the route. Large leagues may time out mid-loop, leaving partial delivery with inconsistent `sentAt` state. Fix in a performance hardening pass (parallel batch with concurrency limit + `maxDuration` export).
- **`force=true` resends to all members after Resend idempotency key expiry** — `src/app/api/leagues/[leagueId]/email/tuesday-send/route.ts`: after 24h idempotency keys expire; a forced resend re-iterates every member and members who received the original digest may receive duplicates. Acceptable for an admin tool; address if duplicate-send complaints arise.

## Deferred from: code review of 6-3-wednesday-and-thursday-reminders (2026-07-04)

- **Stale `outstandingCount` SSR prop in `AdminReminderControls`** — `src/components/admin/AdminReminderControls.tsx`. The `outstandingCount` prop is computed at SSR time and never refreshed on the client; after members submit post-load, the outstanding count label and the `allSubmitted` button-disable guard remain frozen at the stale value for the lifetime of the page. Same inherent tradeoff as `AdminEmailComposer`. Address with a live-polling or WebSocket approach when real-time admin UX is prioritised.
- **`sentAt` DB upsert failure causes response/DB desync** — `src/lib/email/send-reminder.ts`. If the `leagueWeekEmailConfig` upsert throws after the send loop completes, the route returns `sentAt: <timestamp>` to the client while the DB still has `null`. Subsequent calls pass the idempotency guard and re-send. Same class as `send-tuesday-digest.ts`; wrap the upsert in a separate try/catch and return `sentAt: null` on upsert failure if operational correctness is later required.
- **No inactive/departed membership filter in `getReminderData`** — `src/lib/email/get-reminder-data.ts`. `leagueMembership.findMany({ where: { leagueId } })` has no status or role filter; if a future membership soft-delete or inactive flag is added, former members will continue to receive reminder emails. Mirrors `get-tuesday-digest-data.ts` exactly. Add a `status: 'ACTIVE'` filter when a membership lifecycle model is introduced.
- **Route calls `getReminderData` before idempotency guard** — `wednesday-reminder/route.ts` and `thursday-reminder/route.ts`. On every 409 (already-sent) path, the full multi-table `getReminderData` query runs unnecessarily because `nflSeasonYear + weekNumber` are needed to key the config lookup. Cannot be avoided without caching week resolution separately. Document as accepted cost; optimise if 409-path latency becomes observable.

## Deferred from: code review of 6-4-email-deep-links-to-picks (2026-07-04)

- **`auth()` called without try/catch in `login/page.tsx`** — `src/app/login/page.tsx:16`. A corrupt JWT cookie causes `jose` to throw a parse error, crashing the login page with a 500 instead of gracefully falling through to render the login form. Pre-existing unguarded `auth()` pattern across all server components; address when a global error-handling layer is introduced.
- **`callbackUrl` as `string[]` silently falls through to `/dashboard`** — `src/app/login/page.tsx:19-21`. If the query string contains two `callbackUrl` params (e.g. from a crafted URL), Next.js produces a `string[]`; the `typeof rawCallback === "string"` guard returns `null` and the user lands at `/dashboard`. Spec prescribes this pattern. Enhancement: extract `Array.isArray ? rawCallback[0] : rawCallback` to preserve the first value. Defer until open-redirect audit.
- **No path-traversal or open-redirect negative tests for picks deep-link pattern** — `src/lib/callback-url.test.ts`. The new positive tests confirm `/leagues/x/picks` passes through; no corresponding negative tests confirm that `/leagues/../../admin`, `//evil.com/leagues/x/picks`, or similar variants are rejected. Existing `getSafeCallbackPath` tests may cover this; add explicit picks-scoped negative assertions in a future security hardening pass.
- **URL fragment in `callbackUrl` silently stripped by `getSafeCallbackPath`** — `src/lib/callback-url.ts`. A `callbackUrl` like `/leagues/x/picks#week5` loses the fragment; the user lands at the top of the picks page rather than the anchored section. Pre-existing behaviour in `getSafeCallbackPath`; extend the return path to include `${u.pathname}${u.search}${u.hash}` if hash-based navigation is ever used in the app.

## Deferred from: code review of 6-1-transactional-email-integration (2026-07-04)

- **`from` address placeholder** — `src/lib/email/send-invitation-email.ts:27` uses `'Pick Six <noreply@yourdomain.com>'` intentionally per spec; not actionable until Resend sending domain is verified.
- **No `server-only` import on email server modules** — `resend-client.ts` and `send-invitation-email.ts` lack `import 'server-only'`; startup guard provides runtime protection but no build-time enforcement. Add `import 'server-only'` to both files in a future cleanup pass.
- **No input validation for empty `to` / empty `rawToken`** — `sendInvitationEmail` does not guard against empty `to` or `rawToken`; empty values produce degenerate signup URLs (`/signup/`) and idempotency key collisions (`invitation:`). API route callers validate upstream. Add defensive guards in a hardening pass.

---

## Pre-production go-live: Vercel operational checklist (Epic 6 — operational, not code)

**Context:** Stories 6.1–6.5 implement transactional email and cron orchestration in code. Before the first real NFL-season weekly cycle in production, a deployer must complete the Vercel-side configuration below. This is an ops checklist — not a story deliverable — consolidated here so it is not lost across individual deferred items.

**Complete before first production weekly email cycle.** Cross-check `.env.example` for the full variable list.

### Required Production environment variables

Set in Vercel → **Settings → Environment Variables → Production**. Redeploy after any change (vars are baked in at build time).

| Variable | Purpose | Generate / source |
|----------|---------|-------------------|
| `DATABASE_URL` | Pooled Postgres (Neon `-pooler` host) | Neon dashboard → Connect |
| `DIRECT_URL` | Direct Postgres for migrations | Neon dashboard → Connect (non-pooler) |
| `AUTH_SECRET` | Session signing | `openssl rand -base64 32` |
| `AUTH_URL` | Absolute site URL for Auth.js callbacks | `https://your-app.vercel.app` |
| `RESEND_API_KEY` | Transactional email | [Resend dashboard](https://resend.com/) → API Keys |
| `CRON_SECRET` | Cron route auth (Vercel sends as `Authorization: Bearer …`) | `openssl rand -hex 32` — **no trailing newlines or special chars** |

Also required for full app operation (not Epic 6–specific): `ODDS_API_KEY`, `API_SPORTS_KEY`. Optional: `WEATHER_API_KEY`, `ODDS_SNAPSHOT_SECRET`.

**Never** prefix any of these with `NEXT_PUBLIC_`.

### Email go-live (see also deferred item above)

- [ ] Verify a **sending domain** in Resend (SPF/DKIM DNS; propagation up to 48 h).
- [ ] Replace placeholder `from` in `send-invitation-email.ts`, `send-tuesday-digest.ts`, and `send-reminder.ts` (`noreply@yourdomain.com` → your verified domain).
- [ ] Send a test invite and admin-triggered Tuesday digest to a real inbox; confirm delivery in Resend dashboard.

### Cron go-live (Story 6.5)

- [ ] Confirm `vercel.json` is deployed (three crons: `tuesday-email`, `wednesday-reminder`, `thursday-reminder`).
- [ ] Vercel → **Settings → Cron Jobs** — all three jobs listed on **production** deployment. Crons do **not** run on preview branches.
- [ ] Set `CRON_SECRET` in Production env vars; **redeploy production**.
- [ ] Post-deploy smoke test (replace domain and secret):

```bash
# Expect 401
curl -s https://your-app.vercel.app/api/cron/tuesday-email | jq

# Expect 200 + outside_window (unless Tue 5–9 PM ET) or send summary
curl -s https://your-app.vercel.app/api/cron/tuesday-email \
  -H "Authorization: Bearer YOUR_CRON_SECRET" | jq
```

- [ ] Repeat for `/api/cron/wednesday-reminder` and `/api/cron/thursday-reminder`.

**Note:** Vercel Cron invokes routes via **GET**; routes delegate GET → shared handler. Manual curl can use GET or POST with the same `Authorization` header.

### Database migrations

- [ ] Run `npm run db:migrate:deploy` against production `DATABASE_URL` / `DIRECT_URL` before or as part of first deploy with schema changes.

### Known accepted risks (see existing deferred items — do not duplicate fixes here)

- **Hobby ±1 hr cron drift** — negative drift can cause `outside_window` skip with no retry that week. Mitigation: admin manual send routes; long-term: monitoring alert (see below).
- ~~**NFR32 Resend webhooks**~~ — **Owner: Story 7.2** — log-only webhook route (`docs/observability-scope-decision.md`).
- ~~**No cron run observability in admin UI**~~ — **Owner: Story 7.2** — `AdminWeeklyEmailStatus` card on league admin page (hybrid observability decision).
- **Monitoring alert for missed weekly sends** — **Owner: Story 7.2 (manual ops) + Story 7.4 (automated)**. MVP: documented weekly spot-check in ops runbook + admin card "Not sent" state. Automated non-200 cron + external monitor deferred to 7.4 (`docs/observability-scope-decision.md`).

### Success criteria

Production is "weekly-email ready" when: all required env vars set, production redeployed, Resend domain verified and `from` updated, cron smoke tests pass with 401/200 as expected, and at least one admin-triggered email confirmed in a real inbox.

**Future:** Consider extracting detailed step-by-step instructions to `docs/deployment.md` when Epic 7.4 (deployment hardening) is scoped.

## Deferred from: code review of 6-5-cron-routes-secrets-and-idempotent-weekly-orchestration (2026-07-04)

- **No `maxDuration` in `vercel.json`** — All three cron routes process leagues serially in a single Vercel invocation. A large number of active leagues could hit the default function timeout, silently leaving the rest un-emailed. Add `"maxDuration": 300` (or an appropriate limit) to `vercel.json` when the active-league count grows.
- **Timing side-channel from length pre-check in `assertCronRequest`** — The early return before `crypto.timingSafeEqual` when buffer lengths differ technically leaks the secret's byte-length via response-time variance. The spec explicitly authorizes this approach (to avoid `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH`). A fully constant-time implementation would pad both buffers to a common length before comparing. Acceptable for MVP; revisit if a stricter security posture is required.
- **No unit tests for `isInEasternWindow`** — The timezone utility is the most fragile piece of cron logic (DST transitions, ICU data). AC7 only required tests for `assert-cron-request.ts`. Add `isInEasternWindow` tests (mocking `Date` or using fixed UTC inputs) when the test baseline for the `src/lib/cron/` module is expanded.
- **TOCTOU race on idempotency check (read-then-send-then-write)** — Two concurrent cron invocations could both pass the `sentAt == null` guard before either sets it, resulting in duplicate email sends. Accepted per dev notes; Resend's 24-hour idempotency key is the ultimate backstop. Eliminate the race with a DB-level upsert guard or distributed lock if Resend idempotency stops being sufficient.
- **HTTP 200 always returned even when `failed > 0`** — Monitoring and alerting systems that watch HTTP status codes will not detect partial email failures. Log-based alerting on the `failed` counter is the current detection method. **Owner: Story 7.4** — return non-200 (or emit structured monitoring event) when `failed > 0`; MVP keeps 200 per `docs/observability-scope-decision.md`.
- **No circuit breaker for email provider outage** — If Resend is unavailable, all three cron routes iterate every active league, accumulate failures, log errors, and return 200. There is no early-abort logic. Add a failure-threshold check (e.g., abort after N consecutive failures) when operational reliability tooling is added in Epic 7.
- **`toLocaleString` ICU dependency in `eastern-window.ts`** — `new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))` relies on ICU timezone data being present in the Node.js runtime. Vercel's full-ICU runtime makes this safe in production. If the runtime environment ever changes (e.g., edge runtime, custom Docker image with `--small-icu`), this call could produce an Invalid Date, silently causing all window checks to return false. Migrate to a library like `date-fns-tz` or use the `Intl.DateTimeFormat` parts API for a more portable approach.

## Deferred from: Story 6.6 — UX spec comparison and alignment (2026-07-04)

- **PickStatusBanner desktop inline with page title** — UX spec shows banner inline with the "This Week" header row on desktop. Requires a header-row refactor; current banner remains full-width below deadline/jailed row.
- **Standings desktop sidebar** — UX spec includes a contextual sidebar on desktop standings. MVP table-only layout retained; enhancement deferred to Epic 7.
- **Global 48px button height enforcement** — UX button hierarchy specifies 48px touch targets globally. Not enforced in theme overrides; defer to Epic 7.3/7.4.
- **Skeleton loading states** — UX responsive table calls for skeleton placeholders during load. No skeleton components yet; defer to Epic 7.4.
- **Snackbar admin feedback** — UX prefers Snackbar for transient admin actions; current inline Alert pattern in email composers is acceptable MVP; polish pass deferred.
- **Landing page hero layout** — Marketing landing page alignment out of league-shell scope; defer.
- **`generateMetadata` on league pages** — Deferred from Stories 5.4–5.6; Epic 7.
- **Full WCAG Level A audit** — Partial coverage (matchup radiogroup, standings `aria-current` added in 6.6); full audit in Story 7.3.
- **WeatherBadge component extraction** — Weather remains inline in `MatchupCard`; cosmetic extraction deferred.
- ~~**NFR32 Resend webhooks**~~ — **Owner: Story 7.2** — log-only webhook route per `docs/observability-scope-decision.md`.
- **Real-time admin outstanding count refresh** — Stale SSR `outstandingCount` in `AdminReminderControls`; deferred from 6.3, unchanged in 6.6.

## Deferred from: code review of 6-6-ux-spec-comparison-and-alignment (2026-07-04)

- **Redundant Prisma membership queries in league layout + child pages** — New `[leagueId]/layout.tsx` duplicates membership/league fetches that every child page already performs. Consolidate via shared loader or React cache in a future perf pass.

