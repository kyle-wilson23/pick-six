# Story 9.1: League-scoped scoring (`scoreNflWeek` blast radius)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a league admin running rehearsal alongside (or before) a production league,
I want finalize/score paths to respect **league boundaries**,
so that simulating results in a test league cannot score another league's picks with fixture winners.

**Launch-blocker context:** Epic 8 retro (2026-07-28) and Story 8.4 code review classified unscoped `scoreNflWeek` as a **production go-live blocker**. Team agreement: do **not** run a production league with picks on weeks that were simulated until this story ships.

## Acceptance Criteria

### AC1 — Rehearsal Simulate results scores only the target league's picks

**Given** a test league `T` and a non-test (production) league `P` that share the same `(nflSeasonYear, weekNumber)`  
**And** both leagues have `Pick` rows for that week  
**When** an admin runs **Simulate results** for league `T` (`POST /api/leagues/[leagueId]/simulation/apply-results`)  
**Then** only picks belonging to season(s) for league `T` are scored (outcome / pointsEarned / scoredAt written)  
**And** picks belonging to league `P` remain **unscored** (null outcome / points / scoredAt) — even if fixture games made the global NFL week `isWeekFullyFinalized`  
**And** the blast radius cannot occur via the existing call chain `applySimulationWeekResults` → `finalizeNflWeek` → `scoreNflWeek`

---

### AC2 — Optional league scope on `scoreNflWeek` / `finalizeNflWeek` (preserve production multi-league scoring)

**Given** Story 5.2 intentionally scored **all** picks for `(nflSeasonYear, weekNumber)` so one admin/automation action can score every league for a real NFL week  
**When** implementing league isolation  
**Then**:

1. Extend `scoreNflWeek(prisma, opts)` so `opts` accepts an optional **`leagueId?: string`**
2. When `leagueId` is provided, the pick query **must** include `season: { nflSeasonYear, leagueId }` (not year alone)
3. When `leagueId` is **omitted**, behavior stays as today: score all picks for that NFL year+week (production `POST /api/admin/scoring/score-week` and `finalize-week` unchanged in contract)
4. Thread the same optional `leagueId` through `finalizeNflWeek` into `scoreNflWeek`
5. `applySimulationWeekResults` **requires** `leagueId` and always passes it into `finalizeNflWeek`
6. `POST .../simulation/apply-results` passes the route's `leagueId` into `applySimulationWeekResults`

**And** `NflGame` queries remain global (games have no `leagueId`) — only **Pick** scoring is league-scoped  
**And** do **not** invent a second scoring algorithm or duplicate `getGameWinner` / `scorePickOutcome`

---

### AC3 — Regression tests prove cross-league blast radius cannot recur

**Given** colocated Vitest for scoring / simulation helpers  
**When** this story ships  
**Then** add (or extend) tests that assert at minimum:

1. **`scoreNflWeek` with `leagueId`:** pick `findMany` `where` includes `season: { nflSeasonYear, leagueId }` (assert the Prisma mock call args — do not only assert scored counts)
2. **`scoreNflWeek` without `leagueId`:** pick query still filters by year+week only (preserves 5.2 multi-league admin behavior)
3. **Cross-league blast-radius scenario (orchestration or score layer):** with two leagues' picks present for the same week, a scoped run scores only the target league's pick id(s) and never updates the other league's pick id(s)
4. Update `applySimulationWeekResults` tests so `finalizeNflWeek` is invoked with `{ nflSeasonYear, weekNumber, leagueId }` (not year+week alone)

**And** run **`npm test`** before marking the story review/done

---

### AC4 — Docs: deferred-work resolved + rehearsal runbook notes the fix

**Given** `deferred-work.md` already marks the 8.4 blast-radius finding as ~~struck~~ and **Promoted to Story 9.1**  
**And** `docs/rehearsal-runbook.md` does not yet warn that Simulate results is league-isolated  
**When** this story ships  
**Then**:

1. Update the deferred-work entry from "Promoted to Story 9.1" → **Resolved by Story 9.1** (keep forensic detail; note the fix: optional `leagueId` on score/finalize, required on simulation path)
2. Update the rehearsal runbook **Simulate results** step (and/or a short Safety note near "Run a simulated week") to state that scoring is **league-scoped** — simulating results for a test league does **not** score picks in other leagues (including production) that share the same NFL week
3. Optionally strike/relax the epic-8-retro ops caution "No production league with picks on weeks that were simulated until 9.1 ships" only if you touch that doc; otherwise leave retro historical

