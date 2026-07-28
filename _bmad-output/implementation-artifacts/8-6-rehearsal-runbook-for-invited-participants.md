# Story 8.6: Rehearsal Runbook for Invited Participants

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a league admin,
I want a **short runbook** (in-repo) covering the full rehearsal lifecycle and copy-ready participant messaging,
so that invited testers know how many weeks we're running, that the data is fake, and how to report issues — and so that I don't have to re-derive the correct admin click-order (create → invite → advance → odds → picks → results → email → delete) from memory or from reading five old story files each time we rehearse.

This is a **documentation-only** story. No application code, schema, or route changes are required — every capability the runbook documents (test league creation, simulation controls, email suppress, league delete) already shipped in Stories 8.1–8.5 and 2.8.

## Acceptance Criteria

### AC1 — New runbook document exists and covers the full rehearsal lifecycle

**Given** Epic 8 features exist (Stories 8.1–8.5) and the production league-delete feature exists (Story 2.8)
**When** an admin prepares a pre-season dry run
**Then** a new `docs/rehearsal-runbook.md` document exists covering, in order:

1. **Prerequisites** — required/optional env vars for a rehearsal (`ALLOW_TEST_LEAGUES`, `TEST_LEAGUE_EMAIL_MODE`, plus the standard email vars already documented in `docs/email-local-smoke-test-runbook.md` if sending real test emails)
2. **Creating a test league** — exact UI steps (`/leagues/new`, the "Test / rehearsal league" checkbox, "Simulation week count" field, its default and recommended range)
3. **Inviting participants** — exact UI steps (`/leagues/{id}/invites`), and the "mark league ready for season" step that starts the simulation clock
4. **Running a simulated week** — the repeatable per-week loop on `/leagues/{id}/admin`: apply odds snapshot (also computes jailed team) → participants submit picks → (optional) send Tuesday/Wednesday/Thursday emails → simulate results (finalizes + scores the week) → advance to next week
5. **Weekly email choices** — both `TEST_LEAGUE_EMAIL_MODE` policies (`send` vs `suppress`) explained in plain language, with what the admin and testers each see in each mode
6. **Deleting the test league when finished** — using the existing production delete flow (Story 2.8), plus the known limitation described in AC2 below
7. **Starting fresh for the real season** — pointer to creating a new **production** league (unchecked "Test / rehearsal league" box) rather than converting the rehearsal league, matching the documented "no test→production conversion" decision from Story 8.1

**And** every step cites the real route path, page, or component name so a reader can verify against the running app (no invented UI copy) — see Dev Notes "Reference: exact UI copy & routes" for the source-of-truth table to copy from.

---

### AC2 — Runbook explicitly documents the Story 8.7 delete gap (no silent surprises)

**Given** `deferred-work.md` already documents that today's league-delete (Story 2.8, `DELETE /api/leagues/[leagueId]`) performs a per-league cascade only, and that **global**, non-`leagueId`-scoped rehearsal rows (`NflGame` fixture rows, `OddsSnapshotRun` rows with `source: "test_fixture"`, `NflGameOddsLine`, `NflWeekJailedTeam`) are **not** cleaned up by it — cleanup of those rows is Story 8.7's job, which is still `backlog`

**When** the runbook's "deleting the test league" section is written

**Then** it must state plainly, in the delete section itself (not buried elsewhere):

- Deleting the test league via `/leagues/{id}/settings` → "Delete league" **does** remove the league, its season, memberships, invitations, and picks (everything scoped to `leagueId`)
- It does **not** remove the global fixture `NflGame`/`OddsSnapshotRun`/`NflGameOddsLine`/`NflWeekJailedTeam` rows created during rehearsal — these are harmless leftovers (no `leagueId`, invisible to any real league unless a future real week happens to collide on the same `(nflSeasonYear, weekNumber)` natural key, which is itself a documented, accepted, low-probability risk)
- Full automated cleanup of those rows is tracked as **Story 8.7** (`8-7-delete-test-league-and-data-cleanup`, currently `backlog`) — link to it by story key, do not re-describe its scope here
- If a rehearsal is run before Story 8.7 ships, note this is an accepted, documented gap — not a bug to work around in this story

---

### AC3 — Participant-facing messaging (the part of epics.md's user story this story must not skip)

**Given** `epics.md`'s Story 8.6 user story is written from the admin's perspective but is explicitly about what **invited testers** need to know ("invited testers know how many weeks we're running, that data is fake, and how to report issues")

**When** the runbook is written

**Then** it includes a distinct, clearly-labeled subsection (e.g. "What to tell your testers") containing:

1. A short, **copy-pasteable** message template an admin can send to invited testers via email/Slack/text before or alongside the invite email, stating: this is a practice/rehearsal league, it runs for **N weeks** (placeholder for the admin to fill in `simulationWeekCount`) compressed into a short window (not real calendar weeks), all data (games, scores, standings) is **fake**, and their real picks/accounts elsewhere in the app are unaffected
2. A one-line note that the in-app **"Test / rehearsal league"** banner (shown on league home/picks/standings — Story 8.1) and the **"Test"** chip in navigation reinforce this same message inside the product itself, so testers see it twice
3. A named channel or method for testers to **report issues** during the rehearsal (the admin fills in their own preferred channel — e.g. a Slack channel, email address, or shared doc; the runbook provides the placeholder/prompt, not a hardcoded destination since this project has no dedicated feedback tool)

---

### AC4 — Optional sign-off checklist for core user journeys

**Given** `epics.md`'s AC: "optional **checklist** maps core user journeys (pick, reminder, standings, admin override) for sign-off before NFL season"

**When** the runbook is written

**Then** it includes a checklist table (pass/fail/notes columns) covering at minimum these journeys, each citing the epic/story that implemented it:

| Journey | What to verify |
|---|---|
| Pick submission | Participant can view matchups (odds/spread/weather), submit a pick, see jailed-team messaging if applicable (Epic 3) |
| Reminder emails | Wednesday/Thursday reminder reaches an outstanding participant; submitted participants are excluded (Story 6.3, exercised via admin buttons in rehearsal per Story 8.5) |
| Standings / reveal | After simulated results, standings update and personal history reflects the week; peer picks stay hidden until reveal (Epic 5) |
| Admin override | Admin can submit/change a pick on behalf of a participant, including post-deadline, and it appears in the audit log (Epic 4) |
| Weekly email cycle | Tuesday digest (or suppressed equivalent) reflects the correct simulated week and content (Story 8.5 AC1) |
| Test league labeling | Banner/chip/`[TEST]` email subject all appear as expected (Story 8.1) |
| Delete cleanup | League deletes cleanly per AC2's documented scope; no unexpected errors |

**And** this section is explicitly marked **optional** per the epics.md language — a rehearsal is not blocked on filling out this table, it's a sign-off aid.

---

### AC5 — Discoverability: cross-link from existing docs, don't fork content

