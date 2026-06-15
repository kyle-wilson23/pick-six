# Story 5.2: Calculate weekly points (1 vs 2 anti-jailed)

Status: done

## Story

As the system,
I want points awarded per PRD rules,
So that standings reflect performance (**FR42**, **FR54**).

## Acceptance Criteria

### AC1 — Schema: `PickOutcome` enum and scoring columns on `Pick`

**Given** `prisma/schema.prisma` and migrations applied

**Then** a new `PickOutcome` enum exists:
```
WIN      // picked team won the game
LOSS     // picked team lost the game
TIE      // game ended in a tie (both teams tied)

@@map("pick_outcome")
```

**And** `Pick` gains three new columns:
- `outcome PickOutcome? @map("outcome")` — null until the game is FINAL and scoring has run
- `pointsEarned Int? @map("points_earned")` — null until scored; set to 0, 1, or 2
- `scoredAt DateTime? @map("scored_at") @db.Timestamptz` — null until first scoring run; updated on every re-score

**And** all existing `Pick` unique constraints and FKs are unaffected

**And** `npm run db:migrate` applies cleanly in dev; production deploy: `npm run db:migrate:deploy`

---

### AC2 — Pure domain helper: `scorePickOutcome`

**Given** `src/lib/domain/scoring.ts` exports `scorePickOutcome`

**When** called with a pick (`{ teamId, antiJailedBonus }`) and a `GameWinnerResult` (from existing `getGameWinner`)

**Then** returns:
- `{ outcome: "WIN", pointsEarned: 1 }` — when the picked team won AND `antiJailedBonus` is `false`
- `{ outcome: "WIN", pointsEarned: 2 }` — when the picked team won AND `antiJailedBonus` is `true`
- `{ outcome: "LOSS", pointsEarned: 0 }` — when the picked team lost (`antiJailedBonus` value is irrelevant; no anti-jailed points if you lose)
- `{ outcome: "TIE", pointsEarned: 0 }` — when the game was a tie (NFL ties are real since 2012 OT rules; 0 points for both sides is the documented product decision for MVP)

**And** the function is pure (no I/O, no Prisma); it only needs `GameWinnerResult` and pick fields

---

### AC3 — Scoring job: `scoreNflWeek`

**Given** `src/lib/scoring/score-nfl-week.ts` exports `scoreNflWeek(prisma, { nflSeasonYear, weekNumber })`

**When** called with a valid season year and week number

**Then** for each `Pick` row where:
- `pick.season.nflSeasonYear === nflSeasonYear`
- `pick.nflWeekNumber === weekNumber`
- the picked team's `NflGame` in that week has `status = FINAL`

**The function:**
1. Loads all `NflGame` rows for `(nflSeasonYear, weekNumber)` with `status = FINAL`
2. Builds a team-ID-keyed winner map using `getGameWinner` for each FINAL game
3. Loads all `Pick` rows for `(nflSeasonYear, weekNumber)` with their `teamId` and `antiJailedBonus`
4. For each pick whose `teamId` appears in the winner map: calls `scorePickOutcome` and writes `outcome`, `pointsEarned`, `scoredAt = now()` back to the `Pick` row
5. Skips picks whose `teamId` is not in the winner map (game not yet FINAL — admin can re-run)
6. Returns `{ ok: true; scored: number; skipped: number }` on success

**And** the job is **idempotent** — running it again after more games finalize continues from where it left off; running it twice for the same games with the same results produces the same DB state

**And** if results change (e.g. admin corrects a score via Story 5.1 PATCH endpoint), re-running updates the stored outcome and `scoredAt`

**And** picks for teams whose game is `IN_PROGRESS` or `SCHEDULED` are silently skipped (no error), just incremented in `skipped` count

---

### AC4 — Admin API endpoint: `POST /api/admin/scoring/score-week`

**Given** `POST /api/admin/scoring/score-week` with body `{ "nflSeasonYear": 2026, "weekNumber": 1 }`

**When** called by a bearer token (`ODDS_SNAPSHOT_SECRET`) **or** a valid league admin session

**Then** the scoring job runs for that season/week and returns:
```json
{ "nflSeasonYear": 2026, "weekNumber": 1, "scored": 14, "skipped": 2 }
```

**And** `nflSeasonYear` defaults to `getCurrentNflSeasonYear()` if omitted; `weekNumber` is **required** (unlike sync-results where it was optional — scoring is always week-scoped)

