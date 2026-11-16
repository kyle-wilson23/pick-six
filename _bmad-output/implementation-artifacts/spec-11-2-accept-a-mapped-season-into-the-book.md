---
title: 'Accept a mapped season into the book'
type: 'feature'
created: '2026-11-16'
status: 'done'
baseline_revision: 'b4d5fc877d92acca2d5f1da85e30597375f057f7'
review_loop_iteration: 0
followup_review_recommended: true # 60s transaction timeout was not run against a live database
context: []
warnings:
  - oversized
deferred: []
---

<intent-contract>

## Intent

**Problem:** A checked past-season grid cannot become history. A current member must keep the league person they already have, and a past member who still counts needs a person with no login, or that year never joins the book.

**Approach:** A local command takes the printed grid, the league id, and an explicit name map, and writes book rows for that year in one transaction. The checker then reads those rows, including people with no membership.

## Boundaries & Constraints

**Always:**
- Command: `node scripts/accept-season-screenshot.mjs <leagueId> <gridFile> <mapFile>`. The grid file's stem is the season year, a 4-digit integer from 2000 through 2100, and its extension is `.txt`. The current year is `NFL_SEASON_YEAR` when that value is an integer in that range, otherwise the UTC calendar year. A stem equal to that year writes nothing.
- The grid is the printed reading: a header `first name | week | fill | team`, then one row per cell. First name and team match the printed text, with no trimming. Fill is `green`, `pale blue`, `red`, `empty red`, `yellow`, or `orange`. Week is an integer. A repeated first name and week writes nothing.
- The map is one line per first name, `first name<TAB>target`, exact grid spelling. A target is `membership:<id>`, `person:<id>`, or `past`. Every distinct grid first name needs one line. A name with no line, two lines, or any other target writes nothing. Lines for names not in the grid are ignored.
- `membership:<id>` is a player membership of this league (`leaguePlayerMembershipWhere`). The accept uses that membership's person, creating the person in the same transaction only when the membership has none. `person:<id>` is a league person already in this league, and it creates nobody. `past` creates one person with no membership and no user, and stores that first name on `displayName`. `displayName` is the checker's label, never a lookup key.
- Green is `WIN` at 1. Pale blue is `WIN` at 2. Red, empty red, yellow, and orange are `LOSS` at 0. A blank or whitespace-only team stores no team. Any other team text must match `Team.abbreviation` after trim and uppercasing, or the accept writes nothing.
- One transaction. A refusal leaves no new person and no new book row. The same person, year, and week with the same outcome, points, and team stays as it is. A different stored cell writes nothing.
- Success prints `accepted <year> <n>` and exits 0. `n` is the number of grid cells. A header-only grid accepts `0` and creates nobody. A refusal prints one stderr line and exits non-zero. Missing `DATABASE_URL` refuses before a write.
- The checker includes this league's book rows for years that have no live season, including a person with no membership. A person who has a membership is included only when that membership passes `leaguePlayerMembershipWhere`. The view label stays `commentaryDisplayName` when a membership exists, and it is `displayName` otherwise.

