# Story 5.3: MNF Completion and Tuesday Standings Update

Status: done

## Story

As a participant,
I want standings to update after Monday Night Football for the prior week,
So that Tuesday email and UI show correct standings (**FR43**, **FR45**, **NFR36**).

## Acceptance Criteria

### AC1 — Pure helper: `isWeekFullyFinalized`

**Given** `src/lib/scoring/finalize-nfl-week.ts` exports `isWeekFullyFinalized`

**When** called with an array of `{ status: NflGameStatus }` objects for a week

**Then** returns `true` when every game has `status === "FINAL"` OR `status === "CANCELLED"`

**And** returns `false` when any game has `status === "SCHEDULED"` or `"IN_PROGRESS"`

**And** returns `true` for an empty array (vacuously — no games to wait for; scoring will produce 0 scored picks)

**And** the function is pure (no I/O)

---

### AC2 — Orchestrator: `finalizeNflWeek`

**Given** `src/lib/scoring/finalize-nfl-week.ts` exports `finalizeNflWeek(prisma, { nflSeasonYear, weekNumber })`

**When** called for a season year and week number

**Then** the function:
1. Loads all `NflGame` rows for `(nflSeasonYear, weekNumber)` — only fields needed: `status`
2. Calls `isWeekFullyFinalized` on the loaded games
3. **If NOT fully finalized:** returns immediately without scoring:
   ```ts
   { ok: true, allGamesFinalized: false, scored: 0, skipped: 0, finalCount: N, notFinalCount: M }
   ```
4. **If fully finalized:** calls `scoreNflWeek(prisma, { nflSeasonYear, weekNumber })` and returns:
   ```ts
   { ok: true, allGamesFinalized: true, scored: N, skipped: M, finalCount: N, notFinalCount: 0 }
   ```
5. **If `scoreNflWeek` returns `ok: false`:** propagates the error:
   ```ts
   { ok: false, code: result.code, message: result.message, httpStatus: result.httpStatus }
   ```
6. **If any unexpected error:** returns:
   ```ts
   { ok: false, code: "FINALIZE_ERROR", message: err.message, httpStatus: 500 }
   ```

**And** the function is idempotent — calling twice with the same data returns the same result (scoring is idempotent per Story 5.2)

**And** `finalCount` is the count of FINAL + CANCELLED games; `notFinalCount` is the count of SCHEDULED + IN_PROGRESS games

---

### AC3 — Admin endpoint: `POST /api/admin/scoring/finalize-week`

**Given** `POST /api/admin/scoring/finalize-week` with body `{ "nflSeasonYear": 2026, "weekNumber": 3 }`

**When** called by a bearer token (`ODDS_SNAPSHOT_SECRET`) **or** a valid league admin session

**Then** the finalization orchestrator runs and returns:
```json
{ "nflSeasonYear": 2026, "weekNumber": 3, "allGamesFinalized": true, "finalCount": 16, "notFinalCount": 0, "scored": 14, "skipped": 2 }
```

**Or** if not all games FINAL yet:
```json
{ "nflSeasonYear": 2026, "weekNumber": 3, "allGamesFinalized": false, "finalCount": 14, "notFinalCount": 2, "scored": 0, "skipped": 0 }
```

**And** `nflSeasonYear` defaults to `getCurrentNflSeasonYear()` if omitted; `weekNumber` is **required**

**And** `weekNumber` missing or null → `400 VALIDATION_ERROR` with `"weekNumber is required"`

**And** `weekNumber` outside `1–18` → `400 VALIDATION_ERROR`

**And** unauthenticated or non-admin request (no valid bearer, no admin session) → `401`/`403`

---

### AC4 — Extract `isOddsAutomationRequest` to shared helper (deferred from 5.2)

**Given** `isOddsAutomationRequest` is currently duplicated verbatim in:
- `src/app/api/admin/nfl/sync-results/route.ts`
- `src/app/api/admin/scoring/score-week/route.ts`

