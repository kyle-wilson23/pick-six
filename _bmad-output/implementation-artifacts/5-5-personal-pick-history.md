# Story 5.5: Personal Pick History

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a participant,
I want my own weekly picks and their outcomes listed for the season,
so that I can track how my picks have performed week over week (**FR46**).

## Acceptance Criteria

### AC1 — Data function: `getPersonalPickHistory`

**Given** `src/lib/scoring/get-personal-pick-history.ts` exports `getPersonalPickHistory(prisma, { leagueId, nflSeasonYear, membershipId })`

**When** called for a league, season year, and a specific league membership id

**Then** it resolves the `Season` for `(leagueId, nflSeasonYear)`; if no season exists it returns the empty result `{ entries: [], totalPoints: 0, wins: 0, losses: 0, ties: 0 }` (not an error)

**And** it queries all `Pick` rows for `(leagueMembershipId = membershipId, seasonId)` including the picked team's `abbreviation` and `name`, ordered by `nflWeekNumber` ascending

**And** it returns:

```ts
export type PickHistoryOutcome = "WIN" | "LOSS" | "TIE" | "PENDING";

export type PickHistoryEntry = {
  nflWeekNumber: number;
  teamAbbreviation: string;
  teamName: string;
  antiJailedBonus: boolean;
  outcome: PickHistoryOutcome; // "PENDING" when the pick is not yet scored (scoredAt IS NULL / outcome IS NULL)
  pointsEarned: number | null; // null when not yet scored
};

export type PersonalPickHistory = {
  entries: PickHistoryEntry[]; // sorted by nflWeekNumber ASC
  totalPoints: number; // sum of pointsEarned across scored picks only
  wins: number;
  losses: number;
  ties: number;
};
```

**And** each entry maps `Pick.outcome` (Prisma `PickOutcome` enum) to `PickHistoryOutcome`; a `null` `outcome` (pick submitted but week not yet scored) maps to `"PENDING"`

**And** `pointsEarned` passes through the DB value (`0`, `1`, or `2`) for scored picks and `null` for pending picks

**And** the summary aggregates count **scored picks only**: `totalPoints` = sum of non-null `pointsEarned`; `wins`/`losses`/`ties` = counts of `outcome === "WIN" | "LOSS" | "TIE"`. `PENDING` entries are excluded from all summary counts

**And** outcome comparisons use the Prisma-generated `PickOutcome` enum (e.g. `PickOutcome.WIN`), **not** raw string literals — this new file must not extend the raw-literal debt tracked from Story 5.4

---

### AC2 — History page (current user's own picks only)

**Given** `src/app/(app)/leagues/[leagueId]/history/page.tsx`

**When** a logged-in league member visits `/leagues/[leagueId]/history`

**Then** the page is a **Server Component**: it calls `auth()`, resolves the caller's `LeagueMembership` via `userId_leagueId`, and calls `getPersonalPickHistory` directly (no API route)

**And** it passes **only the caller's own `membership.id`** to `getPersonalPickHistory` — the membership is derived from the session, never from a query param or request body (FR46 is self-only; do not accept an arbitrary `membershipId` from the client)

**And** auth/membership guard: `notFound()` if there is no valid session, if the user has no membership in this league, if the membership role is not a participant role (`isLeagueParticipantRole`), or if the league does not exist

**And** the page header mirrors the standings page: a back link `← {league.name}` to `/leagues/[leagueId]` and an `h1` titled `My Picks` (or `Pick History`)

**And** it renders the `PickHistoryTable` client component with the `PersonalPickHistory` result, passing only plain serializable data (no functions, no Prisma objects)

---

### AC3 — `PickHistoryTable` client component

**Given** `src/components/history/PickHistoryTable.tsx` with `"use client"` at the top

**When** rendered with `history: PersonalPickHistory`

**Then** it renders a MUI `Table` with columns: `Wk`, `Team`, `Result`, `Pts`

