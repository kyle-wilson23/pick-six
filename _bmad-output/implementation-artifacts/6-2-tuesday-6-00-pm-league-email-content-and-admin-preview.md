# Story 6.2: Tuesday 6:00 PM League Email Content and Admin Preview

Status: done

## Story

As a league admin,
I want participants to receive a Tuesday digest email with current standings, the jailed team, and a picks link — and I want to optionally add a custom message before the send,
So that the weekly email is informative, personalized, and I can preview it before it goes out (UX + FR35, FR36).

## Acceptance Criteria

1. **Given** the Tuesday digest send is triggered (admin "Send Now" or Story 6.5 cron)  
   **When** the send completes  
   **Then** every active league member receives the email containing:
   - League name and current NFL week number in the subject
   - Current league standings (rank, name, points)
   - Jailed team name and abbreviation for the week — or a "not yet computed" placeholder if `NflWeekJailedTeam` row doesn't exist for the week
   - A direct link to the league's picks page (`/leagues/[leagueId]/picks`)
   - The admin's optional body note (if set)
   - Sends use `sendWithRetry` (Story 6.1) and log outcomes with `[email]` prefix (NFR27)

2. **Given** a league admin opens the admin dashboard  
   **When** the Email section loads  
   **Then** they see:
   - Current week number label
   - Optional body text textarea (pre-populated from DB if previously saved)
   - "Preview" button (opens rendered email HTML in a new browser tab)
   - "Send Now" button (calls send endpoint)
   - "Last sent" timestamp if `sentAt` is already recorded for the week

3. **Given** the admin types body text and saves it  
   **When** `PUT /api/leagues/[leagueId]/email/tuesday-config` is called  
   **Then** the text is upserted to `league_week_email_configs` for `(leagueId, nflSeasonYear, weekNumber)` and the UI reflects the saved state

4. **Given** the admin clicks "Preview"  
   **When** the browser navigates to `GET /api/leagues/[leagueId]/email/tuesday-preview`  
   **Then** the full React Email template renders to HTML using current live data (standings, jailed team, saved body text) and the browser displays it inline as `text/html`

5. **Given** the admin clicks "Send Now"  
   **When** `POST /api/leagues/[leagueId]/email/tuesday-send` completes  
   **Then** one email per active member is sent via Resend, `sentAt` is recorded on the `league_week_email_configs` row, and the UI shows "Sent at [timestamp]"

6. **Given** `sentAt` is already set for this `(leagueId, nflSeasonYear, weekNumber)`  
   **When** the admin calls `POST /api/leagues/[leagueId]/email/tuesday-send` again without a force flag  
   **Then** the API returns `409` with `{ "error": { "code": "ALREADY_SENT", "message": "..." } }` and the UI shows "Already sent — add ?force=true to resend"; Story 6.5 cron relies on this guard for idempotency

7. **Given** only league admins may access these email routes  
   **When** a non-admin or unauthenticated caller hits any `/email/tuesday-*` endpoint  
   **Then** the response is `403` or `401` respectively — same admin guard pattern as other admin routes

## Tasks / Subtasks

