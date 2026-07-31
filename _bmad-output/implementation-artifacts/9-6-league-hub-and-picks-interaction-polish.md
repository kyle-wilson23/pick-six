# Story 9.6: League hub and picks interaction polish

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a participant,
I want the **league hub and picks UI** to be visually clear and interactive,
so that I can find actions quickly and understand what I'm selecting.

**Launch-hardening context:** Epic 9 closes pre-season blockers. Stories 9.1–9.5 handled scoring isolation, domain prep, forgot-password, measurement drills, and the app shell. **9.5–9.7** are the UI polish tranche already owned in `deferred-work.md` launch-risk triage. This story is the **interaction polish** slice: league hub visual hierarchy, app-wide link affordance, per-pick green-glow hover, and weather/retractable-roof tag gating. **Do not** soft-pedal Kyle’s source requirements (hub must pop, links need color+underline, glow is on the individual pick, retractable tag hidden without weather).

**Out of scope:** Email HTML / “make my picks” CTA emphasis (**Story 9.7**). App shell / home cards / nav / scroll / breakpoints / loading (**Story 9.5** — already done). Stadium metadata accuracy (SoFi “retractable” debate) — park; only enforce hide-when-no-weather.

## Source requirements (Kyle — verbatim; do not soften)

1. The league landing page as a member needs more love. The **"league hub"** area needs to be more distinguished from the rest of the page. It needs to **pop more**. The links maybe need to be **buttons** so eyes are more drawn to them.
2. **Styling of links** needs to be redone **across the entire app**. There's nothing to distinguish links from other text. Consider **colour and underline**.
3. **Hover state of individual picks** needs to actually be the **individual pick** instead of the whole matchup card. Provide a **background green glow** to individual picks.
4. **Hide the "retractable roof" tag** from matchups if the weather API doesn't return results.

## Acceptance Criteria

### AC1 — League hub pops + button CTAs

**Given** the member league landing (`/leagues/[leagueId]`) currently renders season copy, flat outlined quick-action buttons, and roster in one undifferentiated stack  
**When** this story ships  
**Then** the member **league hub** region is visually distinguished from the rest of the page (it “pops”—elevated surface, stronger hierarchy, and/or accent treatment using theme tokens)  
**And** primary hub actions are **buttons** (or equivalently prominent CTAs), not plain text links alone  
**And** existing destinations remain (Picks / Standings / Results via `buildLeagueTabHref`)

### AC2 — App-wide link color + underline

**Given** theme `MuiLink` today only sets focus-visible (no default color/underline) and many navigational links blend with body text  
**When** this story ships  
**Then** **app-wide** link styling distinguishes links from body text using **color and underline**  
**And** the change is **theme-level** (not one-off per page)—`MuiLink` and bare `<a>` / Next `Link` text links must pick up the defaults  
**And** intentional exceptions remain intact: SkipLink, brand mark, `Button component={Link}` CTAs, nav tabs (must **not** gain body-link underlines)

### AC3 — Individual pick green-glow hover (not whole card)

**Given** `MatchupCard` currently applies `&:hover { bgcolor: background.elevated }` on the **whole Card**, while team sides have no hover glow  
**When** the user hovers or keyboard-focuses an **interactive, selectable** team pick  
**Then** the hover/focus treatment applies to that **individual team pick** only—not the whole matchup card  
**And** the treatment is a **background green glow** on that pick (emerald/`primary` — e.g. translucent `primary.main` fill and/or soft green `boxShadow`; use theme tokens, no hardcoded hex sprawl)  
**And** card-level hover that paints the entire matchup is removed or narrowed so it does not compete with per-pick glow  
**And** touch/keyboard still work: selected state remains clear; focus-visible ring retained; disabled/jailed/already-picked sides do not get “selectable” glow

### AC4 — Hide retractable-roof tag without weather

**Given** retractable-roof affordance today is a Tooltip wrapping the weather Chip when `weather` is present and `stadiumRoof === "retractable"`  
**When** the weather API returns no results (`weather` is null/undefined)  
**Then** the **"retractable roof"** tag / tooltip / equivalent retractable-specific chrome is **hidden**  
**And** dome “Indoor” chip without weather may remain (not a retractable tag)  
**And** when weather **is** present for a retractable stadium, weather chip + retractable context may still show

## Tasks / Subtasks