**And** the `Team` cell renders the existing `TeamLogo` (`size="sm"`) alongside the team abbreviation/name

**And** the `Result` cell shows a **text label** (not color-only) for accessibility (satisfies WCAG 1.4.1 — the chip/label conveys outcome via text, not just color):
- `WIN` → success-colored chip/label reading `WIN`
- `LOSS` → error-colored chip/label reading `LOSS`
- `TIE` → neutral chip/label reading `TIE`
- `PENDING` → muted `—` or `Pending` using `color="text.secondary"`

**And** when an entry has `antiJailedBonus === true`, a small `2 PTS` / anti-jailed indicator is shown near the team or result (reuse the existing anti-jailed chip styling/intent from `MatchupCard`); for a scored anti-jailed win this aligns with `pointsEarned === 2`

**And** the `Pts` cell shows `pointsEarned` for scored picks (`color: "primary.main"`, `fontWeight: 700`) and a muted `—` for `PENDING` entries; all numeric cells use `fontVariantNumeric: "tabular-nums"`

**And** above or below the table a season summary line shows the record (`W-L` or `W-L-T` when any ties exist — same format rule as `StandingsTable`) and total points

**And** when `history.entries` is empty, the component renders the empty state (no table):
```
"Your pick history will appear here after your first submission"
```
(`Typography variant="body2" color="text.secondary"` — copy from UX spec Empty States table)

**And** the component uses **`Stack`** for any flex layout wrappers (project convention; not `Box`)

---

### AC4 — League hub navigation

**Given** `src/app/(app)/leagues/[leagueId]/page.tsx`

**When** a member views the league hub "League hub" links section

**Then** a `History` (or `My picks`) link pointing to `/leagues/[leagueId]/history` appears alongside the existing `Weekly picks`, `Standings`, and `League rules` links

---

### AC5 — Tests (pure/mocked — no live network or DB in default `npm test`)

**Given** `src/lib/scoring/get-personal-pick-history.test.ts`

**When** run with `npm test`

**Then** the following cases pass with **mocked Prisma** (`vi.fn()` stubs — no real DB, no HTTP):

1. **Multiple weeks, sorted ascending** — picks across weeks (e.g. 3, 1, 2) return ordered `entries` by `nflWeekNumber` ascending with correct team data
2. **Outcome + points mapping** — a `WIN` (1 pt), an anti-jailed `WIN` (2 pts), a `LOSS` (0 pts), and a `TIE` map to the correct `outcome` and `pointsEarned`; `antiJailedBonus` flows through
3. **Pending pick** — a pick with `outcome: null` / `scoredAt: null` maps to `outcome: "PENDING"`, `pointsEarned: null`, and is **excluded** from `totalPoints`/`wins`/`losses`/`ties`
4. **Summary aggregation** — `totalPoints`, `wins`, `losses`, `ties` computed over scored picks only across a mixed set
5. **No season** — when `season.findFirst` returns `null`, the function returns the empty result without querying picks
6. **No picks** — season exists but member has no picks → `entries: []` and all-zero summary

**And** no live HTTP or DB calls are made in these tests

---

## Dev Notes

### What this story is (and is NOT)

This story surfaces **the current participant's own picks** for the season — week, team, outcome, points. It is a **read-only** view over already-scored data plus the participant's own not-yet-scored picks. **No new scoring logic and no schema change.**

- ✅ Show: the caller's own picks for every week they submitted (including the current unscored week, shown as `PENDING`).
- ❌ Do NOT show: any other participant's picks. That is Story 5.6 (Tuesday reveal). This page is self-only.

**FR48 does not gate this view.** A participant may always see their **own** picks at any time, including the current week before the Tuesday reveal. The privacy rule (FR48) only restricts seeing *other* participants' current-week picks. Because `getPersonalPickHistory` is hard-scoped to the caller's own `membershipId` (derived from the session in the page), there is no peer-visibility surface here. **Do not** add a `membershipId` query param or any "view another member's history" capability in this story.

