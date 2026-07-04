# Story 6.1: Transactional Email Integration

Status: done

## Story

As the system,
I want a transactional email provider integrated with retries and logging,
so that emails are delivered reliably and failures are observable (NFR27, NFR32, NFR33).

## Acceptance Criteria

1. Given `RESEND_API_KEY` is absent from server env  
   When the application starts (or the email module is first imported)  
   Then a clear, actionable startup error is thrown identifying the missing variable (not a silent failure at send time)

2. Given a valid `RESEND_API_KEY` in server env only (never `NEXT_PUBLIC_*`)  
   When `sendInvitationEmail` is called for a valid invitation  
   Then a real email is dispatched via the Resend SDK (not a console stub) with the correct recipient, league name, and signup link

3. Given an email send fails transiently (5xx status or network timeout)  
   When the send is retried with exponential backoff  
   Then each failure attempt is logged and the retry succeeds when the transient error clears (NFR27, NFR33)

4. Given Resend returns HTTP 429 (daily cap exhausted)  
   When the retry loop encounters a 429 error  
   Then it does NOT burn remaining retry attempts; the 429 is logged distinctly and the error is rethrown immediately without further waits

5. Given any email send outcome (success or final failure)  
   When the operation completes  
   Then the outcome is logged with an `[email]` prefix, recipient address, and relevant context (NFR27)

6. Given `RESEND_API_KEY` is present  
   When multiple send calls are made in the same process  
   Then a singleton Resend instance is reused (not a new client per send)

## Tasks / Subtasks

