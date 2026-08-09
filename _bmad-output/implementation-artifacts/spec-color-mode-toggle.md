---
title: 'Color mode toggle (dark / light)'
type: 'feature'
created: '2026-08-09'
status: 'done'
baseline_commit: 'a776546dd36795342f71f0195c2b62a867a83476'
context:
  - '{project-root}/docs/project-context.md'
  - '{project-root}/src/theme/create-app-theme.ts'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The app is permanently dark (`palette.mode: "dark"`). Users need a light mode with white backgrounds and readable contrast, plus a way to keep that choice across sessions.

**Approach:** Add an app-wide dark/light color mode (default dark). Toggle on Profile (persisted on the user) and on Login (guest cookie for unauthenticated auth screens). On successful sign-in, the guest choice write-through overwrites the account preference.

## Boundaries & Constraints

**Always:**
- Default color mode is **dark** for first-time / unset users.
- Light mode uses **white / near-white page backgrounds** and theme tokens so text, borders, chips, links, and status colors remain readable across authenticated and auth pages.
- Authenticated preference persists across logout/login (DB).
- Guest preference persists across `/login`, `/forgot-password`, `/create-account` (and sibling auth routes the user can reach unauthenticated) without requiring login.
- After credentials `signIn` succeeds, guest preference **writes through** to the account (overwrites saved preference), then navigation proceeds.
- Prefer palette / theme tokens over hardcoded hex in UI; extend `createAppTheme` for both modes.
- Follow existing profile API patterns (Zod, CSRF cookie-session mutation, JSON error shape).

**Ask First:**
- Adding a third mode (e.g. system/OS preference).
- Changing email HTML templates to follow color mode.
- Renaming or relocating the Profile/Login toggle UX in a major way.

**Never:**
- Do not leave light mode with dark-only hardcoded backgrounds that ignore the theme.
- Do not require auth to preview light mode on login/forgot/create-account.
- Do not invent a paid theming vendor or second styling system (Tailwind theme parallel to MUI).
- Do not persist guest preference as the only store for logged-in users (DB is source of truth after auth + write-through).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Default | No cookie, no DB value | App renders dark | N/A |
| Guest toggle | User toggles light on `/login` | Cookie set; `/forgot-password` and `/create-account` render light | N/A |
| Profile save | Authed user toggles and saves/applies | DB updated; UI switches; survives logout/login | Zod/CSRF/401 → existing error shape; UI keeps prior mode on failed save |
| Login write-through | Guest light + account was dark | After `signIn` ok, account becomes light before navigate | If preference sync fails after auth, still complete login; retry via Profile; do not block sign-in |
| Login write-through (dark) | Guest dark + account was light | Account becomes dark | Same as above |
| Invalid API body | `colorMode` not `dark`\|`light` | 400 validation error | No DB write |

</frozen-after-approval>

## Code Map

