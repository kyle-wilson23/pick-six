---
title: 'Leave a missing year out'
type: 'feature'
created: '2026-11-16'
status: 'done'
baseline_revision: 'f297d6f4cd0583e021b9a0dfc6020a93382a55e0'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** A season with no screenshot must stay out of the book. That gap must not erase accepted years, stop the weekly note, or become an import for any other league.

**Approach:** Keep the one-file accept. It writes only the year it was given. The checker and the weekly run use the years actually loaded, and the app still has no import.

## Boundaries & Constraints

**Always:**
- Accept stays `node scripts/accept-season-screenshot.mjs <leagueId> <gridFile> <mapFile>`. The grid stem is the only year that call may write. Rows for any other year stay as they are. A path that is not on disk refuses before a transaction, and those rows stay as they are.
- The week view returns scored picks for years that have a season, and book rows for other years that were accepted. A year with neither is absent. A league whose book is empty returns only its live-season picks.
- A commentary run still completes on that view. A kept sentence names only years present on the view. A sentence that says "league history" or "all-time" is dropped, including when it also names a year on the view.
- The screenshot tools stay on this machine. `src/app` does not import them.

**Never:**
- Do not add a folder importer, an app route, or a renewal flow. Do not delete book rows for a year the grid did not name. Do not invent a row for a missing file. Do not require every year between the oldest and newest before the note runs. Do not rewrite a sentence.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Gap beside an accepted year | 2022 rows exist; `2023.txt` is not on disk; accept `2024.txt` | 2024 rows are written; 2022 rows are unchanged; no 2023 row | Exit 0 |
| Missing path | 2022 rows exist; the grid path is not on disk | No transaction; 2022 rows unchanged | One stderr line, non-zero exit |
| Gapped book | Live 2026 picks, book rows for 2022 and 2024, none for 2023 | Week view years are 2022, 2024, and 2026 | 2023 is absent |
| Named comparison | View has 2022 and 2024; sentence names those years and the cited cell matches | That sentence is kept | No rewrite |
| Missing year in the sentence | Same view; sentence names 2023 | Sentence is absent | No rewrite |
| Banned phrase | Sentence says "league history" or "all-time" and names 2022 | Sentence is absent | No rewrite |
| Note still runs | Model returns the kept sentence plus the dropped ones | Run completes with the kept sentence | The dropped sentences are not stored |
| New league | One live season, no book rows | Week view is that season's scored picks | No import route |

</intent-contract>

## Code Map

- `scripts/accept-season-screenshot.mjs` — `acceptInTransaction` (~245–352) writes one stem year. `bookRow.findMany` (~280–281) and `bookRow.create` (~340–348) use that year. No delete. `readText` (~103–109) refuses a missing path before `createClient`. `acceptSeasonScreenshot` (~354–415) is the command.
- `scripts/accept-season-screenshot.test.ts` — `createDb` (~86–194) restores rows on refusal and throws on an unexpected model. `run` (~213–234) writes the given grid. Seed `rows`, and call the export with a missing path. The scan (~260–263) already rejects this script under `src`.
- `src/lib/commentary/week-view.ts` — `loadCommentaryWeekView` (~35–141) loads live years and book rows for every other accepted year. It does not fill a gap. Empty book: `week-view.test.ts` (~56–126).
- `src/lib/commentary/checker.ts` — `sentenceDropped` (~20–26) drops `league history` and `all-time` (~7) and any year missing from `yearsOnView` (~58). `confirmCommentaryLines` (~47–68) does not rewrite.
- `src/lib/commentary/checker.test.ts` — unread year (~68–71), league history (~176–185). Add the 2022/2024 gap and all-time with a year.
- `src/lib/commentary/run-commentary.ts` — `runCommentary` (~91–214) stores `confirmCommentaryLines` for the loaded view. `commentaryPrompt` (~47–52) sends those rows only.
- `src/lib/commentary/run-commentary.test.ts` — non-digest year (~235–259). Add the gapped view beside it.
- `src/lib/commentary/member-surface.test.ts` — `filesUnder` (~6–18). Extend it so `src/app` does not mention either screenshot script.
- `.gitignore` — (~54–57) keeps both tools on this machine.

