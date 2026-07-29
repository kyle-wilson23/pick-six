# Story 9.5: App shell — home, nav, scroll, breakpoints, loading

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a signed-in user,
I want a coherent **home shell and navigation**,
so that I am never stranded without a way home and pages don't feel broken on desktop/mobile.

**Launch-hardening context:** Epic 9 closes pre-season blockers. Stories 9.1–9.4 handled scoring isolation, domain prep, forgot-password, and measurement drills. **9.5–9.7** are the UI polish tranche already owned in `deferred-work.md` launch-risk triage. This story is the **app shell** slice: home hub, global nav, scroll-top, breakpoint/width pass, and navigation loading. **Do not** soft-pedal Kyle’s source requirements (cards required, list limit 3, Settings in nav, full breakpoint pass).

**UX note:** The UX spec still describes a marketing landing hero. **Story 9.5 overrides that for signed-in entry** — no marketing landing; Home is the shell. Keep UX tokens (dark charcoal, emerald `#2ECC71`, card radius 16, 768px nav switch, content max ~960 desktop). League hub “pop,” app-wide link underline, pick green-glow hover, and email HTML are **Story 9.6 / 9.7** — out of scope here.

## Source requirements (Kyle — verbatim; do not soften)

1. There should be **no landing page**. There should just be a **"home" page** combining a short list of your leagues, leagues you admin, and a create league button. **Each list is surrounded in a card**, and the list is **limited to 3 leagues** with a **show more** button that takes you to the existing, dedicated league list pages. **On both pages** (home and dedicated list pages), leagues should be sorted by **most recently visited**.
2. Every page on desktop renders with the page title beneath the top nav menu — the user can scroll up to reveal the page title. **Pages should render entirely scrolled to the top when navigated to.**
3. The **nav menu should be consistently everywhere**, on every page. Nav links specific to league actions can be hidden until you're drilled into a league, but there **always** needs to be a link that lands you back at the **home** page. There is also **no "settings" link in the nav menu for admins** today — add it.
4. The page layout **breakpoints seem broken**. On a desktop breakpoint, the page width on many pages is very small/skinny. **Do a full pass on all pages** and their layout breakpoints and responsiveness to support both desktop and mobile.
5. **Better loading effects** when navigating to a page. Even just a loading spinner or animation will do.

## Acceptance Criteria

### AC1 — Home replaces marketing landing for signed-in users

**Given** `/` is currently a marketing/dev shell and `/dashboard` is a stub link page  
**When** this story ships  
**Then** there is **no** marketing/landing entry for signed-in users—only a **Home** page  
**And** unsigned visitors hitting `/` are sent to login (or a minimal auth entry)—not a marketing hero  
**And** Home shows: (1) leagues you play, (2) leagues you admin, (3) a create-league control  
**And** post-login default / logout / callback defaults land on Home (update `/dashboard` references)

### AC2 — Carded lists, max 3, Show more

**Given** Home composes participant + admin league lists  
**When** the user views Home  
**Then** **each** list is **surrounded in a card** (MUI `Card` or equivalent paper surface wrapping the whole list section—not only per-row Papers)  
**And** each list shows **at most 3 leagues**  
**And** a **Show more** control navigates to the existing dedicated page (`/my-leagues` for play; `/leagues` for admin)  
**And** empty states remain usable (copy + create CTA where appropriate)

### AC3 — Most recently visited sort (home + dedicated lists)

**Given** the user has visited one or more leagues  
**When** they open Home **or** `/my-leagues` **or** `/leagues`  
**Then** leagues are sorted by **most recently visited** (newest first)  
**And** never-visited leagues sort after visited (stable secondary sort by name is fine)  
**And** visiting a league hub/sub-route records a visit (see Dev Notes — preferred: `LeagueMembership.lastVisitedAt`)

### AC4 — Nav everywhere + Home + admin Settings

**Given** today `LeagueNavShell` only wraps `/leagues/[leagueId]/**`  
**When** this story ships  
**Then** the nav chrome appears **consistently on every authenticated app page** (Home, list pages, create, league routes)  
**And** a **Home** link is **always** visible and routes to the Home page  
**And** league-specific tabs (Picks / Standings / History / Results / Rules / Admin) may hide until inside a league  
**And** when the user is an **admin of the current league**, a **Settings** nav control is present and links to `/leagues/[leagueId]/settings`  
**And** users are never stranded without a path back to Home (brand mark may also link Home)

