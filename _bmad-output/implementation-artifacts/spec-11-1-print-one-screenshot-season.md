---
title: 'Print one screenshot season'
type: 'feature'
created: '2026-11-16'
status: 'done'
baseline_revision: 'c311f7aa5d6ac418f31dfc7e52976b8b989803f8'
baseline_commit: 'c311f7aa5d6ac418f31dfc7e52976b8b989803f8'
review_loop_iteration: 0
followup_review_recommended: true # three medium patches after review were not re-reviewed: grid delimiters, rejection fixtures, season-year override
context: []
warnings:
  - oversized
deferred: []
---

<intent-contract>

## Intent

**Problem:** Kyle cannot see what a past-season screenshot was read as before anything is stored. A current-season file or a plain CSV must not be treated as a past season.

**Approach:** A local script reads one year-named image, asks a vision model for a grid of first name, week, fill, and team, and prints that grid. It writes nothing. Accepting a mapped season is a later story.

## Boundaries & Constraints

**Always:**
- The filename stem is the season year: a 4-digit integer from 2000 through 2100, as in `2024.png`. The current year is `NFL_SEASON_YEAR` when that value is an integer in that range, otherwise the UTC calendar year — the same rule as `getCurrentNflSeasonYear`. A stem equal to that year is the league's current season and is rejected.
- Accepted extensions are `png`, `jpg`, `jpeg`, and `webp`, compared case-insensitively. `.csv` is a plain CSV and is rejected. Any other extension, or a stem that is not that year, is rejected. Rejection happens before a model call.
- The printed grid has the columns `first name`, `week`, `fill`, and `team`, one row per cell, sorted by first name then week. Fill is `green`, `pale blue`, `red`, `empty red`, `yellow`, or `orange`. The team cell is the text the screenshot named, or blank when it named none. A red cell with no team prints as `empty red`.
- The vision call uses `generateText` from `ai` with the image bytes and one fixed instruction that names those columns and fill words. That instruction carries no league, member, book, pick, or commentary text. The call has no tools. The model id is `BOOK_VISION_MODEL_ID` only.
- A repeated first name and week, a week that is not an integer, or a fill outside that list prints no grid. A model throw or empty output prints no grid. The process exits non-zero. Zero cells prints the header only and exits 0.
- The script runs as `node scripts/print-season-screenshot.mjs <file>` on this machine. Stdout is the grid. Stderr is the rejection. Missing `BOOK_VISION_MODEL_ID` rejects before a call.

**Never:**
- Do not write the database. Do not import `prisma`, `@prisma/client`, `run-commentary`, `commentary-config`, `spend`, or `@/lib/db`. Do not create a `CommentaryRun`, read or update `commentaryWeeklyCeilingUsd`, or call `addCallSpend`.
- Do not resolve team abbreviations to `Team` ids, map fills to points, create league persons, or accept a season. Those belong to the next story.
- Do not add an app route, and do not import this script from `src/app` or `src/lib`. Do not call `runCommentary` or `readCommentaryConfig`. Do not use `COMMENTARY_MODEL_ID`.
- Do not send member names, book rows, or the commentary prompt to the model.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Past year | `2024.png`; current year 2026; model returns Alex week 1 green KC | Stdout grid contains `Alex`, `1`, `green`, `KC` | No model spend is stored |
| Current season | `2026.png`; current year 2026 | No stdout grid | Rejected before a model call |
| Plain CSV | `2024.csv` | No stdout grid | Rejected before a model call |
| Not a year | `notes.png` | No stdout grid | Rejected before a model call |
| Other file | `2024.txt` | No stdout grid | Rejected before a model call |
| Image only | Accepted image | Call includes the image bytes and the fixed instruction | Call text has no book, member, or commentary payload |
| Named pick | Cell text is the team | That text is the team column | No `Team` lookup |
| Empty red | Red cell, no team | Fill `empty red`, blank team | Not stored |
| Bad reading | Duplicate name+week, non-integer week, or unknown fill | No grid | Non-zero exit, nothing written |
| Model failure | Throw or no output | No grid | Non-zero exit, nothing written |
| No model id | `BOOK_VISION_MODEL_ID` unset | No call | Rejected, nothing written |
| Empty sheet | Model returns no cells | Header only | Exit 0 |

</intent-contract>

## Code Map

