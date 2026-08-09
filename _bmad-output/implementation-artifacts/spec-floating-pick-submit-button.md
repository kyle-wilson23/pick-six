---
title: 'Floating pick submit confirm button'
type: 'feature'
created: '2026-08-09'
status: 'done'
baseline_commit: '4e7a01f2ba5f28df7a03f5fe0ca5db26d0595ec7'
context:
  - '{project-root}/docs/project-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-design-specification.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** On the picks page, tapping a team immediately submits the pick, so scrolling/accidental taps can save an unintended choice.

**Approach:** Team tap only updates a local draft selection. A viewport-fixed floating button (lower-right, mobile + desktop) confirms and runs the existing submit flow (same POST + success messaging). The button is hidden until the draft differs from the saved pick (or until the first selection when none is saved), then appears as a primary action.

## Boundaries & Constraints

**Always:**
- Participant picks UI only (`WeekMatchupList` / matchup cards): tap selects; does not POST.
- Floating control is `position: fixed` to the viewport lower-right and stays put while scrolling.
- Floating button is **hidden** when there is no dirty draft: no saved pick and no selection, or draft equals saved (`teamId` + `antiJailedBonus`).
- Shown as a primary contained button when draft ≠ saved (including first pick after selecting a team).
- Confirm uses today’s POST body/endpoint and success toast copy (`Pick saved: …`); persistent banner continues to reflect the **saved** pick after success.
- Clear mobile bottom nav: sit above `56px + env(safe-area-inset-bottom)` plus a small gap; desktop has no bottom nav so bottom offset can be smaller.
- Hide the floating button in preview / non-interactive modes and when the pick window is locked.
- Disable the button while a submit is in flight; keep radiogroup `aria-busy` behavior.
- Label reflects selection per UX: `Submit Pick: {Team Name}` (or equivalent team display name already used elsewhere).

**Ask First:**
- Changing admin submit-on-behalf flows or the picks API contract.
- Replacing the floating button with a modal/dialog confirmation step.
**Never:**
- Auto-submit on team tap/keyboard activate.
- Changing deadline, jailed, duplicate-team, or server validation rules.
- Introducing a second submit path with different success/error UX.
- Overlapping or obscuring the mobile bottom navigation tabs.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First pick | No saved pick; user selects team | Draft highlights; FAB appears primary with team name; no POST yet | N/A |
| Confirm first pick | Dirty draft; user taps FAB | POST; success toast; banner shows saved pick; FAB hides | On API/network error: keep draft, show existing error toast, FAB stays visible |
| Change pick | Saved pick A; user selects team B | Draft B highlighted; FAB appears; banner still shows A until confirm | N/A |
| Re-select saved | Draft equals saved (incl. same bonus flag) | FAB hidden | N/A |
| Anti-jailed | User chooses 2 PTS chip vs side tap | Draft stores `antiJailedBonus`; confirm POSTs that flag; FAB appears if bonus differs from saved | Blocked jailed direct pick still shows error toast; FAB stays hidden |
| Locked / preview | Window locked or preview week | No FAB; cards non-interactive as today | Blocked interactions keep existing messages |
| In flight | Submit started | FAB disabled + busy; cards keep submit-guard | Same rollback + error toast as today |

</frozen-after-approval>

## Code Map

- `src/components/picks/WeekMatchupList.tsx` -- Owns selection, POST, status toasts, radiogroup; primary change site (split draft vs saved; move POST to FAB handler; render floating button).
- `src/components/picks/MatchupCard.tsx` -- Team activate → `onTeamSelect`; keep selection events; stop relying on parent auto-submit (parent change only unless card props need tweak).
- `src/components/picks/PickStatusBanner.tsx` -- Persistent saved-pick banner; drive from saved state, not dirty draft.
- `src/components/layout/MobileBottomNav.tsx` -- Height `56` + safe-area; clearance reference for FAB bottom offset.
- `src/components/league/LeagueNavShell.tsx` -- Mobile content `pb: calc(56px + env(safe-area-inset-bottom))`; FAB must clear this chrome.
- `src/app/api/leagues/[leagueId]/picks/route.ts` -- Existing submit API (no contract change).
- `_bmad-output/planning-artifacts/ux-design-specification.md` -- Select-then-confirm + `Submit Pick: {Team Name}` pattern (~1586–1590).

## Tasks & Acceptance

