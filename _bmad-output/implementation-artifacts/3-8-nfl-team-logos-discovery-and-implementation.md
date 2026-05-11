# Story 3.8: NFL team logos — discovery and implementation

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created -->

## Story

As a **participant**,
I want **real team logos on matchups, pick status surfaces, and related pick UI**,
so that **the experience matches familiar NFL visual language and the UX hierarchy** instead of abbreviation-only placeholders — **within licensing and perf constraints** (**FR14–FR18 presentation**; `_bmad-output/planning-artifacts/prd.md` team-logo row).

## Acceptance Criteria

1. **Discovery + documented approach (licensing/compliance)**

   **Given** NFL team marks are **protected / licensed**

   **When** discovery completes **before or as part of** implementation

   **Then** **`docs/`** contains a concise decision record (new file **`docs/nfl-team-logos.md`** or **appendix in `docs/nfl-odds-integration.md`** only if tightly coupled — prefer a dedicated **`docs/nfl-team-logos.md`**) stating the **chosen approach** among credible options:

   - **Static assets** checked into **`public/`** (e.g. `public/nfl-logos/<abbr>.{svg,png}`) with **abbreviation keyed to `Team.abbreviation`** (`prisma/data/nfl-teams.json` canonical list),

   - **Provider-supplied image URLs** (only if vendor **terms explicitly allow** our use case and caching pattern),

   - or a **third-party sports imagery API** (same constraint: terms, attribution, caching).

   **And** the doc records **fallback on load failure**, **why rejected options were skipped**, and **how to add/replace logos** when teams rebrand.

