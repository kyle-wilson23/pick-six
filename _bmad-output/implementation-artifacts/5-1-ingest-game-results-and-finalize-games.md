# Story 5.1: Ingest game results and finalize games

Status: done

## Story

As the system,
I want game outcomes recorded after completion,
So that picks can be scored (**FR41**, **NFR35**).

## Acceptance Criteria

### AC1 — Schema extends `NflGame` with result fields

**Given** `prisma/schema.prisma` and migrations applied

**Then** a new `NflGameStatus` enum exists:
```
SCHEDULED   // game not yet kicked off (default)
IN_PROGRESS // game actively in play
FINAL       // game ended; scores are authoritative
CANCELLED   // game cancelled or postponed
```

**And** `NflGame` gains four new columns:
- `status NflGameStatus @default(SCHEDULED) @map("status")`
- `homeScore Int? @map("home_score")`
- `awayScore Int? @map("away_score")`
- `finalizedAt DateTime? @map("finalized_at") @db.Timestamptz`

**And** `NflWeekJailedTeam`, `Pick`, `NflGameOddsLine`, and all other tables are unaffected (no FK changes)

**And** `npm run db:migrate` applies cleanly in dev; the production deploy command is `npm run db:migrate:deploy`

---

### AC2 — API-Sports result sync endpoint

**Given** `POST /api/admin/nfl/sync-results` with body `{ "nflSeasonYear": 2026, "weekNumber": 1 }`  
*(weekNumber is optional; when omitted, syncs all weeks for the season that have any completed game)*

**When** API-Sports returns game rows for the requested season/week

**Then** for each row where `game.status.short === "FT"` (Finished/Final):
- `NflGame.status` → `FINAL`
- `NflGame.homeScore` → `scores.home.total` (integer)
- `NflGame.awayScore` → `scores.away.total` (integer)
- `NflGame.finalizedAt` → set to `now()` on **first** transition to FINAL; not overwritten on subsequent syncs for that game

**And** for rows where `status.short` is an in-progress code (`Q1`, `Q2`, `HT`, `Q3`, `Q4`, `OT`, `P`):
- `NflGame.status` → `IN_PROGRESS`
- scores updated if present (partial score is useful but not authoritative)
- `NflGame.finalizedAt` → NOT set (remains null until FINAL)

**And** for rows where `status.short === "NS"` (Not Started):
- `NflGame.status` → `SCHEDULED` (no-op if already SCHEDULED)
- scores not touched

**And** games matched by the same natural key as schedule sync: `(nflSeasonYear, weekNumber, homeTeamId, awayTeamId)`

**And** provider rows that cannot be matched to an `NflGame` by team names are **logged with structured error** (`action: "nfl_results_sync_match_failure"`) and skipped — they do not abort the whole sync

**And** the response body is `{ "nflSeasonYear": 2026, "weekNumber": 1 | null, "synced": N }` on success

---

### AC3 — Sync is idempotent

**Given** a game already in `FINAL` state with `homeScore` and `awayScore`

**When** `sync-results` runs again for the same season/week and the provider still reports `"FT"` with the same scores

**Then** the `NflGame` row is updated to the same values (safe to run twice), `finalizedAt` is NOT overwritten

**And** running sync twice produces no duplicate rows, no orphaned picks, no broken FKs

---

### AC4 — Manual result override endpoint

**Given** `PATCH /api/admin/nfl/games/[gameId]/result` with body:
```json
{ "homeScore": 27, "awayScore": 20, "status": "FINAL" }
```

**When** called by a valid league admin session (same `assertAuthorizedForNflOddsOps` check)

**Then** `NflGame` is updated: `status`, `homeScore`, `awayScore`; `finalizedAt` set to `now()` if transitioning to `FINAL` (or left unchanged if already `FINAL` from a prior override)

**And** `status: "SCHEDULED"` or `"IN_PROGRESS"` with non-null scores is accepted (for recording partial progress)