- [x] Task 1: DB schema and migration — `league_week_email_configs` table (AC: #3, #5, #6)
  - [x] Add `LeagueWeekEmailConfig` model to `prisma/schema.prisma` (see Dev Notes — Schema)
  - [x] Add `leagueWeekEmailConfigs LeagueWeekEmailConfig[]` relation to `League` model
  - [x] Run `npx prisma migrate dev --name add_league_week_email_configs` and commit migration SQL

- [x] Task 2: React Email template — `TuesdayDigestEmail.tsx` (AC: #1)
  - [x] Create `src/lib/email/templates/TuesdayDigestEmail.tsx`
  - [x] Props: `TuesdayDigestEmailProps` — see Dev Notes for full prop shape
  - [x] Sections: subject header, standings table, jailed team callout, picks link CTA button, optional admin note
  - [x] Jailed team: render team name + abbreviation if present; render fallback text if `jailedTeamName` is `null`
  - [x] Picks link: `Button href={picksUrl}` from `@react-email/components`
  - [x] Keep visual styling minimal (text + spacing + one CTA button) — email clients are not browsers

- [x] Task 3: Data service — `src/lib/email/get-tuesday-digest-data.ts` (AC: #1, #4)
  - [x] Function: `getTuesdayDigestData({ leagueId }: { leagueId: string })`
  - [x] Returns: `TuesdayDigestData` — see Dev Notes for shape
  - [x] Steps:
    - [x] Load league name from DB
    - [x] Load season via `resolveCurrentSeasonForLeague` (already used in `build-submission-status.ts`)
    - [x] Resolve `weekNumber` with `resolvePicksWeekNumber` (same pattern as admin page)
    - [x] Load standings via `getLeagueStandings(prisma, { leagueId, nflSeasonYear })`
    - [x] Load jailed team for the week from `NflWeekJailedTeam` joined to `Team` — `null` if not yet computed
    - [x] Load all active members with their `user.email` and `user.name` for send recipients
    - [x] Build `picksUrl` using `getAppBaseUrl()`
  - [x] Write tests: `src/lib/email/get-tuesday-digest-data.test.ts` — mock Prisma; test jailed-absent path, standings-empty path

- [x] Task 4: Send service — `src/lib/email/send-tuesday-digest.ts` (AC: #1, #5)
  - [x] Function: `sendTuesdayDigest({ leagueId }: { leagueId: string }): Promise<{ sent: number; failed: number; sentAt: Date }>`
  - [x] Flow:
    - [x] Call `getTuesdayDigestData({ leagueId })`
    - [x] Load config row to get `bodyText` (`null` if not exists yet)
    - [x] For each member: call `sendWithRetry(...)` wrapping `resend.emails.send(...)` with:
      - `from: 'Pick Six <noreply@yourdomain.com>'` (same placeholder as 6.1)
      - `to: [member.email]`
      - `subject: \`[${data.leagueName}] Week ${data.weekNumber} — Tuesday Update\``
      - `react: createElement(TuesdayDigestEmail, props)`
      - `idempotencyKey: \`tuesday-digest:${leagueId}:${data.weekNumber}:${member.membershipId}\``
    - [x] Catch per-member failures; accumulate `sent` / `failed` counters
    - [x] After all sends: upsert `league_week_email_configs` with `sentAt = new Date()`
    - [x] Log `[email] tuesday digest sent` with `{ leagueName, weekNumber, sent, failed }`
  - [x] No tests required for this file (integration-level; pure data gather is tested in Task 3)

- [x] Task 5: API route — config CRUD — `src/app/api/leagues/[leagueId]/email/tuesday-config/route.ts` (AC: #3, #7)
  - [x] `GET`: load `league_week_email_configs` for current `(leagueId, nflSeasonYear, weekNumber)`; return `{ weekNumber, bodyText, sentAt }` or `{ weekNumber, bodyText: null, sentAt: null }` if no row
  - [x] `PUT`: Zod parse `{ weekNumber: z.number().int().min(1).max(18), bodyText: z.string().max(2000).nullable() }`; upsert `league_week_email_configs`; return updated row
  - [x] Auth guard: ADMIN role check (same pattern as other admin routes)

- [x] Task 6: API route — preview — `src/app/api/leagues/[leagueId]/email/tuesday-preview/route.ts` (AC: #4, #7)
  - [x] `GET`: call `getTuesdayDigestData`, load `bodyText` from config, render `TuesdayDigestEmail` via `render()` from `@react-email/components`
  - [x] Return `new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })`
  - [x] Auth guard: ADMIN role check

- [x] Task 7: API route — send — `src/app/api/leagues/[leagueId]/email/tuesday-send/route.ts` (AC: #5, #6, #7)
  - [x] `POST`: check `?force=true` query param; if `sentAt` already set and not `force`, return 409; else call `sendTuesdayDigest({ leagueId })`; return `{ sent, failed, sentAt }`
  - [x] Auth guard: ADMIN role check

- [x] Task 8: `AdminEmailComposer` UI component (AC: #2, #3, #4, #5)
  - [x] Create `src/components/admin/AdminEmailComposer.tsx` as `"use client"`
  - [x] Props: `{ leagueId: string; weekNumber: number | null }`
  - [x] On mount: `GET .../tuesday-config` to load `bodyText` and `sentAt`
  - [x] Use MUI `Stack` for layout, `TextField` (multiline, min 4 rows) for body text, `Button` variants for Preview and Send Now
  - [x] Preview button: `window.open(previewUrl, '_blank')` — opens new tab with rendered HTML
  - [x] Save: debounced PUT or explicit Save button — save `bodyText` on blur or explicit save click
  - [x] Send Now: POST to send endpoint; on 409 show "Already sent — add ?force=true to resend" advisory; on success show "Sent at [timestamp]"
  - [x] UX spec color treatment: Preview button = info blue (`info.main`); Send Now = emerald green (`primary.main`)
  - [x] If `weekNumber` is null (no active week): render a disabled state with copy "No active week for email"

- [x] Task 9: Wire `AdminEmailComposer` into admin page (AC: #2)
  - [x] In `src/app/(app)/leagues/[leagueId]/admin/page.tsx`, add `<AdminEmailComposer leagueId={leagueId} weekNumber={weekNumber} />` after `<AdminJailedVerification>` and before `<AdminAuditLog>`
  - [x] Add section heading "Weekly Email" above the component

- [x] Task 10: Fix pre-existing lint errors (pre-condition from Epic 5 retro deferred)
  - [x] Run `npm run lint` — check project-wide; especially `src/components/admin/AdminPickOverrideDialog.tsx`
  - [x] Fix any reported errors (goal: zero lint errors project-wide)
  - [x] Do NOT touch code outside the fix scope; lint only

- [x] Task 11: Tests for `get-tuesday-digest-data.ts` (AC: #1 coverage)
  - [x] `src/lib/email/get-tuesday-digest-data.test.ts`
  - [x] Test: jailed team present → populated `jailedTeamName` in result
  - [x] Test: jailed team absent for week → `jailedTeamName: null` in result
  - [x] Test: members list → includes all `leagueMemberships` with user email
  - [x] Mock Prisma; no live DB

## Dev Notes

### DB Schema Addition

Add to `prisma/schema.prisma` **before** the `Pick` model (for logical ordering):

```prisma
/// Stores per-week admin-editable email config and idempotency guard for the Tuesday digest (Story 6.2).
/// sentAt is set when `sendTuesdayDigest` completes; Story 6.5 cron skips if sentAt is already set.
model LeagueWeekEmailConfig {
  id            String    @id @default(cuid())
  leagueId      String    @map("league_id")
  nflSeasonYear Int       @map("nfl_season_year")
  weekNumber    Int       @map("week_number")
  /// Optional admin note appended to the Tuesday digest body text (UX: admin email config control).
  bodyText      String?   @map("body_text") @db.Text
  /// Populated when `sendTuesdayDigest` completes. Story 6.5 cron checks this to prevent duplicate sends.
  sentAt        DateTime? @map("sent_at") @db.Timestamptz
  createdAt     DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt     DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  league League @relation(fields: [leagueId], references: [id], onDelete: Cascade)

  @@unique([leagueId, nflSeasonYear, weekNumber])
  @@index([leagueId, nflSeasonYear])
  @@map("league_week_email_configs")
}
```

Also add to the `League` model's relations:

```prisma
weekEmailConfigs LeagueWeekEmailConfig[]
```

**Migration command:**

```bash
npx prisma migrate dev --name add_league_week_email_configs
```

### File Structure After This Story

```
src/lib/email/
  app-base-url.ts              (exists — no change)
  resend-client.ts             (exists — no change)
  send-with-retry.ts           (exists — no change)
  send-invitation-email.ts     (exists — no change)
  get-tuesday-digest-data.ts   (NEW)
  get-tuesday-digest-data.test.ts (NEW)
  send-tuesday-digest.ts       (NEW)
  templates/
    InvitationEmail.tsx        (exists — no change)
    TuesdayDigestEmail.tsx     (NEW)

src/components/admin/
  AdminEmailComposer.tsx       (NEW — "use client")
  AdminPickOverrideDialog.tsx  (exists — lint fix only if needed)

src/app/api/leagues/[leagueId]/email/
  tuesday-config/route.ts      (NEW)
  tuesday-preview/route.ts     (NEW)
  tuesday-send/route.ts        (NEW)
```

### `TuesdayDigestEmailProps` Shape

```typescript
export type TuesdayDigestEmailProps = {
  leagueName: string;
  weekNumber: number;
  standings: Array<{
    rank: number;
    displayName: string;
    totalPoints: number;
    wins: number;
    losses: number;
  }>;
  jailedTeamName: string | null;       // null → render "Not yet computed for this week"
  jailedTeamAbbreviation: string | null;
  picksUrl: string;                    // absolute URL to /leagues/[leagueId]/picks
  adminNote: string | null;            // from LeagueWeekEmailConfig.bodyText
};
```

### `TuesdayDigestData` Shape (returned by `getTuesdayDigestData`)

```typescript
export type TuesdayDigestData = {
  leagueName: string;
  leagueId: string;
  nflSeasonYear: number;
  weekNumber: number;
  standings: StandingsEntry[];         // from getLeagueStandings
  jailedTeamName: string | null;
  jailedTeamAbbreviation: string | null;
  picksUrl: string;
  members: Array<{
    membershipId: string;
    email: string;
    displayName: string;
  }>;
};
```

### Data Gathering Pattern

`getTuesdayDigestData` follows the same DB query pattern used in `build-submission-status.ts`:

```typescript
// src/lib/email/get-tuesday-digest-data.ts
import { prisma } from '@/lib/db';
import { getCurrentNflSeasonYear } from '@/lib/nfl/current-season';
import { resolveCurrentSeasonForLeague } from '@/lib/league/resolve-current-season';
import { resolvePicksWeekNumber } from '@/lib/nfl/resolve-picks-week';
import { getLeagueStandings } from '@/lib/scoring/get-league-standings';
import { getAppBaseUrl } from '@/lib/email/app-base-url';

// ... load season → games → resolvePicksWeekNumber
// ... load jailed: prisma.nflWeekJailedTeam.findUnique({ where: { nflSeasonYear_weekNumber: { nflSeasonYear, weekNumber } }, include: { jailedTeam: { select: { name: true, abbreviation: true } } } })
// ... load members: prisma.leagueMembership.findMany({ where: { leagueId }, include: { user: { select: { email: true, name: true } } } })
// ... picksUrl = `${getAppBaseUrl()}/leagues/${leagueId}/picks`
```

Do NOT add a new `getCurrentNflSeasonYear` call if `resolveCurrentSeasonForLeague` already returns `nflSeasonYear` — check how it is used in `build-submission-status.ts` and reuse the same pattern exactly.

### Idempotency Key Pattern (Critical)

From Story 6.1 Dev Notes — use colon delimiter, per-member key:

```typescript
idempotencyKey: `tuesday-digest:${leagueId}:${weekNumber}:${member.membershipId}`
```

- `leagueId` is a CUID (no hyphens are field delimiters; safe with colon)
- Per-member keys allow Resend to deduplicate individual sends without blocking the whole batch

### Admin Auth Guard Pattern

All three new API routes must use the same auth check as existing admin routes (e.g., `src/app/api/admin/scoring/score-week/route.ts` or admin picks routes):

```typescript
const session = await auth();
if (!session?.user?.id) {
  return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: '...' } }, { status: 401 });
}
const membership = await prisma.leagueMembership.findUnique({
  where: { userId_leagueId: { userId: session.user.id, leagueId } },
});
if (!membership || membership.role !== LeagueMembershipRole.ADMIN) {
  return NextResponse.json({ error: { code: 'FORBIDDEN', message: '...' } }, { status: 403 });
}
```

### AdminEmailComposer Component — UX Spec Alignment

From UX spec (`ux-design-specification.md`, `AdminEmailComposer` section):

- Contained in a `Paper` card (`background.paper`, 16px radius, 16px padding) — or use a MUI `Paper` with `sx={{ p: 2, borderRadius: 2 }}`
- Subject line and body textarea using standard themed `TextField` inputs
- Preview button: `variant="outlined"` with `color="info"` — renders info blue
- Send Now button: `variant="contained"` with `color="primary"` — renders emerald green
- Textarea: `multiline rows={4}` minimum
- Desktop layout: the UX spec mentions a 2-column layout for the full admin surface; keep it full-width for MVP — the 2-column layout is a layout concern for a separate story; focus on the composer functionality

Since `AdminEmailComposer` is client-interactive (hooks, fetch calls, event handlers), it **must** have `"use client"` at the top — consistent with all other interactive admin components (`AdminDashboardClient`, `AdminPickOverrideDialog`).

### Subject Line Pattern

```typescript
`[${data.leagueName}] Week ${data.weekNumber} — Tuesday Update`
```

### `from` Address

Same placeholder as Story 6.1 — `'Pick Six <noreply@yourdomain.com>'`. DO NOT change it until the Resend sending domain is verified (see deferred-work.md: "Replace placeholder Resend `from` domain before production go-live").

### Email Client Compatibility

React Email components (`@react-email/components`) render email-safe HTML. Avoid complex CSS — email clients (Gmail, Outlook) do not support Flexbox, CSS Grid, or external stylesheets. Use:
- `Section`, `Row`, `Column` from `@react-email/components` for layout
- Inline styles where needed
- Avoid `display: flex` directly — use React Email layout primitives instead

For the standings table, use an HTML `<table>` via `@react-email/components`'s `<Html>` context; React Email does not provide a `<Table>` component, so use raw `<table>/<tr>/<td>` JSX inside the `Html` wrapper.

### Preview Route — render() Usage

```typescript
import { render } from '@react-email/components';
import { createElement } from 'react';
import { TuesdayDigestEmail } from '@/lib/email/templates/TuesdayDigestEmail';

const html = await render(createElement(TuesdayDigestEmail, props));
return new Response(html, {
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
});
```

### Story 6.5 Integration Note

`sentAt` in `LeagueWeekEmailConfig` is the idempotency guard for the Story 6.5 cron:
- Story 6.5 cron will call `sendTuesdayDigest({ leagueId })` conditionally after checking `sentAt`
- The "Send Now" admin button calls `sendTuesdayDigest` directly (same function)
- The `force=true` query param on the send route bypasses the 409 guard so admins can resend if something went wrong
- Story 6.5 does NOT use `force=true` — the cron simply skips if `sentAt` is set

### Scope Boundaries — What Is NOT in This Story

- ❌ Cron routes (`/api/cron/tuesday-email/`) — Story 6.5
- ❌ `CRON_SECRET` verification — Story 6.5
- ❌ Per-pick-status personalization (different email body for submitted vs. outstanding) — Story 6.3 reminder pattern
- ❌ Email deep links with auth magic tokens — Story 6.4 (the picks link in 6.2 is a plain URL)
- ❌ Wednesday/Thursday reminder emails — Story 6.3
- ❌ Webhook delivery confirmation (NFR32) — Story 6.5

### Deferred Work to Close Before Implementation

From `deferred-work.md` — **Epic 5 retrospective**:
> `AdminPickOverrideDialog.tsx` pre-existing lint errors — "Fix at start of next story that touches the admin panel."

Task 10 covers this. Run `npm run lint` first; if no errors are reported the deferred item is already resolved and no action is needed. Document outcome in completion notes.

### Testing Standards

- Vitest colocated `*.test.ts` / `*.test.tsx` per project conventions
- `get-tuesday-digest-data.test.ts`: mock `prisma` and `getAppBaseUrl`; test all null/empty edge cases
- `TuesdayDigestEmail.tsx`: no unit test needed (presentational React Email template; preview route validates output)
- `send-tuesday-digest.ts`: no unit test needed at this stage (fire-and-forget; tested via admin send flow; integration deferred)
- API routes: no unit tests for the route layer at this stage (same deferral policy as other admin routes)
- `npm test` must pass after all changes (currently: 306 tests from Story 6.1)

### Non-Negotiables From Project Context

- `RESEND_API_KEY` server-only — never in client components or `NEXT_PUBLIC_*`
- One Prisma client — use `import { prisma } from '@/lib/db'` (never `new PrismaClient()`)
- camelCase JSON ↔ snake_case DB via Prisma `@map` decorators (already handled by schema convention)
- Admin routes check `LeagueMembershipRole.ADMIN` in the application layer, not middleware
- MUI `Stack` for flex layouts (not `Box`) per project convention

### Relevant Existing Modules

| Module | Path | Used For |
|--------|------|----------|
| `resolveCurrentSeasonForLeague` | `src/lib/league/resolve-current-season.ts` | Get season row for league |
| `resolvePicksWeekNumber` | `src/lib/nfl/resolve-picks-week.ts` | Determine current active week |
| `getLeagueStandings` | `src/lib/scoring/get-league-standings.ts` | Load standings for email |
| `sendWithRetry` | `src/lib/email/send-with-retry.ts` | Retry wrapper (Story 6.1) |
| `resend` singleton | `src/lib/email/resend-client.ts` | Resend client (Story 6.1) |
| `getAppBaseUrl` | `src/lib/email/app-base-url.ts` | Build absolute picks URL |
| `auth` | `src/lib/auth.ts` | Session in Route Handlers |
| `prisma` | `src/lib/db.ts` | Single DB client |

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 6.2 acceptance criteria, FR35, FR36]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — AdminEmailComposer anatomy, color treatment, layout]
- [Source: _bmad-output/planning-artifacts/architecture.md — cron strategy, email provider, admin auth, REST patterns]
- [Source: _bmad-output/implementation-artifacts/6-1-transactional-email-integration.md — sendWithRetry, resend singleton, idempotency key pattern, `from` placeholder, fire-and-forget pattern]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md — AdminPickOverrideDialog lint, `from` domain placeholder, no `server-only` imports]
- [Source: src/lib/email/send-invitation-email.ts — email send pattern to follow]
- [Source: src/lib/email/templates/InvitationEmail.tsx — React Email template to extend]
- [Source: src/lib/scoring/get-league-standings.ts — standings data shape]
- [Source: src/lib/admin/build-submission-status.ts — DB query and week-resolution pattern to reuse]
- [Source: src/app/(app)/leagues/[leagueId]/admin/page.tsx — admin page structure to extend]
- [Source: docs/project-context.md — non-negotiables, file organization]

## Dev Agent Record

### Agent Model Used

Composer (Cursor)

### Completion Notes List

- Added `LeagueWeekEmailConfig` Prisma model + migration for per-week body text and `sentAt` idempotency guard.
- Implemented Tuesday digest data gathering, React Email template, send service (Resend + `sendWithRetry`), and three admin API routes (config, preview, send).
- Added `AdminEmailComposer` to league admin dashboard with Save note, Preview (new tab HTML), and Send Now flows.
- Fixed pre-existing `AdminPickOverrideDialog` lint errors by removing setState-in-effect patterns (derived `effectiveAntiJailed`; parent already remounts dialog on open).
- 309 tests pass; zero ESLint errors project-wide.

### File List

- prisma/schema.prisma (modified)
- prisma/migrations/20260704203459_add_league_week_email_configs/migration.sql (new)
- src/lib/email/templates/TuesdayDigestEmail.tsx (new)
- src/lib/email/get-tuesday-digest-data.ts (new)
- src/lib/email/get-tuesday-digest-data.test.ts (new)
- src/lib/email/send-tuesday-digest.ts (new)
- src/app/api/leagues/[leagueId]/email/tuesday-config/route.ts (new)
- src/app/api/leagues/[leagueId]/email/tuesday-preview/route.ts (new)
- src/app/api/leagues/[leagueId]/email/tuesday-send/route.ts (new)
- src/components/admin/AdminEmailComposer.tsx (new)
- src/app/(app)/leagues/[leagueId]/admin/page.tsx (modified)
- src/components/admin/AdminPickOverrideDialog.tsx (modified — lint fix)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified)

### Review Findings

**Decision-needed (resolve before patching):**

- [x] [Review][Decision] `sentAt` written unconditionally when zero emails deliver — AC #5 says sentAt marks a successful send; if all Resend calls fail (`sent=0, failed>0`), sentAt is still upserted, permanently blocking the Story 6.5 cron and admin retry (409 ALREADY_SENT with zero deliveries). Partial-success policy also unclear: if 3 of 10 fail, should sentAt be set? Options: (a) Only set sentAt if `sent > 0`; (b) Always set sentAt but surface `sent`/`failed` counts prominently; (c) Set sentAt only when `failed === 0`. (`src/lib/email/send-tuesday-digest.ts`)
- [x] [Review][Decision] Preview opens DB-saved note, not current unsaved textarea content — AC #4 says "renders using current live data"; admin may reasonably expect the preview to match what's currently in the form. Options: (a) Auto-save before opening preview; (b) Pass current `bodyText` as a query param to the preview URL; (c) Show a UI hint "Save your note to see it in the preview." (`src/components/admin/AdminEmailComposer.tsx`, `src/app/api/leagues/[leagueId]/email/tuesday-preview/route.ts`)

**Patches (fix in next dev pass):**

- [x] [Review][Patch] UI shows success even when sent=0 — `handleSend` treats any 200 with `data.sentAt` as success; never reads `sent`/`failed` from response; "Sent at [timestamp]" displayed even if zero members received the email [`src/components/admin/AdminEmailComposer.tsx`]
- [x] [Review][Patch] Double `getTuesdayDigestData` call creates week-diverge risk — `tuesday-send/route.ts` calls `getTuesdayDigestData` to read sentAt, then `sendTuesdayDigest` calls it again internally; if the active week changes between calls the wrong week is targeted or the wrong sentAt row is checked [`src/app/api/leagues/[leagueId]/email/tuesday-send/route.ts`, `src/lib/email/send-tuesday-digest.ts`]
- [x] [Review][Patch] CSRF `assertCookieSessionMutationOrigin` missing on mutating email routes — `PUT /tuesday-config` and `POST /tuesday-send` do not call `assertCookieSessionMutationOrigin`, violating the project-wide NFR15 pattern present on every other mutating admin route [`src/app/api/leagues/[leagueId]/email/tuesday-config/route.ts`, `src/app/api/leagues/[leagueId]/email/tuesday-send/route.ts`]
- [x] [Review][Patch] Stale SSR `weekNumber` prop can diverge from live API week — `AdminEmailComposer` uses `weekNumber` from server-rendered props for the UI label and Save payload; if the page is kept open across a week rollover, the label shows old week and the Save may receive a 409 WEEK_MISMATCH with no user-friendly recovery; fix: update local weekNumber state from the config GET response [`src/components/admin/AdminEmailComposer.tsx`]
- [x] [Review][Patch] Missing league returns 500 instead of 404 — `getTuesdayDigestData` throws a generic `Error("League not found…")` for an invalid `leagueId`; all three routes catch only `NoActiveWeekError` and return 500 for everything else; should return 404 [`src/lib/email/get-tuesday-digest-data.ts`]

**Deferred:**

- [x] [Review][Defer] TOCTOU race on concurrent sends [`src/app/api/leagues/[leagueId]/email/tuesday-send/route.ts`] — deferred, pre-existing: two concurrent POSTs (double-click or cron+admin) can both pass the sentAt=null check before either upserts; Resend idempotency keys provide partial mitigation within 24h
- [x] [Review][Defer] Sequential per-member send may exceed serverless function timeout [`src/lib/email/send-tuesday-digest.ts`] — deferred, pre-existing: no `maxDuration` export; large leagues may time out mid-loop before sentAt is upserted
- [x] [Review][Defer] `force=true` resends to all members after 24h idempotency key expiry [`src/app/api/leagues/[leagueId]/email/tuesday-send/route.ts`] — deferred, pre-existing: after key expiry Resend deduplication no longer applies; members who received the original digest can get duplicates on a forced resend

## Change Log

- 2026-07-04: Story created (create-story workflow)
- 2026-07-04: Story implemented — Tuesday digest email content, admin preview/send UI, config API, and tests (dev-story workflow)