### What Stories 5.1–5.4 provided (reuse, do not reinvent)

- **5.1:** `NflGame` rows with `status`, `homeScore`, `awayScore`, `finalizedAt`.
- **5.2:** `Pick.outcome` (`PickOutcome` enum: `WIN`/`LOSS`/`TIE`) and `Pick.pointsEarned` (`0`/`1`/`2`) populated by `scoreNflWeek`; `Pick.scoredAt` marks when scored. **A pick with `scoredAt === null` is not yet scored** → render as `PENDING`.
- **5.3:** `finalizeNflWeek` writes the scored values (MNF-aware).
- **5.4:** Established the page/data/component split this story mirrors exactly — copy that shape:
  - Data fn in `src/lib/scoring/*.ts` returning plain objects + colocated `*.test.ts` with `vi.fn()` mocked Prisma.
  - Server Component page under `src/app/(app)/leagues/[leagueId]/<route>/page.tsx` doing `auth()` + membership/league guards + direct data call.
  - `"use client"` MUI table component under `src/components/<area>/*.tsx` receiving serializable props.
  - Hub link added in `leagues/[leagueId]/page.tsx`.

**Story 5.5 is the same pattern as 5.4 with a different query and table — follow `5-4-live-leaderboard.md` and the existing `get-league-standings.ts` / `StandingsTable.tsx` / `standings/page.tsx` as the reference implementation.**

### Data query design for `getPersonalPickHistory`

```ts
// src/lib/scoring/get-personal-pick-history.ts
import { PickOutcome, type PrismaClient } from "@prisma/client";

export type PickHistoryOutcome = "WIN" | "LOSS" | "TIE" | "PENDING";

export type PickHistoryEntry = {
  nflWeekNumber: number;
  teamAbbreviation: string;
  teamName: string;
  antiJailedBonus: boolean;
  outcome: PickHistoryOutcome;
  pointsEarned: number | null;
};

export type PersonalPickHistory = {
  entries: PickHistoryEntry[];
  totalPoints: number;
  wins: number;
  losses: number;
  ties: number;
};

const EMPTY: PersonalPickHistory = {
  entries: [],
  totalPoints: 0,
  wins: 0,
  losses: 0,
  ties: 0,
};

export async function getPersonalPickHistory(
  prisma: PrismaClient,
  opts: { leagueId: string; nflSeasonYear: number; membershipId: string },
): Promise<PersonalPickHistory> {
  const season = await prisma.season.findFirst({
    where: { leagueId: opts.leagueId, nflSeasonYear: opts.nflSeasonYear },
    select: { id: true },
  });
  if (!season) return EMPTY;

  const picks = await prisma.pick.findMany({
    where: { leagueMembershipId: opts.membershipId, seasonId: season.id },
    select: {
      nflWeekNumber: true,
      antiJailedBonus: true,
      outcome: true,
      pointsEarned: true,
      scoredAt: true,
      team: { select: { abbreviation: true, name: true } },
    },
    orderBy: { nflWeekNumber: "asc" },
  });

  const entries: PickHistoryEntry[] = picks.map((p) => ({
    nflWeekNumber: p.nflWeekNumber,
    teamAbbreviation: p.team.abbreviation,
    teamName: p.team.name,
    antiJailedBonus: p.antiJailedBonus,
    outcome: p.outcome ?? "PENDING",
    pointsEarned: p.outcome == null ? null : (p.pointsEarned ?? 0),
  }));

  let totalPoints = 0;
  let wins = 0;
  let losses = 0;
  let ties = 0;
  for (const p of picks) {
    if (p.outcome == null) continue; // PENDING excluded from summary
    totalPoints += p.pointsEarned ?? 0;
    if (p.outcome === PickOutcome.WIN) wins += 1;
    else if (p.outcome === PickOutcome.LOSS) losses += 1;
    else if (p.outcome === PickOutcome.TIE) ties += 1;
  }

  return { entries, totalPoints, wins, losses, ties };
}
```