**And** `status: "FINAL"` with `homeScore` or `awayScore` missing → `400 VALIDATION_ERROR`

**And** negative scores → `400 VALIDATION_ERROR`

**And** `status: "CANCELLED"` with any scores is accepted (scores ignored — set to null)

**And** unauthenticated or non-admin request → `401`/`403`

---

### AC5 — Pure domain helper for winner determination

**Given** `src/lib/domain/scoring.ts` exports `getGameWinner`

**When** called with a FINAL game's `{ homeTeamId, awayTeamId, homeScore, awayScore }` (both scores are non-null integers)

**Then** returns one of:
- `{ kind: "win"; winnerId: string; loserId: string }` — when scores differ
- `{ kind: "tie"; teamIds: [string, string] }` — when scores are equal (NFL regular season tie possible since 2012)

**And** throws `Error("getGameWinner requires non-null scores")` if either score is null (caller must gate on FINAL status before calling)

---

### AC6 — Auth and secrets

**Given** `docs/project-context.md` non-negotiable #1

**Then** `API_SPORTS_KEY` stays server-only (already in `.env.example` — no new env vars needed)

**And** `POST /api/admin/nfl/sync-results` accepts `Authorization: Bearer ODDS_SNAPSHOT_SECRET` (automation/cron) **or** a league admin browser session — same dual-auth pattern as `POST /api/admin/nfl/sync-schedule`

**And** `PATCH /api/admin/nfl/games/[gameId]/result` requires an authenticated league admin session (no bearer-token bypass needed for manual override)

---

### AC7 — Tests: no live network in default `npm test`

**Given** `npm test` runs in CI

**Then** the following new test files pass:

- **`src/lib/domain/scoring.test.ts`** — unit tests for `getGameWinner`:
  - home team wins (homeScore > awayScore)
  - away team wins (awayScore > homeScore)
  - tie (homeScore === awayScore)
  - throws on null scores

- **`src/lib/integrations/api-sports-nfl/map-results.test.ts`** — fixture-based tests:
  - `"FT"` game row maps to `{ status: "FINAL", homeScore, awayScore }`
  - `"Q3"` game row maps to `{ status: "IN_PROGRESS", homeScore, awayScore }`
  - `"NS"` game row maps to `{ status: "SCHEDULED" }` with no scores
  - unrecognized `status.short` value maps to `IN_PROGRESS` (conservative — do not block the record)
  - team match failure returns structured error (no throw)

- **`src/lib/nfl/sync-nfl-results.test.ts`** — upsert logic with mocked prisma:
  - FINAL game updates all four result fields, does not overwrite `finalizedAt` on second call
  - IN_PROGRESS game updates status and scores, leaves `finalizedAt` null
  - already-FINAL game: re-running with same FT data produces same row (idempotent)
  - provider match failure for one game: logs error, skips game, continues to update others

**And** no live HTTP calls in any of these tests (fixtures only)

---

## Dev Notes

### Why these schema columns on `NflGame`, not a separate `NflGameResult` model

`NflGame` already carries global, non-league-scoped facts (`kickoffAt`, team FKs). Scores are equally global and stable once FINAL. Adding columns avoids a join every time scoring or leaderboard queries need result data. A separate model adds relationship complexity for no benefit at MVP scale.

### `finalizedAt` semantics — only set on first FINAL transition

`finalizedAt` records when the system first recognized a game as complete. It is NOT a `updatedAt` mirror. The implementation must check "is the current DB status already FINAL?" before setting `finalizedAt`:
```ts
// Pseudocode in sync-nfl-results.ts
const currentGame = await prisma.nflGame.findUnique({ ... });
const shouldSetFinalizedAt = currentGame?.status !== "FINAL" && newStatus === "FINAL";
await prisma.nflGame.update({
  ...
  data: {
    status: newStatus,
    homeScore,
    awayScore,
    ...(shouldSetFinalizedAt ? { finalizedAt: new Date() } : {}),
  }
});
```
This is important: `finalizedAt` is the temporal anchor for "when did we learn this game was over" — useful for audit, not to be clobbered on re-syncs.

