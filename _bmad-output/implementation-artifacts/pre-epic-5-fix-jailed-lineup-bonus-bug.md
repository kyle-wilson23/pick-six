# Pre-Epic 5: Fix validateJailedLineupAndBonus Unconditional Opponent Lookup

Status: ready-for-dev

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

- [ ] **Fix `validateJailedLineupAndBonus` in `src/lib/domain/picks.ts`**
  - [ ] Gate `getOpponentOfJailedInWeek` call behind `if (antiJailedBonus)` check
  - [ ] When `antiJailedBonus: false`: only check `teamId !== jailedTeamId`; skip opponent lookup entirely
  - [ ] When `antiJailedBonus: true`: retain existing logic — opponent lookup required, return `JAILED_NOT_IN_WEEK_GAMES` if no opponent found

- [ ] **Update `src/lib/domain/picks.test.ts`** (or wherever `validateJailedLineupAndBonus` tests live)
  - [ ] Add test: regular pick (`antiJailedBonus: false`) succeeds when jailed team has a bye (no opponent in week games)
  - [ ] Add test: anti-jailed pick (`antiJailedBonus: true`) fails with `JAILED_NOT_IN_WEEK_GAMES` when jailed team has a bye
  - [ ] Verify existing tests for direct jailed pick rejection still pass

- [ ] **`npm test` green; `npm run lint`; `npm run build`** before closing

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
