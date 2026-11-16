---
title: 'Set the league''s weekly dollar ceiling'
type: 'feature'
created: '2026-11-15'
status: 'done'
review_loop_iteration: 0
baseline_revision: '0a9d0be94be2f04100b0bd1c0086514db707cca5'
followup_review_recommended: true
context: []
warnings:
  - oversized
deferred: []
---

<intent-contract>

## Intent

**Problem:** Every commentary run stops at a fixed $1. Kyle cannot give one league a different weekly dollar ceiling, and a league admin must not be able to.

**Approach:** Store a per-league decimal ceiling that defaults to $1. The configured superuser can replace it from that league's admin page. The next new run stops at 3 confirmed lines or that ceiling, whichever comes first.

## Boundaries & Constraints

**Always:**
- The ceiling is one non-null decimal on the league, the same `Decimal(12, 6)` scale as `CommentaryRun.spendUsd`. Existing and newly created leagues default to $1. Creating a league does not set the column.
- Kyle is the configured superuser (`SUPERUSER_EMAIL`), including a superuser with no membership. Only that user can replace one league's ceiling. The write is a separate route from the on/off flag, with the same JSON, Zod, CSRF, and session order.
- A saved value is a non-negative decimal string that fits the column, after trim. `0` is valid. The stored form is that decimal's string. A rejected body leaves the stored ceiling unchanged.
- The runner reads the league ceiling only after the existing-row check, and only for a new callable run. Compare spend to that value. Do not start another model call once spend is no longer below it. Keep lines from the call that crosses it. A normal finish with zero confirms still stores the quiet sentence, including when the ceiling is `0` and the loop never calls.
- An existing run row is not called again and is not rewritten because the ceiling changed.

**Never:**
- Do not add the ceiling to the on/off PATCH body, and do not let a league admin or other member save it.
- Do not add a debug flag, an admin-screen note, a book row, or a past-season join. Stories 10.4 and 10.5 own those.
- Do not put the ceiling on a member page, in the digest, or in an env var. Do not fall back to $1 when the row exists.
- Do not change cron selection, test-league suppression, `sentAt`, or the on/off switch.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Default | League never given a ceiling | Next new run stops at 3 confirms or $1 | N/A |
| Superuser save | Admin page, ceiling `2.5` | Field shows the stored decimal; later new run uses `2.5` | N/A |
| Crossed ceiling | Stored ceiling `0.001`; one call spends at least that | That call's confirmed lines are kept; no later call | N/A |
| Zero | Superuser saves `0` | No model call; quiet sentence stored | N/A |
| Invalid | Blank, negative, `$1`, or a decimal that does not fit `Decimal(12, 6)` | Stored ceiling unchanged | 400 |
| League admin | Admin page, or a ceiling PATCH | No field; stored ceiling unchanged; on/off still saves only the flag | 403 on the ceiling route |
| Existing run | Row already stored; ceiling then changes | No model call; that row is not rewritten | N/A |

</intent-contract>

## Code Map

- `prisma/schema.prisma` `League` (~59–81) — add non-null `commentaryWeeklyCeilingUsd`, `@default(1)`, `@map("commentary_weekly_ceiling_usd")`, `@db.Decimal(12, 6)`. `CommentaryRun.spendUsd` (~413) is the scale to match. `src/app/api/leagues/route.ts` `tx.league.create` (~128–130) sets name and `isTestLeague` only.
- `prisma/migrations/20261112140000_add_league_commentary_enabled/migration.sql` — pattern for a `NOT NULL DEFAULT` column on `leagues`. New migration defaults existing rows to `1`.
- `src/lib/commentary/commentary-config.ts` (~5–6, ~66) — `COMMENTARY_CEILING_USD` and `ceilingUsd` are the fixed $1. Remove `ceilingUsd` from the config object. Keep the constant as the documented $1 default. `commentary-config.test.ts` (~21–22) asserts that field.
- `src/lib/commentary/run-commentary.ts` `runCommentary` (~96–152) — `handleExisting` returns before any call. The loop compares `config.ceilingUsd`. Read `League.commentaryWeeklyCeilingUsd` after that return and before the loop. `run-commentary.test.ts` prisma mock (~45–53) has no `league` delegate and defaults the $1 cases (~212–255).
- `src/app/api/leagues/[leagueId]/commentary/route.ts` — flag PATCH. `patch-commentary-enabled-body.ts` is `.strict()` and stays flag-only. Copy its JSON, Zod, CSRF, and `auth()` order for the new route, then require `access.isSuperuser` from `loadLeagueAccess`. `requireLeagueAdminAccess` (~21–29 in `require-league-admin.ts`) also allows a league admin, so it is the wrong gate.
- `src/lib/league/get-league-access.ts` `leagueSelect` (~32–38) and `LeagueAccessLeague` (~15–21) — add the ceiling. The admin page (~52, ~181–184) has `access.isSuperuser` and renders `CommentarySwitch` under Weekly Email. Pass a string, not a `Prisma.Decimal`, into the client field.
- `src/components/admin/CommentarySwitch.tsx` — client save pattern: fetch PATCH, show `role="alert"` on failure, `router.refresh()` on success. The ceiling field needs an explicit save so a partial amount is not written on each keystroke. Use `Stack`.
- `src/lib/league/commentary-enabled-default.test.ts` — file-scan pattern for the default column and for create not setting it.
- `src/lib/league/get-league-access.test.ts` `league` fixture (~6–12) — include the new field when the type requires it.

