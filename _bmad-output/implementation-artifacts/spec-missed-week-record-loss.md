---
title: 'Count missed weeks in the displayed record'
type: 'bugfix'
created: '2026-10-02'
status: 'done'
baseline_commit: 'c8fb0c2c3674b3f558d47acedef36dd58d4feb80'
context:
  - '{project-root}/docs/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A finalized week with no pick does not change the W-L record. Jack Quirke (league `cmtjjhbjz000004kywbmpvdkm`) missed week 2 and still shows `2-0`. That miss is not a valid loss, but it should still add one to the loss tally in the record.

**Approach:** Show record as wins against valid losses plus missed finalized weeks. Valid losses stay the count of scored `LOSS` picks. Jack’s record becomes `2-1` and his valid-loss number stays `0`.

## Boundaries & Constraints

**Always:**
- A missed week is a competition week (`week >= firstCompetitionWeek`) that has games, is fully finalized, and has no `Pick` for that player. Count it once.
- Record string is `W-L`, or `W-L-T` when any row in that table has a tie. `L` is valid losses plus missed weeks. Wins, ties, and points stay scored-pick totals.
- Apply that record on the standings table, the Biggest Loser table, and a Record column on each League Results week table.
- On Results, the miss row stays Team `No pick`, Result —, Pts `0`. The Record cell is the season tally through revealed weeks only. An unrevealed week does not add a miss.
- Biggest Loser still sorts and ranks by valid losses only. Its last column stays "Valid losses".
- Same rule for every player, including future weeks. Do not insert `Pick` rows.

**Ask First:**
- Counting an open week, a week before `firstCompetitionWeek`, a tie, or an unscored saved pick as a miss.
- Changing points sort, Biggest Loser sort, personal history, or the Tuesday digest.

**Never:**
- Treat a miss as outcome `LOSS` or add it to `StandingsEntry.losses`.
- Change `scoreNflWeek`, exports, or jailed logic.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Jack | 2 scored wins, week 2 finalized, no pick. No scored LOSS. | Record `2-1`. Valid losses `0`. Points unchanged. | N/A |
| Real loss plus miss | 1 scored LOSS and 1 missed finalized week | Record `0-2`. Valid losses `1`. | N/A |
| Open week | No pick; week not fully finalized | Record unchanged. Results Result stays —. | N/A |
| Before start | Week &lt; `firstCompetitionWeek`, no pick | Not a miss | N/A |
| Saved pick | Pick row exists, even if unscored | Not a miss. Unscored pick does not add a win or valid loss. | N/A |
| Tie | Scored TIE only | Valid losses `0`. Record includes the tie part when any row has a tie. | N/A |
| Biggest Loser order | Jack valid losses `0`; peer valid losses `1` | Peer ranks above Jack. Jack’s record can still be `2-1`. | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/scoring/get-league-standings.ts` -- `losses` is scored `LOSS` only. Standings and Biggest Loser both read it. Add `missedWeeks`.
- `src/lib/scoring/rank-biggest-losers.ts` -- Sort by `losses`. Leave it.
- `src/components/standings/StandingsTable.tsx` -- Record is `` `${wins}-${losses}` ``. Valid losses cell is `losses`.
- `src/lib/scoring/get-league-peer-pick-history.ts` -- Revealed no-pick rows already exist (`hasPick: false`, pending, 0 pts).
- `src/components/results/LeagueResultsTable.tsx` -- Columns are Participant, Team, Result, Pts. Add Record from revealed weeks.
- `src/lib/scoring/finalize-nfl-week.ts` -- `isWeekFullyFinalized`. Reuse. Empty game list is not a finalized week.
- `src/lib/nfl/nfl-regular-season.ts` -- `isWeekInLeagueCompetition`. Reuse.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/scoring/record-tally.ts` -- Pure helpers: finalized competition weeks, missed-week count, season tally from revealed peer weeks, and the `W-L` / `W-L-T` string. -- One formula for both pages.
- [x] `src/lib/scoring/record-tally.test.ts` -- Cover the I/O matrix rows that are pure logic. -- Lock Jack as `2-1` with valid losses `0`.
- [x] `src/lib/scoring/get-league-standings.ts` -- Load `firstCompetitionWeek`, league games, and each pick’s week. Set `missedWeeks`. Keep `losses` as scored losses. -- Standings data matches the helper.
- [x] `src/lib/scoring/get-league-standings.test.ts` -- Jack: two wins, one missed finalized week, `losses` `0`, `missedWeeks` `1`. Open week and pre-start week add nothing. -- Query behavior stays scored-pick based for points.
- [x] `src/components/standings/StandingsTable.tsx` -- Record uses `losses + missedWeeks` on both variants. Valid losses cell stays `losses`. -- Both tables show `2-1` and Biggest Loser still shows `0`.
- [x] `src/components/standings/StandingsTable.test.tsx` -- Assert that split. -- UI cannot collapse the two numbers.
- [x] `src/components/results/LeagueResultsTable.tsx` -- Record column from revealed weeks. Miss row keeps `No pick`, —, and `0`. -- Results shows the same tally.
- [x] `src/components/results/LeagueResultsTable.test.tsx` -- Jack across revealed weeks renders `2-1` on the miss row without a LOSS chip. -- Weekly result and season record stay distinct.

