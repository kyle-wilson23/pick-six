# Pre-Epic 5: Fix validateJailedLineupAndBonus Unconditional Opponent Lookup

Status: done

## Context

Surfaced during Story 4.2 code review (deferred item in `deferred-work.md`). Initially framed as a "bye-week outage" risk. After analysis at the Epic 4 retrospective (2026-06-11), the production risk is lower than originally assessed — see "Revised risk assessment" below. Retaining as a pre-epic-5 defensive correctness fix.

## Revised Risk Assessment

The jailed team is selected by `resolveJailedTeam` from `gamesWithCompleteLines` — only teams with active odds data for that week enter the computation. A team on a bye has no scheduled game and no odds, so **cannot be selected as the jailed team**. Under normal operation, the jailed team always plays that week and `getOpponentOfJailedInWeek` will always return `{ ok: true }`.

The `{ ok: false }` path is only reachable under data integrity anomalies:
- A game is cancelled or rescheduled after jailed computation ran (the jailed team row persists but their game no longer appears in `weekGames`)
- Schedule and odds data loaded out of sync (odds exist, game row missing)

**Severity: Low** — not a likely production scenario under normal operation. Retained as a pre-epic-5 item because the fix is a one-line gate and makes the domain function semantically correct regardless of data state.

## Problem

`validateJailedLineupAndBonus` in `src/lib/domain/picks.ts` (lines 79–88) calls `getOpponentOfJailedInWeek` unconditionally. If `getOpponentOfJailedInWeek` returns `{ ok: false }` for any reason, the function returns `JAILED_NOT_IN_WEEK_GAMES` — blocking **all** pick submissions, not just anti-jailed paths.

The opponent lookup is only semantically needed when `antiJailedBonus: true`. For any regular pick, whether the jailed team has an opponent is irrelevant.

## Acceptance Criteria

1. **Regular picks succeed when jailed team has no opponent in week games**

   **Given** the jailed team has no scheduled game in the current week's `NflGame` rows (data anomaly scenario)

   **When** a participant submits a regular pick (`antiJailedBonus: false`) for any non-jailed team

   **Then** the pick succeeds — `validateJailedLineupAndBonus` does not return `JAILED_NOT_IN_WEEK_GAMES`

2. **Anti-jailed picks fail gracefully with a user-friendly message**

   **Given** the jailed team has no opponent in the current week's games

   **When** a participant submits a pick with `antiJailedBonus: true`

   **Then** the API returns `400 JAILED_NOT_IN_WEEK_GAMES`

   **And** the error message is user-facing and actionable: `"The anti-jailed bonus is unavailable this week. Please contact your league admin if you need assistance submitting your pick."`

3. **Direct jailed team pick still rejected**

   **Given** the jailed team is in a game (normal operation)

   **When** a participant submits `teamId = jailedTeamId` with `antiJailedBonus: false`

   **Then** the API returns `400 JAILED_TEAM_PICK` — unchanged from current behavior

4. **Existing test suite passes unchanged** — all 227 current tests green; new tests added for AC1 and AC2

## Tasks / Subtasks

- [x] **Fix `validateJailedLineupAndBonus` in `src/lib/domain/picks.ts`**
  - [x] Gate `getOpponentOfJailedInWeek` call behind `if (antiJailedBonus)` check
  - [x] When `antiJailedBonus: false`: only check `teamId !== jailedTeamId`; skip opponent lookup entirely
  - [x] When `antiJailedBonus: true`: retain existing logic — opponent lookup required, return `JAILED_NOT_IN_WEEK_GAMES` if no opponent found

- [x] **Update `src/lib/domain/picks.test.ts`** (or wherever `validateJailedLineupAndBonus` tests live)
  - [x] Add test: regular pick (`antiJailedBonus: false`) succeeds when jailed team has a bye (no opponent in week games)
  - [x] Add test: anti-jailed pick (`antiJailedBonus: true`) fails with `JAILED_NOT_IN_WEEK_GAMES` when jailed team has a bye
  - [x] Verify existing tests for direct jailed pick rejection still pass

- [x] **`npm test` green; `npm run lint`; `npm run build`** before closing

## Dev Notes

### Current (broken) code path

```ts
// src/lib/domain/picks.ts — current implementation
export function validateJailedLineupAndBonus(...) {
  const opponentResult = getOpponentOfJailedInWeek(jailedTeamId, weekGames);
  if (!opponentResult.ok) {
    return { ok: false, code: "JAILED_NOT_IN_WEEK_GAMES", ... };  // ← blocks ALL picks
  }
  if (teamId === jailedTeamId) {
    return { ok: false, code: "JAILED_TEAM_PICK", ... };
  }
  if (antiJailedBonus && teamId !== opponentResult.opponentId) {
    return { ok: false, code: "ANTI_JAILED_WRONG_TEAM", ... };
  }
  return { ok: true };
}
```

### Fixed code path

```ts
// Gate opponent lookup on antiJailedBonus
export function validateJailedLineupAndBonus(...) {
  // Direct jailed pick always rejected regardless of bye
  if (teamId === jailedTeamId) {
    return { ok: false, code: "JAILED_TEAM_PICK", ... };
  }

  if (antiJailedBonus) {
    // Anti-jailed bonus requires jailed team to have an opponent this week
    const opponentResult = getOpponentOfJailedInWeek(jailedTeamId, weekGames);
    if (!opponentResult.ok) {
      return { ok: false, code: "JAILED_NOT_IN_WEEK_GAMES", ... };
    }
    if (teamId !== opponentResult.opponentId) {
      return { ok: false, code: "ANTI_JAILED_WRONG_TEAM", ... };
    }
  }

  return { ok: true };
}
```

