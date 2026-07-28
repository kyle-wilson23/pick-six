# Story 8.5: Email and Scheduled Jobs in Rehearsal

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a league admin,
I want **explicit control** over whether a rehearsal (test) league sends **real emails** and to have production cron **never** touch rehearsal leagues,
so that I can test deliverability with a small group of invited testers, or run a dry run without spamming anyone, and so that a rehearsal's compressed simulated week never gets confused with the real Tuesday/Wednesday/Thursday production email cycle.

## Acceptance Criteria

### AC1 — Critical bug fix: email data loaders must use the simulation-aware week resolver for test leagues

**Given** `getTuesdayDigestData` (`src/lib/email/get-tuesday-digest-data.ts`) and `getReminderData` (`src/lib/email/get-reminder-data.ts`) currently call **`resolvePicksWeekNumber`** (the real-kickoff-based resolver) directly — the **same bug class** Stories 8.2/8.3 already found and fixed in `build-admin-override-data.ts` / `get-jailed-verification.ts` (their "`resolveActiveWeekNumber`-style test-league gap"), except this occurrence was **not caught** by Story 8.4's "audit result" (8.4 only audited the Story 5.4–5.6 *scoring/reveal* read paths, not the email data loaders)

**When** either function is called for a **test league** whose simulation has started (`Season.simulatedCurrentWeek` non-null)

**Then** both functions must resolve the email week via **`resolveActiveWeekNumber`** (`src/lib/nfl/resolve-picks-week.ts`, already exported, already used correctly by `build-submission-status.ts` / `build-admin-override-data.ts` / `get-jailed-verification.ts` / `build-league-picks-week-view.ts`) — **not** `resolvePicksWeekNumber` — so a manually-triggered Tuesday digest / Wednesday reminder / Thursday reminder for a rehearsal league targets the **simulated** week, not whatever real-kickoff-based week the fixture data or absence of `NflGame` rows happens to produce

**And**, matching `build-submission-status.ts`'s exact `canResolveActiveWeek` pattern (`src/lib/admin/build-submission-status.ts:66-80`), the "must have at least one `NflGame` row with a kickoff" gate is **bypassed** for a test league whose `simulatedCurrentWeek` is already set — so an admin can trigger a rehearsal email **before** any `NflGame`/odds-fixture rows exist for the target week (e.g., before Story 8.3's "Apply odds snapshot" has been clicked for that week), exactly as `build-submission-status.ts` already allows for the submission-status card

**And** both functions gain an optional `now: Date = new Date()` parameter (threaded into `resolveActiveWeekNumber`), matching `buildSubmissionStatus(args, now)`'s signature shape — needed so tests can assert deterministic week resolution without depending on the real wall clock, the same reason `buildSubmissionStatus` already takes `now`

**And** the `isTestLeague` value already fetched from `league.isTestLeague` (both functions already select it) is reused for this check — no new query

---

### AC2 — Production cron never touches test/rehearsal leagues

**Given** `getActiveLeagueIds()` (`src/lib/cron/get-active-league-ids.ts`) currently selects **every** `Season` row with `preSeasonInitializedAt != null` for the current NFL year, with **no** `isTestLeague` filter — meaning the three real cron routes (`/api/cron/tuesday-email`, `/api/cron/wednesday-reminder`, `/api/cron/thursday-reminder`), which gate on **real Eastern wall-clock windows** (Tue 5–9pm, Wed 7pm–midnight, Thu 5–9pm ET), would currently attempt to email a rehearsal league too if that league happened to be initialized during one of those real windows

**When** `getActiveLeagueIds()` runs

**Then** it filters to `league: { isTestLeague: false }` in the same `prisma.season.findMany` `where` clause (join via the existing `Season.league` relation — no new query, no schema change) — so **no** rehearsal league is ever included in a production cron invocation's league list, for any reason, at any time

