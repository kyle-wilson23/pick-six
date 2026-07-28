# Rehearsal Runbook for Invited Participants

End-to-end guide for league admins running a **pre-season dry run** with invited testers. Covers the full rehearsal lifecycle: create a test league → invite → simulate weeks → optional emails → delete when finished.

**Scope:** Every capability documented here already ships in the app (Stories 8.1–8.7, 2.8). This runbook does not add new features — it assembles the admin click-order and participant messaging in one place.

**Related docs:**

- [Local email smoke test](./email-local-smoke-test-runbook.md) — Resend sandbox setup (`RESEND_API_KEY`, `RESEND_FROM`, recipient restrictions)
- [Deployment guide](./deployment.md) — production env vars and ops toggles
- [`.env.example`](../.env.example) — full variable list

---

## Prerequisites

### Rehearsal environment variables

Set these in `.env.local` (local dev) or your deployment's environment settings. They are **not secrets** — safe to document in-repo.

| Variable | Default / values | Purpose |
|----------|------------------|---------|
| `ALLOW_TEST_LEAGUES` | Unset, `true`, or `1` → **allow** test-league creation. `false` or `0` → **deny** (checkbox hidden on `/leagues/new`). | Global gate for the "Test / rehearsal league" checkbox. |
| `TEST_LEAGUE_EMAIL_MODE` | Unset or anything except exactly `suppress` → **`send`** (real Resend calls, `[TEST]` subject prefix). `suppress` → **no Resend call**; admin UI shows would-send count. | Rehearsal email policy for **Tuesday / Wednesday / Thursday** manual admin sends only — does **not** gate invite emails. |

Production cron (`getActiveLeagueIds`) **always excludes** `isTestLeague: true` leagues regardless of `TEST_LEAGUE_EMAIL_MODE`. Rehearsal weekly emails are sent only when an admin clicks the manual send buttons on `/leagues/{leagueId}/admin`.

### Email setup (when sending real test emails)

