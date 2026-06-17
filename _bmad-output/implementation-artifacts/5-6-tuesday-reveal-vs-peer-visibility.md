# Story 5.6: Tuesday Reveal vs Peer Visibility

Status: done

<!-- Note: Validate with validate-create-story for quality check before dev-story. -->

## Story

As a participant,
I want other players' picks hidden until after the Tuesday reveal,
So that the game stays fair — while admins always see the full picture (**FR47**, **FR48**, **FR49**, **NFR17**).

## Acceptance Criteria

### AC1 — Data function: `getLeaguePeerPickHistory`

**Given** `src/lib/scoring/get-league-peer-pick-history.ts` exports `getLeaguePeerPickHistory(prisma, { leagueId, nflSeasonYear, callerRole })`

**When** called for a league and season

**Then** it resolves the `Season` for `(leagueId, nflSeasonYear)` using `findUnique` with the composite key `{ leagueId_nflSeasonYear: { leagueId, nflSeasonYear } }`; if no season exists it returns `{ weeks: [] }` (not an error)

**And** it queries all `NflGame` rows for `nflSeasonYear` to determine which weeks are **revealed**: a week is revealed when **all** of its games have `status === "FINAL" || status === "CANCELLED"` — reuse the imported `isWeekFullyFinalized` from `@/lib/scoring/finalize-nfl-week`

**And** for **non-admin callers** (`callerRole !== LeagueMembershipRole.ADMIN`): picks are only included for **revealed weeks** (**FR48**, **NFR17**)

**And** for **admin callers** (`callerRole === LeagueMembershipRole.ADMIN`): picks are included for **all weeks that have at least one pick submitted**, regardless of reveal status (**FR49**)

**And** it queries all `Pick` rows for the season in a single `findMany`, including `team` (`abbreviation`, `name`) and `leagueMembership` → `user` (`name`, `email`) — display name is `user.name ?? user.email`

**And** it returns:

```ts
import type { LeagueMembershipRole } from "@prisma/client";
import type { PickHistoryOutcome } from "@/lib/scoring/get-personal-pick-history";

export type PeerPickEntry = {
  membershipId: string;
  displayName: string;
  teamAbbreviation: string;
  teamName: string;
  antiJailedBonus: boolean;
  outcome: PickHistoryOutcome; // "PENDING" when pick is not yet scored
  pointsEarned: number | null;
};

export type WeekPeerPicks = {
  weekNumber: number;
  isRevealed: boolean; // true when all games FINAL/CANCELLED
  entries: PeerPickEntry[]; // sorted ascending by displayName
};

export type LeaguePeerPickHistory = {
  weeks: WeekPeerPicks[]; // sorted descending by weekNumber (most recent first)
};
```

**And** outcome mapping mirrors `getPersonalPickHistory`: `Pick.outcome` enum → `PickHistoryOutcome`; `null` outcome → `"PENDING"`

**And** `pointsEarned` is `null` for PENDING picks, and `pointsEarned ?? 0` for scored picks

---

### AC2 — Results page

**Given** `src/app/(app)/leagues/[leagueId]/results/page.tsx`

**When** a logged-in league member visits `/leagues/[leagueId]/results`

**Then** the page is a **Server Component**: it calls `auth()`, resolves `LeagueMembership` via `userId_leagueId`, guards with `notFound()` if there is no session, no membership, non-participant role, or no league

**And** it calls `getLeaguePeerPickHistory(prisma, { leagueId, nflSeasonYear, callerRole: membership.role })` — **`callerRole` is derived from the session membership, never from a client query param**

**And** the page header mirrors the history/standings pages: a back link `← {league.name}` to `/leagues/[leagueId]` and an `h1` titled `League Results`

