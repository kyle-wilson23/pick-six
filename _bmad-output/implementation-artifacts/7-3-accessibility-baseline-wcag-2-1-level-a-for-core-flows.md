# Story 7.3: Accessibility Baseline (WCAG 2.1 Level A) for Core Flows

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a participant using assistive tech,
I want login and pick flows to be keyboard-accessible and labeled,
so that I can play too (**NFR37–NFR44**).

## Acceptance Criteria

### AC1 — Core-flow audit scope (login, picks, standings)

**Given** the three epic-mandated surfaces:

| Flow | Primary routes / components |
|------|----------------------------|
| Login | `/login` → `src/app/login/login-client.tsx` (+ invite signup forms if same patterns) |
| Picks | `/leagues/[leagueId]/picks` → `WeekMatchupList`, `MatchupCard`, `PickStatusBanner`, `DeadlineCountdown`, `JailedTeamCallout` |
| Standings | `/leagues/[leagueId]/standings` → `StandingsTable` |

**And** shared chrome that gates those flows: `LeagueNavShell` (desktop tabs + mobile bottom nav)

**When** this story is complete

**Then** those surfaces meet **WCAG 2.1 Level A** targets mapped to **NFR37–NFR44** (keyboard, contrast, labels, focus, landmarks, key ARIA, validation announcements, logical pick tab order)

**And** out-of-scope for this story (do **not** expand unless required to unblock a core-flow fix):

- Full AA/AAA conformance, high-contrast theme, advanced shortcuts
- Admin-only panels, CSV export UI, email composers (except incidental shared chrome)
- Performance budgets / Lighthouse perf (**Story 7.4**)
- Global marketing landing redesign
- Full app-wide `generateMetadata` pass (deferred separately)

---

### AC2 — Keyboard navigation (NFR37, NFR44)

**Given** a keyboard-only user (no mouse)

**When** they complete: login → open league → navigate tabs → select a pick → land on standings

**Then**:

1. Every interactive control is reachable with **Tab** / **Shift+Tab** and activatable with **Enter** / **Space** where applicable
2. League nav (desktop `Tabs` + mobile `BottomNavigation`) is fully keyboard operable
3. Picks radiogroup keeps existing arrow-key roving + Enter/Space team activation (`WeekMatchupList` / `MatchupCard`) — **do not regress**
4. Modals/dialogs (if opened from these flows) trap focus and restore focus on Escape/close (MUI Dialog defaults OK if present)
5. Tab order on picks is logical: status/deadline context → matchup radiogroup → submit/confirm controls (if any) — matches UX Accessibility Strategy

**And** add a **skip link** (“Skip to main content”) as the first focusable element on league shell pages (and login if practical) that moves focus to the page `<main>` — Level A best practice for landmark navigation; keep visually hidden until focused

---

### AC3 — Visible focus indicators (NFR40)

**Given** `src/theme/create-app-theme.ts` currently has **no** global focus-visible styles (only local `&:focus-visible` on `MatchupCard` team sides)

**When** theme overrides are added

**Then** interactive MUI elements used in core flows show a **visible focus ring**: **2px** outline in `primary.main` (`#2ECC71`) with **2px** offset — per UX Focus Indicators

**And** MatchupCard local focus styles remain consistent with the global rule (reuse theme token / shared sx snippet; avoid conflicting outlines)

**And** do **not** remove focus outlines via `outline: none` without a replacement focus-visible style

---

### AC4 — Labels, errors, and screen-reader announcements (NFR39, NFR42, NFR43)

**Given** login (and invite signup if touched)

**When** validation or auth fails

**Then**:

1. Fields keep visible MUI `label`s (already present)
2. Error `Alert` is announced (`role="alert"` / live region — MUI Alert is fine) and is **associated** with the form: prefer moving focus to the alert (or first invalid field) on submit failure so SR users hear it without hunting
3. Invalid fields set `error` + `helperText` **or** `aria-invalid` + `aria-describedby` pointing at the error text — do not rely on a disconnected banner alone

**Given** picks flow

**When** pick save succeeds, fails, or validation blocks selection (jailed / already picked / locked)

**Then** existing live regions remain (`PickStatusBanner`, `WeekMatchupList` status/alert, `DeadlineCountdown`) — **do not regress**

**And** `MatchupCard` radio `aria-label` includes actionable state, not only name + moneyline — e.g. append `, jailed`, `, already picked week N`, `, selected`, `, locked` as applicable so SR users are not dependent on `aria-hidden` JAILED/PICKED overlays on `TeamLogo`

