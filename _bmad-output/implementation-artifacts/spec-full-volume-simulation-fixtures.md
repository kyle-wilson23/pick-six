---
title: 'Full-volume simulation fixtures (~13–16 games/week)'
type: 'feature'
created: '2026-08-04'
status: 'done'
baseline_commit: '4b3980d19d6ab6af933c8315b2ca98b4710e9b77'
context:
  - '{project-root}/docs/project-context.md'
  - '{project-root}/docs/adr/001-hybrid-canonical-live-league-sim-schedule.md'
  - '{project-root}/_bmad-output/planning-artifacts/research/technical-league-scoped-vs-canonical-nfl-schedule-research-2026-08-04.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Test-league rehearsal still uses a sparse 6×4 fixture slate, so admin sim weeks do not feel like a real NFL card; `buildFixtureKickoffTimes` also only defines 4 slots and would duplicate `kickoffAt` for any fuller week.

**Approach:** Expand committed fixture JSON to typical NFL week volume (~13–16 games/week, ≥6 weeks) and teach kickoff generation to emit enough distinct realistic ET slots for that volume — still writing only into the league-scoped sim store via existing ensure/odds/results paths.

## Boundaries & Constraints

**Always:**
- Fixture ensure continues to upsert **only** `LeagueSimGame` (+ existing sim odds / league-jailed writers); never insert fixture rows into canonical `NflGame`.
- Keep ≥6 fixture weeks; each week 13–16 games; abbreviations only from `prisma/data/nfl-teams.json`; no team repeated within a week (`home !== away`).
- `buildFixtureKickoffTimes(anchorNow, gameCount)` returns `gameCount` kickoffs; earliest remains Thu 20:20 ET on the next Thursday ≥3 full days after `anchorNow`; all kickoffs after that floor; pick deadline from first kickoff still after `anchorNow`.
- For any `gameCount` up to 16, kickoffs are **pairwise distinct** (no `i % 4` recycling of identical timestamps).
- Preserve sim advance / odds / results / scoring flows and `resolveGamesForLeague` isolation; no Odds cron or live sync behavior changes; no extra Odds API pulls.
- When done: strike/resolve the deferred-work **Full-volume simulation fixtures** bullet (and the related kickoff-slot duplication note under 8.3 review).

**Ask First:**
- Changing fixture schema shape beyond `{ games: [{ home, away }] }[]`.
- Writing fixtures into `NflGame` or changing ensure to touch canonical tables.
- Lowering weeks below 6 or allowing <13 games/week as the committed default.

**Never:**
- Multiplying Odds `/events` or `/scores` pulls.
- Cron TNF backup, season-year UTC, or admin+cron locking (stay deferred).
- Regenerating kickoffs on re-apply when sim games already exist (`update: {}` stays).
- Per-real-league schedule copies or provenance-only coexistence on `NflGame`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Empty test week ensure | Test league; 0 `LeagueSimGame` for week | Upserts 13–16 sim rows from fixture cycle; distinct kickoffs | `TEAMS_NOT_SEEDED` if abbr missing |
| Full-volume kickoffs | `gameCount` 13–16 | Length N; all distinct; Thu 20:20 first; remaining in realistic Thu/Sun/Mon ET windows (stagger minutes within early/late Sunday if needed) | N/A |
| Structural load | Fixture JSON at import | ≥6 weeks; each week 13–16 games; valid abbrs; no intra-week team reuse | Test failure |
| Re-apply odds | Week already has sim games | No new fixture creates; odds/jailed as today | Existing codes |
| Real league | `isTestLeague=false` | Unchanged; never reads/writes fixture JSON into `NflGame` | N/A |

</frozen-after-approval>

## Code Map

- `prisma/data/nfl-simulation-fixture-schedule.json` — expand to ≥6 weeks × 13–16 games
- `prisma/data/nfl-teams.json` — abbreviation authority (32 teams; max 16 games/week)
- `src/lib/nfl/simulation-fixture-schedule.ts` — `selectFixtureMatchups`, `buildFixtureKickoffTimes`, `getFixtureScheduleWeeks`
- `src/lib/nfl/simulation-fixture-schedule.test.ts` — structural + kickoff tests (raise floor; assert distinct kickoffs for N>4)
- `src/lib/nfl/apply-simulation-odds-snapshot.ts` — `ensureFixtureSimGamesForWeek` (consumer; expect volume via matchups.length; no NflGame writes)
- `docs/adr/001-hybrid-canonical-live-league-sim-schedule.md` — drop “~4 games deferred” consequence
- `docs/rehearsal-runbook.md` — isolation row still says “4-game fixture cycle”
- `_bmad-output/implementation-artifacts/deferred-work.md` — Option B full-volume bullet + 8.3 kickoff-slot note

