---
title: 'GH-2: League Results table clipped on mobile'
type: 'bugfix'
created: '2026-08-30'
status: 'done'
baseline_commit: 'cca027d377bc4bdac5200804511a1319ab4410fe'
context:
  - '{project-root}/docs/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** On mobile (iPhone ~393px), `/leagues/[leagueId]/results` clips the right side of the page. The four-column results table grows past the viewport; `LeagueNavShell` uses `overflowX: hidden`, so users cannot scroll to see Result/Pts.

**Approach:** Constrain `LeagueResultsTable` the same way `StandingsTable` already does — fixed layout, bounded columns, ellipsis — so every week table fits the content width without changing the app shell.

## Boundaries & Constraints

**Always:**
- Keep columns Participant, Team, Result, Pts. Keep per-week headings, "Not yet revealed", current-user row highlight, WIN/LOSS/TIE chips, anti-jailed **2 PTS** chip, Submitted-check fallback, and empty-state copy.
- Table must fit inside the existing content width (padding included) at 393px. No page-level horizontal scroll.
- Match `StandingsTable`: `TableContainer` + `tableLayout: "fixed"` + `width: "100%"` + ellipsis/`title` on truncated participant (and team) text.
- Prefer `Stack` for flex. Co-located tests. Do not change scoring, pick-visibility, or data fetching.

**Ask First:**
- Changing `LeagueNavShell` overflow or `appContentWidthSx`.
- Switching Results to stacked cards or dropping a column on `xs`.
- Fixing `PickHistoryTable` in the same change (not reported in #2).

**Never:**
- `overflowX: auto` on the page/shell as the fix.
- Restyling Results as cards or collapsing columns without approval.
- Touching `_bmad-output/brainstorming/` or unrelated pages.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Mobile clip | Viewport 393px; week with names + team + result + pts | All four columns visible; no horizontal clip of the page | N/A |
| Long name | Display name longer than Participant column | Name ellipsizes; `title` exposes full name | N/A |
| Hidden pick | Team fields null; not revealed | Submitted check + "Submitted"; Result/Pts still visible | N/A |
| Anti-jailed | `antiJailedBonus` true; team revealed | Logo/abbrev + **2 PTS** chip still readable | N/A |
| Empty | `history.weeks` empty | Existing empty copy; no table | N/A |
| Desktop | Viewport ≥960px | Same four columns; readable, not card-stacked | N/A |

</frozen-after-approval>

## Code Map

- `src/components/results/LeagueResultsTable.tsx` -- Bare `<Table>` (no container, auto layout, Participant `width: "100%"`). Primary change.
- `src/components/results/LeagueResultsTable.test.tsx` -- One test (Submitted fallback). Extend for layout/a11y.
- `src/components/standings/StandingsTable.tsx` -- Pattern to copy (do not change unless a shared helper is clearly justified).
- `src/components/league/LeagueNavShell.tsx` -- `overflowX: hidden` clipper. Read-only.
- `src/app/(app)/leagues/[leagueId]/results/page.tsx` -- Page chrome only. Leave unless padding is the remaining clip.

## Tasks & Acceptance

**Execution:**
- [x] `src/components/results/LeagueResultsTable.tsx` -- Wrap each week table in `TableContainer`; fixed layout; cap Result/Pts widths; ellipsis + `title` on Participant/Team overflow; keep chips and Submitted fallback -- Stop the table from exceeding the shell width.
- [x] `src/components/results/LeagueResultsTable.test.tsx` -- Keep the Submitted test; add coverage that week tables expose a labeled table and that long names stay in-document (ellipsis/`title`) -- Lock the I/O matrix cases that unit tests can see.

**Acceptance Criteria:**
- Given a league with at least one results week on a 393×641 viewport, when the user opens `/leagues/{id}/results`, then Participant, Team, Result, and Pts are all visible without the page being clipped on the right.
- Given a long participant display name, when the table renders, then the name is truncated in-cell and the full name is available via `title`.
- Given a week that is not revealed and team identity is hidden, when the table renders, then the Submitted check state still appears and Result/Pts remain on-screen.
- Given an empty `history.weeks` array, when the table renders, then the existing empty-state sentence is shown and no table is rendered.
- Given a desktop-width viewport, when the user opens Results, then the same four-column table is shown (not a card list).

## Spec Change Log

## Design Notes

Copy the standings constraint pattern — do not invent a new mobile table system:

```tsx
<TableContainer sx={{ width: "100%", overflowX: "hidden" }}>
  <Table size="small" aria-label="League results week 5"
    sx={{ tableLayout: "fixed", width: "100%" }}>
    {/* Result ~72px, Pts ~44px; Participant/Team flex + maxWidth: 0 + ellipsis */}
  </Table>
</TableContainer>
```

Size Result wide enough for WIN/LOSS/TIE chips. If Team + **2 PTS** cannot both fit on `xs` without clipping, ellipsize the team **name** line first (keep abbrev + chip).

## Verification

**Commands:**
- `npm test` -- expected: existing + new `LeagueResultsTable` tests pass
- `npx tsc --noEmit` -- expected: no new errors

**Manual checks:**
- Results at 393×641: no right-edge clip; scroll is vertical only.
- Spot-check desktop Results and Standings (unchanged).

## Suggested Review Order

**Viewport fit**

- Entry point: each week table is now a fixed-layout, clip-contained table.
  [`LeagueResultsTable.tsx:178`](../../src/components/results/LeagueResultsTable.tsx#L178)

- Result stays wide enough for WIN/LOSS/TIE chips; Pts stays numeric-narrow.
  [`LeagueResultsTable.tsx:188`](../../src/components/results/LeagueResultsTable.tsx#L188)

- Participant and Team share the standings ellipsis cell so names cannot blow the row.
  [`LeagueResultsTable.tsx:29`](../../src/components/results/LeagueResultsTable.tsx#L29)

**Team identity**

- Submitted vs revealed uses one helper so titles never leak a hidden team.
  [`LeagueResultsTable.tsx:98`](../../src/components/results/LeagueResultsTable.tsx#L98)

- Team name line ellipsizes first; abbrev and 2 PTS chip stay.
  [`LeagueResultsTable.tsx:143`](../../src/components/results/LeagueResultsTable.tsx#L143)

**Tests**

- Hidden/partial identity still shows Submitted and no team title.
  [`LeagueResultsTable.test.tsx:44`](../../src/components/results/LeagueResultsTable.test.tsx#L44)

- Long names keep `title`; anti-jailed chip stays in document.
  [`LeagueResultsTable.test.tsx:79`](../../src/components/results/LeagueResultsTable.test.tsx#L79)