---

### AC5 — Landmarks, headings, and nav semantics (NFR41)

**Given** core pages already use `component="main"` and heading hierarchy in many places

**When** shell and tables are audited

**Then**:

1. Exactly **one** `<main>` per page view (Story 6.6 already removed nested main from `LeagueNavShell` — **preserve**)
2. League nav is exposed as a **`<nav>`** landmark with an accessible name (e.g. `aria-label="League"`) wrapping desktop tabs and/or mobile bottom nav — today `LeagueNavShell` has **zero** `<nav>` elements
3. Active league tab communicates current page (`aria-current="page"` on the active `Tab` / `BottomNavigationAction`, or equivalent MUI-supported pattern)
4. `StandingsTable` has an accessible name (`aria-label` or `<caption>` / visually hidden caption) — e.g. “League standings”
5. Hub breadcrumb-style links (e.g. “← Your leagues” on league home) sit in a `<nav aria-label="Breadcrumb">` (or similar) if present — decorative arrow characters marked `aria-hidden` with text that still makes sense without the glyph

---

### AC6 — Color contrast and non-color meaning (NFR38 + WCAG 1.4.1)

**Given** UX Visual Design Foundation contrast table (dark theme ratios documented as meeting ≥4.5:1 for primary text combinations)

**When** core flows are spot-checked (browser DevTools contrast or axe)

**Then** body text, links, form labels, and primary interactive text on `#121212` / `#1E1E1E` meet **4.5:1**

**And** meaning is never color-only:

| State | Required non-color cue (verify / fix) |
|-------|----------------------------------------|
| Current user on standings | Already: `aria-current="row"` + visually hidden “(You)” — **verify; do not redo** |
| Jailed / already picked | Text tags + disabled/aria state (improve `aria-label` per AC4) |
| Deadline urgency | Ensure urgency is clear from visible text, not only red/amber color |
| Selected pick | `aria-checked` + visible selected styling |

**And** anti-jailed **“2 PTS”** chip touch target: raise to at least **44×44px** hit area (padding / `size` / wrapper) — deferred from Story 3.7 a11y QA

---

### AC7 — Automated + manual verification artifacts

**Given** the project has **no** component DOM tests today (`vitest.config.ts` uses `environment: "node"`; zero `*.test.tsx`)

**When** implementing verification

**Then** deliver **both**:

1. **Manual checklist** checked off in Completion Notes (or a short `docs/accessibility-checklist.md` linked from Completion Notes) covering:
   - Keyboard-only login → picks → standings
   - VoiceOver (macOS Safari) or equivalent SR spot-check on the same three flows
   - Contrast spot-check on primary text + error/warning states
2. **Automated guardrails** without boiling the ocean:
   - Prefer **pure helper unit tests** (node env) for any new aria-label builders
   - Add **one** colocated component axe smoke test for a serializable component (recommended: `StandingsTable` with fixture props) using `axe-core` under `// @vitest-environment jsdom` **or** a dedicated vitest project — install minimal deps only (`jsdom`, `@testing-library/react`, `axe-core` **or** `vitest-axe`). Do **not** switch the whole suite to `happy-dom` (axe incompatibility). Stub `HTMLCanvasElement.prototype.getContext` if axe requires it
   - `npm test` passes including new tests
   - `npm run lint` clean for touched files (jsx-a11y rules already come via `eslint-config-next`)

**And** document any **known Level A exceptions** (with rationale) in Completion Notes — empty list preferred

---

### AC8 — Deferred-work disposition for this story

**Given** `_bmad-output/implementation-artifacts/deferred-work.md` items tagged for 7.3 / a11y

**When** this story ships

**Then** address or explicitly close as follows:

| Deferred item | Disposition |
|---------------|-------------|
| Full WCAG Level A audit (6.6) | **Do in this story** (AC1–AC7) |
| Standings color-only row (5.4 → 7.3) | **Already fixed in 6.6** — verify only; mark done in Completion Notes / prune deferred-work note |
| History breadcrumb a11y (5.5 → 7.3) | **Stale** — history page no longer has that breadcrumb after 6.6; N/A unless a breadcrumb is reintroduced |
| MatchupCard keyboard (3.6 → 3.7) | **Already fixed** — verify no regression |
| 44×44 “2 PTS” chip (3.7) | **Fix in this story** (AC6) |
| Global 48px button height (6.6 → 7.3/7.4) | **Partial:** ensure core-flow primary actions meet ≥44px min height; full theme-wide 48px enforcement may remain for **7.4** if scoped carefully in Completion Notes |

