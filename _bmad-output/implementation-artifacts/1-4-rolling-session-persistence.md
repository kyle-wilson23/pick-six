# Story 1.4: Rolling session persistence

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a returning participant,
I want to stay logged in across weeks when I keep using the app,
so that Tuesday email → app flows feel frictionless.

## Acceptance Criteria

1. **Given** a logged-in user with a valid Auth.js session  
   **When** they use the app within the configured **rolling activity window** aligned to UX (**~30-day** policy)  
   **Then** they are not prompted to log in unnecessarily (**FR10**).

2. **Given** the Auth.js **JWT** session configuration in `src/lib/auth.ts`  
   **When** the implementation is finalized for this story  
   **Then** **`maxAge`** and **`updateAge`** are set to values that match the **rolling ~30-day** UX intent and are **documented in code** (named constants or block comment with **exact second values** and plain-English meaning).

3. **Given** UX specifies **rolling 30-day activity-based timeout** (session extends with activity; **30+ consecutive days** of no valid session use requires re-auth)  
   **When** a developer reads `src/lib/auth.ts` and this story  
   **Then** they can explain how **`maxAge`** + **`updateAge`** map to that behavior per **current Auth.js** JWT semantics (cite Auth.js docs in Dev Notes).

4. **Given** Story 1.3 established **Credentials + JWT strategy** (Prisma `Session` rows unused until another provider ships)  
   **When** this story is complete  
   **Then** rolling persistence **does not** switch to database sessions or new providers unless explicitly out of scope (remain JWT; no scope creep).

5. **Verification:** **Given** a test account  
   **When** the dev follows the **manual verification** steps in Tasks (or adds automated coverage if a test framework exists)  
   **Then** **active use** keeps the user signed in across the **expected** window, and **stale** sessions eventually require login (see Tasks for concrete steps—may use short-lived **dev-only** overrides **only** behind `NODE_ENV === "development"` if needed for faster feedback, with **production values** unchanged).

## Tasks / Subtasks

