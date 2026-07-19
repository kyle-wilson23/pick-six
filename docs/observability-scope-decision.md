# Observability scope decision (Pre-Epic 7 spike)

**Investigation:** July 2026 (architecture review + Epic 6 logging inventory). **Vendor pricing and tiers change** — confirm on each vendor's site before contracts or capacity planning.

## What we optimized for

| Priority | Rationale |
|----------|-----------|
| **Max free tier (production-viable)** | Architecture constraint: "max free tier" for all external services at MVP scale. Observability must not require paid Axiom/Datadog/Vercel Pro unless volume or alerting needs justify it. |
| **NFR alignment (NFR45–NFR47, NFR46)** | NFR45 requires structured error logs with context. NFR47 requires admin visibility into health. NFR46 requires immediate alerts on critical failures — must be addressed honestly at MVP. |
| **Admin trust (UX spec)** | Administrator success hinges on trusting automated operations. Admins should "know it worked" without "doing the work" — especially for weekly email automation (highest operational risk post-Epic 6). |
| **Implementation effort** | Epic 6 already persists email send timestamps per league/week. Prefer surfacing existing DB state over building a general-purpose log viewer or external vendor integration. |

## Options investigated

| Option | Cost | NFR45 | NFR46 | NFR47 | Effort | Pick-six fit |
|--------|------|-------|-------|-------|--------|--------------|
| **A: Log-only MVP** (Vercel dashboard) | ✅ $0 Hobby | ✅ Structured JSON logs searchable in Vercel → Logs | ⚠️ No automatic alerts on Hobby — manual log review after cron windows | ❌ Requires Vercel project access; no in-app admin UI | Low | ⚠️ Satisfies NFR45 only; Kyle must have Vercel access to spot-check |
| **B: Admin health panel** (in-app) | ✅ $0 | ✅ Structured logging + persist last N job outcomes | ⚠️ Visibility ≠ alerting; still need external alert for true NFR46 | ✅ Admin sees email/cron status on `/admin` | Medium | ✅ Strong NFR47; risk of scope creep into full log viewer |
| **C: Hybrid** (logs + minimal admin card) | ✅ $0 | ✅ Unified structured logger for all routes | ⚠️ Log-based + manual ops runbook for MVP | ✅ Weekly email status card reads existing `league_week_email_configs` | Medium-low | ✅ **Selected** — best balance of free tier, admin trust, and effort |
| **D: External dashboard** (Axiom / Sentry / Datadog) | ⚠️ Free tiers exist but add vendor dependency | ✅ Rich search/alerting | ✅ Possible with free tier limits | ⚠️ Linked URL from admin, not native UI | Medium | ❌ Premature for ≤14-user MVP; architecture says "add only if needed" |

## Recommendation: Hybrid (Option C)

**Rationale:**

- **NFR47 at MVP scope:** Epic 6 already persists `sentAt`, `wednesdayReminderSentAt`, and `thursdayReminderSentAt` on `LeagueWeekEmailConfig`. A read-only "Weekly email status" card on `/leagues/{leagueId}/admin` satisfies NFR47 for the highest-risk automation (Tuesday digest + Wed/Thu reminders) without building a general error log viewer.
- **NFR45:** Introduce a shared structured logger in `src/lib/logging/` that emits JSON payloads to `console.info` / `console.error`. Vercel captures these in project logs. Migrate existing `[email]` and `[cron]` call sites to the helper — preserves searchability while standardizing fields.
- **NFR46 honest MVP stance:** True immediate alerting (PagerDuty, Slack, email-on-failure) is not free at reliable quality on Vercel Hobby. MVP accepts **documented manual ops**: Kyle spot-checks Vercel function logs after Tue/Wed/Thu cron windows and uses the admin card for per-league send confirmation. Resend dashboard covers bounced emails without webhooks.
- **Max free tier:** No new paid vendors. No Vercel Pro log drains required at MVP scale.
- **Scope control:** Admin UI shows **email/cron job outcomes only** — not scoring errors, pick deadline failures, or a full log tail. General errors remain in Vercel logs (NFR45).

**Why not log-only (Option A)?**
NFR47 explicitly requires admin visibility. Requiring Vercel dashboard access for every league admin violates the UX trust theme and excludes admins who are not deployers.

**Why not full admin panel (Option B)?**
A general-purpose error viewer duplicates Vercel logs, adds DB persistence for log events, and risks scope creep. The hybrid card targets the automation admins care about most.

**Why not external observability (Option D)?**
Architecture committed to "Vercel logs + structured console/JSON — add Axiom/Datadog only if needed." At ≤14 participants and ≤10 leagues, manual review plus structured logs is sufficient. Revisit when league count grows or proactive alerting becomes a launch blocker.

## Selected approach summary

