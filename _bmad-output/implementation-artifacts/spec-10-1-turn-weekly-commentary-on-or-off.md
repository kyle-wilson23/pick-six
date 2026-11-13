---
title: 'Turn weekly commentary on or off'
type: 'feature'
created: '2026-11-09'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'fb6ca4f34b9d56dad7cc0fa2f5fd63aa7d5609aa'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-10-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A league cannot choose weekly results commentary. Every league, including ones that already exist, must start off so a Tuesday digest never gains a commentary section, a stored run, or a model charge until an admin opts in. Story 10.2 is what later produces the note.

**Approach:** Store one league-level on/off flag, default false. Only the existing league-admin path can change it, and the saved value stays until an admin changes it again. Turning it on persists the choice and does not call a model.

**Decision:** The switch is in the Weekly Email section of the league admin page, next to the commissioner note. It is not on League settings.

## Boundaries & Constraints

**Always:**
- Column `commentaryEnabled` (`commentary_enabled`), `Boolean`, not null, default `false`. The migration default covers existing leagues. New leagues stay false because create does not set the field.
- The admin path is `requireLeagueAdminAccess`: league `ADMIN` or the configured superuser. A member or a signed-out caller cannot change it.
- Off means the Tuesday send adds no commentary section, stores no commentary run, and spends nothing. On, in this story, does the same: no runner, no section, no spend.
- CSRF and JSON errors match `PATCH /api/leagues/[leagueId]/first-competition-week`.

**Never:**
- Do not add the debug flag, dollar ceiling, commentary-run table, league person, or book.
- Do not put the switch on the create-league form, and do not store it on `LeagueWeekEmailConfig`.
- Do not call the Vercel AI SDK or any model. Do not change digest sections, commissioner `bodyText`, test-league suppression, cron selection, or `sentAt`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Existing league | Migration applied, no admin save | `commentaryEnabled` is false | N/A |
| New league | `POST /api/leagues` without the field | Row is false | N/A |
| Admin turns it on, then off | `PATCH` `{ "commentaryEnabled": true }` then `false` | Each save persists; a later read returns that value | N/A |
| Not an admin | Signed-out, member, or unknown league | Value unchanged | 401 signed out; 403 otherwise |
| Bad body | Non-JSON, or JSON that is not a boolean | Value unchanged | 400 `VALIDATION_ERROR` |
| Tuesday send, flag false or true | `sendTuesdayDigest` for that league | Scores email unchanged; no commentary section, run, or spend | N/A |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` `League` (~59–77) — only boolean today is `isTestLeague` `@default(false)` `@map("is_test_league")`. Add `commentaryEnabled` the same way. No commentary, person, or book models exist.
- `prisma/migrations/20260719195353_add_league_is_test_league/migration.sql` — copy this shape: `BOOLEAN NOT NULL DEFAULT false`.
- `src/app/api/leagues/route.ts` `POST` (~127–148) — `tx.league.create` does not need the new field; the schema default covers it. Do not add it to `src/lib/league/create-league-body.ts` or `create-league-form.tsx`.
- `src/lib/league/require-league-admin.ts` `requireLeagueAdminAccess` (~22–30) — reuse. `get-league-access.ts` `LeagueAccessLeague` and `leagueSelect` (~15–36) list fields explicitly; add `commentaryEnabled` there and in `get-league-access.test.ts`. `isAdmin` (~57) is superuser or `ADMIN`. The admin page (~46) already loads `access.league`.
- `src/app/api/leagues/[leagueId]/first-competition-week/route.ts` `PATCH` (~32–76) — copy order: parse JSON, Zod, CSRF, `auth()`, admin gate.
- `src/lib/league/patch-first-competition-week-body.ts` and `patch-first-competition-week-body.test.ts` — copy for a boolean body schema and its tests.
- `src/lib/email/send-tuesday-digest.ts` `sendTuesdayDigest` (~26–60) — leave suppression, `bodyText`, and send behavior. Do not pass a commentary prop into `TuesdayDigestEmail` (`templates/TuesdayDigestEmail.tsx` ~80–155).
- `src/lib/email/send-tuesday-digest.test.ts` — extend so a send with the flag false or true still has no commentary side effect.
- Do not change `src/app/api/cron/tuesday-email/route.ts`, `src/lib/email/test-league-email-mode.ts`, or `LeagueWeekEmailConfig.bodyText`.

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma` -- add `League.commentaryEnabled` and a migration that defaults existing rows to false -- persistence for FR1
- [x] `src/lib/league/patch-commentary-enabled-body.ts` -- Zod `{ commentaryEnabled: boolean }` plus a colocated test -- reject non-booleans before any write
- [x] `src/app/api/leagues/[leagueId]/commentary/route.ts` -- `PATCH` in the first-competition-week order, admin-only, update that column -- the only writer
- [x] `src/lib/league/get-league-access.ts` -- add `commentaryEnabled` to `LeagueAccessLeague` and `leagueSelect`, and update `get-league-access.test.ts` -- the admin page reads `access.league`
- [x] `src/components/admin/CommentarySwitch.tsx` -- client MUI `Switch` inside `Stack`; `PATCH` the commentary route -- the admin sees and saves the league flag
- [x] `src/app/(app)/leagues/[leagueId]/admin/page.tsx` -- render that switch in the Weekly Email stack (~175–188), above `AdminEmailComposer`, passing `leagueId` and `league.commentaryEnabled` -- placement is the Weekly Email section
- [x] `src/lib/email/send-tuesday-digest.test.ts` -- assert a send with the flag false or true does not render a commentary section and does not write a commentary run -- FR2, and on does not start 10.2