### Note on direct jailed pick in bye weeks

When the jailed team has a bye, `teamId === jailedTeamId` is still rejected (AC3). The jailed team not playing doesn't make it a valid pick — the rule is "you cannot pick the jailed team" full stop.

### User-facing error message (AC2)

The existing `JAILED_NOT_IN_WEEK_GAMES` error message is likely technical. Update the message string in `validateJailedLineupAndBonus` to be participant-friendly:

```ts
return {
  ok: false,
  code: "JAILED_NOT_IN_WEEK_GAMES",
  message: "The anti-jailed bonus is unavailable this week. Please contact your league admin if you need assistance submitting your pick.",
};
```

### Admin recourse — no jailed team override exists

The league admin does **not** have a mechanism to change or override the jailed team for a week. The jailed team is frozen after computation (product decision: Story 4.4 is read-only verification only). If the data anomaly scenario blocked participants from submitting picks:

- The admin's only product-level recourse is to use **Story 4.2's pick override** (`POST /api/leagues/[leagueId]/admin/picks`) to place or change picks on behalf of affected participants
- The user-facing error message (AC2) should direct participants to contact their admin so the admin knows to take that action

A future "admin jailed team override" capability could be scoped if the need arises, but is explicitly out of scope here and not planned in the current epic roadmap.

### Callers

This function is called in:
- `src/app/api/leagues/[leagueId]/picks/route.ts` — participant pick submission
- `src/lib/admin/submit-pick-on-behalf.ts` — admin override pick submission

Both callers benefit from the fix with no changes required at the call sites. The improved error message in AC2 flows through to both.

### References

- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — "Deferred from: code review of 4-2", item: `validateJailedLineupAndBonus blocks all picks when jailed team has a bye`]
- [Source: `src/lib/domain/picks.ts` — function to fix]
- [Source: Epic 4 retrospective 2026-06-11 — elevated to critical path pre-Epic 5]

### Review Findings

- [x] [Review][Patch] Extract `JAILED_NOT_IN_WEEK_GAMES` message to a named constant — duplicated verbatim across `picks.ts` and `picks.test.ts`; a copy change requires two edits [`src/lib/domain/picks.ts:86-88`, `src/lib/domain/picks.test.ts:hunk`]
- [x] [Review][Patch] Update JSDoc on `validateJailedLineupAndBonus` to document the new contract — the comment does not reflect the conditional opponent-lookup behavior [`src/lib/domain/picks.ts:~42-55`]
- [x] [Review][Patch] Add test: `antiJailedBonus: true` + `teamId` not in `games` — pins guard order (`TEAM_NOT_IN_WEEK` fires before `antiJailedBonus` block) against future refactors [`src/lib/domain/picks.test.ts`]
- [x] [Review][Patch] Add test: `antiJailedBonus: true` + `teamId === jailedTeamId` — pins that `JAILED_TEAM_PICK` takes priority over the anti-jailed block regardless of `antiJailedBonus` flag [`src/lib/domain/picks.test.ts`]
- [x] [Review][Patch] Extract `"jailed-on-bye"` fixture string to a named constant — repeated 3× across new tests; a rename requires 3 manual edits [`src/lib/domain/picks.test.ts:hunk`]
- [x] [Review][Defer] Third new test redundant to AC3 coverage [`src/lib/domain/picks.test.ts:hunk`] — deferred, pre-existing; existing tests already satisfy AC3 (in-game scenario); this test adds bye-scenario confidence but contradicts the AC3 precondition ("normal operation")
- [x] [Review][Defer] Test assertions on exact user-facing message copy are brittle to copywriting changes [`src/lib/domain/picks.test.ts`] — deferred, pre-existing; test philosophy convention question for broader test suite
- [x] [Review][Defer] `JAILED_NOT_IN_WEEK_GAMES` error code name now semantically misleading after scope narrowing [`src/lib/domain/picks.ts:85`] — deferred, pre-existing; renaming touches API error contract and all callers; out of scope for this story
- [x] [Review][Defer] No determinism test for `getOpponentOfJailedInWeek` when jailed team appears in multiple games [`src/lib/domain/picks.ts:hunk`] — deferred, pre-existing; belongs in `getOpponentOfJailedInWeek` unit coverage, not this validator

## Dev Agent Record

### Agent Model Used

claude-4.6-sonnet-medium-thinking (Cursor agent)

### Debug Log References

### Implementation Plan

Gated `getOpponentOfJailedInWeek` behind `if (antiJailedBonus)` so regular picks no longer fail when the jailed team is absent from week games (data anomaly / bye scenario). Direct jailed pick rejection remains first in the function. Updated `JAILED_NOT_IN_WEEK_GAMES` message to participant-friendly copy per AC2.

### Completion Notes List

- `validateJailedLineupAndBonus` now skips opponent lookup for regular picks; anti-jailed path unchanged except for improved error message.
- Added 3 unit tests: regular pick succeeds with jailed-on-bye, anti-jailed fails with user-facing message, direct jailed pick still rejected on bye.
- 230 tests pass (was 227 + 3 new). `npm run build` green. `npm run lint` reports 2 pre-existing errors in `AdminPickOverrideDialog.tsx` (unrelated to this story).

### File List

- `src/lib/domain/picks.ts` (modified)
- `src/lib/domain/picks.test.ts` (modified)

### Change Log

- 2026-06-11: Gate jailed opponent lookup on `antiJailedBonus`; improve `JAILED_NOT_IN_WEEK_GAMES` message; add bye-week domain tests.