**And** `weekNumber` outside `1–18` → `400 VALIDATION_ERROR`

**And** unauthenticated or non-admin request (no valid bearer, no admin session) → `401`/`403`

**And** `ODDS_SNAPSHOT_SECRET` not configured → the bearer auth path fails; the admin-session path still works

---

### AC5 — Missed picks: 0 points by absence, not by row

**Given** a participant who submitted no pick for a given week

**Then** there is no `Pick` row for that member+week+season combination

**And** the scoring job does not create phantom rows — it only updates existing `Pick` rows

**And** the leaderboard (Story 5.4) will treat the absence of a `Pick` row for a week as 0 points for that week (implemented in 5.4; documented here as the contract)

---

### AC6 — Tests: no live network in default `npm test`

**Given** `npm test` runs in CI

**Then** the following test files pass:

- **`src/lib/domain/scoring.test.ts`** (extended from Story 5.1) — add `scorePickOutcome` unit tests:
  - standard win → `{ outcome: "WIN", pointsEarned: 1 }`
  - anti-jailed win → `{ outcome: "WIN", pointsEarned: 2 }`
  - standard loss → `{ outcome: "LOSS", pointsEarned: 0 }`
  - anti-jailed loss (losing while claiming bonus) → `{ outcome: "LOSS", pointsEarned: 0 }`
  - tie (antiJailedBonus false) → `{ outcome: "TIE", pointsEarned: 0 }`
  - tie (antiJailedBonus true) → `{ outcome: "TIE", pointsEarned: 0 }` (tie forfeits bonus)

- **`src/lib/scoring/score-nfl-week.test.ts`** — orchestration tests with mocked Prisma:
  - standard win: pick updated to WIN/1pt, `scoredAt` set
  - anti-jailed win: pick updated to WIN/2pt
  - loss: pick updated to LOSS/0pt
  - tie: pick updated to TIE/0pt
  - pick with team in non-FINAL game: skipped (not updated), increments `skipped` count
  - week with NO FINAL games: returns `{ ok: true, scored: 0, skipped: N }` (not an error)
  - idempotent re-run: calling twice with same data produces same outcome (no duplicate writes, `scoredAt` updated)
  - multiple picks across leagues/seasons for same week: all scored independently

**And** no live HTTP calls or real DB connections in these tests

---

## Dev Notes

### Schema Design Decision: columns on `Pick`, not a separate table

Scoring results are stored directly on `Pick` rows rather than in a new `PickResult` or `WeeklyScore` table. Rationale:
- Each pick has exactly one outcome per game — the 1:1 relationship is simple and static once FINAL
- Stories 5.4 (leaderboard) and 5.5 (personal history) only need `Pick` with `pointsEarned` — no joins to a separate table
- The `scoredAt` field supports re-scoring and audit without a separate audit table
- If the data model evolves (e.g., partial-season scoring, per-league overrides), add columns then

### Points rules (hardcoded for MVP)

```
Win + antiJailedBonus = false  →  1 point
Win + antiJailedBonus = true   →  2 points
Loss (any bonus flag)          →  0 points
Tie  (any bonus flag)          →  0 points
No pick submitted              →  0 points (absence of Pick row — not stored)
```

NFL ties have been possible since the 2012 OT rule change. The decision to award 0 points for ties is intentional (no correct prediction on the winning team) and documented here as the MVP rule.

### `scorePickOutcome` signature — extends existing `scoring.ts`

Story 5.1 created `src/lib/domain/scoring.ts` with `getGameWinner`. This story extends the same file:

```ts
// Add to src/lib/domain/scoring.ts

export type ScoredPickResult = {
  outcome: "WIN" | "LOSS" | "TIE";
  pointsEarned: number;
};

/**
 * Pure function — no I/O. Caller must call getGameWinner first.
 * Determines the point outcome for a single pick against a finalized game.
 */
export function scorePickOutcome(
  pick: { teamId: string; antiJailedBonus: boolean },
  gameResult: GameWinnerResult,
): ScoredPickResult {
  if (gameResult.kind === "tie") {
    return { outcome: "TIE", pointsEarned: 0 };
  }
  if (gameResult.winnerId === pick.teamId) {
    return { outcome: "WIN", pointsEarned: pick.antiJailedBonus ? 2 : 1 };
  }
  return { outcome: "LOSS", pointsEarned: 0 };
}
```

