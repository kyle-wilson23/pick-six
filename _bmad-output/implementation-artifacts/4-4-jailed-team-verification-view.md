# Story 4.4: Jailed Team Verification View

Status: done

## Story

As a league admin,
I want to see how the jailed team was determined this week,
So that I can confirm automation executed correctly (**FR34**).

## Acceptance Criteria

1. **Verification view shows how jailed team was resolved**

   **Given** the admin is viewing the admin dashboard (`/leagues/[leagueId]/admin`)

   **When** the current week has a computed `NflWeekJailedTeam` row

   **Then** a "Jailed Team Verification" section is visible on the page containing:
   - The jailed team name and resolution method (`MONEYLINE`, `SPREAD`, or `RANDOM`)
   - The winning moneyline odds (the most negative moneyline in the week)
   - The total number of games in the week and how many had complete lines
   - When `resolvedBy === 'RANDOM'`: the random seed value used (hex string, for auditability per **FR52**)

2. **Candidate table shows all games that entered jailed evaluation**

   **Given** the verification section is rendered

   **When** there are candidates (games with complete moneyline lines)

   **Then** a candidate list/table shows each game that survived the initial `gamesWithCompleteLines` filter, including:
   - Home team and away team names
   - Home moneyline and away moneyline (American format, e.g. `-180` / `+155`)
   - Point spread in the favorite's favor
   - Which side was identified as the favorite (labeled clearly)
   - Visual indication of which candidate(s) won the MONEYLINE stage (the jailed winner is highlighted)
   - When `resolvedBy === 'SPREAD'` or `'RANDOM'`: which candidates survived to the SPREAD stage (using persisted `afterMoneyline` slice, see AC4)
   - When `resolvedBy === 'RANDOM'`: which candidates survived to the RANDOM stage (using persisted `afterSpread` slice)

3. **Empty state when no jailed team has been computed**

   **Given** the admin is on the admin dashboard

   **When** no `NflWeekJailedTeam` row exists for the current week (odds not yet snapshotted or computation not yet triggered)

   **Then** the verification section shows a helpful empty-state message (e.g. "No jailed team computed yet for Week N. Run the jailed team computation after the Tuesday odds snapshot.")

4. **`afterMoneyline` and `afterSpread` slices persisted in `auditJson`** *(resolves deferred item from Story 3.3)*

   **Given** the `resolveJailedTeam` pure function and `jailed-computation.ts` persist the result

   **When** jailed computation completes (any new run after this story ships)

   **Then** `auditJson` includes two additional optional slices:
   - `afterMoneyline`: array of `JailedCandidateAudit` objects — candidates that survived the moneyline stage (i.e. tied for the best moneyline)
   - `afterSpread`: array of `JailedCandidateAudit` objects — candidates that survived the spread stage (i.e. tied for both best ML and best spread; non-empty only when `resolvedBy === 'SPREAD'` or `'RANDOM'`)

   **And** backward-compatible: rows without these slices (old `v: 1` rows) render without the per-stage breakdown (show candidate list only, no stage highlighting)

5. **API endpoint — admin only, no sensitive data leak**

   **Given** `GET /api/leagues/[leagueId]/admin/jailed-verification`

   **When** called by an authenticated admin of that league

   **Then** the structured `JailedVerificationView` is returned with 200

   **And** 401 is returned for unauthenticated callers; 403 for authenticated non-admins; 404 when no jailed row exists for the current week (**NFR16**)

   **And** pick data is NOT included — this endpoint exposes only odds and jailed computation audit data (**NFR17**)

---

## Tasks / Subtasks

- [x] **Update `src/lib/domain/jailed.ts`** — add `afterMoneyline` / `afterSpread` to `JailedResult.audit` type *(resolves 3.3 deferred item)*
  - [x] Extend `JailedResult.audit` interface:
    ```ts
    audit: {
      gamesInWeek: number;
      gamesWithCompleteLines: number;
      candidates: JailedCandidateAudit[];
      winningMoneylineAmerican: number;
      tieLevel: "MONEYLINE" | "SPREAD" | "RANDOM";
      /** Candidates that tied for best moneyline (≥1 when tieLevel is SPREAD or RANDOM) */
      afterMoneyline: JailedCandidateAudit[];
      /** Candidates that tied for best spread after ML stage (≥1 when tieLevel is RANDOM) */
      afterSpread: JailedCandidateAudit[];
    };
    ```
  - [x] Update `buildResult` signature to accept `afterMoneyline` and `afterSpread` arrays (both default to `[]`)
  - [x] Pass `afterMl` (the filtered array) and `afterSpread` (the spread-filtered array) from `resolveJailedTeam` into each `buildResult` call:
    - MONEYLINE branch: `afterMoneyline: []`, `afterSpread: []` (no tie — winner determined outright)
    - SPREAD branch: `afterMoneyline: afterMl` (the tied ML candidates), `afterSpread: []`
    - RANDOM branch: `afterMoneyline: afterMl`, `afterSpread: afterSpread` (both tie levels populated)

