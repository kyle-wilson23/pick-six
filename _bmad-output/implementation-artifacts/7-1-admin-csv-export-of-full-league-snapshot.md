# Story 7.1: Admin CSV Export of Full League Snapshot

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a league admin,
I want a CSV of roster, all weekly picks, and totals,
so that I have an escape hatch if something goes wrong (**FR55**, **FR56**, **FR57**, **NFR48**).

## Acceptance Criteria

### AC1 — Data assembly: `buildLeagueExportData`

**Given** `src/lib/export/build-league-export-data.ts` exports `buildLeagueExportData(prisma, { leagueId, nflSeasonYear })`

**When** called for a league and NFL season year

**Then** it resolves the `Season` via `findUnique` on `(leagueId, nflSeasonYear)`; if no season exists it returns a valid empty export payload (see AC2 types) with `participants: []` and `jailedByWeek: []` — **not** an error

**And** it loads all `LeagueMembership` rows for the league with `user.email`, sorted by **`totalPoints` descending**, then **`user.email` ascending** (matches legacy sheet ordering: leaders at top)

**And** it loads all `Pick` rows for the season in **one query** (include `team.abbreviation`, `team.name`, `nflWeekNumber`, `antiJailedBonus`, `outcome`, `pointsEarned`, `scoredAt`, `leagueMembershipId`) — do **not** N+1 per participant

**And** it loads jailed-team rows from `NflWeekJailedTeam` for `(nflSeasonYear, weekNumber 1–18)` including `jailedTeam.abbreviation` and `jailedTeam.name` (empty array when none)

**And** it computes per-participant **`totalPoints`** using the **same rules** as `getLeagueStandings`: sum `pointsEarned` for picks with `scoredAt != null` only

**And** it maps each picked team to a **legacy short export label** via `teamNameForExport(abbreviation, fullName)` from `src/lib/export/team-name-for-export.ts` (e.g. `DEN` → `Broncos`, `TB` → `Bucs`, `WAS` → `Commanders`) — **not** the full DB name (`Denver Broncos`) and **not** the raw abbreviation (`DEN`). Jailed-team row uses the same helper.

**And** it returns:

```ts
export type LeagueExportParticipant = {
  membershipId: string;
  email: string;
  picksByWeek: Map<number, {
    exportTeamLabel: string; // legacy short name for CSV cell
    antiJailedBonus: boolean;
    outcome: "WIN" | "LOSS" | "TIE" | "PENDING";
    pointsEarned: number | null;
  }>;
  totalPoints: number;
};

export type LeagueExportJailedWeek = {
  weekNumber: number;
  exportTeamLabel: string; // legacy short name for jailed sub-header row
};

export type LeagueExportData = {
  nflSeasonYear: number;
  exportedAtIso: string; // injectable for tests; not written to CSV grid
  participants: LeagueExportParticipant[];
  jailedByWeek: LeagueExportJailedWeek[]; // weeks 1–18; empty label when no jailed row for that week
};
```

**And** a pick with `outcome == null` maps to `outcome: "PENDING"` and `pointsEarned: null` (same as `getPersonalPickHistory`)

**And** outcome comparisons use the Prisma-generated `PickOutcome` enum, **not** raw string literals

**And** **`user.email`** is the participant row identifier — the app does not require `user.name`; do **not** export a separate display-name column

---

### AC2 — CSV serialization: `serializeLeagueExportCsv` (legacy spreadsheet layout)

**Given** `src/lib/export/serialize-league-export-csv.ts` exports `serializeLeagueExportCsv(data: LeagueExportData): string`

**When** called with export data

**Then** it returns a **single UTF-8 CSV string** (no BOM required) that mirrors Kyle's **manual league spreadsheet** — one wide grid, no `# metadata` sections, no separate jailed-team table

**And** the file is exactly **2 header rows + N participant rows**, structured as:

**Row 1 (week headers):**

```
Email,Week 1,Week 2,...,Week 18,Total Points
```

**Row 2 (jailed team sub-headers — italic styling is a spreadsheet presentation concern; CSV is plain text):**

```
,<jailed week 1 label>,<jailed week 2 label>,...,<jailed week 18 label>,
```

**And** when no `NflWeekJailedTeam` row exists for a week, that week's jailed cell is **empty**

**And** **participant rows** (one per member, sorted per AC1):

```
<email>,<week 1 pick label>,<week 2 pick label>,...,<week 18 pick label>,<totalPoints>
```