### API-Sports status code mapping

API-Sports American Football `/games` returns `game.status.short` with these documented codes:
- `"NS"` → Not Started → map to `SCHEDULED`
- `"Q1"`, `"Q2"`, `"HT"`, `"Q3"`, `"Q4"`, `"OT"`, `"P"` → active play → map to `IN_PROGRESS`
- `"FT"` → Final/Finished → map to `FINAL`
- `"POST"` → Postponed → map to `CANCELLED`
- `"CANC"` → Cancelled → map to `CANCELLED`
- Unknown/unrecognized value → map to `IN_PROGRESS` conservatively (do not block record)

The API-Sports `scores` field:
- `scores.home.total` — integer or null (null before game starts)
- `scores.away.total` — integer or null

The existing `apiSportsGameRowSchema` in `src/lib/integrations/api-sports-nfl/schemas.ts` must be **extended** (not replaced) to include these optional fields:
```ts
// Add to apiSportsGameNestedSchema:
status: z
  .object({
    short: z.string().optional(),
    long: z.string().optional(),
  })
  .optional(),

// Add to apiSportsGameRowSchema:
scores: z
  .object({
    home: z.object({ total: z.number().nullable().optional() }).optional(),
    away: z.object({ total: z.number().nullable().optional() }).optional(),
  })
  .optional(),
```

Use `.passthrough()` / `.optional()` liberally — the schema is already described as intentionally permissive (per Story 3.9 deferred work). The mapping layer handles interpretation.

### Reuse `fetchNflGamesForSeason` from API-Sports client

The same API-Sports `/games` endpoint returns both schedule AND scores for any game. The existing `fetchNflGamesForSeason(apiKey, nflSeasonYear)` client function fetches the full season — reuse it in `sync-nfl-results.ts`. For a single-week sync (`weekNumber` provided), call the same endpoint and filter client-side, **or** add a `weekNumber` parameter to the client if quota is a concern (one `/games?league=1&season=Y&week=N` call per sync vs. one full-season call). Decision: start with the full-season call + client-side filter (reuses existing client, minimizes new code). Document the quota note.

### New files vs. modified files

**New files:**
- `src/lib/integrations/api-sports-nfl/map-results.ts` — maps provider rows to `NflGameResultUpsert[]`; co-locates with `map-schedule.ts` (same pattern)
- `src/lib/integrations/api-sports-nfl/map-results.test.ts`
- `src/lib/domain/scoring.ts` — starts with `getGameWinner`; this file will grow in Story 5.2 (scoring job)
- `src/lib/domain/scoring.test.ts`
- `src/lib/nfl/sync-nfl-results.ts` — orchestration (mirrors `sync-nfl-schedule.ts` structure)
- `src/lib/nfl/sync-nfl-results.test.ts`
- `src/app/api/admin/nfl/sync-results/route.ts`
- `src/app/api/admin/nfl/games/[gameId]/result/route.ts`

**Modified files:**
- `prisma/schema.prisma` — add `NflGameStatus` enum + four columns to `NflGame`
- `src/lib/integrations/api-sports-nfl/schemas.ts` — extend with `status` and `scores` optional fields

**New migration:**
- `prisma/migrations/[timestamp]_nfl_game_results/migration.sql`
  - `CREATE TYPE "nfl_game_status" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'FINAL', 'CANCELLED');`
  - `ALTER TABLE "nfl_games" ADD COLUMN "status" "nfl_game_status" NOT NULL DEFAULT 'SCHEDULED';`
  - `ALTER TABLE "nfl_games" ADD COLUMN "home_score" INTEGER;`
  - `ALTER TABLE "nfl_games" ADD COLUMN "away_score" INTEGER;`
  - `ALTER TABLE "nfl_games" ADD COLUMN "finalized_at" TIMESTAMPTZ;`
  - Index: `CREATE INDEX "idx_nfl_games_status_week" ON "nfl_games"("nfl_season_year", "week_number", "status");` — scoring and standings queries will filter by FINAL status

