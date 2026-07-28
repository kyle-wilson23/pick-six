# Story 8.7: Delete Test League and Data Cleanup

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a league admin (or system operator),
I want to **delete a test/rehearsal league** when the dry run is finished and have **global rehearsal fixture leftovers cleaned up** when no other test leagues remain,
so that simulated data does not clutter the app or risk colliding with the real NFL season, and we can start clean for production.

**Critical product context:** Story **2.8 / FR61** already ships permanent league delete (`DELETE /api/leagues/[leagueId]` + type-`delete` dialog on settings). That path already works for **test and production** leagues and cascades all **`leagueId`-scoped** rows. This story does **not** reinvent delete — it **closes the global fixture gap** documented by Stories 8.3/8.4/8.6 and `deferred-work.md`, documents the **NFR25 retention exception** for test data, and updates the rehearsal runbook.

## Acceptance Criteria

### AC1 — Reuse existing delete for league-scoped data (no second delete API)

**Given** an authenticated **ADMIN** of a league marked `isTestLeague: true`  
**When** they complete the existing settings flow (`/leagues/{leagueId}/settings` → **Delete league** → type **`delete`** → **Delete permanently**)  
**Then** `DELETE /api/leagues/[leagueId]` still removes the league and **all league-scoped dependents** via Prisma `onDelete: Cascade` (Season including simulation fields, LeagueMembership, Invitation, Pick via Season/Membership, AuditLogEntry, LeagueWeekEmailConfig)  
**And** **User** accounts remain intact (membership for this league only is removed)  
**And** production leagues continue to delete via the **same** endpoint with **no** `isTestLeague` gate (FR61 unchanged)  
**And** authz / CSRF / rate-limit behavior from Story 2.8 is preserved: origin assert → `auth()` → admin check → 401/403/404/204/429 shapes unchanged for the league-row delete itself

---

### AC2 — Global rehearsal fixture cleanup when the last test league is deleted (decision: clean up)

**Given** `deferred-work.md` requires Story 8.7 to **explicitly decide** whether to leave or remove global rows created by rehearsal (`NflGame` fixtures, `OddsSnapshotRun` with `source: "test_fixture"`, `NflGameOddsLine`, `NflWeekJailedTeam`, including scores mutated by Story 8.4)  
**When** an admin successfully deletes a **test** league and **zero** other leagues with `isTestLeague: true` remain afterward  
**Then** the server runs an explicit cleanup (new helper — see Dev Notes) that:

1. Identifies **fixture-only** `NflGame` rows as those whose odds lines are **exclusively** tied to `OddsSnapshotRun.source === ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE` (reuse the constant from `src/lib/nfl/apply-simulation-odds-snapshot.ts` — same provenance rule as Story 8.4; **never** delete a game that also has a non-`test_fixture` odds line)
2. Deletes all `OddsSnapshotRun` rows with `source === ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE` (cascades their `NflGameOddsLine` rows)
3. Deletes those fixture-only `NflGame` rows (any remaining lines cascade from the game)
4. Deletes `NflWeekJailedTeam` rows for `(nflSeasonYear, weekNumber)` pairs that **no longer have any** `NflGame` rows after step 3 (fixture-only weeks). If a week still has real/synced games, **leave** the jailed row alone
5. Runs steps 2–4 inside a **`prisma.$transaction`** (NFR28) after the league row is already gone (or in the same outer transaction as league delete — see Dev Notes order)

**And** emit a structured `console.info` JSON line (no secrets) e.g. `{ action: "rehearsal_fixtures_cleaned", actorUserId, deletedSnapshotRuns, deletedGames, deletedJailedRows, timestamp }`  
**And** if cleanup fails after the league was already deleted, return **500** `INTERNAL_ERROR` with a clear message that the league is gone but fixture cleanup failed (ops can re-run cleanup — see AC4 testability); do **not** leave the API silently claiming full success when cleanup threw

---

### AC3 — Multi–test-league safety: retain shared fixtures while any test league remains

**Given** two or more leagues with `isTestLeague: true` share the same global fixture slate (fixtures are **not** `leagueId`-scoped)  
**When** an admin deletes **one** of those test leagues and at least one other test league still exists  
**Then** league-scoped cascade for the deleted league still runs (AC1)  
**And** **global** fixture cleanup (**AC2**) is **skipped**  
**And** a structured log line records retention, e.g. `{ action: "rehearsal_fixtures_retained", reason: "other_test_leagues_remain", remainingTestLeagueCount, leagueId, actorUserId, timestamp }`  
**And** deleting the **last** remaining test league triggers AC2 cleanup

