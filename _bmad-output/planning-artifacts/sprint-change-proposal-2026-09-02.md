# Sprint Change Proposal — Week 1 pick window never opens

- **Date:** 2026-09-02 (**Rev 2** — deadline rule simplified to pure kickoff anchor; reminder cadence unified across all weeks)
- **Author:** Kyle (with dev agent)
- **Trigger type:** Misunderstanding of original requirements (undefined boundary), surfaced in production
- **Change scope classification:** **Moderate** — no epic restructuring, but amends PRD requirement text, three stories, user-facing rules copy, and shipped code across picks + email + cron
- **Status:** Approved 2026-09-02
- **Urgency:** Blocking. Real users hold invites; NFL Week 1 opens **Wed 2026-09-09 20:15 ET**.

---

## 1. Issue Summary

### Problem statement

Production participants can see Week 1 matchups but **cannot ever submit a Week 1 pick**. Two independent defects combine so that the pick window opens *after* it has already closed:

1. The picks UI stays in **preview** (non-interactive) until the first competition-window game **kicks off**.
2. The Week 1 **deadline** computes to **Thu 2026-09-03 20:10 ET** — six days before the first game — because the 2026 Week 1 opener falls on a **Wednesday**.

Net effect for every production league: Week 1 is silently forfeited, and the first pickable week is **Week 2** (deadline Thu 2026-09-17 20:10 ET), only reachable after the last Week 1 game kicks off on Mon 2026-09-14 20:15 ET.

Two further defects follow from the same roots:

3. `isAutomatedEmailWeekActive` delegates to `computePicksUiIsPreview`, so **all** Week 1 automated emails (Tuesday digest, Wednesday and Thursday reminders) are also suppressed.
4. **The same six-day lockout recurs in Week 12** (Thanksgiving week opens Wed 2026-11-25), and **Week 18** locks 2.7 days early because it has no Thursday game at all.

### How it was discovered

Kyle asked when the competition window would open while rolling out invites to the first real production league. Tracing the gates revealed the answer, as coded, is "never, for Week 1." Kyle then questioned whether tying deadlines to Thursday was correct at all, which surfaced defects 4 above.

### Evidence — pick window replay

Replayed the live production schedule (2026, 272 games, weeks 1–18) through the shipped pure helpers:

| Probe instant (ET) | Resolved week | `isPreview` | Computed deadline | Can pick? |
|---|---|---|---|---|
| Wed Sep 2, 22:00 | 1 | true | Thu Sep 3, 20:10 | **no** |
| Thu Sep 3, 20:09 | 1 | true | Thu Sep 3, 20:10 | **no** |
| Thu Sep 3, 20:11 | 1 | true | Thu Sep 3, 20:10 | **no** (deadline passed) |
| Wed Sep 9, 20:14 | 1 | true | Thu Sep 3, 20:10 | **no** |
| Wed Sep 9, 20:16 | 1 | **false** | Thu Sep 3, 20:10 | **no** (deadline long passed) |
| Mon Sep 14, 22:00 | 2 | false | Thu Sep 17, 20:10 | yes |

Week 1 slate boundaries: `NE@SEA` **Wed 2026-09-09 20:15 ET** (first), `DEN@KC` Mon 2026-09-14 20:15 ET (last).

All four non-test production leagues have `firstCompetitionWeek = 1`, so all are affected.

### Evidence — deadline rule across all 18 weeks

Comparing the current rule against a pure kickoff anchor. **Only 3 of 18 weeks differ, and all three are currently wrong:**

| Week | First kickoff (ET) | Current rule | `firstKickoff − 5 min` | Delta |
|---|---|---|---|---|
| 1 | Wed Sep 9, 20:15 | **Thu Sep 3, 20:10** | Wed Sep 9, 20:10 | +144 h |
| 12 | Wed Nov 25, 20:00 | **Thu Nov 19, 20:10** | Wed Nov 25, 19:55 | +143.75 h |
| 18 | Sun Jan 10, 13:00 | Thu Jan 7, 20:10 | Sun Jan 10, 12:55 | +64.75 h |
| 2–11, 13–17 (15 weeks) | Thu, 20:15 | Thu, 20:10 | Thu, 20:10 | **identical** |

