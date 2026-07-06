# Story 7.2: Structured Logging and Admin-Visible Health Signals

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a league admin,
I want errors and critical job failures visible somewhere trustworthy,
so that I trust automation (**NFR45–NFR47**, **NFR46**).

## Acceptance Criteria

### AC1 — Shared structured logger: `logEvent()`

**Given** `src/lib/logging/log-event.ts` exports `logEvent(event: LogEventInput): void`

**When** any server-side code calls `logEvent`

**Then** it emits **one JSON object per line** to the appropriate `console.*` method:

| `level` | Console method |
|---------|----------------|
| `info` | `console.info` |
| `warn` | `console.warn` |
| `error` | `console.error` |

**And** every emitted object includes at minimum:

```ts
type LogLevel = "info" | "warn" | "error";

type LogEvent = {
  level: LogLevel;
  timestamp: string;       // ISO 8601 UTC — always set by helper via new Date().toISOString()
  domain: "email" | "cron" | "api" | "webhook" | "scoring";
  route?: string;          // e.g. "/api/cron/tuesday-email"
  action?: string;         // e.g. "job_complete", "member_send_failed", "outside_window_skip"
  userId?: string;         // session user for authenticated API routes; omit for cron/webhook/system
  leagueId?: string;
  weekNumber?: number;
  code?: string;           // stable machine code, e.g. "CRON_OUTSIDE_WINDOW", "EMAIL_SEND_FAILED"
  message: string;
  context?: Record<string, unknown>;
};
```

**And** the helper **never** logs raw secrets, API keys, session tokens, invitation tokens, or full email addresses in `context` — use `redactSensitive(value)` from `src/lib/logging/redact-sensitive.ts` when context may contain PII (email → `***@domain.com` or omit; tokens → `[REDACTED]`)

**And** modules under `src/lib/logging/` include `import "server-only"`

**And** `src/lib/logging/log-event.test.ts` covers at minimum:

1. Required fields present on every emit (`level`, `timestamp`, `domain`, `message`)
2. `error` level routes to `console.error`
3. Email addresses in context are redacted
4. `timestamp` is valid ISO 8601

---

### AC2 — Migrate Epic 6 email log call sites to `logEvent()`

**Given** existing `[email]` console prefixes in:

- `src/lib/email/send-with-retry.ts`
- `src/lib/email/send-tuesday-digest.ts`
- `src/lib/email/send-reminder.ts`
- `src/lib/email/send-invitation-email.ts`
- `src/lib/email/resend-client.ts`

**When** each module logs send success, failure, retry, or config errors

**Then** it calls `logEvent()` with `domain: "email"` and an appropriate `action` / `code`

**And** existing log **semantics** are preserved (same events logged; only shape changes):

| Previous pattern | New `action` | Notes |
|------------------|--------------|-------|
| `[email] attempt N failed` | `send_retry_failed` | include `context: { attempt }` |
| `[email] daily cap exhausted` | `daily_cap_exhausted` | `code: "EMAIL_DAILY_CAP"` |
| `[email] tuesday digest member send failed` | `member_send_failed` | `code: "EMAIL_SEND_FAILED"` |
| `[email] tuesday digest sent` | `tuesday_digest_complete` | include sent/failed counts |
| `[email] {type} reminder member send failed` | `member_send_failed` | |
| `[email] {type} reminder sent` / `skipped — no outstanding` | `reminder_complete` / `reminder_skipped` | |
| `[email] invitation sent` / `send failed` | `invitation_sent` / `invitation_failed` | |
| `[email] RESEND_API_KEY is not configured` | `config_missing` | `code: "CONFIG_MISSING"` |

**And** `src/lib/email/send-with-retry.test.ts` is updated to assert structured log output (or mock `logEvent`) — tests must still pass

**And** do **not** add `import "server-only"` to email modules that lack it today unless you are already touching the file for logging migration (optional cleanup, not AC)

---

### AC3 — Migrate Epic 6 cron log call sites to `logEvent()`

**Given** cron route handlers:

- `src/app/api/cron/tuesday-email/route.ts`
- `src/app/api/cron/wednesday-reminder/route.ts`
- `src/app/api/cron/thursday-reminder/route.ts`

