# Story 4.2: Submit or Change Pick on Behalf (Including Post-Deadline)

Status: done

## Story

As a league admin,
I want to place or change any participant's pick at any time (including after the deadline),
so that edge cases are handled fairly (**FR29**, **FR30**).

## Acceptance Criteria

1. **Admin can submit or change a pick on behalf of any participant (API)**

   **Given** an authenticated league admin for the league

   **When** they POST to `POST /api/leagues/[leagueId]/admin/picks` with `{ targetMembershipId, teamId, nflWeekNumber, antiJailedBonus }`

   **Then** the pick is upserted for the target participant — 201 on first create for that membership+season+week, 200 on update

   **And** the same validation rules apply as for normal picks: duplicate team across season rejected (409), jailed team direct pick rejected (400) unless anti-jailed path, `teamId` must appear in that week's games (**FR31**)

   **And** deadline enforcement is **bypassed** — the admin may post at any time, pre- or post-deadline (**FR29**, **FR30**)

2. **Admin cannot select a team the target participant has already picked this season**

   **Given** the target participant has already picked `TeamA` in an earlier week of the same season

   **When** the admin submits an override pick for any other week in the same season with `teamId = TeamA`

   **Then** the API returns `409 DUPLICATE_TEAM` — same code as normal pick validation (**FR31**, **FR53**)

3. **Admin cannot submit a jailed team pick via direct path**

   **Given** the jailed team for the week is `JailTeam`

   **When** admin submits with `teamId = JailTeam` and `antiJailedBonus = false`

   **Then** API returns `400 JAILED_TEAM_PICK` — same as normal pick validation (**FR31**)

   **And** admin CAN submit `teamId = <opponent of JailTeam>` with `antiJailedBonus = true` (anti-jailed path) — picks the jailed team's opponent to earn the +2 bonus, same as normal picks

4. **Admin-only access enforced on the API route**

   **Given** the POST route at `/api/leagues/[leagueId]/admin/picks`

   **When** an unauthenticated caller or a caller with MEMBER role (not ADMIN) sends a POST

   **Then** 401 is returned for unauthenticated, 403 for authenticated non-admins (**NFR16**)

5. **Override UI — "Override pick" / "Change pick" button on each participant card**

   **Given** the admin dashboard at `/leagues/[leagueId]/admin`

   **When** the current week is active (weekNumber is not null) **and** jailed data for the week has been computed

   **Then** each `AdminSubmissionCard` shows an "Override pick" button (if no current pick) or "Change pick" button (if a pick exists)

   **And** clicking it opens an `AdminPickOverrideDialog` (MUI `Dialog`) for that participant

   **And** the dialog shows the participant's name prominently and their current pick (if any)

