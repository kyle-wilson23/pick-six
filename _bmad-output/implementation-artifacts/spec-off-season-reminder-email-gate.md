---
title: 'Gate automated reminder emails during NFL off-season'
type: 'bugfix'
created: '2026-08-08'
status: 'done'
baseline_commit: '3b15c4db521b1b3fdaeb42fd332eca82cd1356c8'
context:
  - '{project-root}/docs/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Production leagues receive Tuesday digest and Wed/Thu pick-reminder emails on calendar weekdays even when the NFL regular season has not started (e.g. August with Week 1 kickoffs still weeks away), because week resolution treats any future kickoff as an active competition week.

**Approach:** Reuse the existing picks-UI preview gate (before first competition-window kickoff) so **automated cron** skips sends for real leagues in that window. Admin send buttons remain an intentional override. Test/rehearsal leagues are unchanged.

## Boundaries & Constraints

**Always:**
- Gate **cron** paths for Tuesday digest, Wednesday reminder, and Thursday reminder on production leagues when the resolved week is still picks-preview / pre-competition kickoff.
- Skipping must **not** write `sentAt` / `wednesdayReminderSentAt` / `thursdayReminderSentAt` (so the first in-season cron can still send).
- Admin league email send routes continue to work without requiring a new force flag for this gate.
- Test leagues: no behavior change (cron already excludes them; admin rehearsal sends stay allowed).

**Ask First:**
- Changing the meaning of admin `?force=true` beyond today’s ALREADY_SENT resend bypass.
- Blocking or disabling admin send UI during off-season.
- Changing picks UI week resolution or preview banner rules.

**Never:**
- Hard-coding calendar dates (e.g. “no emails before Sept 9”) independent of schedule/kickoff data.
- Putting an unconditional `NoActiveWeekError` inside `get*Data` that breaks tuesday-preview / tuesday-config / admin status.
- Suppressing invite, password-reset, or other non-weekly emails.
- Changing Vercel cron schedules / Eastern windows as the sole fix.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Cron, prod, off-season | Season initialized; Week 1 games exist; `now` before first competition kickoff | Cron skips league (no Resend calls); no `*SentAt` write | Log skip; count as skipped (e.g. `skippedNoWeek` or `skippedPreview`) |
| Cron, prod, in-season | `now` on/after first competition kickoff for resolved week | Existing send + idempotency behavior | Unchanged |
| Admin send, prod, off-season | Admin clicks Send (Tue/Wed/Thu) | Emails still send (override) | Unchanged error codes |
| Cron, already-sent stamp | Prior mistaken off-season send left `*SentAt` | Out of scope for auto-heal; do not invent wipe | Ops/manual if needed |
| Test league admin | Rehearsal week via `simulatedCurrentWeek` | Unchanged send path | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/nfl/resolve-picks-week.ts` -- `computePicksUiIsPreview` / `resolveActiveWeekNumber` (reuse; do not redefine season calendar)
- `src/lib/email/get-tuesday-digest-data.ts` -- Tuesday week + members; expose preview flag for cron
- `src/lib/email/get-reminder-data.ts` -- Wed/Thu data; same preview flag
- `src/app/api/cron/tuesday-email/route.ts` -- skip when preview
- `src/app/api/cron/wednesday-reminder/route.ts` -- skip when preview
- `src/app/api/cron/thursday-reminder/route.ts` -- skip when preview
- `src/app/api/leagues/[leagueId]/email/tuesday-send/route.ts` -- leave sendable (override)
- `src/app/api/leagues/[leagueId]/email/wednesday-reminder/route.ts` -- leave sendable
- `src/app/api/leagues/[leagueId]/email/thursday-reminder/route.ts` -- leave sendable
- `src/lib/nfl/resolve-picks-week.test.ts` -- existing preview cases to lean on
- `src/lib/email/get-reminder-data.test.ts` / `get-tuesday-digest-data.test.ts` -- extend for preview flag

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/email/is-automated-email-week-active.ts` (+ colocated test) -- pure helper: production league is sendable by cron iff not `computePicksUiIsPreview(...)`; test leagues always “active” for this helper -- single reusable gate
- [x] `src/lib/email/get-tuesday-digest-data.ts` + `get-reminder-data.ts` -- compute and return `isPreviewWeek` (or equivalent) from season + games + resolved week + `now` without throwing -- cron can skip; admin/config keep working
- [x] `src/app/api/cron/{tuesday-email,wednesday-reminder,thursday-reminder}/route.ts` -- after successful data load, if preview for production league, skip send and do not touch sent timestamps; log clearly
- [x] `src/lib/email/get-*-data.test.ts` (+ helper test) -- cover August-before-Week-1-kickoff vs after first kickoff per I/O matrix

**Acceptance Criteria:**
- Given a production league with initialized season and future Week 1 kickoffs, when Tuesday/Wed/Thu cron runs before the first competition kickoff, then no digest/reminder emails are sent and no `*SentAt` fields are written.
- Given the same league after the first competition-window kickoff (or once preview is false), when cron runs in its Eastern window, then existing send behavior applies.
- Given a production league still in preview, when an admin uses the Send Tuesday / Wednesday / Thursday controls, then emails still send (admin override).
- Given a test league, when admin rehearsal email flows run, then behavior is unchanged.
- Given cron skips for preview, when the real season later becomes active, then the first eligible cron can still send (idempotency stamps were not burned in off-season).

## Spec Change Log

## Design Notes

Do **not** gate inside `get*Data` via `NoActiveWeekError` — preview/config/status need the resolved Week 1 for compose UX. Prefer a boolean + cron skip.

`computePicksUiIsPreview` already encodes “before earliest kickoff with `weekNumber >= firstCompetitionWeek`” for production; reuse it so email and picks UI share one definition of off-season.

Admin `?force=true` stays ALREADY_SENT-only; off-season override is simply “admin routes do not check this gate.”

## Verification

**Commands:**
- `npm test` -- expected: all tests pass, including new helper / data-layer cases for off-season skip eligibility

**Manual checks (if no CLI):**
- With a real league + schedule loaded and `now` before Week 1 kickoff, invoke cron handlers (or inspect logs): skip, no Resend; admin Send still delivers.

## Suggested Review Order

**Gate definition**

- Shared cron eligibility: production uses picks-UI preview; test leagues always active
  [`is-automated-email-week-active.ts:10`](../../src/lib/email/is-automated-email-week-active.ts#L10)

- Preview flag on digest payload without throwing (admin/config stay usable)
  [`get-tuesday-digest-data.ts:115`](../../src/lib/email/get-tuesday-digest-data.ts#L115)

- Same flag on Wed/Thu reminder payload
  [`get-reminder-data.ts:106`](../../src/lib/email/get-reminder-data.ts#L106)

**Cron skip (no *SentAt burn)**

- Tuesday digest skips preview weeks and reports `skippedPreview`
  [`tuesday-email/route.ts:95`](../../src/app/api/cron/tuesday-email/route.ts#L95)

- Wednesday reminder same skip pattern
  [`wednesday-reminder/route.ts:95`](../../src/app/api/cron/wednesday-reminder/route.ts#L95)

- Thursday reminder same skip pattern
  [`thursday-reminder/route.ts:95`](../../src/app/api/cron/thursday-reminder/route.ts#L95)

**Tests**

- Helper off-season / in-season / test-league cases
  [`is-automated-email-week-active.test.ts:14`](../../src/lib/email/is-automated-email-week-active.test.ts#L14)

- Data-layer `isPreviewWeek` before/after Week 1 kickoff
  [`get-reminder-data.test.ts:139`](../../src/lib/email/get-reminder-data.test.ts#L139)