**And** each week cell contains the **legacy short team label** for the participant's pick (e.g. `Commanders`, `Broncos`) or is **empty** when no pick exists for that week

**And** **`Total Points`** is the final column — integer sum of scored `pointsEarned` only (matches Standings page)

**And** weeks **1 through 18** always appear (FR58 regular season; legacy manual sheets may have used 16 weeks — product export uses 18)

**And** CSV cells contain **team labels only** — not outcome text, not point values per week. Legacy sheet **cell colors** encode scoring (see AC2a below); plain CSV cannot carry color — admin may re-apply conditional formatting in Sheets/Excel after import if desired

**And** all fields are RFC 4180–escaped: fields containing comma, quote, or newline are wrapped in double quotes with internal `"` doubled

**And** the pure serializer has **no Prisma or HTTP imports** (unit-testable in isolation)

---

### AC2a — Legacy color semantics (reference for manual formatting; not written to CSV)

Kyle's manual spreadsheet uses cell background colors to encode weekly scoring. The export preserves **pick + total points**; colors are optional post-import formatting:

| Legacy color | Meaning | App mapping (`pointsEarned` after score) |
|--------------|---------|------------------------------------------|
| **Green** | Earned 1 point | Scored pick with `pointsEarned === 1` (standard win) |
| **Red** | Earned 0 points | Scored pick with `pointsEarned === 0` (loss or tie — both are 0 in this league) |
| **Blue** | Earned 2 points (anti-jailed win) | Scored pick with `pointsEarned === 2` (`antiJailedBonus === true` and win) |
| **Yellow / orange** | — | **Ignore** — no export encoding |

**Pending/unscored weeks:** pick label may appear in the cell; no color semantics until `scoredAt` is set.

---

### AC3 — Export API route (admin-only download)

**Given** `src/app/api/leagues/[leagueId]/export/route.ts` exporting **`GET`**

**When** an authenticated league **admin** requests `/api/leagues/[leagueId]/export`

**Then** the handler:

1. Calls `auth()`; returns **401** `{ error: { code: "UNAUTHENTICATED", message: "Sign in required" } }` when no session
2. Verifies `LeagueMembership.role === ADMIN`; returns **403** `{ error: { code: "FORBIDDEN", message: "Admin access required for this league" } }` for non-admins or non-members
3. Resolves `nflSeasonYear` via `getCurrentNflSeasonYear()` and loads export data via `buildLeagueExportData`
4. Returns **404** when the league id does not exist
5. Returns **200** with body `serializeLeagueExportCsv(data)` and headers:
   - `Content-Type: text/csv; charset=utf-8`
   - `Content-Disposition: attachment; filename="<sanitized-league-name>-<nflSeasonYear>-export.csv"` (sanitize: replace non-alphanumeric with `-`, collapse repeats, max 64 chars for name portion)
   - `Cache-Control: no-store`

**And** the route is **read-only** — no CSRF assertion required (GET)

**And** **participants cannot access** this route (403) — admin fail-safe only (**FR55**, **NFR48**)

**And** uncaught errors log with `console.error` and return **500** `{ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }` (same pattern as `submission-status/route.ts`)

**And** add `import "server-only"` at top of route and data modules under `src/lib/export/`

---

### AC4 — Admin UI: download control

**Given** the league admin dashboard at `/leagues/[leagueId]/admin`

**When** an admin views the page

**Then** a **secondary** export control is visible in the page header area (same row as the `h1` on `md+`, stacked below on mobile)

**And** the control is implemented as a client component `src/components/admin/AdminExportCsvButton.tsx` with `"use client"`

**And** it renders an MUI **`Button`** with `variant="outlined"` (UX § Button Hierarchy — **Secondary**), label **"Export league CSV"**, `size="medium"`, linking to `/api/leagues/${leagueId}/export` via **`component="a"`** + `href` (same-origin cookie auth — do **not** fetch+blob unless needed)

**And** optional `download` attribute is OK but not required (Content-Disposition from server is authoritative)

**And** include a one-line helper caption below or `aria-describedby`: **"Download full season picks and standings for spreadsheet backup"** (`Typography variant="caption" color="text.secondary"`)

**And** the export control is visible even when `weekNumber == null` or there are zero participants (admin may export mid-season or pre-season for roster snapshot)

**And** use **`Stack`** for layout wrappers (project convention)

---

### AC5 — Tests

**Given** colocated unit tests

**When** `npm test` runs

**Then** `src/lib/export/team-name-for-export.test.ts` covers at minimum:

1. Known abbreviations map to legacy labels (`DEN` → `Broncos`, `TB` → `Bucs`)
2. Unmapped abbreviation falls back safely (document fallback rule in test)

**And** `src/lib/export/serialize-league-export-csv.test.ts` covers at minimum:

1. **RFC 4180 escaping** — email with comma renders correctly
2. **Two-row header** — row 1 `Email,Week 1,...,Week 18,Total Points`; row 2 jailed labels under week columns
3. **Participant row** — email + week pick labels + trailing total points
4. **Empty pick cells** — missing week pick renders as empty field between commas

**And** `src/lib/export/build-league-export-data.test.ts` covers with **mocked Prisma** (`vi.fn()`):

1. **Sort order** — higher `totalPoints` appears earlier; tie-break by email ascending
2. **No season** — returns empty participants array
3. **Pick mapping** — pick flows through with `exportTeamLabel` from `teamNameForExport`
4. **Total points** — sums scored picks only; pending picks excluded from total

**And** no live DB or HTTP in these tests

**Optional (recommended, not blocking):** route-level test stubbing auth+prisma is **not** required per project norms ("Prisma optional in route tests")

---

## Tasks / Subtasks

- [x] Task 1: Legacy team labels (AC: #1, #2)
  - [x] Create `src/lib/export/team-name-for-export.ts` exporting `teamNameForExport(abbreviation: string, fullName: string): string`
  - [x] Map all 32 NFL abbreviations to legacy short names matching manual sheet convention (nickname-style: `Broncos`, `Bucs`, `49ers`, etc.)
  - [x] Add `src/lib/export/team-name-for-export.test.ts`

- [x] Task 2: Export data layer (AC: #1)
  - [x] Create `src/lib/export/build-league-export-data.ts` + types
  - [x] Reuse total-points logic from `get-league-standings.ts` (sum scored `pointsEarned` only)
  - [x] Sort participants by total points desc, email asc
  - [x] Single batched Prisma query for picks; single query for jailed teams
  - [x] Add `src/lib/export/build-league-export-data.test.ts`

- [x] Task 3: CSV serializer (AC: #2, #2a)
  - [x] Create `src/lib/export/serialize-league-export-csv.ts` with `escapeCsvField` helper (private)
  - [x] Emit 2-row header + participant rows only (no metadata sections)
  - [x] Add `src/lib/export/serialize-league-export-csv.test.ts`

- [x] Task 4: API route (AC: #3)
  - [x] Create `src/app/api/leagues/[leagueId]/export/route.ts`
  - [x] Mirror admin guard from `src/app/api/leagues/[leagueId]/admin/submission-status/route.ts`
  - [x] Filename sanitization helper (inline or `src/lib/export/sanitize-download-filename.ts`)

- [x] Task 5: Admin UI (AC: #4)
  - [x] Create `src/components/admin/AdminExportCsvButton.tsx`
  - [x] Wire into `src/app/(app)/leagues/[leagueId]/admin/page.tsx` header row
  - [x] Verify responsive layout at `xs` and `md+`

- [x] Task 6: Verification (AC: #5)
  - [x] Run `npm test` and `npm run lint`
  - [x] Manual: sign in as admin → Admin tab → Export → open CSV in Excel/Numbers; confirm layout matches legacy sheet (email column, jailed sub-header row, week pick grid, total points column); totals match Standings page

### Review Findings

- [x] [Review][Patch] Non-existent league ID returns 403 instead of 404 [`src/app/api/leagues/[leagueId]/export/route.ts:34-43`]
- [x] [Review][Patch] Missing `import "server-only"` on `serialize-league-export-csv.ts` and `sanitize-download-filename.ts` (AC3)
- [x] [Review][Patch] No-season payload returns 18 empty jailed-week entries instead of `jailedByWeek: []` per AC1 [`src/lib/export/build-league-export-data.ts:77-83`]
- [x] [Review][Defer] CSV formula-injection not sanitized (email/team cells starting with `=`, `+`, `-`) [`src/lib/export/serialize-league-export-csv.ts:5-9`] — deferred, not in story AC; security hardening follow-up
- [x] [Review][Defer] Anchor download navigates to raw JSON on 401/403/500 [`src/components/admin/AdminExportCsvButton.tsx:17-24`] — deferred, spec explicitly chose `component="a"` + `href` over fetch+blob
- [x] [Review][Defer] `auth()` call outside try/catch [`src/app/api/leagues/[leagueId]/export/route.ts:24-30`] — deferred, matches existing `submission-status` route pattern
- [x] [Review][Defer] `REGULAR_SEASON_WEEKS` constant duplicated in builder and serializer — deferred, maintainability nit
- [x] [Review][Defer] No unit tests for `sanitizeDownloadFilenameSegment` — deferred, filename helper is simple and route-tested manually
- [x] [Review][Defer] No audit log entry for bulk PII export — deferred, observability scope is Story 7.2/7.4

---

## Dev Notes

### What this story is (and is NOT)

This story delivers the **admin fail-safe** described in the PRD and UX spec: a complete league snapshot exportable to CSV for external spreadsheet management if the system fails mid-season.

- ✅ **In scope:** Admin-only GET export; **legacy spreadsheet layout** (email rows, 2-row week/jailed headers, week 1–18 pick grid, total points column); legacy short team names; RFC 4180 CSV; download button on admin dashboard.
- ❌ **Out of scope:** Audit log export (NFR50 is separate); JSON/ZIP formats; scheduled exports; participant-facing export; email-triggered export; production Resend/domain work (post-epic-8); observability/logging (Story 7.2); WCAG audit (7.3); performance timeouts (7.4).

### Architecture compliance

| Requirement | Implementation |
|-------------|----------------|
| Export route location | `src/app/api/leagues/[leagueId]/export/route.ts` [Source: `architecture.md` — Requirements mapping FR55–FR60] |
| Admin-only gate | `LeagueMembershipRole.ADMIN` in route + existing admin page guard |
| Server-only | `import "server-only"` on export lib modules and route |
| Prisma singleton | Import from `@/lib/db` only |
| Error JSON shape | `{ error: { code, message } }` [Source: `docs/project-context.md` § Errors] |
| Domain purity | CSV escaping + row layout in pure functions under `src/lib/export/`; route orchestrates I/O |

### Reuse — do NOT reinvent

| Existing module | Reuse for |
|---------------|-----------|
| `src/lib/scoring/get-league-standings.ts` | Total points aggregation (scored picks only) |
| `prisma/data/nfl-teams.json` | Source list for building `teamNameForExport` abbreviation map |
| `src/lib/scoring/get-personal-pick-history.ts` | Pending vs scored pick mapping |
| `src/lib/scoring/get-league-peer-pick-history.ts` | Batch pick query shape with membership+team includes |
| `src/app/api/leagues/[leagueId]/admin/submission-status/route.ts` | Admin auth guard pattern |
| `src/lib/league/nfl-season.ts` → `getCurrentNflSeasonYear()` | Season year for export |
| `src/lib/league/resolve-current-season.ts` | Optional: confirm season row exists on admin page context (export route can use `buildLeagueExportData` directly) |

### Legacy spreadsheet layout (product decision — Kyle 2026-07-06)

Reference: Kyle's manual league Google Sheet (screenshot in story planning).

```
| Email          | Week 1      | Week 2     | ... | Week 18    | Total Points |
|----------------|-------------|------------|-----|------------|--------------|
|                | Broncos     | Ravens     | ... | Texans     |              |
| user@email.com | Commanders  | Cardinals  | ... | ...        | 14           |
```

- **Participant column:** `user.email` only (no display name — app does not track full names reliably).
- **Jailed row:** row 2 under week headers; same legacy short team labels as pick cells.
- **Pick cells:** legacy short team name for the picked team.
- **Colors:** green = 1 pt, red = 0 pt, blue = 2 pt (anti-jailed win); yellow/orange ignored. CSV is plain text — colors are not exported; see AC2a if admin wants to re-create formatting.

### Season / week scope

- **Week columns 1–18** always exported (FR58). Mid-season leagues (`Season.firstCompetitionWeek > 1`) still include early-week columns — they will be blank until/unless picks exist.
- Legacy manual sheets used **16 weeks** in some seasons; product export uses **18** per NFL regular season model.
- **`NFL_SEASON_YEAR` env override** applies via `getCurrentNflSeasonYear()` — export uses the same season year as the rest of the app.

### UX guidance (admin export control)

[Source: `ux-design-specification.md` § Error Recovery / Trust Through Transparency]

> Admin has CSV export as ultimate failsafe if catastrophic system failure requires manual league management continuation.

[Source: `ux-design-specification.md` § Button Hierarchy]

- Export is a **Secondary** action (`variant="outlined"`) — not primary (primary on admin dashboard remains submission/email workflows).
- Place in admin dashboard header so it is discoverable during incidents without hunting in settings.
- **Do not** use Destructive styling — export is safe/read-only.
- 48px button height is deferred globally (6.6 gap matrix → Epic 7.3/7.4); use default MUI medium button for this story.

### Deferred work — applicable items

| Item | Action this story |
|------|-------------------|
| `AdminPickOverrideDialog.tsx` pre-existing lint errors (Epic 5 retro) | Fix **only if** you touch that file; otherwise leave for a dedicated lint pass |
| Raw string `PickOutcome` comparisons (5.4 deferral) | **Do not extend debt** — use `PickOutcome` enum in new export code |
| `generateMetadata` on admin page (5.4/5.6 deferral) | Optional trivial `{ title: "Admin" }` — **not required** |
| N+1 queries in scoring/sync (5.1/5.2 deferral) | Export must batch picks in one query; do not per-participant `findMany` |
| Email/observability deferrals | **Unrelated** — do not scope-creep NFR32 webhook or cron monitoring here |

### Security notes

- Export includes participant **email addresses** — acceptable for admin fail-safe (admin already sees emails in submission/audit surfaces); do not expose this route to participants.
- No rate-limit entry required in `src/proxy.ts` for this read-only GET (not listed in project-context high-risk POST patterns); optional follow-up in 7.4 if abuse becomes a concern.

### Manual verification checklist

1. Seed or use dev league with ≥2 participants and picks across multiple weeks (some scored, one current-week pending).
2. Admin → **Export league CSV** → file downloads.
3. Open CSV: row 1 = week headers + Total Points; row 2 = jailed teams; data rows = emails + picks + totals; totals match Standings page; team labels match legacy short names (e.g. `Broncos` not `Denver Broncos`).
4. Sign in as non-admin participant → `GET /api/leagues/{id}/export` returns **403**.
5. Logged out → **401**.

### Project structure notes

```
src/lib/export/
  team-name-for-export.ts
  team-name-for-export.test.ts
  build-league-export-data.ts
  build-league-export-data.test.ts
  serialize-league-export-csv.ts
  serialize-league-export-csv.test.ts

src/app/api/leagues/[leagueId]/export/route.ts

src/components/admin/AdminExportCsvButton.tsx
```

Aligns with architecture tree (`lib/export` implied by domain pattern; route path explicit in architecture.md).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 7, Story 7.1]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR55–FR57, NFR48, Admin CSV Export risk mitigation §]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Export route mapping, resilience / escape hatch]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Error recovery / admin failsafe; Button Hierarchy § Secondary]
- [Source: `docs/project-context.md` — Stack, errors, server-only secrets, testing conventions]
- [Source: `_bmad-output/implementation-artifacts/pre-epic-7-observability-scope-decision.md` — 7.1 independent of 7.2]
- [Source: `_bmad-output/implementation-artifacts/6-6-ux-spec-comparison-and-alignment.md` — Admin dashboard layout; email controls always visible pattern]
- [Source: `_bmad-output/implementation-artifacts/5-5-personal-pick-history.md` — Page/data/pure-fn split pattern]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — Applicable deferrals listed above]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

### Completion Notes List

- Implemented `src/lib/export/*` pure data layer: legacy team labels (32 NFL abbreviations + TB→Bucs override), batched Prisma assembly with scored-only totals, and RFC 4180 CSV serializer (2-row header + participant grid).
- Added admin-only GET `/api/leagues/[leagueId]/export` with auth/admin guards, league 404, sanitized filename, and `text/csv` download headers.
- Added `AdminExportCsvButton` to admin dashboard header (responsive Stack layout; outlined secondary action).
- Tests: 10 new unit tests across 3 export modules; full suite 349 passing; eslint clean.

### File List

- `src/lib/export/team-name-for-export.ts`
- `src/lib/export/team-name-for-export.test.ts`
- `src/lib/export/build-league-export-data.ts`
- `src/lib/export/build-league-export-data.test.ts`
- `src/lib/export/serialize-league-export-csv.ts`
- `src/lib/export/serialize-league-export-csv.test.ts`
- `src/lib/export/sanitize-download-filename.ts`
- `src/app/api/leagues/[leagueId]/export/route.ts`
- `src/components/admin/AdminExportCsvButton.tsx`
- `src/app/(app)/leagues/[leagueId]/admin/page.tsx`

## Change Log

- 2026-07-06: Story 7.1 implemented — admin CSV export (data layer, API route, UI button, unit tests).
- 2026-07-06: Code review fixes — league 404 before admin 403, `server-only` on remaining export modules, no-season `jailedByWeek: []`.