---

### AC4 — Extract cleanup into a testable module (do not bury logic only in the route)

**Given** project convention of pure/service helpers under `src/lib/**` with colocated Vitest  
**When** implementing AC2/AC3  
**Then** add something like `src/lib/nfl/cleanup-rehearsal-fixtures.ts` exporting:

- `countRemainingTestLeagues(prisma, { excludeLeagueId?: string })` (or equivalent)
- `cleanupOrphanTestFixtureData(prisma)` — the transactional delete described in AC2
- Optionally `deleteLeagueAndMaybeCleanupFixtures(...)` orchestrating “read isTestLeague → delete league → maybe cleanup” if that keeps the route thin

**And** colocated `*.test.ts` covers at minimum:

1. Fixture-only games + `test_fixture` runs + jailed row for an empty-after-delete week → all removed  
2. Mixed week: game with **both** `test_fixture` and non-fixture odds source → **game kept**; `test_fixture` runs still deleted; jailed kept if any games remain  
3. Real-only week (no `test_fixture` runs) → no games/jailed deleted  
4. Orchestration: when `remainingTestLeagues > 0` after delete, cleanup helper is **not** invoked (mock assertion)

**And** do **not** add a colocated route integration test (project convention — none today)

---

### AC5 — UX: same high-friction pattern; test-league copy clarifies cleanup + NFR25 exception

**Given** UX spec requires Epic 8 delete to use the **same** interaction pattern as production delete (red destructive control, modal, league name, type exact **`delete`**)  
**When** the settings page renders `DeleteLeagueDialog` for a **test** league  
**Then** keep the existing confirm token and button labels  
**And** extend dialog body copy (pass `isTestLeague` from the server settings page) to state, in plain language:

- Deletion is permanent for this league’s members/picks/etc. (existing)
- User accounts are not deleted (existing)
- For test leagues: when this is the **last** rehearsal league, **global practice schedule/odds leftovers** are also removed so they do not linger into the real season; if other rehearsal leagues still exist, those shared leftovers stay until the last one is deleted
- One short clause that **practice data is not retained** for season history (**NFR25** retention applies to real-season participant data, not test/rehearsal leagues)

**And** production-league dialog copy stays as today (no fixture-cleanup paragraph)  
**And** no new confirmation token, no checkbox-only confirm, no second delete button elsewhere

---

### AC6 — Docs: close the runbook “8.7 gap” and deferred-work disposition

**Given** `docs/rehearsal-runbook.md` still documents Story 8.7 as backlog and lists global fixtures as not removed  
**When** this story ships  
**Then**:

1. Update the runbook **Delete** section to describe **actual** post-8.7 behavior (AC1–AC3), including multi–test-league retention  
2. Remove or rewrite the “Story 8.7 gap” subsection so it is no longer framed as an open backlog hole; keep a brief note that fixtures are global and cleaned when the **last** test league is deleted  
3. Update the optional checklist row **Delete cleanup** to expect full cleanup per AC2 when appropriate  
4. In `deferred-work.md`, mark the **“Global fixture rows not cleaned by Story 8.7…”** entry as **resolved by Story 8.7** (date + one-line pointer to this story / helper). Leave the separate **“Accepted MVP risk: fixture + real schedule mix”** entry unless AC2’s mixed-week keep-real-games rule fully retires it — if the mix risk remains for in-progress rehearsals before delete, keep that entry and note 8.7 only cleans at delete time  
5. Do **not** pull in unrelated deferred items (unscoped `scoreNflWeek`, `readJsonObject` dedupe, email suppress retries, etc.) — see Dev Notes out-of-scope

---

### AC7 — Archive/hide path not used (full delete ships)

**Given** epics.md allows “if full delete is deferred post-MVP, document an interim archive/hide path”  
**When** this story completes  
**Then** full delete + cleanup is the shipped path — **no** soft-delete / archive / hide feature  
**And** no new schema flags for “archived league”

## Tasks / Subtasks

