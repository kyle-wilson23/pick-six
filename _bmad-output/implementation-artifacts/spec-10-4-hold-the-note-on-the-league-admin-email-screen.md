---
title: 'Hold the note on the league admin email screen'
type: 'feature'
created: '2026-11-15'
status: 'done'
review_loop_iteration: 0
baseline_revision: '57fd835ded95c89ffe6e59fba0e2b62048be0ff3'
followup_review_recommended: true
context: []
warnings:
  - oversized
deferred: []
---

<intent-contract>

## Intent

**Problem:** An enabled league's checked note always goes out in the Tuesday digest. Kyle cannot hold that note on the league admin email screen to read it before members see it.

**Approach:** Add a per-league debug flag that defaults off. Only the configured superuser can change it. A delivering send still runs and spends. While the flag is on, the digest omits the commentary section and the Weekly Email section shows the stored printable lines. While it is off, that section hides them and the digest keeps today's rule.

## Boundaries & Constraints

**Always:**
- `League.commentaryDebug` is a non-null boolean, `@default(false)`, `@map("commentary_debug")`. Existing and new leagues stay off. League create does not set the column.
- Only the configured superuser (`SUPERUSER_EMAIL`), including one with no membership, can turn it on or off. The write is its own route, with the same JSON, Zod, CSRF, and session order as the ceiling route, then `access.isSuperuser`. A saved value is a boolean. The response is that boolean.
- A delivering send with commentary on still calls `runCommentary` once and still spends. After that call, debug on passes no lines into `TuesdayDigestEmail`, so the "This week" section is absent. Debug off leaves the returned lines as they are.
- The Weekly Email section reads the stored run for that page's season year and week. It renders `digestCommentarySentences` of that row and does not call the model. Debug on shows those sentences to anyone who can open the admin page. Debug off renders none. A missing row, a null week, or a non-completed run renders no sentences and does not invent the quiet line.
- The Tuesday preview is the digest. Debug on omits the section there too. It still only reads the stored run.

**Never:**
- Do not add the flag to the on/off PATCH body, and do not let a league admin or other member save it.
- Do not skip, rewrite, or re-call a run because the flag changed. Do not change the ceiling, the runner loop, test-league suppression, or cron selection.
- Do not put the note on a member page, in a new screen, or in the member email while debug is on.
- Do not show a stopped run's stored sentences or the quiet sentence on the admin screen. Layout inside the email section stays a list of the printable sentences.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Untouched league | Column never written | Debug is off | Create omits the column; migration defaults existing rows to false |
| Superuser save | `true`, then `false` | Stored boolean matches the body; switch shows it | 400 on a non-boolean or extra key; stored value unchanged |
| League admin save | Admin session, either boolean | 403; column unchanged; on/off route still rejects a debug key | No write |
| Delivering send, debug on, commentary on | Run returns two proved lines | `runCommentary` called once; scores email has no "This week" section and neither line | A thrown run still sends scores with no section |
| Delivering send, debug off | Completed proved lines or the quiet sentence | Digest section unchanged | Stopped run still omits the section |
| Admin email section, debug on | Completed lines, or the quiet sentence | Those sentences are visible to a league admin and to the superuser | No model call |
| Admin email section, debug off or stopped | Flag off, or `STOPPED` with proved lines | No commentary sentences and not the quiet sentence | Missing run renders nothing |

</intent-contract>

## Code Map

- `prisma/schema.prisma` `League` (~65–67) — add `commentaryDebug` beside `commentaryEnabled`. `prisma/migrations/20261112140000_add_league_commentary_enabled/migration.sql` is the `NOT NULL DEFAULT false` pattern. `src/app/api/leagues/route.ts` `tx.league.create` (~128–130) sets name and `isTestLeague` only.
- `src/lib/league/commentary-enabled-default.test.ts` — file-scan pattern for the default column and for create not setting it.
- `src/app/api/leagues/[leagueId]/commentary-ceiling/route.ts` (~29–86) — copy the JSON, Zod, CSRF, `auth()`, and `loadLeagueAccess` superuser gate. `requireLeagueAdminAccess` is the wrong gate. `src/lib/league/patch-commentary-enabled-body.ts` stays `.strict()` and flag-only. `patch-commentary-enabled-body.test.ts` (~32–37) already rejects a ceiling key.
- `src/components/admin/CommentarySwitch.tsx` — client save: PATCH, `role="alert"` on failure, `router.refresh()` on success. Use `Stack`. `key={leagueId}` matches the ceiling field so one league's toggle does not stick on another.
- `src/lib/league/get-league-access.ts` `LeagueAccessLeague` (~15–21) and `leagueSelect` (~33–40) — add the flag. `get-league-access.test.ts` `league` fixture (~6–12) must include it.
- `src/app/(app)/leagues/[leagueId]/admin/page.tsx` Weekly Email (~177–201) — season from `resolveCurrentSeasonForLeague` (~64), `weekNumber` from the submission payload (~74). Render the switch only when `access.isSuperuser`. Render the sentences whenever `league.commentaryDebug` is on, including for a league admin. `commentary-ceiling-visibility.test.ts` is the file-scan pattern; the note must remain after the superuser branch is removed.
- `src/lib/commentary/digest-sentences.ts` — printable sentences. Completed proved lines and the quiet sentence pass. Anything else, including `STOPPED` with proved lines, is `[]`. `quiet-week.ts` is the sentence the screen must not invent.
- `src/lib/email/get-tuesday-digest-data.ts` select (~81) and return (~166–170) — `commentaryEnabled` is already there. Add `commentaryDebug`. `TuesdayDigestData` (~18–24) treats a missing `commentaryEnabled` as off; do the same for debug so current send fixtures stay off.
- `src/lib/email/send-tuesday-digest.ts` (~128–186) — call `runCommentary` first, then pass `lines: []` when debug is on. `send-tuesday-digest.test.ts` (~240–295) is the delivering on-send that must keep its lines when the flag is absent.
- `src/lib/email/templates/TuesdayDigestEmail.tsx` (~149–160) — `lines.length > 0` is the "This week" section. Do not add a debug prop to the template.
- `src/app/api/leagues/[leagueId]/email/tuesday-preview/route.ts` (~65–87) — reads the run and passes `digestCommentarySentences`. When debug is on, pass `[]` instead. `tuesday-preview/route.test.ts` (~79–126) already asserts no model call; `digestData()` (~52) needs the new field. The route must not import `runCommentary`.

