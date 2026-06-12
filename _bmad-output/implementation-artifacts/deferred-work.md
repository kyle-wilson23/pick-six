# Deferred Work

Items surfaced during code review that are intentionally deferred. Each entry cites the source review and links back to the story spec.

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

## Deferred from: code review of 4-4-jailed-team-verification-view (2026-05-30)

- **`jailed.randomSeed` (DB) vs `audit.randomSeed` (JSON) not cross-validated** — `src/lib/admin/get-jailed-verification.ts`. The route returns `jailed.randomSeed` (the DB column) rather than `audit.randomSeed` (the value inside `auditJson`). If they diverge, the FR52 audit display shows the wrong seed. Fix when FR52 audit compliance is hardened.
- **`resolvePicksWeekNumber` called independently in page and `getJailedVerification`** — `src/app/(app)/leagues/[leagueId]/admin/page.tsx`. At a week-boundary crossing the page's `weekNumber` (used in the jailed empty-state message) and the jailed section's internal `weekNumber` could diverge by 1. Fix by threading a shared `now` if the mismatch becomes observable.
- **No fallback to the most recently computed jailed week** — `src/lib/admin/get-jailed-verification.ts`. Once `resolvePicksWeekNumber` advances to week N+1, the jailed section shows null until computation runs for N+1, even though week N's record exists. Revisit when "view prior-week jailed" is requested.
- **Backward-compat rows show no stage chips with no UI hint** — `src/components/admin/AdminJailedVerification.tsx`. Old `NflWeekJailedTeam` rows missing `afterMoneyline`/`afterSpread` display no stage chips, with no indication to admins that stage data is simply unavailable (vs. a clean single-winner MONEYLINE result). Add a "(legacy data — stage breakdown unavailable)" hint if UX feedback warrants it.
- **`jailed.jailedTeamId` (DB) vs `audit.jailedTeamId` (JSON) never cross-checked** — `src/lib/admin/get-jailed-verification.ts`. A corrupt row where the DB column and the JSON diverge would silently show inconsistent data. Fix when a data-consistency validation layer is added.
- **`.passthrough()` on `AuditJsonV1Schema` allows unknown fields** — `src/lib/admin/get-jailed-verification.ts`. Intentional for forward-compat, but weakens strictness. Revisit if schema drift causes runtime issues.
- **`afterMoneyline`/`afterSpread` optional in Zod but required in domain type** — `src/lib/admin/get-jailed-verification.ts`. A future persistence path that omits these fields would pass Zod but show null in the UI silently. Monitor if new computation paths are added.

## Deferred from: code review of 4-3-audit-trail-for-overrides-and-admin-pick-visibility (2026-05-30)

- **No pagination/limit on `getAuditLog`** — `src/lib/admin/get-audit-log.ts:23`. Unbounded `findMany` fetches entire override history on every page load and API call. Add a `take` limit (e.g., 100) and cursor-based pagination when audit trails grow beyond a single season of overrides.
- **RESTRICT FK on membership deletes will block future member-removal features** — `prisma/schema.prisma`, `migration.sql`. `onDelete: Restrict` on `admin_membership_id` and `target_membership_id` FKs means any future member-removal story will hit a DB constraint error. Revisit when a member-removal or soft-delete story is scoped; options include `SET NULL` with nullable FK or application-level nulling before delete.
- **Missing secondary index on `adminMembershipId`** — `prisma/schema.prisma`. Current index is `(leagueId, createdAt DESC)`. A future "show all overrides performed by this admin" query will full-scan. Add `@@index([adminMembershipId])` when that feature is built.
- **Update test asserts same team ID before and after** — `src/lib/admin/submit-pick-on-behalf.test.ts`. The "updates existing pick → 200" test uses `team-away` for both existing and submitted team; the meaningful case (admin changes pick to a different team) is not covered. Add a test case with distinct before/after teams.
- **Email fallback in `adminName`/`targetName` exposes PII in admin UI** — `src/lib/admin/get-audit-log.ts:36-37`. When `user.name` is null, the user's email is displayed in the admin audit log. Email is PII; mask or replace with a non-identifying handle if GDPR compliance is required in future.
- **`adminMembershipId` function parameter not validated to calling session** — `src/lib/admin/submit-pick-on-behalf.ts`. The function accepts `adminMembershipId` as an argument and trusts it without verifying it belongs to the caller. Current route always passes `adminMembership.id` fetched from DB, so no actual risk today; consider an internal assertion or encapsulation if the function gains additional call sites.
- **`AuditLogEntryView.createdAt` typed as `string`** — `src/lib/admin/get-audit-log.ts`. Serialization to ISO string happens inside the data-access layer rather than at the API/serialization boundary. Future callers needing timestamp comparison must re-parse. Consider keeping `Date` in the domain type and serializing only at the route response layer.