**And** it renders `LeagueResultsTable` with the `LeaguePeerPickHistory` result and `currentMembershipId={membership.id}` (so the UI can highlight the viewer's own row)

**And** it passes only plain serializable data (no functions, no Prisma objects)

---

### AC3 — `LeagueResultsTable` client component

**Given** `src/components/results/LeagueResultsTable.tsx` with `"use client"` at the top

**When** rendered with `history: LeaguePeerPickHistory` and `currentMembershipId: string`

**Then** it renders one section per week in `history.weeks` (already sorted descending — most recent first)

**And** each section shows a heading `Week {weekNumber}` and a MUI `Table` with columns: `Participant`, `Team`, `Result`, `Pts`

**And** the `Team` cell renders `TeamLogo` (`size="sm"`) alongside team abbreviation and name in a `Stack direction="row"` (same pattern as `PickHistoryTable` — import `TeamLogo` from `@/components/picks/TeamLogo`)

**And** the `Result` cell uses the **same tinted chip pattern** as `PickHistoryTable` (text + color, not color alone — WCAG 1.4.1):
- `WIN` → success-tinted `Chip size="small"` reading `WIN`
- `LOSS` → error-tinted `Chip` reading `LOSS`
- `TIE` → `text.secondary` `Chip` reading `TIE`
- `PENDING` → plain muted `—` in `text.secondary` (shown for admin-visible unrevealed weeks)

**And** when `entry.antiJailedBonus === true`, render the `2 PTS` chip inline — reuse the same gold chip style from `MatchupCard` (do not invent a new one; see `src/components/picks/MatchupCard.tsx`)

**And** the `Pts` cell shows `pointsEarned` with `color: "primary.main"`, `fontWeight: 700` for scored picks; muted `—` for PENDING; `fontVariantNumeric: "tabular-nums"` on all numeric cells

**And** the viewer's own row is highlighted (same `primary.main` at 8% opacity background row style as `StandingsTable` — see `src/components/standings/StandingsTable.tsx`) by comparing `entry.membershipId === currentMembershipId`

**And** when `history.weeks` is empty, render the empty state:
```
"League results will appear here after the first week is complete"
```
(`Typography variant="body2" color="text.secondary"` — consistent with existing empty-state pattern)

**And** when an admin is viewing and a week `!isRevealed`, render a muted pill / `Typography` label `"Not yet revealed"` next to the week heading (so admin can distinguish unrevealed weeks from revealed ones)

**And** the component uses **`Stack`** for any flex layout wrappers (project convention; not `Box`)

---

### AC4 — Hub navigation

**Given** `src/app/(app)/leagues/[leagueId]/page.tsx`

**When** a member views the league hub links section

**Then** a `Results` link pointing to `/leagues/[leagueId]/results` appears alongside the existing `Weekly picks`, `Standings`, `History`, and `League rules` links

---

### AC5 — Tests (pure/mocked — no live network or DB in default `npm test`)

**Given** `src/lib/scoring/get-league-peer-pick-history.test.ts`

**When** run with `npm test`

**Then** the following cases pass with **mocked Prisma** (`vi.fn()` stubs):

1. **Non-admin: revealed week included** — week with all FINAL games returns all participants' picks
2. **Non-admin: unrevealed week excluded** — week with any SCHEDULED/IN_PROGRESS game returns no data for non-admin
3. **Admin: unrevealed week included** — same week is included for admin caller regardless of game status
4. **Outcome mapping** — WIN, LOSS, TIE, and null (PENDING) map to correct `PickHistoryOutcome`; `antiJailedBonus` flows through
5. **No season** — `findUnique` returns `null` → returns `{ weeks: [] }` without querying picks
6. **Weeks sorted descending** — picks across weeks 1, 3, 2 return `weeks` in [3, 2, 1] order
7. **Entries sorted by displayName** — within a week, entries are alphabetical by `displayName`
8. **Mixed-status week** — one FINAL + one SCHEDULED game = not revealed (strict: ALL must be final)

**And** no live HTTP or DB calls are made in these tests

---

## Dev Notes

### What this story is (and is NOT)

- ✅ **Privacy gate** at the server query layer — peer picks hidden until reveal (FR48 / NFR17)
- ✅ **Participant view** of all members' picks after reveal (FR47)
- ✅ **Admin bypass** of the reveal gate (FR49) — admin always gets all submitted picks
- ❌ **NOT** an admin-specific tool — the admin submission dashboard (Story 4.1) already handles admin pick visibility for the current week. This page is the **participant view** that admin also benefits from.
- ❌ **NOT** the personal history page (Story 5.5 covers own picks; this covers peer picks)
- ❌ **NO** schema or migration changes — the reveal gate is purely query-level logic against existing columns

### Reveal condition: reuse `isWeekFullyFinalized`

The reveal trigger is **already implemented** in `src/lib/scoring/finalize-nfl-week.ts`:

```ts
export function isWeekFullyFinalized(
  games: Array<{ status: NflGameStatus }>,
): boolean {
  return games.every(
    (g) => g.status === "FINAL" || g.status === "CANCELLED",
  );
}
```

**Import and reuse this function directly.** Do not reimplement it. The reveal condition = `isWeekFullyFinalized(gamesForWeek)`. This is the same gate used by the scoring pipeline — once scoring can run, picks are revealed.

### Data function implementation sketch

```ts
// src/lib/scoring/get-league-peer-pick-history.ts
import { LeagueMembershipRole, PickOutcome, type PrismaClient } from "@prisma/client";
import { isWeekFullyFinalized } from "@/lib/scoring/finalize-nfl-week";
import type { PickHistoryOutcome } from "@/lib/scoring/get-personal-pick-history";

// ... type exports (PeerPickEntry, WeekPeerPicks, LeaguePeerPickHistory)

const EMPTY: LeaguePeerPickHistory = { weeks: [] };

export async function getLeaguePeerPickHistory(
  prisma: PrismaClient,
  opts: {
    leagueId: string;
    nflSeasonYear: number;
    callerRole: LeagueMembershipRole;
  },
): Promise<LeaguePeerPickHistory> {
  // 1. Resolve season with findUnique (not findFirst — prevents non-determinism)
  const season = await prisma.season.findUnique({
    where: { leagueId_nflSeasonYear: { leagueId: opts.leagueId, nflSeasonYear: opts.nflSeasonYear } },
    select: { id: true },
  });
  if (!season) return { ...EMPTY };

  const isAdmin = opts.callerRole === LeagueMembershipRole.ADMIN;

  // 2. Get all games for the season year to compute reveal status per week
  const allGames = await prisma.nflGame.findMany({
    where: { nflSeasonYear: opts.nflSeasonYear },
    select: { weekNumber: true, status: true },
  });

  // Group by week, compute isRevealed
  const gamesByWeek = new Map<number, Array<{ status: NflGameStatus }>>();
  for (const g of allGames) {
    const list = gamesByWeek.get(g.weekNumber) ?? [];
    list.push(g);
    gamesByWeek.set(g.weekNumber, list);
  }
  const revealedWeeks = new Set<number>();
  for (const [week, games] of gamesByWeek) {
    if (isWeekFullyFinalized(games)) revealedWeeks.add(week);
  }

  // 3. Get all picks for the season (single query — no N+1)
  const picks = await prisma.pick.findMany({
    where: { seasonId: season.id },
    select: {
      nflWeekNumber: true,
      antiJailedBonus: true,
      outcome: true,
      pointsEarned: true,
      team: { select: { abbreviation: true, name: true } },
      leagueMembership: {
        select: {
          id: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
  });

  // 4. Group picks by week, filtering by reveal gate
  const weekMap = new Map<number, PeerPickEntry[]>();
  for (const p of picks) {
    const wk = p.nflWeekNumber;
    const isRevealed = revealedWeeks.has(wk);
    if (!isAdmin && !isRevealed) continue; // privacy gate
    const entries = weekMap.get(wk) ?? [];
    entries.push({
      membershipId: p.leagueMembership.id,
      displayName: p.leagueMembership.user.name ?? p.leagueMembership.user.email,
      teamAbbreviation: p.team.abbreviation,
      teamName: p.team.name,
      antiJailedBonus: p.antiJailedBonus,
      outcome: p.outcome ?? "PENDING",
      pointsEarned: p.outcome == null ? null : (p.pointsEarned ?? 0),
    });
    weekMap.set(wk, entries);
  }

  // 5. Build result: sort entries by displayName; sort weeks descending
  const weeks: WeekPeerPicks[] = [];
  for (const [weekNumber, entries] of weekMap) {
    entries.sort((a, b) => a.displayName.localeCompare(b.displayName));
    weeks.push({ weekNumber, isRevealed: revealedWeeks.has(weekNumber), entries });
  }
  weeks.sort((a, b) => b.weekNumber - a.weekNumber); // descending

  return { weeks };
}
```

> Use `PickOutcome` enum for outcome comparisons if needed (e.g. `p.outcome === PickOutcome.WIN`). The `?? "PENDING"` spread is safe since `PickOutcome` values (`"WIN"|"LOSS"|"TIE"`) are a subset of `PickHistoryOutcome`. Follow the same pattern from `get-personal-pick-history.ts`.

### Page structure — mirror the history page

```ts
// src/app/(app)/leagues/[leagueId]/results/page.tsx — Server Component
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LeagueResultsTable } from "@/components/results/LeagueResultsTable";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isLeagueParticipantRole } from "@/lib/league/participant-membership";
import { getCurrentNflSeasonYear } from "@/lib/league/nfl-season";
import { getLeaguePeerPickHistory } from "@/lib/scoring/get-league-peer-pick-history";

export default async function LeagueResultsPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
    include: { league: { select: { name: true } } },
  });
  if (!membership || !isLeagueParticipantRole(membership.role) || !membership.league) {
    notFound();
  }

  const nflSeasonYear = getCurrentNflSeasonYear();
  const history = await getLeaguePeerPickHistory(prisma, {
    leagueId,
    nflSeasonYear,
    callerRole: membership.role, // ADMIN or MEMBER — determines reveal gate
  });

  return (
    <Stack component="main" spacing={3} sx={{ minHeight: "100vh", px: 2, py: 4, maxWidth: 720, mx: "auto" }}>
      <Typography variant="body2">
        <Link href={`/leagues/${leagueId}`}>← {league.name}</Link>
      </Typography>
      <Typography variant="h4" component="h1">League Results</Typography>
      <LeagueResultsTable history={history} currentMembershipId={membership.id} />
    </Stack>
  );
}
```

Note: `maxWidth: 720` (wider than History/Standings at 560) because peer picks show more columns (Participant + Team + Result + Pts).

### `LeagueResultsTable` component design

- File: `src/components/results/LeagueResultsTable.tsx`, **`"use client"`** (uses MUI `Table`, themed `sx` callbacks, `TeamLogo` client child, `Chip`)
- Props: `{ history: LeaguePeerPickHistory; currentMembershipId: string }`
- One `Paper` section per week (or just a `Stack` of `TableContainer` blocks — follow whichever approach is most readable)
- **Reuse existing chip pattern verbatim from `PickHistoryTable`** — copy the `resultMeta` dispatch table (without `PENDING` key — handle PENDING as plain `—` text before the dispatch)
- **Reuse `TeamLogo`** — same import from `@/components/picks/TeamLogo`
- **Highlight own row** — compare `entry.membershipId === currentMembershipId`, apply `bgcolor: (t) => alpha(t.palette.primary.main, 0.08)` same as `StandingsTable`
- **Anti-jailed chip** — reuse the gold `2 PTS` chip style from `MatchupCard` — inspect `src/components/picks/MatchupCard.tsx` for the exact `sx` values and replicate (do not re-style or invent a different variant)
- **Week heading** — `Typography variant="h6"` with `week.weekNumber` and, for admin + `!week.isRevealed`, a `Chip size="small"` labeled `"Not yet revealed"` with `color="default"` styling
- **Empty state** — when `history.weeks.length === 0`, render `Typography variant="body2" color="text.secondary"` only (no table)
- Use **`Stack`** for all flex wrappers (not `Box`)

### Server/client boundary

- `results/page.tsx` is a Server Component (does `auth()`, Prisma)
- `LeagueResultsTable` **must** have `"use client"` (theme `sx` callbacks + `TeamLogo` client child + `Chip`)
- Page passes only plain `LeaguePeerPickHistory` + `string` (currentMembershipId) — no functions, no Prisma objects
- Follow `.cursor/rules/next-rsc-client-boundaries.mdc` — same rule as 5.4 / 5.5

### Privacy enforcement — what NOT to do

- **DO NOT** accept a `?role=admin` query param or any client-provided role bypass
- **DO NOT** add `membershipId` as a query param (this view is not filtered to a single member)
- **DO NOT** include peer pick data in `GET /api/leagues/[leagueId]/picks` — that route returns only the caller's own pick data (Story 3.7) and must stay single-member-scoped
- **DO NOT** call `getLeaguePeerPickHistory` from a client component — only call from the Server Component page, passing role from the verified session

The privacy gate lives **entirely in `getLeaguePeerPickHistory`** at the `if (!isAdmin && !isRevealed) continue` line. This is the single authoritative gate (NFR17: "enforced in queries and server-rendered data, not only in the UI").

### Deferred work — addressed here vs. left deferred

Checked `_bmad-output/implementation-artifacts/deferred-work.md`:

- **`season.findFirst` non-deterministic on duplicate records** (deferred from 5.5 review): The new function uses `prisma.season.findUnique` with the composite key `{ leagueId_nflSeasonYear }` — no accumulation of this debt.
- **Outcome comparisons using raw string literals** (deferred from 5.4): New file uses the `PickOutcome` enum for any comparisons (same as 5.5 guidance) — does not extend the raw-literal debt.

Left deferred (do **not** action here):
- Existing `get-league-standings.ts` and `score-nfl-week.ts` raw-literal comparisons — out of scope
- All other deferred items in `deferred-work.md` — unrelated

### Test patterns

Follow the `vi.fn()` mocked-Prisma pattern from `get-personal-pick-history.test.ts` and `get-league-standings.test.ts`:

```ts
const mockPrisma = {
  season: { findUnique: vi.fn() },
  nflGame: { findMany: vi.fn() },
  pick: { findMany: vi.fn() },
} as unknown as PrismaClient;
```

Key test assertions for the privacy gate:
```ts
// Non-admin: unrevealed week excluded
mockPrisma.nflGame.findMany.mockResolvedValueOnce([
  { weekNumber: 5, status: "FINAL" },
  { weekNumber: 5, status: "SCHEDULED" }, // not fully FINAL → not revealed
]);
const result = await getLeaguePeerPickHistory(mockPrisma, {
  leagueId: "l1", nflSeasonYear: 2025, callerRole: LeagueMembershipRole.MEMBER,
});
expect(result.weeks).toHaveLength(0);

// Admin: same week included
const adminResult = await getLeaguePeerPickHistory(mockPrisma, {
  leagueId: "l1", nflSeasonYear: 2025, callerRole: LeagueMembershipRole.ADMIN,
});
expect(adminResult.weeks).toHaveLength(1);
```

Keep each test self-contained (direct mock assignments, no shared `beforeEach` state).

### Route + file locations

| File | Status | Notes |
|------|--------|-------|
| `src/lib/scoring/get-league-peer-pick-history.ts` | new | Data function + types |
| `src/lib/scoring/get-league-peer-pick-history.test.ts` | new | 8 mocked-Prisma test cases |
| `src/components/results/LeagueResultsTable.tsx` | new | `"use client"` MUI table |
| `src/app/(app)/leagues/[leagueId]/results/page.tsx` | new | Server Component page |
| `src/app/(app)/leagues/[leagueId]/page.tsx` | modified | Add Results hub link |

### Mid-season start (project non-negotiable #8)

The function queries picks by `seasonId` — picks only exist from the league's `firstCompetitionWeek` onward. No `firstCompetitionWeek` math is required; the data is already correctly scoped by the `Season` constraint.

### Project non-negotiables (checklist)

- [ ] `"use client"` on `LeagueResultsTable` (MUI `sx` theme callbacks + `TeamLogo` + `Chip`)
- [ ] Server Component page — `auth()` + Prisma in `results/page.tsx`
- [ ] Single Prisma client from `@/lib/db`
- [ ] `Stack` for flex layouts (not `Box`) — user/project convention
- [ ] Privacy gate: `callerRole` from session, never from client input (FR48; NFR17)
- [ ] No `NEXT_PUBLIC_*` secrets; no peer pick data exposed before reveal
- [ ] camelCase JSON/props, snake_case DB columns (enforced by Prisma)
- [ ] Use `PickOutcome` enum for outcome comparisons (not raw string literals)
- [ ] `isWeekFullyFinalized` imported from `finalize-nfl-week.ts` (do not reimplement)
- [ ] `PickHistoryOutcome` imported from `get-personal-pick-history.ts` (do not redefine)

### Out of scope (do NOT build in Story 5.6)

- Email notifications on Tuesday reveal — Story 6.2
- "Watch for reveal" real-time update / WebSocket — explicitly deferred per project rules ("no WebSockets for MVP; manual refresh is OK")
- Filtering results to a specific week via query param (future UX enhancement)
- Showing peer picks on the existing `/picks` route — that route remains single-member-scoped (NFR17)
- Any scoring, schema, or `Pick` model changes

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.6] — FR47, FR48, FR49, NFR17.
- [Source: _bmad-output/planning-artifacts/prd.md#FR47–FR49] — Participant transparency after reveal; admin always-on visibility.
- [Source: _bmad-output/planning-artifacts/architecture.md] — "Enforce pick visibility in server queries (participants see own pick anytime; others only after Tuesday reveal per FR48–FR49)" and "pick privacy until reveal is enforced in queries."
- [Source: docs/project-context.md#Non-negotiables] — Single Prisma client, server-authoritative, FR48 pick privacy, Stack over Box, camelCase/snake_case.
- [Source: src/lib/scoring/finalize-nfl-week.ts] — `isWeekFullyFinalized` — the canonical reveal-condition function; import and reuse.
- [Source: src/lib/scoring/get-personal-pick-history.ts] — `PickHistoryOutcome` type + outcome mapping pattern to reuse.
- [Source: src/lib/scoring/get-league-standings.ts] — data function structure pattern.
- [Source: src/components/standings/StandingsTable.tsx] — row highlight style (`primary.main` at 8% opacity), record format, tabular-nums conventions.
- [Source: src/components/history/PickHistoryTable.tsx] — chip pattern (`WIN`/`LOSS`/`TIE` tinted chips + anti-jailed `2 PTS` gold chip) — copy this pattern exactly.
- [Source: src/components/picks/MatchupCard.tsx] — anti-jailed `2 PTS` chip style to reuse verbatim.
- [Source: src/components/picks/TeamLogo.tsx] — reuse `TeamLogo size="sm"`.
- [Source: src/app/(app)/leagues/[leagueId]/history/page.tsx] — reference implementation for auth/membership guard + server page structure.
- [Source: .cursor/rules/next-rsc-client-boundaries.mdc] — server/client boundary rules.

## Tasks / Subtasks

- [x] **`getLeaguePeerPickHistory` data function** (AC1, AC5)
  - [x] Create `src/lib/scoring/get-league-peer-pick-history.ts` — types (`PeerPickEntry`, `WeekPeerPicks`, `LeaguePeerPickHistory`) + function
  - [x] Import `isWeekFullyFinalized` from `@/lib/scoring/finalize-nfl-week` (do not reimplement)
  - [x] Import `PickHistoryOutcome` from `@/lib/scoring/get-personal-pick-history` (do not redefine)
  - [x] Privacy gate: non-admin → revealed weeks only; admin → all weeks with picks
  - [x] Use `findUnique` for season (not `findFirst`) with composite key `leagueId_nflSeasonYear`
  - [x] Use `PickOutcome` enum for outcome comparisons; avoid raw string literals
  - [x] Weeks sorted descending; entries sorted by `displayName` ascending

- [x] **Tests** (AC5)
  - [x] Create `src/lib/scoring/get-league-peer-pick-history.test.ts` with 8 mocked-Prisma cases
  - [x] Cover all cases: non-admin reveal gate, admin bypass, mixed-status week not revealed, no season, week sort, entry sort, outcome mapping, PENDING mapping
  - [x] Run `npm test` — all pass

- [x] **`LeagueResultsTable` client component** (AC3)
  - [x] Create `src/components/results/LeagueResultsTable.tsx` with `"use client"`
  - [x] Columns: Participant / Team (with `TeamLogo size="sm"`) / Result (text+color chip) / Pts
  - [x] Highlight viewer's own row (`primary.main` 8% opacity — same as `StandingsTable`)
  - [x] Anti-jailed `2 PTS` chip (gold, from `MatchupCard`) inline in Team or Result cell
  - [x] Week heading with `Not yet revealed` pill for admin-visible unrevealed weeks
  - [x] Empty state when `history.weeks.length === 0`
  - [x] `Stack` for all flex wrappers; `tabular-nums` on numeric cells

- [x] **Results page** (AC2)
  - [x] Create `src/app/(app)/leagues/[leagueId]/results/page.tsx` (Server Component)
  - [x] Auth + participant-membership + league guards (mirror history/standings page)
  - [x] Call `getLeaguePeerPickHistory` with `callerRole: membership.role`; pass to `LeagueResultsTable`

- [x] **League hub navigation** (AC4)
  - [x] Add `Results` link to the hub links section in `src/app/(app)/leagues/[leagueId]/page.tsx`

- [x] **Quality gate**
  - [x] `npm test` green (all existing + new tests)
  - [x] `npm run lint` clean for new/modified files
  - [x] `npm run build` passes

## Dev Agent Record

### Agent Model Used

Composer (Cursor)

### Completion Notes List

- Implemented `getLeaguePeerPickHistory` with server-side privacy gate: non-admins see peer picks only for weeks where all games are FINAL/CANCELLED (`isWeekFullyFinalized`); admins see all weeks with submitted picks.
- Season lookup uses `findUnique` on composite key `leagueId_nflSeasonYear`; returns `{ weeks: [] }` when no season.
- Added 8 mocked-Prisma unit tests covering reveal gate, admin bypass, sorting, outcome mapping, and mixed-status weeks.
- Created `LeagueResultsTable` client component mirroring `PickHistoryTable` chip/team patterns and `StandingsTable` row highlight.
- Added `/leagues/[leagueId]/results` Server Component page and `Results` hub link.
- All 302 tests pass; new/modified files lint clean; `npm run build` succeeds.

### File List

- src/lib/scoring/get-league-peer-pick-history.ts (new)
- src/lib/scoring/get-league-peer-pick-history.test.ts (new)
- src/components/results/LeagueResultsTable.tsx (new)
- src/app/(app)/leagues/[leagueId]/results/page.tsx (new)
- src/app/(app)/leagues/[leagueId]/page.tsx (modified)

### Review Findings

- [x] [Review][Patch] `ResultCell` has no fallback for unexpected `outcome` values — after PENDING and TIE are handled, `resultMeta[outcome]` is called with no guard; a future enum addition or corrupt data will produce `undefined` and crash at `.label` [src/components/results/LeagueResultsTable.tsx]
- [x] [Review][Patch] `season.findUnique` and `nflGame.findMany` are sequential but `nflGame.findMany` only needs `nflSeasonYear` (known before the season query completes) — run both with `Promise.all` to eliminate one serial DB round trip [src/lib/scoring/get-league-peer-pick-history.ts]
- [x] [Review][Patch] `localeCompare` called without explicit locale — sort order is environment-dependent; use `a.displayName.localeCompare(b.displayName, 'en')` [src/lib/scoring/get-league-peer-pick-history.ts:74]
- [x] [Review][Patch] `AntiJailedChip` is missing `"&:hover": { bgcolor: (t) => t.palette.accent.goldDark }` that MatchupCard has — spec requires verbatim reuse of MatchupCard's exact sx values [src/components/results/LeagueResultsTable.tsx]
- [x] [Review][Defer] `notFound()` on unauthenticated session (no redirect to sign-in) [src/app/(app)/leagues/[leagueId]/results/page.tsx] — deferred, pre-existing app-wide pattern (already deferred from 5-5 review)
- [x] [Review][Defer] Email exposed as display name fallback is PII visible to all league members [src/lib/scoring/get-league-peer-pick-history.ts] — deferred, spec-mandated (`user.name ?? user.email`); revisit when user profile / display-name story is scoped
- [x] [Review][Defer] No `generateMetadata` export on results page [src/app/(app)/leagues/[leagueId]/results/page.tsx] — deferred, pre-existing pattern across all protected pages
- [x] [Review][Defer] Test mocks return fixed data regardless of Prisma WHERE clause — query correctness untested [src/lib/scoring/get-league-peer-pick-history.test.ts] — deferred, integration test concern

### Change Log

- 2026-06-16: Story 5.6 created (create-story) — Tuesday reveal privacy gate, peer pick data function, League Results page and table, hub link.
- 2026-06-16: Story 5.6 implemented — peer pick history data function with reveal gate, League Results page/table, hub link, 8 unit tests.
- 2026-06-16: Story 5.6 code review — 4 patch, 4 deferred, 9 dismissed.