- [x] Task 1: Install Resend SDK and React Email packages (AC: #2)
  - [x] `npm install resend @react-email/components react-email`
  - [x] Add `RESEND_API_KEY=""` to `.env.example` with a descriptive comment (see Dev Notes for exact text)

- [x] Task 2: Create `src/lib/email/resend-client.ts` — singleton + startup guard (AC: #1, #6)
  - [x] Startup assertion at module load: throw if `RESEND_API_KEY` is absent or empty
  - [x] Export singleton: `export const resend = new Resend(process.env.RESEND_API_KEY)`
  - [x] File extension: `.ts` (no JSX here — templates live under `templates/`)

- [x] Task 3: Create `src/lib/email/send-with-retry.ts` — retry helper (AC: #3, #4, #5)
  - [x] Pure function: `sendWithRetry<T>(sendFn: () => Promise<T>, options?: RetryOptions): Promise<T>`
  - [x] Exponential backoff: up to 3 retries, delays ~1s / ~2s / ~4s (jitter optional)
  - [x] 429 short-circuit: detect `error.statusCode === 429` from Resend SDK error object; throw immediately with log `[email] daily cap exhausted — no retry until midnight UTC reset`
  - [x] Log each failed attempt: `[email] attempt N failed: <message>`
  - [x] Keep pure (no Resend import here) so it is unit-testable without the startup guard

- [x] Task 4: Create `src/lib/email/templates/InvitationEmail.tsx` — React Email component (AC: #2)
  - [x] Import from `@react-email/components`: `Html`, `Body`, `Container`, `Text`, `Button`, `Heading`
  - [x] Props: `{ leagueName: string; signupUrl: string }`
  - [x] Content: league name prominently, "You've been invited to join Pick Six", CTA button to `signupUrl`
  - [x] Keep minimal — visual polish is not this story's job
  - [x] File must be `.tsx` (required for JSX / React Email)

- [x] Task 5: Wire `src/lib/email/send-invitation-email.ts` to Resend (AC: #2, #3, #4, #5)
  - [x] Replace the `console.info` stub body with a real Resend SDK call
  - [x] Change return type to `Promise<void>` (make async); update function signature accordingly
  - [x] Use `resend` singleton from `resend-client.ts`
  - [x] Render `InvitationEmail` as the `react` property of the send call
  - [x] Idempotency key: `` `invitation:${input.rawToken}` `` (colon delimiter — token is unique per invite; see Dev Notes on delimiter choice)
  - [x] Wrap send call in `sendWithRetry`
  - [x] `from` address: `"Pick Six <noreply@yourdomain.com>"` — placeholder; leave a `// TODO: replace with verified Resend domain` comment
  - [x] Caller at `src/app/api/leagues/[leagueId]/invitations/route.ts:147` calls without `await` (fire-and-forget) — this is acceptable; do NOT add await there unless failure must block the invitation API response

- [x] Task 6: Write tests for `send-with-retry.ts` (AC: #3, #4)
  - [x] `src/lib/email/send-with-retry.test.ts`
  - [x] Test: transient failure on first 2 attempts → succeeds on 3rd attempt
  - [x] Test: 429 error → throws immediately, `sendFn` is NOT called again
  - [x] Test: all retries exhausted → final error is rethrown
  - [x] Test: immediate success → returns result without logging a failure
  - [x] No live network; mock `sendFn` as a `vi.fn()`

## Dev Notes

### File Structure After This Story

```
src/lib/email/
  app-base-url.ts              (exists — no change)
  send-invitation-email.ts     (exists — replace stub, make async)
  resend-client.ts             (NEW)
  send-with-retry.ts           (NEW)
  templates/
    InvitationEmail.tsx        (NEW)
```

Architecture maps email to `lib/email/` — NOT `lib/integrations/` (that folder is for data providers: odds, schedule, weather). [Source: architecture.md — Requirements to structure mapping, lib/ tree]

### Resend SDK Quick Reference

From `docs/email-provider-decision.md`:

```typescript
// resend-client.ts
import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  throw new Error("[email] RESEND_API_KEY is not configured — set in .env.local or Vercel env vars");
}
export const resend = new Resend(process.env.RESEND_API_KEY);
```

```typescript
// send-invitation-email.ts (after wiring)
const { data, error } = await resend.emails.send({
  from: "Pick Six <noreply@yourdomain.com>",
  to: [input.to],
  subject: `You're invited to join ${input.leagueName} on Pick Six`,
  react: <InvitationEmail leagueName={input.leagueName} signupUrl={signupUrl} />,
  idempotencyKey: `invitation:${input.rawToken}`,
});
```

The caller file (`send-invitation-email.ts`) will need to be `.tsx` (or the JSX rendering extracted to a helper) because of the `react` property using JSX. Either rename the file to `.tsx` or render the template separately:
```typescript
import { render } from "@react-email/components";
const html = await render(<InvitationEmail ... />);
// then pass html: html to resend.emails.send
```
The `render` approach keeps `send-invitation-email.ts` as `.ts` — choose whichever is less disruptive to TypeScript config.

### Startup Guard — Critical Detail

`new Resend(undefined)` silently accepts a missing key and fails at send time with an opaque auth error. The explicit guard at module load makes misconfiguration fail loudly on startup rather than silently in production. [Source: deferred-work.md — `RESEND_API_KEY` absent at SDK construction]

**Test isolation**: `send-with-retry.test.ts` MUST NOT import `resend-client.ts` — the startup guard throws in test environments where `RESEND_API_KEY` is not set. Mock the send function at the test boundary instead of importing the real client.

### 429 Differentiation — Critical Detail

When Resend returns 429, exponential backoff retries will all fail until the daily cap resets at **midnight UTC**. Burning 3 retry slots does nothing. Detect `{ statusCode: 429 }` on the Resend SDK error object and short-circuit: [Source: deferred-work.md — HTTP 429 retry should be differentiated]

```typescript
// Inside sendWithRetry retry loop:
import type { CreateEmailResponseError } from "resend"; // adjust import per SDK version
if ((err as CreateEmailResponseError)?.statusCode === 429) {
  console.error("[email] daily cap exhausted — will not retry until midnight UTC reset");
  throw err; // immediate rethrow, no further delay
}
```

### Idempotency Key Delimiter

Use `:` (colon), NOT `-` (hyphen) as delimiter. UUIDs contain hyphens — using hyphens as field delimiters makes keys structurally ambiguous (e.g., `invitation-550e8400-e29b-...` cannot be parsed unambiguously). [Source: deferred-work.md — Hyphen delimiter in idempotency key]

Invitation key: `` `invitation:${input.rawToken}` `` — safe because tokens are single-use UUIDs and the prefix `invitation:` is unambiguous.

For future email types (Stories 6.2/6.3), follow the same pattern: `` `tuesday-digest:${leagueId}:${weekNumber}` ``, `` `reminder-midweek:${leagueId}:${weekNumber}:${participantId}` ``.

### Idempotency Window — Verify at Implementation Time

The decision doc notes the Resend rolling window duration is not specified. Before shipping Story 6.1, verify the actual window in [Resend API docs → Send Email → Idempotency](https://resend.com/docs/api-reference/emails/send-email#idempotency) and add a comment in `resend-client.ts` or `docs/email-provider-decision.md` documenting the verified window (e.g., "24 hours"). [Source: deferred-work.md — Resend idempotency rolling window duration unspecified]

### `.env.example` Addition

Add after the `WEATHER_API_KEY` section:

```bash
# --- Transactional email (Story 6.1) — Resend; server-only; never NEXT_PUBLIC_ ---
# Register at https://resend.com/ → API Keys. Domain verification required before sending to real recipients.
# See docs/email-provider-decision.md for setup prerequisites and free tier limits (3,000/month, 100/day).
RESEND_API_KEY=""
```

### Non-Negotiables From Project Context

- **Secrets server-only** [project-context.md #1]: `RESEND_API_KEY` must NEVER be `NEXT_PUBLIC_*` and must never appear in client components.
- **One Prisma client pattern** [project-context.md #2]: Apply same singleton discipline to `resend` — one instance per process, not per send call.
- **Error shape**: `console.error` with `[email]` prefix and structured context object (not a long string) — consistent with existing integration logging patterns in `src/lib/integrations/`.

### What Is NOT in Scope for This Story

- ❌ Cron routes (`/api/cron/tuesday-email/`, `/api/cron/reminder-midweek/`, `/api/cron/reminder-deadline/`) — Story 6.5
- ❌ Tuesday league digest email content — Story 6.2
- ❌ Wednesday/Thursday reminder emails — Story 6.3
- ❌ Email deep links with auth session — Story 6.4
- ❌ NFR32 Resend delivery webhook endpoint — Story 6.5 (decision doc assigns "Story 6.x" without a number; 6.5 is the cron/orchestration story that is the best fit)
- ❌ Admin email preview UI — Story 6.2
- ❌ Daily-cap batching/staggering logic — Story 6.5
- ❌ CRON_SECRET-protected route pattern — Story 6.5

### Caller Context (Existing Code)

`src/app/api/leagues/[leagueId]/invitations/route.ts` calls `sendInvitationEmail` at line 147 without `await` (fire-and-forget):

```typescript
for (const row of toSend) {
  sendInvitationEmail({ to: row.to, rawToken: row.rawToken, leagueName: row.leagueName });
}
```

After making `sendInvitationEmail` async, the fire-and-forget call is still valid — invitation send failure should not block the API response (admin still created the invite record). Do NOT add `await` to the call site unless a product decision changes this behavior.

### Testing Standards

- Vitest, colocated `*.test.ts` / `*.test.tsx` per project conventions [project-context.md — Testing/quality]
- `send-with-retry.ts` is pure — test with `vi.fn()` mocks only; zero network calls
- React Email template (`InvitationEmail.tsx`) does not need a unit test — it is a presentational component; visual review is sufficient at MVP
- `npm test` must pass after all changes

### References

- [Source: docs/email-provider-decision.md — SDK quick-reference, idempotency keys, 429 handling, cron strategy]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md — pre-epic-6-email-provider-spike deferred items (startup guard, 429, idempotency key delimiter, window duration)]
- [Source: _bmad-output/planning-artifacts/epics.md — Story 6.1 acceptance criteria, Epic 6 goal]
- [Source: _bmad-output/planning-artifacts/architecture.md — email location (lib/email/), cron routes, server-only integration pattern]
- [Source: docs/project-context.md — non-negotiables #1 (secrets), singleton discipline, file organization]
- [Source: src/lib/email/send-invitation-email.ts — existing stub to wire]
- [Source: src/app/api/leagues/[leagueId]/invitations/route.ts — call site (fire-and-forget, no await)]
- [Source: src/lib/integrations/weather/client.ts — integration pattern reference for error logging and null-return style]
- [Source: src/lib/integrations/weather/client.test.ts — test pattern reference (vi.spyOn, vi.useFakeTimers, process.env manipulation)]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (Cursor agent, dev-story workflow)

### Debug Log References

- Verified Resend idempotency window: 24 hours (documented in `resend-client.ts` comment per deferred-work item)
- Used `createElement(InvitationEmail, …)` for `react` property to keep `send-invitation-email.ts` as `.ts`
- `sendInvitationEmail` catches final errors to avoid unhandled rejections from fire-and-forget caller

### Completion Notes List

- Installed `resend`, `@react-email/components`, `react-email`
- Added startup guard + singleton in `resend-client.ts` (AC #1, #6)
- Implemented pure `sendWithRetry` with exponential backoff, 429 short-circuit, and `[email]` logging (AC #3, #4, #5)
- Created minimal `InvitationEmail` React Email template (AC #2)
- Replaced console stub in `sendInvitationEmail` with real Resend send + idempotency key `invitation:${rawToken}` (AC #2)
- Added 4 unit tests for `send-with-retry.ts`; full suite passes (306 tests)

### File List

- `.env.example` (modified)
- `package.json` (modified)
- `package-lock.json` (modified)
- `src/lib/email/resend-client.ts` (new)
- `src/lib/email/send-with-retry.ts` (new)
- `src/lib/email/send-with-retry.test.ts` (new)
- `src/lib/email/send-invitation-email.ts` (modified)
- `src/lib/email/templates/InvitationEmail.tsx` (new)

### Review Findings

- [x] [Review][Decision] 429 passthrough — resolved: fire-and-forget contract wins; 429 logged inside `sendWithRetry` (distinct), outer catch swallows it as generic failure; acceptable per spec fire-and-forget design (AC #4)
- [x] [Review][Patch] Final retry attempt never logged — moved `console.error` before the `break` check so all failed attempts are logged; updated test assertion from 2 to 3 log calls [`src/lib/email/send-with-retry.ts:63`]
- [x] [Review][Patch] Template body hardcodes "Pick Six" instead of `{leagueName}` — replaced with `{leagueName}` prop [`src/lib/email/templates/InvitationEmail.tsx:21`]
- [x] [Review][Patch] 429 log message wording diverges from spec — updated to `"will not retry until midnight UTC reset"`; updated test assertion to match [`src/lib/email/send-with-retry.ts:57`]
- [x] [Review][Defer] `from` address is placeholder — `'Pick Six <noreply@yourdomain.com>'` is intentional per spec TODO; not actionable until domain is verified — deferred, pre-existing [`src/lib/email/send-invitation-email.ts:27`]
- [x] [Review][Defer] No `server-only` import on email server modules — `resend-client.ts` and `send-invitation-email.ts` lack `import 'server-only'`; startup guard provides some protection but no build-time enforcement — deferred, pre-existing
- [x] [Review][Defer] No input validation for empty `to` / empty `rawToken` — empty values produce degenerate URLs and idempotency key collisions; API route callers validate upstream but no guard at this boundary — deferred, pre-existing

## Change Log

- 2026-07-04: Story 6.1 implemented — Resend SDK integration, retry helper, invitation email template, unit tests (dev-story workflow)