## Tasks & Acceptance

**Execution:**
- `prisma/schema.prisma` -- add `commentaryWeeklyCeilingUsd` and a migration that defaults existing leagues to `1` -- one ceiling per league
- `src/lib/league/commentary-ceiling-default.test.ts` -- assert the schema default, the migration default, and that league create does not set the column -- existing leagues stay at $1
- `src/lib/league/patch-commentary-ceiling-body.ts` -- strict Zod for one trimmed non-negative decimal string that fits `Decimal(12, 6)`, plus a test for `0`, `2.5`, blank, negative, and `$1` -- rejected input does not parse
- `src/app/api/leagues/[leagueId]/commentary-ceiling/route.ts` -- superuser-only PATCH that returns the stored decimal string, with a route test for save, 400, and league-admin 403 -- a league admin cannot write it
- `src/lib/commentary/commentary-config.ts` -- stop returning `ceilingUsd` -- the league column is the ceiling in force
- `src/lib/commentary/run-commentary.ts` -- load the league ceiling for a new callable run and stop the loop on it, including `0` as a quiet finish with no call -- plus runner tests for a crossed ceiling below $1 and for `0`
- `src/lib/league/get-league-access.ts` -- select the ceiling -- the admin page can show the stored value
- `src/components/admin/CommentaryCeilingField.tsx` -- dollar field and save button that PATCHes the string and shows the stored value -- a partial amount is not saved on each keystroke
- `src/app/(app)/leagues/[leagueId]/admin/page.tsx` -- render that field under Weekly Email only when `access.isSuperuser`, passing the stored decimal string -- a league admin does not see it
- `src/lib/league/patch-commentary-enabled-body.test.ts` -- assert a ceiling key on the flag body fails -- the admin path still writes only the flag

**Acceptance Criteria:**
- Given the configured superuser opens a league admin page, when they save a weekly dollar ceiling, then that league shows the stored amount and its next new commentary run stops at 3 confirmed lines or that amount, whichever comes first.
- Given a league admin opens that page or submits a ceiling update, when the request finishes, then the ceiling is unchanged and the on/off control still saves only the commentary flag.

## Spec Change Log

## Review Triage Log

