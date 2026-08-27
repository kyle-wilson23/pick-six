---
title: 'Hide others'' team picks from admins until pick deadline'
type: 'feature'
created: '2026-08-26'
status: 'done'
baseline_commit: '8b4345ed337130a7c32e811520d946738084c621'
context:
  - '{project-root}/docs/project-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-design-specification.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** League admins are also participants, but FR49 plus the admin dashboard, Results, CSV export, and override dialog currently expose other members’ team picks before that week’s pick deadline.

**Approach:** Until that week’s server-authoritative pick deadline passes, redact other participants’ team identity from admin read paths (submitted vs not only). After the deadline, restore today’s admin reveal. Non-admin participant experience stays unchanged.

## Boundaries & Constraints

**Always:**
- Gate on `isNflWeekPickWindowClosedByDeadline` (same formula for live and test leagues; test leagues use that league’s resolved/sim games and simulated current week)
- Enforce in **queries and SSR/API payloads**, not UI-only; omit team name, abbreviation, id, and anti-jailed flag
- Admin dashboard: keep every participant visible; submitted = check + SUBMITTED chip; pending = today’s PENDING / “No pick submitted yet”; timestamp without team is OK
- Results (admin): replace redacted pick cells with a submitted signal; after deadline, team cells match today (admin still sees picks before Tuesday finalize)
- CSV: for weeks with an open window, write `Submitted` instead of the team label when a pick exists; empty cell if none; after deadline, today’s team labels
- Override: still POST a pick for anyone; do **not** show or pre-select the existing team while the window is open; do **not** ship other members’ (or the target’s) current-week `teamId`s in `allSeasonPicks` while open
- Viewer’s own pick may stay visible on dashboard and Results; CSV redacts **all** members for open-window weeks
- Exact deadline instant (`now === deadline`) stays locked (same as Opponents tab)

**Ask First:**
- Redacting audit-log before/after team names
- Changing non-admin Results (Tuesday finalize) or Opponents tab (post-deadline) rules
- A test-league debug flag that restores pre-deadline admin team visibility

**Never:**
- Client-only hide with full pick payloads still in RSC/API JSON
- Blocking or deadline-gating `submitPickOnBehalf` / `POST .../admin/picks`
- Changing pick POST enforcement, jailed/duplicate rules, or scoring
- Converting AdminSubmissionCard list into a new data table
- Rewriting planning docs beyond the FR49 / visibility sentences listed in Tasks

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Admin dashboard, window open | Other member has a pick | SUBMITTED + check; no team / abbr / anti-jailed | N/A |
| Admin dashboard, window open | No pick | PENDING; “No pick submitted yet” | N/A |
| Admin dashboard, window closed | Submitted pick | Today’s “Picked: {Team}” detail | N/A |
| Admin Results, window open | Admin caller, unfinalized week | Pick cell = submitted signal, not team | N/A |
| Member Results, unfinalized week | Non-admin caller | Unchanged: week omitted until finalize | N/A |
| CSV, window open | Pick exists for that week | Cell `Submitted` | N/A |
| CSV, window closed | Pick exists | Today’s export team label | N/A |
| Override, window open | Target already picked | No current-team copy or chip preselect; admin can still select + save | Mutation errors unchanged |
| Test league, sim week open | Same helpers, sim games | Same redaction as live | N/A |
| Deadline indeterminate | No kickoff / no deadline | Treat as locked (do not reveal teams) | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/domain/pick-deadline.ts` -- `isNflWeekPickWindowClosedByDeadline`; reuse, do not fork a Thursday-only check
- `src/lib/admin/build-submission-status.ts` -- redact `submittedPick` team fields while open; `GET .../admin/submission-status` shares this builder
- `src/components/admin/AdminSubmissionCard.tsx` -- check + submitted copy without team when redacted; keep card layout (UX `AdminSubmissionCard`)
- `src/lib/admin/build-admin-override-data.ts` -- omit open-window week rows from `allSeasonPicks`
- `src/components/admin/AdminDashboardClient.tsx` -- do not derive `currentPick` from leaked season rows while open
- `src/components/admin/AdminPickOverrideDialog.tsx` -- hide current-pick line and preselect while open; keep team chips for choosing a new pick
- `src/lib/admin/submit-pick-on-behalf.ts` -- no deadline gate (leave as-is)
- `src/lib/scoring/get-league-peer-pick-history.ts` -- admin: include pre-finalize weeks but redact team identity until deadline; members unchanged
- `src/components/results/LeagueResultsTable.tsx` -- submitted check in Pick column when team fields absent
- `src/lib/export/build-league-export-data.ts` -- `Submitted` vs team label per week window
- `src/lib/league/league-rules.ts` -- visibility comment (FR49)
- `docs/project-context.md` -- pick-visibility non-negotiable
- `_bmad-output/planning-artifacts/prd.md` -- FR49
- `_bmad-output/planning-artifacts/architecture.md` -- admin always-on visibility bullet
- `_bmad-output/planning-artifacts/ux-design-specification.md` -- `AdminSubmissionCard` submitted detail states

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/admin/build-submission-status.ts` (+ `*.test.ts`) -- when week window open, keep submitted vs pending (and optional timestamp) but strip team/anti-jailed from payload including API
- [x] `src/components/admin/AdminSubmissionCard.tsx` -- MUI `CheckCircle` on submitted when team hidden; detail is not “Picked: {Team}”
- [x] `src/lib/admin/build-admin-override-data.ts` (+ new `*.test.ts`) -- drop `allSeasonPicks` entries for weeks whose window is still open
- [x] `src/components/admin/AdminDashboardClient.tsx` + `AdminPickOverrideDialog.tsx` -- no current-team display or chip preselect while open; Save pick still works
- [x] `src/lib/scoring/get-league-peer-pick-history.ts` (+ `*.test.ts`) -- inject `now`; admin rows for open-window weeks omit team/anti-jailed; member finalize gate unchanged
- [x] `src/components/results/LeagueResultsTable.tsx` -- if team identity missing, show submitted check (not `TeamLogo`)
- [x] `src/lib/export/build-league-export-data.ts` (+ `*.test.ts`) -- open-window week cells `Submitted` or empty
- [x] Docs listed in Code Map -- FR49 becomes: admins see **who submitted** anytime; **which team** only after that week’s pick deadline
- [x] Unit-test the I/O matrix edges (open/closed, exact deadline, test-league sim week, member Results unchanged, override mutation still post-deadline)

