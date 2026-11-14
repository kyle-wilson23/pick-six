---
title: 'Show the checked note in the Tuesday digest'
type: 'feature'
created: '2026-11-13'
status: 'blocked'
review_loop_iteration: 0
baseline_revision: '964967780b015eac2bae2f92baf68b10e0c1789d'
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-10-context.md'
warnings:
  - oversized
deferred: []
---

<intent-contract>

## Intent

**Problem:** With weekly commentary on, a delivering Tuesday digest still has no checked note. Members cannot read this week's confirmed lines, and a line whose cells do not match the database can still be imagined as part of that note.

**Approach:** On a delivering send with commentary on, link current players to league persons, store one run for that league-week, call the model once, keep only sentences whose cited cells match a fresh database read, and render that stored outcome in the digest. The email never calls the model.

## Boundaries & Constraints

**Always:**
- One `CommentaryRun` per `(leagueId, nflSeasonYear, weekNumber)`, the digest's existing key. Insert it before the model call with status `PENDING`, then update that same row. A later send that finds any row does not call the model and does not overwrite the row.
- The model is called only through the Vercel AI SDK (`ai`), once, for a Zod list of at most 3 lines. Each line is the model's sentence plus cells. A cell is league person, year, week, outcome (`WIN` | `LOSS` | `TIE`), points, and team abbreviation when the model sends one.
- Spend is decimal dollars: `(inputTokens / 1_000_000) * COMMENTARY_INPUT_USD_PER_MILLION + (outputTokens / 1_000_000) * COMMENTARY_OUTPUT_USD_PER_MILLION`. The ceiling in force is `$1`. Do not start a second call for any reason, including unused room under `$1` or a short list.
- The checker re-reads every cited cell from `Pick` for that season and week. A match is the same league person, year, week, outcome, and points. When the cell includes a team abbreviation, that must match too. The stored sentence is the model's text, unchanged. Drop a mismatch, a sentence containing `league history` or `all-time` (any case), a season comparison with no 4-digit year (`last year`, `previous year`, `prior year`, `year before`, `previous season`), or a 4-digit year that is not the year on a cell that matched. Do not rewrite and do not pad.
- A normal finish with zero kept lines stores exactly `Quiet week. Nothing new for the record book.` The model does not write that sentence. The digest shows a section only for a `SETTLED` row: the kept sentences, or that quiet sentence.
- Missing or non-numeric `COMMENTARY_API_KEY`, `COMMENTARY_MODEL_ID`, or either price stores `ABNORMAL` / `missing_price`, does not call, does not store the quiet line, and leaves the digest without a section. A thrown or Zod-invalid call stores `ABNORMAL` / `model_error` the same way. `PENDING` or `ABNORMAL` renders no section. The scores email still sends. That week is not attempted again.
- Before the insert, link every membership from `leaguePlayerMembershipWhere` to one `LeaguePerson`. Create the person when the membership has none. `membershipId` is unique.

**Never:**
- Do not add a provider SDK package, a hardcoded model id, or a hardcoded token price. Do not add the dollar-ceiling column or setter (story 10.3), the debug flag, or the admin-email commentary panel (story 10.4). Do not add book rows or fold another year into the view (story 10.5). Do not show commentary on a member page or call the model from a page, preview, or cron route.
- Do not run on commentary off, or on a suppressed test-league send. Do not pass passwords, sessions, emails, or credentials in the view. Do not use `getLeaguePeerPickHistory` (it hides teams). Do not change commissioner `bodyText`, `sentAt`, cron league selection, or test-league suppression.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Delivering send, commentary on, no row | Flag true, mail will send, config present | Link persons, insert `PENDING`, one SDK call, update that row to `SETTLED` with kept sentences or the quiet sentence, and the call's spend | Scores send either way |
| Row already present | `PENDING`, `SETTLED`, or `ABNORMAL`, including force resend | No SDK call and no write. `SETTLED` renders its stored text. The others render no section | N/A |
| Suppressed test league | `isTestLeague` and mode `suppress`, flag true | No row, no spend, no section. `sentAt` behavior stays as it is | N/A |
| Commentary off | Flag false or omitted | No row, no spend, no section, even if a row already exists | N/A |
| Cell mismatch or banned wording | Cited cell differs, or the sentence hits a drop rule | That line is absent. Other kept sentences stay verbatim. Zero kept lines and a successful call store the quiet sentence | Checker spends nothing |
| Missing price or key | Any of the four env values missing or a price is not a finite number `>= 0` | Row becomes `ABNORMAL` / `missing_price`. No SDK call, no quiet line, no section | Scores email still sends |
| Call fails | SDK throws or output fails the Zod list | Row becomes `ABNORMAL` / `model_error`. No quiet line, no section. Spend is recorded only when the SDK reports usage | Scores email still sends |
| Three kept lines | Model returns more than three, and the first three match | Stored outcome has those three, in order. No further call | N/A |
| Preview or member page | Admin preview HTML, or any member route | Preview reads a `SETTLED` row and does not call. No member page shows the note or calls the model | N/A |

