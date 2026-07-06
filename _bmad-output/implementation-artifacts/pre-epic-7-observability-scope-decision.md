# Pre-Epic 7: Observability Scope Decision

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Context

Mandated by the Epic 6 retrospective (2026-07-05) and captured in `sprint-status.yaml` as a blocking pre-condition before Story 7.2 spec:

> `pre-epic-7-observability-scope-decision` — one-page decision before 7.2 spec: log-only MVP vs admin UI health panel (mirrors pre-epic-6 spike pattern)

**Blocking relationship:** Story 7.2 ("Structured logging and admin-visible health signals") cannot have its spec written until the MVP observability scope is decided. Epic 6 retro explicitly recommends replicating the **pre-epic integration spike** pattern that unlocked Epic 6.

**Depends on:** `pre-epic-7-manual-email-flow-smoke-test` should complete first — observability design assumes email flows are manually verified and log prefixes (`[email]`, `[cron]`) are understood.

## Problem

Epic 7 Story 7.2 must satisfy **NFR45–NFR47** and **NFR46**:

| NFR | Requirement | Current state (post-Epic 6) |
|-----|-------------|----------------------------|
| NFR45 | Errors logged with context (timestamp, user, action) | Partial — `[email]` and `[cron]` console prefixes exist; no unified schema |
| NFR46 | Critical failures generate immediate alerts | Not implemented — no alerting pipeline |
| NFR47 | Admin visibility into system health and recent errors | Not implemented — no admin UI |

Architecture committed to: **"Vercel logs + structured console/JSON logging"** with **"add Axiom/Datadog only if needed"** (`architecture.md`).

Story 7.2 AC is intentionally vague:

> admin UI **or linked dashboard** shows recent failures at MVP scope (e.g., last email job status)

Before writing the 7.2 implementation spec, the team must decide:

1. **Log-only MVP** — structured JSON logs in Vercel dashboard; admins use Vercel log search (no in-app UI)
2. **Admin health panel** — in-app surface on admin dashboard showing recent email/cron failures
3. **Hybrid** — log-only for most errors + minimal admin panel for weekly email job status only
4. **External dashboard** — Axiom/Datadog free tier with linked URL from admin (violates "max free tier" unless free tier sufficient)

Also unresolved from deferred work:

- **NFR32** Resend webhooks (delivery confirmation) — owner unassigned; likely 7.2 or adjacent
- **Hobby cron drift monitoring** — alert when weekly send skipped (`outside_window` + no retry)
- **HTTP 200 with `failed > 0`** on cron routes — monitoring blind spot

## Pre-researched Findings

> Research conducted during story creation (July 2026). Verify vendor pricing at decision time.

### Option A: Log-only MVP (Vercel dashboard)

| Aspect | Assessment |
|--------|------------|
| **Cost** | ✅ $0 on Vercel Hobby — logs included |
| **NFR45** | ✅ Structured `console.info/error` with JSON payloads — searchable in Vercel → Logs |
| **NFR46** | ⚠️ No automatic alerts on Hobby — manual log review after cron windows |
| **NFR47** | ❌ No in-app admin visibility — requires Vercel project access |
| **Implementation effort** | Low — standardize log shape in `src/lib/logging/`; no new UI |
| **Epic 6 fit** | `[email]` and `[cron]` prefixes already exist — extend to shared helper |

**Mitigation for NFR46/47:** Document weekly manual log spot-check in runbook; defer alerts to post-MVP or external free tier.

### Option B: Admin health panel (in-app)

| Aspect | Assessment |
|--------|------------|
| **Cost** | ✅ $0 — reads from DB or in-memory ring buffer |
| **NFR45** | ✅ Same structured logging + persist last N job outcomes to DB |
| **NFR46** | ⚠️ In-app panel is visibility, not alerting — still need external alert for true NFR46 |
| **NFR47** | ✅ Admin sees last email send status per league/week on `/admin` |
| **Implementation effort** | Medium — new `system_job_runs` table or extend `league_week_email_configs`; admin UI component |
| **UX fit** | Aligns with UX spec admin trust theme — "know it worked without doing the work" |

**Scope control:** Panel shows **email/cron job outcomes only** at MVP — not full error log viewer.

### Option C: Hybrid (recommended candidate)

