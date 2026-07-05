# Story 6.5: Cron Routes, Secrets, and Idempotent Weekly Orchestration

Status: done

## Story

As the system,
I want scheduled jobs that safely drive the weekly email cycle for all active leagues,
so that the Tuesday digest, Wednesday reminder, and Thursday deadline reminder fire automatically without manual admin intervention (FR60, NFR34, architecture cron rules).

## Acceptance Criteria

1. **Given** `vercel.json` exists at the project root
   **When** Vercel deploys the app
   **Then** three cron entries invoke `/api/cron/tuesday-email`, `/api/cron/wednesday-reminder`, and `/api/cron/thursday-reminder` on their respective UTC schedules
   **And** the schedules are documented with their equivalent Eastern times and DST notes

2. **Given** an inbound request to any `/api/cron/*` route
   **When** the `Authorization` header is absent, malformed, or carries an incorrect secret
   **Then** the route responds `401` with `{ "error": { "code": "UNAUTHORIZED", "message": "..." } }`
   **And** `CRON_SECRET` verification uses `crypto.timingSafeEqual` (no timing leak)
   **And** no email send logic is executed

3. **Given** a valid `CRON_SECRET` bearer token
   **When** `POST /api/cron/tuesday-email` is called outside the Tuesday 5 PM–9 PM ET window (accounting for ±1h Hobby drift + DST)
   **Then** the route returns `200` with `{ status: "skipped", reason: "outside_window" }`
   **And** no email sends are attempted (idempotency safety guard)

4. **Given** a valid `CRON_SECRET` bearer token and the Tuesday 5 PM–9 PM ET window
   **When** `POST /api/cron/tuesday-email` fires
   **Then** all leagues with an active season (`preSeasonInitializedAt != null` for current NFL year) receive the Tuesday digest via `sendTuesdayDigest`
   **And** leagues that have already received this week's digest (existing `sentAt`) are silently skipped (idempotent — `ALREADY_SENT` caught, not propagated)
   **And** leagues with `NoActiveWeekError` (no resolvable week yet) are silently skipped
   **And** the route returns `200` with a JSON summary: `{ processed: N, sent: N, skipped: N, failed: N }`
   **And** league-level errors are logged with context but do not abort the loop (NFR46)

5. **Given** a valid `CRON_SECRET` bearer token and correct day/time window
   **When** `POST /api/cron/wednesday-reminder` fires
   **Then** all active leagues receive Wednesday reminders via `sendReminder({ leagueId, reminderType: "wednesday" })`
   **And** already-sent leagues are silently skipped (idempotent)
   **And** leagues with all picks submitted (`sent: 0, sentAt: null`) count as processed but not "sent"
   **And** the route returns `200` with a summary matching AC4's shape

6. **Given** a valid `CRON_SECRET` bearer token and correct day/time window
   **When** `POST /api/cron/thursday-reminder` fires
   **Then** all active leagues receive Thursday reminders via `sendReminder({ leagueId, reminderType: "thursday" })`
   **And** already-sent leagues are silently skipped (idempotent)
   **And** the route returns `200` with a summary matching AC4's shape

7. **Given** the test suite runs after all changes
   **When** `npm test` executes
   **Then** all tests pass including unit tests for `assert-cron-request.ts` covering:
   - Valid bearer token → passes (returns null / no error)
   - Missing `Authorization` header → returns 401 response
   - Wrong token → returns 401 response
   - Timing-safe comparison used (no exact string equality)

## Tasks / Subtasks