**Acceptance Criteria:**
- Given an open pick window, when an admin loads the dashboard, Results, or CSV, then other participants’ team identity is absent from UI **and** JSON/CSV, and submitted vs not remains visible.
- Given that week’s deadline has passed, when an admin views the same surfaces, then team picks match today’s admin behavior.
- Given override while the window is open, when the admin opens the dialog, then no existing team is shown or pre-selected, and a valid Save pick still succeeds.
- Given a non-admin, when they use Picks or Results, then deadline and Tuesday-finalize rules are unchanged.

## Spec Change Log

## Design Notes

Reuse `isNflWeekPickWindowClosedByDeadline` after `resolveGamesForLeague` for that week — live vs test differs only in which games/week resolve. If deadline cannot be computed, do not reveal teams.

Redacting cards while leaving `allSeasonPicks` on the admin page would still leak current-week `teamId`s via RSC props. Filter that array on the server.

CSV `Submitted` is the non-team stand-in; do not use a team-like abbreviation.

Prefer `Stack` for new flex layout. Check icon: `@mui/icons-material/CheckCircle` with `aria-label="Pick submitted"`.

## Verification

**Commands:**
- `npm test` -- existing + new colocated tests pass

**Manual checks (if no CLI):**
- Admin dashboard, Results, CSV, and override dialog before vs after a test-league week deadline (sim advance); confirm non-admin Picks/Results unchanged

## Suggested Review Order

**Deadline gate (shared)**

- Same helper as the Opponents tab; live vs test differs only in which games resolve
  [`build-submission-status.ts:174`](../../src/lib/admin/build-submission-status.ts#L174)

**Admin dashboard payload**

- Redacted pick is `{ updatedAt }` only; own row can still include the team
  [`submitted-pick.ts:1`](../../src/lib/admin/submitted-pick.ts#L1)

- Session user is the viewer so the admin's own card stays unredacted
  [`page.tsx:55`](../../src/app/(app)/leagues/[leagueId]/admin/page.tsx#L55)

- SUBMITTED + check when the team is hidden; no "Picked: {Team}"
  [`AdminSubmissionCard.tsx:77`](../../src/components/admin/AdminSubmissionCard.tsx#L77)

**Override leak + dialog**

- Drop open-window week `teamId`s from SSR props so DevTools cannot infer picks
  [`build-admin-override-data.ts:154`](../../src/lib/admin/build-admin-override-data.ts#L154)

- No current-team copy or chip preselect while the window is open
  [`AdminPickOverrideDialog.tsx:59`](../../src/components/admin/AdminPickOverrideDialog.tsx#L59)

**Results**

- Admin still sees unfinalized weeks; team/anti-jailed/outcome hidden until deadline
  [`get-league-peer-pick-history.ts:111`](../../src/lib/scoring/get-league-peer-pick-history.ts#L111)

- Pick column shows Submitted + check when team fields are null
  [`LeagueResultsTable.tsx:91`](../../src/components/results/LeagueResultsTable.tsx#L91)

**CSV**

- Open-window cells are the literal `Submitted`; empty if no pick
  [`build-league-export-data.ts:175`](../../src/lib/export/build-league-export-data.ts#L175)

**Docs**

- FR49: who submitted anytime; which team after that week's deadline
  [`prd.md:1098`](../planning-artifacts/prd.md#L1098)

**Tests**

- I/O matrix: open/closed window, own vs other, member Results unchanged
  [`build-submission-status.test.ts:1`](../../src/lib/admin/build-submission-status.test.ts#L1)