> `p.outcome ?? "PENDING"` is safe because `PickOutcome` values are the literal strings `"WIN" | "LOSS" | "TIE"`, which are a subset of `PickHistoryOutcome`. Use the `PickOutcome` enum for the **comparisons/aggregation** (AC1) to avoid raw-literal drift.

### Page structure — mirror the standings page exactly

```ts
// src/app/(app)/leagues/[leagueId]/history/page.tsx — Server Component (no "use client")
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PickHistoryTable } from "@/components/history/PickHistoryTable";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isLeagueParticipantRole } from "@/lib/league/participant-membership";
import { getCurrentNflSeasonYear } from "@/lib/league/nfl-season";
import { getPersonalPickHistory } from "@/lib/scoring/get-personal-pick-history";

export default async function LeagueHistoryPage({
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

  const { league } = membership;
  const nflSeasonYear = getCurrentNflSeasonYear();
  const history = await getPersonalPickHistory(prisma, {
    leagueId,
    nflSeasonYear,
    membershipId: membership.id, // self-only — from session, never from the client
  });

  return (
    <Stack component="main" spacing={3} sx={{ minHeight: "100vh", px: 2, py: 4, maxWidth: 560, mx: "auto" }}>
      <Typography variant="body2">
        <Link href={`/leagues/${leagueId}`}>← {league.name}</Link>
      </Typography>
      <Typography variant="h4" component="h1">My Picks</Typography>
      <PickHistoryTable history={history} />
    </Stack>
  );
}
```

### `PickHistoryTable` component design