The return type uses string literals (`"WIN" | "LOSS" | "TIE"`) that match the new `PickOutcome` Prisma enum values — no separate mapping needed.

### `scoreNflWeek` orchestration structure

```
src/lib/scoring/score-nfl-week.ts
```

Follow the `sync-nfl-results.ts` result union type pattern:

```ts
export type ScoreNflWeekResult =
  | { ok: true; scored: number; skipped: number }
  | { ok: false; code: string; message: string; httpStatus: number };
```

Internal algorithm:

```ts
export async function scoreNflWeek(
  prisma: PrismaClient,
  opts: { nflSeasonYear: number; weekNumber: number },
): Promise<ScoreNflWeekResult>
```

Steps (pseudocode):
```ts
// 1. Load all FINAL games for the week
const finalGames = await prisma.nflGame.findMany({
  where: { nflSeasonYear: opts.nflSeasonYear, weekNumber: opts.weekNumber, status: "FINAL" },
  select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
});

// 2. Build teamId → GameWinnerResult map
const winnerByTeamId = new Map<string, GameWinnerResult>();
for (const game of finalGames) {
  // homeScore/awayScore are non-null on FINAL games (enforced by AC4 of Story 5.1)
  const result = getGameWinner(game as { ... });
  // Map both teams to the same result
  winnerByTeamId.set(game.homeTeamId, result);
  winnerByTeamId.set(game.awayTeamId, result);
}

// 3. Load all picks for the week (via Season join)
const picks = await prisma.pick.findMany({
  where: { nflWeekNumber: opts.weekNumber, season: { nflSeasonYear: opts.nflSeasonYear } },
  select: { id: true, teamId: true, antiJailedBonus: true },
});

// 4. Score each pick where game is FINAL; skip others
let scored = 0, skipped = 0;
await prisma.$transaction(async (tx) => {
  for (const pick of picks) {
    const gameResult = winnerByTeamId.get(pick.teamId);
    if (!gameResult) { skipped++; continue; }
    const { outcome, pointsEarned } = scorePickOutcome(pick, gameResult);
    await tx.pick.update({
      where: { id: pick.id },
      data: { outcome, pointsEarned, scoredAt: new Date() },
    });
    scored++;
  }
});
return { ok: true, scored, skipped };
```

**Note on N+1 pattern**: The `tx.pick.update` loop is a per-pick sequential pattern inside a transaction — consistent with the existing `sync-nfl-results.ts` N+1 pattern (also deferred). At MVP scale (≤14 participants × 18 weeks = ≤252 picks per season), this is acceptable. Document in deferred work if needed.

### New files vs. modified files

**New files:**
- `src/lib/scoring/score-nfl-week.ts` — orchestration
- `src/lib/scoring/score-nfl-week.test.ts` — mocked-Prisma tests
- `src/app/api/admin/scoring/score-week/route.ts` — API endpoint

**Modified files:**
- `prisma/schema.prisma` — add `PickOutcome` enum + 3 columns to `Pick`
- `src/lib/domain/scoring.ts` — add `scorePickOutcome`, `ScoredPickResult`
- `src/lib/domain/scoring.test.ts` — add `scorePickOutcome` test cases

**New migration:**
- `prisma/migrations/[timestamp]_pick_outcome/migration.sql`
  - `CREATE TYPE "pick_outcome" AS ENUM ('WIN', 'LOSS', 'TIE');`
  - `ALTER TABLE "picks" ADD COLUMN "outcome" "pick_outcome";`
  - `ALTER TABLE "picks" ADD COLUMN "points_earned" INTEGER;`
  - `ALTER TABLE "picks" ADD COLUMN "scored_at" TIMESTAMPTZ;`

No index required on `outcome` or `scored_at` for MVP — the leaderboard query (Story 5.4) will filter by `(seasonId, nflWeekNumber)` which is already indexed via `@@index([seasonId])`.

### API route structure

```
src/app/api/admin/scoring/score-week/route.ts
```

Auth pattern — copy from `sync-results/route.ts` (dual auth):
```ts
// 1. Check bearer token first (for cron/automation)
const bearerAuth = assertBearerToken(request, process.env.ODDS_SNAPSHOT_SECRET);
if (!bearerAuth.ok) {
  // 2. Fall back to admin session check
  const sessionAuth = await assertAuthorizedForNflOddsOps(request);
  if (!sessionAuth.ok) return sessionAuth.response;
}
```

