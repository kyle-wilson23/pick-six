# Pre-Epic 5: Extract Thursday Lockout Constant

Status: ready-for-dev

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

- [ ] **Add named constants to `src/lib/domain/pick-deadline.ts`**
  - [ ] Add `export const THURSDAY_LOCK_HOUR = 20;`
  - [ ] Add `export const THURSDAY_LOCK_MINUTE = 10;`
  - [ ] Replace all inline `20` and `10` literal usages in the file with the constants

- [ ] **Update test file(s) for `pick-deadline.ts`**
  - [ ] Import `THURSDAY_LOCK_HOUR` and `THURSDAY_LOCK_MINUTE`
  - [ ] Replace hardcoded hour/minute literals used in Thursday deadline time construction with the named imports

- [ ] **`npm test` green; `npm run lint`; `npm run build`** before closing

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
