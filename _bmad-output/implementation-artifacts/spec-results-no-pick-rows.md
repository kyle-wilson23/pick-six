---
title: 'Results: list participants who did not pick'
type: 'feature'
created: '2026-10-01'
status: 'done'
baseline_commit: '69d15c06a9449c2d75154740279a0f1eaf76ba56'
context:
  - '{project-root}/docs/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** League Results only lists players who saved a pick, so anyone who sat a week out is missing from that week’s table.

**Approach:** On each week the viewer may already see, add one row per league player with no pick. The Team cell is the plain string `No pick`. Saved picks, and the admin “Submitted” redaction, stay as they are.

## Boundaries & Constraints

**Always:**
- One row per player per visible week. A saved pick wins; do not also emit a no-pick row for that membership.
- No-pick Team cell: `No pick` only (no logo, no check). Null team on a row that has a pick stays the green check + “Submitted”.
- No-pick Result is an em dash (not WIN, LOSS, or TIE). Pts is `0` when the week is fully finalized, and an em dash when it is not.
- Members see only fully finalized weeks. Admins also see in-progress weeks that already have a pick, and every finalized competition week (including all-miss weeks).
- Weeks must be in competition (`week >= firstCompetitionWeek`, 1–18). Exclude the configured superuser. Sort A–Z by display name. Keep the current-user highlight.
- Derive rows at read time. Do not insert `Pick` records.

**Ask First:**
- Showing no-pick rows to members before the week is fully finalized.
- Team copy other than `No pick`, or treating a miss as a LOSS.
- Changing Opponents’ Picks, personal history, standings, or Biggest Loser.

**Never:**
- Reveal another player’s team before existing pick-window redaction allows it.
- List weeks before `firstCompetitionWeek`.
- Persist synthetic picks or change scoring math.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Missed revealed week | Member; week finalized; no pick | Row. Team `No pick`. Result —. Pts `0` | N/A |
| Picked revealed week | Same week; scored pick | Existing team, chip, points. One row | N/A |
| Member, open week | Non-admin; week not finalized | Week omitted | N/A |
| Admin redaction | Admin; window open; peer picked | “Submitted”, not `No pick`. Result/Pts — | N/A |
| Admin, no pick | Admin; peer has no pick; week already listed | Team `No pick`. Result —. Pts — | N/A |
| All missed | Finalized competition week; zero picks | Week listed; every player `No pick`, Pts `0` | N/A |
| Before start | Week &lt; `firstCompetitionWeek` | Week absent | N/A |
| Superuser | Configured superuser email | No row | N/A |
| Mixed names | Pickers and non-pickers | One A–Z list by display name | N/A |
| Empty | No visible weeks | Existing empty copy; no table | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/scoring/get-league-peer-pick-history.ts` -- Pick-only weeks. Add roster merge, `hasPick`, competition-week bound, finalized empty weeks.
- `src/lib/scoring/get-league-peer-pick-history.test.ts` -- Extend for the matrix the query owns.
- `src/components/results/LeagueResultsTable.tsx` -- Null team means “Submitted”. Branch on `hasPick === false` for `No pick`.
- `src/components/results/LeagueResultsTable.test.tsx` -- Keep Submitted-check; add no-pick.
- `src/lib/league/player-membership-where.ts` -- Superuser-excluding roster filter. Reuse.
- `src/lib/nfl/nfl-regular-season.ts` -- `isWeekInLeagueCompetition`. Reuse.
- `src/app/(app)/leagues/[leagueId]/results/page.tsx` -- Sole caller. Leave unless a prop is required.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/scoring/get-league-peer-pick-history.ts` -- Load `firstCompetitionWeek` and player memberships. Per visible competition week, one `PeerPickEntry` per player: `hasPick: true` from the saved pick (redaction unchanged), else `hasPick: false`, null team, `antiJailedBonus: false`, `outcome: "PENDING"`, `pointsEarned` `0` if revealed else `null`. Include a finalized week with zero picks. -- List non-pickers without leaking open weeks or pre-start weeks.
- [x] `src/lib/scoring/get-league-peer-pick-history.test.ts` -- Cover miss, redaction vs no-pick, member open week, all-miss week, pre-start week, superuser, A–Z. -- Lock visibility and the points display.
- [x] `src/components/results/LeagueResultsTable.tsx` -- If `hasPick` is false, Team cell is `No pick`. If `hasPick` is true and team identity is missing, keep “Submitted”. -- Separate the two blank-team states.
- [x] `src/components/results/LeagueResultsTable.test.tsx` -- Assert `No pick` and that a redacted pick still says “Submitted”. -- Stop the states from collapsing.

**Acceptance Criteria:**
- Given a fully finalized week where some players have no pick, when a member opens Results, then each of those players has one row with Team `No pick`, Result —, and Pts `0`.
- Given that week and a player who picked, when Results renders, then that player shows their team, result, and points once.
- Given a week that is not fully finalized, when a non-admin opens Results, then that week is absent.
- Given an admin and an open pick window, when a peer picked, then Team is “Submitted”; when a peer did not pick, then Team is `No pick`.
- Given a week before `firstCompetitionWeek`, when Results renders, then that week is absent.

## Spec Change Log

## Design Notes

Null team already means “pick exists, team hidden.” Add `hasPick: boolean` on `PeerPickEntry`: `false` renders `No pick`; `true` plus a null team still renders “Submitted”. Do not put the words `No pick` in `teamName`.

## Verification

**Commands:**
- `npx vitest run src/lib/scoring/get-league-peer-pick-history.test.ts src/components/results/LeagueResultsTable.test.tsx` -- expected: pass
- `npm test` -- expected: pass

**Manual checks (if no CLI):**
- On a finalized Results week, a player who did not pick is listed with Team `No pick`, Result —, Pts `0`. A player who picked still shows the team.

## Suggested Review Order

**Who appears**

- Only competition weeks the viewer may already see get a roster.
  [`get-league-peer-pick-history.ts:134`](../../src/lib/scoring/get-league-peer-pick-history.ts#L134)

- Each player is one row; a saved pick replaces the miss.
  [`get-league-peer-pick-history.ts:151`](../../src/lib/scoring/get-league-peer-pick-history.ts#L151)

**Miss versus hidden pick**

- A miss stays pending, with 0 points only after the week is final.
  [`get-league-peer-pick-history.ts:181`](../../src/lib/scoring/get-league-peer-pick-history.ts#L181)

- An open-window admin still sees Submitted, not the team.
  [`get-league-peer-pick-history.ts:206`](../../src/lib/scoring/get-league-peer-pick-history.ts#L206)

**Team column**

- `hasPick` false is the words No pick; a hidden pick stays the check.
  [`LeagueResultsTable.tsx:122`](../../src/components/results/LeagueResultsTable.tsx#L122)

**Tests**

- Revealed miss keeps the saved pick and scores the miss as 0.
  [`get-league-peer-pick-history.test.ts:521`](../../src/lib/scoring/get-league-peer-pick-history.test.ts#L521)

- The table renders No pick and still renders Submitted for a hidden pick.
  [`LeagueResultsTable.test.tsx:83`](../../src/components/results/LeagueResultsTable.test.tsx#L83)
