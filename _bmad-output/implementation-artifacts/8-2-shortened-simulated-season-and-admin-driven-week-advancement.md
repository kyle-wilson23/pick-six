# Story 8.2: Shortened Simulated Season and Admin-Driven Week Advancement

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a league admin,
I want to run **N weeks** (e.g. 4–6) that are **not** tied to real NFL wall time,
so that we can exercise pick → deadline → scoring → reveal repeatedly in an afternoon or over a few days.

## Acceptance Criteria

### AC1 — Persist simulation clock metadata (schema)

**Given** the Prisma `Season` model today only tracks `firstCompetitionWeek` / `preSeasonInitializedAt` / `firstCompetitionWeekLockedAt`

**When** this story ships

**Then** add two nullable columns to `Season`:

```prisma
simulationWeekCount  Int? @map("simulation_week_count")
simulatedCurrentWeek Int? @map("simulated_current_week")
```

**And** generate an additive Prisma migration via `npm run db:migrate` (dev) — existing rows (production **and** the existing 8.1 test league) get `NULL` for both; no backfill required

**And** both columns are **write-only for `isTestLeague === true` leagues** — production leagues (`isTestLeague === false`) must never have these columns written by any code path introduced in this story (AC8)

---

### AC2 — Configure simulation length at league creation

**Given** an authenticated user on `/leagues/new` creating a league with `isTestLeague: true` (and `ALLOW_TEST_LEAGUES` permits it — Story 8.1)

**When** they submit the create form

**Then**:

1. Form shows a **"Simulation week count"** `Select` (1–18, default **4**, helper text recommends **4–6 weeks**) **only when** the "Test / rehearsal league" checkbox is checked
2. Zod `createLeagueBodySchema` accepts optional `simulationWeekCount` (int, 1–18, default 4)
3. **Cross-field validation:** when `isTestLeague === true`, reject (400 `VALIDATION_ERROR`) if `firstCompetitionWeek + simulationWeekCount - 1 > 18` (simulation would run past NFL Week 18)
4. `POST /api/leagues` persists `simulationWeekCount` on the `Season` row **only when** `isTestLeague === true`; production leagues always get `NULL` regardless of what the body contains
5. Response JSON's `season` object includes `simulationWeekCount` and `simulatedCurrentWeek: null` (not started yet)

**And** `simulationWeekCount` is **create-time only** in this story — no PATCH/edit endpoint (mirrors the original `firstCompetitionWeek` MVP scope from Story 2.1, before Story 2.7 added post-create editing); this is an explicit, intentional scope cut, not an oversight

---

### AC3 — Starting the simulation clock

**Given** a test league whose `Season.simulatedCurrentWeek` is `NULL` (simulation not started)

**When** the admin runs the **existing** "Mark league ready for season" action (`POST /api/leagues/[leagueId]/pre-season-init`, Story 2.3 — reused as-is, no new UI)

**Then**, in the same update that sets `preSeasonInitializedAt`:

1. If `league.isTestLeague === true`: also set `simulatedCurrentWeek = season.firstCompetitionWeek` (simulation now "live" at its starting week)
2. If `league.isTestLeague === false`: unchanged behavior — `simulatedCurrentWeek` stays `NULL` forever

**And** this reuses the idempotent `updateMany({ where: { id: season.id, preSeasonInitializedAt: null } })` guard already in the route — no new UI surface for "starting" the simulation; **do not** build a second "start simulation" button

**Caution (manual testing only, not a code change in this story):** marking a test league ready also makes it eligible for the Tuesday/Wednesday/Thursday cron email jobs (`getActiveLeagueIds` filters only on `preSeasonInitializedAt`, not `isTestLeague`) — real emails could go to real invited testers before Story 8.5 ships the rehearsal email policy. Flag this to whoever runs manual QA for this story.

---

### AC4 — Admin-driven "advance simulation week" action

**Given** a test league whose simulation has started (`simulatedCurrentWeek` non-null) and has a configured `simulationWeekCount`

**When** the admin clicks **"Advance to Week N"** on the league admin dashboard (`/leagues/[leagueId]/admin`) and confirms in a dialog

**Then** `POST /api/leagues/[leagueId]/simulation/advance-week` with body `{ fromWeek: <week the client currently sees> }`:

1. **403** `NOT_TEST_LEAGUE` if `league.isTestLeague === false` (AC8 no-op rule from Story 8.1)
2. **404** `SEASON_NOT_FOUND` if no season row
3. **409** `SIMULATION_NOT_STARTED` if `simulatedCurrentWeek` is `NULL`
4. **409** `SIMULATION_NOT_CONFIGURED` if `simulationWeekCount` is `NULL` (legacy pre-8.2 test league — rare, dev/local only)
5. **409** `SIMULATION_COMPLETE` if already at `firstCompetitionWeek + simulationWeekCount - 1` (final week) — do not advance past the configured count
6. **409** `SIMULATION_WEEK_STALE` if `fromWeek !== season.simulatedCurrentWeek` (someone else already advanced, or client is stale) — response body includes the current `simulatedCurrentWeek` so the client can resync
7. **200** on success: `prisma.season.updateMany({ where: { id: season.id, simulatedCurrentWeek: fromWeek }, data: { simulatedCurrentWeek: fromWeek + 1 } })` — this **is** the idempotency/double-click guard (matches the `updateMany` conditional-write pattern already used by `pre-season-init`); response body: `{ simulatedCurrentWeek, simulationWeekCount, isComplete }`

**And** the client dialog is a **confirm-gated** action (Cancel/Confirm `Dialog`, no typed confirmation token needed — this is a much lower-risk action than league delete) — satisfies the epic's "idempotent **or** confirm-gated" requirement with **both** layers of protection

**And** CSRF / auth ordering matches `pre-season-init`: parse+validate JSON body → `assertCookieSessionMutationOrigin` → `auth()` → admin-membership check

---

### AC5 — Participants and admin see the correct simulated week

**Given** a test league with `simulatedCurrentWeek` set

**When** a participant opens `/leagues/[leagueId]/picks` (no explicit `?weekNumber=`), or an admin opens `/leagues/[leagueId]/admin`

**Then** the resolved "current week" is `season.simulatedCurrentWeek` — **not** the real-time `resolvePicksWeekNumber` (kickoff-based) resolution — via a new `resolveActiveWeekNumber(isTestLeague, season, games, now)` dispatcher in `src/lib/nfl/resolve-picks-week.ts`

**And** for `isTestLeague === false` leagues, `resolveActiveWeekNumber` calls `resolvePicksWeekNumber` unchanged — **byte-identical** behavior to today; this is the regression guardrail for every production league

**And** the three call sites that resolve "current week" for participant/admin-facing week context are updated to branch on `isTestLeague` internally (no signature change visible to their callers — each already fetches its own season row, so add a single cheap parallel `league.findUnique({ select: { isTestLeague: true } })` lookup inside):