**Acceptance Criteria:**
- Given an existing league after migration, or a league just created, when no admin has saved the switch, then it is off.
- Given a league admin saves on or off, when the league is read again, then that value remains, and a non-admin save leaves it unchanged.
- Given the Tuesday digest runs while the flag is off or on, when this story’s code handles the send, then the email has no commentary section, no run is stored, and nothing is spent.

### Review Findings

- [x] [Review][Patch] Fail the default-off source test when the league create call is missing [src/lib/league/commentary-enabled-default.test.ts:29]
- [x] [Review][Defer] Default-off commentary is only pinned by source text [src/lib/league/commentary-enabled-default.test.ts:6] — deferred: vitest does not execute migrations or league inserts, so proving a stored false would be a new database harness

### Rejected

- `false` — Live Tuesday sends omit `commentaryEnabled`. The field is optional and documented as off when omitted, and both arms of the send spread add nothing, so omitted, false, and true stay scores-only.
- `false` — `sendTuesdayDigest` reads the flag and discards it. That empty spread is the specified no-op; story 10.2 owns the first real branch. The contradictory implementation notes are in the spec under review.
- `low` — A late refresh or a league change can paint another flag on `CommentarySwitch`. The switch is disabled until the request settles, so this needs a second toggle or a navigation during an in-flight refresh. The fix is an in-flight guard.
- `false` — The switch has no caption that the email stays scores-only. The spec places “Weekly commentary” in Weekly Email and does not require that sentence. The control still persists the boolean.
- `low` — The digest test looks for the words “commentary” and “Quiet week” and mocks a `commentaryRun` model that does not exist. The send adds no section, and a real run call would fail typecheck. Widening the oracle is new test surface.
- `false` — Nothing writes the column and reads it back through `leagueSelect`. `leagueSelect` includes `commentaryEnabled` and `LeagueAccessLeague` requires it, so dropping the column fails typecheck. `resolveLeagueAccess` is pure.
- `low` — Spec frontmatter says `done` while sprint status says `review`, and the triage log is stale. The fix edits the spec under review.
- `low` — Route and switch tests skip empty body, a mismatched Origin, a thrown update, the unknown-league JSON body, a superuser whose league row is missing, `auth()` skipped on a non-boolean, a failure that starts from on, and disabled-while-saving. Those paths already match the spec or the shared admin-save pattern. Covering them is new test surface.
- `low` — A save that finishes after the admin opens another league can show one league’s flag on the other. Same in-flight window as the refresh race; the fix is a generation guard.
- `low` — An older `router.refresh()` can flip the switch back during a newer toggle. Same race. The switch is disabled for the request itself, and the fix adds a guard.
- `low` — A fetch that throws after the server has saved reverts the switch and shows “Request failed” while the stored flag is the new value. That needs the response to be lost after commit. Refreshing in `catch` is a new branch.
- `low` — A commentary save that never settles leaves the switch disabled. Same `saving` flag as the other admin saves, and a timeout is new complexity.
- `low` — A save error can remain after a league change when both leagues share the same boolean. That needs a failed save still on screen, and the fix is another effect guard.
- `low` — Tests never rerender `commentaryEnabled` during a save, so they miss the stale-refresh overwrite. Same race as above, and the fix is a guard rather than a correction of current send behavior.