### `sync-nfl-results.ts` result type

Follow the exact same result union type pattern as `sync-nfl-schedule.ts`:
```ts
export type SyncNflResultsResult =
  | { ok: true; synced: number; skipped: number }
  | { ok: false; code: string; message: string; httpStatus: number };
```
`skipped` = rows that couldn't be matched to an `NflGame` by team names (useful for debugging).

### Manual override route: `PATCH /api/admin/nfl/games/[gameId]/result`

Body schema:
```ts
const bodySchema = z.object({
  homeScore: z.number().int().min(0).optional(),
  awayScore: z.number().int().min(0).optional(),
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "FINAL", "CANCELLED"]),
}).refine(
  (d) => d.status !== "FINAL" || (d.homeScore != null && d.awayScore != null),
  { message: "homeScore and awayScore are required when status is FINAL" }
);
```

Auth: `assertCookieSessionMutationOrigin` + `assertAuthorizedForNflOddsOps` (same as odds routes — league admin session required, no bearer bypass needed).

Route handler follows the `PATCH /api/admin/nfl/games/[gameId]/odds-line` pattern from Story 3.2.

### Do NOT build in Story 5.1

- **No scoring calculation** (Story 5.2) — do not touch `Pick` rows or compute points here
- **No leaderboard or standings page** (Story 5.4) — backend only in this story
- **No cron scheduling** (Epic 6) — admin-triggered sync only for now
- **No UI in the settings panel** — API surface only; admin uses curl/scripts for now; Story 5.2 or a later story can add UI affordances
- **No `Pick` model changes** — `Pick` gains no result or points column in this story

### `getGameWinner` usage by Story 5.2

Story 5.2 will import `getGameWinner` from `src/lib/domain/scoring.ts` to determine, for each `FINAL` game, which team won and whether it was a tie. Design the function signature to be easily extensible:
```ts
export type GameWinnerResult =
  | { kind: "win"; winnerId: string; loserId: string }
  | { kind: "tie"; teamIds: [string, string] };

export function getGameWinner(game: {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
}): GameWinnerResult
```

### Existing pick-deadline.ts is unaffected

This story adds columns to `NflGame` but does not change the deadline enforcement logic in `src/lib/domain/pick-deadline.ts`. The deadline uses `kickoffAt` and `THURSDAY_LOCK_HOUR`/`THURSDAY_LOCK_MINUTE` constants — unrelated to game result columns.

### No rate-limit change in `src/proxy.ts`

`POST /api/admin/nfl/sync-results` is an admin-only endpoint with the same risk profile as `sync-schedule`. The project context says new high-risk mutators go in `proxy.ts`, but admin NFL data endpoints are already gated by `assertAuthorizedForNflOddsOps` (admin-only). No new sliding window needed; confirm `proxy.ts` already covers or is not required for this category before touching it. Do not add unnecessary rate-limit entries.

### Epic 5 prerequisite status

Both pre-epic-5 blocking items are **done**:
- `pre-epic-5-fix-jailed-lineup-bonus-bug`: ✅ done (2026-06-11)
- `pre-epic-5-thursday-lockout-constant`: ✅ done (2026-06-11)

No deferred-work items from prior epics are blocking Story 5.1. The three deferred items from Story 3.3 (per-stage survivors, transactional jailed compute, picks-lock guard) are Epic 3 technical debt, not Epic 5 prerequisites.

### Test fixture file

Create `src/lib/integrations/api-sports-nfl/fixtures/nfl-results-sample.json` following the pattern of the existing odds API fixture. Include at least three game rows:
1. A `"FT"` (Final) game with scores — both teams matched
2. A `"Q3"` (In Progress) game with partial scores
3. A `"NS"` (Not Started) game with null scores

