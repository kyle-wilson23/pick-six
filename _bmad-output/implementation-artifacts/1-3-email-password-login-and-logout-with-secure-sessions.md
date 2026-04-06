# Story 1.3: Email/password login and logout with secure sessions

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to log in with email and password and log out,
so that my account stays protected while remaining convenient week to week.

## Acceptance Criteria

1. **Given** Auth.js is configured with a **Credentials** provider and the **Prisma adapter**  
   **When** a user submits **valid** credentials on the login page  
   **Then** an **HTTP-only**, **secure** session cookie is established in production (**NFR9**, **NFR11**)  
   **And** the session is carried in an Auth.js **signed JWT** inside that cookie (not in `localStorage`). With **Credentials as the only provider**, Auth.js requires `session.strategy: "jwt"`; Prisma `Session` rows are unused until a provider that supports database sessions is added—documented in `src/lib/auth.ts`. OAuth/email flows added later can persist sessions via the same adapter tables (**NFR11**).

2. **Given** a user with a **bcrypt**- or **argon2**-hashed password stored in `users.password_hash` (via `passwordHash` in Prisma)  
   **When** they log in  
   **Then** plaintext passwords are never persisted; hashing meets **NFR10**.

3. **Given** an authenticated session  
   **When** the user triggers **logout**  
   **Then** the session ends and the cookie is cleared (**FR11**).

4. **Given** repeated failed login attempts (same IP or same email—pick one documented strategy)  
   **When** the threshold is exceeded within a sliding window  
   **Then** further attempts are **rate-limited** with **429** or equivalent (**NFR12**).

5. **Given** any auth error or server log path  
   **When** logging runs  
   **Then** **passwords**, reset tokens, and raw **Authorization** headers are **never** logged (**NFR13**).

6. **Email normalization:** Lowercase and trim email **before** lookup and storage for credentials (align with Story 1.2 schema comment and avoid duplicate-account confusion).

7. **Dev ergonomics:** `.env.example` documents **AUTH_SECRET** (and **AUTH_URL** / **NEXTAUTH_URL** if required by your Auth.js version for absolute URLs in dev). Login page works against a real DB user (document minimal path: seed script, Prisma Studio insert, or one-time script—no production secrets).

## Tasks / Subtasks

