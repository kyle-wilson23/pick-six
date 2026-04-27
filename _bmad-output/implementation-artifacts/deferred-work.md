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

## Deferred from: code review of 3-5-deadline-enforcement-server-authority (2026-04-26)

- **`GAMES_NOT_LOADED` message misleading for null-`kickoffAt` case** — `src/app/api/leagues/[leagueId]/picks/route.ts`. When games exist but one has a null kickoff, the message says "No game schedule data is available" — implying no ingestion occurred. A distinct message or code for the partial-ingestion case would be clearer, but the spec sanctions reusing this validation.
- **`checkPickMutationDeadline` returns null for empty games — latent bypass** — `src/lib/picks/assert-pick-mutation-allowed.ts`. The documented precondition ("call only after games are loaded") prevents this in practice, but any future caller that omits the route-level guard silently bypasses deadline enforcement. Consider an invariant throw on empty input.
- **`now` not injectable in `computeAndPersistNflWeekJailed`** — `src/lib/nfl/jailed-computation.ts`. The jailed recompute path captures `now` internally, making the deadline check path difficult to unit test deterministically. Align with `checkPickMutationDeadline`'s injected `now` pattern in a future refactor.
- **Thursday 8:10 PM cutoff is a magic literal, not a named constant** — `src/lib/domain/pick-deadline.ts`. The `20, 10` hour/minute values in `lockByThursdayDefaultUtc` and the associated test assertions are scattered. A named export (`THURSDAY_LOCK_HOUR`, `THURSDAY_LOCK_MINUTE`) would create a single authoritative source.
- **`gamesWithKickoff` manually reconstructed rather than type-narrowed** — `src/app/api/leagues/[leagueId]/picks/route.ts`. The loop that rebuilds each game as `{ homeTeamId, awayTeamId, kickoffAt }` sheds future Prisma fields. A type-narrowing filter (`.filter((g): g is ... => g.kickoffAt != null)`) avoids the parallel allocation.