- `src/lib/league/nfl-season.ts` — `getCurrentNflSeasonYear` (~9–18) reads `NFL_SEASON_YEAR` or the UTC year. `resolve-current-season.ts` (~10–18) uses that year for a league. The script must not query `Season`; it repeats this year rule so `node` can run the file on Node 20.
- `src/lib/commentary/run-commentary.ts` — `generateText` (~161–165) is text-only, imports `server-only`, and meters spend. Do not import this module. Copy the `Output.object({ schema })` shape only.
- `src/lib/commentary/commentary-config.ts` — `COMMENTARY_MODEL_ID` and `AI_GATEWAY_API_KEY` (~8–11, ~41–66) belong to the weekly ceiling. Do not call `readCommentaryConfig`.
- `src/lib/commentary/spend.ts` — `addCallSpend` (~13–25) records league dollars. Do not call it.
- `src/lib/commentary/line-schema.ts` — Zod `Output.object` example (~4–17). The screenshot schema is a different object: `firstName`, `week`, `fill`, `team`.
- `prisma/schema.prisma` — `BookRow` (~404–420) and `LeaguePerson` (~388–401) stay unused. `Team.abbreviation` (~136–138) is not resolved here.
- `scripts/sync-nfl-schedule.mjs` — existing `node` script pattern. `vitest.config.ts` (~13) includes only `src/**/*.test.ts`. `package.json` scripts (~5–19) have no book command.
- `node_modules/@ai-sdk/provider-utils` `ImagePart` — `{ type: "image", image: bytes }`. `generateText` takes `messages` or `prompt`, not both.

## Tasks & Acceptance

**Execution:**
- [x] `scripts/print-season-screenshot.mjs` -- classify the file, call `generateText` with the image and the fixed instruction, print the grid or reject -- a past season can be checked before any write
- [x] `scripts/print-season-screenshot.test.ts` -- cover every matrix row with a fake model, assert this file does not import prisma, the commentary runner, config, or spend, and assert `src/app` and `src/lib` do not import it -- rejection, the image-only call, and the undeployed boundary stay true without a live model
- [x] `vitest.config.ts` -- include `scripts/**/*.test.ts` -- `npm test` runs the new file

**Acceptance Criteria:**
- Given a past-year screenshot, when the script runs, then stdout is the grid of first name, week, fill, and team, and the database is unchanged.
- Given a `.csv` file or a file whose year is the current season year, when the script runs, then the file is rejected, the model is not called, and nothing is written.
- Given the script is in the repo, when the app routes and commentary modules are scanned, then none import it, and it does not call the commentary runner.

## Spec Change Log

## Review Triage Log

