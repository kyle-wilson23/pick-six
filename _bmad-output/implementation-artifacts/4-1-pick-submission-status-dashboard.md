# Story 4.1: Pick Submission Status Dashboard

Status: done

## Story

As a league admin,
I want to see who has submitted a pick for the current week,
so that I can nudge or override as needed (**FR28**).

## Acceptance Criteria

1. **Dashboard view — current week pick status per participant**

   **Given** an authenticated user who is an ADMIN of the league

   **When** they open the admin dashboard page for the league

   **Then** they see every league member (including themselves as admin) with their pick submission status for the current active competition week

   **And** each row shows: participant display name, "SUBMITTED" (green) or "PENDING" (amber) status, and either "Picked: {Team name} — submitted {timestamp}" or "No pick submitted yet" as a detail line

2. **Near real-time via browser refresh**

   **Given** the picks list may change while the admin has the page open

   **When** the admin manually refreshes the page (or a client-side reload is triggered)

   **Then** they see the current state of all submissions — manual refresh is explicitly acceptable (no WebSocket / live-push required per project context)

3. **Admin-only access enforced — page and API**

   **Given** the dashboard page at `/leagues/[leagueId]/admin`

   **When** a non-admin league member (role MEMBER) or unauthenticated user attempts to access the page or its backing API

   **Then** the page returns `notFound()` (same pattern as `/leagues/[leagueId]/settings`)

   **And** the API returns `403 FORBIDDEN` for authenticated non-admins, `401 UNAUTHENTICATED` for unauthenticated callers

4. **Week resolution — respects league first competition week**

   **Given** a league whose `firstCompetitionWeek` may be greater than 1 (Story 2.7)

   **When** the dashboard resolves the "current week" for display

   **Then** it uses the same week-resolver logic as the picks page (`resolvePicksWeekNumber`) so the active week matches what participants see

   **And** if no active week is resolvable (pre-season / no games loaded), the dashboard shows a graceful empty state rather than erroring

5. **Admin link surfaces updated**

   **Given** the league home page (`/leagues/[leagueId]`) already shows an admin section with `AdminLeagueRowActions`

   **When** the admin dashboard page is implemented

   **Then** an "Admin dashboard" link is added to `AdminLeagueRowActions` alongside existing Settings and Invites links

---

## Tasks / Subtasks