If you plan to exercise the weekly email cycle with real inbox delivery (`TEST_LEAGUE_EMAIL_MODE=send` or unset), configure the standard email variables first. Do **not** duplicate that setup here — follow [email-local-smoke-test-runbook.md § Prerequisites](./email-local-smoke-test-runbook.md#prerequisites) for `RESEND_API_KEY`, `RESEND_FROM`, sandbox recipient rules, and local `AUTH_URL`.

---

## Create a test league

**Route:** `/leagues/new` — `src/app/(app)/leagues/new/create-league-form.tsx`

1. Sign in as a league admin.
2. Navigate to **Create league** (`/leagues/new`).
3. Enter a league name (e.g. "Pre-season Rehearsal 2026").
4. Select **"First competition week"** (NFL week the rehearsal calendar starts on). For a test league, `firstCompetitionWeek` + `simulationWeekCount` must stay within NFL Weeks 1–18 — the form rejects invalid combinations.
5. Check **"Test / rehearsal league"** (only visible when `ALLOW_TEST_LEAGUES` allows it).
   - Helper copy: *"For practice data only — not your real season league. This cannot be changed after creation; start a new production league for the real season."*
6. Select **"Simulation week count"** — default **4 weeks** (`DEFAULT_SIMULATION_WEEK_COUNT`). Recommended: **4–6 weeks**.
   - Helper copy: *"How many weeks this rehearsal will run. Recommended: 4–6 weeks."*
7. Click **"Create league"**.

The test flag and simulation week count **cannot be changed after creation**. For the real NFL season, create a separate production league (checkbox unchecked).

---

## Invite participants

**Route:** `/leagues/{leagueId}/invites` — `invite-participants-form.tsx`, `mark-league-ready-section.tsx` under `src/app/(app)/leagues/[leagueId]/invites/`

### Send invitations

1. Open **Invites** for the test league (`/leagues/{leagueId}/invites`).
2. Enter tester email addresses in **"Email addresses"** (one or more).
3. Click **"Send invitations"**.
4. Testers complete signup via the invite link and join the league.

**Note:** **"Send invitations"** always uses Resend when email is configured — `TEST_LEAGUE_EMAIL_MODE=suppress` does **not** block invite emails. On shared staging, invite only people who should receive mail, or use local/sandbox recipients.

If sending real emails, use deliverable addresses per [Resend sandbox constraints](./email-local-smoke-test-runbook.md#resend-sandbox-constraints-free-tier-no-verified-domain). Avoid `@example.com` addresses — Resend rejects them.

### Mark league ready for season

After invites are out (or before the first simulated week — order is flexible, but simulation cannot start until this step):

1. On the same **Invites** page, find **"Mark league ready for season"**.
2. Click **"Mark league ready for season"** (`POST /api/leagues/[leagueId]/pre-season-init`).

This starts the simulation clock: `simulatedCurrentWeek` is set to `firstCompetitionWeek`. Until then, admin simulation controls show *"Simulation not started. Mark the league ready for season to begin at Week {N}."*

---

## Run a simulated week

**Route:** `/leagues/{leagueId}/admin` — **Simulation** section (`src/components/admin/AdminSimulationControls.tsx`)

**Safety — league-scoped scoring:** **Simulate results** scores picks **only for the test league you are administering**. Other leagues (including production) that share the same NFL `(season year, week)` are not affected — their picks stay unscored even when fixture games make the global week fully finalized.

Repeat steps 1–4 for **every** simulated week, including the final week. Then advance (step 5) only when a next week exists.

When the pointer is on the **last** configured week, status reads *"Simulation complete — Week {n} of {count}."* and **"Advance to Week …"** is disabled — but you must still run **Apply odds snapshot → picks → Simulate results** for that final week before you are done.

| Step | Who | Action | What happens |
|------|-----|--------|--------------|
| 1 | **Admin** | Click **"Apply odds snapshot for Week {n}"** | Loads fixture odds for the current week and computes the jailed team (`POST /api/leagues/[leagueId]/simulation/apply-odds-snapshot`). Success: *"Applied fixture odds for Week {week} — {games} games, jailed team: {abbr} ({by})."* |
| 2 | **Participants** | Submit picks on `/leagues/{leagueId}/picks` | Matchups show odds, spread, and weather from the fixture snapshot. Jailed-team messaging applies if relevant. |
| 3 | **Admin** *(optional)* | Send weekly emails (see [Weekly email choices](#weekly-email-choices)) | Tuesday digest, Wednesday reminder, Thursday reminder — manual buttons only in rehearsal. |
| 4 | **Admin** | Click **"Simulate results for Week {n}"** | Finalizes fixture games and scores picks when the week is fully final (`POST /api/leagues/[leagueId]/simulation/apply-results`). Success: *"Simulated results for Week {week} — {finalized} games finalized, {scored} picks scored."* |
| 5 | **Admin** | Click **"Advance to Week {next}"** → confirm dialog | Moves the rehearsal clock forward. Dialog: *"Advance to Week {next}?"* / *"This moves the rehearsal clock from Week X to Week Y. It does not create games or scores — only the week pointer changes."* Click **"Confirm"**. Skip this step on the final week (button disabled). |

After advancing, return to step 1 for the next week. Participants can check **standings** and **pick history** after simulated results — peer picks stay hidden until the Tuesday reveal cycle (Epic 5).

**Admin override (optional during rehearsal):** On `/leagues/{leagueId}/admin`, use the pick-submission tools to submit or change a pick on behalf of a participant, including post-deadline. Overrides appear in the audit log (Epic 4).

---

## Weekly email choices

Rehearsal leagues use **admin manual send only** — production Vercel cron never targets `isTestLeague: true` leagues.

**Route:** `/leagues/{leagueId}/admin` — `AdminEmailComposer.tsx` (Tuesday), `AdminReminderControls.tsx` (Wed/Thu) under `src/components/admin/`

| `TEST_LEAGUE_EMAIL_MODE` | Resend | Admin sees | Testers see |
|--------------------------|--------|------------|-------------|
| **Unset / `send`** (default) | Real API call; subject prefixed with **`[TEST]`** | Normal send confirmation and timestamps | Email in inbox with `[TEST]` prefix |
| **`suppress`** | No Resend call; `sentAt` still recorded when recipients exist | Info alert: *"Rehearsal sends are suppressed (TEST_LEAGUE_EMAIL_MODE=suppress) — would have reached N member(s). No email was sent."* | Nothing for Tue/Wed/Thu — verify those flows via admin UI only |

**Scope of suppress:** Applies only to Tuesday digest and Wednesday/Thursday reminder buttons. It does **not** suppress **"Send invitations"** on the Invites page (see [Invite participants](#invite-participants)).

**When to use each mode:**

- **`send`** — Controlled rehearsal with real testers checking their inboxes (your own deploy, local dev with Resend sandbox).
- **`suppress`** — Shared staging or ad-hoc dry runs where you do not want **weekly** emails leaving the server. Set `TEST_LEAGUE_EMAIL_MODE=suppress` on that deployment. Still treat invite sends as live Resend traffic.

**Buttons:** **"Preview"**, **"Send Now"** (Tuesday digest); **"Send Wednesday Reminder"**, **"Send Thursday Reminder"**. Reminders reach only outstanding (not-yet-picked) members.

For full local Resend setup, see [email-local-smoke-test-runbook.md](./email-local-smoke-test-runbook.md).

---

## Delete the test league

**Route:** `/leagues/{leagueId}/settings` — `delete-league-dialog.tsx` under `src/app/(app)/leagues/[leagueId]/settings/`

Settings is **not** in the league nav tabs. Open it via:

- Direct URL: `/leagues/{leagueId}/settings`, or
- **Settings** on the admin leagues list row actions (`/leagues` admin view)

When rehearsal is complete:

1. Open **Settings** for the test league (path above).
2. Click **"Delete league"** (error/outlined button).
3. In the dialog **"Delete league permanently?"**, read the warning: *"This cannot be undone. The league **{name}** and all data scoped to it (members, seasons, invitations, and future league-scoped data) will be removed permanently. User accounts are not deleted."*
4. Type **`delete`** in **"Type delete to confirm"**.
5. Click **"Delete permanently"** (`DELETE /api/leagues/[leagueId]` → redirect to `/leagues`).

### What delete removes (Story 8.7)

**Always removes** (everything scoped to `leagueId`):

- The league, its season, memberships, invitations, picks, audit entries, and league email config

**Global rehearsal fixtures** (not scoped to `leagueId`):

- During rehearsal, the app creates shared `NflGame`, `OddsSnapshotRun` (`source: "test_fixture"`), `NflGameOddsLine`, and `NflWeekJailedTeam` rows. These are visible across test leagues, not tied to one league row.
- When you delete a test league and **other rehearsal leagues still exist**, those shared fixtures **stay** until the last test league is deleted.
- When you delete the **last** remaining test league, the server automatically removes `test_fixture` snapshot runs, fixture-only games (including any simulated scores), and jailed-team rows for weeks that no longer have any games. Games that also carry real synced odds are **kept**.
- Practice/rehearsal data is **not retained** for season history (NFR25 applies to real-season participant data, not test leagues).

Production leagues use the same delete flow; global fixture cleanup runs **only** when the deleted league was a test league and no other test leagues remain.

---

## Start fresh for the real season

Do **not** attempt to convert a rehearsal league into a production league. The **"Test / rehearsal league"** flag is set at creation only (`/leagues/new`).

For the real NFL season:

1. Create a **new production league** at `/leagues/new` with **"Test / rehearsal league" unchecked**.
2. Invite real participants, run pre-season init, and let production cron handle weekly emails.

Settings for a test league confirm this: **"League type"** shows **"Test / rehearsal"** with helper *"Set at creation only. For a real season, create a new production league."*

---

## What to tell your testers

Copy the message below into email, Slack, or text **before or alongside** the invite. Replace `{N}` with your league's simulation week count (shown on `/leagues/{id}/settings` as **"Simulation week count"**).

---

**Subject (suggested):** Pick Six rehearsal — practice league invite

Hi —

You're invited to a **practice / rehearsal** Pick Six league before the real NFL season starts.

- This league runs **{N} simulated weeks** compressed into a short window (not real calendar weeks).
- All games, scores, and standings are **fake fixture data** — for testing the app only.
- Your real picks and accounts in any **production** league are completely unaffected.

Inside the app you'll also see a **"Test / rehearsal league"** banner on league home, picks, and standings, plus a **"Test"** chip in navigation — same message, built into the product.

If something looks wrong or breaks during the rehearsal, please report it here: **{your Slack channel / email / doc link}**

Thanks for helping us shake out bugs before kickoff!

---

The in-app banner (`TestLeagueBanner.tsx`) and nav chip (`TestLeagueChip.tsx`) under `src/components/league/` reinforce this message so testers see it twice — once from you, once in the product.

---

## Pre-season sign-off checklist *(optional)*

This table is a **sign-off aid only** — a rehearsal is not blocked on filling it out. Use pass / fail / notes as you verify core journeys before the real season.

| Journey | What to verify | Epic / Story | Pass | Fail | Notes |
|---------|----------------|--------------|------|------|-------|
| **Pick submission** | Participant views matchups (odds/spread/weather), submits a pick, sees jailed-team messaging if applicable | Epic 3 | | | |
| **Reminder emails** | Wed/Thu reminder reaches an outstanding participant; submitted participants excluded | Story 6.3 (rehearsal buttons: Story 8.5) | | | |
| **Standings / reveal** | After simulated results, standings update and personal history reflects the week; peer picks hidden until reveal | Epic 5 | | | |
| **Admin override** | Admin submits/changes a pick on behalf of a participant (incl. post-deadline); entry in audit log | Epic 4 | | | |
| **Weekly email cycle** | Tuesday digest (or suppressed equivalent) reflects correct simulated week and content | Story 8.5 AC1 | | | |
| **Test league labeling** | Banner and **"Test"** chip appear as expected. In **`send`** mode, also verify **`[TEST]`** email subject; in **`suppress`** mode, verify the admin would-send alert instead (no inbox mail) | Story 8.1 | | | |
| **Delete cleanup** | League deletes cleanly; when deleting the **last** test league, global fixture rows are removed (see [delete section](#what-delete-removes-story-87)); deleting one of several test leagues leaves shared fixtures in place | Story 8.7 | | | |