This fixture is used in `map-results.test.ts` and can be reused in `sync-nfl-results.test.ts`.

### Previous story patterns to follow

Relevant patterns from Epic 3–4 implementation:
- **`sync-nfl-schedule.ts`**: full-season fetch → team lookup → map rows → `prisma.$transaction` upsert loop — follow exactly
- **`snapshot-nfl-week-odds.ts`**: similar pattern for week-scoped operations
- **`src/app/api/admin/nfl/sync-schedule/route.ts`**: dual-auth (bearer + session), Zod body parse, structured error response — copy this structure verbatim for `sync-results`
- **`src/app/api/admin/nfl/games/[gameId]/odds-line/route.ts`**: dynamic route with `gameId`, PATCH body validation — follow for `result` route
- **`src/lib/nfl/authorize-odds-admin.ts`**: `assertAuthorizedForNflOddsOps` — import directly, do not re-implement

### Git intelligence — recent patterns (last 5 commits)

- `99f4d60 refactor(domain): extract Thursday lockout constants` — pure refactor; confirms naming convention `SCREAMING_SNAKE` for domain constants
- `ee2ad8f fix(domain): gate jailed opponent lookup on antiJailedBonus` — confirms test-first approach for domain logic, message strings in picks.ts
- `fd123ea feat(admin): Story 4.4 jailed team verification view` — admin panel pattern; RSC page + `getJailedVerification` lib function; establishes "verify automation" UI pattern
- `f1fe57d feat(admin): Story 4.3 immutable audit trail` — audit log pattern; server-side only, no client component for display
- `73fb5ec feat(admin): Story 4.2 admin pick override` — `submitPickOnBehalf` pattern, `assertCookieSessionMutationOrigin`

### Deferred work items that may be worth addressing opportunistically (low-risk)

From `_bmad-output/implementation-artifacts/deferred-work.md` — these are **not required** for Story 5.1 acceptance criteria, but if the dev agent encounters them while touching the same files, brief fixes are welcome:
- **Magic `0` for seconds in `pick-deadline.ts`** (deferred from pre-epic-5 code review) — if `pick-deadline.ts` is touched for any reason, extract `THURSDAY_LOCK_SECOND = 0`. However, Story 5.1 should not need to touch `pick-deadline.ts` at all. **Do not address.**
- **`gamesWithKickoff` type-narrowing** in picks route (deferred from 3.5) — if the picks route is touched. Story 5.1 does not touch it. **Do not address.**

Keep Story 5.1 scope tight: schema + provider sync + domain helper + tests. Do not expand into deferred items.

---

## Tasks / Subtasks

- [x] **Prisma schema + migration** (AC1)
  - [x] Add `NflGameStatus` enum with four values to `prisma/schema.prisma`
  - [x] Add `status`, `homeScore`, `awayScore`, `finalizedAt` columns to `NflGame` model
  - [x] Run `npm run db:migrate` — generates migration SQL; verify migration applies cleanly
  - [x] Add composite index `@@index([nflSeasonYear, weekNumber, status])` to `NflGame` for scoring/standings queries

- [x] **Extend API-Sports schemas** (AC2, AC7)
  - [x] Add `status` object (`short?`, `long?`) to `apiSportsGameNestedSchema` in `src/lib/integrations/api-sports-nfl/schemas.ts`
  - [x] Add `scores` object (`home.total?`, `away.total?`) to `apiSportsGameRowSchema`
  - [x] Verify `schemas.test.ts` still passes (no breaking change — additive only)

- [x] **`map-results.ts` and fixture** (AC2, AC7)
  - [x] Create `src/lib/integrations/api-sports-nfl/fixtures/nfl-results-sample.json` with FT / Q3 / NS examples
  - [x] Create `src/lib/integrations/api-sports-nfl/map-results.ts`: function `mapApiSportsRowsToResultUpdates` returning `NflGameResultUpdate[]` and structured errors for unmatched rows
  - [x] Create `src/lib/integrations/api-sports-nfl/map-results.test.ts` with fixture-based tests (AC7 test cases)