**When** cron logic runs

**Then** all existing `[cron]` logs use `logEvent()` with `domain: "cron"` and `route` set to the handler path

**And** the **`outside_window` early return** (currently silent — no log) emits:

```ts
logEvent({
  level: "info",
  domain: "cron",
  route: "/api/cron/tuesday-email", // or wednesday/thursday path
  action: "outside_window_skip",
  code: "CRON_OUTSIDE_WINDOW",
  message: "cron skipped — outside Eastern time window",
});
```

**And** job completion summaries use `action: "job_complete"` with counts in `context` (`processed`, `sent`, `skippedAlreadySent`, `skippedNoWeek`, `failed`)

**And** per-league errors use `action: "league_error"` or `action: "no_active_week"` with `leagueId` set

**And** HTTP response bodies and status codes are **unchanged** from Story 6.5 (including `200` when `failed > 0` — deferred to Story 7.4 per observability decision)

---

### AC4 — Weekly email status data layer: `getWeeklyEmailStatus`

**Given** `src/lib/admin/get-weekly-email-status.ts` exports:

```ts
export type EmailJobRowStatus =
  | { state: "sent"; sentAtIso: string }
  | { state: "skipped"; reason: "no_outstanding" }
  | { state: "pending" }
  | { state: "not_sent" };

export type WeeklyEmailStatus = {
  weekNumber: number | null;
  nflSeasonYear: number;
  tuesdayDigest: EmailJobRowStatus;
  wednesdayReminder: EmailJobRowStatus;
  thursdayReminder: EmailJobRowStatus;
};

export async function getWeeklyEmailStatus(input: {
  leagueId: string;
  outstandingCount: number;
  now?: Date; // injectable for tests
}): Promise<WeeklyEmailStatus>;
```

**When** called for a league

**Then** it resolves the active week via the same path as admin email flows (`getTuesdayDigestData` or equivalent — handle `NoActiveWeekError` / `LeagueNotFoundError` by returning `weekNumber: null` and all rows `pending`)

**And** it reads `LeagueWeekEmailConfig` for `(leagueId, nflSeasonYear, weekNumber)` selecting `sentAt`, `wednesdayReminderSentAt`, `thursdayReminderSentAt`

**And** **Tuesday digest** row logic:

| Condition | `EmailJobRowStatus` |
|-----------|---------------------|
| `sentAt != null` | `{ state: "sent", sentAtIso: sentAt.toISOString() }` |
| `sentAt == null` and Eastern `now` is **before end of Tuesday 9 PM ET window** (same day/hour bounds as cron: Tue, hours 17–21 ET) | `{ state: "pending" }` |
| `sentAt == null` and Eastern `now` is **on or after Wednesday 00:00 ET** | `{ state: "not_sent" }` |

**And** **Wednesday / Thursday reminder** row logic (null timestamp is ambiguous — see observability decision):

| Condition | Status |
|-----------|--------|
| `*ReminderSentAt != null` | `{ state: "sent", sentAtIso: … }` |
| `*ReminderSentAt == null` **and** `outstandingCount === 0` | `{ state: "skipped", reason: "no_outstanding" }` |
| `*ReminderSentAt == null` **and** `outstandingCount > 0` **and** Eastern `now` is **before** that reminder's cron window start (Wed 19:00 ET / Thu 17:00 ET) | `{ state: "pending" }` |
| `*ReminderSentAt == null` **and** `outstandingCount > 0` **and** Eastern `now` is **on or after** the day **after** that reminder's window (Thu 00:00 ET for Wed reminder; Fri 00:00 ET for Thu reminder) | `{ state: "not_sent" }` |

**And** `src/lib/admin/get-weekly-email-status.test.ts` covers with mocked Prisma + injected `now`:

1. Tuesday sent → `state: "sent"`
2. Tuesday null + Wednesday morning → `not_sent`
3. Wednesday reminder skipped when `outstandingCount === 0`
4. Wednesday reminder `not_sent` when outstanding > 0 and past window
5. No active week → `weekNumber: null`

**And** no live DB in tests

---

### AC5 — Admin UI: `AdminWeeklyEmailStatus` card

