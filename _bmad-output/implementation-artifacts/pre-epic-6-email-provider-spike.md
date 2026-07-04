# Pre-Epic 6: Email Provider Spike

Status: done

## Context

Mandated by the Epic 5 retrospective (2026-06-16, action item 5) and captured in `sprint-status.yaml` as a blocking pre-condition:

> `pre-epic-6-email-provider-spike` — must complete before Story 6.1 spec. Scope: provider comparison (free tier priority), cron strategy decision, decision doc output.

**Blocking relationship:** Story 6.1 ("Transactional email integration") cannot have its spec written until the provider is chosen and the cron strategy is decided. This spike produces the decision doc that unlocks 6.1.

The architecture document committed to choosing a transactional email provider at implementation time ("compare current free limits at implementation time") and listed **Resend, SendGrid, Mailgun** as candidates. SendGrid removed its permanent free tier in May 2025, so this spike updates the comparison and makes the final call.

## Problem

Epic 6 requires transactional email for six story flows (FR35–FR40): Tuesday 6 PM league digest, Wednesday/Thursday reminders, deep links, personalized by pick status. Before any implementation begins:

1. A provider must be selected — the correct SDK, env vars, and retry/logging pattern all depend on it.
2. The cron strategy for Vercel Hobby must be decided — Hobby allows **at most one cron per calendar day**, which affects how the Tuesday/Wednesday/Thursday schedule works.
3. Both decisions need a permanent record in `docs/` (matching the pattern of `docs/nfl-odds-integration.md`, `docs/weather-integration.md`).

## Pre-researched Findings

> This research was conducted during story creation (July 2026). Verify pricing pages at implementation time — vendor tiers change.

### Provider comparison

| Provider | Free tier | Key facts | Pick-six fit |
|----------|-----------|-----------|--------------|
| **Resend** | **3,000/month, 100/day (permanent)** | TypeScript-first SDK; React Email native integration (JSX templates); built on SES; Y Combinator–backed; 5-min setup; $20/mo for 50k | ✅ **Best fit** — free tier covers MVP, React/Next.js native, cleanest DX |
| **Postmark** | 100/month (dev/testing only, not production) | Best deliverability (~99%); own MTA layer; 45-day log retention; $15/mo for 10k; no viable free production tier | ❌ No free production tier; overkill at MVP scale |
| **SendGrid** | ~~100/day permanent~~ → **60-day trial only** (changed May 2025) | Twilio ecosystem; enterprise scale; removed permanent free tier; $19.95/mo | ❌ Free tier eliminated — fails the cost constraint |
| **Mailgun** | Limited trial only; $15/mo for 10k | Solid legacy reputation; older API design | ❌ No meaningful free tier |
| **Brevo** | 300/day (permanent) | EU data residency; combined marketing + transactional; older API | ⚠️ Alternative if Resend proves insufficient; lower daily cap |

### Recommendation: Resend

**Rationale:**
- Only provider with a **genuinely production-usable free tier** (3,000/month covers any realistic pick-six MVP load — e.g. 50 leagues × 15 participants × 4 emails/week = 3,000 emails)
- **React Email** integration means email templates are authored as React components — consistent with the Next.js + React project stack
- **TypeScript-first SDK** — `npm install resend` and `import { Resend } from "resend"`, no wrapper gymnastics
- Supports **idempotency keys** on the send endpoint — directly addresses NFR33 retry discipline
- Webhook events for delivery/bounce tracking — addresses NFR32 delivery confirmation
- If volume grows: $20/month unlocks 50k emails — cost is predictable

**Deliverability note:** Postmark has the industry's best deliverability track record, but its pricing model (no free production tier) is not compatible with the architecture's "max free tier" constraint. For pick-six's use case (weekly non-critical reminder emails, not financial alerts), Resend's deliverability is adequate.

### Cron strategy for Vercel Hobby

**Constraint:** Vercel Hobby cron jobs fire **at most once per calendar day**, with ±1 hour precision. Sub-daily schedules require Vercel Pro or an external scheduler.

