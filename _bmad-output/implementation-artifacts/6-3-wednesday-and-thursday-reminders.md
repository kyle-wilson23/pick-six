# Story 6.3: Wednesday and Thursday Reminders

Status: review

## Story

As a forgetful participant,
I want to receive targeted reminder emails on Wednesday evening and one hour before the Thursday deadline if I have not yet submitted my pick,
so that I never miss a week through inattention (FR37, FR38, FR40).

## Acceptance Criteria

1. **Given** the Wednesday evening reminder job runs (admin-triggered or cron in Story 6.5)
   **When** `POST /api/leagues/[leagueId]/email/wednesday-reminder` is called
   **Then** every active league member **without** a pick for the current week receives a reminder email
   **And** members who have already submitted receive **no** email (FR40 personalization by status)
   **And** `wednesdayReminderSentAt` is recorded on the `league_week_email_configs` row for the week
   **And** sends use `sendWithRetry` and log outcomes with `[email]` prefix (NFR27)

2. **Given** the Thursday 1-hour-before-deadline reminder job runs
   **When** `POST /api/leagues/[leagueId]/email/thursday-reminder` is called
   **Then** every active league member **without** a pick for the current week receives a final reminder
   **And** members who have already submitted receive **no** email (FR40)
   **And** `thursdayReminderSentAt` is recorded on the `league_week_email_configs` row for the week

3. **Given** a reminder has already been sent for `(leagueId, nflSeasonYear, weekNumber)`
   **When** the same reminder endpoint is called again without `?force=true`
   **Then** the API returns `409` with `{ "error": { "code": "ALREADY_SENT", "message": "..." } }`
   **And** Story 6.5 cron relies on this guard for idempotency

4. **Given** there are no outstanding picks (all members have submitted)
   **When** either reminder endpoint is called
   **Then** the API returns `200` with `{ sent: 0, failed: 0, skipped: N, sentAt: null }`
   **And** `*ReminderSentAt` is **not** written (nothing was sent — same "sent > 0" guard as Tuesday digest)

5. **Given** only league admins may access these reminder routes
   **When** a non-admin or unauthenticated caller hits either endpoint
   **Then** the response is `403` or `401` respectively — same admin guard pattern as other admin routes
   **And** CSRF `assertCookieSessionMutationOrigin` is called on both routes (NFR15)

6. **Given** a league admin opens the admin dashboard
   **When** the Reminder Emails section loads
   **Then** they see:
   - Count of outstanding members for the current week
   - "Send Wednesday Reminder" button
   - "Send Thursday Reminder" button
   - "Last sent" timestamp for each reminder type (if already sent this week)
   - Disabled/greyed state when `weekNumber` is null (no active week)

7. **Given** the `GET /api/leagues/[leagueId]/email/tuesday-config` endpoint is called
   **When** the response is returned
   **Then** it now also includes `wednesdayReminderSentAt` and `thursdayReminderSentAt` fields
   (so `AdminReminderControls` can initialize its state from the same config fetch `AdminEmailComposer` already uses)

## Tasks / Subtasks