**Never:**
- Do not call the vision model, `runCommentary`, `readCommentaryConfig`, or `addCallSpend`. Do not import the print script, `@/lib/db`, or `server-only`.
- Do not create a user, membership, invitation, pick, team, or season. Do not add an app route. Do not change invite lists or member pages. Do not build renewal.
- Do not match a first name to a user, and do not find a person by `displayName`.
- Do not create a person for a membership that is not in the map. Do not create a second person for one membership.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Mapped year | League `L`. Grid `2023.txt` has Alex week 1 `pale blue` `KC`, and Blair week 2 `empty red` with a blank team. Map sends Alex to a player membership of `L` that already has person `P`, and Blair to `past`. | Exit 0, stdout `accepted 2023 2`. Alex's row is on `P`: `WIN`, 2, Chiefs id. One new person for Blair, no membership and no user, `displayName` `Blair`, row `LOSS`, 0, no team. | No error expected |
| Membership with no person yet | Alex's player membership in `L` has no league person. The map is `membership:<that id>`. The grid has one green cell. | Exit 0. One person linked to that membership, `displayName` null, and one book row on that person. | No error expected |
| Reused past member | Blair's person `B` is already in `L` with no membership. The map is `person:B`. The grid has Blair week 3 yellow `DAL`, and `DAL` is a team abbreviation. | Exit 0. Still one Blair person, `displayName` unchanged. New row `LOSS`, 0, Cowboys id. | No error expected |
| Unmapped name | The grid names Blair and the map has no Blair line. | No new person and no book row. | Stderr, exit non-zero |
| Unknown team | A cell's team text is not a `Team.abbreviation`. | No new person and no book row. | Stderr, exit non-zero |
| Current season | The grid stem equals the current season year. | No new person and no book row. | Stderr, exit non-zero, before a write |
| Same reading again | Those Alex and Blair rows are already stored with the same outcome, points, and team. | Exit 0. Still one Blair person and the same two rows. | No error expected |
| Conflicting cell | Alex week 1 is already stored as `LOSS`. | The stored cell and persons stay as they were. | Stderr, exit non-zero |
| Checker read-back | Blair's 2023 row is stored. `L` has a live season for 2024 and a book row for Blair in 2024. | The week view includes Blair's 2023 row with label `Blair`. It does not include Blair's 2024 book row. | No error expected |

</intent-contract>

## Code Map