Every delta is **positive** — the new rule never locks earlier, only later, which is the direction NFR24 protects.

### Root cause 1 — preview gate opens at kickoff, not at window open

`src/lib/nfl/resolve-picks-week.ts` → `computePicksUiIsPreview` returns `true` while `now` is before the earliest kickoff at or after `firstCompetitionWeek`, and `WeekMatchupList` derives `interactive = !isPreview`. Because the deadline is *always* before kickoff, the window can never be open. Even with a conventional Thursday opener (kickoff 20:20, deadline 20:10) the UI would unlock **10 minutes after** the deadline.

This is not an implementation slip — it is codified in `resolve-picks-week.test.ts` ("false when in-window after earliest competition kickoff"). The requirement never defined *when* picks open, only that a pre-season preview state must exist (PRD "Pre-season Week 1 preview" theme; Epic 3 Story 3.6). The implementer chose kickoff as the boundary and nothing contradicted it.

### Root cause 2 — the Thursday anchor itself

`src/lib/domain/pick-deadline.ts` → `lockByThursdayDefaultUtc` walks back to the Thursday **on or before** the first kickoff, then `computePickDeadlineUtc` takes the earlier of that and `firstKickoff − 5 min`. Two distinct failures result:

- **Tuesday/Wednesday openers** (Weeks 1 and 12) walk the anchor back into the *previous* game week, producing a six-day early lockout.
- **Weeks with no Thursday game** (Week 18) anchor to a Thursday that has no competitive meaning, locking 2.7 days before any ball is snapped.

The deadline exists for exactly one reason: **no pick may be submitted once any game of that week has started.** `firstKickoff − 5 min` expresses that directly. The Thursday clause was a proxy for "before Thursday Night Football" that only holds when TNF is the week's first game — true in 15 of 18 weeks, and silently wrong in the other three. **NFR24** ("zero false positives — no early lockouts") is violated in all three.

---

## 2. Impact Analysis

### Epic impact

No epic is invalidated and no epic needs adding. All epics are `done`; this is post-launch remediation against shipped stories.

| Epic | Impact |
|---|---|
| Epic 3 — picks & deadline | **Story 3.5** (deadline enforcement) and **Story 3.6** (picks UI preview) both need corrected acceptance criteria. Root cause of both defects. |
| Epic 6 — email & orchestration | **Story 6.3** (Wed/Thu reminders) and **Story 6.5** (cron orchestration) need deadline-anchored scheduling. Current cadence is hardcoded to ET weekdays and breaks outright on Weeks 12 and 18. |
| Epic 2 — league setup, rules page | Rules page copy (**FR7**) states a Thursday lock time that will no longer be true. Season-readiness gate (`preSeasonInitializedAt`, Story 2.3) is **retained unchanged**. |
| Epic 4 — admin overrides | No change. Admin submit-on-behalf bypasses both gates and remains the emergency valve. |
| Epics 1, 5, 7, 8, 9 | No impact. |

### Story impact

- `3-5-deadline-enforcement-server-authority` — AC amended, behavior change in 3 of 18 weeks
- `3-6-picks-ui-matchups-odds-spread-weather-optional` — AC amended, preview boundary redefined
- `6-3-wednesday-and-thursday-reminders` — AC amended, cadence becomes deadline-anchored for all weeks
- `6-5-cron-routes-secrets-and-idempotent-weekly-orchestration` — cron gating moves into a pure helper; tick schedule changes
- `2-5-participant-league-home-roster-and-rules-page` — user-facing deadline copy

### Artifact conflicts