**Execution:**
- [x] `src/components/picks/WeekMatchupList.tsx` -- Split draft selection from saved pick; team select only updates draft + clears blocking errors; POST only from floating confirm; render fixed lower-right Button only when dirty (primary; disabled while submitting); hide when clean / preview / locked; offset above mobile bottom nav; wire label `Submit Pick: {Team Name}` -- core behavior change.
- [x] `src/components/picks/PickStatusBanner.tsx` (and/or call site in `WeekMatchupList.tsx`) -- Banner reflects saved pick only so a dirty draft does not claim the pick is submitted until confirm succeeds -- status honesty.
- [x] `src/lib/picks/pick-draft-dirty.ts` (+ colocated `*.test.ts`) -- Pure helper: `isPickDraftDirty(draft, saved)` covering null/equal/team-change/bonus-change -- unit-test I/O matrix dirty rules without mounting MUI.
- [x] Manual spot-check on picks page (mobile width + desktop): scroll with FAB fixed; no overlap with bottom nav; select → enable → submit → banner/toast -- visual/layout verification.

**Acceptance Criteria:**
- Given an interactive picks week with no saved pick, when the user taps a valid team, then the team is highlighted and no network submit occurs until they activate the floating button.
- Given a saved pick, when the page loads, then the floating button is hidden; when the user selects a different team (or changes anti-jailed bonus), then the button appears as primary.
- Given a dirty draft, when the user activates the floating button, then the existing picks POST runs and success shows the same `Pick saved: …` toast; the persistent banner updates to the new saved pick.
- Given preview or locked week, when the picks list renders, then the floating submit control is not shown.
- Given mobile viewport with bottom nav, when the FAB is visible, then it remains fully tappable above the nav + safe area while scrolling.

## Spec Change Log

## Design Notes

**Draft vs saved:** Today one `selection` drives highlight and “submitted” banner, so a dirty draft would falsely look submitted. Keep draft for radiogroup/`selectedTeamId`; keep saved (seeded from `currentPick`, updated on successful POST) for `PickStatusBanner`.

**FAB placement example:**

```tsx
{dirty ? (
  <Button
    variant="contained"
    color="primary"
    disabled={submitting}
    sx={{
      position: "fixed",
      right: 16,
      bottom: { xs: "calc(56px + env(safe-area-inset-bottom, 0px) + 16px)", md: 24 },
      zIndex: (t) => t.zIndex.tooltip,
    }}
  >
    {`Submit Pick: ${teamName}`}
  </Button>
) : null}
```

Prefer `Stack` only if wrapping icon + label; a single MUI `Button` is enough. No new FAB library.

## Verification

**Commands:**
- `npm test` -- expected: new draft-dirty unit tests pass; existing suite green.
- `npx tsc --noEmit` (or project typecheck script if preferred) -- expected: no new type errors in touched files.

**Manual checks:**
- Picks page, unlocked week: tap team → FAB appears → scroll → FAB stays lower-right → submit → toast + banner.
- Already-saved pick: FAB hidden until different team/bonus.
- Mobile width: FAB clears bottom nav; desktop: FAB lower-right without bottom-nav offset.

## Suggested Review Order

**Draft vs saved**

- Split local state so highlight can diverge from submitted banner.
  [`WeekMatchupList.tsx:75`](../../src/components/picks/WeekMatchupList.tsx#L75)

- Dirty helper gates FAB visibility (team or bonus change).
  [`pick-draft-dirty.ts:11`](../../src/lib/picks/pick-draft-dirty.ts#L11)

- Banner wired to saved pick only until confirm succeeds.
  [`WeekMatchupList.tsx:277`](../../src/components/picks/WeekMatchupList.tsx#L277)

**Select then confirm**

- Team tap updates draft only — no POST.
  [`WeekMatchupList.tsx:148`](../../src/components/picks/WeekMatchupList.tsx#L148)

- Confirm POST + ref lock against double-activate.
  [`WeekMatchupList.tsx:180`](../../src/components/picks/WeekMatchupList.tsx#L180)

**Floating submit control**

- Fixed lower-right FAB appears only when dirty; clears bottom nav.
  [`WeekMatchupList.tsx:344`](../../src/components/picks/WeekMatchupList.tsx#L344)

- Extra list padding so last cards stay reachable under FAB.
  [`WeekMatchupList.tsx:267`](../../src/components/picks/WeekMatchupList.tsx#L267)

**Tests**

- Unit coverage for dirty matrix edges.
  [`pick-draft-dirty.test.ts:5`](../../src/lib/picks/pick-draft-dirty.test.ts#L5)