**And** this is a **hard exclusion**, not a configurable toggle — there is no legitimate reason for a real-calendar-driven cron to touch a league whose simulated week has no relationship to the real calendar (per the "decoupled from production cron" language in `epics.md` Story 8.5's own acceptance criteria)

**And** rehearsal leagues remain fully servable via the **existing** admin-triggered manual send routes (`POST /api/leagues/[leagueId]/email/tuesday-send`, `.../wednesday-reminder`, `.../thursday-reminder` — Stories 6.2/6.3, unchanged in this story except for AC3/AC4's additions below) — these routes have **no** Eastern-window gate and are not cron-driven, so they already function as the "admin-triggered simulate send" half of `epics.md`'s "either ... or" acceptance criterion; AC1's fix makes them target the correct simulated week

---

### AC3 — Explicit per-deploy policy: `TEST_LEAGUE_EMAIL_MODE` suppress option

**Given** the product need ("explicit control ... to avoid spamming during dry runs") and the existing precedent of `allowTestLeagues()` (`src/lib/league/allow-test-leagues.ts`) — a permissive-default, non-secret, string-env-var ops gate

**When** a new pure helper `src/lib/email/test-league-email-mode.ts` is added:

```ts
export type TestLeagueEmailMode = "send" | "suppress";

export function getTestLeagueEmailMode(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): TestLeagueEmailMode {
  const raw = env.TEST_LEAGUE_EMAIL_MODE?.trim().toLowerCase();
  return raw === "suppress" ? "suppress" : "send";
}
```

**Then** `sendTuesdayDigest` (`src/lib/email/send-tuesday-digest.ts`) and `sendReminder` (`src/lib/email/send-reminder.ts`) each check `data.isTestLeague && getTestLeagueEmailMode() === "suppress"` **immediately after** loading `data` (before the circuit-breaker check, before any `resend.emails.send` call) and, when true:

1. Make **zero** calls to `resend.emails.send` / `sendWithRetry` — no Resend API traffic at all for this invocation
2. Still **upsert** `LeagueWeekEmailConfig` with the appropriate `sentAt` (Tuesday digest — preserving any existing `bodyText` on update, exactly like the current non-suppressed upsert) or `wednesdayReminderSentAt` / `thursdayReminderSentAt` (reminders) field set to `now`, reusing the **same** upsert shape already in each function — this keeps the "safe to click repeatedly" idempotency property (a second click doesn't re-log or re-attempt) and lets the rehearsal exercise the full weekly-cycle *state machine* (reminders correctly see "already sent" via the same `ALREADY_SENT` 409 guard) without any real delivery
3. Log one structured `logEvent` (`level: "info"`, `domain: "email"`, `action: "tuesday_digest_suppressed"` / `"reminder_suppressed"`) including `leagueId`, `weekNumber`, and a `wouldSendCount` (member count that would have received a real send) — this is the "surface 'would-send' in admin UI" signal's server-side source of truth
4. Return `{ sent: 0, failed: 0, sentAt: <now>, suppressed: true, wouldSendCount: <N> }` (new `suppressed` / `wouldSendCount` fields added to both functions' return types — `sent`/`failed` stay `0`/`0` since nothing was attempted or failed)

**And** for **production leagues** (`isTestLeague === false`), `TEST_LEAGUE_EMAIL_MODE` has **zero** effect regardless of its value — the suppress branch is gated on `data.isTestLeague` first, so this env var can never alter production email delivery even if misconfigured

**And** the **default** (`TEST_LEAGUE_EMAIL_MODE` unset, empty, or any value other than exactly `"suppress"`) is `"send"` — **byte-identical behavior to today** for every existing deploy that hasn't set this var, satisfying "safe defaults for a shared staging/rehearsal deploy" (AC6) by never changing behavior unless explicitly opted in

---

### AC4 — Admin UI surfaces the suppressed outcome

**Given** the existing `AdminEmailComposer` (`src/components/admin/AdminEmailComposer.tsx`) and `AdminReminderControls` (`src/components/admin/AdminReminderControls.tsx`) already call the manual send routes and render `Alert severity="success"` / `"warning"` from the JSON response

**When** the three manual-send route handlers (`.../email/tuesday-send/route.ts`, `.../wednesday-reminder/route.ts`, `.../thursday-reminder/route.ts`) build their success JSON body

**Then** each includes the new fields verbatim from the `sendTuesdayDigest` / `sendReminder` result: `suppressed: result.suppressed, wouldSendCount: result.wouldSendCount` (alongside the existing `sent`, `failed`, `skipped`, `sentAt`)

**And** `AdminEmailComposer.handleSend` / `AdminReminderControls.handleSend` check `data.suppressed` **before** the existing `if (sent === 0)` error branch (a suppressed send always has `sent === 0`, which today's code would otherwise misreport as "No members to send to." / "All members have already submitted picks.") and, when `suppressed === true`, render `Alert severity="info"` with copy such as *"Rehearsal sends are suppressed (`TEST_LEAGUE_EMAIL_MODE=suppress`) — would have reached {wouldSendCount} member(s). No email was sent."* — still updating the displayed "Last sent" timestamp from `sentAt` so the UI accurately reflects that the week's email obligation is recorded

**And** no changes are made to `AdminSimulationControls.tsx` — email suppression is a deploy-wide policy surfaced through the **existing** email/reminder cards, not a new Simulation-card button; this keeps the "one env-driven policy, not a new per-click toggle" design decision from AC3 consistent end-to-end

---

### AC5 — Data separation / no-op for production leagues (reaffirmed, Epic 8 standing rule)

**Given** Stories 8.1–8.4's standing rule: "every Epic 8 simulation/rehearsal behavior MUST no-op for `isTestLeague === false`"

**When** this story's code runs against a production league

**Then** verify:

1. `getActiveLeagueIds()` for a production-only deploy (no test leagues exist) returns **exactly** the same list as before this story (the added `league: { isTestLeague: false }` filter is a no-op when no rows have `isTestLeague: true`)
2. `getTuesdayDigestData` / `getReminderData` for a production league (`isTestLeague: false`) resolve the week via `resolveActiveWeekNumber`, which — per its own existing "Production path is a pure passthrough" contract (`resolve-picks-week.ts:62`) — falls through to the **exact same** `resolvePicksWeekNumber` call as before this story; **zero behavior change** for production leagues
3. `sendTuesdayDigest` / `sendReminder` for a production league always take the normal send path regardless of `TEST_LEAGUE_EMAIL_MODE`'s value (AC3)

---

### AC6 — Documentation: env var and safe defaults for a shared staging/rehearsal deploy

**Given** `docs/deployment.md` already documents `ALLOW_TEST_LEAGUES` as an "optional ops toggle" in its environment variable table (Story 8.1 precedent), and `.env.example` already has a "Test / rehearsal leagues (Story 8.1)" comment block

**When** this story ships

**Then** `.env.example` gains `TEST_LEAGUE_EMAIL_MODE` documented in that same block: unset/`send` (default) → rehearsal leagues send real emails via Resend to real invited testers (subject-prefixed `[TEST]`, per Story 8.1's existing `formatEmailSubject`); `suppress` → rehearsal leagues never call Resend, "would-send" is logged and surfaced in the admin UI (AC3/AC4)

**And** `docs/deployment.md`'s "Production environment variables" table / optional-vars list gains `TEST_LEAGUE_EMAIL_MODE` next to `ALLOW_TEST_LEAGUES`, with a one-line safe-default recommendation for a **shared staging/rehearsal deploy used by multiple people** (e.g. "set `TEST_LEAGUE_EMAIL_MODE=suppress` on any shared/staging deploy where rehearsal leagues might be created by people other than you, to avoid accidentally emailing real invited testers during ad-hoc dry runs; leave unset — i.e. `send` — for your own controlled rehearsal with a small group of real testers who expect the emails")

**And** the doc explicitly notes cron **never** sends for rehearsal leagues (AC2) — the only way a rehearsal league receives email is the admin-triggered manual send buttons already on `/leagues/[leagueId]/admin`

---

### AC7 — Reuse / do-not-touch list (explicit)

**Given** this story's job is to close a real bug (AC1) and add one narrow, env-gated policy (AC3) on top of already-correct, already-tested production email infrastructure

**Then** the following are **not modified** in this story (all already correct — Stories 6.1–6.5, 7.4, 8.1 shipped them):

`src/lib/email/resend-client.ts`, `src/lib/email/resend-from.ts`, `src/lib/email/send-with-retry.ts`, `src/lib/email/circuit-breaker.ts`, `src/lib/email/map-with-concurrency.ts`, `src/lib/email/test-league-labeling.ts`, `src/lib/email/templates/*`, `src/lib/cron/eastern-window.ts`, `src/lib/cron/assert-cron-request.ts`, `src/lib/cron/cron-job-http-status.ts`, `src/app/api/cron/*/route.ts` (all three — they call `getActiveLeagueIds()` and `sendTuesdayDigest`/`sendReminder` as-is; AC2's fix lives entirely inside `getActiveLeagueIds()`), `src/lib/nfl/resolve-picks-week.ts` (only **imported from** — `resolveActiveWeekNumber` already exists and is correct; do not edit it), `src/lib/league/allow-test-leagues.ts`, `src/components/admin/AdminSimulationControls.tsx`, `prisma/schema.prisma` (no migration — no new columns needed).

**And** `src/lib/admin/get-weekly-email-status.ts` is **also not modified** in this story — see Dev Notes "Known, accepted limitation" below for why its real-Eastern-clock-based `pending`/`not_sent` inference is a separate, lower-priority, cosmetic gap for rehearsal leagues that this story deliberately does not fix.

---

## Tasks / Subtasks

- [x] Task 1: Fix the week-resolution bug in both email data loaders (AC: #1)
  - [x] `src/lib/email/get-tuesday-digest-data.ts`: add `now: Date = new Date()` param; replace the local `canResolveActiveWeek` with the `isTestLeague`-aware version (mirror `build-submission-status.ts:66-80` exactly); add `simulatedCurrentWeek: season.simulatedCurrentWeek` to `seasonForResolve`; replace `resolvePicksWeekNumber(seasonForResolve, gamesForResolve)` with `resolveActiveWeekNumber({ isTestLeague: league.isTestLeague, season: seasonForResolve, gamesForYear: gamesForResolve, now })`
  - [x] `src/lib/email/get-reminder-data.ts`: identical change (same file shape as `get-tuesday-digest-data.ts` — both were written together in Story 6.2/6.3 and are near-duplicates for this section)
  - [x] Update `src/lib/email/get-tuesday-digest-data.test.ts`: remove the `vi.mock("@/lib/nfl/resolve-picks-week", ...)` block (it does not actually control `resolveActiveWeekNumber`'s internal call — ESM module self-reference means the mock only overrides the *externally imported* `resolvePicksWeekNumber` binding, not the one `resolveActiveWeekNumber` calls internally from its own module scope; the existing fixture's kickoff date `2026-09-15` already resolves to week 3 for real via the actual, unmocked function, so removing the mock changes nothing about existing test outcomes); add a new test: test league with `simulatedCurrentWeek` set resolves that week regardless of `now`/games (mirror `build-submission-status.test.ts`'s `"test league: weekNumber follows simulatedCurrentWeek regardless of now (AC5)"` test, including passing an explicit `now` to the function and empty `mockNflGameFindMany`)
  - [x] Same test update for `src/lib/email/get-reminder-data.test.ts`
- [x] Task 2: Exclude test leagues from cron (AC: #2)
  - [x] `src/lib/cron/get-active-league-ids.ts`: add `league: { isTestLeague: false }` to the `where` clause
  - [x] New `src/lib/cron/get-active-league-ids.test.ts` (mocked Prisma — first colocated test for this file): asserts the `where` clause passed to `prisma.season.findMany` includes `league: { isTestLeague: false }` alongside the existing `nflSeasonYear` / `preSeasonInitializedAt` conditions
- [x] Task 3: `TEST_LEAGUE_EMAIL_MODE` suppress policy (AC: #3)
  - [x] New `src/lib/email/test-league-email-mode.ts` (+ `.test.ts`): `getTestLeagueEmailMode(env)` — default `"send"`, `"suppress"` only on exact (trimmed, lowercased) match; test default/unset/garbage → `"send"`, exact `"suppress"` (and case-insensitive / whitespace variants) → `"suppress"`
  - [x] `src/lib/email/send-tuesday-digest.ts`: move the `config`/`adminNote` lookup above the circuit-breaker block; add the suppress branch (checks `data.isTestLeague && getTestLeagueEmailMode() === "suppress"`, upserts `sentAt`, logs, returns early); add `suppressed: false, wouldSendCount: 0` to the existing non-suppressed return statement; update the return type signature
  - [x] `src/lib/email/send-reminder.ts`: same shape, using the `reminderField` upsert already present at the bottom of the function
  - [x] New `src/lib/email/send-tuesday-digest.test.ts` (+ mocked `@/lib/db`, `@/lib/email/resend-client`, `@/lib/email/test-league-email-mode`) — **deliberate exception to the "no test for Resend-orchestration files" convention**, justified the same way Story 8.4 justified `apply-simulation-week-results.test.ts`: this is a new safety invariant ("suppressed mode must never call Resend") worth a mocked-Resend proof. Tests: (a) `isTestLeague: true` + mode `"suppress"` → `resend.emails.send` never called, `sentAt` still upserted, `suppressed: true` returned; (b) `isTestLeague: true` + mode `"send"` (default) → normal send path unchanged; (c) `isTestLeague: false` + mode `"suppress"` (env misconfigured) → normal send path unchanged (AC5.3)
  - [x] New `src/lib/email/send-reminder.test.ts` — same three cases for `sendReminder`
- [x] Task 4: Route + admin UI surfacing (AC: #4)
  - [x] `src/app/api/leagues/[leagueId]/email/tuesday-send/route.ts`: add `suppressed: result.suppressed, wouldSendCount: result.wouldSendCount` to the success JSON body
  - [x] `src/app/api/leagues/[leagueId]/email/wednesday-reminder/route.ts` and `.../thursday-reminder/route.ts`: same
  - [x] `src/components/admin/AdminEmailComposer.tsx`: extend the response type and `handleSend` to branch on `suppressed` before the `sent === 0` check, rendering `Alert severity="info"`
  - [x] `src/components/admin/AdminReminderControls.tsx`: same for both wednesday/thursday handlers
- [x] Task 5: Documentation (AC: #6)
  - [x] `.env.example`: add `TEST_LEAGUE_EMAIL_MODE` to the existing "Test / rehearsal leagues (Story 8.1)" block
  - [x] `docs/deployment.md`: add `TEST_LEAGUE_EMAIL_MODE` to the optional-vars line next to `ALLOW_TEST_LEAGUES`; add the shared-staging-deploy safe-default guidance sentence; note cron never sends for rehearsal leagues
- [x] Task 6: Closeout
  - [x] `npm test` for all touched/new files
  - [x] Manual smoke (see Testing requirements)
  - [x] Add a `deferred-work.md` entry for the `get-weekly-email-status.ts` real-clock-window cosmetic gap (Dev Notes) if still true after implementation

### Review Findings

- [x] [Review][Patch] `AdminEmailComposer.handleSend` must abort the send and surface an error if the pre-send `handleSave()` fails, instead of silently proceeding with stale `bodyText` [`src/components/admin/AdminEmailComposer.tsx`] — resolved from [Review][Decision]: keep auto-save-on-send, but treat a save failure as a send failure. Fixed: `handleSave` now returns a boolean; `handleSend` aborts with a `sendError` when it's `false`.
- [x] [Review][Patch] `sprint-status.yaml` comment contradicts the status value it annotates [`_bmad-output/implementation-artifacts/sprint-status.yaml`:37] — fixed.
- [x] [Review][Patch] Misleading test name in `send-reminder.test.ts` / `send-tuesday-digest.test.ts` — "production league ignores suppress mode when env is misconfigured" mischaracterizes intended, by-design behavior as a misconfiguration [`src/lib/email/send-reminder.test.ts`, `src/lib/email/send-tuesday-digest.test.ts`] — fixed (renamed in both files).
- [x] [Review][Patch] Suppress branches always upsert `sentAt`/reminder field even when `wouldSendCount` is 0, unlike the real-send path which only upserts when `sent > 0` [`src/lib/email/send-tuesday-digest.ts`, `src/lib/email/send-reminder.ts`] — fixed: `sentAt` is now `null` and the upsert is skipped when `wouldSendCount === 0`; new tests added.
- [x] [Review][Patch] Dev Agent Record File List omits `docs/email-local-smoke-test-runbook.md`, which is modified in this diff [`_bmad-output/implementation-artifacts/8-5-email-and-scheduled-jobs-in-rehearsal.md`] — fixed.

- [x] [Review][Defer] Suppress-branch `LeagueWeekEmailConfig` upsert has no error handling/retry [`src/lib/email/send-tuesday-digest.ts`, `src/lib/email/send-reminder.ts`] — deferred, pre-existing (same class as 6.3's already-accepted "sentAt DB upsert failure causes response/DB desync")
- [x] [Review][Defer] `sendTuesdayDigest`'s `LeagueWeekEmailConfig.findUnique` (for `adminNote`) now runs before the `providedBreaker.open` short-circuit, adding a DB dependency during an already-open circuit [`src/lib/email/send-tuesday-digest.ts`:47-58] — deferred, required by AC3's mandated ordering (suppress check before breaker check)
- [x] [Review][Defer] `AdminEmailComposer`'s note `TextField` isn't disabled during `saving`/`sending`, allowing in-flight keystrokes to be overwritten by a save response [`src/components/admin/AdminEmailComposer.tsx`:201-210] — deferred, pre-existing race, not introduced by this diff

## Dev Notes

### What this story is (and is NOT)

| **Is** | **Is NOT** |
|--------|------------|
| A bug fix so rehearsal emails target the **simulated** week (AC1) | A change to production leagues' week resolution — passthrough is preserved (AC5) |
| A hard exclusion of test leagues from **real-calendar cron** (AC2) | A new cron schedule or a "rehearsal cron" — rehearsal has no cron at all, only admin-triggered manual sends |
| One env-gated **suppress** policy on top of the *existing* manual send routes/UI (AC3/AC4) | New routes, new buttons on `AdminSimulationControls`, or a per-league DB-persisted email setting |
| A fix to the **admin-triggered "simulate send"** half of `epics.md`'s "either ... or" AC (manual routes + AC1's week fix) | Email/cron rehearsal *clock advancement* — that's Story 8.2 (already done) |
| Documentation of one safe-default recommendation for shared deploys (AC6) | A redirect-to-test-domain policy — `epics.md` only requires "at least one" policy; redirect is a documented-but-not-built option (see below) |

### Why AC1 is the load-bearing fix (read before touching anything else)

Stories 8.2 and 8.3 each found and fixed one occurrence of a recurring bug class: a read path using the real-clock `resolvePicksWeekNumber` where it should have used the test-league-aware `resolveActiveWeekNumber`. Story 8.4's own "Audit result" section explicitly checked the **Story 5.4–5.6 scoring/reveal read paths** and found none remaining there — but it did **not** audit the **email data loaders**, because Story 8.4 wasn't about email. This story's planning re-ran that audit specifically for `src/lib/email/*.ts` and found the **same bug class still present** in both `getTuesdayDigestData` and `getReminderData` (both call `resolvePicksWeekNumber` directly — grep confirms `resolveActiveWeekNumber` does not appear anywhere under `src/lib/email/` or `src/app/api/cron/` before this story).

**Concretely, without AC1:** an admin rehearsing Week 2 of a 4-week test league (via `AdminSimulationControls`'s "Advance to Week 2") who clicks "Send Now" on the Tuesday email composer would have the email computed for whatever week `resolvePicksWeekNumber` derives from real `NflGame` kickoff timestamps — which, given Story 8.3's fixture games are seeded with kickoff times 3+ days in the future relative to when the odds snapshot was applied (not relative to the simulated week number), could silently mismatch the week the admin thinks they're rehearsing. This is exactly the class of "developer/product mismatch" this workflow exists to catch before a dev agent ships it.

**Fix it by copying `build-submission-status.ts`'s pattern verbatim** — it is the most recently-shipped, already-reviewed instance of the exact same fix for a structurally identical function shape (season lookup → games lookup → week resolve → per-member data).

### Why AC2 (hard cron exclusion) over a "decoupled rehearsal cron"

`epics.md`'s Story 8.5 AC offers two options: "fire on admin-triggered 'simulate send'" **or** "respect a rehearsal schedule that is decoupled from production cron." Building a *second* cron/scheduler for rehearsal (e.g., a rehearsal-specific Vercel Cron route) would mean: (a) another `CRON_SECRET`-protected route with its own Eastern-window-equivalent gating logic to design from scratch, since a rehearsal's "week" is admin-advanced, not calendar-driven — there is no wall-clock analog to "Tuesday" for a 4-week rehearsal that might run in a single afternoon (per Story 8.2's whole premise); (b) meaningfully more surface area than this story's ROI justifies. Excluding test leagues from the **existing** cron entirely, and relying on the **already-shipped** manual send routes (now correctly week-resolved per AC1) is the **simpler, safer instance of the same "decoupled from production cron" requirement** — a rehearsal league literally never appears in a cron-driven send, satisfying "decoupled" as strongly as possible while reusing 100% of already-tested infrastructure.

### Why suppress (not redirect-to-test-domain)

`epics.md` requires "**at least one**" policy from: (a) send real emails to invited testers, (b) suppress + surface would-send, (c) route to a test domain. Policy (a) already works today (once AC1 fixes the week) via the existing manual send routes and Story 8.1's `[TEST]` subject/body labeling — no new code needed for it. Policy (b) is the one genuinely missing capability and directly serves both stated motivations ("avoid spamming during dry runs"). Policy (c) (redirect-to-test-domain) would require a **second** new env var (`TEST_LEAGUE_EMAIL_REDIRECT_TO`) and cross-validation logic (what happens if `redirect` mode is set but the address is missing/invalid — must fail *safe*, i.e. fall back to suppress rather than risk misdirected real sends) for a use case (deliverability testing against a controlled inbox) that policy (a) with a small real invited-tester group already substantially covers. **Deferred, not built** — if a future need for policy (c) is confirmed, add `TEST_LEAGUE_EMAIL_MODE=redirect` + `TEST_LEAGUE_EMAIL_REDIRECT_TO` as a follow-up; do not build it speculatively in this story.

### Known, accepted limitation: `get-weekly-email-status.ts` (not fixed in this story)

`src/lib/admin/get-weekly-email-status.ts` infers `pending` / `not_sent` / `skipped` states using **real Eastern wall-clock day/hour** comparisons (`isOnOrAfterEasternDayHour(now, 2, 21)`, etc. — see `eastern-window.ts`). For a rehearsal league whose simulated Week 2 might be viewed on a real Saturday afternoon, this card's status inference (used only for the **admin dashboard's read-only status display**, `AdminWeeklyEmailStatus.tsx` — not for any gating logic) will show a real-clock-derived `pending`/`not_sent` label that has no relationship to the rehearsal's simulated day. This is **purely cosmetic** — it does not block or corrupt any send (the "Send Now" / reminder buttons work regardless of what this card displays, and AC1's week-number fix already flows into it correctly since it calls `getTuesdayDigestData` internally). **Explicitly out of scope for this story** (not cited by any of `epics.md`'s three Story 8.5 ACs); note as a candidate `deferred-work.md` entry at closeout, in the same spirit as 8.3/8.4's "documented, accepted, revisit if it becomes an observed problem" items.

### Reuse — do NOT reinvent

| Need | Reuse |
|------|--------|
| Test-league-aware week resolution | `resolveActiveWeekNumber` (`src/lib/nfl/resolve-picks-week.ts`) — already exists, already correct, import only |
| `isTestLeague`-aware "can resolve without games yet" gate | Copy `canResolveActiveWeek` shape from `src/lib/admin/build-submission-status.ts:66-80` |
| Env-var ops-gate pattern (permissive default, trim/lowercase, unknown→safe) | `allowTestLeagues()` (`src/lib/league/allow-test-leagues.ts`) — same shape, new file (different default direction: unknown → `"send"` here vs. unknown → allow there, but same style) |
| `[TEST]` subject/body labeling | `formatEmailSubject` / `TEST_LEAGUE_EMAIL_BODY_NOTICE` (`src/lib/email/test-league-labeling.ts`, Story 8.1) — unchanged, still applies whenever a real send *does* happen for a test league |
| Circuit breaker / retry / concurrency | `circuit-breaker.ts` / `send-with-retry.ts` / `map-with-concurrency.ts` — untouched; suppress branch bypasses all three entirely (no send attempted, nothing to break or retry) |
| `LeagueWeekEmailConfig` upsert shape | Copy the existing `create`/`update` upsert block already in `sendTuesdayDigest` / `sendReminder` — do not invent a new persistence path for the suppressed case |
| Admin manual-send routes/UI | `.../email/tuesday-send`, `.../wednesday-reminder`, `.../thursday-reminder` + `AdminEmailComposer` / `AdminReminderControls` (Stories 6.2/6.3) — extend response shape only, do not fork or duplicate |
| Layout flex | MUI **`Stack`** preferred over `Box` (no new layout in this story beyond an `Alert` — existing components already use `Stack`) |

### Previous story intelligence

**Story 8.4 (simulated results, scoring/reveal)**

- Established the "audit result" pattern this story's AC1 extends: explicitly re-check every relevant read path for the `resolvePicksWeekNumber` vs. `resolveActiveWeekNumber` bug class rather than assuming a prior story's audit covered everything. 8.4 audited scoring/reveal; this story audits email — do not assume there are no more occurrences elsewhere (there may be; this story's scope is limited to the two files AC1 names).
- 8.4's "deliberate test-convention exception" precedent (`apply-simulation-week-results.test.ts`, justified because it protects a safety invariant) is directly reused to justify this story's new `send-tuesday-digest.test.ts` / `send-reminder.test.ts` (protecting "suppressed mode never calls Resend").
- 8.4 confirmed there is still no cron job anywhere for finalize/score — irrelevant to this story but reconfirms the codebase's general pattern of "admin-triggered action, not cron" for rehearsal-only paths, which is exactly this story's AC2/AC3 direction too.

**Story 8.3 (simulated odds/jailed)**

- `test-league-labeling.ts`'s `formatEmailSubject`/`TEST_LEAGUE_EMAIL_BODY_NOTICE` already exist and are already wired into both `send-tuesday-digest.ts` and `send-reminder.ts` — this story does **not** touch that file; it only adds a *gate in front of* the send call, which the labeling code never reaches when suppressed (nothing to prefix if nothing is sent).

**Story 8.1 (test league flag)**

- `allowTestLeagues()` established the "optional env toggle, not a secret, permissive-safe default, single well-documented `.env.example` block" pattern this story's `TEST_LEAGUE_EMAIL_MODE` follows structurally (though the safe-default *direction* differs: `allowTestLeagues` defaults to *permissive* because an accidental lockout blocks legitimate rehearsal work, whereas `TEST_LEAGUE_EMAIL_MODE` defaults to `"send"` because that is the **existing, unchanged** behavior for every current deploy — changing the default would be a silent behavior change for existing users, which is the actual thing to avoid here).

**Git pattern (recent, Stories 8.1–8.4):** focused commits per task group; colocated tests alongside every new pure helper; `deferred-work.md` touched only at closeout when a genuine new forward-looking finding exists (see Task 6).

### Deferred-work disposition for this story

Consulted `_bmad-output/implementation-artifacts/deferred-work.md` while planning.

| Item | Disposition |
|------|-------------|
| "Hobby ±1 hr negative-drift silent-skip risk" (pre-epic-6 spike / 7.4) | **Unrelated** — concerns production cron drift against real Tuesday 6pm ET; this story excludes test leagues from cron entirely (AC2), so rehearsal is unaffected by cron drift by construction |
| "Stale `outstandingCount` SSR prop in `AdminReminderControls`" (6.3/6.6) | **Not touched** — this story only adds a `suppressed` branch to the existing `handleSend`; the pre-existing SSR-staleness issue in the outstanding-count *display* is orthogonal and untouched |
| "`sentAt` DB upsert failure causes response/DB desync" (6.3) | **Same class, now also applies to the suppress branch's upsert** — if the suppress-branch upsert throws, the function will throw uncaught (same as today's real-send path); not newly introduced risk, just present in both branches now. Not fixed here, consistent with the pre-existing deferred item's own disposition ("address if operational correctness is later required") |
| Everything else in `deferred-work.md` | Unrelated to email/cron rehearsal — no action |

**New forward-looking item this story surfaces** (add to `deferred-work.md` at closeout if still true after implementation): the `get-weekly-email-status.ts` real-Eastern-clock-based status inference is cosmetically wrong for rehearsal leagues (see Dev Notes above) — not fixed in this story, not cited by any Story 8.5 AC.

### Testing requirements

1. **Unit:** `getTestLeagueEmailMode` (AC3) — default/unset/garbage → `"send"`; exact `"suppress"` (trim/case-insensitive) → `"suppress"`
2. **Unit:** `getTuesdayDigestData` / `getReminderData` (AC1) — existing suites updated (mock removal, see Task 1) plus a new test-league-simulated-week case per file, mirroring `build-submission-status.test.ts`'s pattern
3. **Unit:** `getActiveLeagueIds` (AC2) — new test asserting the `isTestLeague: false` filter is present in the Prisma `where` clause
4. **Unit:** `sendTuesdayDigest` / `sendReminder` (AC3/AC5) — new mocked-Resend tests: suppress-mode-never-calls-Resend (the critical safety proof), default-send-path-unchanged, production-league-ignores-suppress-mode
5. **Manual:**
   - Test league, simulation started, Week 1 active, `TEST_LEAGUE_EMAIL_MODE` unset → admin dashboard "Send Now" → real email arrives (Resend dashboard / inbox) targeting **Week 1** content (confirms AC1's fix — previously this might have shown a different/wrong week if `NflGame` rows for a later real week already existed from Story 3.9 sync)
   - Same league, set `TEST_LEAGUE_EMAIL_MODE=suppress` locally, restart dev server → click "Send Now" again for the next week → `Alert severity="info"` shows "would have reached N members," Resend dashboard shows **no** new send, `LeagueWeekEmailConfig.sentAt` is set (confirm via re-clicking → sees "already sent" state, i.e. `sentAt` displayed, not a repeat suppress log)
   - Wednesday/Thursday reminder buttons — same suppress behavior
   - Trigger a **production** cron route locally (`curl` with `CRON_SECRET`, inside the Eastern window if possible, or verify via code path) while a test league also has `preSeasonInitializedAt` set → confirm the test league does **not** appear in the cron's `processed` count and receives no email
   - Production league — unaffected regardless of `TEST_LEAGUE_EMAIL_MODE` value
6. Run **`npm test`** after adding/changing tests

### Project context reference

- Read `docs/project-context.md` before implementing — especially non-negotiable #1 (secrets/env vars stay server-only; `TEST_LEAGUE_EMAIL_MODE` is not a secret but is still read only in server modules, matching `allowTestLeagues()`'s pattern) and non-negotiable #9 (no **new** routes are added in this story, so no new rate-limit entries are needed — the three manual send routes already have their existing, unchanged rate-limit status).
- This story closes the loop on Epic 8's "safe to rehearse without touching production or spamming real inboxes" requirement; Story 8.2 supplied the clock, 8.3 supplied odds/jailed, 8.4 supplied results/scoring, this story makes the weekly email cycle rehearsal-safe. Story 8.6 (runbook) and 8.7 (delete/cleanup) remain after this story.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 8; Story 8.5]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR35–FR40 (email content/timing), NFR27/NFR32–NFR34 (delivery reliability/tracking)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Vercel Cron / Hobby constraints; test/rehearsal league cross-cutting concern]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Test/rehearsal leagues must be visually distinct (banner/chip); already satisfied by Story 8.1, reaffirmed not re-litigated here]
- [Source: `docs/project-context.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`]
- [Source: `_bmad-output/implementation-artifacts/8-4-simulated-game-results-and-scoring-reveal-cycle.md` — "audit result" precedent, deliberate-test-exception precedent]
- [Source: `_bmad-output/implementation-artifacts/8-3-simulated-odds-and-jailed-team-for-rehearsal.md` — `[TEST]` labeling, global-row design]
- [Source: `_bmad-output/implementation-artifacts/8-2-shortened-simulated-season-and-admin-driven-week-advancement.md` — `resolveActiveWeekNumber` introduced, simulation clock]
- [Source: `_bmad-output/implementation-artifacts/8-1-test-league-flag-labeling-and-optional-global-gates.md` — `allowTestLeagues()` pattern, `[TEST]` labeling]
- [Source: `_bmad-output/implementation-artifacts/6-2-tuesday-6-00-pm-league-email-content-and-admin-preview.md` — `sendTuesdayDigest`, `getTuesdayDigestData`, manual send route]
- [Source: `_bmad-output/implementation-artifacts/6-3-wednesday-and-thursday-reminders.md` — `sendReminder`, `getReminderData`, `AdminReminderControls`]
- [Source: `_bmad-output/implementation-artifacts/6-5-cron-routes-secrets-and-idempotent-weekly-orchestration.md` — cron routes, `getActiveLeagueIds`, Eastern-window gating]
- [Source: `_bmad-output/implementation-artifacts/7-4-performance-and-deployment-hardening.md` — circuit breaker, `maxDuration`, HTTP 500-on-failure cron contract]

## Change Log

- 2026-07-27: Story drafted (create-story workflow) — ready for dev.
- 2026-07-27: Implemented AC1–AC6 — simulation-aware email week resolution, cron test-league exclusion, TEST_LEAGUE_EMAIL_MODE suppress policy, admin UI surfacing, docs; 461 tests pass.
- 2026-07-28: Code review (bmad-code-review workflow) — 1 decision-needed, 4 patch, 3 defer, 11 dismissed. All decision/patch items resolved and fixed: `AdminEmailComposer` now aborts send on save failure; `sprint-status.yaml` comment corrected; misleading suppress-mode test names fixed in both send-function test files; suppress branches now skip the `sentAt` upsert when `wouldSendCount === 0` (parity with the real-send path, with new test coverage); File List corrected. 463 tests pass. Status → done.

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

(none)

### Completion Notes List

- AC1: `getTuesdayDigestData` / `getReminderData` now use `resolveActiveWeekNumber` with test-league `canResolveActiveWeek` bypass and optional `now` param.
- AC2: `getActiveLeagueIds` filters `league: { isTestLeague: false }`.
- AC3: New `getTestLeagueEmailMode()` helper; suppress branch in `sendTuesdayDigest` / `sendReminder` upserts sent timestamps without calling Resend.
- AC4: Manual send routes return `suppressed` / `wouldSendCount`; admin email/reminder cards show info Alert on suppress.
- AC5: Production leagues unchanged (passthrough week resolution; suppress gated on `isTestLeague`).
- AC6: `.env.example` and `docs/deployment.md` updated.
- Deferred: `get-weekly-email-status.ts` real-clock cosmetic gap documented in `deferred-work.md`.
- Tests: 461 passing (`npm test`).

### File List

- `.env.example`
- `docs/deployment.md`
- `docs/email-local-smoke-test-runbook.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `src/lib/cron/get-active-league-ids.ts`
- `src/lib/cron/get-active-league-ids.test.ts` (new)
- `src/lib/email/get-reminder-data.ts`
- `src/lib/email/get-reminder-data.test.ts`
- `src/lib/email/get-tuesday-digest-data.ts`
- `src/lib/email/get-tuesday-digest-data.test.ts`
- `src/lib/email/send-reminder.ts`
- `src/lib/email/send-reminder.test.ts` (new)
- `src/lib/email/send-tuesday-digest.ts`
- `src/lib/email/send-tuesday-digest.test.ts` (new)
- `src/lib/email/test-league-email-mode.ts` (new)
- `src/lib/email/test-league-email-mode.test.ts` (new)
- `src/app/api/leagues/[leagueId]/email/tuesday-send/route.ts`
- `src/app/api/leagues/[leagueId]/email/wednesday-reminder/route.ts`
- `src/app/api/leagues/[leagueId]/email/thursday-reminder/route.ts`
- `src/components/admin/AdminEmailComposer.tsx`
- `src/components/admin/AdminReminderControls.tsx`
