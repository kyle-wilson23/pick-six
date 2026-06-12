# Pre-Epic 5: Extract Thursday Lockout Constant

Status: done

## Context

Surfaced during Story 3.5 code review, committed in the Epic 3 retrospective (2026-05-24) as "must close before Epic 5," carried through Epic 4 without resolution, and re-committed as a critical path item in the Epic 4 retrospective (2026-06-11).

The root cause of three missed iterations: no sprint-status entry and no story file. This story file closes that gap.

## Problem

The Thursday 8:10 PM pick deadline cutoff is represented as magic literals `20` (hour) and `10` (minute) scattered across `src/lib/domain/pick-deadline.ts` and its associated tests. There is no single authoritative named constant. Any future change to the lockout time requires hunting down all occurrences.

## Acceptance Criteria

1. **Named constants exported from `pick-deadline.ts`**

   **Given** `src/lib/domain/pick-deadline.ts`

   **Then** the file exports `THURSDAY_LOCK_HOUR` (value: `20`) and `THURSDAY_LOCK_MINUTE` (value: `10`) as named constants

   **And** all internal usages of the magic literals `20` and `10` in this file reference the named constants

2. **Test assertions updated**

   **Given** the test file(s) for `pick-deadline.ts`

   **Then** any hardcoded `20` or `10` literal used to construct Thursday deadline test times imports and uses the named constants instead of inline numbers

3. **No behavior change**

   **Given** the existing 227-test suite

   **When** `npm test` runs

   **Then** all tests pass — this is a pure rename refactor with no logic change

4. **Lint and build clean**

   **Given** `npm run lint` and `npm run build`

   **Then** both pass with no new errors

## Tasks / Subtasks

- [x] **Add named constants to `src/lib/domain/pick-deadline.ts`**
  - [x] Add `export const THURSDAY_LOCK_HOUR = 20;`
  - [x] Add `export const THURSDAY_LOCK_MINUTE = 10;`
  - [x] Replace all inline `20` and `10` literal usages in the file with the constants

- [x] **Update test file(s) for `pick-deadline.ts`**
  - [x] Import `THURSDAY_LOCK_HOUR` and `THURSDAY_LOCK_MINUTE`
  - [x] Replace hardcoded hour/minute literals used in Thursday deadline time construction with the named imports

- [x] **`npm test` green; `npm run lint`; `npm run build`** before closing

### Review Findings

- [x] [Review][Patch] JSDoc missing on `THURSDAY_LOCK_MINUTE` [`src/lib/domain/pick-deadline.ts`]
- [x] [Review][Patch] Test fixture date not documented as Thursday [`src/lib/domain/pick-deadline.test.ts`]
- [x] [Review][Patch] `parseInt` NaN guard missing before value assertions [`src/lib/domain/pick-deadline.test.ts`]
- [x] [Review][Defer] Magic `0` for seconds survives in `lockByThursdayDefaultUtc` call site [`src/lib/domain/pick-deadline.ts`] — deferred, pre-existing
- [x] [Review][Defer] No DST-boundary test for Thursday lockout hour [`src/lib/domain/pick-deadline.test.ts`] — deferred, pre-existing gap
- [x] [Review][Defer] Exported constants create implicit public API with no deprecation path [`src/lib/domain/pick-deadline.ts`] — deferred, pre-existing design concern
- [x] [Review][Defer] Kickoff exactly at `THURSDAY_LOCK_HOUR:THURSDAY_LOCK_MINUTE` untested in `computePickDeadlineUtc` [`src/lib/domain/pick-deadline.test.ts`] — deferred, pre-existing gap

## Dev Notes

### Scope is intentionally narrow

This story touches exactly two files: `src/lib/domain/pick-deadline.ts` and its co-located test. Do not refactor other callers of `checkPickMutationDeadline` or expand scope. The goal is a named constant at the source, not a project-wide refactor.

### Do not change behavior

The values `20` and `10` are correct. This is a naming change only — no changes to logic, no changes to the deadline time, no changes to how callers use the function.

### References

- [Source: `src/lib/domain/pick-deadline.ts` — `lockByThursdayDefaultUtc` function and associated constants]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — "Deferred from: code review of 3-5", item: "Thursday 8:10 PM cutoff is a magic literal, not a named constant"]
- [Source: `_bmad-output/implementation-artifacts/epic-3-retro-2026-05-24.md` — Action item 3: "Extract magic literal to a named export in `pick-deadline.ts`"]
- [Source: `_bmad-output/implementation-artifacts/epic-4-retro-2026-06-11.md` — Critical path item before Epic 5]

## Dev Agent Record

### Implementation Plan

Pure rename refactor touching exactly two files as scoped:

1. Added `THURSDAY_LOCK_HOUR = 20` and `THURSDAY_LOCK_MINUTE = 10` as named exports immediately after `PICK_DEADLINE_PASSED_USER_MESSAGE` in `pick-deadline.ts`.
2. Replaced the `new Date(ty, tm - 1, td, 20, 10, 0)` literal in `lockByThursdayDefaultUtc` with the named constants.
3. In the test file: imported both constants; added a new `"Thursday lockout constants"` describe block with two tests — one asserting the constant values directly (20 / 10), and one asserting that `lockByThursdayDefaultUtc` returns a time whose hour/minute in the league timezone matches the constants. This exercises the import in a meaningful way and locks in the expected values.
4. No other callers modified; no behavior change; no new dependencies.

### Completion Notes

- ✅ `THURSDAY_LOCK_HOUR` and `THURSDAY_LOCK_MINUTE` exported from `pick-deadline.ts`
- ✅ Magic literals `20, 10` replaced with named constants in `lockByThursdayDefaultUtc`
- ✅ Constants imported and used in test via two new tests in `"Thursday lockout constants"` describe block
- ✅ `npm test` — 234 tests pass (8 in pick-deadline.test.ts, up from 6), 0 failures
- ✅ `npm run build` — passes cleanly
- ✅ `npm run lint` — 2 pre-existing errors in `AdminPickOverrideDialog.tsx` (confirmed present before this story); no new errors introduced

## File List

- `src/lib/domain/pick-deadline.ts` (modified)
- `src/lib/domain/pick-deadline.test.ts` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — status tracking)
- `_bmad-output/implementation-artifacts/pre-epic-5-thursday-lockout-constant.md` (modified — this file)

## Change Log

- 2026-06-11: Extracted `THURSDAY_LOCK_HOUR` and `THURSDAY_LOCK_MINUTE` constants from magic literals in `pick-deadline.ts`; added constant-verification tests to `pick-deadline.test.ts`