### AC5 — Scroll to top on navigation

**Given** sticky desktop AppBar sits above page `h1` titles  
**When** the user client-navigates between routes  
**Then** the document scroll position is **top** (title must not open buried under the sticky nav)  
**And** desktop still allows scrolling so the title sits beneath the nav and can be revealed by scrolling up (existing pattern)

### AC6 — Full breakpoint / width pass

**Given** many pages use `maxWidth: 560` and feel skinny on desktop  
**When** this story ships  
**Then** a **full pass** across authenticated pages fixes layout breakpoints/responsiveness so desktop is not oddly skinny and mobile remains usable  
**And** content widths align with UX guidance (~full width + pad on mobile; comfortable centered max ~720 tablet / ~960 desktop—do not leave accidental 560-wide columns on large screens)  
**And** nav pattern switch remains coherent (prefer UX **768px** = `md`; see Dev Notes)

### AC7 — Loading on navigate

**Given** only picks + standings have `loading.tsx` skeletons today  
**When** the user navigates to an authenticated page  
**Then** a loading spinner or equivalent loading animation is shown (route-level `loading.tsx` and/or shared progress indicator is acceptable)  
**And** existing picks/standings skeletons may be kept or harmonized—do not regress them

## Tasks / Subtasks

- [x] Task 1 — Home route + kill marketing landing (AC: #1, #2)
  - [x] Replace stub dashboard with Home UI (canonical path: **`/home`**; permanent redirect `/dashboard` → `/home` for bookmarks/callbacks)
  - [x] Root `/`: signed-in → redirect `/home`; signed-out → `/login` (remove marketing/dev hero)
  - [x] Update `defaultPath` / login callback / `(app)/layout` fallback / create-league & invite fallbacks from `/dashboard` → `/home`
  - [x] Update logout `callbackUrl` away from marketing `/` (prefer `/login`)
  - [x] Home sections: Your leagues card (≤3) + Show more → `/my-leagues`; Admin leagues card (≤3) + Show more → `/leagues`; Create league button
  - [x] Reuse list libs + row presentation patterns; extract shared list/card components if duplication is obvious
- [x] Task 2 — Recent-visit persistence + sort (AC: #3)
  - [x] Add `LeagueMembership.lastVisitedAt` (`DateTime?`, mapped `last_visited_at`) + migration
  - [x] Record visit when entering league layout (best-effort; fire-and-forget update is OK—do not block render on failure)
  - [x] Sort in `listJoinedLeaguesWithCurrentSeason` and `listAdministeredLeaguesWithCurrentSeason` (or shared sorter): `lastVisitedAt` desc nulls last, then `name` asc
  - [x] Unit tests for sort helper / mapper ordering
- [x] Task 3 — Global app nav shell (AC: #4)
  - [x] Promote chrome so `(app)` routes always have nav (extend `LeagueNavShell` or split `AppNavShell` + league tabs)
  - [x] Always show **Home**; when in-league show league tabs; when in-league **and** admin show **Settings**
  - [x] Brand / logo → Home (not only current league hub)
  - [x] Preserve SkipLink, test-league chip, bottom nav on mobile, a11y (`aria-current`, `#main-content`)
  - [x] Do **not** put core league tabs behind a hamburger (UX anti-pattern)
- [x] Task 4 — Scroll-to-top (AC: #5)
  - [x] Ensure client navigations reset scroll to `0` (pathname `useEffect` scroll helper and/or verify Next Link `scroll` default; sticky AppBar often needs an explicit reset)
  - [x] Smoke: navigate Home → skinny scrolled league page → another page; confirm top
- [x] Task 5 — Breakpoint / width pass (AC: #6)
  - [x] Align theme `breakpoints.values.md` to **768** (UX) **or** document why `md=900` stays and use `theme.breakpoints.up(768)` consistently for nav—pick one and apply everywhere
  - [x] Replace skinny `maxWidth: 560` stacks with shared content width (e.g. `maxWidth: { xs: 1, sm: 720, md: 960 }` or MUI `Container`) across Home, lists, hub, standings, history, settings, invites, rules, results, admin, etc.
  - [x] Fix nested `minHeight: "100vh"` on pages inside full-height shell where it causes double full-height (deferred-work history note)
  - [x] Spot-check mobile bottom-nav clearance (padding bottom so last content clears bar)
- [x] Task 6 — Loading effects (AC: #7)
  - [x] Add `(app)/loading.tsx` (and/or segment loadings) with centered `CircularProgress` + `aria-busy` / polite label at minimum
  - [x] Keep or align picks/standings skeletons (Story 7.4)
- [x] Task 7 — Deferred-work strike + regression checks
  - [x] Strike / resolve deferred items owned here (landing hero; nested minHeight if fixed; note loading expansion)
  - [x] Do **not** implement 9.6 hub/links/pick-glow or 9.7 email HTML
  - [x] `npm test` after behavior/helper changes

### Review Findings

- [x] [Review][Decision] Mobile More menu buries Rules/Admin/Settings — **Accepted as-is (1A):** keep Rules/Admin/Settings in More overflow; primary bar stays Home + Picks/Standings/History/Results.
- [x] [Review][Decision] League hub dropped AdminLeagueRowActions / back-to-lists breadcrumb — **Accepted as-is (2A):** hub quick actions only; global nav covers Invites/Settings/Admin/History/Rules.
- [x] [Review][Decision] `history.scrollRestoration = "manual"` — **Accepted as-is (3A):** keep manual restoration for AC5 reliability.

- [x] [Review][Patch] `parseLeagueIdFromPathname` treats `/leagues/new` as a league id [`src/lib/league/league-nav-tabs.ts:88`] — fixed: reserved segments (`new`) return null
- [x] [Review][Patch] Prefer validated nav context over pathname fallback so 404 / invalid league URLs do not show league tabs [`src/components/league/LeagueNavShell.tsx:79`] — mitigated via reserved-segment parse (keeps pathname fallback for SSR/hydration); true cuid-shaped 404 may still show participant tabs
- [x] [Review][Patch] Create League page missing `#main-content` skip target [`src/app/(app)/leagues/new/page.tsx:12`]
- [x] [Review][Patch] App `loading.tsx` missing `#main-content` skip target [`src/app/(app)/loading.tsx:9`]
- [x] [Review][Patch] Home uses `notFound()` when session lacks `user.id` — redirect to login instead [`src/app/(app)/home/page.tsx`]
- [x] [Review][Patch] Navigation loading overlay can stick if a captured link nav never completes — add a safety clear/timeout [`src/components/layout/NavigationLoadingIndicator.tsx:39`]
- [x] [Review][Patch] Scroll-to-top keys only on `pathname`, not query — week changes leave mid-scroll [`src/components/layout/ScrollToTopOnNavigate.tsx:24`]
- [x] [Review][Patch] Home “Show more” is a text `Link`, not a button control (source requirement) [`src/components/league/HomeLeagueCards.tsx:58`]
- [x] [Review][Patch] Global `html, body { overflow-x: hidden }` can clip wide content / hurt zoom — narrow to shell or remove from globals [`src/app/globals.css:7`] — removed from globals; shell `overflowX: hidden` retained

## Dev Notes

### Locked product decisions (prevent thrash)

| Topic | Decision |
|-------|----------|
| Canonical Home URL | **`/home`** inside `(app)`; `/dashboard` → redirect `/home`; `/` auth-gates to `/home` or `/login` |
| Marketing landing | **Removed** for product entry (signed-out → login). PRD “future public landing” stays post-MVP |
| List cards | One **Card** per section wrapping the list; row contents may still use Stack/Typography; ≤3 rows + **Show more** |
| Show more targets | Play → `/my-leagues`; Admin → `/leagues` (existing pages; apply same recent-visit sort) |
| Recent visit store | **`LeagueMembership.lastVisitedAt`** (DB)—not localStorage-only (cross-device) |
| Settings in nav | League-scoped `/leagues/[leagueId]/settings` when current league membership is **ADMIN**; not a global settings page |
| Nav architecture | Extend existing shell—**do not** invent a second nav system |
| Loading floor | Spinner OK; skeletons preferred where cheap |
| Out of scope | Hub visual “pop,” app-wide link underline, pick green glow, retractable-roof hide, email HTML (**9.6 / 9.7**) |

### Current codebase ground truth (MUST reuse)

| Area | Path | Today |
|------|------|-------|
| Marketing `/` | `src/app/page.tsx` | Dev hero + Dashboard/Login — **replace with redirects** |
| Stub dashboard | `src/app/(app)/dashboard/page.tsx` | Links only — **replace with Home or redirect** |
| Auth layout | `src/app/(app)/layout.tsx` | Auth gate only — **no chrome**; add shell here or via shared layout component |
| League shell | `src/components/league/LeagueNavShell.tsx` | Sticky AppBar / BottomNavigation; brand → league hub; **no Home, no Settings tab** |
| Tab config | `src/lib/league/league-nav-tabs.ts` | Picks/Standings/History/Results/Rules + Admin; `getActiveLeagueTab` returns null on hub/settings |
| League layout | `src/app/(app)/leagues/[leagueId]/layout.tsx` | Wires `LeagueNavShell`; ideal place to **touch `lastVisitedAt`** |
| Joined list | `src/lib/league/list-joined-leagues.ts` | `orderBy: league.name asc` — change to recent-visit |
| Admin list | `src/lib/league/list-administered-leagues.ts` | Same name sort |
| List pages | `src/app/(app)/my-leagues/page.tsx`, `…/leagues/page.tsx` | Per-row `Paper`; `maxWidth: 560` |
| Settings route | `src/app/(app)/leagues/[leagueId]/settings/page.tsx` | Exists; linked from `AdminLeagueRowActions`, not nav |
| Callbacks | `src/lib/callback-url.ts`, login pages | `defaultPath: "/dashboard"` |
| Theme | `src/theme/create-app-theme.ts` | Dark/emerald/gold; **no custom breakpoints** (MUI `md=900`) |
| Loading | `…/picks/loading.tsx`, `…/standings/loading.tsx` | Story 7.4 skeletons only |
| RSC / MUI | `.cursor/rules/next-rsc-client-boundaries.mdc` | Nav with `component={Link}` / theme `sx` → **`"use client"`** wrappers |

### Architecture compliance

- **Stack** for flex layouts (project-context / architecture)—prefer over `Box` for multi-child flex.
- **`loading.tsx` + Suspense** for RSC routes; client `CircularProgress` / `Skeleton`; flags `isLoading` / `isSubmitting` where client-driven.
- Keep pages as Server Components for `auth()` + Prisma; extract interactive nav/list chrome to client components.
- JSON/DB naming: camelCase API if any visit endpoint; Prisma `@map("last_visited_at")`.
- Do not put secrets in client. Visit stamp is user-scoped membership update—authorize via session user id only.

### UX compliance (shell only)

**MUST**
- Permanent dark theme; cards `background.paper` `#1E1E1E`, radius 16; primary emerald for active nav / Show more / Home emphasis.
- Page titles as `h1` beneath top nav.
- Touch targets ≥44px (theme already pushes buttons/tabs to 48).
- Semantic `nav` / `main`; SkipLink preserved; keyboard-operable Home/Settings/Show more.
- Mobile bottom nav + desktop AppBar—never both at once; switch at **768px** preferred.

**AVOID**
- Marketing hero as signed-in entry.
- Hamburger hiding core league tabs.
- Hardcoded hex outside theme tokens.
- Scope creep into 9.6/9.7 visuals.

### Breakpoint / skinny-desktop root cause

Many authenticated pages center content with **`maxWidth: 560`** (`my-leagues`, admin leagues list, hub, standings, history, settings, invites, …). Picks already uses `{ xs: 640, md: 960 }`. Fix by standardizing a shared content-width pattern and applying it in the full pass—not by one-off tweaks on Home alone.

### Scroll-to-top technical note

Next.js App Router **defaults** to scroll-on-navigate, but **sticky AppBar** layouts historically leave mid-scroll positions (known App Router issues). Ship an explicit client helper (`usePathname` → `window.scrollTo(0, 0)`) in the app shell so AC5 is reliable. Do not set `scroll={false}` on primary nav Links.

### Deferred-work disposition (consulted while planning)

| Item | Disposition for 9.5 |
|------|---------------------|
| UI polish home / loading (launch triage → 9.5–9.7) | **This story** owns home, nav, scroll, breakpoints, loading |
| **Landing page hero layout** (deferred Epic 6/7 era) | **Resolve by removal** — no marketing landing; strike when done |
| **`minHeight: "100vh"` nested in league shell** (history page) | **Opportunistic fix** during layout pass |
| Skeleton only on picks/standings | **Extend** with app-level navigate loading (AC7) |
| League hub pop / link underline / pick glow / roof tag | **Out of scope** — Story **9.6** |
| Email HTML / password-reset CTA plaintext | **Out of scope** — Story **9.7** |
| Auth cookie apex/www, DMARC, Resend `from` | **Out of scope** — post-epic-9 |
| CSV / email TOCTOU / N+1 / observability parks | **Out of scope** — leave Accept/Park |

### Previous story intelligence

**Story 9.4 (done):** Measurement/reliability only; explicitly deferred nav loading polish to **9.5**. Pattern: tight ACs, deferred disposition table, evidence in docs. Do not reopen Lighthouse/NFR5/breaker work here.

**Story 9.3 (done):** Auth UI client forms + RSC pages; rate limits; reuse existing stacks. For 9.5: reuse shell/list libs; migration for `lastVisitedAt` similar to password-reset token migration discipline.

**Story 7.3 / 7.4:** A11y SkipLink + focus rings; picks/standings `loading.tsx` skeletons — copy a11y attrs (`aria-busy`, labels, `skipTargetMainSx`).

**Story 6.6:** UX alignment pass established league shell patterns—extend, don’t fork.

**Git recent pattern:** focused `feat(...)` commits (`9.4` perf, `9.3` auth, `9.1` scoring). Prefer `feat(ui):` or `feat(app-shell):` for this story.

### Testing requirements

1. Unit: recent-visit **sort** helper (visited before null; newer before older; name tiebreak).
2. Unit: nav tab helpers if Settings/Home matching logic is added (`league-nav-tabs` / shell helpers)—preserve existing `getActiveLeagueTab` behavior for hub (null) vs settings (Settings active or null-with-Settings highlighted—pick one consistent UX).
3. Update callback-url tests if default path changes to `/home`.
4. Manual smoke: signed-in Home cards + Show more; visit league then confirm sort; nav Home from deep route; Settings visible for admin only; desktop width not skinny; scroll-top; loading flash on slow nav.
5. `npm test` after implementation.
6. Prefer pure helpers under `src/lib/**` over mocking all of Next.js.

### Project Structure Notes

**Create (expected):**
- `src/app/(app)/home/page.tsx` — Home
- `src/app/(app)/loading.tsx` — navigate spinner (minimum)
- `src/components/layout/` or extend `src/components/league/` — global shell / scroll-to-top / home league cards
- Prisma migration — `last_visited_at` on `league_memberships`
- Optional: `src/lib/league/sort-leagues-by-recent-visit.ts` (+ test)

**Update:**
- `src/app/page.tsx` — auth redirects only
- `src/app/(app)/dashboard/page.tsx` — redirect to `/home` (or delete + next config redirect)
- `src/components/league/LeagueNavShell.tsx`, `src/lib/league/league-nav-tabs.ts`
- `src/app/(app)/layout.tsx` and/or league layout
- `src/lib/league/list-joined-leagues.ts`, `list-administered-leagues.ts` (+ tests)
- List pages + other skinny `maxWidth: 560` pages
- `src/lib/callback-url.ts`, login defaults, link buttons, logout
- `src/theme/create-app-theme.ts` — breakpoints if aligning to 768
- `_bmad-output/implementation-artifacts/deferred-work.md` — strike resolved items

**Do not create:** second email stack, Playwright suite (optional), global non-league Settings page.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 9; Story 9.5]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR4–FR5 league lists/settings; NFR2 nav; responsive breakpoints; post-MVP public landing]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — `src/app/(app)`; loading.tsx; MUI Stack; folder layout]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — nav tabs/AppBar/BottomNavigation; breakpoints 768; cards; loading; tokens; anti-hamburger; marketing landing **overridden** by 9.5]
- [Source: `docs/project-context.md` — MUI Stack; Epic 9 UI polish; file organization]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — launch triage 9.5–9.7; landing hero; nested minHeight; skeletons]
- [Source: `_bmad-output/implementation-artifacts/9-4-epic-7-carryovers-lighthouse-nfr5-circuit-breaker-e2e.md` — defers nav loading to 9.5]
- [Source: `src/components/league/LeagueNavShell.tsx`, `src/lib/league/league-nav-tabs.ts`, `src/lib/league/list-joined-leagues.ts`, `src/app/(app)/dashboard/page.tsx`, `src/app/page.tsx`, `src/theme/create-app-theme.ts`]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

### Completion Notes List

- Implemented `/home` as canonical signed-in entry; `/` auth-gates to `/home` or `/login`; `/dashboard` redirects to `/home`.
- Added `LeagueMembership.lastVisitedAt` with migration + `sortLeaguesByRecentVisit` helper; visit stamped in league layout (fire-and-forget).
- Promoted `LeagueNavShell` to `(app)/layout` with `AppNavLeagueProvider` for league context; Home link always visible; Settings tab for league admins.
- Added `ScrollToTopOnNavigate`, `(app)/loading.tsx` spinner, theme `md=768`, shared `appContentWidthSx` across authenticated pages.
- Struck deferred-work items: landing hero removal, nested minHeight, loading expansion note.
- `npm test` — 496 passed; `npm run lint` — clean.

### File List

- `prisma/schema.prisma`
- `prisma/migrations/20260729140000_add_league_membership_last_visited_at/migration.sql`
- `src/app/page.tsx`
- `src/app/(app)/layout.tsx`
- `src/app/(app)/loading.tsx`
- `src/app/(app)/home/page.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/my-leagues/page.tsx`
- `src/app/(app)/leagues/page.tsx`
- `src/app/(app)/leagues/new/page.tsx`
- `src/app/(app)/leagues/new/create-league-form.tsx`
- `src/app/(app)/leagues/[leagueId]/layout.tsx`
- `src/app/(app)/leagues/[leagueId]/page.tsx`
- `src/app/(app)/leagues/[leagueId]/picks/page.tsx`
- `src/app/(app)/leagues/[leagueId]/picks/loading.tsx`
- `src/app/(app)/leagues/[leagueId]/standings/page.tsx`
- `src/app/(app)/leagues/[leagueId]/standings/loading.tsx`
- `src/app/(app)/leagues/[leagueId]/history/page.tsx`
- `src/app/(app)/leagues/[leagueId]/settings/page.tsx`
- `src/app/(app)/leagues/[leagueId]/invites/page.tsx`
- `src/app/(app)/leagues/[leagueId]/rules/page.tsx`
- `src/app/(app)/leagues/[leagueId]/results/page.tsx`
- `src/app/(app)/leagues/[leagueId]/admin/page.tsx`
- `src/app/login/page.tsx`
- `src/app/login/login-client.tsx`
- `src/app/signup/[token]/accept-invite-form.tsx`
- `src/components/league/LeagueNavShell.tsx`
- `src/components/league/HomeLeagueCards.tsx`
- `src/components/layout/AppNavLeagueContext.tsx`
- `src/components/layout/ScrollToTopOnNavigate.tsx`
- `src/components/auth/dashboard-link-button.tsx`
- `src/components/auth/logout-button.tsx`
- `src/lib/league/sort-leagues-by-recent-visit.ts`
- `src/lib/league/sort-leagues-by-recent-visit.test.ts`
- `src/lib/league/record-league-visit.ts`
- `src/lib/league/list-joined-leagues.ts`
- `src/lib/league/list-joined-leagues.test.ts`
- `src/lib/league/list-administered-leagues.ts`
- `src/lib/league/league-nav-tabs.ts`
- `src/lib/league/league-nav-tabs.test.ts`
- `src/lib/callback-url.ts`
- `src/lib/callback-url.test.ts`
- `src/theme/create-app-theme.ts`
- `src/theme/app-content-width.ts`
- `src/proxy.ts`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-07-29: Story 9.5 — app shell (home, global nav, recent-visit sort, scroll-top, breakpoints, loading).
- 2026-07-29: Code review — decisions accepted (mobile More, hub shortcuts, scrollRestoration); 9 patches applied (reserved league path segments, skip targets, home redirect, nav loading timeout, scroll query deps, Show more button, overflow-x).

**Ultimate context engine analysis completed — comprehensive developer guide created.**