- [x] Task 1 — League hub visual pop + CTA weight (AC: #1)
  - [x] Elevate hub region on `src/app/(app)/leagues/[leagueId]/page.tsx` and/or `LeagueHubQuickActions.tsx` — wrap quick actions (and optionally season summary) in `Card`/`Paper` with `background.paper` or `background.elevated`, padding, optional primary/gold accent border — must read as a distinct “hub” block vs roster
  - [x] Strengthen CTAs: upgrade from quiet `outlined` to **`contained`** (or equally prominent sizing/full-width stack on xs); keep `Button component={Link}` pattern (RSC-safe client wrapper already)
  - [x] Prefer `Stack` for flex layouts; preserve `appContentWidthSx` + `#main-content` skip target
  - [x] Do not reintroduce AdminLeagueRowActions breadcrumb thrash — hub quick actions + global nav are enough (9.5 review decision)
- [x] Task 2 — Theme-level link color + underline (AC: #2)
  - [x] Extend `src/theme/create-app-theme.ts`: `MuiLink` defaultProps / styleOverrides — `color: primary.main` (UX: links = emerald), `textDecoration: underline` (always or always + stronger hover with `primary.light`)
  - [x] Add `MuiCssBaseline` `a` styles so bare Next `<Link>` text links (HomeLeagueCards, my-leagues, etc.) get the same color+underline
  - [x] Audit overrides that force `color="text.secondary"` on navigational MUI Links (auth forgot/reset/login/signup) — remove or replace so links remain distinguishable
  - [x] Preserve exceptions: `SkipLink` (`underline="none"`), LeagueNavShell brand (`textDecoration: "none"`), Buttons-as-links, Tabs/BottomNav
  - [x] Spot-check: login/forgot/reset, home league name links, my-leagues/admin list links, any inline MUI Link in alerts
- [x] Task 3 — Per-pick green glow (AC: #3)
  - [x] In `MatchupCard.tsx` `renderTeamSide`: add interactive hover/focus green glow on the side `Stack` when selectable (`interactive && !isDisabled`)
  - [x] Wire `isSelected` into visible selected-side treatment (glow or stronger primary tint) so touch users who cannot hover still see the individual pick highlighted
  - [x] Remove/narrow Card `"&:hover": { bgcolor: "background.elevated" }` so whole-card hover is not the primary affordance
  - [x] Keep jailed/already-picked/locked behaviors and `focusVisibleRingSx`; do not glow disabled sides
  - [x] Optional: short transition on bgcolor/boxShadow for polish (UX: motion supports feedback, not decoration)
- [x] Task 4 — Retractable roof without weather (AC: #4)
  - [x] Confirm/codify: retractable Tooltip/chip **only** when `weather` is truthy; no standalone “Retractable” chip when weather is null
  - [x] Extract a tiny pure helper if useful (e.g. `shouldShowRetractableWeatherChrome(weather, stadiumRoof)`) + colocated unit test — preferred over brittle RTL of Tooltip
  - [x] Do **not** reopen SoFi classification / dome fetch policy (deferred parks)
- [x] Task 5 — Deferred-work + regression
  - [x] Strike / note in `deferred-work.md` that hub/links/pick-glow/roof-hide slice of “UI polish 9.5–9.7” is owned/closed by 9.6 (leave 9.7 email)
  - [x] Do **not** implement email HTML (**9.7**)
  - [x] `npm test` after helper/theme/component test changes

### Review Findings

- [x] [Review][Decision] Shell/nav/scroll changes bundled with 9.6 — **Keep** (Kyle 2026-07-31): ship with 9.6 and harden via related patches; update File List to include shell/nav/scroll files.
- [x] [Review][Patch] Selected pick loses focus-visible ring [src/components/picks/MatchupCard.tsx:44] — Fixed: selected branch includes `"&:focus-visible": focusVisibleRingSx` plus glow.
- [x] [Review][Patch] Nav MenuItem-as-Link picks up body underline [src/theme/create-app-theme.ts] — Fixed: `MuiMenuItem` `textDecoration: "none"`.
- [x] [Review][Patch] Path-based isAdmin ignores explicit false [src/components/league/LeagueNavShell.tsx:89] — Fixed: path admin/settings only when `league == null`.
- [x] [Review][Patch] Scroll reset on any focus inside main [src/components/layout/ScrollToTopOnNavigate.tsx] — Fixed: focusin only for `#main-content`; blur skips `:focus-visible` (skip-link/keyboard).
- [x] [Review][Patch] Story File List / sprint metadata incomplete — Fixed: File List updated; sprint status synced to `done`.
- [x] [Review][Defer] Mobile top chrome scroll-padding only desktop [src/theme/focus-visible-ring.ts:19] — deferred, pre-existing; `scrollMarginTop`/`scrollPaddingTop` apply at `md+` only by design for fixed desktop AppBar.

## Dev Notes

### Locked product decisions (prevent thrash)

| Topic | Decision |
|-------|----------|
| Hub “pop” | Required — elevated/carded hub region; not a subtle typography tweak alone |
| Hub CTAs | **Buttons** with real visual weight (`contained` preferred); `Button component={Link}` OK |
| Link pass scope | **App-wide theme** — color **and** underline; emerald primary per UX |
| Link exceptions | SkipLink, brand, button-links, tab chrome — no body-link underline |
| Pick hover | **Individual team side** only; **background green glow**; kill whole-card hover competition |
| Selected + touch | Individual selected side must remain visually clear without relying on hover alone |
| Retractable tag | Hidden when no weather; Indoor/dome without weather is OK |
| Out of scope | Email templates (**9.7**); shell/nav/home (**9.5**); SoFi metadata accuracy; weather cache TTL |

### Current codebase ground truth (MUST reuse)

| Area | Path | Today |
|------|------|-------|
| League hub page | `src/app/(app)/leagues/[leagueId]/page.tsx` | Flat Stack: h1, season, `LeagueHubQuickActions`, roster Papers — **no hub card** |
| Hub CTAs | `src/components/league/LeagueHubQuickActions.tsx` | Already `Button variant="outlined" component={Link}` — needs **weight + container pop** |
| Matchup card | `src/components/picks/MatchupCard.tsx` | Card-level hover elevated; team side has focus ring only; `isSelected` unused for visuals |
| Picks list | `src/components/picks/WeekMatchupList.tsx` | Grid of MatchupCards — leave structure; glow lives in MatchupCard |
| Theme links | `src/theme/create-app-theme.ts` | `MuiLink` = focus ring only; **no** CssBaseline `a` color/underline |
| Focus tokens | `src/theme/focus-visible-ring.ts` | Reuse for keyboard; glow is additive |
| Weather + roof | MatchupCard L379–400; `build-league-picks-week-view.ts`; `stadium-locations.ts` | Retractable Tooltip only when `weather`; dome → Indoor |
| Text links needing theme | `HomeLeagueCards`, `my-leagues`, auth MUI Links with `text.secondary` | Audit after theme change |
| RSC rule | `.cursor/rules/next-rsc-client-boundaries.mdc` | Hub CTAs / MatchupCard already `"use client"`; keep pages as RSC |

### Architecture compliance

- **Stack** for flex layouts (project-context / architecture).
- Theme is source of truth for visual tokens — extend `createAppTheme`; avoid scattered hardcoded `#2ECC71` in components (alpha via theme callback OK inside client components).
- No new API routes, secrets, or Prisma migrations expected.
- Prefer pure helpers under `src/lib/**` for testable visibility/glow predicates if extracted.

### UX compliance (this story)

**MUST**
- Permanent dark theme; cards `background.paper` `#1E1E1E` / elevated `#2A2A2A`; radius 16; primary emerald `#2ECC71` for links, CTAs, pick glow.
- Links = primary color + underline (UX: “Primary … links”).
- Hover on desktop for picks; touch-equivalent selected treatment (UX: hover must have touch-equivalent).
- Touch targets ≥44px on pick sides (already `minHeight: 44`).
- Motion: short feedback transitions OK; no decorative animation noise.

**AVOID**
- Whole-card green glow as the hover signal.
- Underlining nav tabs / buttons / brand.
- Hardcoded hex outside theme.
- Scope creep into email HTML or stadium metadata rewrite.
- Purple/glow-cliché excess — keep glow subtle emerald tint, not neon bloom.

### Suggested green-glow recipe (non-binding; must meet AC)

On interactive team `Stack` when hover/focus-visible/selected:

- `bgcolor: (t) => alpha(t.palette.primary.main, 0.12–0.18)` (or `${primary.main}1F`-style)
- Optional `boxShadow: (t) => \`0 0 12px ${alpha(t.palette.primary.main, 0.35)}\``
- Disabled sides: no glow; already-picked/jailed keep existing dimming

### Deferred-work disposition (consulted while planning)

| Item | Disposition for 9.6 |
|------|---------------------|
| UI polish hub / links / pick glow (launch triage → 9.5–9.7) | **This story** owns hub pop, app-wide links, pick glow, retractable hide |
| Email HTML / password-reset CTA plaintext | **Out of scope** — Story **9.7** |
| SoFi “retractable” classification accuracy | **Park** — do not reclassify teams; only enforce hide without weather |
| Domed stadium weather display / Indoor chip | **Leave** — Indoor without weather is fine; not retractable tag |
| Weather cache failure TTL | **Park** — unrelated |
| Pathname league-id 404 chrome (9.5 review) | **Out of scope** |
| Auth cookie apex/www, DMARC, Resend `from` | **Out of scope** — post-epic-9 |

### Previous story intelligence

**Story 9.5 (done):** Built global shell, Home, recent-visit, scroll-top, `md=768`, `appContentWidthSx`, loading. Explicitly deferred hub pop / link underline / pick glow / retractable hide to **9.6**. Hub quick actions already exist as outlined buttons — **elevate, don’t reinvent**. Review decisions: keep mobile More overflow; hub shortcuts only (no AdminLeagueRowActions restore); `history.scrollRestoration = "manual"` stays.

**Story 9.4:** Measurement only; do not reopen Lighthouse/NFR5.

**Story 6.6 / 7.3:** Established picks MatchupCard + a11y focus rings — extend MatchupCard; preserve `aria-*` on radio sides.

**Git recent pattern:** `feat(app-shell): Story 9.5 …`, `feat(perf): Story 9.4 …`. Prefer `feat(ui):` or `feat(picks):` for this story.

### Testing requirements

1. Unit: retractable-chrome visibility helper (weather null + retractable → false; weather present + retractable → true; dome/indoor paths unchanged).
2. Optional RTL: MatchupCard — hoverable side gets glow styles / card root lacks whole-card hover if cheap with Testing Library + theme; otherwise manual smoke is OK for visual glow.
3. Manual smoke: hub “pops” + contained CTAs; body links emerald+underline on home/auth; brand/nav/buttons not underlined; picks — hover one team only glows green; select on mobile shows individual side; retractable tooltip absent when weather missing.
4. `npm test` after implementation.
5. Prefer pure helpers over mocking Next.js.

### Project Structure Notes

**Update (expected):**
- `src/app/(app)/leagues/[leagueId]/page.tsx` — hub region composition
- `src/components/league/LeagueHubQuickActions.tsx` — container + CTA variants
- `src/components/picks/MatchupCard.tsx` — per-side glow; card hover; weather/retractable gate
- `src/theme/create-app-theme.ts` — `MuiLink` + `MuiCssBaseline` `a`
- Auth link pages if they override link color to `text.secondary`
- Optional: `src/lib/picks/*` helper + `*.test.ts` for retractable chrome
- `_bmad-output/implementation-artifacts/deferred-work.md` — note 9.6 closure for hub/links/glow slice

**Do not create:** email template redesign, second nav system, new weather provider, stadium reclassification pass.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 9; Story 9.6]
- [Source: `_bmad-output/planning-artifacts/prd.md` — participant pick UX / unified interface journeys]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Color System (primary links `#2ECC71`); hover/touch parity; matchup cards; dark tokens; motion as feedback]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — MUI theme source of truth; Stack convention]
- [Source: `docs/project-context.md` — MUI Stack; Epic 9 UI polish]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — launch triage 9.5–9.7; SoFi retractable park]
- [Source: `_bmad-output/implementation-artifacts/9-5-app-shell-home-nav-scroll-breakpoints-loading.md` — defers hub/links/glow/roof to 9.6; hub CTA precedent]
- [Source: `src/components/league/LeagueHubQuickActions.tsx`, `src/components/picks/MatchupCard.tsx`, `src/theme/create-app-theme.ts`]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