- [x] **Align constants with UX** — Confirm **`maxAge`** (absolute cap, typically **30 days** in seconds) and **`updateAge`** (how often the JWT/session may refresh when the user is active—Auth.js uses this to throttle refreshes; e.g. **24 hours** is acceptable for week-over-week NFL use). Extract to **named constants** at top of `src/lib/auth.ts` or adjacent `session-constants.ts` if cleaner.
- [x] **Document semantics** — Comment block: link **FR10**; UX `_bmad-output/planning-artifacts/ux-design-specification.md` — **Session Management** (~lines 164–166) and **Section 6 — Rolling Activity-Based Sessions** (~lines 321–323); **Auth.js** JWT `session` — cite **`maxAge` / `updateAge`** from [Auth.js `AuthConfig.session`](https://authjs.dev/reference/core#session-2). State explicitly: inactive **30+ days** → re-login; engaged users **week-to-week** stay signed in.
- [x] **Avoid regressions** — Do **not** weaken **httpOnly** / **secure** cookie behavior from 1.3; do not log session tokens; no client-side session secrets.
- [x] **`.env.example`** — If any **optional** env tunables are introduced (e.g. session max age for non-production only), document; **otherwise** add a one-line note that session length is **code-configured** per UX (avoid unnecessary env surface).
- [x] **Manual QA checklist** (minimum): (1) Log in → navigate → confirm `auth()` still returns user after refresh. (2) Document how to simulate “stale” session if needed (wait for `maxAge` or dev-only shortened values **only in dev**). (3) Confirm logout still clears session (**FR11** unchanged).
- [x] **Build / lint:** `npm run build` and `npm run lint` pass.

## Dev Notes

### Epic context

- **Epic 1** — Story **1.4** completes **session persistence** for **FR10** after **1.3** login/logout. Next: **1.5** invitations, **1.6** protected routes + CSRF baseline.
- **Depends on:** Story **1.3** (`src/lib/auth.ts`, JWT session, cookies, rate limit).

### Technical requirements

| Area | Requirement |
|------|---------------|
| Product | **FR10** — extended sessions; align with UX rolling **30-day** behavior. |
| UX | **Rolling 30-Day Activity-Based Timeout** — `_bmad-output/planning-artifacts/ux-design-specification.md`: **Session Management** (~lines 164–166); **Section 6 — Rolling Activity-Based Sessions** (~lines 321–323) |
| Auth | **Auth.js v5** JWT sessions — `session.maxAge`, `session.updateAge` — [Auth.js `AuthConfig.session`](https://authjs.dev/reference/core#session-2); [Source: `architecture.md` — Authentication & security] |
| Security | **NFR11** HTTP-only cookies unchanged; no credentials in logs (**NFR13**). |

### Architecture compliance

- **Single config surface:** `src/lib/auth.ts` (same as 1.3); optional small `src/lib/session-constants.ts` if constants need importing elsewhere (prefer **not** spreading config).
- **Email → app:** Tuesday reminder links should target the **same origin** as the deployed app so the **httpOnly** session cookie is sent on navigation. Cross-subdomain or cross-origin links need cookie / `NEXTAUTH_URL` alignment (hosting, often **1.6**); not a 1.4 change unless product explicitly spans origins.
- **No second Prisma client**; session strategy remains **JWT** until product adds OAuth/magic link with database sessions.

### Library & framework requirements

| Package | Notes |
|---------|--------|
| `next-auth@5.0.0-beta.30` | JWT `session` — verify **`maxAge`** / **`updateAge`** against [Auth.js `AuthConfig.session`](https://authjs.dev/reference/core#session-2) for the pinned package; cross-check **`@auth/core`** `session.ts` (JWT branch uses **`maxAge`** for re-issue; **`updateAge`** applies to **database** sessions). |
| Vitest | `npm test` — colocated tests for `session-constants` and auth wiring (see File List). |

### File structure requirements

```
src/lib/auth.ts              # session.maxAge / session.updateAge + documentation
src/lib/session-constants.ts # optional — only if constants are shared
.env.example                 # optional note on session configuration
```

### Testing requirements

- **Manual:** Required for MVP — documented steps in Tasks.
- **Automated:** Vitest — `src/lib/session-constants.test.ts` (helpers + `auth.ts` wiring guard).

### Previous story intelligence (1.3)

- **`src/lib/auth.ts`** already sets `maxAge: 30 * 24 * 60 * 60` and `updateAge: 24 * 60 * 60` with a comment deferring **Story 1.4** — this story **finalizes**, **names**, and **documents** those values; adjust only if Auth.js semantics or UX require different numbers.
- **JWT + Credentials** — `strategy: "jwt"` is mandatory for Credentials-only; Prisma adapter tables exist for future providers.
- **Completion notes** from 1.3: rate limit in `src/proxy.ts`; `normalizeEmail` in authorize path.

### Git intelligence

- Recent work: **“Initial user auth completed”** — auth module, login page, `proxy.ts`, seed, Prisma adapter migration.

### Latest tech information

- **Primary reference (copy-paste):** [https://authjs.dev/reference/core#session-2](https://authjs.dev/reference/core#session-2) — `AuthConfig.session` (`maxAge`, `updateAge`). Confirm semantics for JWT strategy on the version pinned in `package.json`; do not rely on NextAuth v4-only blog posts.
- If docs differ between minor betas, prefer **installed** `node_modules/next-auth` types plus the official page above.

### Project context reference

- `docs/project-context.md` — secrets server-only, one Prisma client.
- `_bmad-output/planning-artifacts/epics.md` — Story 1.4 ACs.
- `_bmad-output/planning-artifacts/architecture.md` — `maxAge` / `updateAge` wording.

### Story completion status

- **done** — Code review follow-up: JWT vs database `updateAge` semantics documented in `session-constants.ts`; story record and sprint status synced.

## Dev Agent Record

### Agent Model Used

_(Cursor Composer — dev-story workflow)_

### Debug Log References

### Completion Notes List

- Added `src/lib/session-constants.ts` with named constants (seconds + exact values): `SESSION_MAX_AGE_SECONDS` = 2,592,000 (30 days), `SESSION_UPDATE_AGE_SECONDS` = 86,400 (24 hours); `getSessionMaxAgeSeconds()` applies optional dev-only `SESSION_MAX_AGE_DEV_SECONDS` (see `.env.example`) for stale-session testing.
- **`maxAge`** / **`updateAge`** documented per [Auth.js `AuthConfig.session`](https://authjs.dev/reference/core#session-2) and aligned with FR10 UX rolling ~30-day behavior; JWT strategy unchanged (no database sessions). **Code review:** Comments now match **`@auth/core`** — JWT session handling re-issues with `maxAge`; **`updateAge`** is for **database** sessions (JWT branch does not read it); we keep `updateAge` for defaults/parity.
- **Manual QA:** (1) Log in, navigate, refresh — confirm session persists. (2) Stale session: wait beyond `maxAge`, or set `SESSION_MAX_AGE_DEV_SECONDS` in `.env.local` (dev only) to a small value, restart dev server, wait, then confirm re-login required. (3) Logout — confirm session cleared (FR11 unchanged).
- **Automated tests:** Vitest — `npm test`; `session-constants.test.ts` covers `getSessionMaxAgeSeconds` and asserts `auth.ts` imports `getSessionMaxAgeSeconds` / `SESSION_UPDATE_AGE_SECONDS`. Also run `npm run lint` and `npm run build`.

### File List

- `src/lib/session-constants.ts` (new)
- `src/lib/session-constants.test.ts` (new)
- `src/lib/auth.ts` (modified)
- `.env.example` (modified)
- `vitest.config.ts` (new)
- `package.json` / `package-lock.json` (Vitest scripts + devDependency)
- `README.md` / `docs/project-context.md` (test commands)
- `.cursor/rules/post-change-testing.mdc` (post-change test nudge)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

### Change Log

- 2026-04-05 — Story 1.4: rolling JWT session constants, documentation, optional dev `SESSION_MAX_AGE_DEV_SECONDS`, sprint status → review.
- 2026-04-05 — Code review: JWT vs DB `updateAge` semantics in `session-constants.ts`; Vitest wiring test; story + sprint → **done**.