**Email schedule required by Epic 6:**
- Tuesday ~6:00 PM ET: league digest (FR35)
- Wednesday evening: reminder for no-pick participants (FR37)
- Thursday ~1 hour before deadline (8:10 PM ET): final reminder (FR38)

**Recommended approach: One cron per day-of-week + Eastern time gate**

Use `vercel.json` cron schedules targeting the approximate UTC hour, with idempotent handlers that check `America/New_York` time before executing:

```
Tuesday:   "0 22 * * 2"   # 22:00 UTC = 6:00 PM ET (standard) / 5:00 PM ET (daylight)
Wednesday: "0 2 * * 4"    # 02:00 UTC next day = 10:00 PM ET (standard)
Thursday:  "0 1 * * 5"    # 01:00 UTC = 9:00 PM ET (standard) — 1 hr after 8:10 PM deadline
```

Because Hobby has ±1 hour drift, **the Tuesday 6:00 PM ET target (NFR34)** is best effort — the cron fires in the 5–7 PM ET window. Handlers must be **idempotent** (safe to run twice; use a `email_jobs` DB table or a sent-flag on the week record).

**Daylight saving time handling:** Store all times as UTC instants; use `Intl.DateTimeFormat` with `America/New_York` in handler logic to determine "is it Tuesday after 5 PM ET and before midnight?" rather than relying on the cron firing at an exact UTC time.

