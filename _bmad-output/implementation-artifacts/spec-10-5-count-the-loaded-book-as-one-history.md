---
title: 'Count the loaded book as one history'
type: 'feature'
created: '2026-11-16'
status: 'done'
baseline_revision: 'ca9a15ac8818a85ade91f52de4527ef6d8b37197'
review_loop_iteration: 0
followup_review_recommended: false # four medium test patches, all covered by the passing suite; no unverified risk left
context: []
warnings:
  - oversized
deferred: []
---

<intent-contract>

## Intent

**Problem:** The commentary view is this week's picks only, so a stored year cannot be cited, and a live season can be counted again from the book.

**Approach:** Add book rows on the league person. One history uses scored picks for every year with a season, and book rows only for years without one. The checker matches a cited cell there and drops a year the history does not contain.

## Boundaries & Constraints

**Always:**
- `BookRow` is not a `Pick`. It belongs to `LeaguePerson`, cascades with that person, and is unique on person, `nflSeasonYear`, and `weekNumber`. Fields are required `PickOutcome` `outcome`, required integer `points`, and optional `teamId`. Cuid ids, snake_case columns, table `book_rows`.
- A `Season` for this league and year is live. The view uses that year's scored player picks and ignores its book rows. A year with no `Season` uses its book rows. Player picks stay behind `leaguePlayerMembershipWhere`. One row per person, year, and week. This week's scored pick appears once.
- A view row is `personId`, display name, `year`, `week`, outcome, points, and team abbreviation or null. The name still comes from the membership user, and an email label is still `Player`. The serialized view has no email, user id, password, session, or credential.
- The checker keeps a sentence only when person, year, and week hit one row and outcome, points, and team match. No team matches only a row with no team. A cited year or week is allowed when that cell is in the view. The digest week is not a filter. No rewrite, no padding, cap of 3.
- Every 4-digit year in a kept sentence is a year on that view. "league history" and "all-time" drop. A comparison with no 4-digit year drops. Dropped text is not rewritten.
- The prompt includes the view JSON, tells the model to copy those cells, and tells it to use only those rows. It does not say the lines are about this week only. `generateText` gets no tools. The runner still re-reads with a second `loadCommentaryWeekView`, not a query per line.
- An empty book does not throw and does not remove this week's scored picks. No `Season` rows does not throw and does not drop book rows.

**Never:**
- Do not make `LeaguePerson.leagueMembershipId` optional, and do not create users or memberships. People who do not return belong to a later story.
- Do not add an import screen, screenshot reader, or book editor.
- Do not show book rows or past-season win/loss or biggest-loser records on a page. Member pages keep the current season's `Pick`s. No member page shows the commentary.
- Do not change the runner loop, ceiling, debug flag, digest send, preview, or template.
- Do not give the model a database login or a tool.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Empty book | No book rows; 2026 week 4 pick is scored | That pick is in the view and the load completes | No throw |
| Book year | 2024 book row; no 2024 `Season` | View has that person, year, week, outcome, points, and team from the book | Not a `Pick` |
| Live year | 2024 season pick and 2024 book row | The pick is in; the book row is out | No duplicate cell |
| No season | Book rows; league has no `Season` | Book rows are in the view | Empty live-year list does not throw |
| Duplicate cell | Second book row for one person, year, and week | Row is rejected | Unique on those three |
| Years read | View has 2024 and 2026; sentence names both; cell matches | Sentence stored unchanged | N/A |
| Year not read | Sentence names 2019; view has no 2019 | Sentence absent | Not rewritten |
| Banned or unnamed | "league history", "all-time", or "last year" with no digits | Sentence absent | Not rewritten |
| History cell | Line cites a book year and week that match | Sentence kept | A missing person-year-week is dropped |
| No team | Book row has no team | Team is null; a line with no team matches | A named team does not |
| Secrets | Any view | JSON has no email, user id, password, or session | An `@` label is `Player` |
| Member page | Standings, results, or pick history | Current-season pick records only | No book query and no commentary |

</intent-contract>

## Code Map