- `src/lib/picks/build-league-picks-week-view.ts` (picks page + `GET /api/leagues/[leagueId]/picks`)
- `src/lib/admin/build-submission-status.ts` (admin dashboard header + `GET /api/leagues/[leagueId]/admin/submission-status`)
- `src/lib/admin/build-admin-override-data.ts` (admin override dialog data — must stay in sync with the above so the override target's week matches what the admin sees on screen)

**And** `explicitWeekNumber` (the `?weekNumber=` query param on the picks page/API) still works unchanged for test leagues too — an admin/participant can still view any specific NFL week's real data if games exist for it; only the **default/implicit** resolution changes

---

### AC6 — Fix pick-submission preview gate for test leagues (critical — do not skip)

**Given** `computePicksUiIsPreview` currently returns `true` whenever `now` is before the **real** earliest kickoff in the league's competition weeks

**And** Epic 8 rehearsal is explicitly meant to run **before** the real NFL season starts (epics.md: "ideal final gate before season start") — meaning that real-kickoff check would be `true` for **every** test league, **forever**, blocking pick submission entirely (`WeekMatchupList` sets `interactive = !isPreview`)

**When** `league.isTestLeague === true`

**Then** `computePicksUiIsPreview` takes an added `isTestLeague: boolean` parameter; when `true`, it short-circuits to `!season?.preSeasonInitializedAt` and **skips** the real-kickoff-date branch entirely — preview ends exactly when the admin starts the simulation (AC3), not when a real NFL game kicks off

**And** a colocated test proves: test league, `preSeasonInitializedAt` set, `now` far before any real kickoff → `isPreview === false` (this is the regression this AC exists to prevent — write the failing case first)

**And** production leagues (`isTestLeague === false`) get the exact same `computePicksUiIsPreview` behavior as today — verified by existing tests continuing to pass unmodified

---

### AC7 — Settings visibility (read-only)

**Given** `/leagues/[leagueId]/settings` already shows read-only "League type" (Story 8.1)

**When** the league is a test league

**Then** add two read-only rows (same `<dl>` pattern):

- **Simulation week count:** the configured count, or "Not configured" if `NULL`
- **Current simulated week:** `Week {simulatedCurrentWeek} of {simulationWeekCount}` (or "Not started" if `NULL`, or "Complete" if at the final week)

**And** no editable controls here — advancing lives on the admin dashboard (AC4)

---

### AC8 — Data separation / no-op for production leagues (Epic 8 foundation, reaffirmed)

**Given** Story 8.1 AC6 established: "every Epic 8 simulation behavior MUST no-op or 403 for `isTestLeague === false`"

**When** this story's code runs against a production league

**Then** verify explicitly (as tests, not just review comments):

1. `resolveActiveWeekNumber(false, ...)` output equals `resolvePicksWeekNumber(...)` output for identical inputs
2. `computePicksUiIsPreview({ ..., isTestLeague: false })` output equals today's (pre-8.2) output for identical inputs
3. `POST /api/leagues/[leagueId]/simulation/advance-week` on a production league → **403** `NOT_TEST_LEAGUE`, no DB write
4. `POST /api/leagues` with `isTestLeague: false` and any `simulationWeekCount` value → persisted `Season.simulationWeekCount` is `NULL`

---

## Tasks / Subtasks

- [x] Task 1: Schema + migration (AC: #1)
  - [x] Add `simulationWeekCount` + `simulatedCurrentWeek` to `Season` in `prisma/schema.prisma`
  - [x] Additive migration via `npm run db:migrate`; confirm `npm run db:generate` reruns for typed selects
- [x] Task 2: Simulation bounds helper + create-body extension (AC: #2)
  - [x] `src/lib/league/simulation-week.ts` (+ `.test.ts`): `finalSimulationWeek`, `isSimulationWeekCountValid`, `isSimulationComplete`, `nextSimulationWeek`
  - [x] Extend `createLeagueBodySchema` (+ test): `simulationWeekCount` (1–18, default 4) + cross-field `superRefine` bound check
  - [x] Extend `POST /api/leagues`: persist `simulationWeekCount` only when `isTestLeague`; include in response
  - [x] Extend `create-league-form.tsx`: conditional "Simulation week count" `Select`
- [x] Task 3: Start-simulation wiring (AC: #3)
  - [x] Extend `pre-season-init/route.ts`: fetch `league.isTestLeague` via membership join; conditionally set `simulatedCurrentWeek` in the same `updateMany`
  - [x] No new UI — confirm existing `MarkLeagueReadySection` flow is unaffected for production leagues
- [x] Task 4: Advance-week endpoint (AC: #4)
  - [x] `src/lib/league/advance-simulation-week-body.ts` (+ test): `{ fromWeek }` Zod schema
  - [x] `src/app/api/leagues/[leagueId]/simulation/advance-week/route.ts` (POST): full guard chain (CSRF → auth → admin → isTestLeague → season → started → configured → bound → optimistic `updateMany`)
  - [x] `src/components/admin/AdminSimulationControls.tsx`: confirm `Dialog`, error states, calls `router.refresh()` on success
  - [x] Wire into `admin/page.tsx`: fetch season (`resolveCurrentSeasonForLeague`), render only when `access.league.isTestLeague`
- [x] Task 5: Week resolution dispatcher + preview fix (AC: #5, #6, #8)
  - [x] `src/lib/nfl/resolve-picks-week.ts`: add `resolveActiveWeekNumber`; extend `computePicksUiIsPreview` with `isTestLeague` param
  - [x] Update `build-league-picks-week-view.ts`, `build-submission-status.ts`, `build-admin-override-data.ts` to resolve `league.isTestLeague` (parallel `league.findUnique`) and call the dispatcher
  - [x] Regression tests: production-league path byte-identical to pre-8.2 behavior for all three
- [x] Task 6: Settings visibility (AC: #7)
  - [x] Add "Simulation week count" / "Current simulated week" read-only rows to `settings/page.tsx`, gated on `league.isTestLeague`
- [x] Task 7: Closeout
  - [x] `npm test` for all touched/new files
  - [x] Manual smoke (see Testing requirements)
  - [x] Update `deferred-work.md` disposition if any findings surface in review

### Review Findings

- [x] [Review][Defer] AC8 points 3 & 4 have no automated test coverage [src/app/api/leagues/[leagueId]/simulation/advance-week/route.ts, src/app/api/leagues/route.ts] — deferred, pre-existing convention. AC8 says "verify explicitly (as tests, not just review comments)" for all four points, but only points 1–2 (pure-function byte-identical checks) got tests. Points 3 (production league → 403 `NOT_TEST_LEAGUE` on `advance-week`, no DB write) and 4 (`POST /api/leagues` with `isTestLeague: false` → persisted `simulationWeekCount` is `NULL`) are only verified by code inspection. Reason: matches confirmed project-wide convention (no `route.ts` has a colocated integration test, per 8.1 review); AC8.3/8.4 verified by code inspection and cross-checked by two independent review layers instead.
- [x] [Review][Patch] `canResolveActiveWeek` in `build-admin-override-data.ts` not updated to be test-league-aware, unlike its sibling in `build-submission-status.ts` [src/lib/admin/build-admin-override-data.ts:31-39] — violates AC5's "in sync" requirement across the three call sites; `isTestLeague` is computed but never passed into this helper. **Fixed:** added `isTestLeague`/`simulatedCurrentWeek` awareness mirroring `build-submission-status.ts`.
- [x] [Review][Patch] Non-atomic advance-week response derivation [src/app/api/leagues/[leagueId]/simulation/advance-week/route.ts] — the optimistic `updateMany` and the follow-up `findUniqueOrThrow` used to build the response are separate round trips; a concurrent second advance in between can make the response reflect a state this caller didn't cause. **Fixed:** response fields now derived from `fromWeek + 1` and the already-known `season` values instead of a re-read.
- [x] [Review][Patch] Dead/unreachable error `Alert` block in `AdminSimulationControls.tsx` [src/components/admin/AdminSimulationControls.tsx] — `errorMessage && !open` can never be true given the component's state transitions (every path that sets `errorMessage` keeps the dialog open). **Fixed:** removed; the in-dialog `Alert` already covers every reachable error state.
- [x] [Review][Patch] Positional boolean parameter on `resolveActiveWeekNumber(isTestLeague, ...)` / `canResolveActiveWeek(season, games, isTestLeague)` [src/lib/nfl/resolve-picks-week.ts, src/lib/admin/build-submission-status.ts] — inconsistent with `computePicksUiIsPreview`'s named-object style introduced in the same diff; boolean-trap risk at call sites. **Fixed:** both converted to named-object args; all call sites and tests updated.
- [x] [Review][Patch] Non-null assertions (`!`) on nullable `Season` fields [src/app/api/leagues/[leagueId]/simulation/advance-week/route.ts, src/components/admin/AdminSimulationControls.tsx] — safe today because the values are guarded immediately beforehand, but fragile style. **Fixed:** route no longer re-reads (see above, assertions removed entirely); `AdminSimulationControls` narrows via `!= null` checks instead of `!`.
- [x] [Review][Patch] `isSimulationComplete` uses `===` rather than `>=` against the final week [src/lib/league/simulation-week.ts] — no live bug today since nothing can move the pointer past the final week, but not self-defensive against future writers. **Fixed:** changed to `>=`.
- [x] [Review][Patch] Hardcoded default `4` for `simulationWeekCount` duplicated in both the Zod schema and the React form with no shared constant [src/lib/league/create-league-body.ts, src/app/(app)/leagues/new/create-league-form.tsx]. **Fixed:** extracted `DEFAULT_SIMULATION_WEEK_COUNT` in `simulation-week.ts`, used by both.
- [x] [Review][Patch] `AdminSimulationControls`'s `ApiErrorBody.simulatedCurrentWeek` field is parsed from the 409 response but never used (component calls `router.refresh()` instead) [src/components/admin/AdminSimulationControls.tsx] — either use it or drop it from the type. **Fixed:** dropped the unused field from the type.
- [x] [Review][Defer] `readJsonObject` reimplemented verbatim in the new route [src/app/api/leagues/[leagueId]/simulation/advance-week/route.ts] — deferred, pre-existing (already duplicated across 13+ existing route files project-wide before this story; not introduced by this change)

## Dev Notes

### What this story is (and is NOT)

| **Is** | **Is NOT** |
|--------|------------|
| `Season.simulationWeekCount` / `simulatedCurrentWeek` fields | Fixture/seed odds or jailed overrides for simulated weeks (**8.3**) |
| Admin-driven week-pointer advance (confirm + idempotent) | Simulated game results / scoring / reveal (**8.4**) |
| Picks page + admin dashboard resolve simulated week correctly | Email suppress / simulate-send / cron rehearsal policy (**8.5**) |
| Fix to `computePicksUiIsPreview` so rehearsal picks aren't permanently blocked | Deadline enforcement changes — real kickoff-based deadlines (Story 3.5) are **unchanged** |
| Settings read-only visibility | Editing `simulationWeekCount` after creation |
| Reuse of `pre-season-init` as the "start simulation" trigger | A second "start simulation" button/endpoint |
| | Rehearsal runbook (**8.6**) / delete cleanup (**8.7**) |

### Critical design decision you must understand before coding

**The week "clock" and the week "data" are decoupled in this story.** Advancing `simulatedCurrentWeek` only moves a pointer. It does **not** create `NflGame` rows, odds lines, or `NflWeekJailedTeam` rows for that week number. Those come from Story 8.3 (fixture odds/jailed) or from the real synced NFL schedule (Story 3.9) if it happens to already cover that `(nflSeasonYear, weekNumber)`.

**Concretely, after this story ships:**
- The picks page will render (weekNumber = simulated week) with **zero matchups** if no `NflGame` rows exist for `(season.nflSeasonYear, simulatedCurrentWeek)` — this is expected, not a bug.
- `POST /api/leagues/[leagueId]/picks` will still 400 `GAMES_NOT_LOADED` / `JAILED_NOT_COMPUTED` for a simulated week with no schedule/jailed data — **do not** try to fix this in 8.2; it is Story 8.3's job to supply that data. This story's manual smoke test should therefore expect "picks page loads, shows the right week number, shows no games" as a **pass**, not a failure, for weeks with no fixture data yet.
- If the real NFL schedule for the season year has already been synced (Story 3.9) and happens to cover the simulated week numbers, the picks page will show **real** games/odds for that week — also expected; Epic 8 rehearsal is explicitly meant to run against real integrations where convenient (epics.md: "Validate the full product with real people and real integrations").

### Why AC6 (`computePicksUiIsPreview` fix) is not optional

Without it, this entire story ships a working "advance week" button that has **zero visible effect** for participants: the picks page would always show `isPreview: true` (because rehearsal happens before the real season, so `now` is always before the real earliest kickoff), which disables pick submission unconditionally via `WeekMatchupList`'s `interactive = !isPreview`. Verify this with a test **before** touching the advance-week endpoint — it is cheap to get wrong and expensive to debug later (would look like "the advance button doesn't work" when the real bug is upstream in preview gating).

### Locked product decisions (do not re-litigate in implementation)

1. **Two nullable `Season` columns**, not a new model — mirrors `firstCompetitionWeek` placement; per-season, per-league via existing FK.
2. **Reuse `pre-season-init` as "start simulation"** — no new start endpoint/button. Sets `simulatedCurrentWeek = firstCompetitionWeek` atomically for test leagues only.
3. **`simulationWeekCount` is create-time only** — no PATCH endpoint in this story.
4. **Advance-week idempotency = optimistic `updateMany` on `(id, simulatedCurrentWeek: fromWeek)`**, exactly like the existing `pre-season-init` conditional-write pattern — plus a client confirm dialog as a second layer (belt-and-suspenders, matches epic's "idempotent **or** confirm-gated" with both).
5. **Deadline enforcement is untouched.** Real kickoff-based deadlines (Story 3.5) still apply if/when real games exist for a simulated week. This is safe because rehearsal happens pre-season (all real kickoffs are in the future), so deadlines won't block rapid advancement in practice.
6. **`resolveActiveWeekNumber` wraps `resolvePicksWeekNumber`** rather than replacing it — production-league path is a pure passthrough, zero behavior change, easiest to prove correct in review.

### Reuse — do NOT reinvent

| Need | Reuse |
|------|--------|
| "Start simulation" trigger | `POST /api/leagues/[leagueId]/pre-season-init` (Story 2.3) — extend, don't duplicate |
| Idempotent conditional update | `prisma.season.updateMany({ where: { id, <field>: <expected> } })` pattern from `pre-season-init` |
| Admin-gated route skeleton | `first-competition-week/route.ts` — same CSRF → auth → admin-membership → season-lookup chain |
| Confirm-dialog UI | `DeleteLeagueDialog` pattern, simplified (no typed token — this action is much lower-risk) |
| Settings read-only row pattern | `settings/page.tsx` existing `<dl>` (`dt`/`dd`) blocks — same as the 8.1 "League type" row |
| Client fetch+error-state pattern | `FirstCompetitionWeekSettings` / `AdminReminderControls` |
| Week bound checks | `isNflRegularSeasonWeek` / `NFL_REGULAR_SEASON_WEEK_MAX` (`src/lib/nfl/nfl-regular-season.ts`) |
| Admin dashboard week context | `buildSubmissionStatus` header pattern in `admin/page.tsx` |
| Layout flex | MUI **`Stack`** preferred over `Box` |

### UX requirements (required front-end consultation)

[Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Test / rehearsal leagues]

- The UX spec's rehearsal guidance is about **labeling** (banner/chip — already shipped in 8.1) and does not add new visual requirements for this story's admin controls. Follow existing MUI patterns rather than inventing new ones.
- **Do not** conflate the `TestLeagueBanner` (persistent rehearsal labeling, 8.1) with `PicksPreviewBanner` (pre-season preview, separate concept) — this story's AC6 fix changes *when* `isPreview` is true for test leagues, but the two banners remain distinct components; no new banner component is needed here.
- Admin dashboard is already a dense, per-week operations page (reminders, email composer, jailed verification, audit log) — `AdminSimulationControls` should read as one more card in that same idiom (`Paper` + `Stack`, per `AdminReminderControls`), not a new visual language.

### Architecture / project-context compliance

- Multi-tenancy: simulation fields are on `Season`, already scoped by `leagueId` FK — no cross-league leakage possible.
- Prisma singleton `@/lib/db`; snake_case `@map` columns; camelCase API JSON (`simulationWeekCount`, `simulatedCurrentWeek`).
- Errors: `{ error: { code, message } }`, `400/401/403/404/409` as appropriate — see AC4 for the full code list.
- CSRF/same-origin: body-parse-then-`assertCookieSessionMutationOrigin`-then-`auth()` ordering, matching `pre-season-init` and `first-competition-week`.
- Rate limiting: `advance-week` is **not** added to `src/proxy.ts`'s `shouldRateLimitPost` — admin-gated, low abuse surface, same documented exception as `first-competition-week` PATCH. State this explicitly in the new route's JSDoc header (don't leave it silently unrated-limited without explanation).
- Prefer RSC pages; `"use client"` for `AdminSimulationControls` (MUI `Dialog` + fetch + state).
- Colocated Vitest for every new/changed pure helper.

[Source: `_bmad-output/planning-artifacts/epics.md` — Epic 8; Story 8.2]
[Source: `_bmad-output/planning-artifacts/architecture.md` — Test / rehearsal leagues]
[Source: `docs/project-context.md` — non-negotiables]

### File structure (expected touch list)

**Create**

- `src/lib/league/simulation-week.ts` (+ `.test.ts`)
- `src/lib/league/advance-simulation-week-body.ts` (+ `.test.ts`)
- `src/app/api/leagues/[leagueId]/simulation/advance-week/route.ts`
- `src/components/admin/AdminSimulationControls.tsx`
- `prisma/migrations/<timestamp>_add_season_simulation_fields/migration.sql` (via migrate)

**Modify**

- `prisma/schema.prisma` — `Season.simulationWeekCount`, `Season.simulatedCurrentWeek`
- `src/lib/nfl/resolve-picks-week.ts` (+ test) — `resolveActiveWeekNumber`, `computePicksUiIsPreview(isTestLeague)`
- `src/lib/league/create-league-body.ts` (+ test) — `simulationWeekCount` + cross-field refine
- `src/app/api/leagues/route.ts` — persist + serialize `simulationWeekCount`/`simulatedCurrentWeek`
- `src/app/api/leagues/[leagueId]/pre-season-init/route.ts` — conditionally set `simulatedCurrentWeek`
- `src/app/(app)/leagues/new/create-league-form.tsx` — conditional week-count `Select`
- `src/lib/picks/build-league-picks-week-view.ts` — dispatcher + preview fix wiring
- `src/lib/admin/build-submission-status.ts` (+ test) — dispatcher wiring
- `src/lib/admin/build-admin-override-data.ts` — dispatcher wiring
- `src/app/(app)/leagues/[leagueId]/admin/page.tsx` — fetch season, render `AdminSimulationControls`
- `src/app/(app)/leagues/[leagueId]/settings/page.tsx` — read-only rows

**Do not touch** (explicitly out of scope — see Dev Notes "Is NOT" table): `get-jailed-verification.ts`, `get-tuesday-digest-data.ts`, `get-reminder-data.ts`, `send-*.ts` email senders, `get-active-league-ids.ts`, any `NflGame`/odds/jailed write paths, `list-administered-leagues.ts`/`list-joined-leagues.ts`.

### Previous story intelligence

**Story 8.1 (test league flag, labeling, gates)**

- `League.isTestLeague` already exists and is available via `getLeagueAccess` (`access.league.isTestLeague`) in every page that needs it.
- 8.1's own foundation note (AC6): "every later simulation behavior MUST no-op or 403 for `isTestLeague === false`" — this story's AC8 tests are exactly that guardrail.
- 8.1 code review found a mobile-viewport labeling gap and header-sanitization issues in unrelated files — not relevant to 8.2's surface area, but confirms this project's review process is thorough on isTestLeague-gated code paths; expect the same scrutiny here.
- 8.1 deferred item: "no route-handler test for `TEST_LEAGUES_DISABLED` 403" — **pattern confirmed project-wide**: no `route.ts` anywhere has a colocated integration test. Do **not** add one for `advance-week`; unit-test the pure helpers (`simulation-week.ts`) and the Zod body schema instead, consistent with existing convention.

**Story 2.3 (pre-season init) / 2.7 (first competition week)**

- `pre-season-init` route's exact ordering (JSON parse → Zod → CSRF → auth → admin-check → `updateMany` conditional guard → re-fetch) is the template for `advance-week`.
- `isFirstCompetitionWeekEditable` / `firstCompetitionWeekLockedAt` shows the precedent for "editable until X, then locked" — deliberately **not** reused for `simulationWeekCount` (create-time only is simpler and sufficient per AC2).

**Git pattern (recent, Story 8.1):** focused commits per task group, colocated tests alongside every new pure helper, `docs/deployment.md`/`deferred-work.md` touched only if new ops-relevant env vars or findings surface (none expected here — no new env vars in this story).

### Deferred-work disposition for this story

Consulted `_bmad-output/implementation-artifacts/deferred-work.md` while planning.

| Item | Disposition |
|------|-------------|
| "No route-handler test for `TEST_LEAGUES_DISABLED` 403" (8.1) | **Confirms convention** — same non-pattern applies to the new `advance-week` route; no route-level test added, matching project-wide precedent |
| Epic 7 retro: "Authenticated Lighthouse re-measure for picks/standings" | **Still not actionable** — needs a populated, reachable simulated week (8.2 alone gives the clock, not fixture data); revisit once 8.3/8.4 land real simulated content |
| Epic 7 retro: "Real pick-submit NFR5 timing sample" | **Still not actionable** — same reason; picks can't actually be submitted for a simulated week until 8.3 supplies games/jailed data |
| Everything else in `deferred-work.md` | **Unrelated** to week-clock mechanics — no action |

No deferred items were found that this story should absorb; the two Epic 7 retro items above remain correctly parked until later Epic 8 stories supply the missing data.

### Testing requirements

1. **Unit:** `src/lib/league/simulation-week.ts` — `finalSimulationWeek`, `isSimulationWeekCountValid` (valid/invalid bound combos), `isSimulationComplete`, `nextSimulationWeek` (not-started / mid-simulation / at-final-week)
2. **Unit:** `createLeagueBodySchema` — `simulationWeekCount` default/range/coercion; cross-field refine rejects `firstCompetitionWeek + simulationWeekCount - 1 > 18` only when `isTestLeague: true`
3. **Unit:** `advanceSimulationWeekBodySchema` — `fromWeek` range/coercion
4. **Unit:** `resolveActiveWeekNumber` — test-league path returns `simulatedCurrentWeek`; production-league path is byte-identical to `resolvePicksWeekNumber` for the same inputs (this is the AC8 regression proof)
5. **Unit:** `computePicksUiIsPreview` — **new required case:** test league, `preSeasonInitializedAt` set, `now` far before any real kickoff → `false` (AC6's core regression guard). Plus: existing production-league cases must all still pass with `isTestLeague: false` (or omitted) unchanged.
6. **Unit:** `build-submission-status.test.ts` — add a test-league case asserting `weekNumber === season.simulatedCurrentWeek` regardless of `now`
7. **Manual:**
   - Create test league with `simulationWeekCount = 4`, `firstCompetitionWeek = 1` → mark ready → picks page shows Week 1, not preview-gated
   - Click "Advance to Week 2" with confirm dialog → picks page now shows Week 2; admin dashboard header matches
   - Advance 3 more times → 5th attempt returns `SIMULATION_COMPLETE`, button disabled
   - Double-click advance rapidly (or replay a stale `fromWeek`) → second request gets `SIMULATION_WEEK_STALE`, no double-advance
   - Create a **production** league → no simulation controls anywhere; `POST .../simulation/advance-week` → 403 `NOT_TEST_LEAGUE`
   - Settings page shows correct read-only simulation rows for a test league; no rows for a production league
8. Run **`npm test`** after adding/changing tests

### Latest technical notes

- No new npm dependencies. `Dialog`/`DialogActions`/`DialogContent`/`DialogTitle` already used by `DeleteLeagueDialog` — same MUI version, no version research needed.
- Prisma: two additive nullable `Int?` columns is the lowest-risk migration shape available (same class as 8.1's `isTestLeague` boolean addition).

### Project context reference

- Read `docs/project-context.md` before implementing — especially non-negotiable #8 (`firstCompetitionWeek` / "current week" must never assume Week 1) and #6 (camelCase JSON / snake_case DB).
- This story is squarely the "admin-driven week advance" half of Epic 8's rehearsal capability; the "what data exists at that week" half is Story 8.3.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 8; Story 8.2]
- [Source: `_bmad-output/planning-artifacts/prd.md` — Rehearsal / test leagues planning supplement]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Test / rehearsal leagues cross-cutting]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Test / rehearsal leagues]
- [Source: `docs/project-context.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`]
- [Source: `_bmad-output/implementation-artifacts/8-1-test-league-flag-labeling-and-optional-global-gates.md` — `isTestLeague` foundation, AC6 no-op rule, `TestLeagueBanner`/`TestLeagueChip`]
- [Source: `_bmad-output/implementation-artifacts/2-3-pre-season-league-initialization.md` — `preSeasonInitializedAt` semantics, `pre-season-init` route pattern]
- [Source: `_bmad-output/implementation-artifacts/2-7-first-nfl-competition-week-at-league-creation-mid-season-start.md` — `firstCompetitionWeek` editability precedent]
- [Source: `_bmad-output/implementation-artifacts/3-6-picks-ui-matchups-odds-spread-weather-optional.md` — `resolvePicksWeekNumber` / `computePicksUiIsPreview` original design]
- [Source: `_bmad-output/implementation-artifacts/3-5-deadline-enforcement-server-authority.md` — deadline enforcement boundary, intentionally untouched by this story]

## Change Log

- 2026-07-19: Implemented Story 8.2 — Season simulation clock fields, create-time week count, pre-season-init start, admin advance-week (confirm + optimistic updateMany), `resolveActiveWeekNumber` + test-league preview fix, settings read-only rows. Status → review.
- 2026-07-19: Code review — 1 decision resolved (AC8.3/8.4 test-coverage gap deferred, matching Story 8.1 precedent), 8 patches applied (AC5 `build-admin-override-data.ts` sync fix, non-atomic advance-week response race, dead code removal, named-object params, non-null assertions, `isSimulationComplete` defensive `>=`, shared `DEFAULT_SIMULATION_WEEK_COUNT` constant, unused type field), 2 deferred to `deferred-work.md`. `npm test` 70/422 green post-fix. Status → done.

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

None.

### Completion Notes List

- Additive Prisma migration `20260720000736_add_season_simulation_fields` adds nullable `simulation_week_count` / `simulated_current_week` on `seasons`.
- Test-league create form shows Simulation week count (default 4); Zod cross-field refine rejects sims past Week 18; production leagues always persist `NULL` for both sim fields.
- Reused `pre-season-init` to start the clock (`simulatedCurrentWeek = firstCompetitionWeek`) for test leagues only — no second start button.
- `POST .../simulation/advance-week` implements full AC4 guard chain + confirm dialog UI; not rate-limited (documented exception like first-competition-week PATCH).
- `resolveActiveWeekNumber` + `computePicksUiIsPreview({ isTestLeague })` wired into picks week view, submission status, and admin override data; production path remains passthrough.
- `buildSubmissionStatus` returns simulated week even with zero `NflGame` rows (expected until 8.3).
- No deferred-work.md updates — no new findings; Epic 7 retro items remain correctly parked until 8.3/8.4.
- **QA caution:** marking a test league ready also makes it eligible for Tuesday/Wed/Thu cron email jobs until Story 8.5.
- `npm test`: 70 files / 422 tests passed.

### File List

**Created**

- `prisma/migrations/20260720000736_add_season_simulation_fields/migration.sql`
- `src/lib/league/simulation-week.ts`
- `src/lib/league/simulation-week.test.ts`
- `src/lib/league/advance-simulation-week-body.ts`
- `src/lib/league/advance-simulation-week-body.test.ts`
- `src/app/api/leagues/[leagueId]/simulation/advance-week/route.ts`
- `src/components/admin/AdminSimulationControls.tsx`

**Modified**

- `prisma/schema.prisma`
- `src/lib/league/create-league-body.ts`
- `src/lib/league/create-league-body.test.ts`
- `src/app/api/leagues/route.ts`
- `src/app/(app)/leagues/new/create-league-form.tsx`
- `src/app/api/leagues/[leagueId]/pre-season-init/route.ts`
- `src/lib/nfl/resolve-picks-week.ts`
- `src/lib/nfl/resolve-picks-week.test.ts`
- `src/lib/picks/build-league-picks-week-view.ts`
- `src/lib/admin/build-submission-status.ts`
- `src/lib/admin/build-submission-status.test.ts`
- `src/lib/admin/build-admin-override-data.ts`
- `src/app/(app)/leagues/[leagueId]/admin/page.tsx`
- `src/app/(app)/leagues/[leagueId]/settings/page.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