| Artifact | Conflict | Action |
|---|---|---|
| `prd.md` | **FR26** mandates the Thursday clause that is being removed, and no FR defines when the window **opens** — only FR21/FR27 describe closing. | Rewrite FR26; add FR26a. |
| `epics.md` | Story 3.5 AC covers only "past deadline"; 3.6 AC says "before deadline" without defining the open instant; 6.3 AC assumes fixed Wed/Thu jobs. | Amend Story 3.5 / 3.6 / 6.3 ACs. |
| `architecture.md` | "Time and timezones" note covers only "5 minutes before first kick" with no window-open instant. Vercel Hobby cron figures were stale. | Add pick-window rules; refresh Hobby figures. |
| `ux-design-specification.md` | Preview banner copy remains accurate under the new rule. | No change. |
| `sprint-status.yaml` | All items `done`; no tracking entry for this remediation. | Add `pre-week-1-*` blocking items. |
| `docs/project-context.md` | Non-negotiable "server-authoritative deadlines and rules" still holds. | No change. |

### Technical impact

Code surfaces requiring change:

- `src/lib/domain/pick-deadline.ts` — **delete** `lockByThursdayDefaultUtc`, `THURSDAY_LOCK_HOUR`, `THURSDAY_LOCK_MINUTE`; `computePickDeadlineUtc` collapses to `firstKickoff − 5 min`
- `src/lib/domain/pick-deadline.test.ts` — four Thursday-specific cases become obsolete and must be replaced with kickoff-anchored cases
- `src/lib/league/league-rules.ts` — doc-comment table still describes the Thursday rule
- `src/app/(app)/leagues/[leagueId]/rules/page.tsx` — participant-facing lock copy
- `src/lib/nfl/resolve-picks-week.ts` — new window-open computation; `computePicksUiIsPreview` becomes per-week
- `src/lib/email/is-automated-email-week-active.ts` — inherits the corrected preview definition automatically
- `src/lib/cron/*`, reminder routes, `vercel.json` — deadline-anchored slots on a two-tick daily schedule
- Colocated tests for all of the above (per `.cursor/rules/post-change-testing.mdc`)

**No database migration required.** `LeagueWeekEmailConfig` already carries `sentAt`, `wednesdayReminderSentAt`, and `thursdayReminderSentAt`; the two reminder columns are reinterpreted as "slot 1 / slot 2" rather than literal weekdays. Rules A and B are pure-function changes with no persisted state at all.

Because the reinterpretation is semantic rather than structural, **existing rows carry their old meaning forward** — any Week 1 timestamp written during rehearsal will suppress the corresponding real send. This is a one-time data-hygiene task, not a migration; see Production pre-flight.

**Deployment constraint (confirmed 2026-09-02):** the project is on **Vercel Hobby** — **100 cron jobs per project** (the per-team cap of 2 was lifted Jan 2026, so job count is not a constraint), **once-per-day minimum interval** with sub-daily expressions **failing at deploy time**, **±59 minute** precision, **UTC-only** expressions. Multiple *distinct* daily jobs are legal, which is what Rule C exploits.

---

## 3. Recommended Approach

**Selected path: Option 1 — Direct Adjustment** (amend requirements and fix forward).

Rollback (Option 2) is not viable: the affected stories are all `done` and shipped, and reverting would remove the pre-season preview the PRD requires. MVP review (Option 3) is unnecessary: scope is unchanged, only undefined and mis-specified boundaries are being corrected.

- **Effort:** Medium (three pure-rule changes plus cron restructuring and tests; no schema, no UI redesign)
- **Risk:** **Low** for the deadline change (15 of 18 weeks byte-identical; the 3 that move all move *later*), **Medium** for preview and reminders (shared helpers, widest blast radius)
- **Timeline:** Must ship before **Wed 2026-09-09 20:10 ET**. Ideally before **Tue 2026-09-08 07:00 ET** so the Week 1 slot-1 reminder can fire.

### Rule A — pick window open instant (new)

Picks are interactive for league week `W` only when **all** hold:

1. `season.preSeasonInitializedAt != null` — admin has marked the league ready *(retained, unchanged)*
2. Schedule games exist for the season
3. `W >= season.firstCompetitionWeek`
4. `now >= windowOpen(W)`

Where:

- **If `W == firstCompetitionWeek`:** `windowOpen = firstKickoff(W) − 7 days`
- **Otherwise:** `windowOpen = Tuesday 00:00:00 America/New_York` of the game week containing `firstKickoff(W)` (the Tuesday on or before that kickoff)

For 2026 Week 1 this yields `Wed 2026-09-09 20:15 ET − 7d` = **Wed 2026-09-02 20:15 ET**, already passed. Shipping the fix opens Week 1 immediately.

Tuesday 00:00 ET (rather than 18:00) guarantees picks are already open when the Tuesday 19:00 ET digest lands, so the email's pick link always works. Verified non-overlapping with the prior week's Monday night game in every 2026 week.

**Additional benefit:** making preview *per-week* also fixes a latent bug — today, once the first kickoff passes, `isPreview` is `false` for **every** week, so a user navigating to `?weekNumber=10` in September gets an interactive UI and a confusing `JAILED_NOT_COMPUTED` error on submit. Under Rule A, future weeks correctly render as preview.

### Rule B — deadline is first kickoff minus five minutes

```
deadline(W) = firstKickoff(W) − 5 minutes
```

The Thursday clause is **removed entirely**. `lockByThursdayDefaultUtc`, `THURSDAY_LOCK_HOUR`, and `THURSDAY_LOCK_MINUTE` are deleted, and the calendar-walking loop that caused the original defect goes with them.

Justification is in §1's 18-week table: 15 weeks are unchanged, and the 3 that change are all currently locking early — two of them by six days. The rule now states the actual product intent (no picks once any game has started) with no proxy, and it is immune to schedule shape: Wednesday openers, Saturday openers, Sunday-only weeks, and international 09:30 ET games all resolve correctly without special cases.

Invariant to assert in tests: `windowOpen(W) < deadline(W) < firstKickoff(W)` for every week of the season.

### Rule C — deadline-anchored reminders for every week

Applied **universally**, not just to the first competition week — Week 12's Wed 19:55 deadline and Week 18's Sun 12:55 deadline both fall outside the current fixed Wednesday/Thursday ET windows, so under the old cadence those weeks would send **zero** reminders.

- **Slot 1:** first tick at or after `deadline − 48h`
- **Slot 2:** first tick at or after `deadline − 12h`
- **Universal guard (all sends, including the Tuesday digest):** never send when `now > deadline`

**Tick schedule — two distinct daily crons** (both legal on Hobby, which limits interval per job, not job count):

| Cron | UTC | EDT | EST |
|---|---|---|---|
| Tick A | `0 11 * * *` | 07:00 | 06:00 |
| Tick B | `0 20 * * *` | 16:00 | 15:00 |

The `deadline − 12h` formulation is deliberately used instead of a fixed `− 6h`: it means "the first tick in the final stretch before lock" without the helper needing to know the tick schedule, and it self-adjusts to early deadlines. Resulting coverage:

| Week | Deadline (ET) | Slot 1 | Slot 2 | Margin on slot 2 |
|---|---|---|---|---|
| 1 | Wed Sep 9, 20:10 | Tue Sep 8, 07:00 | Wed Sep 9, 16:00 | ~4 h |
| Typical (e.g. 2) | Thu Sep 17, 20:10 | Wed Sep 16, 07:00 | Thu Sep 17, 16:00 | ~4 h |
| 12 | Wed Nov 25, 19:55 | Tue Nov 24, 06:00 | Wed Nov 25, 15:00 | ~5 h |
| 18 | Sun Jan 10, 12:55 | Fri Jan 8, 15:00 | Sun Jan 10, 06:00 | ~7 h |

All 18 weeks receive both reminders. ±59 min drift is absorbed everywhere (smallest margin is ~4 h).

Move all gating into a pure `shouldSendWeeklyReminder({ slot, deadline, now, alreadySentAt })` helper. Existing `wednesdayReminderSentAt` / `thursdayReminderSentAt` columns become slot 1 / slot 2 and provide idempotency across repeated daily ticks — no migration. The Tuesday digest keeps its existing weekly cron plus the new guard.

---