- [x] Task 1: Cleanup helper + tests (AC: #2, #3, #4)
  - [x] Add `src/lib/nfl/cleanup-rehearsal-fixtures.ts` (name may vary; keep under `src/lib/nfl/`)
  - [x] Implement fixture-only game detection via `ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE` provenance (mirror 8.4 filter logic)
  - [x] Transactional deletes: snapshot runs → fixture-only games → orphan jailed rows
  - [x] Colocated Vitest covering AC4 cases (mock Prisma)
- [x] Task 2: Wire into `DELETE /api/leagues/[leagueId]` (AC: #1, #2, #3)
  - [x] Before delete: load `league.isTestLeague` (and keep existing authz)
  - [x] After successful `deleteMany`: if was test league, count remaining test leagues; cleanup or retain + structured logs
  - [x] Preserve 204 on full success; 500 if cleanup throws after league delete
  - [x] Do **not** change MEMBER/unauthenticated error contracts
- [x] Task 3: Dialog copy for test leagues (AC: #5)
  - [x] Pass `isTestLeague` into `DeleteLeagueDialog` from `settings/page.tsx`
  - [x] Conditional body copy only; keep type-`delete` gate and MUI `Stack`/`Dialog` patterns
- [x] Task 4: Docs closeout (AC: #6, #7)
  - [x] Update `docs/rehearsal-runbook.md` delete section + checklist
  - [x] Resolve global-fixture deferred-work entry; leave unrelated items
- [x] Task 5: Regression
  - [x] `npm test` (includes new cleanup tests)
  - [x] `npm run lint`
  - [x] Manual: delete last test league → fixtures gone; delete one of two test leagues → fixtures remain; production delete unchanged

## Dev Notes

### What this story is (and is NOT)

| Is | Is NOT |
|----|--------|
| Close global `test_fixture` leftover cleanup on **last** test-league delete | A second delete endpoint or soft-delete |
| Reuse Story 2.8 API + UX pattern | Gating FR61 behind `isTestLeague` |
| Document NFR25 exception for rehearsal data | Changing production retention for real leagues |
| Update runbook to match shipped behavior | Fixing unscoped `scoreNflWeek` / finalize blast radius (separate deferred item) |
| Minor dialog copy for test leagues | New admin simulation UI, new confirm token, redesign settings |

### Recommended delete + cleanup order

1. `assertCookieSessionMutationOrigin` → `auth()` → load league (`id`, `isTestLeague`) + membership → `authorizeLeagueDelete` (unchanged outcomes)
2. `const wasTest = league.isTestLeague`
3. `prisma.league.deleteMany({ where: { id: leagueId } })` — existing cascade for league-scoped rows
4. If `!wasTest` → existing `league_deleted` log → **204**
5. If `wasTest`:
   - `remaining = await prisma.league.count({ where: { isTestLeague: true } })`
   - If `remaining > 0` → retain log → **204**
   - Else → `await cleanupOrphanTestFixtureData(prisma)` → cleaned log → **204**
6. If step 5 cleanup throws: log error, return **500** with message that league delete succeeded but rehearsal fixture cleanup failed (operator may call a one-off re-run of the helper in a future ops script — **do not** invent a public unauthenticated cleanup route in this story)

Prefer extracting orchestration so the route stays thin. Optional: wrap league delete + cleanup in one `$transaction` **only if** you can still express “skip cleanup when other test leagues remain” correctly; counting remaining test leagues **after** delete is simpler as two steps (document the brief window where league is gone but fixtures remain if cleanup fails).

### Provenance rules (do not invent `NflGame.isFixture`)

Stories 8.3/8.4 explicitly rejected an `isFixture` column. Provenance is:

```ts
oddsLines: { some: { oddsSnapshotRun: { source: ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE } } }
```

For **deletion**, be stricter: only delete games that have **no** odds line from a non-`test_fixture` source (a game that somehow acquired both should be **kept** after snapshot-run delete — its real lines remain). Implement this check **before** deleting snapshot runs, or via a query that classifies games first.

Constant: `ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE` in `src/lib/nfl/apply-simulation-odds-snapshot.ts`.

### Existing cascade map (league-scoped — already done by 2.8)

From `prisma/schema.prisma` header + models: League → Season, LeagueMembership, Invitation, AuditLogEntry, LeagueWeekEmailConfig (all Cascade). Pick cascades via Season/Membership. **User** not deleted.

Global (need AC2): `Team`, `NflGame`, `OddsSnapshotRun`, `NflGameOddsLine`, `NflWeekJailedTeam`.

### Architecture / security compliance

- REST `DELETE /api/leagues/[leagueId]` — architecture FR61 path; extend behavior, don’t fork URL
- NFR15 CSRF: keep `assertCookieSessionMutationOrigin` first
- Rate limit: existing `checkLeagueDeleteRateLimit` in `proxy.ts` — no change required unless you add a new high-risk route (you should not)
- NFR28: transactional fixture cleanup
- Authz: ADMIN only — `authorizeLeagueDelete` unchanged
- Structured errors: `{ error: { code, message } }`

### UX reference

[Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Admin: delete league (production); Test / rehearsal leagues]

- Same muscle memory as production delete
- Red / error destructive control; modal; league name from **server props**; type **`delete`**
- Test leagues must remain visually distinct elsewhere (banner/chip) — already shipped; this story only touches delete dialog copy

### Deferred-work disposition (consulted while planning)

| Item | Disposition |
|------|-------------|
| **Global fixture rows not cleaned by Story 8.7 per-league cascade** (8.3, reaffirmed 8.4) | **In scope — resolve** via AC2/AC3 |
| **Accepted MVP risk: fixture + real schedule mix** | **Partially mitigated at delete** (AC2 keeps real games). Leave deferred entry for **during-rehearsal** mixed weeks unless you can honestly close it |
| **Cross-league scoring blast radius via unscoped `scoreNflWeek`** (8.4 review) | **Out of scope** — deleting fixtures reduces leftover finalized fixtures after last test league is gone, but does not league-scope `scoreNflWeek`. Keep deferred |
| Simulation/email error-recovery runbook gaps (8.6) | **Out of scope** |
| Email suppress / AdminEmailComposer / `readJsonObject` dupes / etc. | **Out of scope** |

### Previous story intelligence

**8.6 (docs):** Runbook already teaches operators to delete via 2.8 and warns about the 8.7 gap — **update that prose** in AC6; do not leave “backlog gap” language after ship.

**8.3 / 8.4:** Global fixtures + `test_fixture` provenance + mutated scores on `NflGame` — cleanup must remove snapshot runs **and** fixture-only games (including FINAL scores), not only runs.

**2.8:** Canonical delete API/UI/tests for authz — extend, don’t duplicate. Files:

- `src/app/api/leagues/[leagueId]/route.ts`
- `src/lib/league/delete-league-authorization.ts` (+ `.test.ts`)
- `src/app/(app)/leagues/[leagueId]/settings/delete-league-dialog.tsx`
- `src/app/(app)/leagues/[leagueId]/settings/page.tsx`

### Git intelligence

Recent commits: `docs(rehearsal): Story 8.6…`, then `feat(leagues): Story 8.5…` … `8.2`. Prefer:

`feat(leagues): Story 8.7 — delete test league fixture cleanup`

(docs updates can ride along or be a second `docs(rehearsal): …` commit if you split — either is fine).

### Library & framework requirements

| Package | Notes |
|---------|--------|
| `@prisma/client` 6.x | `deleteMany` / `$transaction`; no schema migration required if cleanup is application-level |
| `next` 16.x | `params: Promise<{ leagueId }>` — already awaited in DELETE |
| `@mui/material` 7.x | Existing dialog; `Stack` for layout |
| Vitest | Colocated tests next to cleanup helper |

### File structure requirements

```
src/lib/nfl/cleanup-rehearsal-fixtures.ts          # new
src/lib/nfl/cleanup-rehearsal-fixtures.test.ts      # new
src/app/api/leagues/[leagueId]/route.ts            # extend DELETE
src/app/(app)/leagues/[leagueId]/settings/delete-league-dialog.tsx  # isTestLeague copy
src/app/(app)/leagues/[leagueId]/settings/page.tsx # pass isTestLeague
docs/rehearsal-runbook.md                           # AC6
_bmad-output/implementation-artifacts/deferred-work.md  # resolve fixture entry
```

No new public API routes. No Prisma migration unless you discover a Restrict FK ordering bug with AuditLogEntry — if `league.delete` already works in prod/rehearsal today, do not invent a migration.

### Testing requirements

- Prefer testing the **cleanup helper** with mocked Prisma (pattern: `apply-simulation-week-results.test.ts`)
- Keep `delete-league-authorization.test.ts` green; add orchestration tests in the new file
- Run `npm test` before marking review
- Manual QA matrix: last test league / not-last test league / production league

### Project context reference

- `docs/project-context.md` — single Prisma client, structured errors, DELETE rate limit, Epic 8 deletion note
- Do not put secrets in client copy

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 8; Story 8.7]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 2.8 / FR61 contrast]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR61; NFR25; rehearsal vs production delete]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — league delete, transactions, test leagues deletable with documented cascade]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — delete confirmation; test league distinction]
- [Source: `docs/project-context.md`]
- [Source: `docs/rehearsal-runbook.md` — Delete section / 8.7 gap]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — global fixture cleanup decision]
- [Source: `_bmad-output/implementation-artifacts/2-8-admin-delete-league-production.md`]
- [Source: `_bmad-output/implementation-artifacts/8-3-*.md` / `8-4-*.md` / `8-6-*.md`]
- [Source: `prisma/schema.prisma` — cascade convention; global NFL models]
- [Source: `src/lib/nfl/apply-simulation-odds-snapshot.ts` — `ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE`]
- [Source: `src/lib/nfl/apply-simulation-week-results.ts` — fixture provenance filter]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

