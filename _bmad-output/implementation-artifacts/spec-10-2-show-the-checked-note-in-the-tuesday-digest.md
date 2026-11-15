---
title: 'Show the checked note in the Tuesday digest'
type: 'feature'
created: '2026-11-15'
status: 'done'
review_loop_iteration: 0
baseline_revision: '964967780b015eac2bae2f92baf68b10e0c1789d'
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-10-context.md'
warnings:
  - oversized
deferred:
  - summary: >-
      Member pages are checked by scanning source text, not by rendering a page.
    evidence: |-
      member-surface.test.ts rejects runCommentary, generateText, an ai import, and the quiet sentence under league member routes, excluding admin. No member route in this change renders commentary. A later page that printed stored sentences without those strings would still pass.
    location: >-
      src/lib/commentary/member-surface.test.ts
    severity: low
---

<intent-contract>

## Intent

**Problem:** With commentary on, the Tuesday digest still sends scores only. Nothing proposes a line, drops one whose cells do not match, or shows a checked note.

**Approach:** On a delivering send with commentary on, store one run for that league-week, call the Vercel AI SDK for lines, keep only lines whose cited cells match this week, and render that stored outcome in the digest. The scores email still sends.

## Boundaries & Constraints

**Always:**
- One `CommentaryRun` per league, `nflSeasonYear`, and week. Insert it before the first model call. A later send that finds the row, including a `started` row, does not call. The unique key also blocks a concurrent second call.
- Call the runner only when `commentaryEnabled` is true, the suppress branch does not return, the circuit breaker is not already open, and there is at least one recipient. Otherwise store nothing and spend nothing.
- Each call uses the `ai` package only: `generateText` with `Output.object` and a Zod list. Model id is `COMMENTARY_MODEL_ID`. No provider package. Spend is input and output tokens times `COMMENTARY_INPUT_USD_PER_MILLION` and `COMMENTARY_OUTPUT_USD_PER_MILLION`, in `Prisma.Decimal` dollars, added on the run. The checker does not spend.
- Ceiling is $1. After a call, do not start another once 3 lines are confirmed or spend is at least $1. Keep the lines from the call that crosses $1.
- A line is the model's sentence plus person id, year, week, outcome, points, and team abbreviation. Re-read `Pick` for that person and this league-week. Keep the sentence only on an exact match of outcome, points, and team. Drop a mismatch, "league history", "all-time", and a year comparison with no 4-digit year. Do not rewrite or pad.
- A normal finish with zero confirms stores exactly `Quiet week. Nothing new for the record book.` The model does not write it.
- An abnormal stop stores the reason and any proved sentences, skips the quiet line, omits the section, and is not retried. Missing model id, missing `AI_GATEWAY_API_KEY`, missing or non-numeric price, an SDK throw, and a `started` row are stops. A runner failure must not skip the scores send.
- Before creating a run, link each current player membership to one `LeaguePerson`, creating it if needed. At most one person per membership.
- The model view is this week only: person id, `userDisplayName`, outcome, points, and team abbreviation. No email, user id, password, or session. The app is the only querier.
- Digest and admin preview read stored sentences and do not call the model. Render the section only for proved sentences or the quiet line, after the jailed block and before the picks CTA.

**Never:**
- Do not add a debug flag, ceiling column, Kyle setter, admin-screen note, `BookRow`, or past-season join. Stories 10.3–10.5 own those.
- Do not change cron selection, `sentAt`, test-league mode, or `bodyText`.
- Do not show the note on a member page or add a chat route.
- Do not hardcode a model id or a price, and do not call once per recipient.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Off or omitted flag | Send delivers | Scores only; no run; no SDK call | N/A |
| Suppressed, open breaker, or no recipients | Flag true | No run; no SDK call | N/A |
| Three matches under $1 | First list matches 3 picks; spend < 1 | One call; digest shows those sentences | N/A |
| Zero matches under $1 | First list matches nothing; spend < 1 | A later call may run; stop at 3 or spend >= 1 | N/A |
| Ceiling crossed | Call ends with spend >= 1 and one match | Keep that sentence; no further call | N/A |
| Later call throws | One sentence already stored; next call throws | Sentence kept; no quiet line; no section; scores send | Stop reason on the row |
| Missing config | Price, model id, or gateway key missing | Row stored; no SDK call; no section; scores send | Stop reason on the row |
| Existing row | Retry, second send, or `started` | No SDK call | Unfinished becomes a stop |
| Quiet week | Normal finish, zero confirms | Exact quiet sentence in the digest | N/A |
| Bad sentence | Cells match; text has "league history", "all-time", or "last year" and no 4-digit year | Line absent; not rewritten | N/A |
| Named years | Cells match; sentence names 2024 and 2026 | Sentence stored unchanged | N/A |
| Other week | Cited year or week is not this digest week | Line absent | N/A |
| Preview | Proved lines or quiet line stored | Preview shows them and does not call | N/A |
| No person | Membership has no person | One person linked; a second run adds none | N/A |

