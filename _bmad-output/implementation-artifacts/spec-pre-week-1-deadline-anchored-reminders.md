---
title: 'Rule C — deadline-anchored reminders on a two-tick daily cron'
type: 'bugfix'
created: '2026-09-03'
status: 'done'
baseline_commit: '721e9e7'
context:
  - '{project-root}/_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-02.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Reminder cron jobs fire on fixed Eastern weekdays (Wed 19:00–24:00, Thu 17:00–21:00). Now that the deadline is `firstKickoff − 5 min` (pass 1, commit `721e9e7`), 2026 Weeks 12 and 18 would receive **zero** reminders, and Week 1's "deadline in 1 hour" email would land six days early. Deployed as-is, pass 1 makes this worse, not better.

**Approach:** Anchor both reminders to the computed deadline — slot 1 at the first tick ≥ `deadline − 48h`, slot 2 at the first tick ≥ `deadline − 12h` — and run a single shared per-league loop from two daily cron ticks (11:00 and 20:00 UTC) instead of one route per weekday. Never send anything, including the Tuesday digest, once `now > deadline`.

## Boundaries & Constraints

**Always:**
- Slot gating lives in one pure helper, `shouldSendWeeklyReminder({ slot, deadline, now, alreadySentAt })`. Routes contain no time arithmetic.
- Both ticks can send **either** slot — Week 18's slot 2 lands on the morning tick, a typical week's on the afternoon tick.
- Reuse `wednesdayReminderSentAt` as slot 1 and `thursdayReminderSentAt` as slot 2. Comment-only schema change; idempotency is now load-bearing because ticks are daily.
- Preserve the shared circuit breaker, `getActiveLeagueIds`, the `isPreviewWeek` skip, `maxDuration = 300`, and `logEvent` structured logging with per-league skip reasons.
- Reminder copy must be deadline-relative, never weekday-relative.

**Ask First:**
- Any Prisma migration or column rename.
- Changing admin manual-send URL paths (`/api/leagues/[leagueId]/email/{wednesday,thursday}-reminder`) or their response shapes.
- Any edit to `pick-deadline.ts` or `resolve-picks-week.ts` (pass 1 surface — out of bounds).

**Never:**
- Do not gate the **admin manual** send routes on the deadline; submit-on-behalf is the post-deadline emergency valve.
- Do not keep `isInEasternWindow` in the reminder path — it would suppress most daily ticks. It stays for `tuesday-email` and the two sync routes.
- Do not send more than one reminder per league per tick.
- Out of scope: `src/lib/admin/get-weekly-email-status.ts` still infers reminder status from fixed Wed/Thu windows. Cosmetic admin card only; log it in `deferred-work.md`.

## I/O & Edge-Case Matrix

`shouldSendWeeklyReminder` — deadline Wed 2026-09-09 20:10 ET (Week 1):

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Slot 1 due | slot 1, now Tue 07:00 ET, `alreadySentAt` null | `{ send: true }` | N/A |
| Slot 1 too early | slot 1, now Mon 16:00 ET (before `deadline − 48h`) | `{ send: false, reason: "not_due" }` | N/A |
| Repeat tick | slot 1, now Tue 16:00 ET, `alreadySentAt` set | `{ send: false, reason: "already_sent" }` | N/A |
| Slot 2 due | slot 2, now Wed 16:00 ET (≥ `deadline − 12h`) | `{ send: true }` | N/A |
| Past deadline | any slot, now Wed 20:11 ET | `{ send: false, reason: "past_deadline" }` | N/A |
| Exactly at deadline | any slot, now == deadline | `{ send: true }` — strict `>` only | N/A |
| No schedule data | `deadline` null | `{ send: false, reason: "missing_deadline" }` | Never throws |

</frozen-after-approval>

## Code Map

