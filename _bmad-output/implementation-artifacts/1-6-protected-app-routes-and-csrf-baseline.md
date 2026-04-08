# Story 1.6: Protected app routes and CSRF baseline

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want authenticated routes protected from anonymous access,
so that league data stays private.

## Acceptance Criteria

1. **Given** a **route group** (e.g. Next.js `(app)` or `(protected)`) with **middleware or layout guards** as described in epics  
   **When** an **unauthenticated** user requests a **protected** page  
   **Then** they are **redirected** to `/login` with a **return URL** (`callbackUrl` or equivalent) where appropriate (**safe, same-origin only** — no open redirects).

2. **Given** a **signed-in** user  
   **When** they open a protected route with a valid session  
   **Then** the page loads without an auth redirect.

3. **Given** **public** flows must remain reachable without logging in  
   **When** users hit the **root marketing/shell** page, **login**, **signup** (including `/signup/[token]`), and **Auth.js** routes  
   **Then** those routes are **not** blocked by the new guard (explicit allowlist or route-group placement).

4. **Given** **NFR15** (CSRF on state-changing operations)  
   **When** the app performs **cookie-session-backed** mutations (Server Actions, Route Handlers, or Auth.js auth routes)  
   **Then** document and apply a **consistent baseline**: e.g. Auth.js’s built-in CSRF for Auth routes; Next.js Server Actions built-in protection where used; for **custom** `POST`/`PUT`/`PATCH`/`DELETE` Route Handlers, validate **Origin/Referer** same-site policy and/or Auth.js **CSRF token** (`GET /api/auth/csrf`) — **pick one documented pattern** and apply to any **new** custom mutating handlers added in this story.

5. **Given** existing **rate limiting** in `src/proxy.ts` for credential and signup POST paths  
   **When** implementing redirects or new matchers  
   **Then** **do not** remove or weaken **NFR12** behavior; extend `matcher` if new sensitive POST paths are introduced.

## Tasks / Subtasks

- [x] **Route model** — Introduce a **route group** (name aligns with epics: e.g. `src/app/(app)/…`) containing at least **one** authenticated page (e.g. `/dashboard` or `/app` shell) that will later host league UI; **keep `/`, `/login`, `/signup/**` public** unless product explicitly says otherwise.
- [x] **Layout or proxy guard** — Implement **one** clear strategy (prefer **async server `layout.tsx`** in the route group calling `auth()` from `@/lib/auth`, redirecting to `/login?callbackUrl=…` when unauthenticated) **or** extend **`src/proxy.ts`** with a matcher for protected prefixes — **epics allow either**; do not duplicate conflicting guards.
- [x] **callbackUrl safety** — Validate `callbackUrl` (path-only or same-origin) before redirect after login; document the helper if added under `src/lib/`.
- [x] **Login integration** — Ensure `login` page (or Auth.js `signIn` redirect) **consumes** `callbackUrl` where already supported; adjust minimally if needed.
- [x] **CSRF baseline** — Add a short **in-repo** note (code comment + optional `docs/` pointer only if needed) describing CSRF expectations for: Auth.js routes, Server Actions, custom Route Handlers; implement concrete checks for **any new** custom mutating API added in this story.
- [x] **Tests** — Prefer **pure helpers** (e.g. `callbackUrl` validation) with **Vitest** colocated per `.cursor/rules/post-change-testing.mdc`; optional lightweight tests for auth redirect behavior if practical without over-mocking Next.
- [x] **Regression** — `npm run build`, `npm run lint`, `npm test`; manual: anonymous → protected URL → login → lands back on protected page with session.

## Change Log

- 2026-04-07: Implemented `(app)` shell with `/dashboard`, `auth()` layout guard + `callbackUrl` validation (`getSafeCallbackPath`), proxy `x-pathname` + extended matcher (NFR12 preserved), CSRF baseline module `assertSameOriginMutation`, Vitest coverage; status → **review**.
- 2026-04-07: BMAD **code-review** completed — **Changes requested**; status → **in-progress**; see **Senior Developer Review (AI)**.
- 2026-04-07: Code-review **auto-fixes** applied (`auth` wrapped with `cache`, `assertCookieSessionMutationOrigin` + CSRF negative tests, proxy/layout docs for `x-pathname`/`matcher`, login default `/dashboard`, story status → **done**).

## Dev Notes

### Epic context

- **Epic 1** closes with **1.6**: **FR** alignment is **privacy of authenticated surfaces**; **NFR15** CSRF baseline for mutations.
- **Depends on:** **1.3–1.5** — Auth.js, JWT session, login/logout, invite signup (`src/lib/auth.ts`, `src/proxy.ts`, signup route).
- **Downstream:** **Epic 2+** will place real league pages inside the protected shell—**do not** paint the filesystem into a corner; route group should scale.

### Technical requirements