### 2026-11-16 — Review pass
- verdicts: 22 findings — high 0, medium 4, low 5, false 13, maybe-false 0
- findings:
  - `[false]` `[reject]` Future years such as 2027 are sent to the model — the spec rejects only the stem equal to the current season year, and 2027 is inside 2000–2100.
  - `[false]` `[reject]` Any integer week, including 0 and weeks above 18, prints as a row — the spec rejects a non-integer week and prints every other integer so the reading stays visible.
  - `[low]` `[reject]` Empty, spaced, or mixed-case first names can print as separate rows — everyday screenshot names will not collide this way, and trimming would change the name the spec says to print.
  - `[false]` `[reject]` `empty red` with a team, or the team text `blank`, prints as a successful row — the spec prints the returned fill and the named team text, and only rewrites a red cell that names no team.
  - `[medium]` `[patch]` A `|` or newline in a first name or team splits the printed grid and still exits 0 — `breaksColumns` now rejects that cell with no grid and a non-zero exit. The year stays off the grid because the specified columns do not include it.
  - `[low]` `[reject]` The script does not load `.env`, does not pre-check the gateway key, and keeps the SDK retry default — today's UTC year is the 2026 season, a missing key fails the call with no grid, and loading env files is more than a one-line correction.
  - `[false]` `[reject]` Extension-only classification sends an empty or mislabeled image, with no media type or size cap — the spec accepts png, jpg, jpeg, and webp by extension and sends those bytes.
  - `[false]` `[reject]` Epic context, empty spec context, in-review versus in-progress, and extra untested cases — those cases are specified behavior or the same holes as the verification-gap rows, and the tracker is updated when the run finishes.
  - `[medium]` `[patch]` A pipe or newline in a cell breaks the grid — same delimiter defect as above; `breaksColumns` rejects it before printing.
  - `[low]` `[reject]` First names that differ only by surrounding spaces bypass the duplicate check — unlikely on a real sheet, and trimming the name would hide the reading.
  - `[low]` `[reject]` A vision call with no timeout can hang — Kyle can stop the local process, and a timeout would be a new guard the spec does not require.
  - `[false]` `[reject]` `process.exit` drops a buffered grid — the direct `node` run received stderr after exit, so that write was not dropped.
  - `[low]` `[reject]` A fifo path can block `readFileSync` — a screenshot path is a regular file, and the fix would add a stat branch for a path this tool is not given.
  - `[medium]` `[patch]` Rejection tests used paths that were never created, so a missing file looked like a reject — those tests now create the file and assert the classifier message, including the `node` CSV run.
  - `[medium]` `[patch]` A valid `NFL_SEASON_YEAR` was never different from the UTC year — the suite now rejects a present `2031.png` when that env is 2031 and still prints a present `2026.png`.
  - `[false]` `[reject]` The diff does not build stories 11.2 and 11.3 — this run is one story, and 11.1 is the first story of epic 11.
  - `[false]` `[reject]` The spec said in-review while the tracker said in-progress — the tracker follows the finished spec status.
  - `[false]` `[reject]` Tests mock the vision call instead of sending a real screenshot — the spec verifies with a fake model and does not spend on a live call.
  - `[false]` `[reject]` "Nothing written" is a source scan, not a database diff — the script does not import a database client, so it cannot write.
  - `[false]` `[reject]` The call includes a fixed instruction, not the image alone — the spec locks that instruction as the only text and forbids league evidence, and the test checks both.
  - `[false]` `[reject]` Ceiling exclusion is a source scan, not a stored-spend query — the spec forbids the ceiling helpers, and the script does not call them.
  - `[false]` `[reject]` The script is committed even though it need not be — "need not" allows the local script to live in the repo, and the app does not import it.

## Auto Run Result

A local script prints one past-season screenshot as a grid of first name, week, fill, and team, and writes nothing. A current-season file, a plain CSV, and any other non-image are rejected before the vision call. Epic 10 is marked done, and epic 11 is in progress on this first story.

**Files changed**
- `scripts/print-season-screenshot.mjs` — classifies the file, calls the vision model with the image and one fixed instruction, and prints or rejects.
- `scripts/print-season-screenshot.test.ts` — covers the matrix, the delimiter reject, created rejection fixtures, and the 2031 season-year override.
- `vitest.config.ts` — runs `scripts/**/*.test.ts`.
- `_bmad-output/implementation-artifacts/epic-11-context.md` — compiled epic 11 context.
- `_bmad-output/implementation-artifacts/spec-11-1-print-one-screenshot-season.md` — this spec.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — epic 10 done, epic 11 started.

**Review**
- Patched: 3 medium entries (4 findings). A `|` or newline in a cell is rejected. Rejection tests create the file and check the classifier message. `NFL_SEASON_YEAR=2031` is distinct from the UTC year.
- Deferred: none.
- Rejected: 13 false and 5 low, for the reasons in the triage log. Future years, integer weeks outside 1–18, raw first names, and `empty red` with a team match the spec. Env-file loading, a call timeout, and a fifo check are unlikely everyday cases and would add behavior the spec does not require.

**Follow-up review:** true. Three medium patches landed after the review layers ran and were not reviewed again: the grid-delimiter reject, the rejection fixtures, and the season-year override.

**Verification**
- `npm test` after the patches: 165 files, 1092 tests passed, including 29 script tests.

**Residual risk**
- The copied season-year rule can drift from `getCurrentNflSeasonYear` if that helper changes.
- A team value that is only spaces is treated as blank, so a red cell with spaces prints as `empty red`.
- No live vision call was made.

## Design Notes

Node 20 cannot import the TypeScript season helper from a `node` script, so the script keeps the same year rule locally. The fixed instruction is how the model knows the columns; "the image only" means that instruction is the only text, and no league evidence is added.

```
first name | week | fill | team
Alex | 1 | green | KC
Alex | 2 | empty red |
```

## Verification

**Commands:**
- `npm test` -- expected: the new script tests pass, including rejection before a model call and no stored spend
