# Story 5.4: Live Leaderboard

Status: done

## Story

As a participant,
I want to see points and ranks for everyone in my league,
so that I know where I stand after each week is scored (**FR44**).

## Acceptance Criteria

### AC1 — Data function: `getLeagueStandings`

**Given** `src/lib/scoring/get-league-standings.ts` exports `getLeagueStandings(prisma, { leagueId, nflSeasonYear })`

**When** called for a league and season year

**Then** it queries all `Pick` rows for the league's season (matching `leagueId` → `Season.nflSeasonYear`) where `scoredAt IS NOT NULL`

**And** returns an array of `StandingsEntry` objects sorted by:
1. `totalPoints` descending
2. `wins` descending (tiebreaker)
3. `displayName` ascending (final tiebreaker)

```ts
export type StandingsEntry = {
  membershipId: string;
  displayName: string;
  totalPoints: number;
  wins: number;
  losses: number;
  ties: number;
  rank: number; // 1-based; participants tied on totalPoints share the same rank
};
```

**And** `rank` is computed after sorting: participants with the same `totalPoints` share the same rank number; the next distinct total gets `rank = (position + 1)` where `position` is 1-based index

**And** participants with **zero scored picks** (no `scoredAt` rows) are still included in the result with `totalPoints: 0, wins: 0, losses: 0, ties: 0` — they appear at the bottom of the sorted list

**And** `displayName` = `user.name ?? user.email` (same pattern as roster)

**And** returns `[]` only if the league has no members (not an error state)

---

### AC2 — Standings page

**Given** `src/app/(app)/leagues/[leagueId]/standings/page.tsx`

**When** a logged-in league member visits `/leagues/[leagueId]/standings`

**Then** the page renders the `StandingsTable` component with the standings data

**And** auth/membership guard: `notFound()` if no valid session, if the user has no membership in this league, or if the league does not exist

**And** the page passes `currentMembershipId` to `StandingsTable` so the current user's row is highlighted

**And** the page is a **Server Component** — it calls `getLeagueStandings` directly (no API route needed)

**And** if `getLeagueStandings` returns an empty array (no members), the empty state in `StandingsTable` renders

---

### AC3 — `StandingsTable` client component

**Given** `src/components/standings/StandingsTable.tsx` with `"use client"` at the top

**When** rendered with `standings: StandingsEntry[]` and `currentMembershipId: string`

**Then** it renders a MUI `Table` with four columns: `#`, `Participant`, `Record`, `Pts`

**And** `Record` displays as `W-L` when no ties exist, or `W-L-T` when any entry has `ties > 0`

**And** the current user's row has a highlighted background: `bgcolor: (t) => \`\${t.palette.primary.main}14\`` (8% opacity, hex `14`)

**And** the `Pts` cell uses `color: "primary.main"` and `fontWeight: 700`

**And** all numeric cells use `fontVariantNumeric: "tabular-nums"` for column alignment

**And** when `standings` is empty or all participants have 0 scored picks (leaderboard not yet populated), the component renders:
```
"Standings will appear after Week 1 results"
```
(use `Typography variant="body2" color="text.secondary"`)

**And** the component uses **`Stack`** for any flex layout wrappers (project convention)

**And** the current user's row does **not** require special emphasis if `currentMembershipId` matches no entry (defensive — no crash)

---

### AC4 — League hub navigation

**Given** `src/app/(app)/leagues/[leagueId]/page.tsx`

**When** a member views the league hub

**Then** the "League hub" links section includes a "Standings" link pointing to `/leagues/[leagueId]/standings`

---

### AC5 — Tests (pure/mocked — no live network in default `npm test`)

**Given** `src/lib/scoring/get-league-standings.test.ts`

**When** run with `npm test`

**Then** the following cases pass (all with mocked Prisma — no real DB):

1. **Multiple participants, correct sort order** — three members with different totals; asserts descending order and correct `totalPoints`, `wins`, `losses`
2. **Tie-rank sharing** — two members with equal `totalPoints`; both get the same `rank`; the next member gets `rank = position + 1` (e.g. two members tied at rank 1 → third member gets rank 3, not rank 2)
3. **Member with no scored picks included at bottom** — a member with zero `scoredAt` rows still appears in result with all zeros, sorted last
4. **displayName fallback** — member with `user.name = null` uses `user.email`; member with `user.name` set uses `user.name`
5. **Empty league** — `getLeagueStandings` returns `[]` when no memberships exist