**Given** the league admin dashboard at `/leagues/[leagueId]/admin`

**When** an admin views the page

**Then** a read-only **"Email automation status"** card appears in the **right column** `Stack`, **below** `AdminReminderControls` and **above** the page-wide `AdminJailedVerification` section

**And** the card is implemented as `src/components/admin/AdminWeeklyEmailStatus.tsx` with `"use client"` (MUI `Paper` / `Alert` / theme `sx` — server/client boundary rule)

**And** the server page calls `getWeeklyEmailStatus({ leagueId, outstandingCount })` and passes the result as serializable props (ISO strings only — no `Date` objects across boundary)

**And** the card displays **Week N** subtitle when `weekNumber != null`; otherwise helper text: "Status appears once the season and schedule are active"

**And** three rows with MUI **`Alert`** severity mapping:

| Row status | Severity | Example label |
|------------|----------|---------------|
| `sent` | `success` | "Tuesday digest — Sent Tue 6:04 PM" (locale-formatted from `sentAtIso`) |
| `skipped` | `info` | "Wednesday reminder — Skipped (all picks submitted)" |
| `pending` | `info` | "Thursday reminder — Pending (scheduled)" |
| `not_sent` | `warning` | "Tuesday digest — Not sent" |

**And** UX copy aligns with admin trust theme [Source: `ux-design-specification.md` § Invisible Automation with Visible Confidence]: passive confirmation ("know it worked") without requiring action; `not_sent` uses warning to prompt manual send via existing `AdminEmailComposer` / `AdminReminderControls` above the card

**And** use **`Stack`** for layout (project convention)

**And** card is **read-only** — no buttons, no mutations (monitoring only)

---

### AC6 — Resend webhook route (NFR32 log-only)

**Given** `POST /api/webhooks/resend` at `src/app/api/webhooks/resend/route.ts`

**When** Resend delivers a webhook event

**Then** the handler verifies the **Svix signature** using headers `svix-id`, `svix-timestamp`, `svix-signature` and secret `process.env.RESEND_WEBHOOK_SECRET?.trim()`

**And** if `RESEND_WEBHOOK_SECRET` is missing or empty → respond **500** `{ error: { code: "CONFIG_ERROR", message: "Webhook secret not configured" } }` (fail-closed in production)

**And** if signature verification fails → respond **401** `{ error: { code: "UNAUTHORIZED", message: "Invalid webhook signature" } }`

**And** on valid events, log via `logEvent()` with `domain: "webhook"`, `route: "/api/webhooks/resend"`, `action` derived from event type (e.g. `email_delivered`, `email_bounced`), and `context` containing **non-sensitive** fields only (`emailId`, `eventType`, `to` redacted)

**And** respond **200** `{ received: true }` on success (Resend expects 2xx)