- `prisma/schema.prisma` — `LeaguePerson` (~386–399) still requires `leagueMembershipId`. `Season` (~89–112) is unique on league and `nflSeasonYear` and has no status. `Pick` (~428–452) is the live cell (`outcome`, `pointsEarned`, required `teamId`). `PickOutcome` is `WIN | LOSS | TIE`. `Team.abbreviation` (~136–138) is the label. No book model exists. Copy the create-table shape from `prisma/migrations/20261115180000_add_league_person_and_commentary_run/migration.sql`.
- `src/lib/commentary/week-view.ts` — `loadCommentaryWeekView` (~25–67) loads one week of one year. `CommentaryWeekViewRow` (~17–23) has no year or week. `commentaryDisplayName` (~12–15) hides email. The user select is name and email only. Keep `leaguePlayerMembershipWhere`.
- `src/lib/commentary/checker.ts` — `confirmCommentaryLines` (~35–51) keeps one row per person (~40) and drops a line that is not the digest week (~44). `sentenceDropped` (~16–21) and `cellsMatch` (~24–28) already handle phrases and cells.
- `src/lib/commentary/run-commentary.ts` — `commentaryPrompt` (~47–58) says "this week only" and "Use only these rows." `generateText` (~166–170) has no tools. The re-read is the second load (~185–186).
- `src/lib/commentary/week-view.test.ts` (~21–98), `checker.test.ts` (~46–55, ~113–120), and `run-commentary.test.ts` (~65–104, ~208–210) lock this-week behavior and must move with the row shape.
- `src/lib/commentary/member-surface.test.ts` (~21–36) scans member routes. Leave these on the current season and off the book: `src/app/(app)/leagues/[leagueId]/standings/page.tsx`, `results/page.tsx`, `history/page.tsx`, `src/lib/scoring/get-league-standings.ts`, `get-league-peer-pick-history.ts`, `get-personal-pick-history.ts`.

## Tasks & Acceptance

**Execution:**
- `prisma/schema.prisma` -- add `BookRow` and a `book_rows` migration -- a book cell is not a pick
- `src/lib/commentary/book-row-schema.test.ts` -- assert the unique person-year-week key, required outcome and points, and optional team -- a duplicate cell cannot be stored
- `src/lib/commentary/week-view.ts` -- load scored player picks for every live year and book rows for every other year -- a live season is not counted twice
- `src/lib/commentary/week-view.test.ts` -- cover the load rows in the matrix -- empty, book-only, live-year, no season, null team, and no secrets
- `src/lib/commentary/checker.ts` -- match person, year, and week, and drop a 4-digit year missing from the view -- a book cell can be kept
- `src/lib/commentary/checker.test.ts` -- keep a named comparison whose years were read, drop an unread year, and keep a matching history cell -- dropped text stays unchanged
- `src/lib/commentary/run-commentary.ts` -- prompt with only the supplied rows and call `generateText` with no tools -- the model cannot hunt past the view
- `src/lib/commentary/run-commentary.test.ts` -- add `year` and `week` to fixtures and assert the prompt contains the rows, drops "this week only", and has no tools -- existing confirms still store
- `src/lib/commentary/member-surface.test.ts` -- assert member routes and the three scoring readers do not reference the book -- pages stay on the current season

**Acceptance Criteria:**
- Given the book has no rows and this week has a scored pick, when the view is loaded, then that pick is present and the load completes.
- Given one year has only book rows and another year has a season plus book rows, when the view is built, then the first year comes from the book and the second year comes only from that season's picks.
- Given a line cites a cell in that view, when the checker stores it, then the sentence is unchanged, and a mismatch, a banned phrase, an unnamed comparison, or a 4-digit year absent from the view is not stored.
- Given a member opens standings, results, or pick history, when the page is served, then it shows the current season's picks and does not show the book or the commentary.

## Spec Change Log

## Review Triage Log