_(none)_

### Completion Notes List

- **AC1:** `LeagueHubQuickActions` now renders an elevated `Paper` hub block (primary border, `background.elevated`) with season summary + contained Picks/Standings/Results buttons; full-width stack on xs.
- **AC2:** Theme `MuiLink` defaults (primary + underline) and `MuiCssBaseline` bare-`<a>` styles with exclusions for Button/Tab/BottomNav; removed `color="text.secondary"` from forgot/reset back-links.
- **AC3:** `MatchupCard` per-team-side emerald glow on hover/focus/selected via `pickSideGlowSx`; whole-card hover removed; disabled/jailed/already-picked sides unchanged.
- **AC4:** `shouldShowRetractableWeatherChrome` helper + 3 unit tests; MatchupCard uses helper for retractable tooltip gate.
- **Regression:** `npm test` — 512 tests passed (85 files).

### File List

- `src/app/(app)/leagues/[leagueId]/page.tsx`
- `src/app/forgot-password/forgot-password-client.tsx`
- `src/app/reset-password/[token]/reset-password-client.tsx`
- `src/components/layout/AppNavLeagueContext.tsx`
- `src/components/layout/ScrollToTopOnNavigate.tsx`
- `src/components/league/LeagueHubQuickActions.tsx`
- `src/components/league/LeagueNavShell.tsx`
- `src/components/picks/MatchupCard.tsx`
- `src/lib/league/league-nav-tabs.ts`
- `src/lib/league/league-nav-tabs.test.ts`
- `src/lib/picks/retractable-weather-chrome.ts`
- `src/lib/picks/retractable-weather-chrome.test.ts`
- `src/theme/create-app-theme.ts`
- `src/theme/focus-visible-ring.ts`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- **2026-07-29:** Story 9.6 implementation — league hub pop, app-wide link styling, per-pick green glow, retractable roof gating, deferred-work closure note.
- **2026-07-31:** Code review — keep shell/nav/scroll with 9.6; patch selected-pick focus ring, MenuItem underline, isAdmin path guard, scroll/focus narrowing; status → done.