- [x] Task 1: DB schema — extend `LeagueWeekEmailConfig` (AC: #1, #2, #3)
  - [x] Add `wednesdayReminderSentAt DateTime? @map("wednesday_reminder_sent_at") @db.Timestamptz` to `LeagueWeekEmailConfig` in `prisma/schema.prisma`
  - [x] Add `thursdayReminderSentAt  DateTime? @map("thursday_reminder_sent_at") @db.Timestamptz` to `LeagueWeekEmailConfig`
  - [x] Run `npx prisma migrate dev --name add_reminder_sent_at_to_league_week_email_configs` and commit migration SQL

- [x] Task 2: React Email template — `ReminderEmail.tsx` (AC: #1, #2)
  - [x] Create `src/lib/email/templates/ReminderEmail.tsx`
  - [x] Props: `ReminderEmailProps` — see Dev Notes for full prop shape
  - [x] Sections: subject header, personalized body ("You haven't picked yet!"), jailed team callout (reuse same display as Tuesday digest), picks CTA button, Thursday-specific urgency copy
  - [x] Jailed team: render team name + abbreviation if present; render fallback if `jailedTeamName` is null
  - [x] `reminderType: 'wednesday' | 'thursday'` controls body copy (Wednesday: casual nudge; Thursday: urgent deadline warning)
  - [x] Keep styling minimal — same patterns as `TuesdayDigestEmail.tsx`

- [x] Task 3: Data service — `src/lib/email/get-reminder-data.ts` (AC: #1, #2, #4)
  - [x] Function: `getReminderData({ leagueId }: { leagueId: string }): Promise<ReminderData>`
  - [x] Returns: `ReminderData` — see Dev Notes for full shape
  - [x] Steps:
    - [x] Load league name (same as `getTuesdayDigestData`)
    - [x] Resolve season + week number (same pattern as `getTuesdayDigestData`)
    - [x] Load all members with email — same query as `getTuesdayDigestData`
    - [x] Load picks for `(seasonId, weekNumber, leagueId)` — query `Pick` where `nflWeekNumber = weekNumber AND leagueMembership.leagueId = leagueId AND seasonId = season.id`
    - [x] Split members into `outstandingMembers` (no pick) and `submittedCount` (has pick)
    - [x] Load jailed team for the week (same as `getTuesdayDigestData`)
    - [x] Build `picksUrl` using `getAppBaseUrl()` (plain URL — auth deep links deferred to Story 6.4)
  - [x] Re-export `NoActiveWeekError` and `LeagueNotFoundError` from `get-tuesday-digest-data.ts` (or throw same types)
  - [x] Write tests: `src/lib/email/get-reminder-data.test.ts` — mock Prisma; test:
    - [x] Member with no pick → in `outstandingMembers`
    - [x] Member with pick → NOT in `outstandingMembers`, counted in `submittedCount`
    - [x] All submitted → `outstandingMembers` is empty
    - [x] Jailed team absent → `jailedTeamName: null`

- [x] Task 4: Send service — `src/lib/email/send-reminder.ts` (AC: #1, #2, #4)
  - [x] Function: `sendReminder({ leagueId, reminderType }: { leagueId: string; reminderType: 'wednesday' | 'thursday' }): Promise<{ sent: number; failed: number; skipped: number; sentAt: Date | null }>`
  - [x] Flow:
    - [x] Call `getReminderData({ leagueId })`
    - [x] `skipped` = total members minus outstanding members count
    - [x] For each outstanding member: call `sendWithRetry(...)` wrapping `resend.emails.send(...)`:
      - `from: 'Pick Six <noreply@yourdomain.com>'` (same placeholder as 6.1/6.2 — see deferred-work.md)
      - `to: [member.email]`
      - `subject`: see Dev Notes subject line pattern
      - `react: createElement(ReminderEmail, props)`
      - `idempotencyKey: \`${reminderType}-reminder:${leagueId}:${data.weekNumber}:${member.membershipId}\``
    - [x] Catch per-member failures; accumulate `sent` / `failed` counters
    - [x] `sentAt = sent > 0 ? new Date() : null` (same "sent > 0" guard as `sendTuesdayDigest`)
    - [x] If `sentAt != null`: upsert `LeagueWeekEmailConfig` setting the appropriate `wednesdayReminderSentAt` or `thursdayReminderSentAt` field
    - [x] Log `[email] ${reminderType} reminder sent` with `{ leagueName, weekNumber, sent, failed, skipped }`
  - [x] No unit test required for this file (same fire-and-forget policy as `send-tuesday-digest.ts`)

- [x] Task 5: API route — Wednesday reminder — `src/app/api/leagues/[leagueId]/email/wednesday-reminder/route.ts` (AC: #1, #3, #5)
  - [x] `POST`: CSRF → auth → admin role check → check `wednesdayReminderSentAt` (if set and not `?force=true`, return 409 `ALREADY_SENT`) → call `sendReminder({ leagueId, reminderType: 'wednesday' })` → return `{ sent, failed, skipped, sentAt }`
  - [x] Handle `NoActiveWeekError` → 409, `LeagueNotFoundError` → 404, unknown → 500
  - [x] Auth guard: ADMIN role check (same pattern as other admin routes)
  - [x] CSRF: `assertCookieSessionMutationOrigin` before `auth()`

- [x] Task 6: API route — Thursday reminder — `src/app/api/leagues/[leagueId]/email/thursday-reminder/route.ts` (AC: #2, #3, #5)
  - [x] Same structure as Task 5 but checks `thursdayReminderSentAt` and calls `sendReminder({ leagueId, reminderType: 'thursday' })`

- [x] Task 7: Extend `tuesday-config` GET response (AC: #7)
  - [x] In `src/app/api/leagues/[leagueId]/email/tuesday-config/route.ts` (existing file)
  - [x] In the `GET` handler, expand the `select` on `leagueWeekEmailConfig.findUnique` to include `wednesdayReminderSentAt` and `thursdayReminderSentAt`
  - [x] Add both fields to the JSON response: `wednesdayReminderSentAt: config?.wednesdayReminderSentAt?.toISOString() ?? null` and `thursdayReminderSentAt: ...`
  - [x] **Do not change** the existing `bodyText`/`sentAt` fields or PUT handler

- [x] Task 8: `AdminReminderControls` UI component (AC: #6)
  - [x] Create `src/components/admin/AdminReminderControls.tsx` as `"use client"`
  - [x] Props: `{ leagueId: string; weekNumber: number | null; outstandingCount: number }`
  - [x] On mount: `GET .../tuesday-config` to load `wednesdayReminderSentAt` and `thursdayReminderSentAt` (re-uses the same config fetch that `AdminEmailComposer` uses — avoids a new endpoint)
  - [x] Shows outstanding count: `"X member(s) have not yet submitted a pick for Week N"`
  - [x] "Send Wednesday Reminder" button: `variant="outlined"` with `color="info"` (info blue) — POST to `wednesday-reminder`
  - [x] "Send Thursday Reminder" button: `variant="outlined"` with `color="warning"` (warning orange) — POST to `thursday-reminder`
  - [x] Each button shows "Last sent at [timestamp]" if `*ReminderSentAt` is already set
  - [x] On send success: show inline "Sent at [timestamp]" and update state; on 409 show "Already sent — add ?force=true to resend"
  - [x] If `weekNumber` is null: render disabled state with "No active week for reminders" copy
  - [x] If `outstandingCount === 0`: show "All members have submitted picks" with buttons disabled
  - [x] Use MUI `Stack` for layout (project convention — not `Box`)

- [x] Task 9: Wire `AdminReminderControls` into admin page (AC: #6)
  - [x] In `src/app/(app)/leagues/[leagueId]/admin/page.tsx`
  - [x] Compute `outstandingCount` from existing `participants` array: `participants.filter(p => p.submittedPick === null).length`
  - [x] Add `<AdminReminderControls leagueId={leagueId} weekNumber={weekNumber} outstandingCount={outstandingCount} />` below `<AdminEmailComposer>` block and before `<AdminAuditLog>`
  - [x] Add section heading "Reminder Emails" above the component (use `Typography variant="h5" component="h2"`)

- [x] Task 10: `npm test` passes
  - [x] Run `npm test` — verify all existing tests + new `get-reminder-data.test.ts` pass
  - [x] Goal: all tests green; zero lint errors

### Review Findings

- [x] [Review][Patch] Buttons absent instead of disabled when `weekNumber` is null — early return renders only copy with no buttons; AC6 requires "disabled/greyed state", meaning buttons present but disabled [src/components/admin/AdminReminderControls.tsx:139-147]
- [x] [Review][Patch] "Last sent" timestamps not visually coupled to their respective buttons — both timestamps render as sibling `Typography` blocks above the button row rather than as captions per button as AC6 specifies [src/components/admin/AdminReminderControls.tsx:161-171]
- [x] [Review][Patch] Config fetch error attributed only to `wednesdayError` state — `loadConfig` catch block calls `setWednesdayError` for a shared config failure; Thursday error slot shows nothing, misleading the admin [src/components/admin/AdminReminderControls.tsx:63]
- [x] [Review][Patch] `console.info` fires "reminder sent" on zero-send (AC4) path — log emits `"wednesday reminder sent"` with `sent: 0` when all members have already submitted; misleads operators scanning logs; NFR27 requires accurate outcome logging [src/lib/email/send-reminder.ts:99]
- [x] [Review][Patch] `jailedLabel` fallback uses internal system language — "Not yet computed for this week" is developer copy; end-user email recipients have no context for "computed"; change to "Not yet announced" or similar [src/lib/email/templates/ReminderEmail.tsx:32]
- [x] [Review][Patch] `ReminderEmail` missing `<Preview>` pre-header — email clients show "Hi Alice," as inbox snippet with no context; add a `<Preview>` component from `@react-email/components` [src/lib/email/templates/ReminderEmail.tsx]
- [x] [Review][Defer] TOCTOU race on concurrent sends [both route handlers] — deferred, pre-existing (same class as tuesday-send; Resend idempotency keys mitigate; already in deferred-work.md from 6.2)
- [x] [Review][Defer] Hardcoded `from` domain placeholder — deferred, pre-existing (explicitly deferred per spec and deferred-work.md from 6.1)
- [x] [Review][Defer] Stale `outstandingCount` SSR prop — deferred, pre-existing (inherent SSR pattern; same tradeoff as AdminEmailComposer; no spec requirement for live refresh)
- [x] [Review][Defer] `user.email` assumed non-null — deferred, pre-existing (mirrors get-tuesday-digest-data.ts exactly; same as deferred in 5-4 review)
- [x] [Review][Defer] `sentAt` DB upsert failure causes response/DB desync — deferred, pre-existing (same class as send-tuesday-digest.ts; no transaction wrapping the send loop; acceptable at MVP scale)
- [x] [Review][Defer] No inactive/departed membership filter in `getReminderData` — deferred, pre-existing (mirrors get-tuesday-digest-data.ts exactly; no membership status field in current schema)
- [x] [Review][Defer] `preloadedData` snapshot staleness during send loop — deferred, pre-existing (accepted TOCTOU variant from 6.2; Resend idempotency keys cover)
- [x] [Review][Defer] Route calls `getReminderData` before idempotency guard — deferred, pre-existing (inherent constraint: week key needed for the config lookup; acknowledged in spec dev notes)
- [x] [Review][Defer] Error path test coverage absent for route handlers and send service — deferred, pre-existing (fire-and-forget policy per spec; API routes no-test policy per spec)

## Dev Notes

### DB Schema Addition

Add to `prisma/schema.prisma` in the existing `LeagueWeekEmailConfig` model (after `sentAt`):

```prisma
/// Set when `sendReminder` sends at least one Wednesday reminder for this week.
wednesdayReminderSentAt DateTime? @map("wednesday_reminder_sent_at") @db.Timestamptz
/// Set when `sendReminder` sends at least one Thursday reminder for this week.
thursdayReminderSentAt  DateTime? @map("thursday_reminder_sent_at") @db.Timestamptz
```

**Migration command:**
```bash
npx prisma migrate dev --name add_reminder_sent_at_to_league_week_email_configs
```

### File Structure After This Story

```
src/lib/email/
  get-tuesday-digest-data.ts       (exists — no change)
  get-reminder-data.ts             (NEW)
  get-reminder-data.test.ts        (NEW)
  send-tuesday-digest.ts           (exists — no change)
  send-reminder.ts                 (NEW)
  templates/
    TuesdayDigestEmail.tsx         (exists — no change)
    ReminderEmail.tsx              (NEW)

src/components/admin/
  AdminReminderControls.tsx        (NEW — "use client")
  AdminEmailComposer.tsx           (exists — no change)

src/app/api/leagues/[leagueId]/email/
  tuesday-config/route.ts          (modified — extend GET response)
  tuesday-preview/route.ts         (exists — no change)
  tuesday-send/route.ts            (exists — no change)
  wednesday-reminder/route.ts      (NEW)
  thursday-reminder/route.ts       (NEW)

prisma/schema.prisma               (modified — two new nullable fields)
prisma/migrations/                 (new migration)
src/app/(app)/leagues/[leagueId]/admin/page.tsx  (modified — add AdminReminderControls)
```

### `ReminderEmailProps` Shape

```typescript
export type ReminderEmailProps = {
  leagueName: string;
  weekNumber: number;
  recipientDisplayName: string;        // personalized greeting
  jailedTeamName: string | null;       // null → "Not yet computed for this week"
  jailedTeamAbbreviation: string | null;
  picksUrl: string;                    // plain absolute URL (auth deep links are Story 6.4)
  reminderType: 'wednesday' | 'thursday';
};
```

### `ReminderData` Shape (returned by `getReminderData`)

```typescript
export type ReminderData = {
  leagueName: string;
  leagueId: string;
  nflSeasonYear: number;
  weekNumber: number;
  jailedTeamName: string | null;
  jailedTeamAbbreviation: string | null;
  picksUrl: string;
  outstandingMembers: Array<{     // members WITHOUT a pick this week
    membershipId: string;
    email: string;
    displayName: string;
  }>;
  submittedCount: number;          // members who have already picked
};
```

### Outstanding Member Query Pattern

`getReminderData` should query picks for the active week and compute outstanding members in one pass:

```typescript
// Step 1: load all memberships (same as getTuesdayDigestData)
const memberships = await prisma.leagueMembership.findMany({
  where: { leagueId },
  include: { user: { select: { email: true, name: true } } },
  orderBy: { createdAt: 'asc' },
});

// Step 2: load picks for this week in this league
const picks = await prisma.pick.findMany({
  where: {
    seasonId: season.id,
    nflWeekNumber: weekNumber,
    leagueMembership: { leagueId },
  },
  select: { leagueMembershipId: true },
});

const pickedMembershipIds = new Set(picks.map(p => p.leagueMembershipId));

const outstandingMembers = memberships
  .filter(m => !pickedMembershipIds.has(m.id))
  .map(m => ({
    membershipId: m.id,
    email: m.user.email,
    displayName: m.user.name ?? m.user.email,
  }));

const submittedCount = picks.length;
```

**Important:** Load memberships and picks with `Promise.all` for the same parallel-fetch pattern used in `getTuesdayDigestData`.

### Season Query in getReminderData

Follow the **exact same** pattern as `getTuesdayDigestData` to resolve season + week:
- `resolveCurrentSeasonForLeague(prisma.season, leagueId)` → season row
- Load `NflGame` rows → filter for `kickoffAt != null` → `resolvePicksWeekNumber`
- Throw `NoActiveWeekError` and `LeagueNotFoundError` (from `get-tuesday-digest-data.ts`) on failure

**Do NOT** inline a new `getCurrentNflSeasonYear()` call — `resolveCurrentSeasonForLeague` already returns `nflSeasonYear`. Pattern already established in `getTuesdayDigestData`.

### Subject Line Pattern

```typescript
const subject = reminderType === 'wednesday'
  ? `[${data.leagueName}] Week ${data.weekNumber} — Don't Forget Your Pick`
  : `[${data.leagueName}] Week ${data.weekNumber} — Pick Deadline in 1 Hour`;
```

### Idempotency Key Pattern

Per Story 6.1 convention — colon delimiter, per-member key:

```typescript
idempotencyKey: `${reminderType}-reminder:${leagueId}:${data.weekNumber}:${member.membershipId}`
// e.g. "wednesday-reminder:clxxxxxx:7:clmembership123"
//      "thursday-reminder:clxxxxxx:7:clmembership123"
```

### Idempotency Guard in Route Handlers

Check for existing `sentAt` before calling `sendReminder`:

```typescript
// In wednesday-reminder/route.ts (after auth/admin check)
const data = await getReminderData({ leagueId });
const existing = await prisma.leagueWeekEmailConfig.findUnique({
  where: { leagueId_nflSeasonYear_weekNumber: { leagueId, nflSeasonYear: data.nflSeasonYear, weekNumber: data.weekNumber } },
  select: { wednesdayReminderSentAt: true },
});
if (existing?.wednesdayReminderSentAt != null && !force) {
  return NextResponse.json({ error: { code: 'ALREADY_SENT', message: '...' } }, { status: 409 });
}
const result = await sendReminder({ leagueId, reminderType: 'wednesday' });
```

**Note:** This has the same TOCTOU race as `tuesday-send` (already accepted in deferred-work.md — Resend idempotency keys mitigate within 24h).

### Admin Auth Guard Pattern

All three new routes must use `assertCookieSessionMutationOrigin` before `auth()` and the same ADMIN membership check used in `tuesday-send/route.ts`:

```typescript
const csrfError = assertCookieSessionMutationOrigin(request);
if (csrfError) return csrfError;

const session = await auth();
if (!session?.user?.id) return 401 UNAUTHENTICATED;

const membership = await prisma.leagueMembership.findUnique({...});
if (!membership || membership.role !== LeagueMembershipRole.ADMIN) return 403 FORBIDDEN;
```

### `AdminReminderControls` — UX Spec Alignment

From UX spec and project conventions:
- Use MUI `Stack` for flex layouts (not `Box`)
- "Send Wednesday Reminder" button: `variant="outlined"` with `color="info"` (info blue — matches preview button style in `AdminEmailComposer`)
- "Send Thursday Reminder" button: `variant="outlined"` with `color="warning"` (warning orange — conveys urgency)
- Contained in a `Paper` card (`background.paper`, 16px radius, 16px padding) — `sx={{ p: 2, borderRadius: 2 }}` — same as `AdminEmailComposer`
- All buttons 48px height minimum for touch target compliance
- Outstanding count copy: `"X member(s) haven't submitted a pick for Week N"` — `variant="body2"` with `color="text.secondary"`

Since `AdminReminderControls` needs hooks, fetch calls, and event handlers, it **must** have `"use client"` at the top — consistent with `AdminEmailComposer` and `AdminDashboardClient`.

### Scope Boundaries — What Is NOT in This Story

- ❌ Cron routes for Wednesday/Thursday reminders — Story 6.5
- ❌ `CRON_SECRET` verification — Story 6.5
- ❌ Auth magic link tokens in email deep links — Story 6.4 (picks link in 6.3 is plain URL like Tuesday digest)
- ❌ Webhook delivery confirmation tracking (NFR32) — Story 6.5
- ❌ Admin note / body text on reminder emails (reminders are pre-set content only — no admin-editable body)

### Deferred Work to Address Before Implementation

From `deferred-work.md`:
- No open deferred items block this story. The TOCTOU race and sequential send timeout patterns from 6.2 are already documented as deferred and apply here too (same `sendWithRetry` + Resend idempotency pattern).

### `from` Address

Same placeholder as Stories 6.1 and 6.2:
`'Pick Six <noreply@yourdomain.com>'`
**DO NOT** change until Resend sending domain is verified. See `deferred-work.md`: "Replace placeholder Resend `from` domain before production go-live".

### Testing Standards

- Vitest colocated `*.test.ts` per project conventions
- `get-reminder-data.test.ts`: mock `prisma` (and `getAppBaseUrl`); cover outstanding/submitted split, null jailed team, all-submitted empty-list case
- `ReminderEmail.tsx`: no unit test needed (presentational React Email template; same policy as `TuesdayDigestEmail.tsx`)
- `send-reminder.ts`: no unit test needed (fire-and-forget; same deferral policy as `send-tuesday-digest.ts`)
- API routes: no unit tests (same deferral as other admin routes)
- `npm test` must pass after all changes (currently: 309 tests from Story 6.2)

### Email Client Compatibility

Follow same patterns as `TuesdayDigestEmail.tsx`:
- Use `Section`, `Html`, `Body`, `Container`, `Heading`, `Text`, `Button` from `@react-email/components`
- Avoid Flexbox / CSS Grid directly — use React Email layout primitives
- Avoid complex CSS; keep styles inline where needed

### Non-Negotiables from Project Context

- `RESEND_API_KEY` server-only — never in client components or `NEXT_PUBLIC_*`
- One Prisma client — `import { prisma } from '@/lib/db'` (never `new PrismaClient()`)
- camelCase JSON ↔ snake_case DB via Prisma `@map` decorators
- Admin routes check `LeagueMembershipRole.ADMIN` in the application layer, not middleware
- MUI `Stack` for flex layouts (not `Box`) per project convention

### Relevant Existing Modules

| Module | Path | Used For |
|--------|------|----------|
| `getTuesdayDigestData` | `src/lib/email/get-tuesday-digest-data.ts` | Season/week resolution pattern to follow exactly |
| `NoActiveWeekError`, `LeagueNotFoundError` | `src/lib/email/get-tuesday-digest-data.ts` | Re-throw same error types in getReminderData |
| `sendWithRetry` | `src/lib/email/send-with-retry.ts` | Retry wrapper |
| `resend` singleton | `src/lib/email/resend-client.ts` | Resend client |
| `getAppBaseUrl` | `src/lib/email/app-base-url.ts` | Build absolute picks URL |
| `TuesdayDigestEmail` | `src/lib/email/templates/TuesdayDigestEmail.tsx` | Email template pattern to follow |
| `sendTuesdayDigest` | `src/lib/email/send-tuesday-digest.ts` | Send service pattern to follow |
| `assertCookieSessionMutationOrigin` | `src/lib/cookie-session-mutation-csrf.ts` | CSRF protection on POST routes |
| `auth` | `src/lib/auth.ts` | Session in Route Handlers |
| `prisma` | `src/lib/db.ts` | Single DB client |
| `resolveCurrentSeasonForLeague` | `src/lib/league/resolve-current-season.ts` | Get season row |
| `resolvePicksWeekNumber` | `src/lib/nfl/resolve-picks-week.ts` | Determine current active week |
| `AdminEmailComposer` | `src/components/admin/AdminEmailComposer.tsx` | Component pattern to follow; fetches tuesday-config |
| `buildSubmissionStatus` | `src/lib/admin/build-submission-status.ts` | Outstanding count source in admin page |

### Previous Story Intelligence (from Story 6.2)

Key learnings from 6.2 code review patches applied to this story:

1. **CSRF on mutating routes**: `assertCookieSessionMutationOrigin` before `auth()` on ALL POST routes — this was a patch in 6.2 and is built into tasks 5 and 6 here.

2. **sentAt guard**: Only set `*ReminderSentAt` when `sent > 0` (not unconditionally) — prevents permanently blocking resends after a zero-delivery run. Same logic as `sendTuesdayDigest.ts:80`.

3. **Preloaded data pattern**: `sendTuesdayDigest` accepts `preloadedData?` to avoid double data fetch. The `wednesday-reminder/route.ts` will call `getReminderData` first (for the sentAt check), then pass `preloadedData` to `sendReminder` — prevents double DB query + week-diverge race. Implement same `preloadedData?: ReminderData` parameter in `sendReminder`.

4. **Admin page passes `weekNumber` as prop**: `AdminEmailComposer` takes `weekNumber: number | null` from SSR. `AdminReminderControls` follows the same pattern — `weekNumber` passed from server to avoid client-side week resolution.

5. **`AdminEmailComposer` fetches config on mount**: Re-use this GET endpoint for `AdminReminderControls` by extending the tuesday-config response to include reminder timestamps. This avoids a new API endpoint.

6. **Scope discipline**: Routes and cron are Story 6.5. Don't create `/api/cron/` routes here — create only the `/api/leagues/[leagueId]/email/wednesday-reminder` and `thursday-reminder` routes that Story 6.5's cron will call.

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 6.3 acceptance criteria, FR37, FR38, FR40]
- [Source: _bmad-output/planning-artifacts/prd.md — FR37, FR38, FR39, FR40 requirement text]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — email as engagement channel, personalization by status, admin email configuration control]
- [Source: _bmad-output/planning-artifacts/architecture.md — cron strategy, email provider, admin auth, REST patterns]
- [Source: _bmad-output/implementation-artifacts/6-2-tuesday-6-00-pm-league-email-content-and-admin-preview.md — send service pattern, CSRF patches, sentAt guard, preloadedData pattern, AdminEmailComposer]
- [Source: _bmad-output/implementation-artifacts/6-1-transactional-email-integration.md — sendWithRetry, resend singleton, idempotency key pattern, `from` placeholder]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md — TOCTOU race, sequential send timeout, `from` domain placeholder]
- [Source: src/lib/email/get-tuesday-digest-data.ts — data service pattern to mirror exactly]
- [Source: src/lib/email/send-tuesday-digest.ts — send service pattern to mirror exactly]
- [Source: src/lib/email/templates/TuesdayDigestEmail.tsx — React Email template pattern]
- [Source: src/app/api/leagues/[leagueId]/email/tuesday-send/route.ts — route handler pattern to follow]
- [Source: src/app/api/leagues/[leagueId]/email/tuesday-config/route.ts — GET to extend; pattern to follow for new routes]
- [Source: src/lib/admin/build-submission-status.ts — outstanding member query pattern]
- [Source: src/app/(app)/leagues/[leagueId]/admin/page.tsx — admin page structure to extend]
- [Source: src/components/admin/AdminEmailComposer.tsx — client component pattern to follow]
- [Source: docs/project-context.md — non-negotiables, file organization]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

### Completion Notes List

- Added `wednesdayReminderSentAt` and `thursdayReminderSentAt` to `LeagueWeekEmailConfig` with migration `20260704214522_add_reminder_sent_at_to_league_week_email_configs`.
- Implemented `getReminderData`, `sendReminder` (with `preloadedData` to avoid double fetch), `ReminderEmail` template, and admin POST routes for Wednesday/Thursday reminders.
- Extended `tuesday-config` GET to expose reminder timestamps for `AdminReminderControls`.
- Added admin UI section with outstanding count, send buttons, last-sent timestamps, and disabled states for no active week / all submitted.
- Added 4 unit tests in `get-reminder-data.test.ts`; full suite: 313 tests passing.

### Manual Browser Testing Steps

1. Start dev server (`npm run dev`) and sign in as a league **admin** with an active week and at least one member who has **not** submitted a pick.
2. Open `/leagues/[leagueId]/admin` — confirm **Reminder Emails** section shows outstanding member count and enabled Send buttons.
3. Click **Send Wednesday Reminder** — expect success alert, "Wednesday last sent" timestamp, and Resend blocked on second click (409 warning).
4. With all members submitted (or zero outstanding), confirm buttons are disabled and copy reads "All members have submitted picks".
5. Repeat step 3 with **Send Thursday Reminder** (independent timestamp).
6. Optional: in a league with no active week, confirm "No active week for reminders" disabled state.

### File List

- `prisma/schema.prisma` (modified)
- `prisma/migrations/20260704214522_add_reminder_sent_at_to_league_week_email_configs/migration.sql` (new)
- `src/lib/email/get-reminder-data.ts` (new)
- `src/lib/email/get-reminder-data.test.ts` (new)
- `src/lib/email/send-reminder.ts` (new)
- `src/lib/email/templates/ReminderEmail.tsx` (new)
- `src/app/api/leagues/[leagueId]/email/wednesday-reminder/route.ts` (new)
- `src/app/api/leagues/[leagueId]/email/thursday-reminder/route.ts` (new)
- `src/app/api/leagues/[leagueId]/email/tuesday-config/route.ts` (modified)
- `src/components/admin/AdminReminderControls.tsx` (new)
- `src/app/(app)/leagues/[leagueId]/admin/page.tsx` (modified)

## Change Log

- 2026-07-04: Story 6.3 — Wednesday/Thursday reminder emails, admin controls, and idempotent send routes.