**And** `finalize-week/route.ts` would be a third copy

**Then** extract it to `src/lib/nfl/authorize-odds-admin.ts` as a named export: `isOddsAutomationRequest(request: NextRequest): boolean`

**And** update `sync-results/route.ts` and `score-week/route.ts` to import from `authorize-odds-admin.ts` (removing their local definitions)

**And** `finalize-week/route.ts` imports from `authorize-odds-admin.ts` from the start (never duplicated)

**And** `npm test` still passes after the refactor

---

### AC5 — Tests: no live network in default `npm test`

**Given** `npm test` runs in CI

**Then** the following test files pass:

- **`src/lib/scoring/finalize-nfl-week.test.ts`** — covering:
  - `isWeekFullyFinalized`:
    - All games FINAL → `true`
    - All games CANCELLED → `true`
    - Mixed FINAL + CANCELLED → `true`
    - Any game IN_PROGRESS → `false`
    - Any game SCHEDULED → `false`
    - Empty array → `true`
  - `finalizeNflWeek` (mocked Prisma + mocked `scoreNflWeek`):
    - Not all games finalized → returns `{ ok: true, allGamesFinalized: false, scored: 0, skipped: 0 }`, `scoreNflWeek` never called
    - All games finalized → calls `scoreNflWeek`, returns `{ ok: true, allGamesFinalized: true, scored: N, skipped: M }`
    - No games in DB for week → `isWeekFullyFinalized` returns `true`, `scoreNflWeek` called with 0 results
    - `scoreNflWeek` returns `ok: false` → `finalizeNflWeek` returns propagated error
    - Idempotent re-run → same result both times

**And** no live HTTP calls or real DB connections in these tests

---

## Dev Notes

### Context from Story 5.1 and 5.2

Story 5.1 shipped:
- `src/lib/nfl/sync-nfl-results.ts` — syncs API-Sports results into `NflGame` (sets `status`, `homeScore`, `awayScore`, `finalizedAt`)
- `src/app/api/admin/nfl/sync-results/route.ts` — dual-auth admin endpoint to trigger sync
- `getGameWinner` in `src/lib/domain/scoring.ts`