- `src/app/api/cron/{wednesday,thursday}-reminder/route.ts` -- near-identical copies; **delete**, replaced by two thin tick routes
- `src/app/api/cron/tuesday-email/route.ts` -- keeps its Tue ET window gate; gains the past-deadline guard
- `src/lib/cron/eastern-window.ts` -- keep; still used by tuesday-email, sync routes, admin status
- `src/lib/cron/get-active-league-ids.ts` -- unchanged (already excludes test leagues)
- `src/lib/email/get-reminder-data.ts` / `get-tuesday-digest-data.ts` -- resolve the week + `isPreviewWeek`; must also expose the week's deadline
- `src/lib/email/send-reminder.ts` -- `reminderType: "wednesday" | "thursday"` drives subject, body, idempotency key and column choice
- `src/lib/email/templates/ReminderEmail.tsx` -- body says "before Thursday's deadline" / "in about one hour" (slot 2 now fires 4–7h out)
- `src/lib/domain/pick-deadline.ts` -- `getFirstKickoffUtc` + `computePickDeadlineUtc`; **read-only, do not edit**
- `src/components/picks/DeadlineCountdown.tsx` -- ET display convention: `formatInTimeZone(d, LEAGUE_BUSINESS_TIMEZONE, "EEE h:mm a 'ET'")`
- `src/lib/nfl/resolve-picks-week.test.ts:106` -- `SEASON_2026_OPENERS` (18 real weeks) + `easternLocal`; extract for reuse
- `src/app/api/cron/sync-nfl-results/route.test.ts` -- cron route test recipe (`vi.stubEnv("CRON_SECRET", …)`, real `assertCronRequest`)

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/cron/should-send-weekly-reminder.ts` -- new pure helper + exported `REMINDER_SLOT_LEAD_HOURS = { 1: 48, 2: 12 }` and `isPastPickDeadline(deadline, now)` -- single source of slot truth
- [x] `src/lib/cron/should-send-weekly-reminder.test.ts` -- cover every I/O Matrix row -- boundary conditions are the whole feature
- [x] `src/test/season-2026-openers.ts` -- move `SEASON_2026_OPENERS` + `easternLocal` here; update the import in `resolve-picks-week.test.ts` -- shared 18-week table, no duplication
- [x] `src/lib/cron/should-send-weekly-reminder.test.ts` -- add an 18-week sweep: replay every 11:00/20:00 UTC tick across each week and assert exactly one slot-1 and one slot-2 firing, at Week 1 Tue Sep 8 07:00 + Wed 16:00 ET, Week 12 Tue Nov 24 06:00 + Wed 15:00 ET, Week 18 Fri Jan 8 15:00 + Sun Jan 10 06:00 ET
- [x] `src/lib/email/get-reminder-data.ts`, `get-tuesday-digest-data.ts` -- add `pickDeadlineUtc: Date | null` (first kickoff of the resolved week − 5 min, `null` when that week has no games) -- callers must not re-query the schedule
- [x] `src/lib/email/send-reminder.ts` -- swap `reminderType` for `slot: 1 | 2`; map slot 1→`wednesdayReminderSentAt`, slot 2→`thursdayReminderSentAt`; deadline-relative subjects; keep idempotency keys stable per slot
- [x] `src/lib/email/templates/ReminderEmail.tsx` -- take `slot` + optional `pickDeadlineUtc`; render the real lock time via `formatInTimeZone` instead of "Thursday's deadline" / "in about one hour"
- [x] `src/lib/cron/run-reminder-tick.ts` -- new shared loop: active leagues → circuit breaker → `getReminderData` → preview skip → slot 1 then slot 2, stopping after the first slot that records a send -- de-duplicates the two old routes
- [x] `src/app/api/cron/reminder-tick-am/route.ts`, `reminder-tick-pm/route.ts` -- thin wrappers (auth → `runReminderTick` → JSON + `cronJobHttpStatus`); delete both weekday reminder routes -- names must not imply a weekday
- [x] `vercel.json` -- replace the two weekday reminder crons with `reminder-tick-am` `0 11 * * *` and `reminder-tick-pm` `0 20 * * *`; leave the other three untouched
- [x] `src/app/api/cron/tuesday-email/route.ts` -- skip + log a league when `isPastPickDeadline(data.pickDeadlineUtc, now)` -- universal guard
- [x] `src/app/api/leagues/[leagueId]/email/{wednesday,thursday}-reminder/route.ts`, `src/components/admin/AdminReminderControls.tsx` -- pass slots; relabel buttons "Send First Reminder" / "Send Final Reminder"; URLs and payloads unchanged
- [x] `prisma/schema.prisma` -- reword the two field doc comments to slot 1 / slot 2 -- comment-only, no migration
- [x] `src/lib/cron/run-reminder-tick.test.ts`, `src/app/api/cron/reminder-tick-am/route.test.ts` -- orchestration + auth coverage; update `send-reminder.test.ts`, `email-templates.test.tsx`, `get-reminder-data.test.ts`, `get-tuesday-digest-data.test.ts`
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- log the `get-weekly-email-status.ts` weekday-window carryover

**Acceptance Criteria:**
- Given the deployed tick schedule, when any 2026 week is replayed, then that week receives exactly two reminders and neither is sent after its deadline.
- Given a tick where slot 1 was never stamped but slot 2 is due, when the loop runs, then exactly one email goes out and the remaining slot fires no earlier than the next tick.
- Given a league whose week is still in preview, when either tick runs, then it is skipped with `CRON_PREVIEW_WEEK` and no slot is evaluated.
- Given Resend fails repeatedly mid-run, when the breaker opens, then every remaining league is skipped with `EMAIL_CIRCUIT_OPEN_CODE` and the route returns a non-200 via `cronJobHttpStatus`.
- Given `grep -ri "wednesday\|thursday" src/app/api/cron src/lib/cron src/lib/email/templates/ReminderEmail.tsx`, when run, then no weekday drives scheduling or user-visible copy.

## Spec Change Log

## Design Notes

**Why `deadline − 12h` and not a fixed hour:** it means "first tick in the final stretch" without the helper knowing the tick schedule, and self-adjusts to early deadlines. Week 18 (Sun 12:55 ET) resolves to the 06:00 tick; every other week to the afternoon tick. Smallest margin across 2026 is ~4h, absorbing Vercel Hobby's ±59 min drift.

**Slot collision:** at a slot-2 tick, slot 1 is also past its anchor. Evaluating slot 1 first and breaking only after a slot actually records a `sentAt` keeps normal weeks at one email per tick, lets a "nobody outstanding" slot fall through to the next slot, and degrades a late deploy to two emails one tick apart rather than two at once.

**Two routes, one handler:** Vercel requires unique paths per cron entry, so the same schedule cannot be listed twice for one route.

## Verification

**Commands:**
- `npm test` -- expected: full suite green, including the 18-week sweep
- `npx tsc --noEmit` -- expected: clean after the `reminderType` → `slot` rename
- `npx next build` -- expected: both tick routes compile; `vercel.json` has no sub-daily expression (Hobby rejects those at deploy time)

## Suggested Review Order

**Slot gating**

- Both ticks share one helper; routes do no time arithmetic.
  [`should-send-weekly-reminder.ts:63`](../../src/lib/cron/should-send-weekly-reminder.ts#L63)

- Slot 1 is −48h, slot 2 is −12h; past-deadline is strict `>`.
  [`should-send-weekly-reminder.ts:19`](../../src/lib/cron/should-send-weekly-reminder.ts#L19)

**Shared tick loop**

- Slot 1 then slot 2, stop after the first real send so a tick never double-fires.
  [`run-reminder-tick.ts:145`](../../src/lib/cron/run-reminder-tick.ts#L145)

- Preview weeks skip before any slot is evaluated.
  [`run-reminder-tick.ts:112`](../../src/lib/cron/run-reminder-tick.ts#L112)

- Both AM/PM routes are auth + this wrapper; no weekday window.
  [`reminder-tick-http.ts:12`](../../src/lib/cron/reminder-tick-http.ts#L12)

**Schedule and digest guard**

- Daily UTC ticks, not weekday jobs; Hobby-legal once-per-day expressions.
  [`vercel.json:16`](../../vercel.json#L16)

- Tuesday digest also refuses `now > deadline`.
  [`tuesday-email/route.ts:115`](../../src/app/api/cron/tuesday-email/route.ts#L115)

**Email copy and stamps**

- Slot 1/2 reuse the historical `wednesday`/`thursday` columns; no migration.
  [`send-reminder.ts:49`](../../src/lib/email/send-reminder.ts#L49)

- Body names the real lock instant instead of a weekday.
  [`ReminderEmail.tsx:48`](../../src/lib/email/templates/ReminderEmail.tsx#L48)

- Callers get `pickDeadlineUtc` from reminder data; they do not re-query the slate.
  [`get-reminder-data.ts:123`](../../src/lib/email/get-reminder-data.ts#L123)

**Admin (URLs unchanged)**

- Buttons relabeled; POST paths stay `{wednesday,thursday}-reminder`.
  [`AdminReminderControls.tsx:205`](../../src/components/admin/AdminReminderControls.tsx#L205)

**Tests and schema comments**

- 18-week sweep asserts both slots, including Weeks 1, 12, and 18.
  [`should-send-weekly-reminder.test.ts:215`](../../src/lib/cron/should-send-weekly-reminder.test.ts#L215)

- Comment-only slot 1 / slot 2 docs; column names stay.
  [`schema.prisma:359`](../../prisma/schema.prisma#L359)
