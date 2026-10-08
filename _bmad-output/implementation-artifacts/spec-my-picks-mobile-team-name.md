---
title: 'My Picks table fits on mobile'
type: 'bugfix'
created: '2026-10-08'
status: 'done'
baseline_commit: '75c56f4f50250cc5287d06cca5ee8628d5c3e201'
context:
  - '{project-root}/docs/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** On a phone, the My Picks table (`/leagues/[leagueId]/history`) stretches past the screen. `LeagueNavShell` clips overflow, so the rightmost Pts column is cut off. The two-line team cell (logo, abbreviation, full name, `whiteSpace: nowrap`) is what forces that width.

**Approach:** Below the app’s desktop breakpoint, show only the team logo and abbreviation, and vertically center that abbreviation in the row. At desktop breakpoints, keep the full team name. The four columns (Wk, Team, Result, Pts) must all sit inside the existing content width.

## Boundaries & Constraints

**Always:**
- Keep columns Wk, Team, Result, and Pts, the season record line, WIN/LOSS/TIE chips, pending em dashes, the anti-jailed **2 PTS** chip, and the empty-state sentence.
- Treat **below `md` (768px)** as mobile and **`md` and up** as desktop — the same split `LeagueNavShell` uses for bottom nav vs the desktop bar.
- On mobile, do not render the full team name as visible text. Logo plus abbreviation is the team identity. Vertically center the abbreviation in the team cell.
- On desktop, keep the full team name visible under the abbreviation.
- The team cell still exposes the full name (for example via `title`) when the visible text is only the abbreviation.
- Prefer `Stack` for flex. Co-located tests. Do not change scoring or data fetching.

**Ask First:**
- Changing `LeagueNavShell` overflow or `appContentWidthSx`.
- Dropping a column, switching My Picks to cards, or hiding the anti-jailed chip.
- Editing `LeagueResultsTable` or `StandingsTable` in this change.

**Never:**
- `overflowX: auto` on the page or shell as the fix.
- Hiding the logo or the abbreviation.
- Hiding the full team name at `md` and up.
- Touching unrelated pages.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Mobile clip | Viewport ~393px; weeks with logo, abbrev, full name, result, pts | Wk, logo, abbrev, Result, and Pts all visible; no horizontal clip | N/A |
| Mobile team cell | Same row | Full name not visible; abbreviation vertically centered with the logo | N/A |
| Desktop name | Viewport ≥768px | Full team name visible under the abbreviation | N/A |
| Anti-jailed | `antiJailedBonus` true | **2 PTS** chip stays beside the abbreviation on both breakpoints | N/A |
| Pending | Outcome pending; points null | Result and Pts show — | N/A |
| Empty | `entries` empty | Existing empty copy; no table | N/A |
| Name access | Any width | Full team name available on the team cell (`title` or equivalent) | N/A |

</frozen-after-approval>

## Code Map

- `src/components/history/PickHistoryTable.tsx` -- Bare `<Table size="small">`, auto layout, Team header `width: "100%"`. `TeamCell` always renders `teamName` in a second line (`alignItems="flex-start"`). Primary change.
- `src/app/(app)/leagues/[leagueId]/history/page.tsx` -- Renders `<PickHistoryTable>`. Leave unless a screenshot needs the page title only.
- `src/components/league/LeagueNavShell.tsx` -- `overflowX: "hidden"` clipper; `md` is the nav breakpoint. Read-only.
- `src/components/results/LeagueResultsTable.tsx` -- Pattern for `TableContainer` + `tableLayout: "fixed"` + capped Result/Pts. Do not edit.
- `src/components/results/LeagueResultsTable.test.tsx` -- jsdom + `ThemeProvider` + `createAppTheme` pattern to copy.

## Tasks & Acceptance

**Execution:**
- [x] `src/components/history/PickHistoryTable.tsx` -- Constrain the table to the content width (fixed layout, capped Result/Pts). Hide the full team name below `md`. Keep it visible at `md` and up. Vertically center the abbreviation in the team cell on mobile. Put the full name on the cell `title`. -- Stop Pts from being clipped and match the requested mobile team cell.
- [x] `src/components/history/PickHistoryTable.test.tsx` -- Cover the I/O matrix cases unit tests can see: labeled columns, abbreviation, full name via `title`, anti-jailed chip, pending dashes, empty state, and that the name node is the one hidden below `md` (responsive `display`, not removed from desktop). -- Lock the behavior without a browser.

**Acceptance Criteria:**
- Given a history with at least one pick on a ~393px-wide viewport, when My Picks renders, then Wk, Team, Result, and Pts are all visible inside the screen.
- Given that mobile viewport, when a row renders, then the team cell shows the logo and abbreviation, the full name is not visible, and the abbreviation is vertically centered in the row.
- Given a viewport at or above 768px, when a row renders, then the full team name is visible with the logo and abbreviation.
- Given an anti-jailed pick, when the row renders, then the **2 PTS** chip remains next to the abbreviation.
- Given an empty `entries` array, when the table renders, then the existing empty-state sentence is shown and no table is rendered.

## Spec Change Log

## Design Notes

Hiding the name is required, and it is not enough by itself. The table is auto-layout with nowrap text, and the shell clips overflow. Match the results table so the remaining columns cannot grow past the content box:

```tsx
<TableContainer sx={{ width: "100%", overflowX: "hidden" }}>
  <Table size="small" aria-label="My pick history" sx={{ tableLayout: "fixed", width: "100%" }}>
```

Hide the name with responsive `display` (`none` below `md`, visible at `md`+), not `useMediaQuery`, so the server render does not flash the long name. On mobile, center the abbreviation with the logo (`alignItems: "center"` / `verticalAlign: "middle"`). Desktop keeps the current two-line, start-aligned text block.

## Verification

**Commands:**
- `npm test` -- expected: existing suite plus `PickHistoryTable` tests pass

**Manual checks (if no CLI):**
- At ~393px on `/leagues/{id}/history`, Pts is fully visible, the full team name is gone, and the abbreviation sits on the vertical center of the row. At ≥768px the full name is back.

## Suggested Review Order

**Fit the columns**

- Fixed layout and capped Result/Pts keep every column on screen.
  [`PickHistoryTable.tsx:173`](../../src/components/history/PickHistoryTable.tsx#L173)

**Mobile team cell**

- Full team name hides below md and returns at the desktop breakpoint.
  [`PickHistoryTable.tsx:143`](../../src/components/history/PickHistoryTable.tsx#L143)

- Abbreviation centers with the logo once the second line is gone.
  [`PickHistoryTable.tsx:129`](../../src/components/history/PickHistoryTable.tsx#L129)

- Cell title still exposes the full name when that line is hidden.
  [`PickHistoryTable.tsx:114`](../../src/components/history/PickHistoryTable.tsx#L114)

**Tests**

- Stylesheet checks lock the hide, centering, and fixed-layout rules.
  [`PickHistoryTable.test.tsx:112`](../../src/components/history/PickHistoryTable.test.tsx#L112)