### 2026-11-16 — Review pass
- verdicts: 22 findings — high 0, medium 6, low 4, false 12, maybe-false 0
- findings:
  - `[false]` `[reject]` A 2024 cell can be stored on the 2026 week run without the year in the sentence — the story cites book years on this week's run, and a sentence that does not compare years is not required to contain a 4-digit year.
  - `[false]` `[reject]` A named year is accepted from any row, including another person — the spec keeps a 4-digit year that is on the view, and one line still has to match its own cell.
  - `[low]` `[reject]` Every 4-digit token is treated as a season year — scores and weeks in this league are not four digits, and separating them would add a parser.
  - `[false]` `[reject]` One season hides every book cell for that year, including weeks with no pick — the story says a live year uses that season's picks and ignores its book rows.
  - `[false]` `[reject]` The digest week is unused, row order is unset, and the history is loaded twice — the digest week is not a filter, scored weeks are that season's picks, the second load is the re-read, and the checker matches by person, year, and week.
  - `[low]` `[reject]` Book rows omit pick ranges, a repeated-team ban, and a team index — book rows are not picks, teams are not deleted, and this table stays small.
  - `[low]` `[reject]` Nothing inserts a book row and the unique rule is schema text — the migration's unique index is what rejects a duplicate, and this story does not import rows. `season.findMany` is already filtered by `leagueId`.
  - `[false]` `[reject]` The member scan misses components, the digest, and commentary text on the pages — those three pages and readers do not reference the book, and member routes already ban the model and the quiet line.
  - `[medium]` `[patch]` The banned-phrase test named 2024 while the view was only 2026 — the test now includes a 2024 row and still expects "This is league history from 2024." to be dropped.
  - `[low]` `[reject]` A season can commit between the year snapshot and the row queries — that overlap is rare, and wrapping the reads in a transaction is more than a direct correction.
  - `[medium]` `[patch]` No loader test returned a pick and a book row for the same person — `week-view.test.ts` now expects Alice's 2026 pick and 2024 book row, and expects her 2026 book row to be absent.
  - `[medium]` `[patch]` A year that exists only on another person was untested — the checker test keeps Alice's 2026 sentence when 2024 is only on Bob's row.
  - `[medium]` `[patch]` The banned phrase could be removed and the old year test would still pass — same fix as the 2024-on-the-view banned-phrase test.
  - `[medium]` `[patch]` The runner fixtures were only the digest week — `run-commentary.test.ts` prompts and stores Alice's 2024 week 7 row.
  - `[false]` `[reject]` The empty-book story names the digest, and the new test stops at the loader — an empty book still returns this week's pick, and the digest send still renders the runner's sentences.
  - `[false]` `[reject]` Uniqueness is not shown with an insert — the migration creates the unique index, and this story has no importer.
  - `[false]` `[reject]` The live year is only asserted through mocks — the returned array is the season pick, and the book row for that year is not in it.
  - `[false]` `[reject]` The view includes every scored week of a live year — that is "uses that season's picks."
  - `[medium]` `[patch]` A book-year sentence was stored only in the checker unit test — the same runner test stores the 2024 week 7 line.
  - `[false]` `[reject]` The page rule is a source scan — the pages were not changed, and the scan fails if they start reading the book.
  - `[false]` `[reject]` The checker does not query the database — the spec's re-read is the second `loadCommentaryWeekView`, not a query per line.
  - `[false]` `[reject]` The spec omits "the digest still shows the stored outcome" — putting that sentence back would edit the spec, and the digest path was not changed.

## Auto Run Result

The commentary view is one history. Scored picks cover every year that has a season. Book rows cover every other year, once per person, year, and week. A live year does not also count its book rows. The checker can keep a cell from that history, and it drops a 4-digit year the view does not contain, plus "league history", "all-time", and a comparison that names no year.

Files:
- `prisma/schema.prisma` — `BookRow` on the league person, unique on person, year, and week
- `prisma/migrations/20261116120000_add_book_rows/migration.sql` — creates `book_rows`
- `src/lib/commentary/book-row-schema.test.ts` — locks the unique key, required outcome and points, and optional team
- `src/lib/commentary/week-view.ts` — loads that one history and hides email, user id, password, and session
- `src/lib/commentary/week-view.test.ts` — empty book, book year, same person across both sources, live year, no season, null team, secrets
- `src/lib/commentary/checker.ts` — matches person, year, and week, and drops a year that was not read
- `src/lib/commentary/checker.test.ts` — named years, another person's year, banned phrase with a year on the view, history cell, null team
- `src/lib/commentary/run-commentary.ts` — prompt uses only the supplied rows and does not say this week only
- `src/lib/commentary/run-commentary.test.ts` — prompt contains a non-digest row and the matching line is stored
- `src/lib/commentary/member-surface.test.ts` — standings, results, and pick history do not reference the book

Review: 22 findings. Patched 4 medium entries (0 high, 4 medium, 0 low): the banned-phrase test, the same-person pick and book row, a year on another person, and a runner history row. No items deferred. Rejected findings stayed rejected because the story already allows a history cell on this week's run, a live year replaces that year's book, book rows are not picks, and the digest path was left alone. Follow-up review is false: those four patches are covered by the passing tests, and no unverified risk remains. Patched counts: high 0, medium 4, low 0.

Verification: `npm test` passed, 164 files and 1063 tests.

Residual risk: the migration was not applied to a live database. The unique index is locked by the migration text the schema test reads.

## Design Notes

A person has many cells, so the checker cannot map a person to one row. "Alice's 2024 win showed up again in 2026." is kept only when both years are on the view. "Better than last year." and "league history" still drop.

## Verification

**Commands:**
- `npm test` -- expected: book schema, week view, checker, runner prompt, and member-surface tests pass