### 2026-11-15 — Review pass
- verdicts: 15 findings — high 0, medium 5, low 5, false 5, maybe-false 0
- findings:
  - `[medium]` `[patch]` A ceiling read after the STARTED insert burns the week if it throws — the league read now happens before that insert, so a missing league throws with no row.
  - `[medium]` `[patch]` An unsaved draft follows a same-string ceiling into another league — the field has `key={leagueId}` and remounts.
  - `[low]` `[reject]` Enter does not save, and a double-click can send two PATCHes — the spec saves on the button so typing is not a write, and the second click stores the same amount.
  - `[low]` `[reject]` The error alert is not tied to the field and stays while the draft changes — it matches the commentary switch the spec pointed at, and the message is already visible.
  - `[false]` `[reject]` A negative stored outside Zod becomes a quiet week — the PATCH schema rejects negatives, this change has no other writer, and `spendUsd` is the same unconstrained decimal.
  - `[low]` `[reject]` `.5` and `1.` are rejected, and the largest column value is untested — those forms are incomplete, the price parser rejects them too, and `999999.999999` already passes `lessThan(1000000)` with at most 6 decimal places.
  - `[low]` `[reject]` The visibility test never renders the admin page — the field sits in the superuser branch, and a full page harness is new. The stored-prop gap is the verification finding below.
  - `[low]` `[reject]` Route tests skip bad JSON, a bad Origin, a missing league, and a ceiling above $1 that stops with lines left — bad JSON and Origin return before a write, as on the flag route, and the stop is the same `lessThan` check already tested at `$0.001` and `$1`.
  - `[medium]` `[patch]` A ceiling query throw after STARTED leaves the week unfinished — same move: read the ceiling before the insert.
  - `[medium]` `[patch]` The page test does not require the stored ceiling prop — the visibility test now matches `ceilingUsd={league.commentaryWeeklyCeilingUsd.toString()}`.
  - `[medium]` `[patch]` A failed ceiling lookup after insert leaves STARTED and the next send does not call — same move as the first finding.
  - `[false]` `[reject]` No run starts from a row that received the database default — the migration and schema tests lock `DEFAULT 1`, and the runner's default mock is that same `$1`.
  - `[false]` `[reject]` A second league is not tested — the update's `where` is the route league id, so another league's row is not written.
  - `[false]` `[reject]` The admin path and page are not exercised as a rendered surface — the flag schema rejects a ceiling key, the ceiling route returns 403 for a league admin, and the page test requires the superuser branch.
  - `[false]` `[reject]` The stop is not tested through the Tuesday send — the digest already calls `runCommentary` with the league id, and the ceiling comparison is inside that function. The digest file was not part of this change.

## Design Notes

`$0` never enters the loop because spend starts at `0`, which is not below the ceiling. That is a normal finish with zero confirms, so the existing quiet sentence applies. It is not an abnormal stop.

The call that crosses the ceiling still keeps its confirmed lines. The ceiling only blocks the next call. A change after a row exists does not reopen that row.

## Verification

**Commands:**
- `npm test` -- expected: ceiling default, body, route, runner, and admin-field tests pass

## Auto Run Result

Each league now has a weekly commentary dollar ceiling that defaults to $1. The configured superuser can replace it from that league's admin page. A league admin cannot. The next new commentary run stops at 3 confirmed lines or that amount, whichever comes first.

Files:
- `prisma/schema.prisma` — `League.commentaryWeeklyCeilingUsd`, default $1
- `prisma/migrations/20261115200000_add_league_commentary_weekly_ceiling_usd/migration.sql` — existing leagues default to 1
- `src/lib/league/commentary-ceiling-default.test.ts` — schema, migration, and create omit the column
- `src/lib/league/patch-commentary-ceiling-body.ts` — strict decimal string that fits the column
- `src/app/api/leagues/[leagueId]/commentary-ceiling/route.ts` — superuser-only PATCH
- `src/lib/commentary/commentary-config.ts` — config no longer returns a fixed ceiling
- `src/lib/commentary/run-commentary.ts` — reads the league ceiling before inserting a new run
- `src/lib/league/get-league-access.ts` — selects the ceiling for the admin page
- `src/components/admin/CommentaryCeilingField.tsx` — dollar field and Save button
- `src/app/(app)/leagues/[leagueId]/admin/page.tsx` — shows the field only for the superuser, keyed by league

Review: 15 findings — high 0, medium 5, low 5, false 5, maybe-false 0. Patched entries at verdict: medium 3 (ceiling read before insert, `key={leagueId}`, stored-ceiling assertion). Deferred: none. Rejected lows were Enter and double-click, the untied alert, `.5`/`1.`, the unrendered page, and extra route cases. False findings were a negative column, the database default, a second league, the admin flag path, and the Tuesday send.

Follow-up review is recommended. No test makes the league lookup throw or return null, and no test mounts the field for two leagues with the same stored string.

`npm test` passed after the patches: 157 files, 1021 tests. The admin page was not opened in a browser. The field's save and error behavior is covered by the component test.

Residual risk: a throw from the ceiling read still skips that send's note. The next send can try again because no run row was created. That throw is not covered by a test.
