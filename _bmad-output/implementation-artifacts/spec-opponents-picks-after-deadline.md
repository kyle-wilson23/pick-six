---
title: 'Opponents'' picks tab after pick deadline'
type: 'feature'
created: '2026-08-03'
status: 'done'
baseline_commit: 'f87d1fa7fd535773a7dad041c44d863e5641b5b9'
context:
  - '{project-root}/docs/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** After a week’s pick deadline, participants still cannot see who picked what on the picks page; peer transparency only appears later on Results (Tuesday finalize).

**Approach:** On the league picks page, after that week’s pick deadline passes, show My Pick / Opponents' Picks tabs under the title. My Pick keeps today’s content; Opponents' Picks shows a name + pick (logo + abbr) table for all members including self.

## Boundaries & Constraints

**Always:**
- Tab visibility is gated by the **viewed week’s** server-authoritative pick deadline (`pickDeadlineUtc` / `now > deadline`), not wall-clock “Thursday” alone and not Tuesday finalize
- Default tab is always **My Pick** (same content as today: matchups, countdown, jailed callout, pick UX)
- Tabs are **hidden** until that week’s deadline has passed; after unlock, labels are **My Pick** and **Opponents' Picks**
- Opponents table: all participant memberships for the league; **include the viewer**; A–Z by `userDisplayName` (full `name` → email); pick cell = `TeamLogo` + team abbreviation, or `--` when no pick
- Peer pick rows must be omitted from RSC/API props until the server proves the deadline has passed (client-only hide is not enough)
- Scope unlock to this picks-page tab only — do **not** change Results, `getLeaguePeerPickHistory`, admin APIs, or FR48 Tuesday reveal elsewhere

**Ask First:**
- Changing Results / peer-history reveal from Tuesday finalize to post-deadline
- Adding a dedicated public GET for peer picks (beyond what the picks page needs)

**Never:**
- Ship other members’ picks in `PicksWeekViewPayload` or page props while the week’s pick window is still open
- Reuse `getLeaguePeerPickHistory` without changing its gate (wrong reveal rule)
- Change deadline computation, pick POST enforcement, or jailed/already-picked rules
- Rewrite planning docs / README / rules page copy for this feature

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Pre-deadline current week | `now ≤ pickDeadlineUtc` | No tabs; page looks as today (My Pick content only) | N/A |
| Post-deadline current week | `now > pickDeadlineUtc` | Tabs visible; default My Pick; Opponents table populated | N/A |
| Past week via `?weekNumber=` | That week’s deadline passed | Tabs visible for that week; Opponents shows that week’s picks | N/A |
| Future / unopened week | Deadline null or still open | No tabs; no peer pick data in props | N/A |
| Preview mode | `isPreview === true` | No tabs; no peer picks | N/A |
| Member with no pick | Membership exists, no `Pick` for week | Row present; pick cell `--` | N/A |
| Name unset | `user.name` empty | Name column uses email | N/A |

</frozen-after-approval>

## Code Map