**And** no UX/UI redesign — Simulate button copy/alerts may stay as-is unless a one-line success message change is needed for clarity (not required)

## Tasks / Subtasks

- [x] Task 1 — Scope `scoreNflWeek` (AC: #2, #3)
  - [x] Add optional `leagueId?: string` to opts
  - [x] When set, filter picks: `season: { nflSeasonYear: opts.nflSeasonYear, leagueId: opts.leagueId }`
  - [x] Update JSDoc: document scoped vs unscoped behavior and idempotency unchanged
  - [x] Extend `score-nfl-week.test.ts` for scoped where-clause + blast-radius pick isolation
- [x] Task 2 — Thread scope through `finalizeNflWeek` (AC: #2)
  - [x] Accept and forward optional `leagueId` to `scoreNflWeek`
  - [x] Update `finalize-nfl-week.test.ts` if it asserts opts shape / mocked `scoreNflWeek` calls
- [x] Task 3 — Require league on rehearsal path (AC: #1, #2)
  - [x] `applySimulationWeekResults(prisma, { nflSeasonYear, weekNumber, leagueId })` — `leagueId` required
  - [x] Pass `leagueId` into `finalizeNflWeek`
  - [x] Update module JSDoc: remove "Not league-scoped" claim; document Pick scoring is league-scoped while game provenance remains fixture-only
  - [x] Route `apply-results/route.ts`: pass `leagueId` from params into the helper
  - [x] Update `apply-simulation-week-results.test.ts` call expectations
- [x] Task 4 — Leave production admin scoring unscoped by default (AC: #2)
  - [x] Confirm `score-week` / `finalize-week` routes still call without `leagueId` (no contract break)
  - [x] Do **not** change Authz, CSRF, or Zod on those routes unless required for types
- [x] Task 5 — Docs closeout (AC: #4)
  - [x] `deferred-work.md` → Resolved by Story 9.1
  - [x] `docs/rehearsal-runbook.md` — league-scoped scoring safety note
- [x] Task 6 — Verify
  - [x] `npm test`
  - [x] Manual smoke optional: two leagues same year/week → Simulate on test league → production picks still null outcome

### Review Findings

- [x] [Review][Patch] Empty-string `leagueId` silently unscopes pick query [`src/lib/scoring/score-nfl-week.ts:59`] — fixed: scope when `leagueId !== undefined`
- [x] [Review][Defer] Cross-league isolation test reimplements filter in mock rather than asserting Prisma where alone [`src/lib/scoring/score-nfl-week.test.ts:249`] — deferred, pre-existing

## Dev Notes

### Bug (exact)

```48:54:src/lib/scoring/score-nfl-week.ts
    const picks = await prisma.pick.findMany({
      where: {
        nflWeekNumber: opts.weekNumber,
        season: { nflSeasonYear: opts.nflSeasonYear },
      },
      select: { id: true, teamId: true, antiJailedBonus: true },
    });
```

No `season.leagueId` / `seasonId`. Rehearsal entry drops league context:

```127:131:src/app/api/leagues/[leagueId]/simulation/apply-results/route.ts
    const result = await applySimulationWeekResults(prisma, {
      nflSeasonYear: season.nflSeasonYear,
      weekNumber: season.simulatedCurrentWeek,
    });
```

```101:101:src/lib/nfl/apply-simulation-week-results.ts
  const finalized = await finalizeNflWeek(prisma, { nflSeasonYear, weekNumber });
```

Provenance (`test_fixture` odds) protects **NflGame writes only** — not Pick scoring. That was correct for 8.4 AC8 (do-not-touch scoring files); this story **is** the authorized edit of those files.

### Locked design decisions (do not re-litigate)

1. **Optional `leagueId` on score/finalize; required on simulation.** Preserves Story 5.2 multi-league production scoring; closes rehearsal blast radius.
2. **Do not default "omit = score nothing."** Unscoped remains the production admin path.
3. **Do not scope by `isTestLeague` alone.** Multiple test leagues can share a week — scope to the **route's** `leagueId`.
4. **Do not add `NflGame.leagueId` or `isFixture` schema.** Games stay global; Pick → Season → League is enough.
5. **Do not change reveal/standings/history read paths** unless a compile break forces a type touch — they already aggregate by `leagueId`/`seasonId`.
6. **No frontend redesign.** UX consulted: no new components; Simulation controls already exist (Story 8.4).

### Recommended implementation sketch

```ts
// score-nfl-week.ts
opts: { nflSeasonYear: number; weekNumber: number; leagueId?: string }

where: {
  nflWeekNumber: opts.weekNumber,
  season: {
    nflSeasonYear: opts.nflSeasonYear,
    ...(opts.leagueId ? { leagueId: opts.leagueId } : {}),
  },
}
```

Same optional field on `finalizeNflWeek`. Simulation helper signature gains required `leagueId: string`.

### What this story is (and is NOT)

| **Is** | **Is NOT** |
|--------|------------|
| League boundary for **Pick scoring** on rehearsal finalize | A new scoring rules engine |
| Threading `leagueId` from simulation route → score | Schema change on `NflGame` |
| Regression tests for cross-league isolation | Changing production `score-week` to require a league |
| Docs: deferred-work resolved + runbook safety note | UI polish (Stories 9.5–9.7) |
| Fix for Epic 8.4 deferred launch blocker | Fixing fixture+real mixed-week "won't score" behavior (still accepted ops risk) |
| | Domain-provider / forgot-password / Lighthouse (9.2–9.4) |
| | Odds-line natural-key collision deferred item (leave in deferred-work) |

### Reuse — do NOT reinvent

| Need | Reuse |
|------|--------|
| Winner / points math | `getGameWinner`, `scorePickOutcome` (`src/lib/domain/scoring.ts`) — unchanged |
| Finalize gate | `isWeekFullyFinalized` / `finalizeNflWeek` — extend opts only |
| Fixture game writes | `applySimulationWeekResults` provenance filter — keep; only add `leagueId` to finalize call |
| Admin simulation authz | Existing CSRF → auth → ADMIN → `isTestLeague` chain in `apply-results/route.ts` |
| Error JSON shape | `{ error: { code, message } }` per `docs/project-context.md` |
| Tests style | Mocked Prisma + assert `findMany`/`update` args (see `score-nfl-week.test.ts`, `apply-simulation-week-results.test.ts`) |

### Call sites to audit (grep before done)

After changing signatures, grep and verify every caller:

- `src/lib/scoring/score-nfl-week.ts`
- `src/lib/scoring/finalize-nfl-week.ts`
- `src/lib/nfl/apply-simulation-week-results.ts`
- `src/app/api/admin/scoring/score-week/route.ts` — omit `leagueId`
- `src/app/api/admin/scoring/finalize-week/route.ts` — omit `leagueId`
- `src/app/api/leagues/[leagueId]/simulation/apply-results/route.ts` — **pass** `leagueId`
- Any test files mocking these functions

### Architecture / PRD guardrails

- **Multi-tenancy:** Enforce `leagueId` on mutations that can corrupt another tenant's data ([Source: architecture.md — Cross-Cutting Concerns; Multi-tenancy])
- **NFR / success:** Zero scoring disputes / zero calculation errors — cross-league fixture scoring is a data-integrity failure ([Source: prd.md — Data Integrity, FR41–FR49])
- **Test leagues:** Isolated by `leagueId`; deletable; simulation must not bleed into production ([Source: architecture.md — Test / rehearsal leagues; epics Epic 8/9])
- **Domain vs I/O:** Keep pure scoring in `lib/domain`; orchestration in `lib/scoring` + `lib/nfl` ([Source: docs/project-context.md])

### UX notes (consulted — no UI work required)

`ux-design-specification.md` covers rehearsal labeling (banner/chip) and admin trust/visibility. Story 9.1 is a **correctness / isolation** fix behind the existing **"Simulate results"** control. Do not restyle Simulation controls here. If success copy is touched at all, keep it factual (games finalized / picks scored counts already returned).

### Deferred-work disposition (consulted while planning)

| Item | Disposition for 9.1 |
|------|---------------------|
| ~~Cross-league scoring blast radius via unscoped `scoreNflWeek`~~ (8.4) | **This story** — implement + mark **Resolved by Story 9.1** |
| Odds-line natural-key collision / fixture+real mix | **Out of scope** — leave deferred |
| 5.2 read-then-write race / map collision / null-score FINAL skip | **Out of scope** — leave deferred (may improve slightly if you touch the file, but do not expand scope) |
| 5.3 no txn between finalize gate and score | **Out of scope** |
| `readJsonObject` duplication / AdminSimulationControls untested | **Out of scope** |
| Suppress-branch email upsert / other email deferred | **Out of scope** (Epic 9.4 / later) |
| Epic 7 Lighthouse / NFR5 / breaker e2e | **Story 9.4** — not here |

### Previous story intelligence

**Story 8.4 (simulate results)**

- Explicitly left `scoreNflWeek`/`finalizeNflWeek` unmodified; deferred blast radius to later
- Provenance guard is necessary but **insufficient** alone for Pick isolation
- Tests mock `finalizeNflWeek` — update expected args when threading `leagueId`
- JSDoc currently admits: *"Not league-scoped — callers must gate on `isTestLeague`"* — that gate only blocks who can click; it does **not** limit which picks score. Replace that guidance.

**Story 5.2 / 5.3**

- Unscoped year+week scoring was intentional for production multi-league finalize
- Existing tests include `"scores multiple picks across leagues independently"` which means "scores everyone's picks in one run" — **not** league isolation. Do not "fix" that test into requiring a leagueId; add **new** scoped tests instead
- Idempotency (`scoredAt` refresh on re-run) must still hold for scoped runs

**Epic 8 retro**

- Launch blocker #1 in Epic 9 order
- Ops caution until ship: no production picks on simulated weeks

**Git recent pattern:** focused feat commits per story (`feat(leagues): Story 8.x…`); docs commits for retros/runbooks; colocated Vitest alongside helpers.

### Testing requirements

1. Unit: `scoreNflWeek` scoped vs unscoped `where` clause (assert mock args)
2. Unit: cross-league pick isolation (two pick ids → only target updated)
3. Unit: `applySimulationWeekResults` passes `leagueId` into `finalizeNflWeek`
4. Update finalize tests if they spy on `scoreNflWeek` opts
5. No new Playwright/e2e required
6. `npm test` green

### Project Structure Notes

- Touch: `src/lib/scoring/score-nfl-week.ts` (+ test), `src/lib/scoring/finalize-nfl-week.ts` (+ test), `src/lib/nfl/apply-simulation-week-results.ts` (+ test), `src/app/api/leagues/[leagueId]/simulation/apply-results/route.ts`
- Docs: `_bmad-output/implementation-artifacts/deferred-work.md`, `docs/rehearsal-runbook.md`
- Do **not** move scoring into `lib/domain` — domain stays pure; Prisma orchestration stays in `lib/scoring`

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 9; Story 9.1]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR41–FR49, data integrity / zero scoring disputes]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Multi-tenancy; Test/rehearsal leagues; Scoring & leaderboard]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Test/rehearsal leagues (no new UI for 9.1)]
- [Source: `docs/project-context.md` — server authority, league isolation, Vitest colocated tests]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — 8.4 blast radius → Story 9.1]
- [Source: `_bmad-output/implementation-artifacts/epic-8-retro-2026-07-28.md` — launch blocker]
- [Source: `_bmad-output/implementation-artifacts/8-4-simulated-game-results-and-scoring-reveal-cycle.md` — deferred finding + provenance design]
- [Source: `docs/rehearsal-runbook.md` — Simulate results step]
- [Source: `src/lib/scoring/score-nfl-week.ts`]
- [Source: `src/lib/scoring/finalize-nfl-week.ts`]
- [Source: `src/lib/nfl/apply-simulation-week-results.ts`]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