- `scripts/print-season-screenshot.mjs` — `formatGrid` (~145–150) prints `first name \| week \| fill \| team`. `currentNflSeasonYear` (~42–50) is the year rule to copy. Do not import this file.
- `src/lib/commentary/ensure-league-persons.ts` — `ensureLeaguePersons` (~7–23) creates one person per player membership that lacks one. Do not import it (`server-only`). For a mapped membership only, create that same row inside the accept transaction when `leaguePerson` is null.
- `src/lib/league/player-membership-where.ts` — `leaguePlayerMembershipWhere` (~9–17) is the current-member filter. A superuser membership is not a map target.
- `src/lib/commentary/week-view.ts` — `loadCommentaryWeekView` (~77–131) loads book rows only through `membership` and then calls `commentaryDisplayName` on `membership.user` (~123). That query drops a person with no membership and throws once membership is optional.
- `src/lib/commentary/run-commentary.ts` — `commentaryPrompt` (~47–52) sends the view rows to the model. The accept tool must not call `runCommentary` (~91–92), which is what runs `ensureLeaguePersons` for the whole league.
- `prisma/schema.prisma` — `LeaguePerson.leagueMembershipId` (~388–401) is required and `@unique`. `BookRow` (~404–420) is unique on person, year, and week, with required `PickOutcome` and `points`, and optional `teamId`. `PickOutcome` (~156–162) is `WIN`, `LOSS`, `TIE`.
- `src/lib/commentary/book-row-schema.test.ts` — (~50–54) forbids an optional membership. That assertion is the old rule.
- `src/lib/nfl/team-lookup.ts` — `buildTeamLookup` (~14–21) uppercases abbreviations. The script may query `Team.abbreviation` and do the same trim-and-uppercase match. Do not create teams.
- `scripts/seed-nfl-teams-only.cjs` — (~15–46) loads `.env` and `.env.local`, then `PrismaClient` with `PrismaPg`. Copy that client setup. Do not import `src/lib/db.ts`.
- `src/lib/commentary/member-surface.test.ts` — member pages and standings stay on `Pick`. Do not add `BookRow` there.
- `.gitignore` — (~53–55) keeps the print script on this machine. The accept script stays there too.

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma` -- make `leagueMembershipId` optional and unique, add optional `displayName`, and add the migration that drops `NOT NULL` on `league_persons.league_membership_id` and adds nullable `display_name` -- a past member can exist with no login, and many book-only people can have a null membership
- [x] `src/lib/commentary/book-row-schema.test.ts` -- lock optional membership, the unique membership key, and optional `displayName` -- the schema cannot go back to requiring a membership
- [x] `src/lib/commentary/week-view.ts` -- include this league's book rows for a person with no membership, keep the player-membership filter when a membership exists, and label a book-only person with `displayName` -- an accepted past member shows up in the one history
- [x] `src/lib/commentary/week-view.test.ts` -- cover the checker read-back row -- a book-only year is visible and a live year still comes from picks
- [x] `scripts/accept-season-screenshot.mjs` -- parse the grid and map, resolve memberships, persons, and teams, and write one transaction or refuse -- Kyle can accept a checked year
- [x] `scripts/accept-season-screenshot.test.ts` -- cover every matrix row with a fake database, and assert this file does not import the print script, `src/lib/db`, the commentary runner, config, or spend -- refusal and the image-free boundary stay true without a live database
- [x] `.gitignore` -- ignore the accept script and its test, next to the print script -- the tool stays on this machine

**Acceptance Criteria:**
- Given the accept script is on this machine, when app routes and commentary modules are scanned, then none import it, and it does not call the vision model or the commentary runner.
- Given Blair was accepted as `past`, when the write commits, then Blair's person has no user and no membership, the cells are `BookRow` records, and no invitation or pick was created.
- Given those rows exist, when an invite list or a member page is rendered, then that surface still reads memberships and current-season picks.
- Given this story is finished, when renewal is looked for, then no renewal flow was added and the accepted rows are still stored.

## Spec Change Log

## Review Triage Log

### 2026-11-16 — Review pass
- verdicts: 22 findings — high 0, medium 4, low 8, false 10, maybe-false 0
- findings:
  - `[false]` `[reject]` A second `past` map creates another person and the new id is not printed — `past` creates a person, `displayName` is not a lookup key, and success stdout is `accepted <year> <n>`. The same-reading row reuses `person:<id>`.
  - `[low]` `[reject]` Deleting a membership still cascades the person and book rows — no app path deletes a membership, and changing `onDelete` would be a new lifetime rule.
  - `[false]` `[reject]` A year with a season row drops that year's book rows — the checker is required to ignore book rows for a live season and use that season's picks.
  - `[low]` `[reject]` `person:<id>` can write rows on a superuser's person that the checker hides — the map would have to name that person, and the player filter already hides superuser memberships.
  - `[low]` `[reject]` A null or `@` display name skips the email mask — `past` stores the grid first name, and a screenshot first name is not an email.
  - `[false]` `[reject]` Week 0, negative weeks, and weeks above 18 are stored — the grid rule is any integer week, matching the printed reading.
  - `[false]` `[reject]` Old abbreviations such as `OAK` refuse the year — a team must match `Team.abbreviation`, and the accept does not create teams.
  - `[medium]` `[patch]` Two names on one person and week were untested — added a test that different fills exit non-zero, mention `stored cell differs`, and leave no person or row.
  - `[false]` `[reject]` `.env.local` overrides an existing `DATABASE_URL` — the accept client copies the seed script, which already loads those files with `override: true`.
  - `[medium]` `[patch]` The interactive transaction used Prisma's 5 second default — the accept now passes `{ timeout: 60_000 }`.
  - `[low]` `[reject]` A tab inside a first name splits the map line — a printed first name does not contain a tab.
  - `[low]` `[reject]` Two abbreviations that trim to the same key keep the later team — seeded abbreviations stay unique after trim and uppercasing.
  - `[low]` `[reject]` A membership's person in another league would receive the rows — the only person writers set `leagueId` from that membership's league.
  - `[low]` `[reject]` A disconnect error after commit could crash and a `past` retry could add a person — `$disconnect` throwing after a successful commit is not an everyday failure.
  - `[medium]` `[patch]` `NFL_SEASON_YEAR` of `nope` or `1999` was not locked on this copy of the year rule — the current-season test now refuses `2026.txt` for both before a write.
  - `[medium]` `[patch]` Removing the same-week guard would still pass the old tests — same fix as the two-name week test above.
  - `[false]` `[reject]` The accept tests use a fake database rather than Prisma — the spec requires that fake, and the script still calls `leaguePerson.create` and `bookRow.create` inside one transaction.
  - `[low]` `[reject]` The week-view test stubs both years, and a null `displayName` is untested — the test locks the live-year skip and the `Blair` label, and `past` always stores the first name.
  - `[false]` `[reject]` Invite lists, member pages, and renewal are source scans — this change does not edit those surfaces, and member pages already forbid `BookRow`.
  - `[false]` `[reject]` The schema test reads files instead of inserting rows — that test's job is to lock the optional membership, the unique key, and nullable `display_name`.
  - `[false]` `[reject]` Replaying `past` is not what the same-reading test does — the matrix row is the `person:<id>` replay, which the test covers.
  - `[false]` `[reject]` Gitignore keeps the accept test off a fresh checkout — the spec says the tool stays on this machine and `npm test` runs it here.

## Design Notes

The map is the accept surface. The printed grid has no league and no person id, and a first-name scan is not a mapping. `displayName` is only the label the week view already sends. A later year reuses Blair by `person:<id>`, not by that label.

```
Alex	membership:mem_alex
Blair	past
```

```
first name | week | fill | team
Alex | 1 | green | KC
Blair | 2 | empty red |
```

## Verification

**Commands:**
- `npm test` -- expected: the accept matrix, the book-row schema lock, and the week-view read-back pass

## Auto Run Result

A checked past-season grid can be accepted into this league's book. A current member keeps the league person they already have. A past member gets one person with no user and no login. The checker reads those rows for years that have no live season.

**Files changed**
- `prisma/schema.prisma` — `leagueMembershipId` is optional and unique, and `displayName` is an optional label.
- `prisma/migrations/20261116170000_league_person_optional_membership/migration.sql` — drops `NOT NULL` on `league_membership_id` and adds nullable `display_name`.
- `src/lib/commentary/week-view.ts` — book rows include a person with no membership, and that label is `displayName`.
- `src/lib/commentary/week-view.test.ts` — a book-only 2023 row is visible and that person's 2024 book row is not.
- `src/lib/commentary/book-row-schema.test.ts` — locks the optional membership and the display name.
- `scripts/accept-season-screenshot.mjs` — local accept command. Gitignored, same as the print script.
- `scripts/accept-season-screenshot.test.ts` — the matrix, the season-year copy, and the same-week conflict. Gitignored.
- `.gitignore` — keeps the accept script and its test on this machine.
- `_bmad-output/implementation-artifacts/spec-11-2-accept-a-mapped-season-into-the-book.md` — this spec.

**Review**
- Patched: 3 medium entries (4 findings). The transaction timeout is 60 seconds. `NFL_SEASON_YEAR` of `nope` and `1999` still refuses the current year. Two names on one membership and week with different fills write nothing.
- Deferred: none.
- Rejected: 10 false and 8 low. A second `past` creates another person because the label is not a lookup key. Live seasons still ignore book rows. Any integer week is stored. Unknown abbreviations, including old ones, refuse the year. Env loading matches the seed script. The other lows are paths this app does not take in ordinary use: membership delete, a superuser person id, an email-shaped first name, a tab in a name, duplicate abbreviations, a cross-league person, and a disconnect after commit.

**Follow-up review:** true. Three medium entries were patched. The 60 second timeout was not run against a live database. The test double ignores the transaction options, so a remote season can still roll back when it passes 60 seconds.

**Verification**
- `npm test` after the patches: 166 files, 1114 tests passed, including 21 accept tests and the week-view read-back.

**Residual risk**
- The migration is in the repo and has not been applied to a live database. The command fails against the current production schema until it runs.
- A second accept that still says `past` creates another person. The next year for that person uses `person:<id>`.
- The copied season-year rule can drift from `getCurrentNflSeasonYear` if that helper changes. The invalid env values are now tested on this copy.