Body schema (Zod):
```ts
const bodySchema = z.object({
  nflSeasonYear: z.number().int().min(2020).max(2050).optional(),
  weekNumber: z.number().int().min(1).max(18),  // required — scoring is always week-scoped
});
```

Error response for missing week:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "weekNumber is required" } }
```

Success response shape:
```json
{ "nflSeasonYear": 2026, "weekNumber": 3, "scored": 14, "skipped": 0 }
```

### `getCurrentNflSeasonYear` — reuse existing helper

The same `getCurrentNflSeasonYear()` function used in `sync-results/route.ts` should be imported and reused here — do not re-implement. Find it in `src/lib/nfl/` (or wherever the existing route imports it from).

### Auth: reuse `assertAuthorizedForNflOddsOps` + bearer pattern

Both functions are already implemented and used in `src/app/api/admin/nfl/sync-results/route.ts`. Import them; do not re-implement.

### `readJsonObject` helper — deferred extraction

As noted in deferred-work.md from Story 5.1 code review, the `readJsonObject` helper is duplicated in two existing route files. This route becomes the third instance. Per deferred-work.md guidance, extract to `src/lib/request-utils.ts` in **this** story (since this creates a third copy). The extraction is small and low-risk.

**Extraction spec:**
```ts
// src/lib/request-utils.ts
export async function readJsonObject(request: Request): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }>
```

**Then update** the two existing route files (`sync-results/route.ts` and `result/route.ts`) to import from `src/lib/request-utils.ts` — removes the duplication tracked in deferred-work.md.

### Do NOT build in Story 5.2

- **No leaderboard or standings UI** (Story 5.4) — scoring populates `pointsEarned`; the UI reads it in 5.4
- **No season-total aggregation** — `SUM(pointsEarned)` for the leaderboard is Story 5.4's responsibility
- **No personal pick history UI** (Story 5.5)
- **No Tuesday reveal rules** (Story 5.6)
- **No cron scheduling** (Epic 6) — admin-triggered only for now
- **No MNF completion detection** (Story 5.3) — this story provides the scoring primitive; 5.3 adds the trigger/orchestration
- **No admin UI** for triggering scoring — API only; admin uses curl/scripts

### Story 5.1 intelligence to carry forward

Story 5.1 shipped these files relevant to this story:
- `src/lib/domain/scoring.ts` — `getGameWinner` + `GameWinnerResult` type (extend this file, do not duplicate)
- `src/lib/domain/scoring.test.ts` — 4 existing tests (add new describe block or new `it()` calls inside same `describe`)
- `prisma/schema.prisma` — `NflGameStatus` enum + result columns on `NflGame` (already migrated)
- `src/app/api/admin/nfl/sync-results/route.ts` — dual-auth bearer+session pattern to copy
- `src/lib/nfl/sync-nfl-results.ts` — result union type pattern (`SyncNflResultsResult`) to follow

### Deferred-work items relevant to this story

From `_bmad-output/implementation-artifacts/deferred-work.md`:

**Actionable in this story:**
- **Duplicate `readJsonObject` helper** (deferred from 5.1 code review): this story adds a third route that would need the same helper. **Extract now** per the spec in the section above.

**Not blocking, leave deferred:**
- **N+1 queries in sync transaction** (5.1): the same N+1 pattern is used in this story's `pick.update` loop. Document in deferred-work.md as `score-nfl-week.ts` equivalent. At ≤14 participants, this is acceptable.
- **NaN/Infinity guard in `getGameWinner`** (5.1): no new call sites outside the scoring pipeline; risk remains low.

### Git intelligence — recent commits

- `a6bd803 feat(nfl): Story 5.1 ingest game results and finalize games` — established `NflGameStatus` enum, `getGameWinner` in `domain/scoring.ts`, dual-auth route pattern for admin NFL endpoints, and the `SyncNflResultsResult` union type.
- `99f4d60 refactor(domain): extract Thursday lockout constants` — confirms `SCREAMING_SNAKE_CASE` naming for exported domain constants.
- `ee2ad8f fix(domain): gate jailed opponent lookup on antiJailedBonus` — confirms pure-function test-first pattern in `domain/`.

### Test patterns from prior stories

- **Domain functions**: co-locate `.test.ts` next to `.ts`; use `describe` + `it`; pure inputs/outputs, no mocks
- **Orchestration**: mock Prisma with `vi.fn()` or equivalent; test each branch (win/loss/tie/skip/idempotent)
- **No `beforeEach` over-engineering**: keep tests flat and readable per project style observed in `sync-nfl-results.test.ts` and `scoring.test.ts`

### `PickOutcome` Prisma enum — DB column type

The Prisma client generates the `PickOutcome` enum type. Use it directly in the route and scoring lib:

```ts
import type { PickOutcome } from "@prisma/client";
```

The `scorePickOutcome` return type uses string literals (`"WIN" | "LOSS" | "TIE"`) that are assignable to `PickOutcome` — no additional mapping needed.

### Project context non-negotiables checklist

- [ ] No `ODDS_SNAPSHOT_SECRET` or other secrets in client code or `NEXT_PUBLIC_*`
- [ ] Single Prisma client (`import { prisma } from "@/lib/db"`)
- [ ] Consistent JSON error shape: `{ "error": { "code": "…", "message": "…" } }`
- [ ] DB column names: `snake_case` via `@map("…")`; JSON keys: `camelCase`
- [ ] `weekNumber` validated as 1–18 at the API boundary (Zod)
- [ ] Route handler at `src/app/api/admin/scoring/score-week/route.ts` (no `/v1` prefix)

---

## Tasks / Subtasks

- [x] **Prisma schema + migration** (AC1)
  - [x] Add `PickOutcome` enum (`WIN`, `LOSS`, `TIE`) to `prisma/schema.prisma`
  - [x] Add `outcome PickOutcome?`, `pointsEarned Int?`, `scoredAt DateTime? @db.Timestamptz` columns to `Pick` model
  - [x] Run `npm run db:migrate` — generates migration SQL; verify migration applies cleanly

- [x] **Domain helper `scorePickOutcome`** (AC2, AC6)
  - [x] Add `ScoredPickResult` type and `scorePickOutcome` function to `src/lib/domain/scoring.ts`
  - [x] Add 6 test cases to `src/lib/domain/scoring.test.ts` covering all outcomes (win/win-bonus/loss/loss-with-bonus/tie/tie-with-bonus)

- [x] **`readJsonObject` extraction** (deferred-work from 5.1)
  - [x] Create `src/lib/request-utils.ts` exporting `readJsonObject`
  - [x] Update `src/app/api/admin/nfl/sync-results/route.ts` to import from `request-utils`
  - [x] Update `src/app/api/admin/nfl/games/[gameId]/result/route.ts` to import from `request-utils`
  - [x] Verify `npm test` still passes after refactor

- [x] **`scoreNflWeek` orchestration** (AC3, AC6)
  - [x] Create `src/lib/scoring/score-nfl-week.ts` with `ScoreNflWeekResult` type and `scoreNflWeek` function
  - [x] Create `src/lib/scoring/score-nfl-week.test.ts` with mocked-Prisma tests (8 cases from AC6)

- [x] **`POST /api/admin/scoring/score-week` route** (AC4)
  - [x] Create route at `src/app/api/admin/scoring/score-week/route.ts`
  - [x] Zod body: `weekNumber` required (1–18), `nflSeasonYear` optional (defaults to `getCurrentNflSeasonYear()`)
  - [x] Dual-auth: bearer `ODDS_SNAPSHOT_SECRET` or admin session (`assertAuthorizedForNflOddsOps`)
  - [x] Return `{ nflSeasonYear, weekNumber, scored, skipped }` on success

- [x] **`npm test` green; `npm run lint`; `npm run build`** before closing

### Review Findings

- [x] [Review][Patch] Counter double-counting on transaction retry — `let scored = 0; let skipped = 0` are declared in the outer function scope and mutated inside the `prisma.$transaction` callback; Prisma retries the callback on serialization failures, causing both counters to accumulate across retries [src/lib/scoring/score-nfl-week.ts:58-75]
- [x] [Review][Patch] `ok: false` error path is dead code / DB exceptions leak as unhandled 500s — `scoreNflWeek` never returns the `{ ok: false }` union variant; it throws unconditionally on failure; the route handler's `if (!result.ok)` branch is unreachable dead code; DB errors surface as unhandled 500s with stack traces rather than structured error responses [src/lib/scoring/score-nfl-week.ts + src/app/api/admin/scoring/score-week/route.ts:72-83]
- [x] [Review][Patch] Manual `weekNumber` null-check has a gap — `rawBody.weekNumber === undefined` does not catch `{ weekNumber: null }`; that value passes the guard and is rejected by Zod with "Number must be greater than or equal to 1" instead of the intended "weekNumber is required" message [src/app/api/admin/scoring/score-week/route.ts:52-57]
- [x] [Review][Patch] Idempotency test does not assert `scoredAt` advances on re-score — both calls only assert `instanceof Date`; timestamps are never compared; the "updates scoredAt" claim in the test name is unverified and the test passes even if both timestamps are identical [src/lib/scoring/score-nfl-week.test.ts:163-166]
- [x] [Review][Defer] No DB atomicity CHECK constraint on the three scoring columns — `outcome`, `points_earned`, and `scored_at` can be partially written (e.g. `outcome = 'WIN'`, `points_earned = NULL`) with no constraint to enforce all-or-nothing [prisma/migrations/20260614120000_pick_outcome/migration.sql] — deferred, pre-existing
- [x] [Review][Defer] No range CHECK constraint on `points_earned` — domain only produces 0, 1, or 2; column accepts any INTEGER [prisma/migrations/20260614120000_pick_outcome/migration.sql] — deferred, pre-existing
- [x] [Review][Defer] `isOddsAutomationRequest` duplicated from `sync-results/route.ts` — same function exists verbatim in two route files; spec called for copying the pattern; extract to shared lib when a third caller arrives [src/app/api/admin/scoring/score-week/route.ts:13-17] — deferred, pre-existing
- [x] [Review][Defer] Team in multiple FINAL games causes silent map collision — `winnerByTeamId` overwrites silently if a teamId appears in two FINAL games in the same week; no guard or log [src/lib/scoring/score-nfl-week.ts:36-47] — deferred, pre-existing
- [x] [Review][Defer] FINAL game with null scores silently counted as `skipped` — a FINAL-status game with null homeScore/awayScore hits `continue` and increments `skipped`, indistinguishable from a not-yet-FINAL skip; no warning or distinct counter [src/lib/scoring/score-nfl-week.ts:37-39] — deferred, pre-existing
- [x] [Review][Defer] Read-then-write race: picks submitted between `findMany` and `$transaction` are invisible to the current scoring run and appear in neither `scored` nor `skipped` [src/lib/scoring/score-nfl-week.ts:50-61] — deferred, pre-existing

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5

### Debug Log References

- `npm run db:migrate` could not reach Neon DB (P1001); migration SQL created manually at `prisma/migrations/20260614120000_pick_outcome/migration.sql`
- `npm run lint` reports 2 pre-existing errors in `AdminPickOverrideDialog.tsx` (unrelated to this story)
- Fixed `finalizedAt?: Date | null` type in `result/route.ts` (build blocker surfaced during story close)

### Completion Notes List

- Added `PickOutcome` enum and scoring columns (`outcome`, `pointsEarned`, `scoredAt`) on `Pick` model with migration
- Implemented pure `scorePickOutcome` helper (1pt win, 2pt anti-jailed win, 0pt loss/tie) with 6 unit tests
- Extracted shared `readJsonObject` to `src/lib/request-utils.ts`; updated sync-results and result routes
- Implemented `scoreNflWeek` orchestration: loads FINAL games, builds winner map, scores picks in transaction; 8 mocked-Prisma tests
- Added `POST /api/admin/scoring/score-week` with dual auth, required `weekNumber`, optional `nflSeasonYear` default
- All 269 tests pass; `npm run build` passes

### File List

- prisma/schema.prisma (modified)
- prisma/migrations/20260614120000_pick_outcome/migration.sql (new)
- src/lib/domain/scoring.ts (modified)
- src/lib/domain/scoring.test.ts (modified)
- src/lib/request-utils.ts (new)
- src/lib/scoring/score-nfl-week.ts (new)
- src/lib/scoring/score-nfl-week.test.ts (new)
- src/app/api/admin/scoring/score-week/route.ts (new)
- src/app/api/admin/nfl/sync-results/route.ts (modified)
- src/app/api/admin/nfl/games/[gameId]/result/route.ts (modified)

### Change Log

- 2026-06-14: Story 5.2 — weekly pick scoring (PickOutcome schema, scorePickOutcome, scoreNflWeek job, admin score-week API, readJsonObject extraction)