## 4. Detailed Change Proposals

### 4.1 PRD (`_bmad-output/planning-artifacts/prd.md`)

**FR26 — remove the Thursday anchor**

OLD:
```
- **FR26:** The system enforces pick deadline (Thursday ~8:10 PM EST or 5 minutes before first game, whichever earlier)
```

NEW:
```
- **FR26:** The system enforces a pick deadline of **5 minutes before the first scheduled kickoff of that NFL week**, computed in UTC from the real schedule. The deadline is not tied to any weekday: weeks opening Wednesday (2026 Weeks 1 and 12) or Sunday (2026 Week 18) lock relative to their own first game. No pick may be created or modified once any game of that week has started.
```

*Rationale:* the Thursday clause was a proxy for "before Thursday Night Football" that holds only when TNF is the week's first game. In 2026 it locks Weeks 1 and 12 six days early and Week 18 2.7 days early, violating NFR24.

**New FR26a — define when the window opens**

NEW (insert after FR26):
```
- **FR26a:** The system opens the pick window for a league week only when the league is marked ready for the season, schedule data exists, and the week is within the league's competition window. The open instant is Tuesday 00:00 ET of that week's game week, except the league's **first** competition week, which opens 7 days before that week's first kickoff. Before the open instant the week renders as read-only preview; the window must always open strictly before the FR26 deadline.
```

**Theme table row — "Pre-season Week 1 preview"** — updated to reference the FR26a open instant.

### 4.2 Epics (`_bmad-output/planning-artifacts/epics.md`)

**Story 3.5 — Deadline enforcement.** Replace the Thursday-based criteria with the kickoff anchor, require the `windowOpen < deadline < firstKickoff` invariant, and call out the 2026 Weeks 1/12/18 regressions explicitly.

**Story 3.6 — Picks UI.** Add the FR26a preview boundary, per-week evaluation, retention of the `preSeasonInitializedAt` gate, and an explicit prohibition on kickoff-gated opening.

**Story 6.3 — Reminders.** Replace fixed Wed/Thu windows with deadline-anchored slots at `− 48h` and `− 12h` on a two-tick daily schedule, plus the universal past-deadline guard.

*(Applied verbatim in the repository; see the amended story sections.)*

### 4.3 Architecture (`_bmad-output/planning-artifacts/architecture.md`)

**"Time and timezones"** — document the Tuesday 00:00 ET game-week anchor for window open, the kickoff-anchored deadline with no weekday dependency, and the `windowOpen < deadline < firstKickoff` invariant.

**Vercel Cron on Hobby row** — refresh to the confirmed figures (100 jobs/project, once-per-day minimum, sub-daily fails at deploy, ±59 min, UTC-only) and note that multiple distinct daily jobs are the supported way to get more than one check per day.

### 4.4 User-facing copy

**`src/app/(app)/leagues/[leagueId]/rules/page.tsx`**

OLD:
```
Picks lock 5 minutes before the first kickoff of the NFL week—typically Thursday around
8:10 PM Eastern when the week opens on Thursday night, or earlier if the first game is
sooner. Lock times are based on the real kickoff schedule.
```

NEW:
```
Picks lock 5 minutes before the first kickoff of the NFL week. Lock times are based on the
real kickoff schedule.
```

*Rationale:* the Thursday framing is no longer accurate for Weeks 1, 12, or 18, and the generic statement is now unconditionally true. The live countdown already shows each week's exact lock time, so no weekday hint is needed.

**`src/lib/league/league-rules.ts`** — update the doc-comment rules table row for Pick deadline to match.

### 4.5 Sprint status (`_bmad-output/implementation-artifacts/sprint-status.yaml`)

Add the `pre-week-1-*` blocking group covering the deadline rule, window-open rule, reminder cadence, user-facing copy, and production pre-flight.

---

## 5. Implementation Handoff

**Scope: Moderate** → Developer agent implements; Kyle owns production pre-flight.

### Sequenced action plan