- [x] **New API route: `GET /api/leagues/[leagueId]/admin/submission-status`** (AC: #1, #2, #3, #4)
  - [x] Create `src/app/api/leagues/[leagueId]/admin/submission-status/route.ts`
  - [x] Auth guard: `auth()` → 401 if no session; `leagueMembership.role === ADMIN` → 403 if not admin
  - [x] Query: resolve season, resolve active week (use `resolvePicksWeekNumber` / `resolveCurrentSeasonForLeague`)
  - [x] Query: fetch all memberships for league (include `user { id, name, email }`)
  - [x] Query: fetch all picks for that season + weekNumber (include `team { name, abbreviation }`)
  - [x] Merge picks into membership list: each entry has `{ membershipId, displayName, submittedPick: { teamName, updatedAt } | null }`
  - [x] Return JSON: `{ weekNumber, participants: [...] }` — see Dev Notes for shape
  - [x] Return graceful response when no active week (no season, pre-season init not done, or no games): `{ weekNumber: null, participants: [] }` with `200`

- [x] **New lib: `src/lib/admin/build-submission-status.ts`** (AC: #1, #4)
  - [x] Extract the query + merge logic from the route into a pure function (pattern: `buildLeaguePicksWeekView` in `src/lib/picks/`)
  - [x] Accept `{ leagueId, now? }` — `now` injected for testability (align with `checkPickMutationDeadline` pattern)
  - [x] Return typed union `{ ok: true; payload: AdminSubmissionStatusPayload } | { ok: false; status: number; code: string; message: string }`

- [x] **New admin dashboard page: `src/app/(app)/leagues/[leagueId]/admin/page.tsx`** (AC: #1, #3, #5)
  - [x] Server Component — auth check + admin membership guard → `notFound()` if non-admin (match pattern in `settings/page.tsx`)
  - [x] Call `buildSubmissionStatus({ leagueId })` server-side (no client fetch needed for SSR)
  - [x] Render `AdminSubmissionCard` per participant
  - [x] Show active week number in heading: "Week N — Submission Status" (or "No active week" empty state)
  - [x] Include back-link to league home (`← {league.name}`)

- [x] **New component: `src/components/admin/AdminSubmissionCard.tsx`** (AC: #1)
  - [x] Per-participant card following UX spec `AdminSubmissionCard` design (line 1401–1424 of `ux-design-specification.md`)
  - [x] Props: `{ displayName: string; submittedPick: { teamName: string; antiJailedBonus: boolean; updatedAt: string } | null }`
  - [x] Status chip: `success.main` green for "SUBMITTED", `warning.main` amber for "PENDING" (MUI `Chip` with custom `sx`)
  - [x] Detail line: "Picked: {Team} (+2)" or "Picked: {Team}" + submitted timestamp for submitted; "No pick submitted yet" for pending
  - [x] Visual: `background.paper`, `borderRadius: 2` (= 16px), `p: 2` internal padding (UX spec)
  - [x] Use **`Stack`** for flex layouts (project context rule — never `Box` for flex)

- [x] **Update `AdminLeagueRowActions`** (AC: #5)
  - [x] Add "Admin dashboard" link: `href={/leagues/${leagueId}/admin}` alongside Settings and Invites
  - [x] File: `src/components/leagues/admin-league-row-actions.tsx`

- [x] **Tests** (pure query logic in `src/lib/admin/build-submission-status.ts`)
  - [x] Co-locate test at `src/lib/admin/build-submission-status.test.ts`
  - [x] Cover: submitted member shows pick data; pending member shows null; no season → graceful null payload; multiple members sorted correctly
  - [x] No live DB — mock `prisma` (align with patterns in `src/lib/picks/map-current-pick.test.ts`)

- [x] **`npm test` green; `npm run lint` / `npm run build`** before closing

---

## Dev Notes

### Recommended API response shape

```ts
// GET /api/leagues/[leagueId]/admin/submission-status
type SubmissionStatusResponse = {
  weekNumber: number | null;     // null when no active week can be resolved
  participants: Array<{
    membershipId: string;
    displayName: string;         // user.name ?? user.email
    userId: string;
    submittedPick: {
      teamName: string;
      teamAbbreviation: string;
      antiJailedBonus: boolean;
      updatedAt: string;         // ISO UTC (updatedAt of Pick row)
    } | null;
  }>;
};
```

### Week resolution — do NOT reinvent, reuse existing resolvers

The current active week is resolved through this existing chain — **do not replicate this logic**:

1. `resolveCurrentSeasonForLeague(db.season, leagueId)` → `src/lib/league/resolve-current-season.ts`
2. Query `NflGame` rows for `nflSeasonYear`, filtered to `kickoffAt != null`
3. `resolvePicksWeekNumber(games, season, now)` → `src/lib/nfl/resolve-picks-week.ts`

This is identical to the flow in `buildLeaguePicksWeekView`. Calling `buildLeaguePicksWeekView` is **not** appropriate here (it builds the full matchup card payload for a participant). Instead, replicate only the week-resolution portion in `build-submission-status.ts`, or extract the week step into a shared utility if the pattern repeats.

If `resolvePicksWeekNumber` returns `null` (pre-season or no games), return `{ weekNumber: null, participants: [] }` — no error.

### Admin authorization — use existing role check pattern

Use the same pattern as `settings/page.tsx` (server component) and picks route (API):

```ts
// API route
const session = await auth();
if (!session?.user?.id) return 401;
const membership = await prisma.leagueMembership.findUnique({
  where: { userId_leagueId: { userId: session.user.id, leagueId } },
});
if (!membership) return 403;
if (membership.role !== LeagueMembershipRole.ADMIN) return 403;
```

**Do NOT** use `assertAuthorizedForNflOddsOps` — that's for global NFL admin routes (odds, schedule), not league-scoped admin operations.

### Pick data query design

```ts
// Fetch all picks for this league+season+week in one query
const picks = await prisma.pick.findMany({
  where: {
    seasonId: season.id,
    nflWeekNumber: weekNumber,
    leagueMembership: { leagueId },  // scope to this league
  },
  select: {
    leagueMembershipId: true,
    antiJailedBonus: true,
    updatedAt: true,
    team: { select: { name: true, abbreviation: true } },
  },
});
```

Merge into a `Map<membershipId, pick>` before joining to memberships list — O(n) join, no N+1.

### Memberships query — include user display info

```ts
const memberships = await prisma.leagueMembership.findMany({
  where: { leagueId },
  include: { user: { select: { id: true, name: true, email: true } } },
  orderBy: { createdAt: "asc" },  // stable sort; admin typically first
});
```

Display name: `user.name ?? user.email` (same convention used in `listLeagueRoster`).

### No `AuditLogEntry` model yet — that is Story 4.3

Story 4.1 does **not** introduce an audit log. The `Pick.updatedAt` timestamp is sufficient as the "submission time" shown in the dashboard.

### CSRF — not needed for this GET endpoint

This route is read-only (GET only). `assertCookieSessionMutationOrigin` is only for mutating routes (POST/PATCH/PUT/DELETE). Do not add CSRF check here.

### Rate limiting — not required for this GET

The proxy (`src/proxy.ts`) only rate-limits specific POST paths and DELETE `leagues/[leagueId]`. No new rate-limit entry needed for this GET route.

### File locations

| Area | File |
|------|------|
| API route | `src/app/api/leagues/[leagueId]/admin/submission-status/route.ts` |
| Lib query + merge | `src/lib/admin/build-submission-status.ts` |
| Lib test | `src/lib/admin/build-submission-status.test.ts` |
| Page (server component) | `src/app/(app)/leagues/[leagueId]/admin/page.tsx` |
| Card component | `src/components/admin/AdminSubmissionCard.tsx` |
| Updated admin links | `src/components/leagues/admin-league-row-actions.tsx` |

### Architecture compliance

- **Secrets server-only** (`docs/project-context.md` #1): No API keys involved. Session cookie only.
- **Single Prisma client** (`src/lib/db.ts`): `import { prisma } from "@/lib/db"` everywhere.
- **camelCase JSON / snake_case DB**: JSON response uses camelCase; Prisma maps snake_case via `@map`.
- **Consistent error JSON shape**: `{ error: { code: "SOME_CODE", message: "…" } }` — same as all other API routes.
- **Stack not Box for flex layouts**: Use `Stack` in `AdminSubmissionCard.tsx` and the page.
- **Server Component page**: The page does data-fetching on the server (call `buildSubmissionStatus`); no `"use client"` on the page. The `AdminSubmissionCard` component can be a pure Server Component since it receives serializable props only — no interactivity needed in this story.
- **Admin-only page guard**: `auth()` → membership lookup → `membership.role !== ADMIN` → `notFound()` — same as `settings/page.tsx`.
- **Pick visibility (FR48–FR49, project context #4)**: Admins CAN see all participants' picks at any time. This story is admin-only, so no privacy gate needed here. Non-admins are completely blocked by the auth guard.

### UX spec compliance (ux-design-specification.md lines 1401–1424)

**`AdminSubmissionCard` component anatomy:**
- Left: participant name (`Typography variant="body1"`)
- Right: status `Chip` — "SUBMITTED" (green `success.main` background at ~15% opacity, `success.main` text) or "PENDING" (amber `warning.main` bg at ~15%, `warning.main` text)
- Detail line: `Typography variant="body2" color="text.secondary"` — "Picked: {Team} — {timestamp}" or "No pick submitted yet"
- Container: `Paper` or `Box` with `sx={{ backgroundColor: "background.paper", borderRadius: 2, p: 2 }}`

**Page layout:**
- UX spec describes a 2-column admin layout on desktop (submission status left, email composer right)
- For Story 4.1, implement submission status list only (single column); the email composer is Epic 6. Keep the layout extensible with a named slot or note in code.
- `Stack spacing={1.5}` for the cards list; `maxWidth: 640` (consistent with picks page)

### Previous story intelligence (Epic 3)

- The most recent stories (3.9, 3.10) establish: fixture-based Vitest tests with no live network; `src/lib/integrations/*/` for external API clients; `src/lib/picks/` for picks domain logic; `src/lib/nfl/` for NFL-specific logic. The new `src/lib/admin/` folder follows this modular pattern.
- Story 3.7 established that `Pick.updatedAt` is accessible and is the canonical "last saved" timestamp shown in the picks status confirmation banner. Reuse this as "submitted at" in the admin dashboard.
- The NflOddsAdminPanel (settings page) demonstrates the pattern for admin-only client-side actions embedded in server pages — but Story 4.1 is pure read/server-render, so no client component needed beyond the existing `AdminLeagueRowActions` update.

### Testing priorities

1. **All members pending** — season has picks for 0 members this week → all `submittedPick: null`
2. **Mixed state** — some submitted, some pending → correct merge
3. **Admin sees their own pick** — admin membership appears in list
4. **No season** → graceful `{ weekNumber: null, participants: [] }`
5. **AntiJailedBonus visible** — submitted pick with `antiJailedBonus: true` shows "+2" in detail line

### Commit style

Follow Epic 3 / Epic 4 convention: `feat(admin): Story 4.1 pick submission status dashboard`

---

### Project Structure Notes

- `src/lib/admin/` is a **new** folder — consistent with `src/lib/picks/`, `src/lib/nfl/`, `src/lib/league/` modular organization.
- `src/components/admin/` is a **new** folder — consistent with `src/components/picks/`, `src/components/leagues/` component organization.
- `src/app/api/leagues/[leagueId]/admin/` is a **new** nested route under the existing `[leagueId]` dynamic segment — no conflict with existing routes (`picks/route.ts`, `invitations/route.ts`, `pre-season-init/route.ts`, etc.).
- No Prisma schema changes — `Pick`, `LeagueMembership`, `User`, `Team` are all established and sufficient.
- No new environment variables needed.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4 goal + Story 4.1 AC + FR28]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — lines 1401–1424 `AdminSubmissionCard`; lines 827, 875 admin dashboard description]
- [Source: `prisma/schema.prisma` — `Pick`, `LeagueMembership`, `User`, `Team` models]
- [Source: `src/app/(app)/leagues/[leagueId]/settings/page.tsx` — admin auth guard pattern (`role !== ADMIN → notFound()`)]
- [Source: `src/app/api/leagues/[leagueId]/picks/route.ts` — API auth + membership check pattern]
- [Source: `src/lib/picks/build-league-picks-week-view.ts` — `resolveCurrentSeasonForLeague` + week resolution chain]
- [Source: `src/lib/nfl/resolve-picks-week.ts` — `resolvePicksWeekNumber`]
- [Source: `src/components/leagues/admin-league-row-actions.tsx` — existing admin link surface to update]
- [Source: `src/components/picks/PickStatusBanner.tsx` — example of MUI Chip usage for status display]
- [Source: `docs/project-context.md` — non-negotiables #1 (secrets), #2 (Prisma singleton), #4 (pick visibility), #6 (naming), #7 (error shape); MUI Stack for flex layouts]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — no deferred items directly impact 4.1; Story 4.3 adds `AuditLogEntry` (not yet needed here)]

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (Cursor agent)

### Debug Log References

- Implemented `buildSubmissionStatus` with week resolution chain matching `buildLeaguePicksWeekView` (season → games → `resolvePicksWeekNumber`).
- Early return for no season / uninitialized pre-season before NFL game query.
- Exported `mergeSubmissionStatusParticipants` for pure merge logic tested independently.

### Completion Notes List

- Added admin submission status API (`GET /api/leagues/[leagueId]/admin/submission-status`) with 401/403 auth guards.
- Added `buildSubmissionStatus` lib with graceful `{ weekNumber: null, participants: [] }` for pre-season / no games.
- Added server-rendered admin dashboard page at `/leagues/[leagueId]/admin` with `AdminSubmissionCard` list.
- Added "Admin dashboard" link to `AdminLeagueRowActions`.
- 5 unit tests in `build-submission-status.test.ts`; full suite 218 tests green; lint and build pass.

### File List

- `src/lib/admin/build-submission-status.ts` (new)
- `src/lib/admin/build-submission-status.test.ts` (new)
- `src/app/api/leagues/[leagueId]/admin/submission-status/route.ts` (new)
- `src/app/(app)/leagues/[leagueId]/admin/page.tsx` (new)
- `src/components/admin/AdminSubmissionCard.tsx` (new)
- `src/components/leagues/admin-league-row-actions.tsx` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

## Review Findings

- [x] [Review][Decision] Dead `Err` branch — resolved Option B: simplified return type to `AdminSubmissionStatusPayload`, removed `Err` union and dead route forwarding block [`src/lib/admin/build-submission-status.ts` / `route.ts`]
- [x] [Review][Patch] `resolvePicksWeekNumber` null return unguarded — dismissed (false positive: `resolvePicksWeekNumber` always returns `number`, never `null`)
- [x] [Review][Patch] `now` signature is positional arg, not `{ leagueId, now? }` object per spec — dismissed (consistent with `buildLeaguePicksWeekView` pattern; spec cited wrong reference)
- [x] [Review][Patch] Empty participants with active week — added empty-state message [`src/app/(app)/leagues/[leagueId]/admin/page.tsx`]
- [x] [Review][Patch] RSC page: `buildSubmissionStatus` not wrapped in try/catch — added try/catch with `notFound()` on error [`src/app/(app)/leagues/[leagueId]/admin/page.tsx`]
- [x] [Review][Patch] `formatSubmittedTimestamp` has no guard for malformed ISO string — added `isNaN` guard [`src/components/admin/AdminSubmissionCard.tsx`]
- [x] [Review][Patch] Order-preservation test uses empty picks array — replaced with test that has a pick for the second member only [`src/lib/admin/build-submission-status.test.ts`]
- [x] [Review][Patch] Hardcoded `"+2"` label string — extracted to `ANTI_JAILED_BONUS_LABEL` constant [`src/components/admin/AdminSubmissionCard.tsx`]
- [x] [Review][Defer] Multiple picks per same `leagueMembershipId` — last write wins non-deterministically [`src/lib/admin/build-submission-status.ts:48-50`] — deferred, pre-existing (DB unique constraint prevents duplicate picks per member per week)
- [x] [Review][Defer] Empty string `user.email` yields blank `displayName` [`src/lib/admin/build-submission-status.ts:56`] — deferred, pre-existing (DB schema ensures non-empty email)
- [x] [Review][Defer] Sequential DB calls in page (membership → league → buildSubmissionStatus) [`src/app/(app)/leagues/[leagueId]/admin/page.tsx:23-44`] — deferred, performance optimization not correctness
- [x] [Review][Defer] nflGame with null `weekNumber` passes kickoffAt-only filter and enters week resolver [`src/lib/admin/build-submission-status.ts:111-113`] — deferred, pre-existing (schema constrains weekNumber as required)

## Change Log

- 2026-05-24: Story 4.1 implemented — admin pick submission status dashboard (API, lib, page, card, tests).