## Tasks & Acceptance

**Execution:**
- `scripts/accept-season-screenshot.test.ts` -- accept `2024.txt` while a 2022 row is stored and `2023.txt` is absent; refuse a grid path that is not on disk without a transaction -- a missing year is omitted and an accepted year stays written
- `src/lib/commentary/week-view.test.ts` -- return 2022, 2024, and the live 2026 picks when 2023 has no row; keep the empty-book test as the first-season lock -- the loaded history is the years that exist
- `src/lib/commentary/checker.test.ts` -- keep a sentence that names only 2022 and 2024; drop 2023, "league history", and "all-time" -- a comparison names the years that were read
- `src/lib/commentary/run-commentary.test.ts` -- complete a run on that gapped view and store only the kept sentence -- the weekly note still runs
- `src/lib/commentary/member-surface.test.ts` -- assert `src/app` does not mention the print or accept scripts -- another league has no import to find

**Acceptance Criteria:**
- Given the accept script is on this machine, when app routes are scanned, then none import it or the print script.
- Given this story is finished, when renewal is looked for, then no renewal flow was added and the accepted rows are still stored.

## Spec Change Log

## Review Triage Log

### 2026-11-16 — Review pass
- verdicts: 16 findings — high 0, medium 0, low 4, false 12, maybe-false 0
- findings:
  - `[false]` `[reject]` The gapped commentary run only completes because the call spends the whole $1 ceiling — `modelResult(..., 1_000_000)` at $1 per million input is $1, the test ceiling is $1, and `spend.lessThan` is then false. The loop breaks, the run is `COMPLETED`, and the stored sentences are only the kept line. A second call is not this test. The runner already stops at three confirms or the ceiling.
  - `[false]` `[reject]` The accept test never puts a neighboring year file on disk — the matrix input is that `2023.txt` is not on disk. The test writes `2024.txt`, leaves the stored 2022 row, and adds one 2024 row. A walk cannot write a year whose file is absent.
  - `[low]` `[reject]` The missing-path test accepts any one-line refusal and injects `db`, so it does not observe `createClient` — `readText` already returns before `createClient` and before `$transaction`. The matrix asks for one stderr line, a non-zero exit, no transaction, and the 2022 row unchanged. A tighter error string is more than that check, and a reorder that still returns before the transaction is not an everyday path.
  - `[low]` `[reject]` The spec's accept-test line numbers are about eight lines early after the import was expanded — the fix would edit this spec. The `~` anchors still land on `createDb`, `run`, and the `src` scan.
  - `[low]` `[reject]` Nothing in this diff asserts that renewal and a folder importer are absent — `src` has no `renew` match, and the 2022 row stays in the accept test. There is no renewal flow to meet. A new scan would be more than a correction of this diff.
  - `[false]` `[reject]` The week-view "2023 is absent" check cannot fail on its own — `toEqual` lists 2026, 2022, and 2024, so a 2023 row would fail it. The view does not invent a year. The matrix names a set of years, and picks are pushed before book rows.
  - `[false]` `[reject]` The command was a folder-plus-id dispatch and should have halted with no `stories.yaml` — the path is the file `sprint-status.yaml`, not a folder of stories. The story-id path is the one that applies.
  - `[false]` `[reject]` A batch import was a defensible reading and this diff did not build one — the epic says accepting writes one fully mapped year and a missing file skips that year. The diff implements that reading.
  - `[false]` `[reject]` The accept tests call the function in process, and `2023.txt` is a file the test never created — the command body is `acceptSeasonScreenshot(process.argv[2], process.argv[3], process.argv[4])`. The tests call that function and check the code, the stdout, and the rows. The missing file is the matrix input.
  - `[false]` `[reject]` The week-view test is a mocked loader, not the Tuesday digest — the history the checker reads is `loadCommentaryWeekView`. The digest does not filter years again.
  - `[false]` `[reject]` The checker test builds lines instead of a comparison a reader sees — the sentence `confirmCommentaryLines` keeps is the sentence the run stores, and the digest assigns `run.sentences` to the email.
  - `[false]` `[reject]` The run test mocks the view, so it never loads a gapped book — the week-view test is that load. The run test checks the runner still completes when that view is what it receives.
  - `[false]` `[reject]` The app check is a filename scan, not a person looking for an import — `src/app` is where that person would look, and the test requires the screenshot script names to be absent. There is no import page.
  - `[false]` `[reject]` The empty-book test is not in this diff — `week-view.test.ts` still has "returns this week's scored pick when the book is empty", and that file's 9 tests passed.
  - `[low]` `[reject]` The renewal line has no test in the diff — same absence as the renewal scan above. No renewal flow is in `src`, and adding one is a later story.
  - `[false]` `[reject]` `sprint-status.yaml` still says backlog — the tracker write-back happens after this spec is `done`, not inside the implementation diff.