### Completion Notes List

- Added `cleanup-rehearsal-fixtures.ts` with `countRemainingTestLeagues`, `cleanupOrphanTestFixtureData`, and `handlePostTestLeagueDeleteFixtureCleanup` orchestration.
- Extended `DELETE /api/leagues/[leagueId]` to run fixture cleanup when the last test league is deleted; returns 500 if cleanup fails after league row is gone.
- Extended `DeleteLeagueDialog` with test-league copy explaining shared fixture cleanup and NFR25 exception.
- Updated rehearsal runbook and resolved deferred-work global-fixture entry; kept mixed-week during-rehearsal risk entry with 8.7 delete-time mitigation note.
- All 469 tests pass; lint clean.

### File List

- `src/lib/nfl/cleanup-rehearsal-fixtures.ts` (new)
- `src/lib/nfl/cleanup-rehearsal-fixtures.test.ts` (new)
- `src/app/api/leagues/[leagueId]/route.ts` (modified)
- `src/app/(app)/leagues/[leagueId]/settings/delete-league-dialog.tsx` (modified)
- `src/app/(app)/leagues/[leagueId]/settings/page.tsx` (modified)
- `docs/rehearsal-runbook.md` (modified)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)

## Change Log

- 2026-07-28: Story authored via create-story workflow — status **ready-for-dev**. Ultimate context engine analysis completed — comprehensive developer guide created.
- 2026-07-28: Implemented global rehearsal fixture cleanup on last test-league delete; dialog copy; docs/deferred-work closeout — status **review**.
- 2026-07-28: Code review — applied 7 patches; deferred concurrent-delete race, zero-odds-line orphans, and N+1 jailed loop — status **done**.