</intent-contract>

## Code Map

- `src/lib/email/send-tuesday-digest.ts` `sendTuesdayDigest` (~26–125) — suppress and the already-open breaker return before any run. Run once after those returns and before `mapWithConcurrency` (~130). Delete the empty spread inside the member loop (~160–161) and pass the stored sentences into every recipient. Leave `sentAt` and the Resend idempotency key.
- `src/lib/email/get-tuesday-digest-data.ts` — `commentaryEnabled` (~22–23) means off when omitted, but the league `select` (~79–82) never loads it. Add it to the select and the return. `nflSeasonYear` and `weekNumber` are the run key.
- `src/lib/email/templates/TuesdayDigestEmail.tsx` — props (~34–43). Keep standings (~102–137) and jailed (~139–144). Insert the note before the CTA (~146). `email-templates.test.tsx` requires the CTA before the commissioner note (~148–155).
- `src/app/api/leagues/[leagueId]/email/tuesday-preview/route.ts` (~66–83) — same props, read-only. Do not change `src/app/api/cron/tuesday-email/route.ts` or `src/lib/email/test-league-email-mode.ts`.
- `src/lib/email/send-tuesday-digest.test.ts` — mocks a `commentaryRun` delegate (~7–23) that is not in the schema, and expects no commentary for both flag values (~161–197).
- `prisma/schema.prisma` — `League.commentaryEnabled` (~59–78). `Pick` (~379–403) stores `outcome`, `pointsEarned`, and `teamId` per membership, season, and week. No `LeaguePerson` or `CommentaryRun`. Ids are cuid; columns are snake_case. `LeagueWeekEmailConfig` (~354–377) uses the same league-year-week key.
- `src/lib/domain/scoring.ts` `scorePickOutcome` (~36–47) — 1, 2, or 0 already stored on the pick. Read it; do not rescore. No-pick is the absence of a row (`get-league-peer-pick-history.ts` ~181–192).
- `src/lib/league/player-membership-where.ts` (~9–18) and `userDisplayName` in `src/lib/user-display-name.ts` (~27–33). Leave invite routes alone.
- `src/lib/commentary/` is absent. `package.json` has no `ai` package. Copy the Zod style in `src/lib/league/patch-commentary-enabled-body.ts`. After install, read `node_modules/ai/docs` for `generateText` and `Output.object`. Do not use `generateObject`.

## Tasks & Acceptance

**Execution:**
- `prisma/schema.prisma` -- add `LeaguePerson` (league id, unique membership id) and `CommentaryRun` (unique league, year, week; status; stop reason; decimal spend; sentences) and a migration -- the retry must see the row
- `package.json` -- `npm install ai` only -- one SDK, no provider package
- `.env.example` -- blank server-only `COMMENTARY_MODEL_ID`, `AI_GATEWAY_API_KEY`, `COMMENTARY_INPUT_USD_PER_MILLION`, `COMMENTARY_OUTPUT_USD_PER_MILLION` -- missing price stays visible
- `src/lib/commentary/commentary-config.ts` -- read that env; ceiling is the decimal `1`; missing id, key, or a non-numeric price is not callable -- plus `commentary-config.test.ts` for those cases
- `src/lib/commentary/spend.ts` -- token usage times the two prices, decimal dollars, with a test that a non-call adds nothing -- the checker does not spend
- `src/lib/commentary/line-schema.ts` -- Zod list item of sentence plus person id, year, week, outcome, points, and optional team -- SDK output
- `src/lib/commentary/checker.ts` -- pure match and drop, with tests for the bad-sentence, named-years, other-week, and no-pad rows -- no rewrite
- `src/lib/commentary/ensure-league-persons.ts` -- one person per current player membership; second call creates none; invitations untouched -- plus a colocated test for the no-person row
- `src/lib/commentary/week-view.ts` -- one query for this week only, with no email or user id -- the model view
- `src/lib/commentary/run-commentary.ts` -- insert, then update: skip an existing row, skip the SDK when not callable, stop at 3 or spend >= $1, keep proved sentences when a later call throws, quiet line only on a normal zero -- plus `run-commentary.test.ts` mocking `generateText` for those rows
- `src/lib/email/get-tuesday-digest-data.ts` -- select and return `commentaryEnabled` -- cron and admin sends see the flag
- `src/lib/email/send-tuesday-digest.ts` -- one runner call when delivery will be attempted; pass sentences through; a runner throw still sends scores -- off and suppress stay empty
- `src/lib/email/templates/TuesdayDigestEmail.tsx` -- print lines after jailed and before the CTA; omit when empty -- the member surface
- `src/app/api/leagues/[leagueId]/email/tuesday-preview/route.ts` -- pass stored sentences; do not call the runner -- preview is a read
- `src/lib/email/send-tuesday-digest.test.ts` -- off, suppress, and open breaker create no run; a delivering on-send shows proved lines or the quiet sentence and hides the section on a stop; standings and jailed text remain -- the email surface