- `src/app/(app)/leagues/[leagueId]/picks/page.tsx` -- RSC entry; wire deadline-gated peer data + tab shell
- `src/lib/picks/build-league-picks-week-view.ts` -- existing own-pick week payload (`pickDeadlineUtc`, `isPreview`); keep peer-free
- `src/lib/picks/picks-week-view-types.ts` -- `PicksWeekViewPayload` shape
- `src/lib/domain/pick-deadline.ts` -- `computePickDeadlineUtc` / closed-window helpers
- `src/lib/picks/countdown.ts` -- `isPickWindowClosedByDeadline` (client UX lock; mirror for tab show)
- `src/lib/user-display-name.ts` -- `userDisplayName`
- `src/components/picks/TeamLogo.tsx` -- logo + abbr cell pattern
- `src/components/results/LeagueResultsTable.tsx` -- table + TeamLogo row reference (do not change reveal rules)
- `src/lib/scoring/get-league-peer-pick-history.ts` -- Tuesday-finalize peer history; **do not reuse gate**
- `src/lib/admin/build-submission-status.ts` -- admin-only row shape inspiration only
- `src/components/league/LeagueNavShell.tsx` -- existing MUI `Tabs` usage (route nav)

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/picks/get-league-week-peer-picks.ts` (+ colocated `*.test.ts`) -- add deadline-gated loader: all participant memberships for the league/season week; `userDisplayName`; team abbr/name when pick exists; sort A–Z; return `null`/empty (no rows) when preview, missing deadline, or `now ≤ deadline` -- server authority for NFR17 on this surface
- [x] `src/components/picks/PicksPageTabs.tsx` (or equivalent client wrapper) -- under page title: hide tabs pre-deadline; post-deadline show My Pick / Opponents' Picks with default My Pick; My Pick children = existing chrome; Opponents = table Name | Pick (logo+abbr or `--`)
- [x] `src/app/(app)/leagues/[leagueId]/picks/page.tsx` -- after building week view, load peer picks only when window closed; pass serializable props into tab wrapper; keep page as RSC
- [x] Unit-test I/O matrix edges in the new loader test (pre/post deadline, no pick → `--` data, sort, name fallback)

**Acceptance Criteria:**
- Given an open pick window for the viewed week, when a member opens Picks, then no My Pick / Opponents' Picks tabs render and no peer pick payloads are present in the response.
- Given the viewed week’s deadline has passed, when a member opens Picks, then both tabs appear under the title, My Pick is selected by default, and My Pick content matches pre-feature behavior.
- Given Opponents' Picks is selected post-deadline, when the table renders, then every participant (including the viewer) appears A–Z by display name with logo+abbreviation or `--`.
- Given Results / peer-history surfaces, when this ships, then Tuesday-finalize visibility rules remain unchanged.

## Spec Change Log

## Design Notes

- Prefer a **separate** peer-picks loader over extending `PicksWeekViewPayload` so open-window GET/page paths cannot accidentally serialize peers.
- Tab chrome is client (MUI Tabs); keep data fetching on the server. Optional client tick may reveal tabs at `pickDeadlineUtc` without a reload, but peer **rows** must already be server-gated (or refetch after unlock)—never embed secret rows early.
- Pick column: follow Results’ `Stack` + `TeamLogo size="sm"` + abbreviation; omit outcome/points columns.

## Verification

**Commands:**
- `npm test` -- expected: new peer-picks tests + existing suite pass
- `npx tsc --noEmit` -- expected: clean (or project’s usual typecheck)

**Manual checks:**
- Pre-deadline: Picks page unchanged (no tabs).
- Post-deadline (or past `?weekNumber=`): tabs appear; Opponents table correct; My Pick still works.

## Suggested Review Order

**Server gate**

- Entry: load peer rows only after the viewed week’s deadline unlocks.
  [`page.tsx:94`](../../src/app/(app)/leagues/[leagueId]/picks/page.tsx#L94)

- Separate loader returns `null` before unlock — never peer props early.
  [`get-league-week-peer-picks.ts:70`](../../src/lib/picks/get-league-week-peer-picks.ts#L70)

- Unlock predicate: preview / null deadline / `now ≤ deadline` stay locked.
  [`get-league-week-peer-picks.ts:57`](../../src/lib/picks/get-league-week-peer-picks.ts#L57)

**Opponents table data**

- Merge all members (incl. viewer), A–Z display name, null team → `--`.
  [`get-league-week-peer-picks.ts:26`](../../src/lib/picks/get-league-week-peer-picks.ts#L26)

**UI**

- Hide tabs when `opponentsRows` is null; default My Pick after unlock.
  [`PicksPageTabs.tsx:19`](../../src/components/picks/PicksPageTabs.tsx#L19)

- Name | Pick columns with logo+abbr or `--`.
  [`OpponentsPicksTable.tsx:37`](../../src/components/picks/OpponentsPicksTable.tsx#L37)

**Tests**

- Pre/post deadline, sort, email fallback, no-query-when-locked.
  [`get-league-week-peer-picks.test.ts:13`](../../src/lib/picks/get-league-week-peer-picks.test.ts#L13)