| Layer | MVP decision |
|-------|--------------|
| **Structured logging (NFR45)** | Shared `logEvent()` helper; JSON payload on every `[email]` / `[cron]` / route error |
| **Admin visibility (NFR47)** | `AdminWeeklyEmailStatus` card on league admin page — read-only from `LeagueWeekEmailConfig` |
| **Alerting (NFR46)** | Manual ops runbook + Resend dashboard; no automated pager at MVP |
| **NFR32 webhooks** | Log-only `POST /api/webhooks/resend` in Story 7.2; no admin UI for per-recipient delivery |
| **Cron drift monitoring** | Documented manual check; optional 7.2 enhancement: flag missing timestamps after expected windows |
| **HTTP when `failed > 0`** | **Resolved by 7.4** — cron returns **500** when `failed > 0`; **200** for success / `outside_window` |

## Structured log schema proposal

All application and cron logs should emit a single JSON object per line (Vercel parses `console.*` arguments):

```typescript
type LogLevel = "info" | "warn" | "error";

type LogEvent = {
  level: LogLevel;
  timestamp: string;       // ISO 8601 UTC, e.g. new Date().toISOString()
  domain: "email" | "cron" | "api" | "webhook" | "scoring";
  route?: string;          // e.g. "/api/cron/tuesday-email"
  action?: string;         // e.g. "tuesday_digest_send", "member_send_failed"
  userId?: string;         // NFR45 "user" context — session user for API routes; omit for cron/system
  leagueId?: string;
  weekNumber?: number;
  code?: string;           // stable machine code, e.g. "CRON_OUTSIDE_WINDOW"
  message: string;         // human-readable summary
  context?: Record<string, unknown>;  // non-sensitive extras (counts, memberId, etc.)
};
```

**NFR45 field mapping:** AC minimum fields (`level`, `timestamp`, `route`, `leagueId?`, `code?`, `message`, `context?`) are covered; `domain` and `action` extend searchability; `userId` satisfies the PRD "user" requirement for authenticated routes. Cron, webhook, and startup-guard events omit `userId`.

**Example — cron summary (replaces current `[cron] tuesday-email complete`):**

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

**Example — email member failure (replaces current `[email] tuesday digest member send failed`):**

```json
{
  "level": "error",
  "timestamp": "2026-07-08T22:04:12.000Z",
  "domain": "email",
  "route": "/api/cron/tuesday-email",
  "action": "member_send_failed",
  "leagueId": "clx…",
  "weekNumber": 7,
  "code": "EMAIL_SEND_FAILED",
  "message": "tuesday digest member send failed",
  "context": { "membershipId": "clm…", "error": "503 unavailable" }
}
```

**Migration path from existing prefixes:**

| Current pattern | Location | Maps to |
|-----------------|----------|---------|
| `[email] …` | `send-with-retry.ts`, `send-tuesday-digest.ts`, `send-reminder.ts`, `send-invitation-email.ts` | `domain: "email"`, `action` derived from message |
| `[cron] …` | `tuesday-email`, `wednesday-reminder`, `thursday-reminder` routes | `domain: "cron"`, `route` set to handler path |
| Early return `{ reason: "outside_window" }` (no log today) | All three cron routes, before league loop | `domain: "cron"`, `action: "outside_window_skip"`, `code: "CRON_OUTSIDE_WINDOW"` — **required for drift detection** |
| `console.error` (uncaught route failures) | Various API routes | `domain: "api"`, add `route` and `userId` from session when available |
| `[email] RESEND_API_KEY…` | `resend-client.ts` | `domain: "email"`, `code: "CONFIG_MISSING"` |

**Backward compatibility:** During migration, the helper may emit both the legacy prefix string and structured JSON in the `message` field for one sprint, then drop prefixes once Vercel log filters are updated.

## NFR32 (Resend webhooks) — scope decision

| Approach | Owner | Decision |
|----------|-------|----------|
| Defer entirely | — | ❌ Leaves NFR32 partially unmet |
| **Log-only webhook route** | **Story 7.2** | ✅ **In scope** — `POST /api/webhooks/resend`, verify Svix signature, log `email.delivered` / `email.bounced` events |
| Admin UI delivery status | Story 7.2+ | ❌ **Deferred** — per-recipient delivery state in admin UI is high effort; Resend dashboard suffices at MVP |

**Rationale:** Log-only webhook satisfies NFR32 "tracked and logged" without DB schema for delivery events. Admin per-recipient status deferred until post-launch if deliverability complaints arise.

## NFR46 alerting — honest MVP stance

True "immediate alerts" (PagerDuty, Slack bot, email-on-failure) require either paid tiers or unreliable free-tier limits.

**MVP decision: accept manual review** with documented ops runbook:

1. **After each cron window** (Tue ~6 PM ET, Wed evening, Thu ~1 hr before deadline): Kyle checks Vercel → Functions → Logs filtered by `domain:"cron"` OR reviews the admin weekly email status card per league.
2. **Resend dashboard:** Bounced/complained emails visible without webhook integration.
3. **Admin card:** Missing `sentAt` / reminder timestamps after expected window → visual "Not sent" state prompts manual admin send via existing composer controls.
4. **Resolved by 7.4:** Cron returns non-200 (`500`) when `failed > 0` for free external uptime monitors. Resend circuit breaker (`EMAIL_CIRCUIT_OPEN` after 3 consecutive failures). Monitor setup: [deployment.md](./deployment.md).

**Post-MVP triggers to add automated alerting:**

| Trigger | Action |
|---------|--------|
| Active leagues exceed ~10 | Evaluate Axiom free tier (500 GB/month) + Vercel log drain |
| Missed weekly send in production season | Implement cron non-200 on `failed > 0` + external monitor |
| Kyle cannot reliably spot-check logs | Resend webhook + optional Slack webhook on `email.bounced` |

## Cron drift / missed-send detection

**Problem:** Vercel Hobby cron has ±1 hour precision. Negative drift can cause `outside_window` skip with no retry that week. Idempotency `sentAt` flags cannot distinguish "not yet sent" from "skipped by time gate."

**MVP decision:**

| Detection | Approach |
|-----------|----------|
| **Per-league send status** | Admin card shows timestamp or "Not sent" for current week — admin can manually trigger send |
| **Cron route summary** | Structured log on `outside_window` early return (`action: "outside_window_skip"`) plus per-league job summaries |
| **Automated alert** | ❌ Deferred — document in ops runbook: if no `sentAt` by Wed 9 AM ET, investigate Vercel logs for `outside_window` |
| **External cron fallback** | Remains documented in `docs/email-provider-decision.md`; not implemented in 7.2 |

**Owner:** Story 7.2 implements admin card, structured logging (including `outside_window` path), and `isInEasternWindow` unit tests; Story 7.4 returns non-200 on `failed > 0` and documents external monitors.

## Story 7.2 handoff

Story 7.2 ("Structured logging and admin-visible health signals") implements this decision. Boundaries below.

### In scope for Story 7.2

| Deliverable | Details |
|-------------|---------|
| **`src/lib/logging/log-event.ts`** | Shared helper implementing schema above; unit tests for shape and redaction |
| **Migrate `[email]` call sites** | `send-with-retry.ts`, `send-tuesday-digest.ts`, `send-reminder.ts`, `send-invitation-email.ts`, `resend-client.ts` |
| **Migrate `[cron]` call sites** | `tuesday-email`, `wednesday-reminder`, `thursday-reminder` route handlers — including structured log on `outside_window` early return (currently silent) |
| **`src/lib/admin/get-weekly-email-status.ts`** | Read-only query: current week's `LeagueWeekEmailConfig` timestamps + `outstandingCount` for reminder skip inference |
| **`AdminWeeklyEmailStatus.tsx`** | Client component; MUI card showing Tue/Wed/Thu send status for active week |
| **Admin page integration** | Place card in right column of `/leagues/{leagueId}/admin`, below `AdminReminderControls` (Story 6.6 two-column layout) |
| **`POST /api/webhooks/resend`** | Svix signature verification; log delivery/bounce events (NFR32 log-only) |
| **Ops runbook section** | Add "Weekly observability spot-check" to deployment/ops docs |
| **`isInEasternWindow` unit tests** | DST/fixed-UTC test baseline in `src/lib/cron/eastern-window.test.ts` |

### DB schema changes

**None required for MVP hybrid.** Read existing `LeagueWeekEmailConfig` columns:

- `sentAt` — Tuesday digest
- `wednesdayReminderSentAt`
- `thursdayReminderSentAt`

**Optional 7.2 stretch (not required for AC):** Add `lastCronSummaryJson` column or `system_job_runs` table if cron-level aggregates (processed/failed counts) must persist beyond Vercel log retention. **Recommendation:** defer — Vercel logs + config timestamps are sufficient at MVP.

### New routes / files anticipated

```
src/lib/logging/
  log-event.ts
  log-event.test.ts
  redact-sensitive.ts          # strip emails/tokens from context (if needed)

src/lib/admin/
  get-weekly-email-status.ts
  get-weekly-email-status.test.ts

src/components/admin/
  AdminWeeklyEmailStatus.tsx   # "use client" — MUI card

src/app/api/webhooks/resend/
  route.ts                     # POST — Svix verify + log

docs/
  observability-ops-runbook.md # or section in existing deployment doc
```

### Admin UI placement