- [x] Add **Auth.js** (Next.js App Router) dependencies compatible with **Next 16** + **React 19** — pin versions in `package.json`; follow [Auth.js — Getting Started (Next.js)](https://authjs.dev/getting-started/installation?framework=Next.js) for the **current** export pattern (`handlers`, `auth`, `signIn`, `signOut` from a central module).
- [x] Extend **Prisma schema** with **official Prisma adapter** models (`Account`, `Session`, `VerificationToken`, etc.) per [Auth.js Prisma adapter schema](https://authjs.dev/getting-started/adapters/prisma); **merge** with existing `User` (Story 1.2) — add relations, do **not** drop `passwordHash`; run a **new migration** (additive).
- [x] Implement **Credentials** `authorize` that: normalizes email, loads `User` by email, compares password with **bcrypt** or **argon2** against `passwordHash`, returns user object shape Auth expects (id, email, name, image).
- [x] Wire **session callback** / user mapping so `session.user.id` is available server-side for later stories (league membership, picks).
- [x] Add **route handler** for Auth.js at `src/app/api/auth/[...nextauth]/route.ts` (or current canonical path from docs) exporting **GET** and **POST** from `handlers`.
- [x] Add **`src/lib/auth.ts`** (or `src/auth.ts` per official layout) exporting `auth`, `signIn`, `signOut`, handlers config — matches architecture tree (`lib/auth.ts`).
- [x] Build **login page** (e.g. `src/app/login/page.tsx`) with **MUI** + **`Stack`** for layout: email, password, submit; surface **generic** error for bad credentials (no user enumeration).
- [x] Add **logout** control (button) that calls `signOut()` from the client-safe surface or server action — place on home or a minimal account strip; keep scope minimal (full nav shell can wait).
- [x] Implement **rate limiting** on credential sign-in attempts targeting **`/api/auth/*`** or the credentials action (document window + max attempts). Acceptable MVP: **Upstash Ratelimit**, **@edge-csrf**-adjacent middleware pattern, or a **documented** server-side store with in-memory fallback **only for local dev** (must not be single-instance-only in production without warning).
- [x] Verify **cookie flags**: `httpOnly`, `secure` in production, `sameSite` appropriate for same-site app; document `trustHost` / `AUTH_URL` for Vercel.
- [x] **No** `console.log` of request bodies or credentials on auth routes.
- [x] Run **`npm run build`** and **`npm run lint`**; fix new issues.

### Review Follow-ups (AI)

- [x] [AI-Review][MEDIUM] Mitigate **credential timing side-channel**: `authorize` always runs `bcrypt.compare` against `user.passwordHash` or a fixed **dummy** bcrypt hash so missing-user and wrong-password paths do not skip hashing. [`src/lib/auth.ts`]
- [x] [AI-Review][MEDIUM] **Next.js 16:** `middleware.ts` replaced with **`src/proxy.ts`** exporting `proxy` (same matcher/rate-limit logic; no deprecation warning on build).
- [ ] [AI-Review][LOW] **Rate-limit key `unknown`:** clients with no `x-forwarded-for` / `x-real-ip` share one bucket — can over-throttle shared local dev or behave oddly behind misconfigured proxies. Consider documenting or hashing a secondary signal. [`src/proxy.ts`]
- [ ] [AI-Review][LOW] Add optional **unit tests** for `normalizeEmail`, `checkSignInRateLimit`, or `authorize` when test framework lands (story allowed deferral).

## Dev Notes

### Epic context

- **Epic 1** — identity and sessions. This story adds **working login/logout** and secure cookies; **Story 1.4** tunes **rolling ~30-day** persistence (`maxAge` / `updateAge`); **Story 1.5** invitation signup; **Story 1.6** route guards + CSRF baseline beyond auth defaults.
- **Depends on:** Story **1.2** (`User`, `passwordHash`, singleton `prisma`).

### Technical requirements

| Area | Requirement |
|------|-------------|
| Auth | **Auth.js** + **Credentials** + **Prisma adapter** — [Source: `_bmad-output/planning-artifacts/architecture.md` — Authentication & security] |
| Passwords | **bcrypt** or **argon2** — [Source: architecture.md — Credential model, NFR10] |
| Sessions | HTTP-only cookies; extended session tuning deferred to **1.4** but set **sensible defaults** now (document placeholders for `maxAge` / `updateAge` for 1.4) — [Source: architecture.md; epics Story 1.4] |
| Rate limit | Auth endpoints — [Source: architecture.md — API/mutation safety, NFR12] |
| API errors | Future JSON shape `{ "error": { "code", "message" } }` — login form can use inline errors first; align new API routes when added — [Source: `docs/project-context.md`] |

### Architecture compliance

- **Paths:** `src/app/api/auth/[...nextauth]/route.ts`, `src/lib/auth.ts`, `src/lib/db.ts` (reuse singleton **only**). — [Source: `architecture.md` — Complete project directory structure; note Auth.js v5 path may say `[...nextauth]` or `[...auth]` — follow **installed** package docs.]
- **Secrets:** `AUTH_SECRET`, database URLs in server env only — [Source: `docs/project-context.md` #1]
- **Prisma:** One client from `src/lib/db.ts`; adapter uses same client — [Source: `docs/project-context.md` #2]
- **UI:** **MUI** + **Stack** for flex layouts — [Source: `docs/project-context.md`, user rules]

### Library & framework requirements

| Package | Notes |
|---------|--------|
| `next-auth` / `@auth/*` | Use versions documented for **Next.js App Router** + **Auth.js v5** style exports; verify against npm and Auth.js site at implementation time. |
| `@auth/prisma-adapter` | Must match Auth.js major. |
| `bcrypt` or `argon2` | Server-only; native `bcrypt` vs `bcryptjs` — pick one and document (Windows/dev friendliness if relevant). |
| Zod | Optional on login form; recommended for consistent validation with future APIs. |

### File structure requirements

```
src/
├── app/
│   ├── api/auth/[...nextauth]/route.ts   # GET/POST handlers (name per Auth.js docs)
│   └── login/page.tsx
├── lib/
│   ├── auth.ts                           # NextAuth config, adapters, callbacks
│   └── db.ts                             # unchanged singleton
prisma/
├── schema.prisma                         # + adapter models, User relations
└── migrations/<timestamp>_auth_adapter/
```

### Testing requirements

- **Manual:** Create user with hashed password in DB → log in → refresh → log out → protected behavior smoke (full middleware in 1.6).
- **Automated:** Optional unit test for `authorize` password path if test runner lands; not required if not yet in repo.

### Previous story intelligence (1.2)

- **Prisma 6.19.0**; `User` has `passwordHash` mapped to `password_hash`; **cuid** ids; **`DIRECT_URL`** for migrations — keep migrations additive.
- **npm** + `package-lock.json`; `db:*` scripts use `scripts/prisma-env.cjs` and `.env.local`.
- **Do not** add second `PrismaClient`; adapter receives imported `prisma` from `db.ts`.
- Story 1.2 **Senior Dev Review:** avoid `dotenv` only in devDependencies; ESLint overrides for CJS in `scripts/` — preserve those patterns.

### Git intelligence

- Recent commits: DB init, skeleton app — baseline is Next **16.2.2**, MUI **7**, Prisma **6.19**, no auth packages yet.

### Latest tech information (verify at implementation)

- **Auth.js v5 + Next.js 16:** Use the official **App Router** installation (central `auth` export, `handlers` in route). Confirm whether the catch-all segment is `[...nextauth]` or `[...auth]` for your exact `next-auth` version.
- **React 19:** No duplicate `children` props; follow Auth.js peer dependency warnings.

### Project context reference

- `docs/project-context.md` — stack, non-negotiables, error JSON shape  
- `_bmad-output/planning-artifacts/architecture.md` — auth, API, directory tree  
- `_bmad-output/planning-artifacts/epics.md` — Story 1.3 ACs, FR9–FR11, NFR9–NFR13  

### Story completion status

- **done** — Medium review follow-ups implemented: constant-time bcrypt path + `proxy.ts`; low items (unknown IP bucket, unit tests) deferred/optional.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

None.

### Completion Notes List

- **Auth.js:** `next-auth@5.0.0-beta.30` with `handlers`, `auth`, `signIn`, `signOut` from `src/lib/auth.ts`; route at `src/app/api/auth/[...nextauth]/route.ts` (catch-all segment `[...nextauth]`).
- **Sessions:** `session.strategy: "jwt"` (required for Credentials-only); signed session in HTTP-only cookie. `@auth/prisma-adapter` + `Session` / `Account` / `VerificationToken` tables + migration `20260406015520_auth_adapter` — DB rows unused for this provider mix until OAuth/email adds database-backed sessions. `session` callback exposes `session.user.id`.
- **Passwords:** `bcryptjs` in `authorize` only; plaintext never stored. Seed uses cost factor 12 (`prisma/seed.cjs`, `npm run db:seed` → `dev@example.com` / documented password in script output only).
- **Email:** `normalizeEmail()` used in `authorize` and client `signIn` payload.
- **Rate limit (NFR12):** Same **client IP** (first `x-forwarded-for` or `x-real-ip`), sliding window **15 minutes**, max **10** POSTs to `/api/auth/callback/credentials`; **429** JSON `{ error: { code, message } }`. Enforced in **`src/proxy.ts`** (Next.js 16 `proxy`). In-memory store is **per server instance** — `src/lib/rate-limit.ts` documents upgrading to Upstash/Redis for multi-instance production.
- **Timing:** `authorize` compares passwords against `passwordHash` or a fixed dummy bcrypt hash so `bcrypt.compare` always runs.
- **Cookies / host:** `trustHost: true`; `session.maxAge` / `updateAge` set with ~30-day placeholder pending Story 1.4. Production: Auth.js uses secure cookies when appropriate; set `AUTH_SECRET`, `AUTH_URL` (or `NEXTAUTH_URL`) on Vercel — see `.env.example`.
- **NFR13:** No logging of passwords, tokens, or raw `Authorization` on auth paths.
- **Build / lint:** `npm run build` (with `AUTH_SECRET` set in CI/deploy) and `npm run lint` pass. ESLint allows `require()` in `prisma/**/*.cjs` like `scripts/`.

### File List

- `package.json`
- `package-lock.json`
- `.env.example`
- `eslint.config.mjs`
- `prisma/schema.prisma`
- `prisma/migrations/20260406015520_auth_adapter/migration.sql`
- `prisma/seed.cjs`
- `src/lib/auth.ts`
- `src/lib/normalize-email.ts`
- `src/lib/rate-limit.ts`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/proxy.ts`
- `src/types/next-auth.d.ts`
- `src/components/app-providers.tsx`
- `src/components/auth/logout-button.tsx`
- `src/components/auth/login-link-button.tsx`
- `src/app/login/page.tsx`
- `src/app/page.tsx`

### Change Log

- 2026-04-06: Story 1.3 — Auth.js Credentials + Prisma adapter, JWT session cookie + adapter tables for future providers, login/logout, IP rate limit on credential callback, seed + env docs.
- 2026-04-05: Code review follow-up — AC1 text aligned with JWT + Credentials; home **Login** uses `Button component={Link}` (valid HTML / a11y).
- 2026-04-05: **Senior Developer Review (AI)** — Adversarial review: all ACs implemented; tasks verified; `npm run build` / `npm run lint` pass. Findings: File List gap fixed (`login-link-button.tsx`); Prisma adapter comment clarified for JWT; open follow-ups: login timing enumeration (MEDIUM), Next `middleware`→`proxy` migration (MEDIUM), rate-limit `unknown` IP (LOW), optional tests (LOW). Status → in-progress until follow-ups addressed or accepted.
- 2026-04-05: **Review follow-ups resolved** — Dummy-hash bcrypt path in `authorize`; `src/middleware.ts` → `src/proxy.ts` (`proxy` export). Story status **done**; LOW items remain optional.

## Senior Developer Review (AI)

**Reviewer:** Kyle (AI) · **Date:** 2026-04-05

**Outcome (initial):** Changes requested — medium follow-ups logged.

**Outcome (2026-04-05):** Medium items **resolved** in code (constant-time compare + Next 16 `proxy.ts`). Story marked **done**; optional LOW follow-ups remain in Tasks.

| Checklist item | Result |
|----------------|--------|
| Story loaded; status reviewable | Yes (`review` → updated post-review) |
| Epic/Story IDs | Epic 1, Story 1.3 |
| Architecture / project context | Loaded (`architecture.md`, `project-context.md`, `epics.md` selective) |
| AC cross-check | All 7 ACs **IMPLEMENTED** (evidence in `src/lib/auth.ts`, login page, `proxy.ts`, `.env.example`, seed) |
| File List vs git | Reconciled: added `login-link-button.tsx` |
| Build / lint | `AUTH_SECRET` set: `npm run build` OK; `npm run lint` OK |
| Security review | Rate limit + bcrypt + generic login errors OK; timing hardening via dummy hash |

## Open questions / PM clarifications

- Resolved: catch-all is `[...nextauth]`; env vars `AUTH_SECRET`, `AUTH_URL` / `NEXTAUTH_URL` per Auth.js v5 inference (documented in `.env.example`).