**And** no live HTTP or DB calls are made in these tests

---

## Dev Notes

### What Stories 5.1–5.3 provided

- **5.1:** `NflGame` rows with `status`, `homeScore`, `awayScore`, `finalizedAt` set via sync
- **5.2:** `Pick.outcome` (`WIN`/`LOSS`/`TIE`) and `Pick.pointsEarned` (0, 1, or 2) populated by `scoreNflWeek`; `Pick.scoredAt` marks when scored
- **5.3:** `finalizeNflWeek` — MNF-aware orchestrator that calls `scoreNflWeek` when all games are FINAL; available via `POST /api/admin/scoring/finalize-week`

Story 5.4 **reads** the already-scored data. No new scoring logic, no new DB schema changes.

### Data query design for `getLeagueStandings`

The query needs two hops:
1. Find the `Season` for `(leagueId, nflSeasonYear)` to get `seasonId`
2. Load all `LeagueMembership` rows for the league (with `user.name`, `user.email`)
3. For each membership, aggregate `Pick` rows where `seasonId` matches AND `scoredAt IS NOT NULL`

**Recommended approach — single Prisma query with aggregation:**

```ts
// src/lib/scoring/get-league-standings.ts
import type { PrismaClient } from "@prisma/client";

export type StandingsEntry = {
  membershipId: string;
  displayName: string;
  totalPoints: number;
  wins: number;
  losses: number;
  ties: number;
  rank: number;
};

export async function getLeagueStandings(
  prisma: PrismaClient,
  opts: { leagueId: string; nflSeasonYear: number },
): Promise<StandingsEntry[]> {
  // 1. Resolve season
  const season = await prisma.season.findFirst({
    where: { leagueId: opts.leagueId, nflSeasonYear: opts.nflSeasonYear },
    select: { id: true },
  });

  // 2. Load all memberships with their scored picks
  const memberships = await prisma.leagueMembership.findMany({
    where: { leagueId: opts.leagueId },
    include: {
      user: { select: { name: true, email: true } },
      picks: season
        ? {
            where: { seasonId: season.id, scoredAt: { not: null } },
            select: { outcome: true, pointsEarned: true },
          }
        : false,
    },
  });

  // 3. Compute per-member stats
  const unsorted: Omit<StandingsEntry, "rank">[] = memberships.map((m) => {
    const picks = season ? (m.picks ?? []) : [];
    const totalPoints = picks.reduce((s, p) => s + (p.pointsEarned ?? 0), 0);
    const wins = picks.filter((p) => p.outcome === "WIN").length;
    const losses = picks.filter((p) => p.outcome === "LOSS").length;
    const ties = picks.filter((p) => p.outcome === "TIE").length;
    return {
      membershipId: m.id,
      displayName: m.user.name ?? m.user.email,
      totalPoints,
      wins,
      losses,
      ties,
    };
  });

  // 4. Sort: totalPoints DESC, wins DESC, displayName ASC
  unsorted.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.displayName.localeCompare(b.displayName);
  });

  // 5. Assign ranks (shared rank on totalPoints tie)
  const result: StandingsEntry[] = [];
  for (let i = 0; i < unsorted.length; i++) {
    const rank =
      i > 0 && unsorted[i].totalPoints === unsorted[i - 1].totalPoints
        ? result[i - 1].rank
        : i + 1;
    result.push({ ...unsorted[i], rank });
  }
  return result;
}
```

> **Note on `picks: false`:** When no season exists for the league yet, pass `false` for the `picks` relation include so Prisma does not error on a null `seasonId`. All members get zeros.

> **Alternative approach:** If the `picks: false` Prisma pattern is awkward, resolve `season` first and return early with all-zero entries when `season === null`.

### Page structure — follow picks page pattern