| Aspect | Assessment |
|--------|------------|
| **Logs** | Unified structured logger for all routes (NFR45) |
| **Admin UI** | Minimal "Weekly email status" card on league admin — last Tuesday/Wed/Thu send timestamps + failed counts from existing `league_week_email_configs` columns |
| **Alerts** | Log-based only for MVP; document NFR46 gap; optional Resend webhook in 7.2 stretch |
| **Cost** | ✅ $0 |
| **Effort** | Medium-low — mostly surfaces **existing DB state** (sentAt, wednesdayReminderSentAt, thursdayReminderSentAt) + cron summary logs |

**Rationale:** Epic 6 already persists send timestamps per league/week. An admin card reading that data satisfies NFR47 for the highest-risk automation (weekly emails) without building a general-purpose log viewer. General errors remain in Vercel logs (NFR45).

### Option D: External observability (Axiom / Datadog / Sentry)

| Provider | Free tier | Pick-six fit |
|----------|-----------|--------------|
| **Axiom** | 500 GB/month ingest (generous) | ⚠️ Vercel integration exists; adds vendor dependency |
| **Sentry** | 5k errors/month | ⚠️ Good for exceptions; less for cron job summaries |
| **Datadog** | Limited free | ❌ Overkill for MVP |

Architecture says **"add only if needed"** — premature for ≤14 user MVP unless Kyle wants proactive alerting before first real season.

### NFR32 (Resend webhooks) — scope decision needed

| Approach | Owner | Effort |
|----------|-------|--------|
| Defer entirely | — | 0 — delivery tracked via Resend dashboard manually |
| Log-only webhook route | Story 7.2 | Medium — `POST /api/webhooks/resend`, verify signature, log events |
| Admin UI delivery status | Story 7.2+ | High — per-recipient delivery state |

**Recommendation:** Include **log-only webhook route** in 7.2 scope if hybrid chosen; admin UI for delivery status deferred.

### NFR46 "immediate alerts" — honest MVP stance

True alerting (PagerDuty, email on failure, Slack) is **not free** at reliable quality. MVP options:

1. **Accept manual review** — Kyle checks Vercel logs after Tue/Wed/Thu cron windows (documented in ops runbook)
2. **Resend dashboard** — bounced emails visible without webhook
3. **Cron route returns non-200 when `failed > 0`** — enables external uptime monitor (deferred from 6.5; decide in 7.2)
4. **Vercel Pro** — log drains to external service (cost)

Document chosen stance explicitly in decision doc.

## Acceptance Criteria

1. **Decision document created**

   **Given** this spike is complete  
   **Then** `docs/observability-scope-decision.md` exists and contains:
   - Options table (log-only, admin panel, hybrid, external) with assessment
   - **Selected approach** with rationale tied to NFR45–NFR47, NFR46 honest MVP stance, and "max free tier" constraint
   - Story 7.2 scope boundaries: what 7.2 **will** implement vs defer to 7.4 or post-launch
   - NFR32 webhook decision (in/out of 7.2)
   - NFR46 alerting decision (manual vs automated)
   - Structured log schema proposal (fields: `level`, `timestamp`, `route`, `leagueId?`, `code?`, `message`, `context?`)
   - Mapping from existing `[email]` / `[cron]` prefixes to unified logger
   - Cron drift monitoring decision (Hobby ±1h skip detection)
   - Sources section with architecture/PRD references and research date

2. **Story 7.2 spec inputs documented**

   **Given** the decision doc is written  
   **Then** it includes a **"Story 7.2 handoff"** section listing:
   - Exact admin UI components (if any) and which pages they appear on
   - DB schema changes (if any) vs read-only use of existing tables
   - New routes/files anticipated
   - Explicit out-of-scope list for 7.2

3. **Deferred work updated**

   **Given** NFR32 and cron monitoring owners are decided  
   **Then** `deferred-work.md` entries for "NFR32 webhook owner unassigned" and "Monitoring alert for missed weekly sends" are updated with owner + target story

4. **No regressions**

   **Given** this spike is documentation-only (no code changes)  
   **When** `npm test` runs  
   **Then** all tests pass

5. **Sprint status updated**

   **Given** the decision doc is written  
   **Then** `pre-epic-7-observability-scope-decision` is marked `done` in `sprint-status.yaml`