**And** update `deferred-work.md` entries that this story resolves (strike or move to “Resolved by 7.3”) so the next SM does not re-queue them

---

## Tasks / Subtasks

- [x] Task 1: Theme focus ring + shared focus token (AC: #3)
  - [x] Add MUI `styleOverrides` for Button / Tab / BottomNavigationAction / IconButton (as needed) focus-visible ring
  - [x] Align `MatchupCard` focus-visible with theme (no double outlines)
- [x] Task 2: League shell landmarks + skip link (AC: #2, #5)
  - [x] Skip link in shell (first focusable) → `#main-content`
  - [x] On login + league core pages (`picks`, `standings`, and other league `main`s if cheap): set `id="main-content"` on the existing `component="main"` Stack — **do not** wrap children in a second `<main>` inside `LeagueNavShell`
  - [x] Wrap nav regions in `<nav aria-label="…">`
  - [x] Active tab `aria-current="page"` (desktop + mobile)
- [x] Task 3: Login (and signup if same pattern) error association (AC: #4)
  - [x] `aria-invalid` / `helperText` / focus management on failed submit
  - [x] Keep Alert announcement behavior
- [x] Task 4: Picks ARIA polish (AC: #2, #4, #6)
  - [x] Enrich `MatchupCard` `aria-label` with jailed / picked / selected / locked
  - [x] Extract pure `buildTeamPickAriaLabel(...)` + colocated unit test if non-trivial
  - [x] Enlarge anti-jailed “2 PTS” hit target to ≥44×44
  - [x] Keyboard regression smoke on radiogroup
- [x] Task 5: Standings table semantics (AC: #5, #6)
  - [x] Accessible table name
  - [x] Verify `aria-current="row"` + “(You)” still present
- [x] Task 6: Breadcrumb / hub link polish if present (AC: #5)
  - [x] League home “← Your leagues” (and any remaining breadcrumb links) get nav landmark + `aria-hidden` on decorative arrows
- [x] Task 7: Verification + docs (AC: #7, #8)
  - [x] Manual keyboard + SR checklist completed in Completion Notes (or `docs/accessibility-checklist.md`)
  - [x] Optional axe smoke test on `StandingsTable` (jsdom) + deps
  - [x] `npm test` + lint
  - [x] Update `deferred-work.md` resolved items

### Review Findings

- [ ] [Review][Decision] Manual AC7 checklist still unchecked — Kyle will complete keyboard / VoiceOver / contrast passes and check off `docs/accessibility-checklist.md` before story → done (do not mark done until checklist is checked).
- [x] [Review][Patch] Skip-target `<main>` uses `outline: "none"` with no replacement focus ring — fixed via `skipTargetMainSx`
- [x] [Review][Patch] Core-flow TextField / OutlinedInput lack theme focus-visible ring — `MuiOutlinedInput` focused ring in theme
- [x] [Review][Patch] Identical validation/auth error string may not refocus alert — `focusNonce` on login + signup
- [x] [Review][Patch] Signup `signInRecovery` alert not included in password `aria-describedby` — fixed
- [x] [Review][Patch] Login auth failure duplicates alert message in field helpers; signup error replaced password-policy helper — fixed
- [x] [Review][Patch] SkipLink programmatic `#main-content` focus on activate — fixed
- [x] [Review][Patch] Remove unused `@testing-library/jest-dom` — removed

## Dev Notes

### What this story is (and is NOT)

- **Is:** Close the Epic 7 accessibility gate for **login, picks, standings** (+ shared league chrome) to WCAG 2.1 **Level A** / **NFR37–NFR44**.
- **Is NOT:** Performance/Lighthouse budgets, cron HTTP status hardening, skeleton loaders, Snackbar polish, landing-page hero — those stay **7.4** or later deferred items.
- **Is NOT:** Rebuilding picks a11y from scratch — Story 3.7 + 6.6 already delivered radiogroup, live regions, and standings “(You)”. Prefer **targeted gaps**.

### PRD vs UX nuance (follow both carefully)

- PRD Accessibility Standards list “ARIA live regions for dynamic updates” under **Not Required in MVP**, but **NFR43** and the epic AC require **validation / success announcements**, and UX Accessibility Strategy already specifies `aria-live` for pick status + countdown — **keep existing live regions**; do not rip them out.
- Target remains **Level A**, not AA. Do not invent AA-only work (e.g. focus-visible contrast formulas beyond the UX ring spec) unless axe flags a Level A failure.

### Architecture / project-context compliance

- **MUI** + **`Stack` for flex** — do not introduce a second UI kit or Tailwind for a11y chrome.
- Client boundaries: `LeagueNavShell`, `MatchupCard`, `StandingsTable`, login client are already `"use client"` — keep MUI `component={Link}` and theme `sx` callbacks inside client modules ([Source: `.cursor/rules/next-rsc-client-boundaries.mdc`]).
- Prefer pure helpers under `src/lib/**` for testable aria-label builders; keep Route Handlers / Prisma out of this story.
- Secrets stay server-only — irrelevant here; do not log PII in any a11y debug helpers.

### Reuse — do NOT reinvent

| Existing | Path | Action |
|----------|------|--------|
| Radiogroup + arrow keys | `WeekMatchupList.tsx` | Keep |
| Radio + keyboard + local focus | `MatchupCard.tsx` | Extend aria-label; keep keyboard |
| Live regions | `PickStatusBanner`, `WeekMatchupList`, `DeadlineCountdown` | Keep |
| Standings “(You)” | `StandingsTable.tsx` | Verify |
| Single main (no nested) | `LeagueNavShell` children only | Preserve |
| Dark theme tokens | `create-app-theme.ts` | Extend focus styles only |
| League tab href helpers | `src/lib/league/league-nav-tabs.ts` | Reuse for nav links |

### UX guidance (front-end)

[Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Accessibility Considerations ~1209–1248; Accessibility Strategy ~1689–1715]

- Focus ring: 2px emerald (`primary.main`) + 2px offset
- Keyboard map: Tab between chrome; Enter/Space activate; Escape closes modals; matchup list arrow keys
- Matchups: `radiogroup` / `radio` (already implemented)
- Touch: 44×44 minimum; matchup card team areas already `minHeight: 44`
- Color-independent states: jailed / picked / success / error / anti-jailed already use text+icon — ensure SR labels match
- Testing approach from UX: axe during development + keyboard-only + VoiceOver spot-check

### Testing requirements

- Colocated `*.test.ts` for pure helpers (node env — default).
- If adding axe component tests: file-level `jsdom` only; avoid converting entire Vitest suite.
- No e2e framework required for this story; manual checklist is an acceptance artifact.
- Do not add Playwright/Cypress solely for a11y unless already present (it is not).

### Previous story intelligence (7.2)

- Keep changes focused; prefer small client components with serializable props from server pages.
- Update deferred-work when closing items (7.2 pattern: document disposition).
- Admin weekly email card / logging are **orthogonal** — do not refactor observability in this story.
- Recent commits: `946cb47` (7.2 logging), `1842cc8` (7.1 CSV), `b3ca782` (6.6 nav shell — primary prior art for shell a11y).

### Git intelligence summary

- Story 6.6 introduced `LeagueNavShell` (AppBar/Tabs + BottomNavigation) and standings `aria-current` — start shell work there.
- Picks a11y landed in Epic 3; treat regressions as blockers.
- No a11y test deps in `package.json` yet — adding `axe-core` + jsdom is expected if implementing AC7 automated smoke.

### Latest tech notes (axe + Vitest)

- Prefer `axe-core` directly or `vitest-axe` matcher `toHaveNoViolations`.
- **Do not** use `happy-dom` with axe (known `isConnected` incompatibility).
- jsdom may need canvas stub for axe.
- Configure axe to WCAG **A** tags if narrowing rules (`wcag2a`) to avoid AA noise — document chosen tags in the test file.

### Anti-patterns to avoid

- Nesting `<main>` inside `LeagueNavShell` again
- `outline: none` without `:focus-visible` replacement
- `<Link><Button/></Link>` double wrappers — keep `Button component={Link}` pattern
- Replacing MUI Tabs with custom div click handlers
- “Fixed a11y” without keyboard verification notes
- Expanding into 7.4 performance work under this story ID

### Project structure notes

```
src/theme/create-app-theme.ts          # global focus-visible
src/components/league/LeagueNavShell.tsx
src/components/a11y/SkipLink.tsx       # optional small client component
src/app/login/login-client.tsx
src/app/signup/[token]/…              # only if same error pattern
src/components/picks/MatchupCard.tsx
src/components/picks/WeekMatchupList.tsx
src/lib/picks/team-pick-aria-label.ts  # optional pure helper + .test.ts
src/components/standings/StandingsTable.tsx
src/components/standings/StandingsTable.test.tsx  # optional axe smoke (jsdom)
docs/accessibility-checklist.md        # optional; else Completion Notes
```

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 7, Story 7.3]
- [Source: `_bmad-output/planning-artifacts/prd.md` — Accessibility Standards; NFR37–NFR44]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Accessibility Considerations; Accessibility Strategy; Focus Indicators; Touch Target Sizing]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Accessibility NFR37–NFR44; MUI stack; co-located tests]
- [Source: `docs/project-context.md` — MUI/Stack, testing conventions]
- [Source: `_bmad-output/implementation-artifacts/6-6-ux-spec-comparison-and-alignment.md` — nav shell, standings aria-current, deferred full a11y audit]
- [Source: `_bmad-output/implementation-artifacts/7-2-structured-logging-and-admin-visible-health-signals.md` — prior Epic 7 patterns]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — 7.3-tagged a11y items]
- [Source: `.cursor/rules/next-rsc-client-boundaries.mdc` — MUI Link / sx client boundaries]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

- Browser smoke (2026-07-12): league picks/standings/home — skip link first, single `<main id="main-content">`, `nav[aria-label=League]`, active tab `aria-current=page`, breadcrumb nav on league home.
- `npm test`: 371 passed; eslint clean on touched files.

### Completion Notes List

- Theme: shared `focusVisibleRingCss` / `focusVisibleRingSx`; focus-visible on Button, Tab, BottomNavigationAction, IconButton, Chip, Link; `sizeLarge` Button minHeight 44.
- Shell: `SkipLink` + `#main-content` on login, signup, and all league `main` pages; `<nav aria-label="League">` + `aria-current="page"` on desktop/mobile tabs.
- Login/signup: field `error`/`helperText`/`aria-invalid`/`aria-describedby`; focus moves to alert on failure.
- Picks: `buildTeamPickAriaLabel` + unit tests; MatchupCard uses it; 2 PTS chip ≥44×44; radiogroup keyboard unchanged (code review + preview-mode page smoke).
- Standings: `aria-label="League standings"`; verified `aria-current="row"` + “(You)” via axe/jsdom test.
- Breadcrumb: league home `<nav aria-label="Breadcrumb">` with decorative arrow `aria-hidden`.
- Docs: `docs/accessibility-checklist.md` (manual VoiceOver/contrast remaining for human spot-check).
- Deferred-work: closed 7.3 a11y items (full Level A audit, 2 PTS target, standings non-color, history breadcrumb N/A, MatchupCard keyboard verify, partial 48px → 7.4).
- Known Level A exceptions: none.

### File List

- `src/theme/create-app-theme.ts`
- `src/theme/focus-visible-ring.ts`
- `src/components/a11y/SkipLink.tsx`
- `src/components/league/LeagueNavShell.tsx`
- `src/components/picks/MatchupCard.tsx`
- `src/lib/picks/team-pick-aria-label.ts`
- `src/lib/picks/team-pick-aria-label.test.ts`
- `src/components/standings/StandingsTable.tsx`
- `src/components/standings/StandingsTable.test.tsx`
- `src/app/login/login-client.tsx`
- `src/app/signup/[token]/page.tsx`
- `src/app/signup/[token]/signup-form.tsx`
- `src/app/(app)/leagues/[leagueId]/page.tsx`
- `src/app/(app)/leagues/[leagueId]/picks/page.tsx`
- `src/app/(app)/leagues/[leagueId]/standings/page.tsx`
- `src/app/(app)/leagues/[leagueId]/admin/page.tsx`
- `src/app/(app)/leagues/[leagueId]/history/page.tsx`
- `src/app/(app)/leagues/[leagueId]/invites/page.tsx`
- `src/app/(app)/leagues/[leagueId]/results/page.tsx`
- `src/app/(app)/leagues/[leagueId]/rules/page.tsx`
- `src/app/(app)/leagues/[leagueId]/settings/page.tsx`
- `docs/accessibility-checklist.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `package.json`
- `package-lock.json`

## Change Log

- 2026-07-12: Story context created (create-story) — ready-for-dev.
- 2026-07-12: Implemented WCAG 2.1 Level A baseline for login/picks/standings + shell; tests + checklist; status → review.
- 2026-07-12: Code review — applied 7 patches (skip-target focus, TextField ring, alert refocus, signup describedby/policy, SkipLink focus, drop unused jest-dom); manual checklist remains; status → in-progress.