Story 5.2 shipped:
- `src/lib/scoring/score-nfl-week.ts` — `scoreNflWeek(prisma, opts)` — idempotent per-pick scoring via `prisma.$transaction`
- `src/app/api/admin/scoring/score-week/route.ts` — raw scoring endpoint (score a specific week's picks)
- `PickOutcome` enum + `outcome`, `pointsEarned`, `scoredAt` columns on `Pick`
- `src/lib/request-utils.ts` — shared `readJsonObject`

Story 5.3 adds the **orchestration layer** that sits on top of 5.2's scoring primitive: detect whether all games in a week are resolved, and only then invoke scoring. This is the "Tuesday finalization" workflow — admin triggers it after MNF, the system checks game status and runs scoring if the week is complete.

### Why a separate "finalize" endpoint vs. just "score-week"?

The `score-week` endpoint (5.2) is a raw primitive: it scores whatever FINAL games exist and skips the rest. An admin calling it before all games are done gets a partial result silently — this is correct behavior for re-runs but confusing as a "Tuesday finalization" operation.

`finalize-week` adds the explicit gate: "Are all games done? If not, tell me and stop. If yes, run scoring." This makes the weekly admin workflow unambiguous:
1. After MNF (or any time), call `POST /api/admin/nfl/sync-results` to pull latest game results
2. Call `POST /api/admin/scoring/finalize-week` — either it tells you "still 2 games in progress" or it runs scoring and the week is done

### MNF completion detection

The `isWeekFullyFinalized` function checks all games for a week, not just Monday games. This is intentional: the correct trigger for "standings are ready" is when ALL games (Sun, Mon, and any Sat/Thu/Tue TNF specials) are FINAL. Checking only Monday games would miss postponed games or special-schedule weeks.

**CANCELLED handling:** A CANCELLED game (e.g. postponed/forfeited game with no result) counts as "finalized" for week-completion purposes. Picks for a CANCELLED game's teams are already skipped by `scoreNflWeek` (the team never appears in the winner map), so there is nothing to wait for.

**Empty week:** If no games exist in DB for a given season/week, `isWeekFullyFinalized` returns `true` (vacuously). `finalizeNflWeek` then calls `scoreNflWeek` which immediately returns `{ ok: true, scored: 0, skipped: 0 }`. This is the correct behavior — do not error on missing data.

### `FinalizeNflWeekResult` type

```ts
// src/lib/scoring/finalize-nfl-week.ts

export type FinalizeNflWeekResult =
  | {
      ok: true;
      allGamesFinalized: boolean;
      finalCount: number;
      notFinalCount: number;
      scored: number;
      skipped: number;
    }
  | { ok: false; code: string; message: string; httpStatus: number };
```

Follow the exact same `{ ok: true } | { ok: false }` union pattern established by `ScoreNflWeekResult` in `score-nfl-week.ts` and `SyncNflResultsResult` in `sync-nfl-results.ts`.

### `isWeekFullyFinalized` signature

```ts
import type { NflGameStatus } from "@prisma/client";

export function isWeekFullyFinalized(
  games: Array<{ status: NflGameStatus }>,
): boolean {
  return games.every(
    (g) => g.status === "FINAL" || g.status === "CANCELLED",
  );
}
```

### `finalizeNflWeek` pseudocode

```ts
export async function finalizeNflWeek(
  prisma: PrismaClient,
  opts: { nflSeasonYear: number; weekNumber: number },
): Promise<FinalizeNflWeekResult> {
  try {
    const games = await prisma.nflGame.findMany({
      where: { nflSeasonYear: opts.nflSeasonYear, weekNumber: opts.weekNumber },
      select: { status: true },
    });

    const finalCount = games.filter(
      (g) => g.status === "FINAL" || g.status === "CANCELLED",
    ).length;
    const notFinalCount = games.length - finalCount;

    if (!isWeekFullyFinalized(games)) {
      return { ok: true, allGamesFinalized: false, finalCount, notFinalCount, scored: 0, skipped: 0 };
    }

    const result = await scoreNflWeek(prisma, opts);
    if (!result.ok) {
      return { ok: false, code: result.code, message: result.message, httpStatus: result.httpStatus };
    }

    return { ok: true, allGamesFinalized: true, finalCount, notFinalCount: 0, scored: result.scored, skipped: result.skipped };
  } catch (err) {
    return {
      ok: false,
      code: "FINALIZE_ERROR",
      message: err instanceof Error ? err.message : String(err),
      httpStatus: 500,
    };
  }
}
```

### New files vs. modified files

**New files:**
- `src/lib/scoring/finalize-nfl-week.ts` — exports `isWeekFullyFinalized` + `finalizeNflWeek` + `FinalizeNflWeekResult`
- `src/lib/scoring/finalize-nfl-week.test.ts` — pure function tests + mocked-Prisma orchestration tests
- `src/app/api/admin/scoring/finalize-week/route.ts` — `POST` handler

**Modified files:**
- `src/lib/nfl/authorize-odds-admin.ts` — add exported `isOddsAutomationRequest` (AC4)
- `src/app/api/admin/nfl/sync-results/route.ts` — remove local `isOddsAutomationRequest`; import from `authorize-odds-admin.ts` (AC4)
- `src/app/api/admin/scoring/score-week/route.ts` — remove local `isOddsAutomationRequest`; import from `authorize-odds-admin.ts` (AC4)

**No schema change** — no new DB tables, columns, or enums. Standings are computed from `Pick.pointsEarned` (already set by 5.2). No "week finalized" flag needed in this story.

### API route structure

```
src/app/api/admin/scoring/finalize-week/route.ts
```

Auth pattern — copy the **exact same dual-auth block** from `score-week/route.ts`:

```ts
if (!isOddsAutomationRequest(request)) {
  const forbidden = assertCookieSessionMutationOrigin(request);
  if (forbidden) return forbidden;
}
const session = await auth();
const authz = await assertAuthorizedForNflOddsOps(request, session?.user?.id);
if (authz) return authz;
```

Body schema (Zod):
```ts
const bodySchema = z.object({
  nflSeasonYear: z.coerce.number().int().min(2020).max(2050).optional(),
  weekNumber: z.coerce.number().int().min(1).max(18),
});
```

`weekNumber` guard (exact same null/undefined check as `score-week/route.ts`):
```ts
if (!("weekNumber" in rawBody) || rawBody.weekNumber == null) {
  return NextResponse.json(
    { error: { code: "VALIDATION_ERROR", message: "weekNumber is required" } },
    { status: 400 },
  );
}
```

Success response shape:
```json
{
  "nflSeasonYear": 2026,
  "weekNumber": 3,
  "allGamesFinalized": true,
  "finalCount": 16,
  "notFinalCount": 0,
  "scored": 14,
  "skipped": 2
}
```

### Extracting `isOddsAutomationRequest` — AC4 implementation spec

**Add to `src/lib/nfl/authorize-odds-admin.ts`** (before or after `assertAuthorizedForNflOddsOps`):

```ts
/**
 * Returns true if the request carries the `ODDS_SNAPSHOT_SECRET` bearer token
 * (automation/cron callers). Used by admin NFL + scoring route handlers.
 */
export function isOddsAutomationRequest(request: NextRequest): boolean {
  const secret = process.env.ODDS_SNAPSHOT_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
```

**In `sync-results/route.ts` and `score-week/route.ts`:** delete the local `isOddsAutomationRequest` function definition; add `isOddsAutomationRequest` to the existing import from `@/lib/nfl/authorize-odds-admin`:
```ts
import { assertAuthorizedForNflOddsOps, isOddsAutomationRequest } from "@/lib/nfl/authorize-odds-admin";
```

No behavior change — just relocation.

### `getCurrentNflSeasonYear` — reuse existing helper

Same import used in `score-week/route.ts`:
```ts
import { getCurrentNflSeasonYear } from "@/lib/league/nfl-season";
```

Do not re-implement.

### Do NOT build in Story 5.3

- **No leaderboard UI** (Story 5.4)
- **No personal pick history UI** (Story 5.5)
- **No peer pick visibility / Tuesday reveal rules** (Story 5.6) — the `finalize-week` endpoint does NOT gate reveal; reveal rules live in 5.6
- **No cron scheduling** (Epic 6) — admin-triggered only for now
- **No admin UI** — API only; admin uses curl/scripts
- **No "week finalized" DB flag** — standings are derived from `Pick.pointsEarned` directly; the reveal gating concept belongs to 5.6
- **No sync-results call inside `finalizeNflWeek`** — the orchestrator checks game status from the DB; if game status is stale, admin should call `sync-results` first (two-step workflow; keep concerns separate)

### Story 5.2 learnings to carry forward

- **Result union types**: always `{ ok: true; ... } | { ok: false; code: string; message: string; httpStatus: number }` — same as `ScoreNflWeekResult`
- **Counters inside `$transaction`**: declare and return inside the transaction callback (not outer scope) to avoid double-counting on retry — per review finding in 5.2
- **No `ok: false` dead code**: if the function always `try/catch`, the `{ ok: false }` branch must genuinely be reachable (it is here via the propagated `scoreNflWeek` error and the top-level catch)
- **`weekNumber` null guard**: use `rawBody.weekNumber == null` (catches both `null` and `undefined`) before Zod parse — per review finding in 5.2
- **Test flat structure**: no `beforeEach` over-engineering; keep tests readable with direct `vi.fn()` mocks

### Git intelligence — recent commits
- `233acdc feat(scoring): Story 5.2 — weekly pick scoring with anti-jailed bonus` — established `ScoreNflWeekResult` union, `scoreNflWeek`, dual-auth `score-week` route, `readJsonObject` extraction pattern; **all patterns to copy here**
- `a6bd803 feat(nfl): Story 5.1 ingest game results and finalize games` — established `NflGameStatus` enum, result sync pattern, `getGameWinner`

### Test patterns established by prior stories

- **Pure functions**: `describe` + `it`; inputs/outputs only; no mocks — e.g. `isWeekFullyFinalized` tests
- **Orchestration with mocked Prisma**: `vi.fn()` stubs for `prisma.nflGame.findMany`; mock `scoreNflWeek` via module mock (or inject as dependency)
- **Module mock pattern** (for `scoreNflWeek` in `finalize-nfl-week.test.ts`):
  ```ts
  vi.mock("@/lib/scoring/score-nfl-week", () => ({
    scoreNflWeek: vi.fn(),
  }));
  import { scoreNflWeek } from "@/lib/scoring/score-nfl-week";
  ```
- **No `beforeEach` over-engineering** — keep each test self-contained; cast mocked functions with `vi.mocked()` for type safety

### Deferred-work items relevant to this story

**Actionable in Story 5.3:**
- **Duplicate `isOddsAutomationRequest`** (deferred from 5.2 code review): this story adds a third route that needs the same helper; extract now per AC4.

**Not blocking — leave deferred:**
- **No DB atomicity CHECK constraint on scoring columns** (5.2 deferred): no schema change in this story
- **No range CHECK on `points_earned`** (5.2 deferred): no schema change in this story
- **Read-then-write race in `scoreNflWeek`** (5.2 deferred): same pattern used here; acceptable at MVP scale

### Project context non-negotiables

- [ ] No `ODDS_SNAPSHOT_SECRET` or other secrets in client code or `NEXT_PUBLIC_*`
- [ ] Single Prisma client (`import { prisma } from "@/lib/db"`)
- [ ] Consistent JSON error shape: `{ "error": { "code": "…", "message": "…" } }`
- [ ] DB column names: `snake_case` via `@map("…")`; JSON keys: `camelCase`
- [ ] `weekNumber` validated as 1–18 at the API boundary (Zod)
- [ ] Route handler at `src/app/api/admin/scoring/finalize-week/route.ts` (no `/v1` prefix)
- [ ] `isOddsAutomationRequest` must NOT be in `NEXT_PUBLIC_*` context — server-only

---

## Tasks / Subtasks

- [x] **Extract `isOddsAutomationRequest` to shared helper** (AC4)
  - [x] Add `isOddsAutomationRequest` export to `src/lib/nfl/authorize-odds-admin.ts`
  - [x] Update `src/app/api/admin/nfl/sync-results/route.ts`: remove local definition; import from `authorize-odds-admin.ts`
  - [x] Update `src/app/api/admin/scoring/score-week/route.ts`: remove local definition; import from `authorize-odds-admin.ts`
  - [x] Verify `npm test` still passes after refactor

- [x] **`isWeekFullyFinalized` pure helper** (AC1, AC5)
  - [x] Create `src/lib/scoring/finalize-nfl-week.ts` with `isWeekFullyFinalized` and `FinalizeNflWeekResult` type
  - [x] Add unit tests in `src/lib/scoring/finalize-nfl-week.test.ts` covering all 6 `isWeekFullyFinalized` cases

- [x] **`finalizeNflWeek` orchestration** (AC2, AC5)
  - [x] Implement `finalizeNflWeek` in `src/lib/scoring/finalize-nfl-week.ts`
  - [x] Add orchestration tests in `src/lib/scoring/finalize-nfl-week.test.ts` (5 cases: not finalized, all finalized, no games, scoreNflWeek error, idempotent re-run)

- [x] **`POST /api/admin/scoring/finalize-week` route** (AC3)
  - [x] Create `src/app/api/admin/scoring/finalize-week/route.ts`
  - [x] Dual-auth: import `isOddsAutomationRequest` + `assertAuthorizedForNflOddsOps` from `authorize-odds-admin.ts`
  - [x] Zod body: `weekNumber` required (1–18), `nflSeasonYear` optional
  - [x] Return `{ nflSeasonYear, weekNumber, allGamesFinalized, finalCount, notFinalCount, scored, skipped }` on success

- [x] **`npm test` green; `npm run lint`; `npm run build`** before closing

### Review Findings

- [x] [Review][Defer] Timing-safe comparison on bearer token [`src/lib/nfl/authorize-odds-admin.ts:14`] — deferred, pre-existing (identical code existed in both original route copies; moved unchanged)
- [x] [Review][Defer] Unconditional `auth()` call for automation/bearer requests [`src/app/api/admin/scoring/finalize-week/route.ts:35`] — deferred, pre-existing from `score-week` pattern; harmless (`assertAuthorizedForNflOddsOps` short-circuits on bearer token before using userId)
- [x] [Review][Defer] No try/catch in route handler [`src/app/api/admin/scoring/finalize-week/route.ts`] — deferred, pre-existing from `score-week` pattern
- [x] [Review][Defer] `z.coerce.number()` accepts boolean `true` as week 1 [`src/app/api/admin/scoring/finalize-week/route.ts:17`] — deferred, pre-existing; `z.coerce` explicitly specified in dev notes
- [x] [Review][Defer] Authorization header trailing whitespace not trimmed in `isOddsAutomationRequest` [`src/lib/nfl/authorize-odds-admin.ts:14`] — deferred, pre-existing; moved unchanged from both original route copies
- [x] [Review][Defer] No DB transaction between game-status check and `scoreNflWeek` call [`src/lib/scoring/finalize-nfl-week.ts:33-54`] — deferred, same class as "Read-then-write race in `scoreNflWeek`" already deferred from 5.2
- [x] [Review][Defer] `weekNumber` max of 18 silently excludes NFL playoff weeks [`src/app/api/admin/scoring/finalize-week/route.ts:18`] — deferred, spec-specified value; product scope question for when playoffs are in scope
- [x] [Review][Defer] Non-object JSON body (array/null) silently coerced to `{}` producing generic "weekNumber is required" [`src/app/api/admin/scoring/finalize-week/route.ts:44-47`] — deferred, pre-existing from `score-week` pattern

---

## Dev Agent Record

### Agent Model Used

Composer (Cursor)

### Debug Log References

_None_

### Completion Notes List

- Extracted `isOddsAutomationRequest` to `authorize-odds-admin.ts`; removed duplicate definitions from `sync-results` and `score-week` routes (AC4).
- Added `isWeekFullyFinalized` pure helper and `FinalizeNflWeekResult` union type in `finalize-nfl-week.ts` (AC1).
- Implemented `finalizeNflWeek` orchestrator: loads week games, gates on full finalization, delegates to `scoreNflWeek` when ready (AC2).
- Added `POST /api/admin/scoring/finalize-week` with dual-auth, Zod validation, and success response shape per spec (AC3).
- Added 11 unit/orchestration tests in `finalize-nfl-week.test.ts` — all mocked, no live network (AC5).
- `npm test`: 280/280 pass. `npm run build`: success. Pre-existing lint errors in `AdminPickOverrideDialog.tsx` (unrelated to this story).

### File List

- `src/lib/nfl/authorize-odds-admin.ts` (modified)
- `src/app/api/admin/nfl/sync-results/route.ts` (modified)
- `src/app/api/admin/scoring/score-week/route.ts` (modified)
- `src/lib/scoring/finalize-nfl-week.ts` (new)
- `src/lib/scoring/finalize-nfl-week.test.ts` (new)
- `src/app/api/admin/scoring/finalize-week/route.ts` (new)

### Change Log

- 2026-06-14: Story 5.3 — MNF completion gate + Tuesday finalization orchestrator and admin endpoint.