| Area | Requirement |
|------|-------------|
| Product | Authenticated-only areas for future league data; public marketing/auth/signup paths stay open. |
| Security | **NFR15** CSRF baseline; **NFR9–NFR11** session cookies unchanged; **NFR12** rate limits preserved in `src/proxy.ts`. |
| Auth | Use **`auth()`** from `@/lib/auth` in Server Components / layouts; JWT session strategy remains (**Story 1.4**). |
| Next.js | **Next 16.2** App Router; project uses **`src/proxy.ts`** (not `middleware.ts`) per [Source: `_bmad-output/planning-artifacts/architecture.md` — Authentication & security]. |

### Architecture compliance

- **Thin proxy / fat server layouts** — Architecture positions **`src/proxy.ts`** for boundary concerns (rate limits, optional redirects); heavy session + DB access may live in **layouts** or route handlers to avoid Edge/runtime confusion [Source: `architecture.md`, `docs/project-context.md`].
- **Consistent errors** — If a guarded API returns JSON errors, use `{ "error": { "code", "message" } }` [Source: `docs/project-context.md`].
- **MUI** — Use **`Stack`** for flex layouts in any new UI [Source: user rules].

### Library & framework requirements

| Package | Version (pinned in repo) | Notes |
|---------|-------------------------|-------|
| `next` | `16.2.2` | `src/proxy.ts` convention; verify **matcher** still fires after edits (`next build` / runtime smoke). |
| `next-auth` | `^5.0.0-beta.30` | `auth()`, `signIn`, CSRF token endpoint via Auth.js for non-Action POST patterns if needed. |
| `vitest` | `^3.2.4` | Colocated tests for pure validation helpers. |

### File structure requirements

```
src/proxy.ts                          # extend matcher / redirect logic only if this is the chosen guard layer
src/app/(app)/layout.tsx              # example: server layout with auth() + redirect (route group name may vary; keep epics intent)
src/app/(app)/dashboard/page.tsx      # example protected landing (URL path without parens)
src/app/login/page.tsx                # ensure callbackUrl handling aligns with guard redirects
src/lib/auth.ts                       # no breaking changes to session strategy without story scope
```

Adjust paths if the team prefers `(protected)` instead of `(app)` — **document the final choice** in the layout file header comment.

### Testing requirements

- **Vitest** — Unit-test **callback URL** normalization/validation and any new pure CSRF helper.
- **Manual** — Unauthenticated access to protected URL; authenticated happy path; signup and login still work; rate limit still returns 429 when abused.

### Previous story intelligence (1.5)

**Artifact:** `_bmad-output/implementation-artifacts/1-5-invitation-tokens-and-signup-via-invite-link.md`.

- **Signup** is a **public** POST to `/api/signup/invite` — must stay out of the “must be logged in” matcher.
- **`src/proxy.ts`** already rate-limits `/api/auth/callback/credentials` and `/api/signup/invite` — preserve when expanding matchers.
- **1.5** noted CSRF alignment with login; **1.6** formalizes the **baseline** for future Route Handlers.

### Git intelligence

- Recent work: **invitation auth flow**, **session persistence**, **initial auth** — follow the same **ESLint**, **file placement**, and **Vitest** colocation patterns.

### Latest tech information

- **Next.js 16** — `proxy.ts` replaces deprecated `middleware.ts` naming; export name **`proxy`**, **`config.matcher`** as today [Source: Next.js 16 release notes / upgrade guide].
- **Auth.js v5** — Session via **`auth()`** in RSC; for middleware-style filters prefer **official** `auth` wrapper patterns only if using Edge middleware; this repo standardizes on **`src/proxy.ts`** + server layouts per architecture.

### Project context reference

- `docs/project-context.md` — server-only secrets, one Prisma client, server-authoritative rules later.
- `_bmad-output/planning-artifacts/epics.md` — Story **1.6** (Epic 1).

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

_(none)_

### Completion Notes List

- Added **`src/app/(app)/`** route group with server **`layout.tsx`** calling **`auth()`**; unauthenticated users redirect to **`/login?callbackUrl=…`** built via **`buildLoginRedirectWithCallback`**, which validates the path through **`getSafeCallbackPath`** (no open redirects; `/login` loops avoided).
- Extended **`src/proxy.ts`** matcher for **`/dashboard`** routes so the proxy runs and sets **`x-pathname`** for the layout; **POST** rate limiting for **`/api/auth/callback/credentials`** and **`/api/signup/invite`** unchanged (NFR12).
- Split login into **`login-client.tsx`** (reads **`callbackUrl`**) and **`page.tsx`** with **`Suspense`** for **`useSearchParams`**.
- CSRF baseline: **`src/lib/cookie-session-mutation-csrf.ts`** documents Auth.js / Server Actions / custom handlers and exports **`assertCookieSessionMutationOrigin`** for future custom mutating Route Handlers (no new mutating API in this story).
- Home page links signed-in users to **`/dashboard`** for manual verification.