## Tasks & Acceptance

**Execution:**
- [x] `prisma/data/nfl-simulation-fixture-schedule.json` -- Expand each of ≥6 weeks to 13–16 distinct matchups (valid abbrs, no team twice/week); prefer hand-authored realistic rivalries over random noise
- [x] `src/lib/nfl/simulation-fixture-schedule.ts` -- Expand `buildFixtureKickoffTimes` slot list (and/or minute staggers in Sun early/late windows) so N≤16 yields pairwise-distinct UTC instants; update JSDoc; keep Thu 20:20 + 3-day floor behavior
- [x] `src/lib/nfl/simulation-fixture-schedule.test.ts` -- Raise structural floor to 13–16/week; assert distinct kickoffs for `gameCount` 4 and 16; keep modulo / deadline regression cases
- [x] `docs/adr/001-hybrid-canonical-live-league-sim-schedule.md` + `docs/rehearsal-runbook.md` -- Reflect full-volume fixtures (not deferred ~4-game slate)
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- Strike/resolve **Full-volume simulation fixtures** and the kickoff-slot duplication deferral as fixed by this work

**Acceptance Criteria:**
- Given the fixture JSON, when structural tests run, then ≥6 weeks exist, each with 13–16 games, only `nfl-teams.json` abbreviations, and no team appears twice in a week.
- Given `buildFixtureKickoffTimes(now, 16)`, when times are generated, then length is 16, all timestamps are unique, the first is Thu 20:20 ET ≥3 full days out, and `computePickDeadlineUtc(first)` is after `now`.
- Given an empty test-league sim week, when apply-odds-snapshot runs, then it creates that week’s fixture game count in `LeagueSimGame` only (zero `NflGame` fixture inserts) and existing odds/jailed success path still works.
- Given docs/deferred-work, when this ships, then full-volume is marked resolved and ADR/runbook no longer describe ~4-game fixtures as current/deferred state.

## Spec Change Log

## Design Notes

**Kickoff strategy:** Keep the Story 8.3 Thursday-first deadline trick. Expand beyond four slots with a realistic card order, e.g. Thu 20:20 → Sun early window (13:00, 13:05, …) → Sun late (16:05, 16:25, …) → Sun night 20:20 → Mon 20:15, adding minute offsets within a window so timestamps stay unique without inventing fake mid-week days. Do not cycle with modulo onto identical times.

**Fixture authorship:** 32 teams ⇒ at most 16 games/week with no byes; mix 13–16 across weeks to mimic bye weeks. Weeks cycle via existing `(weekNumber - 1) % weeks.length`.

**Out of scope for writers:** `apply-simulation-odds-snapshot` / results / scoring need no structural rewrite if they already key off `matchups.length` / game ids — only verify tests still pass.

## Verification

**Commands:**
- `npm test -- src/lib/nfl/simulation-fixture-schedule.test.ts` -- structural + kickoff ACs green
- `npm test -- src/lib/nfl/apply-simulation-odds-snapshot.test.ts` -- sim-only ensure still green
- `npm test` -- full suite green

**Manual checks (if no CLI):**
- Skim ADR 001 + rehearsal-runbook isolation row + deferred-work strikes for “4-game” language.

## Suggested Review Order

**Fixture volume**

- Entry point: 6 weeks mixed 13–16 games (bye-week volume).
  [`nfl-simulation-fixture-schedule.json:1`](../../prisma/data/nfl-simulation-fixture-schedule.json#L1)

**Distinct kickoffs**

- 16 ET slots; integer 0–16 guard; no modulo recycle.
  [`simulation-fixture-schedule.ts:43`](../../src/lib/nfl/simulation-fixture-schedule.ts#L43)

- Staggered Sun early/late + SNF/MNF for full cards.
  [`simulation-fixture-schedule.ts:76`](../../src/lib/nfl/simulation-fixture-schedule.ts#L76)

**Docs / deferred**

- ADR consequence: full-volume shipped (not deferred ~4).
  [`001-hybrid-canonical-live-league-sim-schedule.md:29`](../../docs/adr/001-hybrid-canonical-live-league-sim-schedule.md#L29)

- Option B full-volume + 8.3 kickoff deferrals struck.
  [`deferred-work.md:15`](./deferred-work.md#L15)

- Runbook isolation wording updated off “4-game”.
  [`rehearsal-runbook.md:216`](../../docs/rehearsal-runbook.md#L216)

**Tests**

- Structural floor 13–16 + distinctness / range guards.
  [`simulation-fixture-schedule.test.ts:22`](../../src/lib/nfl/simulation-fixture-schedule.test.ts#L22)