## Tasks / Subtasks

- [x] **Create `docs/observability-scope-decision.md`** (primary deliverable)
  - [x] "What we optimized for" criteria table (free tier, NFR alignment, admin trust, implementation effort)
  - [x] Options A–D comparison table
  - [x] Record selected approach (recommend **Hybrid** unless Kyle chooses otherwise during dev-story)
  - [x] Structured log schema + migration path from `[email]`/`[cron]` prefixes
  - [x] NFR32 webhook in/out decision
  - [x] NFR46 alerting stance for MVP
  - [x] Cron drift / missed-send detection decision
  - [x] Story 7.2 handoff section (files, UI, schema, AC mapping)
  - [x] Sources section

- [x] **Update `deferred-work.md`** (AC: #3)
  - [x] Assign NFR32 webhook owner → Story 7.2 (or explicit defer)
  - [x] Assign missed weekly send monitoring → Story 7.2 (or explicit manual ops)

- [x] **Run `npm test`** — confirm no code changes; sanity check

- [x] **Mark story done in `sprint-status.yaml`**

### Review Findings

- [x] [Review][Patch] Wed/Thu "Skipped (no outstanding)" undetectable from DB timestamps alone [`docs/observability-scope-decision.md:224-227`] — fixed: handoff now specifies reminder inference via `outstandingCount` + expected-day rules.
- [x] [Review][Patch] Story file Status still `review` while sprint-status marks `done` [`pre-epic-7-observability-scope-decision.md:3`] — fixed: Status synced to `done`.
- [x] [Review][Patch] Log schema omits NFR45 `user` context [`docs/observability-scope-decision.md:60-71`] — fixed: added optional `userId` field and NFR45 mapping note.
- [x] [Review][Patch] `isInEasternWindow` test owner ambiguous [`docs/observability-scope-decision.md:248-249`] — fixed: owner is Story 7.2 only.
- [x] [Review][Patch] `outside_window` early return missing from 7.2 migration inventory [`docs/observability-scope-decision.md:105-114`] — fixed: added migration row and in-scope cron deliverable.
- [x] [Review][Patch] HTTP 200 when `failed > 0` deferred-work entry not cross-linked to 7.4 [`deferred-work.md:317`] — fixed: owner Story 7.4 + decision doc reference.
- [x] [Review][Defer] NFR46 MVP stance covers email only, not scoring/deadline failures [`docs/observability-scope-decision.md:126-136`] — deferred, pre-existing; explicit out-of-scope table covers scoring; acceptable for MVP spike scope.

## Dev Notes

### Scope is purely documentation

This spike produces **`docs/observability-scope-decision.md`** and **deferred-work.md updates** — no application code. Story 7.2 owns implementation.

Follow the pattern of `docs/email-provider-decision.md` and `pre-epic-6-email-provider-spike.md`:
- Lead with optimization criteria
- Options table with assessment column
- Recommendation with rationale
- Dedicated "Story 7.2 handoff" section (like 6.1 SDK quick-reference in email decision)
- Sources with date

### Existing logging inventory (Epic 6)

Use this as the baseline for the unified schema proposal:

| Prefix / location | Events logged |
|-------------------|---------------|
| `[email]` | send success/failure in `send-with-retry.ts`, digest/reminder senders |
| `[cron]` | tuesday-email, wednesday-reminder, thursday-reminder summaries |
| Route handlers | `console.error` on uncaught failures (inconsistent) |
| Resend client | Startup guard throw if `RESEND_API_KEY` missing |

**Not logged today:** pick deadline enforcement failures as structured events, scoring job outcomes, webhook delivery confirmations.

### Existing DB state usable for admin health (Hybrid option)

`LeagueWeekEmailConfig` columns (Story 6.2–6.3):

- `sentAt` — Tuesday digest
- `wednesdayReminderSentAt`
- `thursdayReminderSentAt`

Cron routes return `{ processed, sent, skipped*, failed }` but **do not persist** to DB today. Decision doc should specify whether 7.2 adds a `system_job_runs` table or relies on config timestamps + Vercel logs.

### Architecture constraints

From `architecture.md`:

- **Observability:** Vercel logs + structured console/JSON — start free
- **Max free tier** product goal — external vendors only if justified
- Route Handlers: "log unknown errors with request id; never return stack traces"

From `docs/project-context.md`:

- Secrets server-only
- Consistent JSON error shape `{ error: { code, message } }`

### UX considerations (admin trust)

From `ux-design-specification.md`:

> Administrator success hinges on trusting that automated operations execute correctly… Admin needs to "know it worked" without "doing the work."

If admin panel is chosen, place health signals on **`/leagues/{leagueId}/admin`** near existing `AdminEmailComposer` / `AdminReminderControls` — not a separate ops portal. Align with 6.6 admin 2-column layout.

No new front-end components in this spike — only specify placement in decision doc for 7.2.

### Deferred work cross-reference

Items to address in decision doc:

| Deferred item | Source | Decision needed |
|---------------|--------|-----------------|
| NFR32 webhook owner unassigned | pre-epic-6, 6.5, 6.6 | In 7.2? |
| Monitoring alert for missed weekly sends | deferred-work § go-live | Manual ops vs 7.2 |
| HTTP 200 when cron `failed > 0` | 6.5 review | Change in 7.2? |
| No cron run observability in admin UI | go-live checklist | Hybrid addresses |
| Circuit breaker for Resend outage | 6.5 review | 7.2 vs 7.4 |
| `isInEasternWindow` no unit tests | 6.5 review | 7.2 test baseline |

### Relationship to other Epic 7 stories

| Story | Overlap with observability |
|-------|---------------------------|
| 7.1 CSV export | Independent — no conflict |
| 7.2 | **Primary implementation** of this decision |
| 7.3 WCAG | Independent — admin health panel must meet Level A if built |
| 7.4 Performance | `maxDuration`, circuit breaker, cron hardening — may extend 7.2 logging |

### Epic 6 retro action item mapping

| Retro action | This spike delivers |
|--------------|---------------------|
| Observability scope decision before 7.2 | ✅ Decision doc |
| NFR32 webhook owner assignment | ✅ Owner in deferred-work |
| Replicate pre-epic spike pattern | ✅ Mirrors pre-epic-6 |
| Email/API route checklist for Epic 7 | Partial — reference in 7.2 handoff |

### References

- [Source: `_bmad-output/implementation-artifacts/epic-6-retro-2026-07-05.md` — Observability action items]
- [Source: `_bmad-output/implementation-artifacts/sprint-status.yaml` — pre-epic-7 blockers]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 7.2 AC]
- [Source: `_bmad-output/planning-artifacts/prd.md` — NFR45–NFR47, NFR32]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Observability row, logging patterns]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Admin automation trust]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — NFR32, cron monitoring, 6.5 review items]
- [Source: `docs/email-provider-decision.md` — Spike doc format reference]
- [Source: `pre-epic-6-email-provider-spike.md` — Spike story pattern reference]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

