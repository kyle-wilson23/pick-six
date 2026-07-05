# Story 6.6: UX Spec Comparison and Alignment

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a league participant and admin,
I want the in-app UI to match the UX design specification's navigation, layout, and component patterns,
so that the product feels cohesive on mobile and desktop and the Epic 3→5 retro commitment is finally closed.

## Acceptance Criteria

1. **Given** the UX design specification (`ux-design-specification.md`) and the current codebase
   **When** the developer completes the comparison pass
   **Then** a **UX gap matrix** is recorded in this story's **Completion Notes** (table: UX spec section → current state → action taken | deferred to Epic 7)
   **And** the matrix covers at minimum: all 10 custom components (§ Component Strategy), responsive breakpoint table (§ Responsive Design), navigation patterns (§ Navigation Patterns), button hierarchy (§ Button Hierarchy), and empty states (§ Empty States)

2. **Given** a participant or admin viewing any league route under `/leagues/[leagueId]/*` (picks, standings, history, results, rules, admin)
   **When** the viewport is **≥ 768px** (`theme.breakpoints.up('md')`)
   **Then** a **`DesktopAppBar`**-style top navigation is visible with text tabs, active-tab styling (`primary.main` + 2px bottom border), league context, and user display name
   **And** the mobile bottom tab bar is **hidden**

3. **Given** the same league routes on a viewport **< 768px**
   **When** the page renders
   **Then** a fixed **`BottomNavigation`** bar is visible (56px + safe-area inset) with icon + label tabs
   **And** the desktop app bar is **hidden**
   **And** main content has bottom padding so content is not obscured by the tab bar

4. **Given** tab navigation in the league shell
   **When** a tab is selected
   **Then** navigation uses Next.js **`Link`** / **`useRouter`** to the correct route (full page navigation is OK — spec "instant swap" is satisfied by fast RSC navigations)
   **And** participant tabs include: **Picks** (UX "This Week"), **Standings**, **History**, **Results**, **Rules**
   **And** admin users see an additional **Admin** tab (admin-only; hidden for non-admin participants)
   **And** the active tab is derived from **`usePathname()`** (no duplicate nav state)
   **And** the gap matrix documents that **Results** is a product addition post-UX-spec (Epic 5.6) — not in original 4-tab list

5. **Given** the admin dashboard at `/leagues/[leagueId]/admin`
   **When** viewport is **≥ 768px**
   **Then** submission status cards occupy the **left column** and weekly email + reminder controls occupy the **right column** (UX § AdminSubmissionCard / AdminEmailComposer responsive table)
   **And** jailed verification and audit log remain **full-width below** the two-column block (tertiary content — consistent with Story 4.4 ordering)

6. **Given** the picks page at `/leagues/[leagueId]/picks`
   **When** viewport is **≥ 768px**
   **Then** matchup cards render in a **2-column CSS grid** with 16px gap (UX § MatchupCard)
   **And** `DeadlineCountdown` and `JailedTeamCallout` render **side-by-side** in one horizontal row (`Stack direction="row"`, each `flex: 1`) when both are present
   **And** on mobile they remain stacked (unchanged)

7. **Given** the MUI theme in `src/theme/create-app-theme.ts`
   **When** components reference UX background tokens
   **Then** `palette.background` includes **`elevated: '#2A2A2A'`** and **`overlay: '#333333'`** per UX § Color System
   **And** `MatchupCard` selected/hover states use `background.elevated` where the spec calls for elevated surfaces (replace hardcoded hover approximations if present)
   **And** `mui-augmentation.d.ts` extends `TypeBackground` if TypeScript requires it

8. **Given** `MatchupCard` team logos
   **When** rendering matchup rows
   **Then** `TeamLogo` uses **`size="lg"`** (40px) in matchup cards per UX § TeamLogo size table (currently `md`/32px)

9. **Given** `StandingsTable` with the current user's row
   **When** the table renders
   **Then** the current-user row includes **`aria-current="row"`** and a visually hidden **"(You)"** suffix on the participant name (WCAG 1.4.1 — deferred from Story 5.4; implement here as a quick alignment win)