On `/leagues/{leagueId}/admin`, right column (`Stack spacing={3}`), **after** `AdminReminderControls`:

```
Weekly Email          ← existing AdminEmailComposer
Reminder Emails       ← existing AdminReminderControls
Email automation status  ← NEW AdminWeeklyEmailStatus (read-only)
```

Card content (per active week):

| Row | Source | Display |
|-----|--------|---------|
| Tuesday digest | `sentAt` | Sent {relative time} / Not sent |
| Wednesday reminder | `wednesdayReminderSentAt` + `outstandingCount` | See inference rules below |
| Thursday reminder | `thursdayReminderSentAt` + `outstandingCount` | See inference rules below |

**Reminder row inference** (`send-reminder.ts` does not persist timestamps when all members have submitted — null is ambiguous):

| Condition | Display |
|-----------|---------|
| `*ReminderSentAt` is set | Sent {relative time} |
| `*ReminderSentAt` is null **and** `outstandingCount === 0` | Skipped (no outstanding) — info severity |
| `*ReminderSentAt` is null **and** `outstandingCount > 0` after expected send day | Not sent — warning severity |
| `*ReminderSentAt` is null **and** `outstandingCount > 0` before expected send day | Pending — neutral/info (cron not yet due) |

Pass `outstandingCount` from the admin page (already computed for `AdminReminderControls`) into `AdminWeeklyEmailStatus` — no new DB column required.

Use MUI `Alert` severity: success when sent, warning when not sent after expected day, info when skipped legitimately.

### Acceptance criteria mapping (Epic 7.2)

| Epic AC | 7.2 implementation |
|---------|-------------------|
| Structured logs include timestamp, route, non-sensitive context (NFR45) | `logEvent()` used in email + cron routes |
| Admin UI or linked dashboard shows recent failures (NFR47) at MVP scope | `AdminWeeklyEmailStatus` card — email job status per week |
| NFR46 immediate alerts | Documented gap + ops runbook; not automated in 7.2 |
| NFR32 delivery tracking | Webhook route logs events; no admin UI |

### Explicit out-of-scope for Story 7.2 (defer)

| Item | Target |
|------|--------|
| General-purpose admin error log viewer | Post-launch / external vendor |
| Per-recipient Resend delivery status in admin UI | Post-launch |
| Automated Slack/PagerDuty alerting | Post-MVP or when league count grows |
| `system_job_runs` DB table | Optional; defer unless log retention insufficient |
| Cron returns non-200 when `failed > 0` | **Resolved by 7.4** |
| Circuit breaker for Resend outage | **Resolved by 7.4** |
| `isInEasternWindow` unit tests | **Story 7.2** — DST/fixed-UTC test baseline for `src/lib/cron/eastern-window.ts` |
| Axiom/Datadog/Sentry integration | Post-MVP trigger table above |
| Scoring job structured logging | **Out of scope for 7.4** — post-launch |
| Pick deadline enforcement structured events | Post-launch |

## When to re-open observability scope

| Trigger | Action |
|---------|--------|
| Admin card insufficient — admins need full error history | Spike admin log viewer or Axiom free tier |
| Production missed weekly send during real season | External monitor already documented (7.4); verify alert fires on 500 |
| League count exceeds ~10 active | Evaluate log volume and Axiom integration |
| NFR46 becomes launch blocker | Add Resend bounce webhook → Slack (free tier) |
| Vercel Hobby log retention insufficient | Add `system_job_runs` table or upgrade to Pro log drain |

## Sources

- `_bmad-output/implementation-artifacts/epic-6-retro-2026-07-05.md` — observability action items mandating this spike
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — pre-epic-7 blockers
- `_bmad-output/planning-artifacts/epics.md` — Story 7.2 acceptance criteria
- `_bmad-output/planning-artifacts/prd.md` — NFR45–NFR47, NFR32, NFR46
- `_bmad-output/planning-artifacts/architecture.md` — Observability row ("Vercel logs + structured console/JSON")
- `_bmad-output/planning-artifacts/ux-design-specification.md` — Admin automation trust theme
- `_bmad-output/implementation-artifacts/deferred-work.md` — NFR32, cron monitoring, 6.5 review items
- `docs/email-provider-decision.md` — Spike doc format reference; cron drift context
- `docs/email-local-smoke-test-runbook.md` — Epic 6 manual verification baseline
- Epic 6 logging inventory — `[email]` / `[cron]` prefixes in `src/lib/email/*`, `src/app/api/cron/*`
- [Vercel Logs](https://vercel.com/docs/observability/logs) — Hobby tier log access
- [Resend webhooks](https://resend.com/docs/dashboard/webhooks/introduction) — Svix signature verification
- [Axiom pricing](https://axiom.co/pricing) — free tier reference, verified July 2026
