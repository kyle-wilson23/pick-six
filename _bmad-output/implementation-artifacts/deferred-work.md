# Deferred Work

Items surfaced during code review that are intentionally deferred. Each entry cites the source review and links back to the story spec.

## Deferred from: code review of story 3-3-jailed-team-identification-and-tie-breakers (2026-04-25)

- **Picks-lock guard on jailed POST** — `src/app/api/admin/nfl/week-jailed/route.ts` POST + `src/lib/nfl/jailed-computation.ts` upsert. Once the picks model lands (Story 3.4/3.5), POST must refuse (or require an explicit `force=true` + audit log) when a week's picks are already locked, so jailed cannot silently rewrite scoring after the deadline. Today the dev choice "admin recompute by design" is per spec, but it becomes a Critical-risk path the moment picks exist.
- **Transactional read+resolve+upsert for jailed compute** — `src/lib/nfl/jailed-computation.ts`. Wrap `nflGame.findMany` + `getEffectiveOddsLinesForWeek` + `randomBytes` + `prisma.nflWeekJailedTeam.upsert` in a `prisma.$transaction` with row-level locking on `(nflSeasonYear, weekNumber)` so two concurrent admin POSTs cannot generate independent random seeds and silently overwrite each other. Low practical risk on an admin-only endpoint but real once an automation runner exists; needs a refactor of `getEffectiveOddsLinesForWeek` to accept the transaction client.
- **Per-stage survivors in jailed `audit`** — `src/lib/domain/jailed.ts` `buildResult`. Persist `afterMoneyline` and `afterSpread` slices alongside the full `candidates` array so a verifier (Story 4.4 jailed verification view) can see exactly which candidates reached the SPREAD or RANDOM stage without re-running the algorithm in their head.