- [x] **`scoring.ts` domain helper** (AC5, AC7)
  - [x] Create `src/lib/domain/scoring.ts` with `getGameWinner` function and `GameWinnerResult` type
  - [x] Create `src/lib/domain/scoring.test.ts` with four test cases (home win, away win, tie, null scores throws)

- [x] **`sync-nfl-results.ts`** (AC2, AC3, AC7)
  - [x] Create `src/lib/nfl/sync-nfl-results.ts` with `syncNflResultsFromApiSports(prisma, opts)` function
  - [x] Implement `finalizedAt` idempotency: read current status before upsert; only set `finalizedAt` on first FINAL transition
  - [x] Log structured errors for unmatched provider rows; continue processing remaining rows
  - [x] Create `src/lib/nfl/sync-nfl-results.test.ts` with mocked prisma (AC7 test cases)

- [x] **`POST /api/admin/nfl/sync-results/route.ts`** (AC2, AC6)
  - [x] Create route at `src/app/api/admin/nfl/sync-results/route.ts`
  - [x] Body schema: `{ nflSeasonYear?: number (default getCurrentNflSeasonYear()), weekNumber?: number (1–18) }`
  - [x] Dual-auth: bearer `ODDS_SNAPSHOT_SECRET` or admin session (`assertAuthorizedForNflOddsOps`)
  - [x] Check `API_SPORTS_KEY` set; return `503` with `API_SPORTS_NOT_CONFIGURED` if missing
  - [x] Return `{ nflSeasonYear, weekNumber: number | null, synced: N, skipped: M }` on success

- [x] **`PATCH /api/admin/nfl/games/[gameId]/result/route.ts`** (AC4)
  - [x] Create route at `src/app/api/admin/nfl/games/[gameId]/result/route.ts`
  - [x] Zod body schema with FINAL + scores required refinement, CANCELLED nulls scores
  - [x] Admin session auth only (no bearer bypass)
  - [x] Return updated `NflGame` row fields on success

- [x] **`npm test` green; `npm run lint`; `npm run build`** before closing

---

## Dev Agent Record

### Implementation Plan

1. Extended `NflGame` with `NflGameStatus` enum and result columns; migration `20260611120000_nfl_game_results`.
2. Extended API-Sports Zod schemas with optional `status` and `scores`; added `map-results.ts` mirroring schedule mapping (team lookup, status code mapping, skip-on-match-failure).
3. `sync-nfl-results.ts` reuses full-season fetch, filters by week or completed-week scope, updates existing games by natural key with `finalizedAt` only on first FINAL transition.
4. API routes: `POST sync-results` (dual-auth like sync-schedule), `PATCH games/[gameId]/result` (admin session only).
5. `getGameWinner` pure helper in `domain/scoring.ts` for Story 5.2.

### Completion Notes

- All 251 tests pass (`npm test`).
- `npm run build` succeeds.
- `npm run lint` reports 2 pre-existing errors in `AdminPickOverrideDialog.tsx` (not touched in this story).
- No frontend UI added per story scope (API-only).

## File List

- prisma/schema.prisma
- prisma/migrations/20260611120000_nfl_game_results/migration.sql
- src/lib/integrations/api-sports-nfl/schemas.ts
- src/lib/integrations/api-sports-nfl/fixtures/nfl-results-sample.json
- src/lib/integrations/api-sports-nfl/map-results.ts
- src/lib/integrations/api-sports-nfl/map-results.test.ts
- src/lib/domain/scoring.ts
- src/lib/domain/scoring.test.ts
- src/lib/nfl/sync-nfl-results.ts
- src/lib/nfl/sync-nfl-results.test.ts
- src/app/api/admin/nfl/sync-results/route.ts
- src/app/api/admin/nfl/games/[gameId]/result/route.ts