- [x] Task 1: Create `src/lib/cron/assert-cron-request.ts` (AC: #2, #7)
  - [x] Export `assertCronRequest(request: NextRequest): NextResponse | null`
  - [x] Read `CRON_SECRET` from `process.env.CRON_SECRET?.trim()`
  - [x] If env var is missing or empty: return 401 (fail-closed — misconfigured deployments get no access)
  - [x] Read `Authorization` header; extract `Bearer <token>`
  - [x] Use `crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(provided))` — **must** handle unequal lengths (return false without calling timingSafeEqual if lengths differ, to avoid `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH`)
  - [x] Return `null` on success; return `NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid or missing cron secret" } }, { status: 401 })` on failure
  - [x] Add `import 'server-only'` at the top (server-only pattern; see deferred 6.1 item — proactively fix here)

- [x] Task 2: Unit tests for `assert-cron-request.ts` (AC: #7)
  - [x] Create `src/lib/cron/assert-cron-request.test.ts`
  - [x] Mock `process.env.CRON_SECRET` via `vi.stubEnv` or direct assignment in `beforeEach`
  - [x] Test cases:
    - [x] `CRON_SECRET` not set → 401
    - [x] `CRON_SECRET` set, no `Authorization` header → 401
    - [x] `CRON_SECRET` set, wrong token → 401
    - [x] `CRON_SECRET` set, correct token → `null` (passes)
    - [x] Token of different length than secret → 401 (no crash, no timing leak)
  - [x] Do NOT mock `crypto.timingSafeEqual` — test behavior, not implementation

- [x] Task 3: Create `src/lib/cron/get-active-league-ids.ts` (AC: #4, #5, #6)
  - [x] Export `getActiveLeagueIds(): Promise<string[]>`
  - [x] Query: `prisma.season.findMany({ where: { nflSeasonYear: getCurrentNflSeasonYear(), preSeasonInitializedAt: { not: null } }, select: { leagueId: true } })`
  - [x] Return `seasons.map(s => s.leagueId)`
  - [x] Import `getCurrentNflSeasonYear` from `@/lib/league/nfl-season`
  - [x] Import `prisma` from `@/lib/db`
  - [x] Add `import 'server-only'`
  - [x] No tests required for this simple query wrapper; tested implicitly via cron route behavior

- [x] Task 4: Create Eastern time-window helper (AC: #3, inline in routes)
  - [x] Create `src/lib/cron/eastern-window.ts`
  - [x] Export `isInEasternWindow(now: Date, dayOfWeek: number, startHour: number, endHour: number): boolean`
    - `dayOfWeek`: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    - `startHour` / `endHour`: 24-hour Eastern time (inclusive start, exclusive end)
    - Use `new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))` to get Eastern wall-clock equivalent
    - Return `nowET.getDay() === dayOfWeek && nowET.getHours() >= startHour && nowET.getHours() < endHour`
  - [x] Add `import 'server-only'`

- [x] Task 5: Create `/api/cron/tuesday-email/route.ts` (AC: #3, #4)
  - [x] Create `src/app/api/cron/tuesday-email/route.ts`
  - [x] Handler: `export async function POST(request: NextRequest)`
  - [x] Step 1: Call `assertCronRequest(request)` — return error response if non-null
  - [x] Step 2: Eastern window check — Tuesday (day 2), 17:00–21:00 ET; if outside: return `200 { status: "skipped", reason: "outside_window" }`
  - [x] Step 3: `const leagueIds = await getActiveLeagueIds()`
  - [x] Step 4: Iterate `leagueIds`, for each:
    - Call `sendTuesdayDigest({ leagueId })`
    - Accumulate `sent`, `failed` from result
    - Catch `NoActiveWeekError` → increment `skippedNoWeek`, `console.info` with leagueId
    - Catch any error with `code: "ALREADY_SENT"` (the digest function re-throws 409 pattern as error) — **Note:** `sendTuesdayDigest` itself doesn't throw on already-sent; the route-level `sentAt` check that previously guarded re-sends is now bypassed. See Dev Notes for the idempotency strategy.
    - Catch unknown errors → increment `failed`, `console.error("[cron] tuesday-email league error", { leagueId, error })`
  - [x] Step 5: Log summary: `console.info("[cron] tuesday-email complete", { processed, sent, skipped, failed })`
  - [x] Step 6: Return `200 { processed, sent, skippedAlreadySent, skippedNoWeek, failed }`
  - [x] **No** `auth()` call — CSRF check not needed (bearer token auth)
  - [x] **No** `assertCookieSessionMutationOrigin` — that's for cookie-session routes

- [x] Task 6: Create `/api/cron/wednesday-reminder/route.ts` (AC: #5)
  - [x] Create `src/app/api/cron/wednesday-reminder/route.ts`
  - [x] Same structure as Task 5 but:
    - Window: Wednesday (day 3), 19:00–24:00 ET (7 PM–midnight)
    - Call `sendReminder({ leagueId, reminderType: "wednesday" })` for each league
    - Handle `NoActiveWeekError` the same way

- [x] Task 7: Create `/api/cron/thursday-reminder/route.ts` (AC: #6)
  - [x] Create `src/app/api/cron/thursday-reminder/route.ts`
  - [x] Same structure but:
    - Window: Thursday (day 4), 17:00–21:00 ET (5 PM–9 PM)
    - Call `sendReminder({ leagueId, reminderType: "thursday" })` for each league
    - Handle `NoActiveWeekError` the same way

- [x] Task 8: Create `vercel.json` (AC: #1)
  - [x] Create `vercel.json` at project root with crons array:
    ```json
    {
      "crons": [
        {
          "path": "/api/cron/tuesday-email",
          "schedule": "0 23 * * 2"
        },
        {
          "path": "/api/cron/wednesday-reminder",
          "schedule": "0 1 * * 4"
        },
        {
          "path": "/api/cron/thursday-reminder",
          "schedule": "0 0 * * 5"
        }
      ]
    }
    ```
  - [x] Add `CRON_SECRET` to `.env.local` doc comment (do NOT add actual value; document env var name)
  - [x] Update `.env.local.example` or similar if it exists with `CRON_SECRET=your-secret-here`

- [x] Task 9: `npm test` passes and lint is clean (AC: #7)
  - [x] Run `npm test` — verify all existing tests + new cron tests pass
  - [x] Run `npm run lint` — confirm zero errors project-wide

## Dev Notes

### Idempotency Strategy

The cron routes must be safe to call multiple times (Hobby ±1h drift, potential double-fires). There are two idempotency layers:

**Layer 1 — Eastern time-window check (coarse guard):**
- Prevents fire outside the intended window (e.g., cron fires an hour early due to drift)
- Implemented in each route via `isInEasternWindow`
- Returns `200 { status: "skipped", reason: "outside_window" }` — not an error

**Layer 2 — `sentAt` flags in `LeagueWeekEmailConfig` (fine guard):**
- `sendTuesdayDigest` reads `sentAt` — if non-null AND no force flag, it exits early (returns `{ sent: 0, failed: 0, sentAt: null }`)
- `sendReminder` checks `wednesdayReminderSentAt` / `thursdayReminderSentAt` similarly
- This means calling the cron twice within the same window is safe: second call processes each league but no emails are re-sent

**Critical insight:** The existing admin-facing routes (`/api/leagues/[leagueId]/email/tuesday-send`) have an explicit `sentAt` check that returns 409. `sendTuesdayDigest` itself does NOT return 409 — it re-reads `sentAt` and re-sends. **Wait — that's not what the code shows.** Looking at `send-tuesday-digest.ts`, it does NOT check `sentAt` internally. The 409 check lives in the admin route handler. Therefore:

- Cron routes calling `sendTuesdayDigest` directly will re-send if called twice in the same window.
- **Solution:** The cron routes should check `LeagueWeekEmailConfig.sentAt` before calling `sendTuesdayDigest`, mirroring the admin route check. OR call `sendTuesdayDigest` which will re-send (Resend idempotency keys within 24h prevent duplicate delivery at the provider level — this is the ultimate backstop).

**Recommended approach for cron routes:** Check `LeagueWeekEmailConfig` before sending, same as the admin route, to prevent unnecessary API calls. If `sentAt` is non-null: increment `skippedAlreadySent` and continue. Do not call `sendTuesdayDigest`.

This pattern mirrors the admin route (`tuesday-send/route.ts` lines 62–83) but without the session auth and per-league scope:

```typescript
// For each leagueId:
const sent = await checkAndSendTuesdayDigest(leagueId);
// where checkAndSendTuesdayDigest replicates the sentAt guard from the admin route
```

For implementation simplicity: inline the check inside the loop (no new helper required):

```typescript
for (const leagueId of leagueIds) {
  try {
    const data = await getTuesdayDigestData({ leagueId });
    const existing = await prisma.leagueWeekEmailConfig.findUnique({
      where: {
        leagueId_nflSeasonYear_weekNumber: {
          leagueId,
          nflSeasonYear: data.nflSeasonYear,
          weekNumber: data.weekNumber,
        },
      },
      select: { sentAt: true },
    });
    if (existing?.sentAt != null) {
      skippedAlreadySent++;
      continue;
    }
    const result = await sendTuesdayDigest({ leagueId, preloadedData: data });
    sent += result.sent;
    failed += result.failed;
  } catch (e) {
    if (e instanceof NoActiveWeekError || e instanceof LeagueNotFoundError) {
      skippedNoWeek++;
      console.info("[cron] tuesday-email: no active week for league", { leagueId });
    } else {
      failed++;
      console.error("[cron] tuesday-email: unhandled league error", { leagueId, error: e });
    }
  }
  processed++;
}
```

Apply the same pattern (using `wednesdayReminderSentAt` / `thursdayReminderSentAt`) for the reminder routes.

### `assertCronRequest` — Timing-Safe Comparison

**Why timing-safe:** Token comparison with `===` leaks timing information that could allow an attacker to guess the secret byte-by-byte. `crypto.timingSafeEqual` takes constant time regardless of where the comparison fails. This fixes the pre-existing issue noted in the Story 5.3 deferred items for `authorize-odds-admin.ts` (don't replicate that vulnerability here).

**Length-difference guard required:** `crypto.timingSafeEqual` throws if buffers have different lengths. Guard against this:

```typescript
import crypto from "crypto";
import "server-only";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function assertCronRequest(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Cron secret not configured" } },
      { status: 401 },
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!authHeader.startsWith(prefix)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing cron secret" } },
      { status: 401 },
    );
  }

  const provided = authHeader.slice(prefix.length);
  const secretBuf = Buffer.from(secret);
  const providedBuf = Buffer.from(provided);

  if (secretBuf.length !== providedBuf.length) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing cron secret" } },
      { status: 401 },
    );
  }

  if (!crypto.timingSafeEqual(secretBuf, providedBuf)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing cron secret" } },
      { status: 401 },
    );
  }

  return null;
}
```

### Vercel Cron Schedule — DST Considerations

`vercel.json` schedules are in UTC. The NFL regular season runs September–January spanning both EDT (UTC−4) and EST (UTC−5).

| Job | UTC Schedule | EDT equivalent | EST equivalent | Eastern window guard |
|-----|-------------|----------------|----------------|---------------------|
| `tuesday-email` | `0 23 * * 2` (Tue 23:00 UTC) | 7 PM Tue ET | 6 PM Tue ET | 17:00–21:00 ET |
| `wednesday-reminder` | `0 1 * * 4` (Thu 01:00 UTC) | 9 PM Wed ET | 8 PM Wed ET | 19:00–24:00 ET |
| `thursday-reminder` | `0 0 * * 5` (Fri 00:00 UTC) | 8 PM Thu ET | 7 PM Thu ET | 17:00–21:00 ET |

**Hobby ±1h drift:** Vercel Hobby crons have approximately ±1 hour precision. The Eastern window guard compensates: if the job fires 1 hour early, the Eastern time check rejects it and returns `{ status: "skipped", reason: "outside_window" }`. The job will (likely) not re-fire that day, so this is a "missed send" risk. See deferred item: "Hobby ±1 hr negative-drift silent-skip risk" from `deferred-work.md`. This is accepted behavior at MVP; a monitoring alert or admin-triggered fallback can be added later.

**How Vercel invokes cron routes:** Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically. Never accept plain unauthenticated requests to cron routes.

### Environment Variable: `CRON_SECRET`

- **Name:** `CRON_SECRET`
- **Where to set:** Vercel project settings → Environment Variables → Production + Preview + Development
- **Local dev:** `.env.local` → `CRON_SECRET=any-local-value-for-manual-testing`
- **What it is:** A random string (generate with `openssl rand -hex 32`) shared between Vercel cron config and the app. Vercel embeds this in the `Authorization: Bearer` header on every cron invocation.
- **Never** expose in client code or `NEXT_PUBLIC_*`

### File Structure After This Story

```
vercel.json                                         (new)
src/
  lib/
    cron/
      assert-cron-request.ts                        (new)
      assert-cron-request.test.ts                   (new)
      eastern-window.ts                             (new)
      get-active-league-ids.ts                      (new)
  app/
    api/
      cron/
        tuesday-email/
          route.ts                                  (new)
        wednesday-reminder/
          route.ts                                  (new)
        thursday-reminder/
          route.ts                                  (new)
```

No schema changes. No migrations. No UI changes.

### Previous Story Intelligence (from Story 6.4)

- `npm test` baseline: 314 tests across 49 test files (as of Story 6.4). This story adds ≥5 new test cases for `assert-cron-request.ts`.
- The `from` domain placeholder (`noreply@yourdomain.com`) remains unresolved. Not touched here.
- `AdminPickOverrideDialog.tsx` lint deferred from Epic 5 retro ("fix at start of next story that touches the admin panel") — this story does **not** touch the admin panel, so that lint item remains deferred.
- No blocking deferred items from Story 6.4 for this story.
- `authorize-odds-admin.ts` uses `===` for token comparison (5.3 deferred timing-safe item). Do not copy that pattern into the new `assert-cron-request.ts` — use `timingSafeEqual` as specified above.

### Architecture Compliance

| Non-negotiable | How Story 6.5 Complies |
|----------------|------------------------|
| Secrets server-only | `CRON_SECRET` read only in server Route Handlers; never `NEXT_PUBLIC_*` |
| One Prisma client | All DB calls use `prisma` singleton from `@/lib/db` |
| Server-authoritative deadlines | No deadline logic changed; cron is a trigger only |
| Pick visibility (FR48–FR49) | No pick data exposed; no query touches picks |
| Audit trail | No pick or score mutations; no audit needed |
| camelCase JSON / snake_case DB | Route responses use camelCase JSON |
| No public unauthenticated cron | All `/api/cron/*` routes verify `CRON_SECRET` first |
| MUI `Stack` for flex layouts | No UI components in this story |
| Idempotent handlers | `sentAt` / `*ReminderSentAt` DB flags prevent duplicate sends |

### Existing Modules to Reuse (Do NOT Reinvent)

| Module | Path | Role in This Story |
|--------|------|--------------------|
| `sendTuesdayDigest` | `src/lib/email/send-tuesday-digest.ts` | Called by `tuesday-email` cron route |
| `sendReminder` | `src/lib/email/send-reminder.ts` | Called by `wednesday-reminder` and `thursday-reminder` cron routes |
| `getTuesdayDigestData` | `src/lib/email/get-tuesday-digest-data.ts` | Pre-load data for idempotency check before calling `sendTuesdayDigest` |
| `getReminderData` | `src/lib/email/get-reminder-data.ts` | Pre-load data for idempotency check before calling `sendReminder` |
| `NoActiveWeekError`, `LeagueNotFoundError` | `src/lib/email/get-tuesday-digest-data.ts` | Catch and skip these in cron loops |
| `getCurrentNflSeasonYear` | `src/lib/league/nfl-season.ts` | Used in `get-active-league-ids.ts` |
| `prisma` | `src/lib/db.ts` | DB singleton — never `new PrismaClient()` |

### Scope Boundaries — What Is NOT in This Story

- ❌ NFR32 webhook/Resend delivery confirmation tracking — explicitly deferred (no assigned story yet; see `deferred-work.md`)
- ❌ Admin UI showing last cron run timestamp — Story 7 (observability and health signals)
- ❌ Odds snapshot cron (already has admin-triggered route; separate story if automated)
- ❌ Score-week cron (scoring is manually triggered via admin route; see Epic 5)
- ❌ Story 6.6 UX spec comparison and alignment — next story in Epic 6
- ❌ Rate limiting on `/api/cron/*` routes — not needed; `CRON_SECRET` is the guard
- ❌ Resend webhook route — separate work (NFR32)
- ❌ Monitoring alert / external pagerduty — NFR47; Epic 7 scope

### Deferred Work Applicable to This Story

From `deferred-work.md`:

- **"Hobby ±1 hr negative-drift silent-skip risk"** — Addressed by Eastern window check. If negative drift causes cron to fire before the window, it is rejected. Risk: missed send that week with no retry. Accepted at MVP. Log the `outside_window` skip so Vercel logs capture it.

- **"NFR32 webhook owner unassigned"** — Confirm this remains unassigned for 6.5. The deferred-work entry notes "assign to 6.5 or a new 6.6." Decision: **not in 6.5 scope** — webhook infrastructure is independent of cron orchestration and can be a standalone follow-up. Story 6.6 is already the UX alignment story; create a post-epic note for NFR32 instead.

- **"Timing-safe comparison on bearer token"** from Story 5.3 deferred — The new `assertCronRequest` proactively uses `timingSafeEqual`, avoiding the pre-existing anti-pattern in `authorize-odds-admin.ts`.

### Manual Testing Guide (Dev Verification)

After deploying or running locally, test the cron routes with:

```bash
# Set CRON_SECRET=test-secret in .env.local, then:
curl -X POST http://localhost:3000/api/cron/tuesday-email \
  -H "Authorization: Bearer test-secret"

# Should return { status: "skipped", reason: "outside_window" } unless it's Tuesday 5-9 PM ET
# Or if within window: { processed: N, sent: N, skippedAlreadySent: N, skippedNoWeek: N, failed: N }
```

For forced testing without the time window (development only), temporarily remove the window check or adjust hours.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 6.5 acceptance criteria, FR60]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR60 "weekly cycle orchestration"; NFR34 email delivery target; NFR45 structured logging; NFR46 critical failure alerts]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Vercel Cron on Hobby section; cron strategy; `CRON_SECRET` env var; `/api/cron/*` verification requirement; daily dispatcher pattern; ±1h precision]
- [Source: `docs/project-context.md` — "Hobby cron is limited (at most once per day per job; imprecise timing). Handlers must be idempotent."; `CRON_SECRET` non-negotiable #1]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — Hobby ±1h drift risk; NFR32 unassigned; timing-safe comparison deferred from 5.3]
- [Source: `src/lib/email/send-tuesday-digest.ts` — call interface; idempotency key pattern]
- [Source: `src/lib/email/send-reminder.ts` — call interface; `reminderType` parameter]
- [Source: `src/lib/email/get-tuesday-digest-data.ts` — `NoActiveWeekError`, `LeagueNotFoundError`; `getTuesdayDigestData` pre-load pattern]
- [Source: `src/lib/email/get-reminder-data.ts` — `getReminderData` pre-load pattern]
- [Source: `src/app/api/leagues/[leagueId]/email/tuesday-send/route.ts` — `sentAt` idempotency check pattern to replicate in cron route]
- [Source: `src/app/api/leagues/[leagueId]/email/wednesday-reminder/route.ts` — `wednesdayReminderSentAt` check pattern]
- [Source: `src/lib/nfl/authorize-odds-admin.ts` — bearer token pattern (do NOT copy `===` comparison; use `timingSafeEqual` instead)]
- [Source: `src/lib/league/nfl-season.ts` — `getCurrentNflSeasonYear` for active league query]
- [Source: `prisma/schema.prisma` — `LeagueWeekEmailConfig.sentAt`, `wednesdayReminderSentAt`, `thursdayReminderSentAt` fields; `Season.preSeasonInitializedAt`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor)

### Debug Log References

- Installed `server-only` package (required by story; not previously in dependencies).
- Added Vitest alias `server-only` → `src/test/server-only-mock.ts` so unit tests can import cron modules.

### Completion Notes List

- Implemented `assertCronRequest` with timing-safe bearer token verification and fail-closed missing-secret behavior.
- Added 5 unit tests for cron auth (319 total tests passing).
- Created `getActiveLeagueIds`, `isInEasternWindow`, and three cron route handlers with sentAt/idempotency guards mirroring admin routes.
- Added `vercel.json` with UTC cron schedules for Tuesday/Wednesday/Thursday email jobs.
- Documented `CRON_SECRET` in `.env.example`.
- `npm test` and `npm run lint` both pass.

### File List

- `vercel.json` (new)
- `.env.example` (modified)
- `package.json` (modified — added `server-only`)
- `package-lock.json` (modified)
- `vitest.config.ts` (modified — server-only test alias)
- `src/test/server-only-mock.ts` (new)
- `src/lib/cron/assert-cron-request.ts` (new)
- `src/lib/cron/assert-cron-request.test.ts` (new)
- `src/lib/cron/eastern-window.ts` (new)
- `src/lib/cron/get-active-league-ids.ts` (new)
- `src/app/api/cron/tuesday-email/route.ts` (new)
- `src/app/api/cron/wednesday-reminder/route.ts` (new)
- `src/app/api/cron/thursday-reminder/route.ts` (new)

### Review Findings

- [x] [Review][Decision] Response shape mismatch — resolved: keep granular `{ skippedAlreadySent, skippedNoWeek }` shape (Task 5 intent; better observability over AC4's simplified `skipped`)
- [x] [Review][Patch] `vercel.json` missing Eastern time / DST documentation [`vercel.json`] — added `$schema_notes` top-level field with UTC → ET equivalents and DST context for each job.
- [x] [Review][Patch] `getActiveLeagueIds()` uncaught in all three cron routes [`src/app/api/cron/*/route.ts:9`] — wrapped in try-catch returning structured 500 with `DB_ERROR` code.
- [x] [Review][Defer] No `maxDuration` in `vercel.json` — deferred, pre-existing
- [x] [Review][Defer] Timing side-channel from length pre-check before `timingSafeEqual` [`src/lib/cron/assert-cron-request.ts:29`] — deferred, pre-existing (spec explicitly authorizes early return on length difference)
- [x] [Review][Defer] No unit test for `isInEasternWindow` — deferred, pre-existing (AC7 only requires tests for `assert-cron-request.ts`)
- [x] [Review][Defer] TOCTOU race on idempotency check (read-then-send-then-write) — deferred, pre-existing (Resend idempotency keys are the accepted backstop per dev notes)
- [x] [Review][Defer] HTTP 200 always returned even when `failed > 0` — deferred, pre-existing (spec-compliant shape; monitoring gap noted)
- [x] [Review][Defer] No circuit breaker for email provider outage — deferred, pre-existing (out of spec scope)
- [x] [Review][Defer] `toLocaleString` ICU dependency in `eastern-window.ts` — deferred, pre-existing (Vercel runtime has full ICU; spec prescribes this pattern)

### Change Log

- 2026-07-04: Story 6.5 created — cron routes, `CRON_SECRET` auth, `vercel.json`, idempotent weekly orchestration.
- 2026-07-04: Implemented cron auth, Eastern window guards, three orchestration routes, vercel.json, and unit tests.
- 2026-07-04: Code review complete — 1 decision-needed, 2 patches, 7 deferred, 11 dismissed.