## Design Notes

A missing year is a file that was never accepted. Skip means that year has no row. The other years stay because the accept writes one stem and has no delete. The weekly note already runs on whatever the view returns. Do not add a command that walks a folder of seasons.

## Verification

**Commands:**
- `npm test` -- expected: the gap accept, the gapped week view, the named-year checker, the commentary run, and the app import scan pass

## Auto Run Result

A missing season stays out of the book. Accepting another year leaves the years already accepted in place and does not invent the missing one. The weekly note still completes on that gap, and a comparison that names the missing year, or that says "league history" or "all-time", is not stored. The app has no screenshot import.

**Files changed**
- `scripts/accept-season-screenshot.test.ts` — accepts `2024.txt` beside a stored 2022 row when `2023.txt` is absent, and refuses a grid path that is not on disk before a transaction. Gitignored, with the accept script.
- `src/lib/commentary/week-view.test.ts` — a book of 2022 and 2024 plus live 2026 picks returns those years and not 2023.
- `src/lib/commentary/checker.test.ts` — keeps a sentence that names 2022 and 2024, and drops 2023, "league history", and "all-time".
- `src/lib/commentary/run-commentary.test.ts` — a run on that gapped view completes and stores only the kept sentence.
- `src/lib/commentary/member-surface.test.ts` — `src/app` does not mention the print or accept scripts.
- `_bmad-output/implementation-artifacts/spec-11-3-leave-a-missing-year-out.md` — this spec.

**Review**
- Patched: none. High 0, medium 0.
- Deferred: none.
- Rejected: 12 false and 4 low. The gapped run finishes because the call meets the $1 ceiling, which is the runner's existing stop, and the stored line is the kept sentence. The accept test's missing `2023.txt` is the case the story asks for. The missing-path check matches the matrix and the script already returns before `createClient`. The code-map lines are approximate and correcting them would edit this spec. Renewal is not in `src`. The week view's year list is the `toEqual`. The command path was a story id, not a stories folder. The tests call the accept function the command calls, the loader the checker reads, and the sentences the digest sends. The empty-book test was already in the week-view file and passed. The sprint tracker is updated after this spec is done.

**Follow-up review:** false. This pass patched nothing.

**Verification**
- `npm test`: 166 files, 1120 tests passed, including 23 accept tests, 9 week-view tests, 13 checker tests, 18 commentary-run tests, and 4 member-surface tests.

**Residual risk**
- The accept test stays on this machine because it is gitignored with the script. A fresh checkout does not run it until that file is present.
- The gapped run test stops on the $1 ceiling, the same stop the other one-sentence tests use. A cheaper call would ask the model again until three sentences or the ceiling, which is the existing runner.
