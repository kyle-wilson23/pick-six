---
title: 'Biggest Loser standings'
type: 'feature'
created: '2026-10-01'
status: 'done'
baseline_commit: '5f2dee255ecd5b97ea4dc9fd63f1227302e81c47'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The standings page ranks participants by points only. The league also wants a "Biggest Loser" board: who has the most weeks where they actually picked a team and that team lost. A week with no pick must not count.

**Approach:** Under the existing standings table, add an h2 "Biggest Loser" and a second table with the same columns except Pts is replaced by "Valid losses" (red). Order is most valid losses first. A valid loss is a scored pick with outcome LOSS. No pick row, an unscored pick, and a TIE do not count.

## Boundaries & Constraints

**Always:**
- Show the section only when at least one participant exists. Zero participants keeps today's empty copy and no second table.
- Columns: `#`, Participant, Record, Valid losses. Record stays wins-losses or wins-losses-ties. Highlight the current user the same way as the points table.
- Valid-loss numbers use MUI error red and bold weight. The header keeps the default header color.
- Competition-rank on the valid-loss count (ties share a rank; the next rank skips). Equal counts order by display name A–Z. Do not reuse the points-table rank.
- Use `Stack` for the new section. Keep the sort in `src/lib/scoring` with a colocated test.
- Example rule: A missed week 1 and has one scored LOSS in week 2 (1). B has a scored LOSS in both weeks (2). B is above A.

**Ask First:**
- Counting a TIE, a missed week, or an unscored pick as a valid loss.
- Changing the points table's sort, columns, or scoring.
- A tie-break other than display name A–Z.

**Never:**
- Insert synthetic LOSS rows for missed weeks.
- Change Tuesday digest, email standings, or how `scoreNflWeek` writes outcomes.
- Add the section to any page other than league standings.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| User example | A: no week-1 pick, week-2 scored LOSS. B: scored LOSS in week 1 and week 2. | B rank 1 with 2 valid losses; A rank 2 with 1. Record for A is 0-1 (the miss is not a loss). | N/A |
| Shared count | Two participants with the same valid-loss count; names Zoe and Amy. | Both share the same rank. Amy above Zoe. Next participant's rank skips. | N/A |
| Tie game | One scored TIE, no LOSS. | Valid losses 0. | N/A |
| No results yet | Participants exist; every scored total is zero. | Both tables render. Valid losses are 0. "No results scored yet" stays on the points table only. | N/A |
| No participants | `standings` is empty. | Existing "Standings will appear after Week 1 results" only. No Biggest Loser heading. | N/A |

</frozen-after-approval>

## Code Map

- `src/app/(app)/leagues/[leagueId]/standings/page.tsx` -- server page; renders the points table today.
- `src/components/standings/StandingsTable.tsx` -- client table: `#`, Participant, Record, Pts. Current user row uses `aria-current` and a primary tint. Pts values are `primary.main` and bold.
- `src/lib/scoring/get-league-standings.ts` -- `StandingsEntry.losses` counts scored `LOSS` picks only. Missed weeks have no `Pick` and do not increment it. Sort is points, then wins, then display name. Rank ties on points only.
- `src/lib/scoring/score-nfl-week.ts` -- updates existing picks only. Never inserts a row when a member did not submit.
- `src/lib/domain/scoring.ts` -- picked team lost → `LOSS`; tie → `TIE`.
- `src/lib/scoring/get-league-standings.test.ts` -- vitest. `makePrisma` returns shaped memberships. No real database.
- `src/components/standings/StandingsTable.test.tsx` -- jsdom. Asserts `aria-label="League standings"` and the current-user row.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/scoring/rank-biggest-losers.ts` -- pure function that copies `StandingsEntry[]`, sorts by `losses` desc then `displayName` A–Z, and assigns competition rank on the valid-loss count. Do not mutate the points-table array.
- [x] `src/lib/scoring/rank-biggest-losers.test.ts` -- cover every I/O matrix row that is domain logic (user example, shared count, tie game does not increment).
- [x] `src/components/standings/StandingsTable.tsx` -- add a variant for this board: `aria-label="Biggest loser"`, last column header "Valid losses", cell value is `losses`, color `error.main`, bold. Widen that column so the header fits the fixed table layout. Points variant stays the default.
- [x] `src/components/standings/StandingsTable.test.tsx` -- assert the biggest-loser header, the valid-loss number, and that the points table still says Pts.
- [x] `src/app/(app)/leagues/[leagueId]/standings/page.tsx` -- under the points table, when `standings.length > 0`, render an h2 "Biggest Loser" and the variant table fed by `rankBiggestLosers`.

**Acceptance Criteria:**
- Given a league standings page with at least one participant, when the page renders, then an h2 "Biggest Loser" sits under the points table and its rows are ordered by valid losses descending.
- Given that second table, when it renders, then the last column is "Valid losses" in place of Pts, and those numbers are red.
- Given the points table, when the biggest-loser section is added, then its columns, sort, and rank are unchanged.

## Spec Change Log

## Design Notes

`StandingsEntry.losses` is already this count: only scored picks are loaded, and a missed week never becomes a `Pick`. Display and sort that field as "Valid losses". Do not store a second counter.

"A has 2 losses" in the request means one missed week plus one real loss. Record does not include the miss, so A's record and valid-loss number are both 1. B is 2 and is listed first.

## Verification

**Commands:**
- `npm test -- src/lib/scoring/rank-biggest-losers.test.ts src/components/standings/StandingsTable.test.tsx` -- expected: pass.

**Manual checks (if no CLI):**
- Open a league standings page that has scored weeks. Confirm the points table is unchanged, the h2 reads "Biggest Loser", and the lower table's last column is red "Valid losses" with the most losses on top.

## Suggested Review Order

**Standings section**

- Second table appears only when the points board has participants.
  [`page.tsx:56`](../../src/app/(app)/leagues/[leagueId]/standings/page.tsx#L56)

**Valid-loss ranking**

- Sort by scored losses, then name, without touching the points order.
  [`rank-biggest-losers.ts:6`](../../src/lib/scoring/rank-biggest-losers.ts#L6)

- Shared loss counts keep one rank and the next rank skips.
  [`rank-biggest-losers.ts:12`](../../src/lib/scoring/rank-biggest-losers.ts#L12)

**Table columns**

- Valid losses replaces Pts, in red, on the same row layout.
  [`StandingsTable.tsx:132`](../../src/components/standings/StandingsTable.tsx#L132)

- Unscored caption stays on the points table only.
  [`StandingsTable.tsx:144`](../../src/components/standings/StandingsTable.tsx#L144)

**Tests**

- The two-week example puts the participant with two scored losses first.
  [`rank-biggest-losers.test.ts:21`](../../src/lib/scoring/rank-biggest-losers.test.ts#L21)

- Points header stays Pts; the other board shows Valid losses.
  [`StandingsTable.test.tsx:81`](../../src/components/standings/StandingsTable.test.tsx#L81)