**Given** the project convention (established for `deferred-work.md`'s Vercel checklist) of **linking to a canonical doc** rather than duplicating operational content in multiple places

**When** the runbook ships

**Then**:

1. `README.md`'s "Docs 📚" section gains one line linking to `docs/rehearsal-runbook.md` (alongside the existing `deployment.md` / `performance-budgets.md` links)
2. `docs/deployment.md`'s existing `ALLOW_TEST_LEAGUES` / `TEST_LEAGUE_EMAIL_MODE` environment-variable line gains a trailing pointer sentence to the new runbook for the full rehearsal walkthrough (do not re-list the env var table there — link only)
3. The runbook itself links back to `docs/email-local-smoke-test-runbook.md` for readers who need full local Resend-sandbox setup details (API key, `RESEND_FROM`, sandbox recipient restrictions) rather than re-documenting those prerequisites

---

## Tasks / Subtasks

- [x] Task 1: Write `docs/rehearsal-runbook.md` (AC: #1, #2, #3, #4)
  - [x] Prerequisites section: env vars table (`ALLOW_TEST_LEAGUES`, `TEST_LEAGUE_EMAIL_MODE`) with exact default/values from `docs/deployment.md` (do not restate the full email-setup prerequisites — link to `docs/email-local-smoke-test-runbook.md` §Prerequisites instead, per AC5.3)
  - [x] "Create a test league" section — steps for `/leagues/new`, citing the "Test / rehearsal league" checkbox and helper copy, "Simulation week count" field (default 4, recommended 4–6), and the "This cannot be changed after creation" constraint
  - [x] "Invite participants" section — steps for `/leagues/{id}/invites`, then "Mark league ready for season" (starts `simulatedCurrentWeek` at `firstCompetitionWeek`)
  - [x] "Run a simulated week" section — the repeatable loop on `/leagues/{id}/admin`: **Apply odds snapshot** (also computes jailed team) → participants pick → optional email sends → **Simulate results** → **Advance to Week N** — with exact button labels from `AdminSimulationControls.tsx` (see Dev Notes reference table)
  - [x] "Weekly email choices" section — explain `send` vs `suppress` in plain language: what Resend does (or doesn't) in each mode, what the admin sees (`Alert severity="info"` copy on suppress), and that production cron never touches rehearsal leagues regardless of this setting
  - [x] "Delete the test league" section — steps via `/leagues/{id}/settings` → "Delete league" dialog (type `delete` to confirm), **plus** the explicit AC2 gap disclosure (link to `8-7-delete-test-league-and-data-cleanup` by story key)
  - [x] "Start fresh for the real season" section — one paragraph: create a new **production** league (checkbox unchecked); do not attempt to convert the rehearsal league
  - [x] "What to tell your testers" section (AC3) — copy-pasteable message template with `{N}` week placeholder, banner/chip mention, issue-reporting placeholder
  - [x] "Pre-season sign-off checklist" section (AC4) — the table above, explicitly marked optional
- [x] Task 2: Cross-link from existing docs (AC: #5)
  - [x] `README.md`: add one line under "Docs 📚" linking to `docs/rehearsal-runbook.md`
  - [x] `docs/deployment.md`: append one pointer sentence after the existing `ALLOW_TEST_LEAGUES`/`TEST_LEAGUE_EMAIL_MODE` line, linking to the new runbook
- [x] Task 3: Closeout
  - [x] Proofread all cited routes/button copy against the current source files listed in Dev Notes (things may have drifted since this story was drafted — verify, don't just copy blindly)
  - [x] No test run needed (docs-only change — per project's post-change-testing convention, skip `npm test`/`npm run lint` obligations for a pure-docs diff; run them anyway only if you end up touching any `.ts`/`.tsx` file, which this story should not require)

## Dev Notes

### This is documentation-only — do not write application code

Every button, route, and behavior this runbook describes **already exists and is already tested** (Stories 8.1–8.5, 2.8). If while writing the runbook you find a described behavior doesn't match what's actually in the code, **fix the runbook's wording to match the code** — do not change the code to match a draft runbook sentence. If you find an actual product gap (not just a wording mismatch), add a `deferred-work.md` entry instead of fixing it in this story (out of scope).

### Reference: exact UI copy & routes (verify against source before citing)

| Flow | Route/Page | Component | Key copy |
|---|---|---|---|
| Create league | `/leagues/new` | `src/app/(app)/leagues/new/create-league-form.tsx` | Checkbox label **"Test / rehearsal league"**; helper *"For practice data only — not your real season league. This cannot be changed after creation; start a new production league for the real season."*; **"Simulation week count"** select, default `DEFAULT_SIMULATION_WEEK_COUNT` (4), helper *"How many weeks this rehearsal will run. Recommended: 4–6 weeks."*; submit **"Create league"** |
| Invite | `/leagues/{id}/invites` | `invite-participants-form.tsx` | Field **"Email addresses"**; button **"Send invitations"** |
| Mark ready | same page | `mark-league-ready-section.tsx` | Button **"Mark league ready for season"** → `POST /api/leagues/[leagueId]/pre-season-init` — starts `simulatedCurrentWeek` for test leagues |
| Simulation controls | `/leagues/{id}/admin` | `src/components/admin/AdminSimulationControls.tsx` | Status lines: *"Simulation week count is not configured for this league."* / *"Simulation not started. Mark the league ready for season to begin at Week {N}."* / *"Current simulated week: {n} of {count}."* / *"Simulation complete — Week {n} of {count}."* Buttons: **"Advance to Week {next}"**, **"Apply odds snapshot for Week {n}"**, **"Simulate results for Week {n}"**. Advance confirm dialog: *"Advance to Week {next}?"* / *"This moves the rehearsal clock from Week X to Week Y. It does not create games or scores — only the week pointer changes."* |
| Odds/jailed | same component | → `POST /api/leagues/[leagueId]/simulation/apply-odds-snapshot` | Success: *"Applied fixture odds for Week {week} — {games} games, jailed team: {abbr} ({by})."* Computes jailed team automatically — not a separate action |
| Results/scoring | same component | → `POST /api/leagues/[leagueId]/simulation/apply-results` | Success: *"Simulated results for Week {week} — {finalized} games finalized, {scored} picks scored."* Triggers `finalizeNflWeek`/`scoreNflWeek` when the week is fully final |
| Weekly email | `/leagues/{id}/admin` | `AdminEmailComposer.tsx` (Tuesday), `AdminReminderControls.tsx` (Wed/Thu) | Buttons **"Preview"**, **"Send Now"**, **"Send Wednesday Reminder"**, **"Send Thursday Reminder"**. Suppressed-mode info alert: *"Rehearsal sends are suppressed (TEST_LEAGUE_EMAIL_MODE=suppress) — would have reached N member(s). No email was sent."* |
| Test labeling | league home/picks/standings, nav | `TestLeagueBanner.tsx`, `TestLeagueChip.tsx` | Banner: **"Test / rehearsal league"** / *"Practice data only — not your real season standings or picks."* Chip: **"Test"** (info, outlined) |
| Settings display | `/leagues/{id}/settings` | settings `page.tsx` | **"League type"**: `"Test / rehearsal"` or `"Production (real season)"`; simulation status readout mirrors `AdminSimulationControls` |
| Delete league | `/leagues/{id}/settings` | `delete-league-dialog.tsx` | Button **"Delete league"** (error/outlined) → dialog **"Delete league permanently?"** with body *"This cannot be undone. The league **{name}** and all data scoped to it (members, seasons, invitations, and future league-scoped data) will be removed permanently. User accounts are not deleted."* Type-to-confirm field **"Type delete to confirm"** → **"Delete permanently"** → `DELETE /api/leagues/[leagueId]` → 204, redirect to `/leagues` |
| Env vars | `docs/deployment.md`, `.env.example` | — | `ALLOW_TEST_LEAGUES`: unset/`true`/`1` allow, `false`/`0` deny (not a secret). `TEST_LEAGUE_EMAIL_MODE`: unset/anything-but-exactly-`suppress` → `send` (real Resend, `[TEST]` subject prefix); `suppress` → no Resend call, `sentAt` still recorded, admin sees would-send count. Production cron (`getActiveLeagueIds`) always excludes `isTestLeague: true` regardless of this var. |

### Story 8.7 status (read before writing the delete section)

`8-7-delete-test-league-and-data-cleanup` is **`backlog`** as of this story (see `sprint-status.yaml`). The runbook must describe **today's actual behavior** (Story 2.8's generic delete), not aspirational Story 8.7 behavior. `deferred-work.md`'s two entries under "Deferred from: story 8-3-simulated-odds-and-jailed-team-for-rehearsal (2026-07-20)" — *"Global fixture rows not cleaned by Story 8.7 per-league cascade"* and *"Accepted MVP risk: fixture + real schedule mix for the same `(year, week)`"* — are the authoritative source for AC2's gap description; cite them, don't re-derive.

### Deferred-work disposition for this story

Consulted `_bmad-output/implementation-artifacts/deferred-work.md` while planning — no items are fixable by a docs-only story. The two Story 8.7-relevant items above are **cited, not resolved** (that's 8.7's job). No new deferred-work entry is expected from this story unless the writer discovers an actual wording/behavior mismatch while proofreading (Task 3) that turns out to require a product fix rather than a doc correction — if so, add a `deferred-work.md` entry rather than fixing code in this story.

### UX design spec alignment

`ux-design-specification.md` §"Test / rehearsal leagues" (line ~192) requires test leagues to be "visually distinct (banner/chip)" — already fully implemented by Story 8.1 (`TestLeagueBanner`, `TestLeagueChip`, `[TEST]` email subject). This story does not add or change any UI; it only **documents** the existing UX for the runbook's "what testers will see" framing (AC3.2). No new front-end work is in scope.

### Previous story intelligence

**Story 8.5** (email/cron rehearsal, most recent): confirmed the full weekly-email-in-rehearsal design (`TEST_LEAGUE_EMAIL_MODE`, cron exclusion, manual-send-only model) is complete and stable — this runbook can describe it as finished, load-bearing behavior, not "in progress." Its Dev Notes table "What this story is (and is NOT)" is the clearest existing plain-language explanation of the email design; the runbook's "Weekly email choices" section should read as a **user-facing simplification** of that table, not a re-derivation.

**Stories 8.1–8.4:** established the create → invite → advance → odds/jailed → results loop this runbook documents end-to-end for the first time in one place (each prior story only documented its own slice in its own story file). This is the first artifact that assembles the full sequence for a non-developer reader (an admin about to run a live rehearsal).

**Git pattern (Stories 8.1–8.5):** one focused commit per story, `feat(leagues): Story 8.N — <title>` format. This story, being docs-only, should use `docs(rehearsal): Story 8.6 — rehearsal runbook for invited participants` or similar `docs(...)` scope to match the repo's existing `docs(sprint): ...` / `docs(a11y): ...` commit-type convention (see `git log`).

### Project context reference

- Read `docs/project-context.md` before writing — non-negotiable #1 (no secrets in client-visible content; this runbook contains no secrets, only non-secret ops toggles) is the only one with any bearing on a docs-only story.
- This is the second-to-last Epic 8 story. Story 8.7 (delete/cleanup) remains after this one; do not attempt to pull 8.7's scope forward into this story's runbook beyond citing it as a known gap (AC2).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 8; Story 8.6 (lines 1046–1059)]
- [Source: `_bmad-output/planning-artifacts/prd.md` — line 1249, "Rehearsal / test leagues" FR-coverage row (Epic 8, no new numbered FR)]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — line ~192, "Test / rehearsal leagues" visual distinction requirement]
- [Source: `docs/project-context.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — Story 8.7-relevant entries under "Deferred from: story 8-3-..." (2026-07-20)]
- [Source: `_bmad-output/implementation-artifacts/8-5-email-and-scheduled-jobs-in-rehearsal.md` — email/cron rehearsal design, "What this story is (and is NOT)" table]
- [Source: `_bmad-output/implementation-artifacts/8-1-test-league-flag-labeling-and-optional-global-gates.md` through `8-4-simulated-game-results-and-scoring-reveal-cycle.md` — create/invite/advance/odds/results flows]
- [Source: `docs/email-local-smoke-test-runbook.md` — sibling runbook, structural/style precedent and env-var/local-setup content to link rather than duplicate]
- [Source: `docs/deployment.md` — existing `ALLOW_TEST_LEAGUES` / `TEST_LEAGUE_EMAIL_MODE` documentation to cross-link]
- [Source: `sprint-status.yaml` — confirms `8-7-delete-test-league-and-data-cleanup` is `backlog`]

## Change Log

- 2026-07-28: Story drafted (create-story workflow) — ready for dev.
- 2026-07-28: Story implemented — `docs/rehearsal-runbook.md` created; cross-links added to README and deployment.md. Status → review.
- 2026-07-28: Code review — patched final-week loop, suppress/invite scope, source links, first-competition-week, settings discovery, checklist labeling; status → done.

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

- Verified UI copy against source: `create-league-form.tsx`, `invite-participants-form.tsx`, `mark-league-ready-section.tsx`, `AdminSimulationControls.tsx`, `AdminEmailComposer.tsx`, `AdminReminderControls.tsx`, `TestLeagueBanner.tsx`, `TestLeagueChip.tsx`, `delete-league-dialog.tsx`, `settings/page.tsx`. All labels match current code.

### Completion Notes List

- Created canonical rehearsal runbook at `docs/rehearsal-runbook.md` covering full lifecycle (prerequisites → create → invite → simulate → email modes → delete → production handoff).
- AC2 Story 8.7 delete gap documented inline in delete section with link to `8-7-delete-test-league-and-data-cleanup` and `deferred-work.md`.
- AC3 copy-pasteable tester message template with `{N}` placeholder and issue-reporting prompt.
- AC4 optional sign-off checklist table with pass/fail/notes columns.
- AC5 cross-links: README Docs section, deployment.md env-var pointer, runbook links back to email-local-smoke-test-runbook.md.
- Docs-only — no application code changes; tests skipped per story Task 3.

### File List

- `docs/rehearsal-runbook.md` (new)
- `README.md` (modified)
- `docs/deployment.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/8-6-rehearsal-runbook-for-invited-participants.md` (modified)

### Review Findings

- [x] [Review][Decision] Unrelated sprint-status UI TODOs — kept as intentional out-of-band notes (user choice during code review); not reverted
- [x] [Review][Patch] Final-week loop stop condition is wrong [`docs/rehearsal-runbook.md`] — clarified: "Simulation complete" means final week pointer; still run odds → picks → results; Advance disabled
- [x] [Review][Patch] Suppress does not gate invite emails [`docs/rehearsal-runbook.md`] — documented in prerequisites, invite, and weekly email sections
- [x] [Review][Patch] Broken/confusing App Router source links [`docs/rehearsal-runbook.md`] — routes as plain text; component paths in backticks (no markdown links into `(app)` / `[leagueId]`)
- [x] [Review][Patch] Document First competition week on create [`docs/rehearsal-runbook.md`] — added create step + NFL week 1–18 validity note
- [x] [Review][Patch] Settings discovery path [`docs/rehearsal-runbook.md`] — not in league nav; direct URL or admin leagues list Settings action
- [x] [Review][Patch] Checklist `[TEST]` subject under suppress [`docs/rehearsal-runbook.md`] — send vs suppress verification split
- [x] [Review][Defer] Simulation/email error-recovery paths [`docs/rehearsal-runbook.md`] — deferred, pre-existing (happy-path runbook; AC does not require documenting SIMULATION_GAMES_NOT_LOADED, ALREADY_SENT, SEASON_NOT_FOUND, delete API failure, etc.)