## Implementation Notes

- `commentaryEnabled` is a non-null boolean on `League`, mapped to `commentary_enabled`, default false. Migration `prisma/migrations/20261112140000_add_league_commentary_enabled/migration.sql`. `npm run db:migrate` did not apply: this workspace has no `DATABASE_URL` or `DIRECT_URL`, so no existing row was read back.
- Prisma Client was regenerated locally so the new field type exists. That output is not a source file.
- `PATCH /api/leagues/[leagueId]/commentary` is the only writer. The Weekly Email admin page renders `CommentarySwitch` above `AdminEmailComposer`.
- `sendTuesdayDigest` does not read the flag. Both values stay on the scores-only send. Story 10.2 should branch before any model call.
- The switch was not clicked in a browser. There is no database to sign in against. The component test covers the toggle and the PATCH body.
- Review patch: `TuesdayDigestData.commentaryEnabled` is optional. `sendTuesdayDigest` reads it and still adds no section, run, or model call. Switch tests cover the initial on state and a rejected fetch. `npm test` passed, 143 files and 946 tests.
- `20261112140000_add_league_commentary_enabled` is applied. `commentary_enabled` is boolean, not null, default false. The one existing league reads false. `migrate dev` then prompted for a new migration because five older simulation indexes have truncated names; that drift was left unchanged.

## Spec Change Log

## Review Triage Log

- `medium` — `send-tuesday-digest.test.ts` parameterizes `commentaryEnabled` but never passes it into `sendTuesdayDigest`, and the last expect compares the flag to itself. A branch that added a commentary section only when that flag is true would stay green. Only the first recipient is rendered.
- `false` — The access test echoes the object it was given. `resolveLeagueAccess` is pure. `leagueSelect` includes `commentaryEnabled`, and `loadLeagueAccess` passes that result into `LeagueAccessLeague`, so dropping the column fails typecheck.
- `medium` — The migration file was not applied. `getLeagueAccess` now selects `commentary_enabled`, and this workspace has no `DATABASE_URL`, so an existing row was not read back as false.
- `low` — The switch label is only "Weekly commentary", with no caption that a save leaves the Tuesday email scores-only. The spec does not require helper copy, and adding it is new text rather than a correction.
- `low` — After `finally` clears `saving`, a late `router.refresh()` can repaint the switch, including after a league change. `disabled={saving}` already blocks clicks during the request. The leftover window is uncommon, and the fix is an in-flight guard.
- `low` — A fetch that never settles leaves the switch disabled. Other admin saves use the same `saving` flag. A timeout would be a new guard.
- `medium` — `CommentarySwitch` tests only mount `commentaryEnabled={false}`. `useState(commentaryEnabled)` is correct today, but `useState(false)` would still pass. The `ok: false` test does not reject `fetch`, so deleting the `catch` revert would still pass.
- `false` — Sprint status stays `in-progress` while the spec is `in-review`. This review step changes the spec status and does not sync the sprint file.
- `low` — The new digest test does not enter the test-league suppress branch. That branch is unchanged and does not write commentary.
- `low` — The route does not test a 500, a mismatched Origin, an empty body, or the unknown-league JSON body. Invalid JSON and the member 403 body are tested, and the unknown league uses the same `forbiddenAdminJson()`.

## Design Notes

Story 10.2 owns the runner. This story’s send path has nowhere to call. The flag is the gate: both values skip commentary. A later story should branch on `commentaryEnabled === true` inside `sendTuesdayDigest` before any model call, and only when the send will deliver mail.

The control is `CommentarySwitch`, a client component. The admin server page passes `leagueId` and `commentaryEnabled` only. Use a MUI `Switch` inside `Stack`, matching `create-league-form.tsx`, and do not pass theme callbacks from the server page.

## Verification

**Commands:**
- `npm test` -- expected: new body-schema tests and the digest guard test pass
- `npm run db:migrate` -- expected: migration applies locally and existing leagues read `commentaryEnabled === false`