## Tasks & Acceptance

**Execution:**
- `prisma/schema.prisma` -- add `commentaryDebug` and a migration that defaults existing leagues to false -- untouched leagues stay off
- `src/lib/league/commentary-debug-default.test.ts` -- assert the schema default, the migration default, and that league create does not set the column -- existing leagues stay off
- `src/lib/league/patch-commentary-debug-body.ts` -- strict Zod boolean, plus a test for `true`, `false`, `"true"`, and an extra key -- a rejected body does not parse
- `src/app/api/leagues/[leagueId]/commentary-debug/route.ts` -- superuser-only PATCH that returns the stored boolean, with a route test for on, off, 400, and league-admin 403 -- a league admin cannot write it
- `src/lib/league/patch-commentary-enabled-body.test.ts` -- assert a debug key on the flag body fails -- the admin path still writes only the flag
- `src/lib/email/get-tuesday-digest-data.ts` -- select and return `commentaryDebug` -- the send and the preview can see the flag
- `src/lib/email/send-tuesday-digest.ts` -- after a successful run, pass no lines when debug is on -- the run still happens and the member email has no commentary section
- `src/lib/email/send-tuesday-digest.test.ts` -- debug on calls `runCommentary` once and the rendered email has neither proved line nor "This week" -- spend still happens; scores still send
- `src/app/api/leagues/[leagueId]/email/tuesday-preview/route.ts` -- pass no lines when debug is on -- the preview matches the digest and does not call the model
- `src/lib/league/get-league-access.ts` -- select the flag -- the admin page can read it
- `src/components/admin/CommentaryDebugSwitch.tsx` -- switch that PATCHes the boolean and shows the stored value -- only the superuser can change it
- `src/components/admin/HeldCommentaryNote.tsx` -- list the given sentences and render nothing for an empty list -- a stop is not the quiet line
- `src/app/(app)/leagues/[leagueId]/admin/page.tsx` -- load that week's run, show the switch only for the superuser, and show the printable sentences to every admin when debug is on -- opening the page does not call the model

**Acceptance Criteria:**
- Given a league whose debug flag has not been changed, when that league's admin page is opened, then the hold is off and the Weekly Email section shows no commentary.
- Given the configured superuser turns the hold on or off, when the switch is saved, then only that path changes it, a league admin cannot, and the on/off control still saves only the commentary flag.
- Given debug is on and commentary is on, when a delivering Tuesday send runs, then that week's one run still happens, the scores email has no commentary section, and the Weekly Email section shows the stored proved lines or the stored quiet sentence without calling the model.
- Given debug is on and that week's run stopped, when a league admin or the superuser views Weekly Email, then the section does not show the quiet sentence.
- Given debug is off, when the Tuesday digest is sent or previewed, then the commentary section is included only for proved lines or the quiet sentence, and the Weekly Email section does not show it.

## Spec Change Log

## Review Triage Log