None — documentation-only spike; no code changes.

### Completion Notes List

- Created `docs/observability-scope-decision.md` following `docs/email-provider-decision.md` spike pattern.
- **Selected approach: Hybrid (Option C)** — unified structured JSON logging (NFR45) + read-only `AdminWeeklyEmailStatus` card on league admin page reading existing `LeagueWeekEmailConfig` timestamps (NFR47).
- **NFR46 MVP stance:** Manual ops runbook (spot-check Vercel logs after cron windows + admin card "Not sent" state); no automated pager at MVP.
- **NFR32:** Log-only `POST /api/webhooks/resend` in Story 7.2; admin per-recipient delivery UI deferred.
- **Cron drift:** Admin card + ops runbook for MVP; automated non-200 cron monitoring deferred to Story 7.4.
- Updated `deferred-work.md`: NFR32 owner → 7.2; missed weekly send monitoring → 7.2 manual ops + 7.4 automated; resolved go-live checklist and 6.6 gap items referencing observability.
- `npm test`: 339 tests passed (54 files); no regressions.

### File List

- `docs/observability-scope-decision.md` (added)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/pre-epic-7-observability-scope-decision.md` (modified)

## Change Log

- 2026-07-05: Pre-Epic 7 observability scope decision spike complete — Hybrid approach documented; deferred-work owners assigned; unblocks Story 7.2 spec.
- 2026-07-05: Code review — 5 doc patches applied (reminder skip inference, userId in log schema, outside_window logging, isInEasternWindow owner, deferred-work cross-link).