**Alternative (if Hobby drift is unacceptable):** Use an external free cron service (e.g. [cron-job.org](https://cron-job.org)) to `POST` a `CRON_SECRET`-protected `/api/cron/*` route. Epic 6.5 specifies this as the architecture's named alternative. Decision deferred to 6.5 — this spike only documents the tradeoffs.

## Acceptance Criteria

1. **Decision document created**

   **Given** this spike is complete

   **Then** `docs/email-provider-decision.md` exists and contains:
   - Provider comparison table (Resend, Postmark, SendGrid, Mailgun at minimum)
   - Selected provider (Resend) with rationale tied to project constraints
   - Free tier limits and upgrade path
   - Cron strategy recommendation with the day-of-week + ET gate approach documented
   - Acknowledged ±1 hour Hobby drift and mitigation (idempotent handlers)
   - Sources (vendor pricing pages consulted, research date)

2. **No regressions**

   **Given** this spike is documentation-only (no code changes)

   **When** `npm test` runs

   **Then** all 302 tests pass, `npm run build` is green

3. **Sprint status updated**

   **Given** the decision doc is written

   **Then** `pre-epic-6-email-provider-spike` is marked `done` in `sprint-status.yaml`

## Tasks / Subtasks

- [x] **Create `docs/email-provider-decision.md`** (primary deliverable)
  - [x] Comparison table: Resend / Postmark / SendGrid / Mailgun — include free tier limits and pricing verified at implementation time
  - [x] Record the selected provider (Resend) and rationale
  - [x] Document Resend SDK basics: `npm install resend`, env var name (`RESEND_API_KEY`), send call shape, idempotency key usage
  - [x] Document cron strategy for Vercel Hobby: schedule table + ET gate pattern + idempotency requirement
  - [x] Note that `src/lib/email/send-invitation-email.ts` is a console.log stub — Story 6.1 will wire it to Resend
  - [x] Add sources section with URLs and research date

- [x] **Run `npm test`** — confirm 302 tests pass (no code was changed; this is a sanity check)

- [x] **Mark story done in `sprint-status.yaml`**

### Review Findings

- [x] [Review][Decision] Thursday EDT timing — shifted Thursday cron to `"0 0 * * 5"` (7 PM ET standard / 8 PM ET daylight); ~1 hr buffer before 9:10 PM deadline in both modes. [docs/email-provider-decision.md]
- [x] [Review][Decision] Daily cap (100/day) is the binding constraint — added note to free tier section; ~6-league threshold documented; batching deferred to Story 6.5. [docs/email-provider-decision.md]
- [x] [Review][Decision] `etHour >= 24` dead code — removed unreachable check; handler now runs for any Tuesday at or after 17:00 ET (matches prose intent "before midnight"). [docs/email-provider-decision.md]
- [x] [Review][Patch] DST labels inverted in cron table (all 3 rows) — fixed: Tuesday 5 PM standard / 6 PM daylight; Wednesday 9 PM standard / 10 PM daylight; Thursday 7 PM standard / 8 PM daylight. [docs/email-provider-decision.md]
- [x] [Review][Patch] Thursday Notes field wrong — fixed to "~2 hrs before 9:10 PM ET deadline (standard) / ~1 hr (daylight)". [docs/email-provider-decision.md]
- [x] [Review][Patch] Weekly/monthly unit error in 50-league scenario — corrected: 10-league scenario (2,400/month) used as primary example; 50-league ~12,000/month noted as Pro-tier territory. [docs/email-provider-decision.md]
- [x] [Review][Patch] Idempotency key prose template uses non-interpolating `{type}` / `{leagueId}` — fixed to `` `${type}-${leagueId}-${weekNumber}-${participantId}` ``. [docs/email-provider-decision.md]
- [x] [Review][Patch] Async network throw bypasses `if (error)` check — added `try/catch` wrapper to error handling sample. [docs/email-provider-decision.md]
- [x] [Review][Patch] `recipient` undeclared in `console.error` — renamed to `to: toAddress`. [docs/email-provider-decision.md]
- [x] [Review][Patch] `error.message` may be undefined — added `?? JSON.stringify(error)` fallback. [docs/email-provider-decision.md]
- [x] [Review][Patch] ET gate code pattern only shown for Tuesday — added Wednesday and Thursday gate examples with correct hour lower bounds. [docs/email-provider-decision.md]
- [x] [Review][Patch] Send call shape uses JSX in `.ts` context — added note that caller file must be `.tsx`. [docs/email-provider-decision.md]
- [x] [Review][Patch] Domain verification prerequisite absent — added Prerequisites section with DNS verification guidance and timing warning. [docs/email-provider-decision.md]
- [x] [Review][Patch] `react-email` not in installation — added to `npm install` command. [docs/email-provider-decision.md]
- [x] [Review][Defer] Resend idempotency rolling window duration unspecified — verify at Story 6.1 implementation time [docs/email-provider-decision.md:85] — deferred, pre-existing
- [x] [Review][Defer] NFR32 webhook owner deferred to "Story 6.x" with no story number assigned — deferred, pre-existing
- [x] [Review][Defer] HTTP 429 (daily cap exhausted) retry should be differentiated from transient errors — deferred, pre-existing, Story 6.1 implementation
- [x] [Review][Defer] `RESEND_API_KEY` absent at construction time — no startup guard documented — deferred, pre-existing, Story 6.1 implementation
- [x] [Review][Defer] Hobby ±1 hr negative-drift could cause cron to fire early and silently skip — deferred, pre-existing platform constraint
- [x] [Review][Defer] Hyphen delimiter in idempotency key ambiguous when league/participant IDs contain hyphens — deferred, pre-existing, low risk

## Dev Notes

### Scope is purely documentation

This spike produces **one new file** (`docs/email-provider-decision.md`) and **no code changes**. Do not install the Resend SDK, modify `package.json`, or touch any source files. Story 6.1 owns the implementation.

### Decision doc format

Follow the pattern established by `docs/nfl-odds-integration.md`:
- Lead with "what we optimized for" criteria table (free tier priority, developer experience, NFR alignment)
- Options table with assessment column
- Recommendation section with rationale
- Cron strategy as a dedicated section (not a footnote)
- Sources section with URLs and date

### Env var naming convention

When Story 6.1 adds the real Resend integration, the env var must be named `RESEND_API_KEY` — consistent with Resend's SDK defaults and their own docs. Note this in the decision doc so 6.1 inherits it without re-debating naming.

### Existing email stub

`src/lib/email/send-invitation-email.ts` already exists with a `console.info` stub and the comment "Epic 6 will add a real provider." The decision doc should acknowledge this so Story 6.1 knows to wire the existing function to Resend's SDK (not create a parallel path).

File structure expected after Story 6.1 (for context — do not implement):
```
src/lib/email/
  app-base-url.ts           (exists — no change)
  send-invitation-email.ts  (exists — stub, Story 6.1 wires to Resend)
  resend-client.ts          (Story 6.1 — thin Resend SDK wrapper)
```

### NFR alignment for Story 6.1's benefit

| NFR | Requirement | Resend capability |
|-----|-------------|-------------------|
| NFR27 | Email delivery failures must be logged and retried | SDK throws typed errors; wrap in try/catch with `console.error` + retry loop |
| NFR32 | Delivery confirmations must be tracked and logged | Resend webhook events: `email.delivered`, `email.bounced` |
| NFR33 | Failed sends must retry with exponential backoff | Implement in caller; Resend SDK supports idempotency keys to prevent duplicate sends on retry |
| NFR34 | Weekly emails by 6:00 PM Tuesday | Vercel Hobby cron `0 22 * * 2` + ET gate check in handler |

### Why not Postmark?

Postmark has the industry's best deliverability, but its production minimum ($15/month) violates the architecture's "max free tier" constraint. Pick-six's email volume at MVP scale (small number of leagues, ~10–15 participants each) fits comfortably within Resend's 3,000/month free tier. Revisit Postmark if the project scales beyond 100 leagues.

### Why not SendGrid?

SendGrid removed its permanent free tier in May 2025. New accounts get a 60-day trial then require a paid plan ($19.95/month minimum). No longer viable as the free-tier choice.

### Cron strategy — key rule

Every Epic 6 email job handler must be **idempotent**: running it twice for the same week must produce the same outcome (one set of emails sent, not two). Implement a sent-flag approach on a per-week, per-league-membership basis. Story 6.5 ("Cron routes, secrets, and idempotent weekly orchestration") owns the idempotency mechanism — the decision doc should name this dependency.

### References

- [Source: `_bmad-output/implementation-artifacts/epic-5-retro-2026-06-16.md` — Action item 5 and Next Epic Preview section]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — "Constraints: max free tier" section, "Background / scheduled work" section]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 6 goal and Story 6.1 / 6.5 acceptance criteria]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR35–FR40, NFR27, NFR32, NFR33, NFR34]
- [Source: `src/lib/email/send-invitation-email.ts` — existing console.log stub]
- [Source: `docs/nfl-odds-integration.md` — decision doc format reference]
- Web: Resend pricing (https://resend.com/pricing), Postmark pricing (https://postmarkapp.com/pricing), SendGrid pricing (https://sendgrid.com/pricing) — verified July 2026
- Web: Vercel Cron usage (https://vercel.com/docs/cron-jobs/usage-and-pricing) — Hobby tier details

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5 (Cursor agent, create-story workflow); claude-sonnet-4-6 (Cursor agent, dev-story workflow)

### Debug Log References

### Completion Notes List

- Created `docs/email-provider-decision.md` following the `docs/nfl-odds-integration.md` format pattern.
- Comparison table covers Resend, Postmark, SendGrid, Mailgun, and Brevo with July 2026 pricing verification.
- Selected Resend: only provider with a production-viable permanent free tier (3,000/month, 100/day); TypeScript-first SDK; React Email native integration; idempotency key support (NFR33); delivery webhooks (NFR32).
- Documented `RESEND_API_KEY` env var naming, send call shape, idempotency key composition pattern, and NFR27 error-handling pattern for Story 6.1's benefit.
- Noted existing `src/lib/email/send-invitation-email.ts` console.info stub — Story 6.1 wires this to Resend (do not create a parallel path).
- Cron strategy section documents three `vercel.json` day-of-week schedules (Tue/Wed/Thu), ET gate pattern using `Intl.DateTimeFormat`, DST handling, ±1 hr Hobby drift acknowledgment, and idempotency requirement delegated to Story 6.5.
- NFR alignment table included for Story 6.1's reference.
- 302 tests pass; no code changes made — confirmed no regressions.

### File List

- `docs/email-provider-decision.md` (new)

## Change Log

- 2026-07-04: Created `docs/email-provider-decision.md` — provider comparison, Resend selection rationale, SDK quick-reference, cron strategy, NFR alignment. 302 tests confirmed passing.
