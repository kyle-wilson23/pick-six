---
title: 'Retire API-Sports NFL integration'
type: 'chore'
created: '2026-08-04'
status: 'done'
baseline_commit: 'c7cf4900373864c4fab13087ee3f6ad900cdbaa3'
context:
  - '{project-root}/docs/project-context.md'
  - '{project-root}/docs/nfl-odds-integration.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Odds API is the operational source for NFL schedule and results, but unused API-Sports modules, sync helpers, and `API_SPORTS_*` env docs still clutter the repo and confuse operators.

**Approach:** Rehome the small shared team-lookup helpers Odds still needs, delete the API-Sports integration and its sync wrappers/tests, and remove `API_SPORTS_*` from `.env.example` plus operator docs.

## Boundaries & Constraints

**Always:**
- Keep The Odds API schedule/results/odds happy path unchanged (`syncNflScheduleFromOdds`, `syncNflResultsFromOdds`, admin routes/UI).
- Rehome `buildTeamLookup`, `ScheduleUpsertInput`, and `TeamLookup` before deleting `api-sports-nfl` (Odds mappers import them today).
- Prefer a neutral home under `src/lib/nfl/` (not inside `the-odds-api/`) so lookup stays provider-agnostic.
- Update operator-facing docs (`.env.example`, `docs/deployment.md`, `docs/nfl-odds-integration.md`) so they no longer require or document live `API_SPORTS_*` setup.
- Mark the deferred-work “Retire API-Sports” item resolved / removed when this ships.

**Ask First:**
- Deleting `API_SPORTS_KEY` / `API_SPORTS_HOST` from Vercel (or other hosted env) — ops outside this PR; remind in verification only.
- Rewriting historical BMAD story/epic retrospectives under `_bmad-output/` for past tense accuracy (leave unless human asks).

**Never:**
- Changing Odds week inference, orphan delete, or results `daysFrom=3` semantics.
- Leaving a husk `api-sports-nfl` package that only re-exports helpers.
- Exposing any NFL provider keys to the client.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Odds schedule map after rehome | Seeded teams + events fixture | Same upsert rows / week buckets as before move | Mapping errors unchanged |
| Odds results map after rehome | Seeded teams + scores fixture | Same FINAL/score updates as before move | Soft skips unchanged |
| Dead API-Sports entrypoints | Import/call old sync or client | Gone from tree; no admin/route references | N/A |
| Env template | Fresh `.env.example` | No `API_SPORTS_KEY` / `API_SPORTS_HOST` | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/integrations/api-sports-nfl/map-schedule.ts` -- extract `buildTeamLookup` / `ScheduleUpsertInput` / `TeamLookup`; delete API-Sports-only mappers with package
- `src/lib/nfl/team-lookup.ts` -- new home for shared lookup types/helpers (+ colocated tests for lookup behavior worth keeping)
- `src/lib/integrations/the-odds-api/map-schedule-from-events.ts` -- point imports at rehomed helpers
- `src/lib/integrations/the-odds-api/map-results-from-scores.ts` -- point imports at rehomed helpers
- `src/lib/integrations/api-sports-nfl/**` -- delete client, schemas, map-results, fixtures, tests
- `src/lib/nfl/sync-nfl-schedule.ts` (+ `.test.ts`) -- delete API-Sports-only schedule sync
- `src/lib/nfl/sync-nfl-results.ts` (+ `.test.ts`) -- delete API-Sports-only results sync
- `.env.example` -- remove legacy API-Sports block
- `docs/deployment.md` -- drop `API_SPORTS_*` from env tables/optional lists
- `docs/nfl-odds-integration.md` -- Odds-only ops authority; retire live API-Sports setup language (historical comparison tables may stay labeled historical)
- `_bmad-output/implementation-artifacts/deferred-work.md` -- close retire API-Sports deferred item

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/nfl/team-lookup.ts` (+ test) -- move `buildTeamLookup`, `ScheduleUpsertInput`, `TeamLookup` out of api-sports-nfl -- Odds must not depend on deleted package
- [x] `map-schedule-from-events.ts` + `map-results-from-scores.ts` -- retarget imports to `team-lookup`
- [x] Delete `src/lib/integrations/api-sports-nfl/**`, `sync-nfl-schedule.ts(.test)`, `sync-nfl-results.ts(.test)` -- remove unused provider surface
- [x] `.env.example` + `docs/deployment.md` + `docs/nfl-odds-integration.md` -- stop documenting live API-Sports keys/modules
- [x] `deferred-work.md` -- mark API-Sports retirement done
- [x] `npm test` -- confirm Odds schedule/results tests still pass; no api-sports fixtures required

**Acceptance Criteria:**
- Given the repo after this change, when searching `src/` for `api-sports`, `API_SPORTS_`, or `ApiSports`, then there are no matches.
- Given seeded teams and existing Odds fixtures, when schedule/results mapping unit tests run, then they pass with helpers imported from the new home.
- Given a new developer copies `.env.example`, when configuring NFL sync, then only `ODDS_API_KEY` (plus existing unrelated keys) is required — no `API_SPORTS_*`.
- Given operator docs, when reading schedule/results setup, then The Odds API is the sole documented operational provider.

## Spec Change Log

## Design Notes

Odds already owns schedule/results mapping; only team lookup was left under `api-sports-nfl` for historical reasons. Rehome that thin shared layer, then delete the package wholesale — do not keep provider-specific aliases (`JAC`→`JAX`, API-Sports stage filters, etc.) unless Odds still needs them (it does not today).

## Verification

**Commands:**
- `rg -n 'api-sports|API_SPORTS_|ApiSports' src` -- expected: no matches
- `npm test` -- expected: all green
- `rg -n 'API_SPORTS' .env.example docs/deployment.md` -- expected: no matches (or only historical prose if intentionally retained in nfl-odds-integration research section)

**Manual checks:**
- Remind human to remove `API_SPORTS_KEY` / `API_SPORTS_HOST` from Vercel if still set (outside repo).

## Suggested Review Order

**Shared helpers (rehome)**

- Provider-agnostic lookup + schedule upsert type after leaving api-sports-nfl
  [`team-lookup.ts:1`](../../src/lib/nfl/team-lookup.ts#L1)

- Odds schedule mapper now imports from `src/lib/nfl`
  [`map-schedule-from-events.ts:10`](../../src/lib/integrations/the-odds-api/map-schedule-from-events.ts#L10)

- Odds results mapper retargeted the same way
  [`map-results-from-scores.ts:5`](../../src/lib/integrations/the-odds-api/map-results-from-scores.ts#L5)

**Env + ops docs**

- Drop legacy `API_SPORTS_*` from the env template
  [`.env.example:40`](../../.env.example#L40)

- Env table + stale Vercel key cleanup note
  [`deployment.md:36`](../../docs/deployment.md#L36)

- Odds as sole schedule/results authority; historical comparison labeled
  [`nfl-odds-integration.md:38`](../../docs/nfl-odds-integration.md#L38)

**Supporting**

- Colocated lookup unit test
  [`team-lookup.test.ts:5`](../../src/lib/nfl/team-lookup.test.ts#L5)

- Deferred retirement item closed; obsolete API-Sports defers struck
  [`deferred-work.md:717`](./deferred-work.md#L717)