</intent-contract>

## Code Map

- `prisma/schema.prisma` `League` (~59–79) — `commentaryEnabled` already exists. Add `LeaguePerson` (`leagueId`, unique nullable `membershipId`) and `CommentaryRun` (`leagueId`, `nflSeasonYear`, `weekNumber` unique; status `PENDING` \| `SETTLED` \| `ABNORMAL`; `stopReason`; `outcomeText`; `lines` Json; `spend` Decimal default 0). `Pick` (~379–403) is the cell source: `outcome`, `pointsEarned`, `nflWeekNumber`, `teamId`, `leagueMembershipId`, `seasonId`. `LeagueWeekEmailConfig` (~354–377) already uses the same league-week key. Migration folder pattern `YYYYMMDDHHMMSS_description`.
- `src/lib/league/player-membership-where.ts` `leaguePlayerMembershipWhere` (~8–18) — the membership set to link. Invite lists stay on memberships.
- `src/lib/email/get-tuesday-digest-data.ts` `getTuesdayDigestData` (~75–82) — select and return `commentaryEnabled`. Today the type allows it (~22–23) but the loader omits it, so cron and admin send never see the flag. `nflSeasonYear` and `weekNumber` on the payload are the run key.
- `src/lib/email/send-tuesday-digest.ts` `sendTuesdayDigest` (~26–258) — suppression returns at ~62–111 before any commentary work. The recipient `createElement` (~144–162) has an empty `commentaryEnabled` spread (~160–161). Run once after suppression, before the loop, and pass the render text into the template. A runner failure must not skip the scores send.
- `src/lib/email/templates/TuesdayDigestEmail.tsx` — props (~34–43) have no commentary field. Insert a `Weekly note` section after the jailed-team block (~139–144) and before `PrimaryCta` (~146). Reuse `sectionStyle`, `subheadingStyle`, and `textStyle`. Body is the stored sentences or the quiet sentence, not cells and not `stopReason`. Commissioner note stays at ~148–155.
- `src/app/api/leagues/[leagueId]/email/tuesday-preview/route.ts` `GET` (~66–83) — same props, read the stored row, never call the runner.
- `src/lib/scoring/get-league-peer-pick-history.ts` (~12–24) — do not use; `teamAbbreviation` is null while the window is open.
- `src/lib/reports/reports-config.ts` (~3–8) — pattern for a server env getter. Add `COMMENTARY_API_KEY`, `COMMENTARY_MODEL_ID`, `COMMENTARY_INPUT_USD_PER_MILLION`, and `COMMENTARY_OUTPUT_USD_PER_MILLION` to `.env.example` as server-only, with no chosen model id.
- `package.json` — `ai` is not a dependency. Zod `^4.3.6` is. No `src/lib/commentary/` yet. `send-tuesday-digest.test.ts` (~161–197) asserts both flag values skip the section and mocks a `commentaryRun` delegate that does not exist yet.

## Tasks & Acceptance

**Execution:**
- `prisma/schema.prisma` -- add `LeaguePerson` and `CommentaryRun` plus a migration -- one run row and one person per player membership
- `package.json` -- add the `ai` package and no provider package -- the only model client
- `.env.example` -- document the four commentary env vars as server-only -- missing price is an observable stop
- `src/lib/commentary/config.ts` -- parse the four env values and compute decimal spend; colocated test -- missing or non-numeric price does not call
- `src/lib/commentary/lines.ts` -- Zod line schema and the drop rules; colocated test -- mismatch, banned phrases, unnamed season comparison, and a year the checker did not read are absent and not rewritten
- `src/lib/commentary/persons.ts` -- link `leaguePlayerMembershipWhere` memberships, creating a person only when missing; colocated test -- a second run does not create a second person
- `src/lib/commentary/view.ts` -- build this week's person, outcome, points, and team from `Pick`, with no secrets; re-read cited cells from the database; colocated test -- the checker does not trust the object passed to the model
- `src/lib/commentary/runner.ts` -- insert, one SDK call, update that row; colocated test with the SDK mocked -- existing row, `missing_price`, and `model_error` do not call again and do not store the quiet line
- `src/lib/email/get-tuesday-digest-data.ts` -- return `commentaryEnabled` from the league row and cover it in the colocated test -- callers can tell on from off
- `src/lib/email/send-tuesday-digest.ts` -- on a delivering send with the flag true, run once and pass the settled text; update `send-tuesday-digest.test.ts` -- off, suppress, and an abnormal run still send scores and omit the section
- `src/lib/email/templates/TuesdayDigestEmail.tsx` -- render `Weekly note` from the stored text only; extend `email-templates.test.tsx` -- the quiet sentence and kept sentences appear, cells and stop reasons do not
- `src/app/api/leagues/[leagueId]/email/tuesday-preview/route.ts` -- pass the same stored text and do not call the runner -- preview cannot spend