- File: `src/components/history/PickHistoryTable.tsx`, **`"use client"`** (uses MUI `Table`, `Chip`, theme-aware `sx` callbacks, and the client `TeamLogo`).
- Props: `{ history: PersonalPickHistory }`.
- Columns: `Wk` (compact), `Team` (flexible, `width: "100%"`, render `TeamLogo size="sm"` + abbreviation/name in a `Stack direction="row"`), `Result` (compact), `Pts` (compact, right-aligned).
- Outcome label — **text + color**, never color alone:
  ```ts
  const resultMeta = {
    WIN: { label: "WIN", key: "success" },
    LOSS: { label: "LOSS", key: "error" },
    TIE: { label: "TIE", key: "default" },
    PENDING: { label: "—", key: "pending" },
  } as const;
  ```
  For `WIN`/`LOSS`/`TIE` use a MUI `Chip size="small"` with `sx={{ bgcolor: (t) => \`\${t.palette[key].main}26\`, color: (t) => t.palette[key].main }}` (same tinted pattern as the project's status chips); for `PENDING` render plain `—` text in `text.secondary`.
- Anti-jailed indicator: when `entry.antiJailedBonus`, show a small `2 PTS` chip — reuse the existing anti-jailed chip look from `src/components/picks/MatchupCard.tsx` (do not invent a new style). Place it inline in the Team or Result cell.
- `Pts` cell: scored → number with `color: "primary.main"`, `fontWeight: 700`; `PENDING` → muted `—`. Use `fontVariantNumeric: "tabular-nums"`.
- Summary: a single line (above the table or as a `caption`/`TableCaption`) showing record + total points, e.g. `5-2 · 7 pts` (use `W-L-T` only when `history.ties > 0`, matching `StandingsTable` record-format logic).
- Empty state: when `history.entries.length === 0`, render only the empty-state `Typography` (copy from AC3); do not render an empty table.

### Server/client boundary — follow `.cursor/rules/next-rsc-client-boundaries.mdc`

- `PickHistoryTable` **must** have `"use client"` (MUI `sx` theme callbacks + `TeamLogo` client child + `Chip`).
- `history/page.tsx` stays a **Server Component** (does `auth()`, Prisma) and passes only the plain `PersonalPickHistory` object down. This is an exact match for the standings split shipped in 5.4.

### Route + component locations

- Page: `src/app/(app)/leagues/[leagueId]/history/page.tsx` — sits alongside `standings/page.tsx` in the architecture target tree (the tree lists `picks/`, `standings/`, `rules/`, `admin/`; `history/` is the natural peer for FR46, mirroring how `standings/` was added in 5.4).
- Component dir: `src/components/history/` (new), mirroring `src/components/standings/` introduced in 5.4.
- Data fn: `src/lib/scoring/get-personal-pick-history.ts` (lives next to `get-league-standings.ts`).

### Mid-season start (project non-negotiable #8)

Leagues may begin at NFL Week N (not 1). This story does **not** need to compute "current week" — it simply lists the `Pick` rows that exist for the season, which already only span the league's competition weeks. No `firstCompetitionWeek` math is required here. Do **not** synthesize "missed/forgot" rows for weeks with no pick — that is out of scope for this story (see Out of scope).

### Deferred work — addressed in this story vs left deferred

Consulted `_bmad-output/implementation-artifacts/deferred-work.md`. Two items from the **5.4 code review** are naturally closed for the *new* code in this story (no extra cost):

- **Outcome comparisons using raw string literals instead of the Prisma enum** (5.4 deferred). The new `get-personal-pick-history.ts` **uses `PickOutcome`** for all comparisons (AC1), so it does not add to that debt. (The broader "single enum-import pass across the existing scoring module" remains deferred — do not refactor `get-league-standings.ts` / `score-nfl-week.ts` etc. in this story.)
- **Color-only highlight lacks a WCAG non-color indicator** (5.4 deferred). The new `PickHistoryTable` outcome cell conveys result via **text label** (`WIN`/`LOSS`/`TIE`), not color alone (AC3), satisfying WCAG 1.4.1 for this component.

Left deferred (do **not** action here): `generateMetadata` on pages (optional — may add a simple `export const metadata = { title: "My Picks" }` if trivial, but not required); enum-import pass on pre-existing scoring files; all other items in `deferred-work.md` are unrelated to FR46.

### Project non-negotiables (checklist)

- [ ] `"use client"` on `PickHistoryTable` (MUI `sx` theme callbacks + `TeamLogo`)
- [ ] Server Component page — `auth()` + Prisma in `history/page.tsx`
- [ ] Single Prisma client from `@/lib/db`
- [ ] `Stack` for flex layouts (not `Box`) — user/project convention
- [ ] Self-only: `membershipId` derived from session, never from client input (FR46; no FR48 leak)
- [ ] No `NEXT_PUBLIC_*` secrets; no peer pick data exposed
- [ ] camelCase JSON/props, snake_case DB columns (enforced by Prisma)
- [ ] Use `PickOutcome` enum for outcome comparisons in the new file

### Test patterns from prior stories

Follow the `vi.fn()` mocked-Prisma pattern from `get-league-standings.test.ts`:

```ts
const mockPrisma = {
  season: { findFirst: vi.fn() },
  pick: { findMany: vi.fn() },
} as unknown as PrismaClient;
```

Keep each test self-contained (direct assignments, no heavy `beforeEach`).

### Out of scope (do NOT build in Story 5.5)

- Peer-pick visibility / "view another member's history" / Tuesday reveal gating → **Story 5.6**.
- Synthesizing "missed week" / "forgot to pick" rows for weeks with no `Pick` row (would require competition-week range math; not required by FR46 AC).
- Desktop standings sidebar that embeds pick history (UX Phase 2 enhancement; MVP ships the standalone History page/table).
- A REST API route for history (server component reads Prisma directly, same as standings).
- Any change to scoring, `Pick` schema, or `finalizeNflWeek`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.5: Personal pick history] — AC: each week, team chosen, win/loss, points (FR46).
- [Source: _bmad-output/planning-artifacts/prd.md#FR46] — "Participants can view their personal pick history (all weeks, teams selected, outcomes)."
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Empty States] — "Your pick history will appear here after your first submission."
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md] — History is a primary tab (This Week | Standings | History | Rules); MVP surfaces it as a hub link + page.
- [Source: docs/project-context.md#Non-negotiables] — single Prisma client, server-authoritative, FR48 pick privacy, Stack over Box, camelCase/snake_case.
- [Source: _bmad-output/implementation-artifacts/5-4-live-leaderboard.md] — reference implementation for data fn + server page + client table + hub link split.
- [Source: prisma/schema.prisma#Pick] — `outcome` (`PickOutcome?`), `pointsEarned Int?`, `scoredAt`, `antiJailedBonus`, `nflWeekNumber`, `team` relation.
- [Source: src/lib/scoring/get-league-standings.ts] — sort/record/empty-state patterns to mirror.
- [Source: src/components/picks/TeamLogo.tsx] — reuse `TeamLogo size="sm"`.
- [Source: src/components/standings/StandingsTable.tsx] — `W-L` / `W-L-T` record format + tinted chip / tabular-nums conventions.
- [Source: .cursor/rules/next-rsc-client-boundaries.mdc] — server/client boundary rules.

## Tasks / Subtasks

- [x] **`getPersonalPickHistory` data function** (AC1, AC5)
  - [x] Create `src/lib/scoring/get-personal-pick-history.ts` with the types and function (use `PickOutcome` enum for comparisons)
  - [x] Write `src/lib/scoring/get-personal-pick-history.test.ts` covering all 6 cases (mocked Prisma)
  - [x] Verify `npm test` passes

- [x] **`PickHistoryTable` client component** (AC3)
  - [x] Create `src/components/history/PickHistoryTable.tsx` with `"use client"`
  - [x] Columns Wk / Team (with `TeamLogo size="sm"`) / Result (text+color label) / Pts
  - [x] Anti-jailed `2 PTS` indicator (reuse MatchupCard style), summary line (record + total points), empty state, tabular-nums

- [x] **History page** (AC2)
  - [x] Create `src/app/(app)/leagues/[leagueId]/history/page.tsx` (Server Component)
  - [x] Auth + participant-membership + league guards (mirror standings page)
  - [x] Call `getPersonalPickHistory` with the caller's own `membership.id`; pass result to `PickHistoryTable`

- [x] **League hub navigation** (AC4)
  - [x] Add `History` link to the "League hub" links section in `src/app/(app)/leagues/[leagueId]/page.tsx`

- [x] **Quality gate**
  - [x] `npm test` green
  - [x] `npm run lint` clean for new files
  - [x] `npm run build` passes

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

- Fixed test mock to simulate Prisma `orderBy` (unsorted input → sorted output)
- Fixed TIE chip palette typing: neutral styling via `text.secondary` instead of invalid `default` palette key

### Completion Notes List

- Implemented `getPersonalPickHistory` with `PickOutcome` enum comparisons, empty-season guard, and pending-pick exclusion from summary aggregates
- Added 6 mocked-Prisma unit tests covering sort, outcome mapping, pending picks, aggregation, no-season, and no-picks cases
- Built `PickHistoryTable` client component: Wk/Team/Result/Pts columns, text+color outcome chips (WCAG 1.4.1), anti-jailed `2 PTS` gold chip, record summary line, empty state
- Created `/leagues/[leagueId]/history` Server Component page mirroring standings auth/membership guards; self-only via session-derived `membership.id`
- Added `History` hub link alongside Weekly picks, Standings, and League rules
- Quality gate: 293 tests pass, new files lint clean, `npm run build` succeeds

### File List

- src/lib/scoring/get-personal-pick-history.ts (new)
- src/lib/scoring/get-personal-pick-history.test.ts (new)
- src/components/history/PickHistoryTable.tsx (new)
- src/app/(app)/leagues/[leagueId]/history/page.tsx (new)
- src/app/(app)/leagues/[leagueId]/page.tsx (modified)

### Review Findings

- [x] [Review][Patch] Mutable shared EMPTY constant returned by reference — `return EMPTY` should be `return { ...EMPTY }` to prevent callers from silently corrupting the module-level singleton [src/lib/scoring/get-personal-pick-history.ts:32]
- [x] [Review][Patch] Dead `scoredAt` field in Prisma select — fetched from DB but never read; remove `scoredAt: true` from the `pick.findMany` select [src/lib/scoring/get-personal-pick-history.ts:44]
- [x] [Review][Patch] Sort test validates mock behavior, not implementation — `makePrisma` pre-sorts in `findMany`; if `orderBy` is deleted from the production query the test still passes; make mock return unsorted data and rely solely on the `orderBy` assertion [src/lib/scoring/get-personal-pick-history.test.ts]
- [x] [Review][Patch] Dead `PENDING` entry in `resultMeta` dispatch table — `PENDING` is handled by the first `if`-branch so `resultMeta.PENDING` (with key `"pending"`, a non-existent MUI palette key) is unreachable dead code; remove it [src/components/history/PickHistoryTable.tsx:27-31]
- [x] [Review][Patch] TeamCell shows abbreviation only — AC3 specifies "abbreviation/name"; `entry.teamName` is available on `PickHistoryEntry` but never rendered; add the team name alongside the abbreviation [src/components/history/PickHistoryTable.tsx:88-101]
- [x] [Review][Patch] Missing test: scored pick with null `pointsEarned` — the `p.pointsEarned ?? 0` fallback is exercised by no test case; add a case where `outcome = WIN` and `pointsEarned = null` to verify the 0-coercion and totalPoints behavior [src/lib/scoring/get-personal-pick-history.test.ts]
- [x] [Review][Defer] scoredAt/outcome field inconsistency on partial DB writes [src/lib/scoring/get-personal-pick-history.ts:58-59] — deferred, pre-existing
- [x] [Review][Defer] season.findFirst is non-deterministic on duplicate records — findUnique would be safer; pre-existing pattern across scoring functions [src/lib/scoring/get-personal-pick-history.ts:34] — deferred, pre-existing
- [x] [Review][Defer] notFound() on unauthenticated session should redirect to sign-in — pre-existing auth pattern across all app pages [src/app/(app)/leagues/[leagueId]/history/page.tsx:22] — deferred, pre-existing
- [x] [Review][Defer] minHeight: "100vh" on page Stack inside nested layout — pre-existing layout pattern; mirrors standings page per spec [src/app/(app)/leagues/[leagueId]/history/page.tsx:40] — deferred, pre-existing
- [x] [Review][Defer] Breadcrumb link accessibility polish — "← {league.name}" text is screen-reader readable; full aria-landmark treatment deferred to Story 7.3 [src/app/(app)/leagues/[leagueId]/history/page.tsx:51] — deferred, pre-existing
- [x] [Review][Defer] React key on nflWeekNumber — DB unique constraint on (membershipId, seasonId, nflWeekNumber) prevents duplicates in practice; a stable DB row ID would be safer if exposed in the type [src/components/history/PickHistoryTable.tsx:137] — deferred, pre-existing
- [x] [Review][Defer] Unhandled Prisma rejections propagate as 500 — no try/catch in page or data function; pre-existing pattern across all server components [src/app/(app)/leagues/[leagueId]/history/page.tsx, src/lib/scoring/get-personal-pick-history.ts] — deferred, pre-existing

### Change Log

- 2026-06-16: Story 5.5 created (create-story) — personal pick history data function, history page, PickHistoryTable component, hub link, unit tests.
- 2026-06-16: Story 5.5 implemented — personal pick history data fn, history page, PickHistoryTable, hub link, 6 unit tests.
- 2026-06-16: Story 5.5 code review — 6 patches, 7 deferred, 13 dismissed.