```ts
// src/app/(app)/leagues/[leagueId]/standings/page.tsx
// Server Component — no "use client"

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isLeagueParticipantRole } from "@/lib/league/participant-membership";
import { getCurrentNflSeasonYear } from "@/lib/league/nfl-season";
import { getLeagueStandings } from "@/lib/scoring/get-league-standings";
import { StandingsTable } from "@/components/standings/StandingsTable";

export default async function LeagueStandingsPage({ params }) {
  const { leagueId } = await params;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  });
  if (!membership || !isLeagueParticipantRole(membership.role)) notFound();

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { name: true },
  });
  if (!league) notFound();

  const nflSeasonYear = getCurrentNflSeasonYear();
  const standings = await getLeagueStandings(prisma, { leagueId, nflSeasonYear });

  return (
    <Stack component="main" spacing={3} sx={{ minHeight: "100vh", px: 2, py: 4, maxWidth: 560, mx: "auto" }}>
      <Typography variant="body2">
        <Link href={`/leagues/${leagueId}`}>← {league.name}</Link>
      </Typography>
      <Typography variant="h4" component="h1">Standings</Typography>
      <StandingsTable standings={standings} currentMembershipId={membership.id} />
    </Stack>
  );
}
```

### `StandingsTable` component design

```ts
// src/components/standings/StandingsTable.tsx
"use client";

import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { StandingsEntry } from "@/lib/scoring/get-league-standings";
```

**Column widths:**
- `#` — compact (e.g., `width: 40`)
- `Participant` — flexible (`width: "100%"`)
- `Record` — compact
- `Pts` — compact, right-aligned

**Record format logic:**
```ts
const hasTies = standings.some((s) => s.ties > 0);
// In each row:
const record = hasTies
  ? `${s.wins}-${s.losses}-${s.ties}`
  : `${s.wins}-${s.losses}`;
```

**Empty state condition:** render "Standings will appear after Week 1 results" when `standings.length === 0` OR when all entries have `totalPoints === 0 && wins === 0 && losses === 0`. Consider showing the table with all zeros if there are members (they did join the league), OR show "no scored picks yet" message. **Recommended:** show the table if standings are non-empty, show the empty message only if `standings.length === 0`. This way, participants who submitted picks but haven't been scored yet show with zeros until scoring runs.

### Server/client boundary — follow the cursor rule

`StandingsTable` uses MUI `Table`, `sx` with `(t) => ...` callbacks (for highlight row), and theme-aware color tokens. It **must** have `"use client"` at the top.

The page (`standings/page.tsx`) stays a **Server Component** — it calls `auth()`, Prisma, and `getLeagueStandings`. It passes only **plain objects** (the `StandingsEntry[]` array and `currentMembershipId: string`) down to `StandingsTable`.

See `.cursor/rules/next-rsc-client-boundaries.mdc` — this is an exact match for the documented pattern.

### Route location — matches architecture target tree

The architecture doc shows `src/app/(app)/leagues/[leagueId]/standings/page.tsx` in the target directory tree. No deviation needed.

No API route is required for this story — the server component reads Prisma directly. A future REST endpoint (`GET /api/leagues/[leagueId]/standings`) could be added in a later story if needed, but is out of scope here.

### Ranking algorithm — dense vs standard

Use **standard competition ranking** (a.k.a. "1224" ranking): two participants tied at 10 points both get rank 1; the next participant with 8 points gets rank 3 (not rank 2). This matches sports league conventions and is what the UX spec implies by "rank."

Implementation: see pseudocode in AC1 and the data function pseudocode above.

### FR44 and FR45 relationship

- **FR44** (Story 5.4): "Participants can view live leaderboard showing all participants' points and rankings" — this story implements the leaderboard page
- **FR45**: "Leaderboard displays updated standings every Tuesday after MNF processing" — this is satisfied by Stories 5.2/5.3 having scored the picks; Story 5.4 reads those scored results. No additional update mechanism is needed here — the page always shows whatever `Pick.pointsEarned` values are in the DB, which are updated by `finalizeNflWeek`

### Pick visibility (FR48) — important boundary

Story 5.4 shows **aggregate totals** (points, wins, losses) only — NOT which teams other participants picked. That would violate FR48 (picks hidden until Tuesday reveal). The leaderboard is safe to show at all times because it reveals **results** (scored outcomes), not **this-week's choices**.