### Review Findings

- [x] [Review][Defer] Concurrent last-two test-league deletes can both skip cleanup — deferred: accept for MVP (single-admin rehearsal); residual race if two parallel deletes of the final two test leagues both skip cleanup.
- [x] [Review][Defer] Zero–odds-line NflGame rows survive cleanup — deferred: accept provenance rule as written; games with no odds lines are out of AC2 fixture-only detection; leave orphans for ops if partial 8.3 failures occur.
- [x] [Review][Patch] Wrap `countRemainingTestLeagues` failures as `cleanup_failed` [`src/lib/nfl/cleanup-rehearsal-fixtures.ts`] — try/catch now wraps count + cleanup; count failures return `cleanup_failed`.
- [x] [Review][Patch] Include `leagueId` on `rehearsal_fixtures_cleaned` log [`src/lib/nfl/cleanup-rehearsal-fixtures.ts`] — cleaned log includes `leagueId`.
- [x] [Review][Patch] Structure `cleanup_failed` error log as JSON [`src/lib/nfl/cleanup-rehearsal-fixtures.ts`] — failure path emits structured `rehearsal_fixtures_cleanup_failed` JSON.
- [x] [Review][Patch] Dialog should leave settings on partial-success 500 [`src/app/(app)/leagues/[leagueId]/settings/delete-league-dialog.tsx`] — navigates to `/leagues` when error message indicates league was already deleted.
- [x] [Review][Patch] AC4 case 2 mixed-provenance game not actually asserted [`src/lib/nfl/cleanup-rehearsal-fixtures.test.ts`] — test asserts exclusive provenance filter + fixture-only deleteMany + runs deleted + jailed kept.
- [x] [Review][Patch] AC4 case 3 real-only week missing [`src/lib/nfl/cleanup-rehearsal-fixtures.test.ts`] — real-only week test with zero snapshot/game/jailed deletes.
- [x] [Review][Patch] AC5 dialog NFR25 contrast incomplete [`src/app/(app)/leagues/[leagueId]/settings/delete-league-dialog.tsx`] — copy notes retention applies to real-season participant data, not test leagues.
- [x] [Review][Defer] Per-week jailed cleanup N+1 inside transaction [`src/lib/nfl/cleanup-rehearsal-fixtures.ts:60`] — deferred, pre-existing — Acceptable for short rehearsal week sets; batch/optimize later if needed.