1. **Rule B — kickoff-anchored deadline** (`src/lib/domain/pick-deadline.ts`)
   Delete the Thursday helper and constants. Rewrite `pick-deadline.test.ts`: remove the four Thursday cases, add Wed/Thu/Sat/Sun/London-09:30 opener cases, and assert the 15 unchanged 2026 weeks stay at 20:10.
2. **Rule A — window-open / per-week preview** (`src/lib/nfl/resolve-picks-week.ts`)
   Retain the `preSeasonInitializedAt` gate and the test-league short-circuit unchanged. Replace the "false when in-window after earliest competition kickoff" test, which encodes the bug. Re-verify `is-automated-email-week-active.test.ts`, which inherits the new definition.
3. **Rule C — reminder cadence** (`src/lib/cron/*`, reminder routes, `vercel.json`)
   Extract `shouldSendWeeklyReminder`. Replace the weekly reminder crons with ticks A and B. Confirm the deploy succeeds — Hobby rejects sub-daily expressions at deploy time.
4. **User-facing copy** — rules page and `league-rules.ts`.
5. **Full suite** — `npm test` (per `.cursor/rules/post-change-testing.mdc`), then deploy.

### Production pre-flight (Kyle, before announcing to users)

- [ ] The real league's season shows **"Marked ready for season"** (`preSeasonInitializedAt` set). Two non-test leagues are currently **null** — `Willy League 3` and `Kyle's Solo Leage`.
- [ ] **Week 1 jailed team is computed.** Without it every submit returns `400 JAILED_NOT_COMPUTED`. Confirm via the admin jailed verification view (Story 4.4).
- [ ] **Week 1 odds lines** present for all 16 games.
- [ ] Deploy carrying the new crons **succeeds** and both ticks appear in the Vercel dashboard.
- [ ] Picks page shows a countdown to **Wed Sep 9 20:10 ET**, not the preview banner.
- [ ] Rules page no longer mentions Thursday.
- [ ] **Clear stale Week 1 send timestamps.** `Willy League New` (non-test) has a 2026 Week 1 `LeagueWeekEmailConfig` with `sentAt`, `wednesdayReminderSentAt`, and `thursdayReminderSentAt` all set on 2026-07-06 from rehearsal sends. Because those columns are the idempotency keys, the real Week 1 digest and **both** reminders will be silently skipped for that league. Null all three before Tue Sep 8. No other non-test league is affected.
- [ ] **Remove the stale Week 1 pick.** `Willy League` (non-test) holds a `DAL` Week 1 pick created 2026-05-31 by `dev@example.com`. It would score as a live pick. Delete it, or confirm the league is not in real play.

### Success criteria

- A production participant can submit and change a Week 1 pick immediately after deploy.
- Week 1 deadline displays and enforces as **Wed 2026-09-09 20:10 ET**; Week 12 as **Wed 2026-11-25 19:55 ET**; Week 18 as **Sun 2027-01-10 12:55 ET**.
- The 15 Thursday-opener weeks compute byte-identical deadlines to pre-change behavior.
- Every week of the season receives both reminder slots, and no send ever occurs after a deadline.
- `npm test` green.

### Residual risks

- **Week 1 is compressed.** Participants get roughly 6.5 days, and the slot-1 reminder only fires if the fix ships before Tue Sep 8 07:00 ET. Admin submit-on-behalf (FR29/FR30) remains the fallback.
- **Email activation changes retroactively.** Correcting preview makes the Tuesday Sep 8 digest live for all production leagues. Confirm Week 1 digest rendering before Tue 19:00 ET.
- **Later deadlines widen the live-odds window.** Weeks 12 and 18 now accept picks 2.7–6 days longer than before. Odds remain frozen at the Tuesday snapshot for jailed-team purposes, so scoring integrity is unaffected, but participants have more real-world information before locking. This is the intended trade.
- **Hobby cron precision.** ±59 min drift is absorbed by ≥4 h of margin on every slot. A hypothetical week whose first game kicks before ~07:00 ET would leave slot 2 no tick; the guard would correctly suppress it and that week would get slot 1 only. No such week exists in 2026.