### File List

- `src/lib/callback-url.ts` (new)
- `src/lib/callback-url.test.ts` (new)
- `src/lib/cookie-session-mutation-csrf.ts` (new)
- `src/lib/cookie-session-mutation-csrf.test.ts` (new)
- `src/proxy.ts` (modified)
- `src/app/(app)/layout.tsx` (new)
- `src/app/(app)/dashboard/page.tsx` (new)
- `src/app/login/login-client.tsx` (new)
- `src/app/login/page.tsx` (modified)
- `src/app/page.tsx` (modified)
- `src/components/auth/dashboard-link-button.tsx` (new)
- `.cursor/rules/next-rsc-client-boundaries.mdc` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/1-6-protected-app-routes-and-csrf-baseline.md` (modified)

## Senior Developer Review (AI)

**Reviewer:** Kyle (BMAD code-review workflow)  
**Date:** 2026-04-07  
**Outcome:** Changes requested → **resolved** (auto-fix 2026-04-07; see **Resolution (auto-fix)** below).

### Checklist (workflow)

- Story was reviewable; sprint story key `1-6-protected-app-routes-and-csrf-baseline` located.
- Architecture/epic context: `epics.md` available; selective epic shard not required for this pass.
- Acceptance criteria: verified against implementation for **current** scope (`/dashboard` under `(app)`).
- `npm test` executed: all 28 tests passed.

### Git vs File List

| Issue | Severity |
|-------|----------|
| `src/components/auth/dashboard-link-button.tsx` is part of the change set but **missing** from Dev Agent Record → File List | MEDIUM |
| `.cursor/rules/next-rsc-client-boundaries.mdc` is part of the change set but **missing** from File List | MEDIUM |

### Findings

1. **[MEDIUM] Callback URL + proxy coupling:** `(app)/layout.tsx` reads `x-pathname` set in `src/proxy.ts`, but the matcher only includes `/dashboard` and `/dashboard/:path*`. Any future authenticated page under `(app)` at another path will **not** get `x-pathname` unless the matcher is extended; the layout falls back to `/dashboard`, so post-login redirect can be **wrong**. Document this in the layout or proxy (or centralize a single “protected path” prefix list).
2. **[MEDIUM] CSRF test gaps:** `cookie-session-mutation-csrf.test.ts` covers happy paths only. Missing assertions for 403 cases: POST with no `Origin`/`Referer`/`Sec-Fetch-Site`, malformed `Referer`, and `Sec-Fetch-Site: cross-site` (or absent when required).
3. **[MEDIUM] Naming vs behavior:** `assertSameOriginMutation` accepts `Sec-Fetch-Site: same-site`, which is **not** same-origin. Either rename (e.g. `assertSameSiteMutation`) or tighten policy and document the threat model for custom handlers.
4. **[LOW] Redundant `auth()`:** `src/app/(app)/dashboard/page.tsx` calls `auth()` again after the parent layout already enforced the session—minor extra work; acceptable or pass session down later.
5. **[LOW] Post-login default:** `LoginClient` uses `defaultPath: "/"` when `callbackUrl` is absent; story manual regression emphasizes return to protected URL—confirm product wants home vs dashboard as default after direct `/login` visits.

### Acceptance criteria (spot-check)

| AC | Result |
|----|--------|
| 1–2 Protected redirect + signed-in access | Met for `/dashboard` with safe `callbackUrl` handling |
| 3 Public routes not blocked | Matcher does not cover marketing/login/signup/api broadly |
| 4 CSRF baseline documented + helper for custom handlers | Met (`cookie-session-mutation-csrf.ts`) |
| 5 NFR12 preserved | Rate-limited POST paths unchanged |

### Next steps (workflow)

Choose how to handle findings: **(1)** auto-fix in code/tests, **(2)** add unchecked tasks under Tasks/Subtasks with `[AI-Review]` tags, or **(3)** deep-dive on specific items. After fixes, re-run review or mark done when File List and tests are updated.

### Resolution (auto-fix)

- **File List / git:** File List updated to include `dashboard-link-button` and `next-rsc-client-boundaries.mdc`.
- **`x-pathname` / matcher:** Documented in `src/proxy.ts` (above `proxy`) and `src/app/(app)/layout.tsx` file header.
- **CSRF:** Renamed export to **`assertCookieSessionMutationOrigin`** with JSDoc on `Origin` / `Referer` / `Sec-Fetch-Site` (including `same-site` threat note); expanded Vitest with 403 paths (foreign referer, bad referer, `cross-site`, empty headers, JSON body assertions).
- **`auth()` dedupe:** `auth` in `src/lib/auth.ts` wrapped with React **`cache()`** so layout + page share one session resolution per request.
- **Login default:** `login-client.tsx` uses **`defaultPath: "/dashboard"`** when `callbackUrl` is absent.