**Acceptance Criteria:**
- Given commentary is on and this Tuesday send will deliver mail, when the digest is sent, then the email shows at most three confirmed sentences or the exact quiet sentence, the template did not call the model, and standings and the jailed team are unchanged.
- Given the send is off, suppressed, already has a run, or cannot call, when it finishes, then no new model call is made, and a scores email that was going out still goes out.
- Given a member opens a league page, when it renders, then it shows no commentary and calls no model.

## Spec Change Log

## Review Triage Log

### 2026-11-15 — Review pass
- verdicts: 32 findings — high 0, medium 11, low 10, false 11, maybe-false 0
- findings:
  - `[medium]` `[patch]` A blank name puts the member email in the model prompt — the view now uses `Player` when the display label contains `@`.
  - `[false]` `[reject]` Any four-digit year keeps a year comparison — the spec drops a comparison only when it names no four-digit year.
  - `[low]` `[patch]` "this year" was treated as a comparison and dropped — `this` was removed from the comparison regex, and the checker test keeps that sentence.
  - `[medium]` `[patch]` The model could store the quiet-week sentence as a proved line — the checker drops that exact sentence.
  - `[false]` `[reject]` A ceiling stop with zero confirms writes the quiet line — a finished loop with zero confirms is the normal quiet week, including when spend reaches $1.
  - `[false]` `[reject]` The loop has no attempt cap and a timeout leaves the row started — the spec calls until 3 confirms or $1, and a started row is the unfinished stop.
  - `[false]` `[reject]` A call that adds no spend hides proved lines — that path is an abnormal stop, which keeps the sentences on the row and omits the section.
  - `[low]` `[reject]` A unique-key loser omits the note, and a concurrent person insert can throw — overlapping sends are uncommon, and the fix would add a reread plus `skipDuplicates`.
  - `[medium]` `[patch]` `result.output` throws outside the try, a null team fails the list, and the prompt key does not match the schema — the read is inside the try after spend is added, `team` is nullish, the prompt copies `teamAbbreviation` into `team`, and a later save failure also stops the row.
  - `[false]` `[reject]` Preview ignores the commentary flag — the preview scenario shows a stored completed run and does not consult the flag.
  - `[low]` `[patch]` The same sentence can be stored twice and fill the cap — the runner skips a sentence already confirmed. The writer already stops at three.
  - `[false]` `[reject]` A matching sentence is not checked for naming the person — the spec stores the model's sentence unchanged when the cells match.
  - `[false]` `[reject]` A book-only person cannot be stored — this story links one person per current membership. The book is story 10.5, and the membership query is already limited to this league.
  - `[medium]` `[patch]` A scored member with a blank name sends their email — same `Player` label as the first finding.
  - `[medium]` `[patch]` A missing parsed object never stores that call's spend — spend is added before `output` is read, and the catch stops the row.
  - `[low]` `[reject]` A model call that never returns blocks the scores email — a hang is uncommon, and a timeout would add a limit the spec does not set.
  - `[low]` `[reject]` A second send can stop a run that is still in progress — overlapping sends are uncommon, and a lease would be new state.
  - `[low]` `[patch]` A later call can repeat a sentence — the runner skips a sentence already confirmed.
  - `[low]` `[reject]` Two sends creating one person can throw and omit the note — same uncommon race as the unique-key finding.
  - `[medium]` `[patch]` A throw while reloading the week or saving spend leaves the row started — that work is inside a try that stops the row with the spend already counted.
  - `[medium]` `[patch]` The view claim repeats the blank-name email leak — same `Player` label.
  - `[medium]` `[patch]` The runner test does not prove confirmation uses the re-read — the second load now disagrees, and the mismatched sentence is not stored.
  - `[medium]` `[patch]` A response with no priced usage is an untested stop — the runner test covers matching lines with no `totalUsage`, one stop, sentences kept, and an empty digest.
  - `[low]` `[patch]` The person-link test never checks which memberships are queried — it now asserts `leaguePlayerMembershipWhere` for that league.
  - `[medium]` `[patch]` The runner test does not check the structured-output schema — it asserts `commentaryLineListSchema` on the `generateText` call.
  - `[low]` `[defer]` The member-page check only reads source text — deferred. No member route in this change renders the note, and a page harness is new surface.
  - `[medium]` `[patch]` A blank `User.name` is still sent as an email — same `Player` label.
  - `[low]` `[reject]` A price of 0 aborts an otherwise normal run — a literal zero price is unlikely, and rejecting it would add a rule the spec does not state.
  - `[false]` `[reject]` The send rules and the email HTML are tested on opposite sides of a mock — the runner tests the rules, and the digest test renders the strings that runner returns.
  - `[false]` `[reject]` The member-page scenario is a source scan — no member page in this change renders the note.
  - `[false]` `[reject]` The view is this week only and there is no debug column — debug and the loaded book are stories 10.4 and 10.5.
  - `[false]` `[reject]` Sprint status still says backlog for 10-2 — this run records the spec, not the sprint tracker.