- ✅ Show: total points, wins, losses, rank
- ❌ Do NOT show: which team each participant picked this week (that's Story 5.6)

This story intentionally defers peer-pick visibility; `StandingsTable` receives no pick team data.

### Empty state: pre-scoring vs truly empty

| State | Data | Display |
|-------|------|---------|
| No members | `standings.length === 0` | "Standings will appear after Week 1 results" |
| Members exist, no scored picks yet | All entries have `totalPoints: 0, wins: 0, losses: 0` | Show the table with zeros — participants are present; scoring hasn't run yet. Add a caption "No results scored yet." |
| Some picks scored | Mixed totals | Full leaderboard |

**Recommended implementation:** if `standings.length === 0`, show the empty-state message. If `standings.length > 0` but all are zero, still render the table (shows the roster in rank-order). A secondary caption "No results scored yet" can be added below the table or as a `TableCaption`.

### Do NOT build in Story 5.4

- No personal pick history per participant (Story 5.5)
- No peer-pick visibility / Tuesday reveal gating (Story 5.6)
- No desktop sidebar (UX Phase 2; Table only is fine for MVP)
- No pagination (league size is small, ~14 participants)
- No REST API route for standings (server component fetches directly)
- No admin-only scoring trigger UI (that's the existing `finalize-week` endpoint)

### Project non-negotiables (checklist)

- [ ] `"use client"` on `StandingsTable` (uses MUI `sx` with theme callbacks)
- [ ] Server Component page — `auth()` and Prisma in `standings/page.tsx`
- [ ] Single Prisma client from `@/lib/db`
- [ ] `Stack` for any flex layouts (not `Box`)
- [ ] `displayName = user.name ?? user.email` (same pattern as roster)
- [ ] No `NEXT_PUBLIC_*` secrets
- [ ] Pick data not exposed in standings (no `teamId`, no `nflWeekNumber` surfaced to component)
- [ ] camelCase JSON props, snake_case DB columns (already enforced by Prisma schema)

### Test patterns from prior stories

Follow the same Vitest patterns established in `score-nfl-week.test.ts` and `finalize-nfl-week.test.ts`:

```ts
// Mock Prisma with vi.fn() stubs
const mockPrisma = {
  season: { findFirst: vi.fn() },
  leagueMembership: { findMany: vi.fn() },
} as unknown as PrismaClient;
```

No `beforeEach` over-engineering — keep each test self-contained with direct assignments.

### Git intelligence — relevant recent commits

- `1d1c12f feat(scoring): Story 5.3 — MNF completion gate and Tuesday finalization orchestrator` — established `FinalizeNflWeekResult`, dual-auth route, `finalize-nfl-week.ts` patterns
- `233acdc feat(scoring): Story 5.2 — weekly pick scoring with anti-jailed bonus` — established `ScoreNflWeekResult` union, `scoreNflWeek`, `Pick.pointsEarned` column
- `a6bd803 feat(nfl): Story 5.1 ingest game results and finalize games` — `NflGame` result sync, `getGameWinner`

All three stories used the same `vi.fn()` mock pattern and `ok: true | ok: false` union types. `get-league-standings.ts` is a simpler read-only function so no result union needed — just return the array directly (throw on unexpected DB error; the page will 500 naturally).

### Deferred work to note but not action

From `deferred-work.md`, none of the deferred items are directly actionable in Story 5.4. The following are relevant context:
- **No DB atomicity CHECK constraint on scoring columns** (5.2 deferred): still deferred; no schema change in 5.4
- **Sequential DB calls in admin page** (4.1 deferred): same class of issue may exist in the standings query; acceptable at MVP scale with ~14 users

---

## Tasks / Subtasks

- [x] **`getLeagueStandings` data function** (AC1, AC5)
  - [x] Create `src/lib/scoring/get-league-standings.ts` with `StandingsEntry` type and `getLeagueStandings` function
  - [x] Write `src/lib/scoring/get-league-standings.test.ts` covering all 5 test cases (mocked Prisma)
  - [x] Verify `npm test` passes

- [x] **`StandingsTable` client component** (AC3)
  - [x] Create `src/components/standings/StandingsTable.tsx` with `"use client"`
  - [x] Implement: columns (#, Participant, Record, Pts), current-user highlight, empty state
  - [x] Tabular numbers, Points in primary.main bold, record format with/without ties

- [x] **Standings page** (AC2)
  - [x] Create `src/app/(app)/leagues/[leagueId]/standings/page.tsx` (Server Component)
  - [x] Auth guard, membership guard, league guard (same pattern as picks page)
  - [x] Call `getLeagueStandings`; pass results to `StandingsTable`

- [x] **League hub navigation** (AC4)
  - [x] Add "Standings" link to `src/app/(app)/leagues/[leagueId]/page.tsx` hub section

- [x] **Quality gate**
  - [x] `npm test` green
  - [x] `npm run lint` clean
  - [x] `npm run build` passes

### Review Findings

- [x] [Review][Decision] Empty-state behavior: AC3 says show the "Standings will appear" message when `standings` is empty **or** all entries have 0 scored picks; Dev Notes table and Recommended Implementation say show the message only when `standings.length === 0`, and render the table (with "No results scored yet" caption) when members exist but picks are unscored. Resolved: follow Dev Notes — show table with caption for pre-scoring state.
- [x] [Review][Patch] "No results scored yet" caption missing for pre-scoring all-zeros state — added below table [src/components/standings/StandingsTable.tsx]
- [x] [Review][Patch] Two sequential DB queries for membership + league; combined into one with `include: { league: { select: { name: true } } }` [src/app/(app)/leagues/[leagueId]/standings/page.tsx:24-35]
- [x] [Review][Patch] `Stack spacing={0}` wrapping single `Table` child adds no layout value; removed outer Stack [src/components/standings/StandingsTable.tsx:43]
- [x] [Review][Patch] Add test for `season = null` path (distinct from "member with no picks" — tests full early-return/all-zeros branch) [src/lib/scoring/get-league-standings.test.ts]
- [x] [Review][Patch] Tie-rank test does not assert which tied member occupies which index; added displayName tiebreaker assertion to confirm sort determinism [src/lib/scoring/get-league-standings.test.ts]
- [x] [Review][Patch] No test for wins as secondary sort tiebreaker when `totalPoints` are equal [src/lib/scoring/get-league-standings.test.ts]
- [x] [Review][Patch] `isLeaderboardEmpty` name inconsistent with file's "standings" naming convention; renamed to `isStandingsEmpty` [src/components/standings/StandingsTable.tsx:20]
- [x] [Review][Defer] Missing `generateMetadata` export; browser tab uses layout default title [src/app/(app)/leagues/[leagueId]/standings/page.tsx] — deferred, pre-existing
- [x] [Review][Defer] Current user row highlighted by color only; no WCAG 1.4.1-compliant non-color indicator (e.g., `aria-current="row"`) [src/components/standings/StandingsTable.tsx] — deferred, pre-existing (Story 7.3 scope)
- [x] [Review][Defer] Outcome comparisons use raw string literals ("WIN"/"LOSS"/"TIE") instead of Prisma-generated enum; pre-existing pattern across scoring codebase [src/lib/scoring/get-league-standings.ts:43] — deferred, pre-existing
- [x] [Review][Defer] `user.email` may be null in OAuth scenarios; null displayName would crash `localeCompare`; same pattern as roster page [src/lib/scoring/get-league-standings.ts:36] — deferred, pre-existing
- [x] [Review][Defer] All `leagueMembership` rows included in standings regardless of role; non-playing admin roles would appear with zeros [src/lib/scoring/get-league-standings.ts:22] — deferred, pre-existing (Story 2.6 design)

---

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

- Fixed sort-order test expectations: tie on totalPoints shares rank; wins/displayName tiebreakers affect order among equal totals.

### Completion Notes List

- Implemented `getLeagueStandings` with season lookup, membership aggregation of scored picks, sort (points → wins → name), and standard competition ranking (1224).
- Added 5 mocked Prisma unit tests covering sort, tie ranks, zero-pick members, displayName fallback, and empty league.
- Created `StandingsTable` client component with MUI Table, current-user row highlight, tabular nums, W-L / W-L-T record format, and AC3 empty state.
- Added server-rendered standings page with auth/membership/league guards matching picks page pattern.
- Added Standings link to league hub navigation.
- Quality: 285 tests pass; build succeeds. Pre-existing lint errors in `AdminPickOverrideDialog.tsx` (unrelated to this story); new files lint clean.

### File List

- `src/lib/scoring/get-league-standings.ts` (new)
- `src/lib/scoring/get-league-standings.test.ts` (new)
- `src/components/standings/StandingsTable.tsx` (new)
- `src/app/(app)/leagues/[leagueId]/standings/page.tsx` (new)
- `src/app/(app)/leagues/[leagueId]/page.tsx` (modified)

### Change Log

- 2026-06-14: Story 5.4 — live leaderboard data function, standings page, StandingsTable component, league hub link, unit tests.