### 2026-11-15 — Review pass
- verdicts: 18 findings — high 0, medium 6, low 1, false 10, maybe-false 1
- findings:
  - `[false]` `[reject]` The note stays empty until a delivering send — the screen reads a stored run and must not call the model; a missing row renders no sentences.
  - `[false]` `[reject]` Turning the hold off does not rewrite an already-sent week — `sentAt` and the Resend key already belong to the digest send; this story does not require a second delivery.
  - `[medium]` `[patch]` The hold switch and the ceiling field shared `key={leagueId}` — each control now has its own key that still includes the league id.
  - `[false]` `[reject]` An uncaught commentary-run lookup can reject the admin page — a thrown lookup was never demonstrated, and failing loudly is what an unhandled read already does.
  - `[maybe-false]` `[reject]` A flexed list may drop the list role — if true this only changes how a screen reader groups a few short lines, and current browsers keep the list role on a flexed `ul`.
  - `[false]` `[reject]` The switch label does not explain spend or an empty list — the story leaves that layout open, and the label names the hold.
  - `[medium]` `[patch]` Admin-screen cases were only a source scan — `heldCommentarySentences` now runs the three cases, and the page calls it.
  - `[low]` `[patch]` The debug-on preview test accepted an empty 200 body — it now also requires Standings and Jailed team.
  - `[false]` `[reject]` A non-admin member is untested, and `leagueSelect` is not asserted — a member hits the same non-superuser 403 the league-admin test covers, and dropping `commentaryDebug` from the select fails the `LeagueAccessLeague` type.
  - `[false]` `[reject]` The screen week might differ from the digest week — submission status and the digest both call `resolveActiveWeekNumber` with the same season and games.
  - `[false]` `[reject]` The stored-run lookup throws and the page errors — same unshown failure as the uncaught lookup; a loud failure is correct there.
  - `[medium]` `[patch]` Two sibling controls share one league id key — same distinct-key fix.
  - `[false]` `[reject]` A hold flipped during `runCommentary` is ignored — the send uses the digest snapshot loaded for that send, the same way it reads `commentaryEnabled`.
  - `[medium]` `[patch]` The Weekly Email hold is only pinned by a source scan — same `heldCommentarySentences` tests.
  - `[medium]` `[patch]` The switch and the ceiling share `key={leagueId}` — same distinct-key fix.
  - `[medium]` `[patch]` The admin screen is checked as source text — the decision the page calls is executed in `digest-sentences.test.ts`.
  - `[false]` `[reject]` A stopped run's stored lines are hidden — the admin screen and the digest render the same stored outcome, and a stop is not the quiet line.
  - `[false]` `[reject]` Spend is only implied by calling `runCommentary` — the unchanged runner is what spends, and the send test asserts that call once.

## Design Notes

`digestCommentarySentences` is the stored outcome both surfaces already share. A completed run shows its sentences, including the quiet sentence when that is what was stored. A stopped run is empty, so the screen must not replace it with the quiet sentence and must not print proved lines the digest would hide.

Debug changes where that outcome is shown. The runner never reads the flag. Blank `lines` only after `runCommentary` returns, so a delivering on-send still spends. The preview blanks the same way because it is the digest, not the admin screen.

## Verification

**Commands:**
- `npm test` -- expected: debug default, body, route, digest send, preview, and admin-screen tests pass

## Auto Run Result

The configured superuser can hold one league's commentary on the Weekly Email section. A delivering Tuesday send still runs and spends. While the hold is on, the member digest and its preview omit the commentary section, and every admin who can open that page sees the stored printable sentences. While it is off, that section shows nothing and the digest keeps the previous rule. A stopped run is not shown as the quiet line.

Files:
- `prisma/schema.prisma` — `League.commentaryDebug`, default off
- `prisma/migrations/20261115210000_add_league_commentary_debug/migration.sql` — existing leagues default to false
- `src/lib/league/commentary-debug-default.test.ts` — schema, migration, and create omit the column
- `src/lib/league/patch-commentary-debug-body.ts` — strict boolean body
- `src/app/api/leagues/[leagueId]/commentary-debug/route.ts` — superuser-only PATCH
- `src/lib/email/get-tuesday-digest-data.ts` — selects and returns the flag
- `src/lib/email/send-tuesday-digest.ts` — blanks digest lines after the run when the hold is on
- `src/app/api/leagues/[leagueId]/email/tuesday-preview/route.ts` — preview matches the digest
- `src/lib/league/get-league-access.ts` — selects the flag for the admin page
- `src/lib/commentary/digest-sentences.ts` — `heldCommentarySentences` for the Weekly Email decision
- `src/components/admin/CommentaryDebugSwitch.tsx` — superuser switch
- `src/components/admin/HeldCommentaryNote.tsx` — list of stored sentences
- `src/app/(app)/leagues/[leagueId]/admin/page.tsx` — switch for the superuser, note for every admin

Review: 18 findings — high 0, medium 6, low 1, false 10, maybe-false 1. Patched entries at verdict: medium 2 (distinct React keys; executing hold-decision tests), low 1 (preview still shows Standings and Jailed team). Deferred: none. Rejected findings were an empty note before any run, no second delivery after the hold is turned off, an uncaught run lookup, the flexed list role, the switch label, a member 403, the screen week, a mid-run flag flip, stopped lines staying hidden, and spend living in the unchanged runner.

Follow-up review is recommended. Patched counts this pass: high 0, medium 2, low 1. The two keyed controls were not mounted together, and the page's call into `heldCommentarySentences` was checked as source rather than by loading a run through the admin page.

`npm test` passed after the patches: 163 files, 1048 tests. The admin page was not opened in a browser. The switch and the sentence list are covered by component tests, and the hold decision is covered by `digest-sentences.test.ts`.

Residual risk: a throw from the commentary-run read still rejects the whole admin page. The next open can try again because the read does not write a run.