## Auto Run Result

Tuesday digests with commentary on now store one checked run for that league-week and show up to three confirmed sentences, or the exact quiet sentence, after the jailed team and before the picks link. Scores still send when commentary is off, suppressed, stopped, or the runner fails.

Patched entries at verdict: medium 6 (email label, quiet-sentence drop, output/save stop, re-read test, no-usage test, schema assertion), low 3 ("this year", duplicate sentence, membership where). Deferred: the member-page source scan. Rejected lows were the concurrent-send races, a model timeout, and a zero price. False findings were the spec's own quiet-week, ceiling, and unfinished-row rules, plus the later-story book and debug scope.

Follow-up review is recommended. The catch around `result.output` is in place, and no test makes that getter throw `NoOutputGeneratedError`.

`npm test` passed after the patches: 152 files, 993 tests. The migration file is in the repo and has not been applied to the database. A live send cannot create the commentary row until that migration is deployed; the scores email still goes out.

Files:
- `prisma/schema.prisma` — `LeaguePerson` and `CommentaryRun`
- `prisma/migrations/20261115180000_add_league_person_and_commentary_run/migration.sql` — those tables
- `package.json` — `ai` only
- `.env.example` — model id, gateway key, and token prices
- `src/lib/commentary/` — config, spend, checker, person link, week view, and runner
- `src/lib/email/get-tuesday-digest-data.ts` — loads `commentaryEnabled`
- `src/lib/email/send-tuesday-digest.ts` — one run when the send will deliver
- `src/lib/email/templates/TuesdayDigestEmail.tsx` — the note section
- `src/app/api/leagues/[leagueId]/email/tuesday-preview/route.ts` — reads the stored run

## Design Notes

The epic's first scenario says the model is called once for a Zod list. Later scenarios forbid another call after 3 confirms or the $1 ceiling, and keep proved lines when a later call fails. That is one loop: each call returns a list, spend is known after the call, and the next call waits on both stops. The first list can be the only call.

This story does not load a book. Any other year or week fails the cell check. Story 10.5 adds that history. Debug is not a column yet, so the section uses the debug-off rule. Story 10.4 adds the switch. The ceiling helper returns $1 until story 10.3.

A `started` row is unfinished. The next send marks it stopped, keeps sentences already stored, and does not call.

## Verification

**Commands:**
- `npm test` -- expected: config, spend, checker, runner, and Tuesday digest tests pass