- `src/theme/create-app-theme.ts` -- dark-only `createTheme`; extend for `mode: "light" | "dark"`
- `src/theme/mui-augmentation.d.ts` -- custom palette keys (`background.elevated`, `accent.*`)
- `src/components/app-providers.tsx` -- `ThemeProvider` + `CssBaseline`; wire mode from cookie/session
- `src/app/layout.tsx` -- root providers / font; optional FOUC attribute on `<html>`
- `src/app/(app)/profile/profile-client.tsx` -- profile form; add color-mode toggle UI
- `src/app/(app)/profile/page.tsx` -- server page props for profile
- `src/app/api/profile/route.ts` -- `PATCH` profile; extend or add colocated color-mode endpoint
- `src/lib/profile.ts` -- Zod schemas for profile body
- `prisma/schema.prisma` -- `User` model; add `colorMode` (or equivalent) + migration
- `src/lib/auth.ts` / `src/types/next-auth.d.ts` -- optional session mirror of preference
- `src/app/login/login-client.tsx` -- guest toggle + write-through after `signIn`
- `src/app/forgot-password/` / `src/app/create-account/` -- consume shared guest mode (cookie); no separate persist required
- `src/app/signup/[token]/` / `src/app/reset-password/[token]/` -- same guest cookie if rendered unauthenticated
- `.gitignore` -- already ignores `PRIORITIES.md`; include with finishing commit

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma` (+ migration) -- add `User.colorMode` enum/string (`dark` \| `light`), default `dark` -- durable authed preference
- [x] `src/theme/create-app-theme.ts` (+ light palette tokens / contrast) -- `createAppTheme(fontFamily, mode)` with light white backgrounds and readable primary/accent/text -- theme source of truth
- [x] `src/lib/color-mode.ts` (or equivalent) -- cookie name, read/write helpers, Zod enum shared by API/UI -- single contract for guest + API
- [x] `src/components/app-providers.tsx` (+ small ColorModeToggle / context as needed) -- apply mode from cookie; when session has preference, prefer DB/session after auth (post write-through) -- app-wide switch
- [x] `src/app/api/profile/color-mode/route.ts` + `src/lib/color-mode.ts` -- dedicated PATCH with CSRF/Zod; update User + Set-Cookie -- authed persistence
- [x] `src/app/(app)/profile/profile-client.tsx` -- accessible toggle (default dark); persist via profile API; update session/cookie -- primary settings UX
- [x] `src/app/login/login-client.tsx` -- surface guest toggle; after successful `signIn`, write-through guest → API/DB then navigate -- guest UX + merge rule B
- [x] Auth sibling clients as needed (`forgot-password`, `create-account`, invite signup, reset-password) -- ensure they inherit guest cookie via providers (add toggle only if login-only placement leaves them stranded without a way to change mode; at minimum they must **respect** the cookie) -- navigation persistence
- [x] `src/lib/color-mode*.test.ts` (colocated) -- unit-test matrix cases (default, parse, write-through payload validation) -- lock edge cases
- [x] Spot-fix light mode on picks, standings, admin, profile, login for contrast regressions; fix token/overrides found -- contrast mandate

**Acceptance Criteria:**
- Given a brand-new visitor, when they open `/login`, then the UI is dark.
- Given a visitor toggles light on `/login`, when they navigate to `/forgot-password` or `/create-account`, then those pages stay light without signing in.
- Given an authenticated user sets light on Profile and logs out/in, when the app loads, then light mode is restored from the account.
- Given guest light and an account previously dark, when login succeeds, then the account preference becomes light and the app continues in light.
- Given light mode, when browsing core app pages, then backgrounds are white/near-white and text/controls remain readable (no dark-on-dark or white-on-white failures from theme tokens).
- Given an invalid `colorMode` PATCH, when the API runs, then it returns 400 and does not change stored preference.

## Spec Change Log

## Design Notes

**Guest store:** Prefer a first-party cookie (readable on the client for toggles; settable from API responses) so mode survives auth-route navigation and can align SSR/FOUC. localStorage alone is acceptable only as a mirror, not the sole guest store.

**Write-through:** After `signIn(..., { redirect: false })` succeeds, call the authenticated preference endpoint with the guest value before `window.location.assign`. Sign-in must not fail closed if that call errors.

**Light palette:** Keep emerald primary + gold accent; lighten surfaces (`background.default` ≈ white, paper/elevated slightly off-white). Recheck gold-on-white and alpha overlays on chips/cards.

**Toggle placement:** Profile = persistent setting control. Login = convenience guest control. Forgot/create-account need not duplicate the control if cookie + providers already apply mode; duplicating the control is fine if it improves discoverability.

## Verification

**Commands:**
- `npm test` -- expected: pass, including new color-mode unit tests
- `npx tsc --noEmit` (or project typecheck script if present) -- expected: clean for touched files

**Manual checks:**
- Toggle light on login → visit forgot-password + create-account → still light
- Save light on profile → logout → login → still light
- Guest light then login to a dark-saved account → ends light (write-through)
- Picks / standings / admin / profile readable in light mode
- Finishing commit includes `.gitignore` `PRIORITIES.md` ignore alongside feature changes (stay on `main`)

## Suggested Review Order

**Persistence contract**

- Cookie + Zod wire values shared by guest UI and authenticated API
  [`color-mode.ts:19`](../../src/lib/color-mode.ts#L19)

- Durable account preference defaults to dark
  [`schema.prisma:30`](../../prisma/schema.prisma#L30)

- Authed PATCH with CSRF, DB write, and Set-Cookie
  [`route.ts:21`](../../src/app/api/profile/color-mode/route.ts#L21)

**Theme application**

- Light palette: white surfaces, deeper emerald/gold for contrast
  [`create-app-theme.ts:31`](../../src/theme/create-app-theme.ts#L31)

- Mode-aware theme factory (dark default)
  [`create-app-theme.ts:58`](../../src/theme/create-app-theme.ts#L58)

- Cookie vs DB resolution for SSR (DB wins when signed in)
  [`layout.tsx:27`](../../src/app/layout.tsx#L27)

- Client context writes cookie and `color-scheme` immediately
  [`color-mode-context.tsx:25`](../../src/components/color-mode/color-mode-context.tsx#L25)

**UI + write-through**

- Shared accessible Light mode switch
  [`ColorModeToggle.tsx:15`](../../src/components/color-mode/ColorModeToggle.tsx#L15)

- Profile Appearance section persists via API with race guards
  [`profile-client.tsx:69`](../../src/app/(app)/profile/profile-client.tsx#L69)

- Login guest toggle + post-signIn write-through before navigate
  [`login-client.tsx:117`](../../src/app/login/login-client.tsx#L117)

- Fail-open sync helper so auth never blocks on preference save
  [`sync-color-mode.ts:7`](../../src/lib/sync-color-mode.ts#L7)

**Peripherals**

- Unit tests for parse, Prisma map, Zod, cookie header
  [`color-mode.test.ts:1`](../../src/lib/color-mode.test.ts#L1)