6. **Override dialog — team selector with correct disabled/jailed states**

   **Given** the `AdminPickOverrideDialog` is open for participant P

   **When** the admin views the team list

   **Then** teams not playing this week are excluded (only teams from this week's `NflGame` rows appear)

   **And** teams P has already picked this season (other weeks) are shown as disabled/unavailable

   **And** the jailed team is highlighted with a "JAILED" label

   **And** an "Anti-jailed bonus (+2 pts)" toggle is shown only when the jailed team's **opponent** is selected (picking the opponent earns the +2 bonus — the jailed team itself cannot be picked)

   **And** the currently active pick for this week (if any) is pre-selected

7. **Override dialog — submit and success feedback**

   **Given** the admin selects a valid team in the override dialog

   **When** they click "Save pick"

   **Then** `POST /api/leagues/[leagueId]/admin/picks` is called

   **And** on success: the dialog closes and the admin dashboard page refreshes via `router.refresh()` (App Router pattern — no full page reload)

   **And** on validation error (duplicate, jailed): an inline `Alert` error shows inside the dialog without closing it

   **And** "Save pick" is disabled during the in-flight request

8. **firstCompetitionWeek locks on first pick for the season**

   **Given** the season has never had any pick submitted (count = 0 for this seasonId across all members)

   **When** the admin submits the very first override pick for the season

   **Then** `season.firstCompetitionWeekLockedAt` is set — same behavior as the regular pick route (**Story 2.7** immutability rule)

---

## Tasks / Subtasks

- [x] **New Zod schema: `src/lib/admin/admin-pick-body.ts`** (AC: #1)
  - [x] Define `adminPickBodySchema` with fields: `targetMembershipId: z.string().min(1)`, `teamId: z.string().min(1)`, `nflWeekNumber: z.number().int().min(1).max(18)`, `antiJailedBonus: z.boolean().default(false)`
  - [x] Export `AdminPickBody` type

- [x] **New lib: `src/lib/admin/submit-pick-on-behalf.ts`** (AC: #1, #2, #3, #8)
  - [x] Extract core mutation logic here for testability (same pattern as `buildSubmissionStatus` extracting query logic from the route)
  - [x] Accept `{ leagueId, adminMembershipId, targetMembershipId, teamId, nflWeekNumber, antiJailedBonus }` — include `adminMembershipId` now so Story 4.3 audit log can slot in without a refactor
  - [x] Run inside caller-supplied `prisma.$transaction` (accept a transaction client `Tx` as arg, like `runPickMutation`)
  - [x] Steps (in order):
    - [x] `resolveCurrentSeasonForLeague` → 404 if missing
    - [x] Check `season.preSeasonInitializedAt` → 400 if not initialized
    - [x] `isWeekInLeagueCompetition(season, nflWeekNumber)` → 400 if false
    - [x] Validate `targetMembershipId` belongs to this league: `tx.leagueMembership.findFirst({ where: { id: targetMembershipId, leagueId } })` → 404 if missing
    - [x] Load jailed team → 400 if not yet computed (`JAILED_NOT_COMPUTED`)
    - [x] Load week games → 400 if empty (`GAMES_NOT_LOADED`)
    - [x] **DO NOT call `checkPickMutationDeadline`** — admin bypasses deadline (FR29/FR30)
    - [x] `validateJailedLineupAndBonus` — same call as regular pick route
    - [x] Load `otherWeekPicks` for `targetMembershipId` (not caller) for duplicate check
    - [x] `validateDuplicateTeamAcrossSeason` — same call
    - [x] Lock `firstCompetitionWeek` if first pick for season (count all picks for `seasonId`)
    - [x] `tx.pick.upsert` for `targetMembershipId` — same upsert structure as `runPickMutation`
  - [x] Return `{ type: "ok", status: 200 | 201, body: { pick: ... } }` or `{ type: "err", status, code, message }`

- [x] **New lib test: `src/lib/admin/submit-pick-on-behalf.test.ts`** (AC: #1–#4, #8)
  - [x] Mock `prisma` (align with `src/lib/admin/build-submission-status.test.ts`)
  - [x] Cover:
    - [x] Valid override, no prior picks → 201, pick created
    - [x] Valid override, existing pick → 200, pick updated
    - [x] Duplicate team (same team used in another week this season) → 409 DUPLICATE_TEAM
    - [x] Jailed direct pick → 400 JAILED_TEAM_PICK
    - [x] Anti-jailed path (opponent + `antiJailedBonus: true`) → 201 success
    - [x] Post-deadline (pass `now` argument past Thursday 8:10 PM) → succeeds (no deadline block)
    - [x] Target membership not in league → 404 MEMBER_NOT_FOUND
    - [x] Week not in competition window → 400 WEEK_NOT_IN_COMPETITION

- [x] **New API route: `src/app/api/leagues/[leagueId]/admin/picks/route.ts`** (AC: #1, #4)
  - [x] POST handler only (no GET needed at this stage)
  - [x] Read JSON body first → `adminPickBodySchema.safeParse` → 400 on invalid
  - [x] `assertCookieSessionMutationOrigin(request)` before `auth()` (CSRF, same order as picks route)
  - [x] `auth()` → 401 if no session
  - [x] `prisma.leagueMembership.findUnique({ where: { userId_leagueId: { userId, leagueId } } })` → 403 if not found or `role !== ADMIN`
  - [x] Run `prisma.$transaction` calling `submitPickOnBehalf`
  - [x] Return 201/200 + pick body on success; error JSON on failure

- [x] **New lib: `src/lib/admin/build-admin-override-data.ts`** (AC: #5, #6)
  - [x] Follow same week-resolution pattern as `buildSubmissionStatus` (season → all games → `resolvePicksWeekNumber`)
  - [x] If no active week or no jailed data → return `null` (override UI hidden)
  - [x] Load week games: `db.nflGame.findMany({ where: { nflSeasonYear, weekNumber }, include: { homeTeam: ..., awayTeam: ... } })`
  - [x] Load jailed: `db.nflWeekJailedTeam.findUnique` → if not found, return `null`
  - [x] Load all season picks: `db.pick.findMany({ where: { seasonId }, select: { leagueMembershipId: true, nflWeekNumber: true, teamId: true } })`
  - [x] Return typed `AdminOverrideData | null` (see Dev Notes for shape)

- [x] **Update `src/app/(app)/leagues/[leagueId]/admin/page.tsx`** (AC: #5, #6)
  - [x] Call `buildAdminOverrideData({ leagueId })` in parallel with `buildSubmissionStatus` via `Promise.all`
  - [x] If `overrideData` is not null and `weekNumber` is not null: render `AdminDashboardClient` instead of raw `Stack` + `AdminSubmissionCard` loop
  - [x] Pass serializable props only: `{ leagueId, weekNumber, participants, overrideData }` where `overrideData` has `{ jailedTeamId: string, games: GameTeamPair[], allSeasonPicks: ParticipantSeasonPick[] }`
  - [x] If `overrideData` is null (no jailed data yet) or `weekNumber` is null: fall back to existing read-only submission status layout (no override buttons)

- [x] **New client component: `src/components/admin/AdminDashboardClient.tsx`** (AC: #5, #7)
  - [x] `"use client"` at top
  - [x] Props: `{ leagueId: string; weekNumber: number; participants: AdminSubmissionStatusParticipant[]; overrideData: AdminOverrideData }`
  - [x] State: `overrideTarget: { membershipId: string; displayName: string; currentPick: SubmittedPick | null } | null`
  - [x] Render `AdminSubmissionCard` for each participant, passing `onOverride={() => setOverrideTarget({ membershipId, displayName, currentPick })}`
  - [x] When `overrideTarget !== null`, render `AdminPickOverrideDialog`
  - [x] On dialog success: `useRouter().refresh()` then `setOverrideTarget(null)`
  - [x] `priorPickTeamIds` for dialog: filter `overrideData.allSeasonPicks` to the target membership, exclude current week — `allSeasonPicks.filter(p => p.membershipId === membershipId && p.nflWeekNumber !== weekNumber).map(p => p.teamId)`
  - [x] Use **`Stack`** for flex layouts

- [x] **New client component: `src/components/admin/AdminPickOverrideDialog.tsx`** (AC: #6, #7)
  - [x] `"use client"` at top
  - [x] Props: `{ open: boolean; onClose: () => void; onSuccess: () => void; leagueId: string; weekNumber: number; targetMembershipId: string; displayName: string; currentPick: { teamId: string; teamName: string; antiJailedBonus: boolean } | null; weekGames: GameTeamPair[]; jailedTeamId: string; priorPickTeamIds: string[] }`
  - [x] State: `selectedTeamId`, `antiJailed`, `loading`, `error`
  - [x] MUI `Dialog`: `fullScreen` on `xs`/`sm` (use `useMediaQuery(theme.breakpoints.down('md'))`); `maxWidth="sm" fullWidth` on desktop
  - [x] `DialogTitle`: "Override pick for {displayName}"
  - [x] `DialogContent`:
    - [x] Current pick notice (if `currentPick`): `Typography` — "Current pick: {teamName}" or "No current pick yet"
    - [x] Team list: per `weekGames` pair, show home team chip + away team chip; clicking selects that team
    - [x] Each team chip: disabled (grayed, `disabled` prop on `Chip` or Button) if `priorPickTeamIds.includes(teamId)`
    - [x] Jailed team: show `Chip` label "JAILED" next to the team name (`warning.main` color); do NOT disable the jailed team — allow selection via anti-jailed path
    - [x] Anti-jailed toggle (`FormControlLabel` + `Checkbox`): shown when jailed opponent is selected (matches participant pick UX + domain validation)
    - [x] Inline error: `Alert severity="error"` shown when `error` state is set
  - [x] `DialogActions`:
    - [x] "Cancel" (`Button variant="text"`) → `onClose()`
    - [x] "Save pick" (`Button variant="contained"`) → disabled when `!selectedTeamId || loading`; calls `handleSubmit`
  - [x] `handleSubmit`: POST to `/api/leagues/${leagueId}/admin/picks`; on 200/201 call `onSuccess()`; on error set `error` from response JSON
  - [x] Use **`Stack`** for flex layouts inside dialog content

- [x] **Update `src/components/admin/AdminSubmissionCard.tsx`** (AC: #5)
  - [x] Add optional prop `onOverride?: () => void`
  - [x] When `onOverride` is defined: add a `Button` at bottom-right of card
    - [x] `submittedPick === null` → label "Override pick"
    - [x] `submittedPick !== null` → label "Change pick"
    - [x] `variant="outlined"` `size="small"` (secondary action)
    - [x] Calls `onOverride()` on click
  - [x] Keep backward compat: card renders exactly as before when `onOverride` is undefined

- [x] **`npm test` green; `npm run lint` / `npm run build`** before closing

### Review Findings

- [x] [Review][Decision] AC2 error code mismatch — resolved: spec updated to `DUPLICATE_TEAM` (matches pre-existing domain fn; no code change)
- [x] [Review][Decision] AC3 error code mismatch — resolved: spec updated to `JAILED_TEAM_PICK` (matches pre-existing domain fn; no code change)
- [x] [Review][Decision] AC3/AC6 anti-jailed toggle trigger — resolved: spec updated to "opponent selected"; implementation is correct per domain rules
- [x] [Review][Decision] Admin self-override — resolved: intentional per Story 2.6; documented in Dev Notes
- [x] [Review][Patch] `currentPick` shown as null in dialog when `weekPick` exists but `participant.submittedPick` is null (two parallel data sources can diverge) — prefer `weekPick.teamId` when available, treat team name as optional fallback [AdminDashboardClient.tsx:51-58]
- [x] [Review][Patch] Week number skew — `buildSubmissionStatus` and `buildAdminOverrideData` each call `resolvePicksWeekNumber` independently inside `Promise.all`; can disagree at a week boundary, causing games shown to not match the week being submitted — use `overrideData.weekNumber` as authority in `AdminDashboardClient` [page.tsx:52-55]
- [x] [Review][Patch] Dialog `useEffect` resets in-progress team selection if parent re-renders with changed `currentPick` while dialog is open — gate reset on `open` false→true transition only [AdminPickOverrideDialog.tsx:65-71]
- [x] [Review][Patch] Stale `antiJailedBonus: true` submitted invisibly when `antiJailedOpponentId` is null (jailed team not in week games) — checkbox hidden but state is not cleared; reset `antiJailed` to false when opponent cannot be resolved [AdminPickOverrideDialog.tsx:58-80]
- [x] [Review][Patch] `setLoading(false)` fires in `finally` after `onSuccess()` removes dialog from DOM — move `setLoading(false)` before `onSuccess()` call [AdminPickOverrideDialog.tsx:109-118]
- [x] [Review][Defer] `validateJailedLineupAndBonus` returns `JAILED_NOT_IN_WEEK_GAMES` for ALL team picks when jailed team has a bye — pre-existing domain bug not introduced by this story [src/lib/domain/picks.ts:79-88]
- [x] [Review][Defer] Concurrent admin submissions produce silent last-write-wins; both callers receive 201 — requires optimistic locking, larger scope [submit-pick-on-behalf.ts + route.ts]
- [x] [Review][Defer] `priorSeasonPickCount` fetched before `existing` check — theoretical lock-on-update if a concurrent delete occurs between the two queries; `updateMany` guard (`firstCompetitionWeekLockedAt: null`) prevents double-lock; negligible practical risk [submit-pick-on-behalf.ts:130-167]
- [x] [Review][Defer] TOCTOU role check — admin role fetched outside the transaction, pre-existing pattern across all admin routes in the codebase [route.ts:78-90]
- [x] [Review][Defer] Audit trail for `adminMembershipId` — intentionally deferred to Story 4.3 per Dev Notes [submit-pick-on-behalf.ts:45]
- [x] [Review][Defer] `allSeasonPicks` fetches all picks for the entire season regardless of league size — potential performance concern for large leagues late in season [build-admin-override-data.ts:101-108]

---

## Dev Notes

### Critical: No Deadline Check for Admin Override

The most important difference from `runPickMutation` in `picks/route.ts`:

```ts
// Regular picks — INCLUDE this check:
const deadlineBlock = checkPickMutationDeadline({ now, games: gamesWithKickoff });
if (deadlineBlock) return err(deadlineBlock.status, deadlineBlock.code, deadlineBlock.message);

// Admin override — OMIT this check entirely (FR29/FR30)
// Admin can override at any time including post-deadline
```

Do not add any time-based guard to the admin route. This is intentional and must be documented in the route file's JSDoc.

### Target Membership vs. Caller Membership

The pick is created for `targetMembershipId` (from body), not the admin's own membership. Every Prisma query that was scoped to `membership.id` in the regular route must use `targetMembershipId` instead:

```ts
// Regular pick route:
const otherWeekPicks = await tx.pick.findMany({
  where: { leagueMembershipId: membership.id, ... }
});

// Admin override — MUST use target:
const otherWeekPicks = await tx.pick.findMany({
  where: { leagueMembershipId: targetMembershipId, ... }
});

// Same for the upsert:
await tx.pick.upsert({
  where: { leagueMembershipId_seasonId_nflWeekNumber: { leagueMembershipId: targetMembershipId, ... } },
  create: { leagueMembershipId: targetMembershipId, ... },
  update: { teamId, antiJailedBonus },
  ...
})
```

### adminMembershipId Parameter — Future-Proofing for Story 4.3

Include `adminMembershipId` as a parameter in `submitPickOnBehalf` even though it is unused in this story. Story 4.3 adds `AuditLogEntry` and will call `submitPickOnBehalf` with this value to log the override actor. Adding it now costs nothing and avoids a refactor in 4.3.

```ts
export async function submitPickOnBehalf(
  tx: Tx,
  args: {
    leagueId: string;
    adminMembershipId: string; // Story 4.3: will be written to audit log — pass through now
    targetMembershipId: string;
    teamId: string;
    nflWeekNumber: number;
    antiJailedBonus: boolean;
  },
): Promise<RouteErr | RouteOk>
```

### firstCompetitionWeek Lock Logic (Verbatim from picks/route.ts)

Copy this block from `runPickMutation` into `submitPickOnBehalf`:

```ts
const priorSeasonPickCount = await tx.pick.count({
  where: { seasonId: season.id },
});
if (isFirstPickForSeason(priorSeasonPickCount) && isFirstCompetitionWeekEditable(season)) {
  await tx.season.updateMany({
    where: { id: season.id, firstCompetitionWeekLockedAt: null },
    data: { firstCompetitionWeekLockedAt: new Date() },
  });
}
```

This counts ALL picks for the season, not just the target member's picks. If the admin's override pick is the season's first ever, it locks the first competition week.

Imports needed: `isFirstPickForSeason`, `isFirstCompetitionWeekEditable` from `src/lib/league/first-competition-week.ts`.

### Target Membership Validation

Validate that `targetMembershipId` belongs to `leagueId` (not just that it exists in the DB globally):

```ts
const targetMembership = await tx.leagueMembership.findFirst({
  where: { id: targetMembershipId, leagueId },
  select: { id: true },
});
if (!targetMembership) {
  return err(404, "MEMBER_NOT_FOUND", "Target membership not found in this league");
}
```

### AdminOverrideData Type

```ts
// src/lib/admin/build-admin-override-data.ts

export type GameTeamPair = {
  homeTeamId: string;
  homeTeamName: string;
  homeTeamAbbreviation: string;
  awayTeamId: string;
  awayTeamName: string;
  awayTeamAbbreviation: string;
};

export type ParticipantSeasonPick = {
  membershipId: string;
  nflWeekNumber: number;
  teamId: string;
};

export type AdminOverrideData = {
  weekNumber: number;
  jailedTeamId: string;
  games: GameTeamPair[];
  allSeasonPicks: ParticipantSeasonPick[];
} | null;
```

All fields are serializable primitives — safe to pass as Next.js Server → Client props.

### Page Data Fetching (Parallel Queries)

```ts
// src/app/(app)/leagues/[leagueId]/admin/page.tsx
const [payload, overrideData] = await Promise.all([
  buildSubmissionStatus({ leagueId }),
  buildAdminOverrideData({ leagueId }),
]);
```

If `overrideData === null` (no active week, pre-season, or jailed not computed): render the read-only fallback (submission status list without override buttons — same as current implementation).

If `overrideData !== null` and `payload.weekNumber !== null`: render `AdminDashboardClient` with full override capability.

### router.refresh() for Post-Mutation Refresh

App Router pattern after a client mutation updates server data:

```ts
"use client";
import { useRouter } from "next/navigation";

// Inside AdminDashboardClient:
const router = useRouter();

// On success callback from dialog:
const handleOverrideSuccess = () => {
  router.refresh(); // re-runs Server Component data fetching for this page
  setOverrideTarget(null);
};
```

Do **not** use `window.location.reload()`. `router.refresh()` is the correct App Router pattern.

### "use client" Boundary — Important

`AdminDashboardClient` and `AdminPickOverrideDialog` must have `"use client"` at top. The page (`page.tsx`) stays as a Server Component (calls `auth()`, `prisma`, `buildSubmissionStatus`, `buildAdminOverrideData`).

Pass only serializable data across the boundary:
- ✅ strings, numbers, booleans, plain objects, plain arrays
- ❌ `Date` objects — convert to ISO string or epoch number before passing
- ❌ Prisma model instances — select only the fields you need

Per `.cursor/rules/next-rsc-client-boundaries.mdc`: MUI components with `sx={(t) => ...}` or `component={Link}` must be in `"use client"` files.

### AdminSubmissionCard — Backward Compat

The existing `AdminSubmissionCard` is already a `"use client"` component (uses MUI with theme `sx`). Adding `onOverride?: () => void` as an optional prop is backward-compatible. The current admin page renders `AdminSubmissionCard` directly; after this story the page renders `AdminDashboardClient` which renders the cards. Both paths work.

### Anti-Jailed Checkbox Auto-Reset

The anti-jailed bonus applies when the admin picks the **opponent** of the jailed team (not the jailed team itself — picking the jailed team is always rejected). Reset `antiJailed` state to `false` whenever the selected team is not the opponent:

```ts
const handleTeamSelect = (teamId: string) => {
  setSelectedTeamId(teamId);
  if (teamId !== antiJailedOpponentId) {
    setAntiJailed(false);
  }
};
```

### CSRF and Rate Limiting

- **CSRF**: `assertCookieSessionMutationOrigin(request)` — required for this POST (same-origin enforcement, same as all other state-changing API routes)
- **Rate limiting**: Not required for this admin POST. The proxy (`src/proxy.ts`) only rate-limits specific high-risk paths; admin override is admin-only and low-frequency. Add a comment in the route file documenting this decision.

### File Locations

| Area | File |
|------|------|
| Zod schema | `src/lib/admin/admin-pick-body.ts` |
| Mutation lib | `src/lib/admin/submit-pick-on-behalf.ts` |
| Mutation test | `src/lib/admin/submit-pick-on-behalf.test.ts` |
| Override data lib | `src/lib/admin/build-admin-override-data.ts` |
| API route | `src/app/api/leagues/[leagueId]/admin/picks/route.ts` |
| Dashboard client | `src/components/admin/AdminDashboardClient.tsx` |
| Override dialog | `src/components/admin/AdminPickOverrideDialog.tsx` |
| Updated card | `src/components/admin/AdminSubmissionCard.tsx` |
| Updated page | `src/app/(app)/leagues/[leagueId]/admin/page.tsx` |

### Imports to Reuse (Do Not Reinvent)

All validation functions already exist — use them verbatim:

```ts
import { validateDuplicateTeamAcrossSeason, validateJailedLineupAndBonus } from "@/lib/domain/picks";
import { isFirstPickForSeason, isFirstCompetitionWeekEditable } from "@/lib/league/first-competition-week";
import { isLeagueParticipantRole } from "@/lib/league/participant-membership";
import { resolveCurrentSeasonForLeague } from "@/lib/league/resolve-current-season";
import { isWeekInLeagueCompetition } from "@/lib/nfl/nfl-regular-season";
import { resolvePicksWeekNumber } from "@/lib/nfl/resolve-picks-week";
// NOTE: do NOT import checkPickMutationDeadline — intentionally omitted for admin override
import { assertCookieSessionMutationOrigin } from "@/lib/cookie-session-mutation-csrf";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
```

### Admin Auth Guard Pattern (API Route)

Identical to `submission-status/route.ts`:

```ts
const session = await auth();
if (!session?.user?.id) {
  return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required" } }, { status: 401 });
}
const { leagueId } = await context.params;
const adminMembership = await prisma.leagueMembership.findUnique({
  where: { userId_leagueId: { userId: session.user.id, leagueId } },
});
if (!adminMembership || adminMembership.role !== LeagueMembershipRole.ADMIN) {
  return NextResponse.json({ error: { code: "FORBIDDEN", message: "Admin role required" } }, { status: 403 });
}
```

Do **not** use `assertAuthorizedForNflOddsOps` — that is for global NFL admin routes (odds/schedule), not league-scoped admin.

### Admin Self-Override — Intentional

An admin who is also a league participant may submit `targetMembershipId = adminMembership.id` (their own membership) to place or change their own pick after the deadline. This is intentional: Story 2.6 established admins as full participants with the same pick obligations, and Story 4.2 extends the override capability to any participant — including the admin themselves. No guard is applied at the API layer. The deadline bypass is the stated purpose of this route (FR29/FR30).

### No Schema Changes

No new Prisma models are needed. `Pick`, `LeagueMembership`, `User`, `NflGame`, `NflWeekJailedTeam`, `Season` are all established and sufficient. The `AuditLogEntry` model comes in Story 4.3.

### Project Structure Notes

- `src/lib/admin/admin-pick-body.ts` — new file, consistent with `src/lib/picks/post-pick-body.ts` pattern
- `src/lib/admin/submit-pick-on-behalf.ts` — new file in existing `src/lib/admin/` module
- `src/lib/admin/build-admin-override-data.ts` — new file in existing `src/lib/admin/` module
- `src/app/api/leagues/[leagueId]/admin/picks/route.ts` — new nested route under existing `[leagueId]/admin/` directory (alongside `submission-status/route.ts`)
- `src/components/admin/AdminDashboardClient.tsx` — new client component in existing `src/components/admin/`
- `src/components/admin/AdminPickOverrideDialog.tsx` — new client component in existing `src/components/admin/`

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4, Story 4.2 AC + FR29, FR30, FR31, NFR16]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — AdminSubmissionCard (lines 1401–1424); Modal patterns (lines 1637–1650); Admin dashboard 2-column layout (line 1667)]
- [Source: `src/app/api/leagues/[leagueId]/picks/route.ts` — `runPickMutation` as the pattern to follow/adapt; all validation calls to reuse; firstCompetitionWeek lock logic to copy]
- [Source: `src/lib/admin/build-submission-status.ts` — week resolution pattern + module structure template]
- [Source: `src/app/api/leagues/[leagueId]/admin/submission-status/route.ts` — admin auth guard pattern]
- [Source: `src/components/admin/AdminSubmissionCard.tsx` — existing component to extend with override button]
- [Source: `src/app/(app)/leagues/[leagueId]/admin/page.tsx` — server page to extend with parallel data fetch]
- [Source: `src/lib/domain/picks.ts` — `validateJailedLineupAndBonus`, `validateDuplicateTeamAcrossSeason` (reuse verbatim)]
- [Source: `src/lib/picks/assert-pick-mutation-allowed.ts` — `checkPickMutationDeadline` (explicitly skip for admin override)]
- [Source: `src/lib/league/first-competition-week.ts` — `isFirstPickForSeason`, `isFirstCompetitionWeekEditable`]
- [Source: `src/lib/nfl/nfl-regular-season.ts` — `isWeekInLeagueCompetition`]
- [Source: `src/lib/picks/post-pick-body.ts` — `postPickBodySchema` as model for `adminPickBodySchema`]
- [Source: `src/lib/cookie-session-mutation-csrf.ts` — `assertCookieSessionMutationOrigin`]
- [Source: `docs/project-context.md` — non-negotiables #1 (secrets), #2 (Prisma singleton), #3 (server-auth), #6 (naming), #7 (error shape); MUI Stack for flex]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — no 4.1 deferred items impact this story; Story 4.3 will add audit log using `adminMembershipId` param]
- [Source: `.cursor/rules/next-rsc-client-boundaries.mdc` — "use client" rules for MUI + function props boundary]

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (Cursor agent)

### Debug Log References

### Completion Notes List

- Implemented admin pick override API (`POST /api/leagues/[leagueId]/admin/picks`) with full validation parity to participant picks except deadline bypass (FR29/FR30).
- Extracted `submitPickOnBehalf` mutation lib with 9 unit tests; includes `adminMembershipId` passthrough for Story 4.3 audit log.
- Admin dashboard shows Override/Change pick buttons when jailed data is available; `AdminPickOverrideDialog` uses MUI Dialog (fullScreen on mobile per UX modal patterns).
- Anti-jailed toggle shown when jailed opponent is selected (matches participant `MatchupCard` UX and `validateJailedLineupAndBonus` domain rules).
- All 227 tests pass; lint and build green.

### File List

- `src/lib/admin/admin-pick-body.ts` (new)
- `src/lib/admin/submit-pick-on-behalf.ts` (new)
- `src/lib/admin/submit-pick-on-behalf.test.ts` (new)
- `src/lib/admin/build-admin-override-data.ts` (new)
- `src/app/api/leagues/[leagueId]/admin/picks/route.ts` (new)
- `src/components/admin/AdminDashboardClient.tsx` (new)
- `src/components/admin/AdminPickOverrideDialog.tsx` (new)
- `src/components/admin/AdminSubmissionCard.tsx` (modified)
- `src/app/(app)/leagues/[leagueId]/admin/page.tsx` (modified)

### Change Log

- 2026-05-30: Story 4.2 — admin pick override API, mutation lib, override dialog UI, dashboard integration.