**Acceptance Criteria:**
- Given Jack’s two scored wins and one missed finalized week, when standings or Biggest Loser renders, then his record is `2-1` and his valid losses are `0`.
- Given a peer with more valid losses, when Biggest Loser renders, then that peer ranks above Jack.
- Given the same season on Results, when a revealed week renders, then each player’s Record cell uses that same tally and a miss is still not a LOSS chip.

## Spec Change Log

## Design Notes

`StandingsEntry.losses` remains the valid-loss count so Biggest Loser ranking and the red column stay correct. `missedWeeks` is display-only. Results can tally from weeks already on `LeaguePeerPickHistory` because a revealed week is a finalized competition week and a `hasPick: false` row is a miss.

## Verification

**Commands:**
- `npm test -- src/lib/scoring/record-tally.test.ts src/lib/scoring/get-league-standings.test.ts src/lib/scoring/rank-biggest-losers.test.ts src/components/standings/StandingsTable.test.tsx src/components/results/LeagueResultsTable.test.tsx` -- expected: pass
- `npm test` -- expected: pass

## Suggested Review Order

**Record formula**

- Loss tally adds missed weeks; valid losses stay scored losses.
  [`format-win-loss-record.ts:54`](../../src/lib/scoring/format-win-loss-record.ts#L54)

- A revealed week with no pick is one miss. Pending picks are ignored.
  [`format-win-loss-record.ts:30`](../../src/lib/scoring/format-win-loss-record.ts#L30)

- Only finalized competition weeks with games can be misses.
  [`record-tally.ts:17`](../../src/lib/scoring/record-tally.ts#L17)

**Standings data**

- Scored picks still own points and valid losses. Misses are separate.
  [`get-league-standings.ts:71`](../../src/lib/scoring/get-league-standings.ts#L71)

- Biggest Loser still ranks on valid losses, not the record.
  [`rank-biggest-losers.ts:6`](../../src/lib/scoring/rank-biggest-losers.ts#L6)

**Tables**

- Both standings tables share the record string. Valid losses stay `losses`.
  [`StandingsTable.tsx:85`](../../src/components/standings/StandingsTable.tsx#L85)

- The red column is still the valid-loss count.
  [`StandingsTable.tsx:148`](../../src/components/standings/StandingsTable.tsx#L148)

- Results shows that season record, and a miss cannot render as LOSS.
  [`LeagueResultsTable.tsx:261`](../../src/components/results/LeagueResultsTable.tsx#L261)