2. **`TeamLogo` renders real logos for sm / md / lg**

   **Given** authenticated users on picks surfaces composing `TeamLogo` (`MatchupCard`, `PickStatusBanner`, `JailedTeamCallout`, and future `StandingsTable` per UX)

   **When** assets or remote URLs resolve successfully

   **Then** the component shows a **`next/image`** (per AC #1 decision) scaled to the **semantic size variant**

   **And** **`alt` text** is meaningful — at minimum **`{teamName}`** or **`"{abbreviation}: {teamName}"`** consistent with today's `aria-label` intent (**NFR42**)

   **And** **sm / md / lg** align to **UX § TeamLogo sizes** (**24 / 32 / 40 px** diameters — see Dev Notes on reconciling today's **28 / 36 / 44** implementation map):

   | Variant | Target diameter (UX) |
   |---------|---------------------|
   | sm | 24px |
   | md | 32px |
   | lg | 40px |

3. **Preserve Story 3.6 / 3.7 behavioral and visual states on the logo**

   **Given** existing props on `TeamLogo`: `abbreviation`, `teamName`, `size`, `disabled?`, `jailed?`, `pickedWeekTag?`

   **When** real images are wired in

   **Then** **default**, **disabled** (already picked), **jailed**, and **`pickedWeekTag` overlay** behave as today: filters/opacity/overlines still apply logically to the **image** (desaturation, opacity, "JAILED" / "PICKED WK X" tags)

   **And** behavior remains **backward compatible** at the **call-site API** — do not force every parent to pass new props unless a **small optional** prop is unavoidable (e.g. **`logoUrl`** from server — prefer deriving path from **`abbreviation`** inside `TeamLogo` for static asset approach)

4. **Performance & Next.js image discipline**

   **Given** **NFR1–NFR3** and Next **16.x** (`package.json`)

   **When** logos load on the picks page

   **Then** **`next/image`** is used with **explicit width/height** (or **`fill`** inside a sized box **only if** justified) matching the size variant, with **`sizes`** appropriate for card layout breakpoints

   **And** remote patterns: if URLs are remote, **`next.config.*`** declares **`images.remotePatterns`** (or **`domains`** legacy) — **no** brittle unconfigured hotlinking that breaks prod build

   **And** failures **do not** throw — **silent fallback** to **abbreviation + colored circle** (current `Avatar` implementation) maintains UX continuity per **UX § TeamLogo roadmap**

5. **Security / client bundle**

   **Given** `docs/project-context.md` non-negotiable **#1**

   **Then** **no logo API keys** or secret URLs leak to **`NEXT_PUBLIC_*`** or client-only env

   **And** any server-only fetching of signed URLs stays in **Route Handlers** or **Server Components** — **`TeamLogo` is `'use client'`** today (`src/components/picks/TeamLogo.tsx`); prefer **stable public URLs** or **paths under `/`** for MVP simplicity

6. **Tests**

   **Given** deterministic mapping from **`abbreviation`** → asset path or static import

   **When** **`npm test`** runs

   **Then** **at least one** pure helper test (new file **`src/components/picks/team-logo-src.test.ts`** or **`src/lib/nfl/**`**) covers **abbreviation normalization** edge cases (**trim, casing, unknown abbr fallback**)

   **And** tests **avoid live network**

7. **No regressions**

   **Given** Story **3.7** interactive picks flow

   **Then** changing `TeamLogo` **does not** break **`MatchupCard`**, **`WeekMatchupList`**, **`PickStatusBanner`**, **`JailedTeamCallout`**, **`PicksPreviewBanner`**, or RSC **`picks/page.tsx`**

   **And** **pick submission**, **keyboard radiogroup**, and **accessible labels** remain intact

---

## Tasks / Subtasks

- [x] **Write `docs/nfl-team-logos.md`** (AC: #1)
  - [x] Compare options: static **`public/`**, provider URLs from **The Odds API** (explicitly **out of scope** for logos per `docs/nfl-odds-integration.md` §70 — revisit only if spike finds permitted thumbnails), imagery APIs
  - [x] Record chosen path + compliance + fallback + maintenance

- [x] **Implement logo resolution helper** (AC: #1, #2, #6)
  - [x] Map `abbreviation` → **`/nfl-logos/<ABBR>.<ext>`** (or documented alternative)
  - [x] Co-locate **`*.test.ts`** for normalization + unknown abbreviation

- [x] **Refactor `src/components/picks/TeamLogo.tsx`** (AC: #2, #3, #4, #5, #7)
  - [x] Keep **MUI-first** styling; **`Stack`** only where it improves flex composition — current relative wrapper may stay **`Box`** for positioning overlays (matches project rule nuance / existing 3.7 pattern)
  - [x] **`next/image`** inside sized frame; **`onError`** → **`useState`** flip to abbreviation `Avatar` fallback (**AC #4**)
  - [x] **`sizePx`** updated to UX diameters (**24 / 32 / 40**) for `sm | md | lg` — verify `MatchupCard` / banners still meet **touch ≥ 44px** targets via **card padding / hit area**, not oversized logo glyphs (**NFR8** — logo may stay smaller inside a ≥44 row)

- [x] **`next.config` images** (AC: #4) — remotePatterns only if remote URLs chosen *(skipped — local static assets only)*

- [x] **`public/nfl-logos/`** asset set *(if static path chosen)* — 32 PNG/SVG icons for `nfl-teams.json` abbreviations — document source & license in `docs/nfl-team-logos.md`

- [x] **`npm test`**, **`npm run lint`**, **`npm run build`**

---

## Dev Notes

### Epic / PRD linkage

| Item | Coverage |
|------|----------|
| **FR14–FR18** | Richer matchup / status presentation |
| **NFR42** | `alt` / labels on logos |
| **NFR1–NFR4** | `next/image`, caching, bounded layout shifts |
| Story **3.9 / 3.10** | **Out of scope** — schedule sync and kickoff-weather upgrades are separate backlog items |

### Previous story intelligence (3.7)

- **`TeamLogo`** already supports **`jailed`**, **`disabled`**, **`pickedWeekTag`** overlays and filter stacks — extend **inside** this component rather than branching in every caller. [Source: `_bmad-output/implementation-artifacts/3-7-jailed-and-already-picked-ux-with-countdown-and-status.md` — File List / Completion Notes]
- **Touch targets**: `MatchupCard` ensured **≥ 44px** rows; resizing logos to UX **40px lg** must not shrink the interactive row — verify after change.
- **`PickStatusBanner`** / **`MatchupCard`** import **`TeamLogo`** from `./TeamLogo` — single upgrade point.

### Existing utilities — do not reinvent

| Need | Location |
|------|----------|
| Canonical abbreviations | `prisma/data/nfl-teams.json` |
| **`Team`** model | `prisma/schema.prisma` **`Team`** |
| Odds doc (explicit: logos **not** from current odds integration) | `docs/nfl-odds-integration.md` |
| UX sizing + roadmap | `_bmad-output/planning-artifacts/ux-design-specification.md` § **TeamLogo** |

### Architecture / stack compliance

- **Next.js 16**, **React 19** — use **`next/image`** stable import from **`next/image`** per current app
- **`docs/project-context.md`**: secrets server-only; **MUI Stack** for new flex wrappers where applicable
- Prefer **local static** logos for MVP **predictability + zero runtime key** unless discovery proves a **clearly compliant** CDN with stable URLs

### File structure expectations

```
docs/nfl-team-logos.md                 # NEW — decision record
public/nfl-logos/*.svg|png             # NEW — if static approach
src/components/picks/TeamLogo.tsx       # MODIFY
next.config.ts | next.config.mjs        # MODIFY if remotePatterns needed
```

### Testing expectations

- **Vitest** colocated **`*.test.ts`** for pure **`resolveNflLogoSrc({ abbreviation })`** (or equivalent)
- **No** screenshot tests required unless already project norm

---

## Developer context (guardrails)

1. **Do not** rip out **`Avatar`** — it becomes **fallback** on error/missing asset.
2. **Do not** add **`NEXT_PUBLIC_`** secrets for logos.
3. **Do not** fork **`MatchupCard`** into a duplicate component — **`TeamLogo`** is the abstraction boundary.
4. **Do** reconcile **pixel sizes** with **UX § TeamLogo**; document residual variance in **`docs/nfl-team-logos.md`** if product keeps larger glyphs.
5. **Do** confirm **abbreviation casing** (`BUF` vs `buf`) matches **DB `teams.abbreviation`** seed (**uppercase** in JSON).

---

## Git intelligence summary

Recent commits center on **Epic 3 picks UI** (`feat(picks): Story 3.7…`, Story 3-6 matchup list, deadlines, pick API). **Pattern:** iterative extension of **`src/components/picks/*`** + **`build-league-picks-week-view`**; **Story 3.8** stays **presentation-layer** (**`TeamLogo` + docs + assets**), no Prisma migrations unless discovery explicitly stores URLs (defer — prefer filesystem mapping).

---

## Latest technical specifics (pinned at story time)

| Tech | Notes |
|------|-------|
| **Next.js** | `16.2.2` — use **`next/image`**; configure **`remotePatterns`** for any external logo host |
| **React** | `19.2.4` — client `TeamLogo` can use **`useState`** for error fallback |

Re-verify **`next/image` remote config** API against Next 16 docs if using dynamic remote hosts.

---

## Project context reference

- [Source: `docs/project-context.md` — Non-negotiables **#1** (secrets / no `NEXT_PUBLIC` for keys), **MUI Stack**, **`npm test`** for pure helpers]

---

## Open questions / product clarifications *(non-blocking)*

1. **Attribution/branding footer** — if vendor requires attribution on every logo instance vs once in `/rules` footer — decide during discovery and codify in `docs/nfl-team-logos.md`.
2. **Dark mode tint** — if static PNGs assume white backgrounds, evaluate **transparent SVG** preference.

---

## Dev Agent Record

### Agent Model Used

Cursor Agent (composer)

### Debug Log References

—

### Completion Notes List

- Chose **static** `public/nfl-logos/<ABBR>.png` for all 32 seed teams; **`resolveNflLogoSrc`** derives paths from **`prisma/data/nfl-teams.json`** — unknown or empty abbreviations resolve to **`null`** and **`TeamLogo`** uses the abbreviation **`Avatar`** without requesting a bogus asset.
- **`TeamLogo`** uses **`next/image`** with **`width`/`height`/`sizes`**, circular clip, **`onError`** → fallback; **`disabled`/`jailed`** filters apply to both image and **`Avatar`**; overlays unchanged. **`LogoMark`** is **keyed** so load-error state resets when the team (`abbr` / src) changes (avoids **`setState` in `useEffect`** per **`react-hooks/set-state-in-effect`**).
- **`DeadlineCountdown`**: removed redundant **`setNow`** when the deadline already passed; fixed **`setTimeout`** handle typing (**`number | undefined`**) so **`next build`** typecheck passes alongside DOM typings.

### File List

- `docs/nfl-team-logos.md` *(new)*
- `public/nfl-logos/*.png` *(32 assets)*
- `src/lib/nfl/resolve-nfl-logo-src.ts` *(new)*
- `src/lib/nfl/resolve-nfl-logo-src.test.ts` *(new)*
- `src/components/picks/TeamLogo.tsx`
- `src/components/picks/DeadlineCountdown.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

---

### Review Findings

#### 2026-05-10 — BMAD code review

- [x] [Review][Patch] AC6 test title claims full seed coverage but only asserts two abbreviations — loop `nflTeams` (or rename the test to a spot-check) in `resolve-nfl-logo-src.test.ts` [src/lib/nfl/resolve-nfl-logo-src.test.ts:25-28]

- [x] [Review][Defer] `resolveNflLogoSrc` imports full `nfl-teams.json`, which ships to the client via `TeamLogo` — payload is small (~32 teams); optional follow-up: codegen or static abbreviation Set only [src/lib/nfl/resolve-nfl-logo-src.ts:1-6] — deferred, acceptable MVP tradeoff

---

## Story completion status

- **Ultimate context engine analysis completed** — comprehensive developer guide created.
- Implementation complete; **`npm test`**, **`npm run lint`**, **`npm run build`** green (**177** tests).
- Status: **done** (code review complete; patch applied **2026-05-10**).