**Acceptance Criteria:**
- Given commentary is on and the Tuesday send will deliver mail, when that league-week has no commentary row, then one row is inserted before the only model call and updated in place, and the digest shows the kept sentences or the exact quiet sentence.
- Given a commentary row already exists, when a later Tuesday send or preview runs, then the model is not called, and the digest shows the note only when that row is `SETTLED`.
- Given the send is suppressed, commentary is off, the price or key is missing, or the model call fails, when the scores email is produced, then it has no commentary section, and a new abnormal row does not contain the quiet sentence.
- Given a cited cell or a drop rule fails, when the row is settled, then that sentence is absent, remaining sentences are the model's words, and there is no fourth line.
- Given a member opens a page in the app, when the page renders, then it does not show this note and it does not call the model.

## Spec Change Log

## Review Triage Log

### 2026-11-13 — Review pass
- verdicts: 29 findings — high 1, medium 19, low 6, false 3, maybe-false 0
- findings:
  - `[high]` `[intent_gap]` The digest week is the opening pick week, so a normal Tuesday stores the quiet sentence for games that have not been played and never runs the week that just finished — `getTuesdayDigestData` uses `resolveActiveWeekNumber`, and the 2026-09-15 23:00 UTC fixture expects week 2 while week 1 has already kicked off. `resolveWeekCloseTargets` names that closed week `openingWeek - 1`. The story says both "the digest's week key" and "this week's" results, and does not say which picks the checker reads. Attempt saved at `10-2-attempted-implementation.patch`. Code from `18f5ff2` was reverted.
  - `[medium]` `[bad_spec]` A throw after the pending insert leaves that row pending forever — `buildCommentaryView`, the fresh read, and the settled update sit outside the model-call try, and a later send will not repair the row.
  - `[medium]` `[bad_spec]` The model call has no timeout — `sendTuesdayDigest` awaits it before any scores mail, so a hung call can use up the Tuesday cron budget and skip later leagues.
  - `[false]` `[reject]` The $1 ceiling is never compared with spend — the contract's ceiling rule is one call and no second call. Design notes say a call that already returned is still checked, and spend over $1 does not delete those lines.
  - `[false]` `[reject]` An invalid fourth element fails the whole list — a payload that fails the Zod list is the contract's `model_error` stop, not a partial settle.
  - `[medium]` `[bad_spec]` The first three raw lines are sliced before the drop rules — a banned or mismatched line in that prefix uses a slot, and a later valid line from the same call is never checked. "Do not pad" and "check every returned line" are both in the spec.
  - `[medium]` `[patch]` `includes("all-time")` drops "small-time" — "colleague history" does not contain "league history". Missed paraphrases such as "all time" follow the contract's closed phrase list. Moot after the intent gap.
  - `[false]` `[reject]` A matching cell can carry a sentence that says the opposite — the contract stores the model's sentence unchanged and forbids the app from judging whether the sentence is the most impactful fact.
  - `[low]` `[reject]` Prices go through `Number` before `Prisma.Decimal` — sub-cent drift is not shown and is not compared with the ceiling. Unlikely in everyday use.
  - `[medium]` `[patch]` Kept sentences are one text node joined by newlines and `pre-wrap` — clients that drop that CSS can collapse the note. Moot after the intent gap.
  - `[low]` `[reject]` `missing_price` and `model_error` are not logged — the stop reason is stored on the row, and the email is specified to have no section.
  - `[medium]` `[bad_spec]` Outcome and team must match exactly — "Win" fails the whole call, and "phi" does not match "PHI". The contract does not say whether match is case-sensitive.
  - `[medium]` `[bad_spec]` A unique-key race can send the scores email while the row is still pending — the loser does not wait, and the winner's later update does not change mail already sent.
  - `[medium]` `[bad_spec]` A hung model call blocks the scores email — same outcome as the missing timeout, filed again by the edge-case layer.
  - `[medium]` `[bad_spec]` A view read that throws after the pending insert leaves the week unfinished — same pending-row outcome, filed again.
  - `[medium]` `[bad_spec]` A fresh read or settle update that throws after a billed call leaves the row pending — same pending-row outcome, filed again.
  - `[medium]` `[patch]` Whitespace-only kept sentences are stored, then the section hides them, and the quiet sentence is skipped — `z.string().min(1)` allows `" "`. Moot after the intent gap.
  - `[medium]` `[patch]` A 4-digit year glued to letters, such as FY2024, is not treated as a year — the matcher uses a word boundary. Moot after the intent gap.
  - `[medium]` `[patch]` Whitespace-only kept lines hide both the note and the quiet sentence — same whitespace outcome, filed again as a claim. Moot after the intent gap.
  - `[medium]` `[patch]` An uncited year glued to letters can remain in a settled sentence — same year-matcher outcome, filed again as a claim. Moot after the intent gap.
  - `[medium]` `[patch]` Preview tests never render a missing row or a non-settled row that still has text — filed by the verification-gap layer. The helper is unit-tested; the route fixtures would stay green if the route ignored status. Moot after the intent gap.
  - `[medium]` `[patch]` Cell match tests only change outcome or team — a points, person, year, week, or second-cell miss is not pinned. Moot after the intent gap.
  - `[medium]` `[patch]` A delivering commentary run is only tested for a non-test league in send mode — production with suppress mode, and a test league in send mode, are not pinned. Moot after the intent gap.
  - `[low]` `[patch]` The missing-price cases do not assert that persons are linked before the abnormal update — the success path does. Moot after the intent gap.
  - `[low]` `[patch]` The unique-person conflict test only checks that the call resolves — it does not show that the next membership is still linked, or that a non-unique error is rethrown. Moot after the intent gap.
  - `[medium]` `[patch]` No fixture drops a scored pick whose membership has no league person — deleting that null check would leave the view tests green. Moot after the intent gap.
  - `[medium]` `[intent_gap]` The story also says the model may use the loaded book, that the ceiling may stop the run before a later line, and that a later failed call keeps proved lines. The attempt implements one call against this week's `Pick` rows only. Those readings are not selected by the story text. Same halt as the week-key question.
  - `[low]` `[reject]` Digest tests render a string the runner mock already chose, and do not render a line the checker kept or dropped — the checker and the template are tested apart. A joined test would be new surface.
  - `[low]` `[reject]` No member-page test asserts the note is absent — no member page was changed.