### Review Findings

- [x] [Review][Patch] Clear `finalizedAt` when status is set to `CANCELLED` — on CANCELLED transition, set `finalizedAt = null`; a cancelled game was never finalized. [`src/app/api/admin/nfl/games/[gameId]/result/route.ts`]
- [x] [Review][Patch] Clear `finalizedAt` when demoting away from `FINAL` — on any transition from `FINAL` to a non-FINAL status via PATCH, set `finalizedAt = null`; it will be re-set naturally on the next FINAL transition. [`src/app/api/admin/nfl/games/[gameId]/result/route.ts`]
- [x] [Review][Patch] PATCH /result accepts bearer token via `assertAuthorizedForNflOddsOps` — AC6 requires admin session only (no bearer bypass); `assertAuthorizedForNflOddsOps` internally grants access to valid bearer tokens, so a cron request with `Authorization: Bearer ODDS_SNAPSHOT_SECRET` + same-origin `Origin` header bypasses the admin-session gate. Fix: add bearer rejection at the top of the PATCH handler before auth. [`src/app/api/admin/nfl/games/[gameId]/result/route.ts`]
- [x] [Review][Patch] Null provider scores overwrite existing DB scores for IN_PROGRESS games — AC2 says "scores updated if present"; when the provider returns null scores for a `Q3` row, `parseScoreTotal` returns `null`, and `buildUpdateData` writes `homeScore: null` / `awayScore: null` (they are `!== undefined`), potentially zeroing previously-stored partial scores. Fix: only include score fields in the update when the mapped value is non-null. [`src/lib/integrations/api-sports-nfl/map-results.ts:100-108`]
- [x] [Review][Patch] Missing test for CANCELLED status in `map-results` — no test covered `POST`/`CANC` → `CANCELLED` with null scores, or IN_PROGRESS with null provider scores producing undefined score fields. [`src/lib/integrations/api-sports-nfl/map-results.test.ts`]
- [x] [Review][Patch] Missing test for season-wide sync (weekNumber omitted) — all `sync-nfl-results.test.ts` tests passed explicit `weekNumber: 1`; no test exercised the `weekNumber`-omitted path that computes `completedWeeks` and filters accordingly. [`src/lib/nfl/sync-nfl-results.test.ts`]
- [x] [Review][Defer] N+1 queries in sync transaction — `sync-nfl-results.ts` issues per-game `findUnique` + `update` inside a single transaction (up to ~288 calls for a full-season sync). Not a correctness issue but risks transaction timeout on large syncs. [`src/lib/nfl/sync-nfl-results.ts:93-128`] — deferred, pre-existing performance pattern
- [x] [Review][Defer] Duplicate `readJsonObject` helper in both route files — same 8-line function copied verbatim into `sync-results/route.ts` and `result/route.ts`. Extract to a shared request-utils helper when adding a third route. — deferred, pre-existing
- [x] [Review][Defer] NaN/Infinity not explicitly guarded in `getGameWinner` — `homeScore == null` does not catch `NaN`. TypeScript `number` types and the upstream `parseScoreTotal` (which filters via `!Number.isFinite`) provide sufficient protection at the call boundary; runtime risk is low. [`src/lib/domain/scoring.ts:15`] — deferred, pre-existing
- [x] [Review][Defer] `skipped` count conflates team-match failures with DB-not-found — the response `skipped` field counts both mapping-level errors (unknown teams) and DB-level misses (no matching `NflGame`). Minor metric imprecision. — deferred, pre-existing

## Change Log

- 2026-06-11: Story created for Epic 5, Story 1 — game result ingestion foundation
- 2026-06-11: Implemented schema, provider sync, manual override API, domain helper, and tests (Story 5.1)
- 2026-06-11: Code review complete — all 6 patches applied (2 decisions resolved → patches), 4 deferred, 9 dismissed; 255 tests green