- [x] **Update `src/lib/domain/jailed.test.ts`** — add assertions for `afterMoneyline` / `afterSpread`
  - [x] MONEYLINE resolution: `audit.afterMoneyline` is `[]`, `audit.afterSpread` is `[]`
  - [x] SPREAD resolution: `audit.afterMoneyline` length equals number of ML-tied candidates; `audit.afterSpread` is `[]`
  - [x] RANDOM resolution: `audit.afterMoneyline` and `audit.afterSpread` both non-empty

- [x] **Update `src/lib/nfl/jailed-computation.ts`** — include new fields in persisted `auditJson`
  - [x] Extend `auditJson` construction to spread `result.audit.afterMoneyline` and `result.audit.afterSpread`:
    ```ts
    const auditJson: Prisma.InputJsonValue = {
      v: 1,
      jailedTeamId: result.jailedTeamId,
      resolvedBy: result.resolvedBy,
      randomSeed: result.randomSeed ?? null,
      ...result.audit,  // now includes afterMoneyline and afterSpread
    };
    ```
  - [x] No schema migration required — `auditJson` is an untyped `Json` column; new fields are additive

- [x] **New query lib: `src/lib/admin/get-jailed-verification.ts`** (AC: #1, #2, #3, #5)
  - [x] Export Zod-validated `AuditJsonV1` schema for safe parsing of the `auditJson` Json field (use `z.object({ v: z.literal(1), ... }).passthrough()` for forward compatibility)
  - [x] Export `JailedCandidateView` type:
    ```ts
    type JailedCandidateView = {
      nflGameId: string;
      homeTeamId: string;
      homeTeamName: string;
      awayTeamId: string;
      awayTeamName: string;
      homeMoneylineAmerican: number;
      awayMoneylineAmerican: number;
      homeSpreadPoints: number;
      favoriteTeamId: string;
      favoriteTeamName: string;
      favoriteMoneylineAmerican: number;
      spreadInFavoriteFavor: number;
    };
    ```
  - [x] Export `JailedVerificationView` type:
    ```ts
    type JailedVerificationView = {
      weekNumber: number;
      jailedTeamId: string;
      jailedTeamName: string;
      resolvedBy: "MONEYLINE" | "SPREAD" | "RANDOM";
      randomSeed: string | null;
      gamesInWeek: number;
      gamesWithCompleteLines: number;
      winningMoneylineAmerican: number;
      computedAt: string;  // ISO string
      candidates: JailedCandidateView[];
      /** Present when resolvedBy === SPREAD or RANDOM; candidates that survived ML stage */
      afterMoneyline: JailedCandidateView[] | null;
      /** Present when resolvedBy === RANDOM; candidates that survived spread stage */
      afterSpread: JailedCandidateView[] | null;
    };
    ```
  - [x] Export `getJailedVerification(args: { leagueId: string }, db?: PrismaClient): Promise<JailedVerificationView | null>`
  - [x] Implementation pattern (same season/week resolution as `buildAdminOverrideData`):
    1. `resolveCurrentSeasonForLeague` → get `season.nflSeasonYear` + `season.preSeasonInitializedAt` + `season.firstCompetitionWeek`
    2. If season not found or not initialized → return `null`
    3. Load all `NflGame`s for the season (select `weekNumber`, `kickoffAt`) → run `resolvePicksWeekNumber` → get `weekNumber`
    4. `db.nflWeekJailedTeam.findUnique({ where: { nflSeasonYear_weekNumber: { nflSeasonYear, weekNumber } }, include: { jailedTeam: { select: { id, name } } } })`
    5. If not found → return `null` (caller renders empty state)
    6. Safe-parse `auditJson` with Zod; if parse fails → log warning and return `null`
    7. Collect all unique team IDs from `candidates` array (homeTeamId + awayTeamId)
    8. `db.team.findMany({ where: { id: { in: [...teamIds] } }, select: { id, name } })` → build `Map<string, string>`
    9. Map candidates to `JailedCandidateView` by joining team names
    10. Map `afterMoneyline` and `afterSpread` slices similarly (null if not present in auditJson — backward compatibility)
    11. Return `JailedVerificationView`
  - [x] Accept optional `db` param defaulting to `prisma` singleton (same pattern as `buildAdminOverrideData`)

- [x] **New API route: `src/app/api/leagues/[leagueId]/admin/jailed-verification/route.ts`** (AC: #5)
  - [x] `GET` handler only (read-only; no CSRF needed)
  - [x] Same admin auth guard pattern as `submission-status/route.ts` (401 → unauthenticated, 403 → non-admin)
  - [x] Call `getJailedVerification({ leagueId })`
  - [x] If `null` → return `NextResponse.json({ error: { code: "NOT_FOUND", message: "No jailed team computed for the current week" } }, { status: 404 })`
  - [x] On success → `NextResponse.json({ verification })` with status 200
  - [x] Wrap in try/catch → 500 on unexpected errors

- [x] **New UI component: `src/components/admin/AdminJailedVerification.tsx`** (AC: #1, #2, #3)
  - [x] **`"use client"`** — uses MUI components with theme-aware `sx` callbacks
  - [x] Props: `{ verification: JailedVerificationView | null; weekNumber: number | null }`
  - [x] Section heading: `Typography variant="h6"` — "Jailed Team Verification"
  - [x] **Empty state** (`verification === null`):
    - When `weekNumber` is known: `"No jailed team computed yet for Week {weekNumber}. Run jailed team computation after the Tuesday odds snapshot."`
    - When `weekNumber` is unknown: `"No active week — jailed team computation unavailable."`
    - Render in `Typography color="text.secondary"`
  - [x] **Populated state**:
    - Summary card (`Paper variant="outlined"`):
      - Jailed team name: `Typography variant="subtitle1" fontWeight={600}`
      - Resolution badge: MUI `Chip` label `"Resolved by: {resolvedBy}"` — color `"success"` for MONEYLINE, `"warning"` for SPREAD, `"error"` for RANDOM
      - Stats row: `"{gamesWithCompleteLines} of {gamesInWeek} games had complete lines"` in `Typography variant="body2"`
      - Winning moneyline: `"Winning moneyline: {winningMoneylineAmerican}"` in `Typography variant="body2"`
      - If `randomSeed`: `"Random seed: {randomSeed}"` in `Typography variant="caption" color="text.secondary"` — include a brief note "(used for FR52 auditability)"
      - `computedAt` timestamp: `Typography variant="caption" color="text.secondary"`
    - Candidate list (`Stack spacing={1}`):
      - Heading: `Typography variant="subtitle2"` — "Candidate Games (complete lines)"
      - Each candidate row: `Paper variant="outlined"` wrapping `Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1 }}`
        - Left: `"{homeTeamName} vs {awayTeamName}"`
        - Middle: `"{homeMoneylineAmerican} / {awayMoneylineAmerican}"` + `"Spread: {spreadInFavoriteFavor} (fav: {favoriteTeamName})"`
        - Right: `Chip` — `"JAILED"` (warning color) if `candidate.favoriteTeamId === verification.jailedTeamId`, otherwise `"ML tie"` (info color) if in `afterMoneyline`, or `"SPREAD tie"` if in `afterSpread`, or nothing
    - If `afterMoneyline` is non-null and non-empty (SPREAD/RANDOM tie): show sub-heading `"Moneyline tie — {afterMoneyline.length} teams advanced to spread tie-break"`
    - If `afterSpread` is non-null and non-empty (RANDOM tie): show sub-heading `"Spread tie — {afterSpread.length} teams advanced to random selection"`
  - [x] Use **`Stack`** for flex layouts (not `Box`) per workspace rules
  - [x] Visual weight: `elevation={0}` / `variant="outlined"` Paper — tertiary info per UX spec

- [x] **Update `src/app/(app)/leagues/[leagueId]/admin/page.tsx`** (AC: #1)
  - [x] Import `getJailedVerification` and `AdminJailedVerification`
  - [x] Add `getJailedVerification({ leagueId })` to the existing `Promise.all` parallel fetch:
    ```ts
    const [payload, overrideData, auditEntries, jailedVerification] = await Promise.all([
      buildSubmissionStatus({ leagueId }),
      buildAdminOverrideData({ leagueId }),
      getAuditLog({ leagueId }),
      getJailedVerification({ leagueId }),
    ]);
    ```
  - [x] Render `<AdminJailedVerification verification={jailedVerification} weekNumber={weekNumber} />` below `<AdminAuditLog entries={auditEntries} />`

- [x] **`npm test` green** — `jailed.test.ts` assertions updated; all 227+ existing tests must continue to pass

### Review Findings

- [x] [Review][Decision→Patch] `candidateStatusChip` → `candidateStatusChips` returns array — jailed winner now also shows "ML tie"/"SPREAD tie" chips for its stage memberships [`src/components/admin/AdminJailedVerification.tsx`]

- [x] [Review][Patch] `getJailedVerification` failure collapses entire admin dashboard via shared `Promise.all` — HIGH [`src/app/(app)/leagues/[leagueId]/admin/page.tsx`]
- [x] [Review][Patch] `auditJson` Zod parse failure returns 404 (row exists but is unreadable — should be 500) [`src/lib/admin/get-jailed-verification.ts`]
- [x] [Review][Patch] `randomSeed` rendered on truthiness instead of `resolvedBy === 'RANDOM'` [`src/components/admin/AdminJailedVerification.tsx`]

- [x] [Review][Defer] `jailed.randomSeed` (DB column) vs `audit.randomSeed` (JSON blob) not cross-validated — divergence silently shows wrong seed in FR52 audit display [`src/lib/admin/get-jailed-verification.ts`] — deferred, pre-existing storage split; fix when FR52 audit compliance is hardened
- [x] [Review][Defer] `resolvePicksWeekNumber` called independently in page and `getJailedVerification` — at a week-boundary crossing the page's `weekNumber` (for empty-state message) and the jailed section's `weekNumber` could diverge by 1 [`src/app/(app)/leagues/[leagueId]/admin/page.tsx`] — deferred, extremely rare race; fix by threading a shared `now` if it becomes observable
- [x] [Review][Defer] No fallback to the most recently computed jailed week — once `resolvePicksWeekNumber` advances to N+1 the section shows null until computation runs for N+1, even though N's record is in the DB [`src/lib/admin/get-jailed-verification.ts`] — deferred, spec gap; revisit when "view prior-week jailed" is requested
- [x] [Review][Defer] Backward-compat rows (missing `afterMoneyline`/`afterSpread`) display no stage chips with no UI hint — admin cannot distinguish "clean MONEYLINE win" from "old row, stage data unavailable" [`src/components/admin/AdminJailedVerification.tsx`] — deferred, spec-allowed; add "(legacy data — stage breakdown unavailable)" note if UX feedback warrants it
- [x] [Review][Defer] `jailed.jailedTeamId` (DB column) vs `audit.jailedTeamId` (JSON) never cross-checked — silent mismatch on corrupt data [`src/lib/admin/get-jailed-verification.ts`] — deferred, pre-existing data integrity gap; fix when a data-consistency validation layer is added
- [x] [Review][Defer] `.passthrough()` on `AuditJsonV1Schema` allows unknown fields without type error — intentional for forward-compat but weakens strictness [`src/lib/admin/get-jailed-verification.ts`] — deferred, intentional design per spec; revisit if schema drift causes runtime issues
- [x] [Review][Defer] `afterMoneyline`/`afterSpread` optional in `AuditJsonV1Schema` but required in `JailedResult` domain type — a future persistence path that omits them would pass Zod but show null in the UI silently [`src/lib/admin/get-jailed-verification.ts`] — deferred, write-side is guarded by TS type; monitor if new computation paths are added

---

## Dev Notes

### Why `afterMoneyline` / `afterSpread` Are Needed

From the **deferred work log** (Story 3.3 code review):

> **Per-stage survivors in jailed `audit`** — `src/lib/domain/jailed.ts` `buildResult`. Persist `afterMoneyline` and `afterSpread` slices alongside the full `candidates` array so a verifier (Story 4.4 jailed verification view) can see exactly which candidates reached the SPREAD or RANDOM stage without re-running the algorithm in their head.

Without these slices, the verification view can only display the full candidate list and which team won — it cannot show intermediate stages (who tied on ML, who then tied on spread) without re-running `resolveJailedTeam` against the stored data. Persisting them avoids that complexity.

**Backward compatibility**: Existing `NflWeekJailedTeam` rows (from Story 3.3 initial computation) will not have `afterMoneyline`/`afterSpread` in their `auditJson`. The query lib must handle this gracefully — if the fields are absent, `afterMoneyline` and `afterSpread` should be `null` in the returned view, and the component renders without per-stage highlighting.

### `auditJson` Shape Reference

```ts
// Stored in NflWeekJailedTeam.auditJson — typed by the application, not by Prisma
// v:1 shape after Story 4.4 ships (new rows):
{
  v: 1,
  jailedTeamId: string,
  resolvedBy: "MONEYLINE" | "SPREAD" | "RANDOM",
  randomSeed: string | null,           // hex, only when resolvedBy === "RANDOM"
  gamesInWeek: number,
  gamesWithCompleteLines: number,
  winningMoneylineAmerican: number,
  tieLevel: "MONEYLINE" | "SPREAD" | "RANDOM",
  candidates: JailedCandidateAudit[], // ALL candidates with complete lines
  afterMoneyline: JailedCandidateAudit[], // NEW: tied at ML stage (empty for MONEYLINE wins)
  afterSpread: JailedCandidateAudit[],    // NEW: tied at spread stage (empty unless RANDOM)
}
```

```ts
// JailedCandidateAudit shape (from src/lib/domain/jailed.ts):
{
  nflGameId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeMoneylineAmerican: number;     // e.g. -350
  awayMoneylineAmerican: number;     // e.g. +275
  homeSpreadPoints: number;          // raw home-relative spread, e.g. -7.5
  favoriteTeamId: string;
  favoriteMoneylineAmerican: number; // e.g. -350
  spreadInFavoriteFavor: number;     // e.g. 7.5 for a 7.5-point favorite
}
```

### Season / Week Resolution Pattern

`getJailedVerification` mirrors the exact pattern of `buildAdminOverrideData`:

```ts
import { resolveCurrentSeasonForLeague } from "@/lib/league/resolve-current-season";
import { resolvePicksWeekNumber } from "@/lib/nfl/resolve-picks-week";

const season = await resolveCurrentSeasonForLeague(db.season, leagueId);
if (!season || season.preSeasonInitializedAt == null) return null;

const minimalGames = await db.nflGame.findMany({
  where: { nflSeasonYear: season.nflSeasonYear },
  select: { weekNumber: true, kickoffAt: true },
});

const gamesForResolve = minimalGames
  .filter((g): g is { weekNumber: number; kickoffAt: Date } => g.kickoffAt != null)
  .map((g) => ({ weekNumber: g.weekNumber, kickoffAt: g.kickoffAt }));

if (gamesForResolve.length === 0) return null;

const weekNumber = resolvePicksWeekNumber(
  { preSeasonInitializedAt: season.preSeasonInitializedAt, firstCompetitionWeek: season.firstCompetitionWeek },
  gamesForResolve,
);

const jailed = await db.nflWeekJailedTeam.findUnique({
  where: { nflSeasonYear_weekNumber: { nflSeasonYear: season.nflSeasonYear, weekNumber } },
  include: { jailedTeam: { select: { id: true, name: true } } },
});
if (!jailed) return null;
```

### Safe Parsing of `auditJson`

Prisma returns `auditJson` typed as `Prisma.JsonValue`. Parse with Zod to get type safety and runtime safety:

```ts
import { z } from "zod";
import type { JailedCandidateAudit } from "@/lib/domain/jailed";

const JailedCandidateAuditSchema = z.object({
  nflGameId: z.string(),
  homeTeamId: z.string(),
  awayTeamId: z.string(),
  homeMoneylineAmerican: z.number(),
  awayMoneylineAmerican: z.number(),
  homeSpreadPoints: z.number(),
  favoriteTeamId: z.string(),
  favoriteMoneylineAmerican: z.number(),
  spreadInFavoriteFavor: z.number(),
});

const AuditJsonSchema = z.object({
  v: z.literal(1),
  jailedTeamId: z.string(),
  resolvedBy: z.enum(["MONEYLINE", "SPREAD", "RANDOM"]),
  randomSeed: z.string().nullable(),
  gamesInWeek: z.number(),
  gamesWithCompleteLines: z.number(),
  winningMoneylineAmerican: z.number(),
  tieLevel: z.enum(["MONEYLINE", "SPREAD", "RANDOM"]),
  candidates: z.array(JailedCandidateAuditSchema),
  // optional — absent in rows written before Story 4.4
  afterMoneyline: z.array(JailedCandidateAuditSchema).optional(),
  afterSpread: z.array(JailedCandidateAuditSchema).optional(),
});

const parsed = AuditJsonSchema.safeParse(jailed.auditJson);
if (!parsed.success) {
  console.warn("[jailed-verification] auditJson failed schema validation", {
    leagueId, weekNumber, error: parsed.error.message,
  });
  return null;
}
const audit = parsed.data;
```

### Team Name Resolution

Collect all unique team IDs from `audit.candidates` and do a single batch lookup:

```ts
const teamIds = [...new Set(
  audit.candidates.flatMap((c) => [c.homeTeamId, c.awayTeamId])
)];
const teams = await db.team.findMany({
  where: { id: { in: teamIds } },
  select: { id: true, name: true },
});
const teamNameMap = new Map(teams.map((t) => [t.id, t.name]));

function toView(c: JailedCandidateAudit): JailedCandidateView {
  return {
    ...c,
    homeTeamName: teamNameMap.get(c.homeTeamId) ?? c.homeTeamId,
    awayTeamName: teamNameMap.get(c.awayTeamId) ?? c.awayTeamId,
    favoriteTeamName: teamNameMap.get(c.favoriteTeamId) ?? c.favoriteTeamId,
  };
}
```

### Admin Auth Guard Pattern (reuse from audit-log)

```ts
const session = await auth();
if (!session?.user?.id) {
  return NextResponse.json(
    { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
    { status: 401 },
  );
}
const { leagueId } = await context.params;
const membership = await prisma.leagueMembership.findUnique({
  where: { userId_leagueId: { userId: session.user.id, leagueId } },
});
if (!membership || membership.role !== LeagueMembershipRole.ADMIN) {
  return NextResponse.json(
    { error: { code: "FORBIDDEN", message: "Admin role required" } },
    { status: 403 },
  );
}
```

### `"use client"` Requirement for `AdminJailedVerification`

The component uses MUI `Chip` with conditional `color` prop (which resolves differently per theme) and `sx` callbacks. Per the `next-rsc-client-boundaries` rule, any component using theme-aware `sx` callbacks or conditional MUI color props **must** be `"use client"`. Keep the admin page (`page.tsx`) as a Server Component — pass serializable `JailedVerificationView | null` as props.

### Page Layout Order

The updated admin page renders sections in this order:
1. Header + week title (existing)
2. Submission status / `AdminDashboardClient` (existing)
3. `<AdminJailedVerification verification={jailedVerification} weekNumber={weekNumber} />`  ← **new**
4. `<AdminAuditLog entries={auditEntries} />` (existing, stays at bottom as "tertiary" per UX spec)

Jailed verification is "secondary" admin monitoring content (verifying automation) while the audit log is "tertiary" (historical override records). This ordering reflects the UX spec hierarchy.

### No Rate Limiting

Consistent with all other admin-only GET endpoints (`submission-status/route.ts`, `audit-log/route.ts`). No `src/proxy.ts` change needed.

### No Zod Body Schema

The GET endpoint has no request body. No new Zod input schema needed.

### File Locations

| Area | File |
|------|------|
| Domain update | `src/lib/domain/jailed.ts` |
| Domain test update | `src/lib/domain/jailed.test.ts` |
| Computation update | `src/lib/nfl/jailed-computation.ts` |
| Query lib (new) | `src/lib/admin/get-jailed-verification.ts` |
| API route (new) | `src/app/api/leagues/[leagueId]/admin/jailed-verification/route.ts` |
| UI component (new) | `src/components/admin/AdminJailedVerification.tsx` |
| Admin page (update) | `src/app/(app)/leagues/[leagueId]/admin/page.tsx` |

### Imports to Reuse

```ts
// In get-jailed-verification.ts
import { prisma } from "@/lib/db";
import { resolveCurrentSeasonForLeague } from "@/lib/league/resolve-current-season";
import { resolvePicksWeekNumber } from "@/lib/nfl/resolve-picks-week";

// In jailed-verification/route.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LeagueMembershipRole } from "@prisma/client";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getJailedVerification } from "@/lib/admin/get-jailed-verification";

// In page.tsx additions
import { getJailedVerification } from "@/lib/admin/get-jailed-verification";
import { AdminJailedVerification } from "@/components/admin/AdminJailedVerification";
```

### Testing Focus

- **Unit tests** in `src/lib/domain/jailed.test.ts`: Assert the new `afterMoneyline` and `afterSpread` fields in `JailedResult.audit` for all three resolution paths (MONEYLINE, SPREAD, RANDOM). The existing test cases can be extended with additional `expect(result.audit.afterMoneyline).toEqual(...)` assertions.
- **No unit tests for** `getJailedVerification` or the route handler — consistent with `buildSubmissionStatus` and `submission-status/route.ts` which have no route-level tests in this codebase.
- `npm test` must pass green with 227+ existing tests continuing to pass; lint and build clean.

### Deferred Work Resolved

From `_bmad-output/implementation-artifacts/deferred-work.md`:
> **Per-stage survivors in jailed `audit`** — `src/lib/domain/jailed.ts` `buildResult`. Persist `afterMoneyline` and `afterSpread` slices alongside the full `candidates` array so a verifier (Story 4.4 jailed verification view) can see exactly which candidates reached the SPREAD or RANDOM stage without re-running the algorithm in their head.

This story implements that deferred item by extending `JailedResult.audit`, `buildResult`, and `auditJson` construction to include both slices.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4, Story 4.4 AC + FR34]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR34: "League admins can verify weekly jailed team calculation and see tie-breaker logic applied if needed"; NFR14, NFR23, NFR50]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — "admin can view jailed team calculation logic (odds data, tie-breaker cascade)" (line 486); monitoring dashboard design philosophy (lines 470, 486, 596)]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — 3.3 deferred: "Per-stage survivors in jailed audit"]
- [Source: `src/lib/domain/jailed.ts` — `JailedResult`, `JailedCandidateAudit`, `buildResult`, `resolveJailedTeam`]
- [Source: `src/lib/nfl/jailed-computation.ts` — `auditJson` construction; `computeAndPersistNflWeekJailed`]
- [Source: `src/lib/admin/build-admin-override-data.ts` — season/week resolution pattern to replicate]
- [Source: `src/app/api/leagues/[leagueId]/admin/audit-log/route.ts` — admin auth guard pattern for GET route]
- [Source: `src/app/api/leagues/[leagueId]/admin/submission-status/route.ts` — admin GET route pattern]
- [Source: `src/app/(app)/leagues/[leagueId]/admin/page.tsx` — Promise.all fetch pattern to extend]
- [Source: `prisma/schema.prisma` — `NflWeekJailedTeam` model; `NflJailedResolutionMethod` enum]
- [Source: `docs/project-context.md` — non-negotiables #2 (Prisma singleton), #5 (audit), #6 (naming); MUI Stack for flex]
- [Source: `.cursor/rules/next-rsc-client-boundaries.mdc` — `"use client"` requirement for MUI theme-aware components]

---

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

(none)

### Completion Notes List

- Extended `JailedResult.audit` with `afterMoneyline` and `afterSpread` slices; persisted automatically via existing `...result.audit` spread in `jailed-computation.ts`.
- Added `getJailedVerification` with Zod `AuditJsonV1Schema` (backward-compatible optional stage slices) and team name batch lookup.
- Admin dashboard shows jailed verification above audit log; empty state when no row for current week.
- `GET /api/leagues/[leagueId]/admin/jailed-verification` — admin-only, 404 when no computed jailed team.
- `npm test`: 227 tests passed.

### File List

- `src/lib/domain/jailed.ts` (modified)
- `src/lib/domain/jailed.test.ts` (modified)
- `src/lib/nfl/jailed-computation.ts` (unchanged — already spreads `result.audit`)
- `src/lib/admin/get-jailed-verification.ts` (new)
- `src/app/api/leagues/[leagueId]/admin/jailed-verification/route.ts` (new)
- `src/components/admin/AdminJailedVerification.tsx` (new)
- `src/app/(app)/leagues/[leagueId]/admin/page.tsx` (modified)

### Change Log

- 2026-05-30: Story 4.4 — jailed team verification view, audit stage slices, admin API and UI.