## Design Notes

The model proposes the whole list in the one call this story allows. The `$1` ceiling is the reason a later story must not add a follow-up call; this runner never makes one, even when the first list is short and the spend is under `$1`. Lines the call already returned are still checked. The ceiling does not delete a line from that call.

Story 10.5 is what adds book rows and other years to the view. Until then a cited cell matches only this week's `Pick`. A line about another year fails the re-read and is dropped, so an empty book still lets the run finish.

The member-facing note is the sentence text under the heading `Weekly note`. Cells stay on the row for the checker. Story 10.4 is what puts the stored outcome on the admin email screen and adds debug.

## Verification

**Commands:**
- `npm test` -- expected: commentary unit tests and the updated digest tests pass, including no section on off, suppress, missing price, and model error
- `npm run db:generate` -- expected: Prisma client includes `LeaguePerson` and `CommentaryRun`

## Auto Run Result

Status: blocked
Blocking condition: intent gap

The Tuesday digest's week number is the opening pick week. On a normal Tuesday that week's games have not been played, and the week that just finished is `openingWeek - 1` (`resolveWeekCloseTargets`). An implementation that stores the note on the digest key and reads that week's picks settles "Quiet week. Nothing new for the record book." before the results exist, then refuses a later call. The story does not say whether the checker should read the closed week or the opening week, or which of those weeks the commentary row should use.

The story also says the model is called once, and that a later call can fail while proved lines are kept, and that the $1 ceiling may stop the run before a later line is proposed. It also says lines may come from this week or the loaded book, while story 10.5 is the history that counts the book. Those readings were not selected.

The attempted implementation is in `10-2-attempted-implementation.patch`. Commit `18f5ff2` was reverted. `npm test` passed on that attempt (149 files, 988 tests). `npm run db:generate` produced `LeaguePerson` and `CommentaryRun` when `DIRECT_URL` was set to a placeholder. The migration was not applied. No database is configured here.

Unresolved questions:
- Which week's picks does the checker read on Tuesday, and which league-week key stores the row?
- Is the run one model call, or can it call again until three kept lines or the $1 ceiling?