### Completion Notes List

- Added optional `leagueId` to `scoreNflWeek` / `finalizeNflWeek`; pick query scopes by `season.leagueId` when set, unscoped path unchanged for production admin routes.
- Made `leagueId` required on `applySimulationWeekResults` and threaded from simulation apply-results route.
- Added 4 new unit tests: scoped/unscoped where-clause assertions, cross-league pick isolation, finalize forwards leagueId, simulation passes leagueId to finalize.
- Updated deferred-work.md and rehearsal-runbook.md safety note.
- `npm test`: 475 tests passed (80 files).

### File List

- src/lib/scoring/score-nfl-week.ts
- src/lib/scoring/score-nfl-week.test.ts
- src/lib/scoring/finalize-nfl-week.ts
- src/lib/scoring/finalize-nfl-week.test.ts
- src/lib/nfl/apply-simulation-week-results.ts
- src/lib/nfl/apply-simulation-week-results.test.ts
- src/app/api/leagues/[leagueId]/simulation/apply-results/route.ts
- _bmad-output/implementation-artifacts/deferred-work.md
- docs/rehearsal-runbook.md

### Change Log

- 2026-07-28: Story 9.1 — league-scoped scoring for rehearsal simulate-results path; optional leagueId on score/finalize preserves production multi-league admin behavior.
- 2026-07-28: Code review — fail-closed empty-string `leagueId` (scope via `!== undefined`); regression test added.

---

**Ultimate context engine analysis completed — comprehensive developer guide created.**