10. **Given** the admin dashboard when **all participants have submitted** for the active week
    **When** `outstandingCount === 0` and `weekNumber != null`
    **Then** an informational empty/celebration message displays: **"All participants have submitted picks this week"** (UX § Empty States — admin celebration state)
    **And** submission cards still render (admins can verify picks)

11. **Given** the invites flow copy in `invite-participants-form.tsx`
    **When** invitations send successfully in environments where Resend is configured (Story 6.1+)
    **Then** success copy no longer tells admins to **"check server logs"** for signup links
    **And** copy reflects that invitation emails were sent (or queued) to the provided addresses

12. **Given** the test suite runs after all changes
    **When** `npm test` and `npm run lint` execute
    **Then** all tests pass and lint reports **zero errors**
    **And** new unit tests cover league nav active-tab resolution logic if extracted to a pure helper (recommended: `src/lib/league/league-nav-tabs.ts` + colocated test)

## Tasks / Subtasks

- [x] Task 1: UX gap matrix — comparison pass (AC: #1)
  - [x] Walk UX spec sections listed in AC1 against implementation; record findings in Completion Notes table
  - [x] For each **deferred** gap, add or update an entry in `_bmad-output/implementation-artifacts/deferred-work.md` citing Story 6.6
  - [x] Confirm **Results** tab deviation is documented (product requirement from Epic 5.6)

- [x] Task 2: Pure helper for league nav tabs + active detection (AC: #4, #12)
  - [x] Create `src/lib/league/league-nav-tabs.ts` exporting:
    - `LEAGUE_PARTICIPANT_TABS` — `{ label, hrefSuffix, matchPaths }[]` where `hrefSuffix` is e.g. `/picks`, `/standings`, …
    - `getActiveLeagueTab(pathname: string, leagueId: string): string | null` — returns active tab key from pathname
    - `buildLeagueTabHref(leagueId: string, hrefSuffix: string): string`
  - [x] Include **Results** tab (`/results`) between History and Rules
  - [x] Admin tab only when `isAdmin === true`
  - [x] Add `src/lib/league/league-nav-tabs.test.ts` with pathname fixtures

- [x] Task 3: `LeagueNavShell` client component (AC: #2, #3, #4)
  - [x] Create `src/components/league/LeagueNavShell.tsx` with `"use client"`
  - [x] Props: `{ leagueId, leagueName, isAdmin, userDisplayName, children }`
  - [x] **Desktop (`md+`):** MUI `AppBar` + `Tabs` (text-only) per UX § DesktopAppBar — logo text "PICK SIX" in `primary.main`, tabs center, user name right (avatar optional — initials circle OK for MVP)
  - [x] **Mobile (`xs–sm`):** MUI `BottomNavigation` fixed bottom with `showLabels`, safe-area `pb: env(safe-area-inset-bottom)`
  - [x] Use `Button component={Link}` or `Tab component={Link}` pattern from `.cursor/rules/next-rsc-client-boundaries.mdc`
  - [x] Add bottom padding wrapper on main content area (`pb: calc(56px + env(safe-area-inset-bottom))` on mobile)

- [x] Task 4: League layout wiring (AC: #2, #3, #4)
  - [x] Create `src/app/(app)/leagues/[leagueId]/layout.tsx` (server component)
  - [x] Load league name + membership role via `auth()` + `prisma` (same guards as child pages — participant role required; redirect/notFound consistent with existing pages)
  - [x] Render `<LeagueNavShell …>{children}</LeagueNavShell>`
  - [x] Remove redundant per-page breadcrumb `← {league.name}` links from league sub-pages **only where** the nav shell makes them redundant (keep breadcrumb on league **home** `/leagues/[id]` hub if desired)
  - [x] Ensure `(app)/layout.tsx` auth redirect still works (layout runs inside authenticated shell)

- [x] Task 5: Admin dashboard 2-column layout (AC: #5)
  - [x] Update `src/app/(app)/leagues/[leagueId]/admin/page.tsx`
  - [x] Wrap submission block + email/reminder block in MUI `Stack direction={{ xs: 'column', md: 'row' }}` with `spacing={3}` and equal flex columns
  - [x] Left column: submission status (`AdminDashboardClient` or read-only cards)
  - [x] Right column: `AdminEmailComposer` + `AdminReminderControls` in a nested `Stack`
  - [x] Increase `maxWidth` on admin page at `md+` (e.g. 960–1024px) so 2-column layout breathes

- [x] Task 6: Picks page responsive alignment (AC: #6, #8)
  - [x] Update `WeekMatchupList` or picks page wrapper: at `md+`, render matchups in `display: grid; gridTemplateColumns: 1fr 1fr; gap: 16px` (MUI `Box`/`Stack` sx)
  - [x] Update picks page: wrap `DeadlineCountdown` + `JailedTeamCallout` in responsive row Stack (AC #6)
  - [x] Change `MatchupCard` `TeamLogo` from `size="md"` to `size="lg"`
  - [x] Optionally bump picks page `maxWidth` at `md+` (e.g. 960px) to accommodate 2-column grid

- [x] Task 7: Theme token completion (AC: #7)
  - [x] Add `elevated` and `overlay` to `create-app-theme.ts` `palette.background`
  - [x] Extend `mui-augmentation.d.ts` `TypeBackground` if needed
  - [x] Update `MatchupCard` selected/hover `bgcolor` to use `background.elevated`

- [x] Task 8: Standings a11y + admin celebration + invites copy (AC: #9, #10, #11)
  - [x] `StandingsTable`: `aria-current="row"` on current user row; visually hidden "(You)" via `Typography component="span" sx={{ clip: … }}` or MUI `visuallyHidden` pattern
  - [x] Admin page: render celebration message when all submitted (AC #10)
  - [x] `invite-participants-form.tsx`: update success Alert copy — remove server-log reference (deferred from Story 6.1)

- [x] Task 9: Verification (AC: #12)
  - [x] `npm test`
  - [x] `npm run lint`
  - [x] Manual spot-check at 375px and 1024px: picks, standings, admin — nav visible, no double nav, content not hidden behind bottom bar

## Dev Notes

### Why This Story Exists

Carried **three retros** (Epic 3 → 4 → 5) without a sprint-status entry until Epic 5 retro. Individual stories (3.6, 3.7, 4.1, 6.2, 6.3) aligned **component-level** UX during implementation, but **shell navigation** and **responsive layout tables** were never holistically compared. Story 6.2 explicitly deferred admin **2-column layout** to this story.

**This is the last story in Epic 6** — close the epic after code review marks this story `done`.

### Pre-Computed Gap Matrix (Starting Point — Verify and Extend in Task 1)

| UX Spec Section | Current State (pre-6.6) | Planned Action |
|-----------------|---------------------------|----------------|
| **DesktopAppBar** | ❌ Not implemented — breadcrumb links only | **Implement** (Tasks 3–4) |
| **BottomNavigation** | ❌ Not implemented | **Implement** (Tasks 3–4) |
| **MatchupCard 2-col grid (desktop)** | ❌ Single column always | **Implement** (Task 6) |
| **Admin 2-col layout (desktop)** | ❌ Stacked single column | **Implement** (Task 5) |
| **PickStatusBanner desktop inline** | ❌ Full-width always | **Defer** — requires header row refactor; note in gap matrix |
| **Deadline + Jailed side-by-side (desktop)** | ❌ Stacked | **Implement** (Task 6) |
| **Standings sidebar (desktop)** | ❌ Table only | **Defer** to Epic 7 — enhancement, not MVP blocker |
| **MatchupCard** | ✅ Implemented (3.6/3.7) — radio a11y, states | **Minor**: logo size lg (Task 6) |
| **PickStatusBanner** | ✅ Aligned (3.7) | None |
| **DeadlineCountdown** | ✅ Aligned (3.7) | None |
| **JailedTeamCallout** | ✅ Aligned (3.7) | None |
| **TeamLogo** | ✅ Real logos (3.8), sm/md/lg sizes | **Minor**: lg in MatchupCard |
| **WeatherBadge** | ⚠️ Inline in MatchupCard, not separate component | **Defer** — cosmetic extraction |
| **AdminSubmissionCard** | ✅ Aligned (4.1) | None |
| **AdminEmailComposer** | ✅ Aligned (6.2) | None |
| **AdminReminderControls** | ✅ Added in 6.3 (not in original UX component list) | Document as extension |
| **StandingsTable** | ✅ Mostly aligned (5.4) | **Implement** aria-current (Task 8) |
| **Theme colors** | ⚠️ Missing `background.elevated`, `background.overlay` | **Implement** (Task 7) |
| **Button 48px height** | ⚠️ Not globally enforced | **Defer** to Epic 7.3/7.4 |
| **Skeleton loading states** | ❌ Not implemented | **Defer** to Epic 7.4 |
| **Snackbar admin feedback** | ⚠️ Partial (inline Alert in composers) | **Defer** — polish pass |
| **Landing page hero layout** | ⚠️ Basic marketing page | **Defer** — out of league shell scope |
| **generateMetadata on pages** | ❌ Missing (5.4–5.6 deferred) | **Defer** to Epic 7 |
| **Full WCAG Level A audit** | ⚠️ Partial (matchup radiogroup done in 3.7) | **Defer** to Story 7.3 |
| **Invites "check server logs" copy** | ❌ Stale (6.1 deferred) | **Implement** (Task 8) |
| **Results tab in nav** | N/A in UX spec | **Add** — product requirement (5.6) |

### Navigation Implementation Guardrails

**Do NOT** duplicate navigation on the league **home hub** (`/leagues/[id]`) unless intentional — the hub can keep its link list for discoverability OR be simplified once tabs exist; dev choice documented in completion notes.

**Do NOT** add tabs to non-league routes (`/dashboard`, `/my-leagues`, `/leagues/new`).

**Active tab matching examples** (for `getActiveLeagueTab` tests):

| Pathname | Active tab |
|----------|------------|
| `/leagues/abc/picks` | picks |
| `/leagues/abc/picks?weekNumber=3` | picks |
| `/leagues/abc/standings` | standings |
| `/leagues/abc/history` | history |
| `/leagues/abc/results` | results |
| `/leagues/abc/rules` | rules |
| `/leagues/abc/admin` | admin |
| `/leagues/abc/settings` | none (settings accessed from hub/admin — no tab) |
| `/leagues/abc/invites` | none |

**MUI + Next.js App Router:** Follow `.cursor/rules/next-rsc-client-boundaries.mdc` — nav shell is `"use client"`; layout stays server for auth/Prisma.

**Icons for BottomNavigation:** Use `@mui/icons-material` — e.g. `SportsFootball`, `Leaderboard`, `History`, `EmojiEvents` (or `Assessment`) for Results, `MenuBook`, `AdminPanelSettings`. Keep labels short to avoid truncation on small phones.

### Admin Dashboard Layout (Post-6.6)

```
┌─────────────────────────────────────────────────────────┐
│  Week N — Submission Status          [DesktopAppBar]     │
├──────────────────────┬──────────────────────────────────┤
│  AdminSubmissionCard │  Weekly Email (AdminEmailComposer)│
│  list + overrides    │  Reminder Emails (AdminReminder…) │
├──────────────────────┴──────────────────────────────────┤
│  Jailed Verification (full width)                        │
│  Audit Log (full width)                                  │
└─────────────────────────────────────────────────────────┘
```

Mobile: single column — submission cards, then email, then reminders, then jailed, then audit (current order preserved).

### Picks Page Layout (Post-6.6, md+)

```
[DeadlineCountdown]  [JailedTeamCallout]   ← row
[PickStatusBanner — full width]
[MatchupCard] [MatchupCard]               ← 2-col grid
[MatchupCard] [MatchupCard]
```

### Theme Token Additions

```typescript
// src/theme/create-app-theme.ts — add to palette.background
background: {
  default: "#121212",
  paper: "#1E1E1E",
  elevated: "#2A2A2A",
  overlay: "#333333",
},
```

Augment `@mui/material/styles` `interface TypeBackground` with optional `elevated?` and `overlay?` in `mui-augmentation.d.ts`.

### Files Expected to Change

| File | Change |
|------|--------|
| `src/lib/league/league-nav-tabs.ts` | **New** — tab config + active detection |
| `src/lib/league/league-nav-tabs.test.ts` | **New** — unit tests |
| `src/components/league/LeagueNavShell.tsx` | **New** — desktop + mobile nav |
| `src/app/(app)/leagues/[leagueId]/layout.tsx` | **New** — wraps league routes |
| `src/app/(app)/leagues/[leagueId]/admin/page.tsx` | 2-column layout + celebration message |
| `src/app/(app)/leagues/[leagueId]/picks/page.tsx` | Responsive deadline/jailed row; wider maxWidth |
| `src/app/(app)/leagues/[leagueId]/standings/page.tsx` | Remove redundant breadcrumb if nav added |
| `src/app/(app)/leagues/[leagueId]/history/page.tsx` | Same |
| `src/app/(app)/leagues/[leagueId]/results/page.tsx` | Same |
| `src/app/(app)/leagues/[leagueId]/rules/page.tsx` | Same |
| `src/components/picks/WeekMatchupList.tsx` | 2-col grid at md+ |
| `src/components/picks/MatchupCard.tsx` | TeamLogo lg; background.elevated states |
| `src/components/standings/StandingsTable.tsx` | aria-current + (You) |
| `src/theme/create-app-theme.ts` | elevated + overlay tokens |
| `src/theme/mui-augmentation.d.ts` | TypeBackground extension |
| `src/app/(app)/leagues/[leagueId]/invites/invite-participants-form.tsx` | Success copy |
| `_bmad-output/implementation-artifacts/deferred-work.md` | New deferrals from gap matrix |

### Testing Requirements

- **Unit:** `league-nav-tabs.test.ts` — active tab for all routes in AC4 table + edge cases (settings, invites → null)
- **No E2E required** per project norms — manual viewport spot-check documented in Task 9
- **Regression:** Existing picks interaction tests (`matchup-card-state`, `countdown`, domain tests) must still pass — nav layout must not break pick POST flow

### Architecture Compliance

[Source: `docs/project-context.md`, `architecture.md`]

- **MUI + Stack** for flex layouts (not Box unless necessary)
- **Server-authoritative** rules unchanged — this story is UI-only
- **No new API routes** or schema changes
- **Secrets** unchanged
- Colocate tests per `architecture.md` Implementation Patterns

### Scope Boundaries — NOT in This Story

- ❌ Resend `from` domain / production email go-live — ops checklist in `deferred-work.md`
- ❌ NFR32 Resend webhooks — unassigned; note in gap matrix, no implementation
- ❌ Full WCAG audit — Story 7.3
- ❌ Standings desktop sidebar — defer
- ❌ PickStatusBanner inline-with-title desktop layout — defer (header refactor)
- ❌ Skeleton loaders, generateMetadata, landing hero — Epic 7
- ❌ Real-time admin outstanding count refresh — deferred from 6.3
- ❌ WeatherBadge component extraction — defer
- ❌ Cron / email logic changes — Epic 6 complete after this story

### Deferred Work to Address in This Story

From `deferred-work.md`:

| Item | Action |
|------|--------|
| Invites page references console logs (6.1) | **Fix** — Task 8 |
| Standings current-user color-only highlight (5.4 → 7.3) | **Partial fix** — aria-current + (You) in Task 8 |
| Admin 2-column layout (6.2 dev notes) | **Fix** — Task 5 |
| `AdminPickOverrideDialog` lint (Epic 5 retro) | **Verify** — lint already clean as of 6.5; no action if still clean |

### Previous Story Intelligence (6.5)

- Cron orchestration complete — no email/cron changes needed here
- `import 'server-only'` pattern established in `src/lib/cron/*` — not relevant to client nav components
- Story 6.5 explicitly scoped **out** UX alignment: "Story 6.6 UX spec comparison — next story in Epic 6"
- NFR32 webhook owner remains unassigned — document in gap matrix, not implemented in 6.6

### Git Intelligence (Recent Commits)

Recent Epic 6 work pattern:

- `4950718` — Story 6.5 cron routes + `vercel.json`
- `b2bb98a` — Story 6.4 deep links + login redirect
- `70abe11` / `2f0c1cb` — Stories 6.3/6.2 email admin UI

Follow established patterns: colocated tests, `"use client"` on interactive MUI, server pages for data loading, review findings section in story file after code review.

### Latest Tech Notes

- **MUI v6/v7 App Router:** `AppRouterCacheProvider` already in `app-providers.tsx` — no change needed
- **BottomNavigation + Next.js Link:** Use `BottomNavigationAction component={Link} href={…}` with `value` tied to tab key; control `value` from `getActiveLeagueTab(pathname)`
- **Safe area:** `theme.mixins.toolbar` does not include safe-area — use explicit `env(safe-area-inset-bottom)` on fixed bottom nav

### Project Context Reference

See `docs/project-context.md` — MUI/Stack convention, no WebSockets, file organization under `src/components/league/` for new nav shell.

### References

- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Component Strategy, Responsive Design, Navigation Patterns, Empty States]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 6 goal; Story 7.3 a11y baseline]
- [Source: `_bmad-output/implementation-artifacts/epic-5-retro-2026-06-16.md` — 6.6 commitment]
- [Source: `_bmad-output/implementation-artifacts/6-2-tuesday-6-00-pm-league-email-content-and-admin-preview.md` — admin 2-col deferred here]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — invites copy, standings a11y]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

(none)

### Completion Notes List

#### UX Gap Matrix (post-6.6)

| UX Spec Section | Current State (post-6.6) | Action Taken |
|-----------------|--------------------------|--------------|
| **DesktopAppBar** | ✅ `LeagueNavShell` AppBar + Tabs at `md+` | **Implemented** (Tasks 3–4) |
| **BottomNavigation** | ✅ Fixed bottom nav at `< md` with safe-area padding | **Implemented** (Tasks 3–4) |
| **Navigation Patterns** | ✅ Tab routes via Next.js `Link`; active tab from `usePathname()` | **Implemented** |
| **Results tab** | ✅ Present between History and Rules | **Added** — product requirement (Epic 5.6), not in original 4-tab UX spec |
| **MatchupCard 2-col grid (desktop)** | ✅ CSS grid in `WeekMatchupList` at `md+` | **Implemented** (Task 6) |
| **Admin 2-col layout (desktop)** | ✅ Submission left / email+reminders right | **Implemented** (Task 5) |
| **Deadline + Jailed side-by-side (desktop)** | ✅ Responsive row on picks page | **Implemented** (Task 6) |
| **MatchupCard / TeamLogo** | ✅ `size="lg"` (40px); elevated hover/selected surfaces | **Implemented** (Tasks 6–7) |
| **Theme `background.elevated` / `overlay`** | ✅ Tokens in theme + augmentation | **Implemented** (Task 7) |
| **StandingsTable current-user row** | ✅ `aria-current="row"` + visually hidden "(You)" | **Implemented** (Task 8) |
| **Admin celebration empty state** | ✅ Message when `outstandingCount === 0` | **Implemented** (Task 8) |
| **Invites success copy** | ✅ Reflects email delivery, no server-log reference | **Implemented** (Task 8) |
| **PickStatusBanner desktop inline** | ❌ Full-width below header row | **Deferred** → Epic 7 (header refactor) |
| **Standings sidebar (desktop)** | ❌ Table only | **Deferred** → Epic 7 |
| **Button 48px height global** | ⚠️ Not globally enforced | **Deferred** → Epic 7.3/7.4 |
| **Skeleton loading states** | ❌ Not implemented | **Deferred** → Epic 7.4 |
| **Snackbar admin feedback** | ⚠️ Inline Alert in composers | **Deferred** — polish pass |
| **Landing page hero** | ⚠️ Basic marketing page | **Deferred** — out of scope |
| **generateMetadata** | ❌ Missing on league pages | **Deferred** → Epic 7 |
| **Full WCAG Level A audit** | ⚠️ Partial (radiogroup + standings row) | **Deferred** → Story 7.3 |
| **WeatherBadge extraction** | ⚠️ Inline in MatchupCard | **Deferred** — cosmetic |
| **AdminReminderControls** | ✅ Present (Story 6.3 extension) | Documented as post-spec extension |
| **NFR32 Resend webhooks** | ❌ Unassigned | **Deferred** — documented only |
| **League hub `/leagues/[id]`** | Hub keeps `← Your leagues` breadcrumb + link list for discoverability; nav shell wraps hub but no tab is active | **Dev choice** — tabs provide primary nav on sub-routes |

- `npm test`: 333 passed (51 files), including 14 new `league-nav-tabs` tests
- `npm run lint`: zero errors
- League home hub retains breadcrumb + section links; sub-routes drop redundant `← {league.name}` breadcrumbs

### File List

- `src/lib/league/league-nav-tabs.ts` (new)
- `src/lib/league/league-nav-tabs.test.ts` (new)
- `src/components/league/LeagueNavShell.tsx` (new)
- `src/app/(app)/leagues/[leagueId]/layout.tsx` (new)
- `src/app/(app)/leagues/[leagueId]/admin/page.tsx`
- `src/app/(app)/leagues/[leagueId]/picks/page.tsx`
- `src/app/(app)/leagues/[leagueId]/standings/page.tsx`
- `src/app/(app)/leagues/[leagueId]/history/page.tsx`
- `src/app/(app)/leagues/[leagueId]/results/page.tsx`
- `src/app/(app)/leagues/[leagueId]/rules/page.tsx`
- `src/app/(app)/leagues/[leagueId]/invites/invite-participants-form.tsx`
- `src/app/(app)/leagues/[leagueId]/invites/page.tsx`
- `src/components/picks/WeekMatchupList.tsx`
- `src/components/picks/MatchupCard.tsx`
- `src/components/standings/StandingsTable.tsx`
- `src/theme/create-app-theme.ts`
- `src/theme/mui-augmentation.d.ts`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-07-04: Story 6.6 — league nav shell (desktop AppBar + mobile BottomNavigation), responsive admin/picks layouts, theme elevated/overlay tokens, standings a11y, admin celebration state, invites copy fix; gap matrix recorded; deferrals added to `deferred-work.md`.
- 2026-07-04: Code review — fixed admin email regression, nested main landmarks, nav onChange, league name at md, MatchupCard grid fill, StandingsTable aria-current typing.

### Review Findings

- [x] [Review][Patch] Admin email controls hidden when no active week or participants — `AdminEmailComposer` and `AdminReminderControls` moved inside the `weekNumber != null && participants.length > 0` branch; previously always rendered below submission block. Admins lose email/reminder UI during pre-season or empty league. [src/app/(app)/leagues/[leagueId]/admin/page.tsx:97-149] — fixed: email controls always render in right column
- [x] [Review][Patch] Nested duplicate `<main>` landmarks — `LeagueNavShell` wraps children in `<Box component="main">` while every child page also sets `component="main"`, producing nested mains (a11y). [src/components/league/LeagueNavShell.tsx:165-175] — fixed: removed `component="main"` from shell wrapper
- [x] [Review][Patch] Controlled MUI nav missing `onChange` — `Tabs` and `BottomNavigation` are controlled via `value={activeTab}` but have no `onChange`; React dev warnings and potential MUI selection glitches on non-tab routes (invites, hub). [src/components/league/LeagueNavShell.tsx:122-211] — fixed: added no-op `onChange`
- [x] [Review][Patch] League name hidden at `md` breakpoint — AC2 requires league context at `≥768px`; `leagueName` uses `display: { lg: "block" }`, so tablets at 768–1199px show no league context. [src/components/league/LeagueNavShell.tsx:113-120] — fixed: visible at `md+`
- [x] [Review][Patch] MatchupCard `maxWidth: 560` prevents 2-col grid fill — cards stay narrow within grid cells on desktop instead of stretching to column width. [src/components/picks/MatchupCard.tsx:268] — fixed: `maxWidth: { xs: 560, md: "none" }`
- [x] [Review][Patch] StandingsTable `aria-current` uses double type cast — prefer native `TableRow` prop typing or MUI `visuallyHidden` helper over `as unknown as React.HTMLAttributes`. [src/components/standings/StandingsTable.tsx:61-63] — fixed: direct `aria-current` prop
- [x] [Review][Defer] Redundant Prisma membership queries — layout + each child page re-fetch membership/league; amplified by new layout but pattern pre-dates 6.6. [src/app/(app)/leagues/[leagueId]/layout.tsx] — deferred, pre-existing