**And** add **`svix`** npm dependency for signature verification ([Resend webhook docs](https://resend.com/docs/dashboard/webhooks/introduction))

**And** add `RESEND_WEBHOOK_SECRET=""` to `.env.example` with comment: signing secret from Resend dashboard → Webhooks → endpoint

**And** route includes `import "server-only"`; **no** cookie session or CSRF (external provider callback)

**And** **no admin UI** for per-recipient delivery status (deferred post-MVP per observability decision)

---

### AC7 — `isInEasternWindow` unit tests

**Given** `src/lib/cron/eastern-window.test.ts`

**When** `npm test` runs

**Then** tests cover with **injected fixed `Date` values** (prefer `vi.useFakeTimers()` or explicit UTC instants):

1. Tuesday 6 PM ET inside Tue 17–21 window → `true`
2. Tuesday 4 PM ET outside window → `false`
3. Wednesday inside Wed 19–24 window → `true`
4. At least one **DST boundary** fixture (e.g. early November fallback week) documenting expected behavior

**And** tests do **not** depend on live `Date.now()` alone (avoid flake at window edges — deferred-work item from 3.10/6.5 reviews)

---

### AC8 — Ops runbook documentation

**Given** `docs/observability-ops-runbook.md` (new) **or** a clearly titled section added to an existing ops doc

**When** a deployer reads it

**Then** it documents the **Hybrid observability MVP** from `docs/observability-scope-decision.md`:

1. **Structured logs** — filter Vercel → Logs by `domain:"cron"` or `"email"`
2. **Weekly spot-check** — after Tue ~6 PM ET, Wed evening, Thu pre-deadline: verify admin card shows sent/skipped; if `not_sent`, check Vercel logs for `CRON_OUTSIDE_WINDOW` (Hobby drift) and use manual admin send routes
3. **NFR46 honest gap** — no automated pager at MVP; Resend dashboard for bounces
4. **Resend webhook setup** — create endpoint URL, set `RESEND_WEBHOOK_SECRET`, subscribe to `email.delivered` / `email.bounced`
5. **Deferred to 7.4** — non-200 cron on `failed > 0`, circuit breaker, scoring/deadline structured logging

**And** link to `docs/observability-scope-decision.md` as the authoritative scope record

---

### AC9 — Tests pass

**Given** all changes above

**When** `npm test` runs

**Then** all existing tests pass plus new tests in AC1, AC4, AC7

**And** update any tests that asserted raw `[email]` / `[cron]` string prefixes to assert `logEvent` behavior instead

---

## Tasks / Subtasks

- [x] Task 1: Structured logging foundation (AC: #1)
  - [x] Create `src/lib/logging/log-event.ts` + types
  - [x] Create `src/lib/logging/redact-sensitive.ts`
  - [x] Create `src/lib/logging/log-event.test.ts`
  - [x] Add `import "server-only"` to logging modules

- [x] Task 2: Migrate email modules (AC: #2)
  - [x] Replace `[email]` logs in five email modules listed in AC2
  - [x] Update `send-with-retry.test.ts` for new log shape

- [x] Task 3: Migrate cron routes (AC: #3)
  - [x] Replace `[cron]` logs in three cron routes
  - [x] Add `outside_window_skip` log on early return (currently silent)

- [x] Task 4: Weekly email status data layer (AC: #4)
  - [x] Create `get-weekly-email-status.ts` with Eastern-time inference helpers (reuse `isInEasternWindow` or shared ET wall-clock helper)
  - [x] Add colocated unit tests

- [x] Task 5: Admin UI card (AC: #5)
  - [x] Create `AdminWeeklyEmailStatus.tsx` (`"use client"`)
  - [x] Wire into `src/app/(app)/leagues/[leagueId]/admin/page.tsx` — fetch status server-side, pass props

- [x] Task 6: Resend webhook (AC: #6)
  - [x] `npm install svix`
  - [x] Create `src/app/api/webhooks/resend/route.ts`
  - [x] Update `.env.example`

- [x] Task 7: Eastern window tests (AC: #7)
  - [x] Create `src/lib/cron/eastern-window.test.ts`

- [x] Task 8: Ops runbook (AC: #8)
  - [x] Create `docs/observability-ops-runbook.md`

- [x] Task 9: Verification (AC: #9)
  - [x] Run `npm test`
  - [x] Manual smoke: trigger admin page load; optional local webhook POST with invalid signature → 401

### Review Findings

- [x] [Review][Patch] Tuesday digest stays "Pending" after Tue 9 PM ET cron window [`src/lib/admin/get-weekly-email-status.ts:29-41`] — fixed: `inferTuesdayDigestStatus` now returns `not_sent` on/after Tue 21:00 ET when `sentAt` is null.

- [x] [Review][Patch] Admin page swallows `getWeeklyEmailStatus` errors as all-pending [`src/app/(app)/leagues/[leagueId]/admin/page.tsx:78-87`] — fixed: logs via `logEvent` and shows warning Alert via `loadError` prop.

- [x] [Review][Defer] `getEasternWallClock` uses `toLocaleString` round-trip [`src/lib/cron/eastern-window.ts:16`] — pre-existing fragile ET conversion pattern; extended by new helpers but not introduced by this story.

- [x] [Review][Defer] `redactSensitive` redacts any string containing `@` [`src/lib/logging/redact-sensitive.ts:27`] — may over-redact non-email error text; acceptable MVP tradeoff.

---

## Dev Notes

### Authoritative scope decision — read first

**`docs/observability-scope-decision.md`** is the binding product/engineering decision for this story (output of `pre-epic-7-observability-scope-decision`). It selects **Hybrid (Option C)**:

| Layer | MVP |
|-------|-----|
| NFR45 structured logging | `logEvent()` JSON → Vercel logs |
| NFR47 admin visibility | Read-only `AdminWeeklyEmailStatus` card from existing `LeagueWeekEmailConfig` |
| NFR46 alerting | **Manual ops runbook** — not automated in 7.2 |
| NFR32 delivery tracking | Log-only Resend webhook — no admin per-recipient UI |

Do **not** expand into a general error log viewer, `system_job_runs` table, Axiom/Datadog, or scoring/deadline structured events — all explicitly deferred.

### What this story is (and is NOT)

- ✅ **In scope:** Unified structured logger; migrate `[email]`/`[cron]`; admin weekly email status card; Resend webhook log-only; `isInEasternWindow` tests; ops runbook.
- ❌ **Out of scope:** Automated Slack/PagerDuty alerts; cron non-200 on `failed > 0` (**7.4**); circuit breaker for Resend outage (**7.4**); scoring/pick-deadline structured logging (post-launch); admin error log viewer; per-recipient delivery UI; audit log for CSV export (**7.4**); real-time polling of `outstandingCount` (**deferred from 6.3**); `maxDuration` / cron timeout hardening (**7.4**).

### Architecture compliance

| Requirement | Implementation |
|-------------|----------------|
| Observability baseline | Vercel logs + structured JSON `console.*` [Source: `architecture.md` — Observability row] |
| No new paid vendors | $0 — no Axiom/Datadog at MVP |
| Server-only secrets | `RESEND_WEBHOOK_SECRET`, `CRON_SECRET` never in client |
| Error JSON shape | Webhook route uses `{ error: { code, message } }` [Source: `docs/project-context.md` § Errors] |
| Prisma singleton | `@/lib/db` only |
| DB schema | **None** — read existing `LeagueWeekEmailConfig` columns |

### Reuse — do NOT reinvent

| Existing module | Reuse for |
|-----------------|-----------|
| `src/lib/cron/eastern-window.ts` | Window bounds for cron + status inference (same Tue 17–21, Wed 19–24, Thu windows as Story 6.5) |
| `src/lib/cron/assert-cron-request.ts` | Cron auth — do not modify except if adding logs |
| `src/lib/email/get-tuesday-digest-data.ts` | Resolve active week + season year for status query |
| `src/app/api/leagues/[leagueId]/email/tuesday-config/route.ts` | Same `LeagueWeekEmailConfig` select fields — align with GET response shape |
| `src/components/admin/AdminReminderControls.tsx` | `outstandingCount` prop already on admin page — pass through to status card |
| `src/app/(app)/leagues/[leagueId]/admin/page.tsx` | Two-column layout from Story 6.6 — insert card in right column after reminders |
| Story 7.1 `AdminExportCsvButton` | Header row pattern — status card goes in right column, not header |

### Admin page layout (post-7.1)

```
[ h1 + AdminExportCsvButton ]

[ Left: submission status ]  [ Right column Stack:
                               Weekly Email (AdminEmailComposer)
                               Reminder Emails (AdminReminderControls)
                               Email automation status (NEW) ]

[ AdminJailedVerification — full width below columns ]

[ AdminAuditLog ]
```

[Source: `docs/observability-scope-decision.md` § Admin UI placement; Story 6.6 two-column admin layout]

### UX guidance — admin trust & monitoring

[Source: `ux-design-specification.md` § Invisible Automation with Visible Confidence]

> Administrator success hinges on trusting that automated operations execute correctly without manual intervention. Admin needs to "know it worked" without "doing the work."

[Source: `ux-design-specification.md` § Liberation → Automation Visibility]

> Passive visibility pattern: "Last action: Tuesday email sent to 14 participants at 6:00 PM" creates confidence without imposing obligation.

**Design constraints for `AdminWeeklyEmailStatus`:**

- **Read-only monitoring** — complements (does not duplicate) interactive `AdminEmailComposer` / `AdminReminderControls` above it
- Use MUI **`Alert`** with severity — not Destructive buttons; `not_sent` is a warning nudge, not an error crash
- **`Stack spacing={3}`** in right column — match existing email sections
- Snackbar polish for admin feedback deferred (6.6) — this card is static SSR props, no client fetch required
- 48px global button height deferred to 7.3/7.4 — N/A for read-only card

### Structured log schema — examples

[Source: `docs/observability-scope-decision.md` § Structured log schema proposal]

**Cron job complete:**

```json
{
  "level": "info",
  "timestamp": "2026-07-08T22:05:00.000Z",
  "domain": "cron",
  "route": "/api/cron/tuesday-email",
  "action": "job_complete",
  "message": "tuesday-email complete",
  "context": { "processed": 3, "sent": 2, "skippedAlreadySent": 1, "skippedNoWeek": 0, "failed": 0 }
}
```

**Outside window (NEW — currently silent):**

```json
{
  "level": "info",
  "domain": "cron",
  "route": "/api/cron/tuesday-email",
  "action": "outside_window_skip",
  "code": "CRON_OUTSIDE_WINDOW",
  "message": "cron skipped — outside Eastern time window"
}
```

### Reminder timestamp ambiguity

`send-reminder.ts` does **not** persist `wednesdayReminderSentAt` / `thursdayReminderSentAt` when all members have submitted (`sent === 0`). A null timestamp therefore means either "skipped legitimately" or "not yet sent / failed" — **`outstandingCount` from admin page disambiguates** [Source: `docs/observability-scope-decision.md` § Reminder row inference].

Do **not** add a DB column for skip reason in 7.2.

### Resend webhook implementation notes

- Install **`svix`** — Resend signs webhooks with Svix standard
- Verify raw request body (Next.js: `await request.text()` before JSON parse — signature is over raw bytes)
- Subscribe in Resend dashboard to at least: `email.delivered`, `email.bounced`, `email.complained`
- Local dev: use Resend CLI or ngrok; webhook optional in local `.env` (secret can be empty locally — route returns 500 if hit without config; acceptable)
- **No persistence** — log-only satisfies NFR32 "tracked and logged"

### Cron route windows (reference — do not change)

| Route | `isInEasternWindow` args |
|-------|--------------------------|
| `tuesday-email` | day `2` (Tue), hours `17–21` ET |
| `wednesday-reminder` | day `3` (Wed), hours `19–24` ET |
| `thursday-reminder` | day `4` (Thu), hours `17–21` ET |

### Deferred work — items owned by this story

| Deferred item | Action in 7.2 |
|---------------|---------------|
| NFR32 Resend webhooks unassigned (`deferred-work.md`) | AC6 webhook route |
| No cron observability in admin UI (`deferred-work.md`, pre-epic-8 checklist) | AC5 admin card |
| `outside_window` silent skip — drift detection blind spot | AC3 structured log |
| No `isInEasternWindow` unit tests (6.5 review) | AC7 |
| NFR46 MVP covers email only, not scoring/deadline | Document in runbook AC8 |
| Hobby ±1 hr cron drift | Admin card + `CRON_OUTSIDE_WINDOW` log + runbook |
| HTTP 200 when `failed > 0` | **Do not change** — 7.4 |
| No audit log for CSV export (7.1 review) | **Out of scope** — 7.4 |

### Previous story intelligence (7.1)

- Admin page already has `AdminExportCsvButton` in header row — do not move export; add status card in right column only
- Colocated `*.test.ts` with mocked Prisma is the project norm — follow `build-league-export-data.test.ts` patterns
- `import "server-only"` on new server lib modules
- Code review deferred CSV formula injection, anchor download error UX — unrelated to 7.2

### Git intelligence (recent commits)

- `1842cc8` — Story 7.1 export: `src/lib/export/*`, `AdminExportCsvButton`, GET export route
- `2498e62` — Pre-epic-7: `docs/observability-scope-decision.md` finalized; unblocks this story
- `b3ca782` — Story 6.6: admin two-column layout, league shell — preserve layout when adding card

### Project structure notes

```
src/lib/logging/
  log-event.ts
  log-event.test.ts
  redact-sensitive.ts

src/lib/admin/
  get-weekly-email-status.ts
  get-weekly-email-status.test.ts

src/components/admin/
  AdminWeeklyEmailStatus.tsx

src/app/api/webhooks/resend/
  route.ts

src/lib/cron/
  eastern-window.test.ts   # new

docs/
  observability-ops-runbook.md
```

### Testing standards

- Colocated Vitest unit tests for pure helpers (`log-event`, `get-weekly-email-status`, `eastern-window`)
- Mock `logEvent` or `console.*` spies — do not require live Vercel
- No route integration tests required for webhook (optional manual curl with bad signature)
- Run `npm test` before marking done [Source: `.cursor/rules/post-change-testing.mdc`]

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 7, Story 7.2]
- [Source: `_bmad-output/planning-artifacts/prd.md` — NFR32, NFR45–NFR47, NFR46]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Observability, Operations NFRs]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Admin trust, monitoring, automation visibility]
- [Source: `docs/observability-scope-decision.md` — **Primary implementation spec**]
- [Source: `_bmad-output/implementation-artifacts/pre-epic-7-observability-scope-decision.md` — Spike record]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — NFR32, cron monitoring, 6.5 items]
- [Source: `_bmad-output/implementation-artifacts/6-5-cron-routes-secrets-and-idempotent-weekly-orchestration.md` — Cron windows, idempotency]
- [Source: `_bmad-output/implementation-artifacts/7-1-admin-csv-export-of-full-league-snapshot.md` — Admin page patterns]
- [Source: `docs/project-context.md` — Cron Hobby constraints, lib layout]
- [Source: `prisma/schema.prisma` — `LeagueWeekEmailConfig` fields]

## Dev Agent Record

### Agent Model Used

Composer (Cursor)

### Debug Log References

- All 362 tests pass (`npm test`)

### Completion Notes List

- Implemented `logEvent()` + `redactSensitive()` with colocated unit tests (AC1)
- Migrated all `[email]` and `[cron]` call sites to structured JSON logging; added `outside_window_skip` on silent cron early returns (AC2–3)
- Added `getWeeklyEmailStatus()` with Eastern-time inference and 5 unit tests (AC4)
- Added read-only `AdminWeeklyEmailStatus` card on admin page right column below reminder controls (AC5)
- Added `POST /api/webhooks/resend` with Svix verification and log-only handling; installed `svix` dep (AC6)
- Added `eastern-window.test.ts` with fixed UTC fixtures including DST fallback week (AC7)
- Created `docs/observability-ops-runbook.md` documenting Hybrid MVP ops procedures (AC8)
- Code review fixes: Tue post-window `not_sent` inference; admin card `loadError` degraded state with structured log

### File List

- `src/lib/logging/log-event.ts` (new)
- `src/lib/logging/log-event.test.ts` (new)
- `src/lib/logging/redact-sensitive.ts` (new)
- `src/lib/cron/eastern-window.ts` (modified)
- `src/lib/cron/eastern-window.test.ts` (new)
- `src/lib/email/send-with-retry.ts` (modified)
- `src/lib/email/send-with-retry.test.ts` (modified)
- `src/lib/email/send-tuesday-digest.ts` (modified)
- `src/lib/email/send-reminder.ts` (modified)
- `src/lib/email/send-invitation-email.ts` (modified)
- `src/lib/email/resend-client.ts` (modified)
- `src/lib/admin/get-weekly-email-status.ts` (new)
- `src/lib/admin/get-weekly-email-status.test.ts` (new)
- `src/components/admin/AdminWeeklyEmailStatus.tsx` (new)
- `src/app/(app)/leagues/[leagueId]/admin/page.tsx` (modified)
- `src/app/api/cron/tuesday-email/route.ts` (modified)
- `src/app/api/cron/wednesday-reminder/route.ts` (modified)
- `src/app/api/cron/thursday-reminder/route.ts` (modified)
- `src/app/api/webhooks/resend/route.ts` (new)
- `docs/observability-ops-runbook.md` (new)
- `.env.example` (modified)
- `package.json` (modified — svix dependency)
- `package-lock.json` (modified)

### Change Log

- 2026-07-06: Story 7.2 implementation — structured logging, admin email status card, Resend webhook, ops runbook
- 2026-07-06: Code review — fixed Tue post-window status inference and admin load-error handling
