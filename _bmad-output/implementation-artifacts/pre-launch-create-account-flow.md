# Pre-launch: Create-account flow

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Kyle (and real pre-season test-users),
I want a **Create account** path from the login page that registers a real user without admin/DB provisioning,
so that the app can leave seed-only bootstrap and invite-only User creation behind for hands-on testing before production cutover.

**Source requirement (Kyle — do not soften):** "we need a create account flow so that I can get this in the hands of real test-users without doing any admin user-creation myself."

**Product decision locked in this story (Epic 9 retro open call → create-story):**

| Concern | Decision |
|---------|----------|
| Open vs invite-gated User creation | **Open self-serve** — email + password creates a `User` with **no** league membership |
| FR8 tension | **FR8 remains the invite path for league onboarding** (`/signup/[token]`). Self-serve creates **identity only**; joining a league still requires admin invite (**FR2**) or the invitee using the existing accept flow |
| Email verification | **Out of scope** — no verify-email gate (Resend domain cutover is still post-epic-9; keep friction low for ≤14 testers) |
| First admin chicken-and-egg | Solved: create account → `/home` → existing **Create league** CTA → invite others via Story 2.2 |

## Acceptance Criteria

### AC1 — Login link + create-account page

**Given** an unauthenticated visitor on `/login`  
**When** they use the new **Create account** link  
**Then** they land on a public `/create-account` page with email, password, and confirm-password fields  
**And** submitting valid input creates a `User` (`normalizeEmail` + `passwordHash` via bcrypt cost **12**) with **no** `LeagueMembership`  
**And** on success the client signs in via `signIn("credentials", { redirect: false })` and navigates to `/home` (same spirit as invite `SignupForm`)  
**And** `/home` already exposes **Create league** — do **not** invent a new empty-state product surface in this story  
**And** login page keeps **Forgot password?**; place **Create account** as a clear secondary link (Stack + MUI `Link` + Next `Link`, match login a11y)

### AC2 — Invite path unchanged (FR8)

**Given** the existing invitation signup flow  
**When** self-serve create-account ships  
**Then** `/signup/[token]`, `POST /api/signup/invite`, and `POST /api/signup/invite/accept` behavior is **unchanged**  
**And** invited new users can still create accounts via invite links; invited existing users still use accept / sign-in branches  
**And** self-serve does **not** consume invitations or auto-join leagues

### AC3 — Auth mutator hardening (Epic 9 retro checklist)

**Given** `POST /api/auth/register` (or equivalent public register mutator) is a new high-risk auth endpoint  
**When** it is implemented  
**Then** it is rate-limited in `src/proxy.ts` + `src/lib/rate-limit.ts` with a **dedicated** namespace (e.g. `register` — suggest **5–8 / 15 min** per client key; document choice; do **not** silently reuse only the sign-in bucket without documenting why)  
**And** duplicate email returns a clear `EMAIL_IN_USE` (or equivalent) error with UX pointing to login / forgot-password — **intentional** mild enumeration tradeoff for a private ≤14-user app (document in Dev Notes; do **not** fake success)  
**And** password policy failures use `PASSWORD_POLICY` + `SIGNUP_PASSWORD_POLICY_MESSAGE` (same as invite signup)  
**And** never log raw passwords; structured logs may include action + normalized email or user id only (allowlist — no password, no full credential payloads)  
**And** concurrent duplicate register for the same email must not create two users — rely on Prisma unique `User.email` and map unique violation → `EMAIL_IN_USE` (no advisory lock required unless a race leaves a confusing 500)

### AC4 — UX / a11y parity with existing auth pages

**Given** UX spec has **no** dedicated open-registration screens (invite-first journeys only)  
**When** building create-account UI  
**Then** mirror login / forgot-password / invite signup patterns: centered `Stack` full-viewport, SkipLink, labeled TextFields, `aria-invalid` / `aria-describedby`, focus management to form Alerts, disabled submit while pending  
**And** use **Stack** for flex layout (project convention)  
**And** password fields use `autoComplete="new-password"`; show signup policy helper text  
**And** client-side confirm-password match **before** POST; server still enforces `signupPasswordFieldSchema` on password only  
**And** include **Back to login** link; from create-account, do not require invite token copy  
**And** preserve Story **9.6** link treatment (color + underline) via existing MUI `Link` / theme — do not invent a new link system

### AC5 — Docs / seed note

**Given** seed (`prisma/seed.cjs`) still bootstraps `dev@example.com` for local empty DBs  
**When** this story completes  
**Then** briefly note in `docs/deployment.md` (Auth or Pre-launch section) that **self-serve create-account** is the supported path for real test-users (seed remains local bootstrap only)  
**And** `.env.example` needs **no** new secrets (reuse Auth.js + existing DB) — comment only if helpful  
**And** do **not** remove seed admin; optional one-line comment in seed that create-account exists for non-seed users

## Tasks / Subtasks

- [x] Task 0 — Auth mutator create-story checklist (Epic 9 retro) (AC: #3)
  - [x] Confirm concurrency plan: unique email index → map P2002 / unique fail to `EMAIL_IN_USE`
  - [x] Confirm anti-enumeration stance: **no** fake-success on duplicate; clear `EMAIL_IN_USE` + rate limit
  - [x] Confirm log allowlist: no passwords; optional email/userId + `action: "register"` only
- [x] Task 1 — Domain helpers + Zod (AC: #1, #3)
  - [x] Add `src/lib/create-account.ts` (name OK if consistent) with `createAccountBodySchema`: email + `signupPasswordFieldSchema` (reuse from `invitations.ts` — **do not** fork password policy)
  - [x] Pure helpers + colocated `create-account.test.ts` for schema (valid / weak password / bad email)
  - [x] Optional thin `registerUser({ email, password })` domain function used by the route (keeps route thin; bcrypt + prisma create)
- [x] Task 2 — API route (AC: #1, #2, #3)
  - [x] `POST /api/auth/register` — parse JSON; validate; `normalizeEmail`; bcrypt cost 12; `user.create`; return `{ ok: true }`
  - [x] Map duplicate email → **409** `{ error: { code: "EMAIL_IN_USE", message: "…" } }` with calm copy + “Sign in or reset password”
  - [x] Map password-only Zod failure → **400** `PASSWORD_POLICY` (same shape as invite route)
  - [x] Public mutator: **no** cookie-session CSRF required (same class as forgot-password / invite signup); rate limit required
  - [x] Wire `RATE_LIMITED_POST_PATHS` + `config.matcher` in `src/proxy.ts` and new `checkRegisterRateLimit` (or equivalent) in `src/lib/rate-limit.ts`
- [x] Task 3 — UI (AC: #1, #4)
  - [x] `src/app/create-account/page.tsx` + `"use client"` form module (Suspense if `useSearchParams` needed; otherwise mirror forgot-password structure)
  - [x] Login: add **Create account** → `/create-account` next to / below Forgot password
  - [x] On success: `signIn("credentials")` then `window.location.assign("/home")` or `router.push("/home")` — prefer full navigation like login for shell consistency
  - [x] If already signed in visiting `/create-account`, redirect to `/home` (mirror `login/page.tsx` `auth()` gate)
- [x] Task 4 — Docs + tests (AC: #5)
  - [x] Update `docs/deployment.md` briefly
  - [x] Unit tests for Zod/helpers; rate-limit helper if new export
  - [x] Manual smoke: create account → land on home → create league (optional) → second browser/email cannot reuse same email (`EMAIL_IN_USE`) → invite path still works for a third email
  - [x] `npm test` green

### Review Findings

- [x] [Review][Patch] Treat any User.create P2002 as EMAIL_IN_USE — `meta.target` may be constraint names (e.g. `User_email_key`) not exact `"email"`; array `includes("email")` then fails and duplicates surface as 500 [`src/lib/register-user.ts:20`]
- [x] [Review][Patch] After successful register, if `signIn` throws, show sign-in recovery — today catch shows generic failure and retry hits EMAIL_IN_USE [`src/app/create-account/create-account-client.tsx:131`]
- [x] [Review][Patch] Map 400 responses by error code — do not set `passwordError` for every 400 (email/`VALIDATION_ERROR` currently lands on the password field) [`src/app/create-account/create-account-client.tsx:111`]
- [x] [Review][Patch] Guard double-submit — set a sync submit lock before await so a second click cannot fire parallel POSTs before `pending` re-renders [`src/app/create-account/create-account-client.tsx:85`]
- [x] [Review][Patch] File List omits `src/lib/register-user.ts` and `src/lib/register-user.test.ts` [`pre-launch-create-account-flow.md:256`]
- [x] [Review][Patch] Sprint-status comment still says “PRD FR8 is invite-only today” despite open self-serve User creation [`sprint-status.yaml:149`]
- [x] [Review][Defer] `auth()` on create-account page has no try/catch [`src/app/create-account/page.tsx:11`] — deferred, pre-existing (same as login; story marked optional / not AC-gated)
- [x] [Review][Defer] bcrypt 72-byte password truncation via shared `signupPasswordFieldSchema` (no max) [`src/lib/register-user.ts:37`] — deferred, pre-existing
- [x] [Review][Defer] Exact-path rate-limit Set misses trailing-slash variants (same pattern as forgot-password) [`src/proxy.ts:47`] — deferred, pre-existing
- [x] [Review][Defer] In-memory register rate-limit buckets are per-instance only [`src/lib/rate-limit.ts:12`] — deferred, pre-existing (already documented)

## Dev Notes

### What this story is (and is NOT)

| **Is** | **Is NOT** |
|--------|------------|
| Open self-serve **User** registration from login | Changing invite-only **league join** (FR2/FR8 token path stays) |
| Login **Create account** link + `/create-account` + register API | Email verification / magic link / OAuth / Clerk |
| Rate limit + unique-email concurrency + log allowlist | Admin “create user” UI |
| Reuse signup password policy + bcrypt 12 + Auth.js credentials | Replacing seed for local empty DB |
| UX parity with login / forgot / invite signup | Home empty-state redesign, app-shell polish, Epic 9 UI rework |
| Pre-launch gate before guided cutover / post-epic-9 ops | Production domain, Resend SPF/DKIM, Vercel cron smoke |

### Locked design decisions (do not re-litigate)

1. **Open registration for User rows** — satisfies Kyle’s “no admin user-creation” ask; invite remains how people enter leagues.
2. **Route `/create-account`** — avoids colliding with `/signup/[token]`; API under `/api/auth/register` next to forgot/reset.
3. **No email verification** for MVP pre-launch testers.
4. **Confirm password on UI** (reset pattern) even though invite signup historically had password-only — open form chooses email freely; confirm reduces lockouts.
5. **`EMAIL_IN_USE` is OK** — private app; prefer clear recovery over anti-enum theater. Rate limit still mandatory (NFR12 spirit).
6. **Architecture path variance:** architecture sketches `app/(auth)/…` — **actual** tree is flat `src/app/login/`, `forgot-password/`, `signup/[token]/`. Add `src/app/create-account/` as a sibling — **do not** invent `(auth)` group in this story.
7. **Public route placement:** `/create-account` must live **outside** `src/app/(app)/` (that layout redirects unauthenticated users to login). Same public class as `/login`, `/forgot-password`, `/signup/[token]`.
8. **NFRs:** hashed passwords (**NFR10**), auth rate limits (**NFR12**), no credential logging (**NFR13** spirit) — already encoded in ACs; no new secrets (**NFR** ops stay post-epic-9).

### Current code ground truth (reuse — do NOT reinvent)

| Need | Reuse |
|------|--------|
| Password policy | `signupPasswordFieldSchema`, `SIGNUP_PASSWORD_POLICY_MESSAGE` — `src/lib/invitations.ts` |
| Hash on write | `bcrypt.hash(password, 12)` — `src/app/api/signup/invite/route.ts` |
| Sign-in after create | `signIn("credentials", …)` — `signup-form.tsx` / `login-client.tsx` |
| Email normalize | `normalizeEmail` — `src/lib/normalize-email.ts` |
| Auth session | `auth()` / Auth.js — `src/lib/auth.ts` |
| Rate limit | Extend `src/lib/rate-limit.ts` + `src/proxy.ts` (mirror password-reset dedicated bucket) |
| Login / a11y UX | `src/app/login/login-client.tsx`, `forgot-password-client.tsx` |
| Error JSON | `{ error: { code, message } }` |
| Safe redirects | `getSafeCallbackPath` if callbackUrl ever used; default post-register → `/home` |
| Home after register | Existing `CreateLeagueLinkButton` on `src/app/(app)/home/page.tsx` |

**Do not touch / break:** invite preview, invite accept, admin invitations API, password-reset tokens.

### Suggested API / UX contracts

**`POST /api/auth/register`** body: `{ email: string, password: string }`  
- Success → **200** `{ ok: true }`  
- Weak password → **400** `PASSWORD_POLICY`  
- Duplicate email → **409** `EMAIL_IN_USE`  
- Rate limited → **429** `RATE_LIMITED` (proxy)  
- Confirm password is **client-only**; do not require it in the API body

**Agreed UX copy (EMAIL_IN_USE):**  
“An account with this email already exists. Sign in or reset your password.”

**Login secondary links:** keep Forgot password; add Create account (order: primary Login button → Forgot password? → Create account, or Forgot + Create as a compact link row — either is fine if both are keyboard-reachable and visually secondary).

### UX notes (from `ux-design-specification.md`)

No open-registration screens in UX. Infer from:

- Authentication should feel rare for engaged users (rolling sessions) — create-account is a **once** onboarding path for testers / first admin
- Invitation journeys still show league context before commit — **self-serve has no league context**; do not fake league copy on create-account
- WCAG A: labels, keyboard, focus to alerts (Story 7.3 patterns already on login)
- Streamlined account creation, minimal friction — three fields + submit is enough
- Link color/underline consistency from Story 9.6 app-wide treatment

### Deferred-work disposition (consulted while planning)

| Item | Disposition for this story |
|------|----------------------------|
| Create-account itself | **This story** (sprint-status key; not a deferred-work bullet) |
| 6.4 `auth()` without try/catch on `login/page.tsx` | **Optional opportunistic** only if already editing login page for redirect gate patterns; **not** AC-gated (Accept in full triage) |
| 6.4 `callbackUrl` as `string[]` | **Out of scope** (Accept) |
| `already_registered` preview unit test | **Out of scope** (Accept) — invite path untouched |
| Concurrent duplicate invite accept | **Out of scope** |
| Password-reset token cleanup | **Out of scope** (Park) |
| Auth cookie apex/www | **Out of scope** — `post-epic-9-vercel-production-env-and-cron` |
| Resend domain / `from` | **Out of scope** — `post-epic-9-resend-domain-and-from-address` |

**No Promote ride-alongs required** from full triage (Promote count was 0).

### Previous story intelligence

**`pre-launch-deferred-work-full-triage` (done):** Confirmed create-account stays a dedicated backlog key; do not duplicate into deferred-work. Execute order: triage → **create-account** → guided cutover → post-epic-9 ops.

**Story 9.3 forgot-password (done):** Best template — dedicated rate-limit bucket, public auth pages beside login, bcrypt 12, shared password schema, anti-abuse hardening, tight is/is-not table. Create-account is simpler (no email send, no token table).

**Story 1.5 invite signup:** Still the **only** path that creates User **and** membership. Self-serve must not call invite consume logic.

**Epic 9 retro:** Auth mutator checklist (concurrency, anti-enum/timing, log allowlists) is **Task 0** for this story.

**Git recent pattern:** `feat(auth): Story 9.3 — …`; focused auth commits; reuse `lib/` helpers rather than new frameworks.

### Latest technical specifics

- Auth.js **Credentials** provider has **no** built-in registration — custom Route Handler (this story’s pattern) is correct; do not expect Auth.js to create users.
- Keep rate limits on public register POSTs; in-memory buckets remain per-instance until shared store (already documented in `rate-limit.ts`) — acceptable for Hobby / single instance MVP.
- bcrypt cost **12** stays aligned with signup + reset.
- Do not add CAPTCHA unless abuse appears; rate limit is enough for ≤14 trusted testers.

### Testing requirements

1. Unit: create-account Zod schema (email normalize expectations if tested via schema; password policy reuse)
2. Unit: new rate-limit export if added
3. Manual: happy path register → session → home; duplicate email; invite signup still works for a different email
4. `npm test` after implementation
5. Prefer pure helpers under `src/lib/**` over mocking Next.js / Auth.js in Vitest

### Project Structure Notes

**Create (expected):**
- `src/lib/create-account.ts` (+ `create-account.test.ts`)
- `src/app/api/auth/register/route.ts`
- `src/app/create-account/page.tsx` + client form module

**Update:**
- `src/app/login/login-client.tsx` — Create account link
- `src/app/create-account/` may call `auth()` on server page for signed-in redirect (like login)
- `src/proxy.ts`, `src/lib/rate-limit.ts`
- `docs/deployment.md` (brief)
- Optional: `prisma/seed.cjs` comment only

**Do not create:** new Prisma models, email templates, admin user-creation UI, `(auth)` route group.

### References

- [Source: `_bmad-output/implementation-artifacts/sprint-status.yaml` — `pre-launch-create-account-flow`]
- [Source: `_bmad-output/implementation-artifacts/epic-9-retro-2026-08-03.md` — create-account + auth mutator checklist]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR8 invite signup; FR2 invites]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 1.5 invite ACs]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Auth.js, rate limits, invitation flow]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — auth friction, invite-first journeys, WCAG]
- [Source: `docs/project-context.md` — Auth.js, rate limit in proxy, error JSON, Stack]
- [Source: `_bmad-output/implementation-artifacts/9-3-forgot-password-flow.md` — pattern template]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` + `pre-launch-deferred-work-full-triage.md` — disposition]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

- Rate limit: dedicated `register` namespace, 6 attempts / 15 min (within story 5–8 band).
- Anti-enumeration: intentional `EMAIL_IN_USE` on duplicate (private ≤14-user app); no fake success.
- Concurrency: Prisma unique `User.email` → P2002 mapped to `EMAIL_IN_USE`.

### Completion Notes List

- Added open self-serve registration: `/create-account` page, `POST /api/auth/register`, login **Create account** link.
- Reused invite signup password policy, bcrypt cost 12, Auth.js credentials sign-in after register.
- `registerUser` domain helper; structured logs allowlist (`action`, `email`, `userId` only).
- Unit tests: `create-account.test.ts` (schema), `rate-limit.test.ts` (register bucket).
- `npm test` — 525 tests passing.
- Invite path untouched (`/signup/[token]`, invite API routes).

### File List

- `src/lib/create-account.ts` (new)
- `src/lib/create-account.test.ts` (new)
- `src/lib/register-user.ts` (new)
- `src/lib/register-user.test.ts` (new)
- `src/app/api/auth/register/route.ts` (new)
- `src/app/create-account/page.tsx` (new)
- `src/app/create-account/create-account-client.tsx` (new)
- `src/app/login/login-client.tsx` (modified)
- `src/lib/rate-limit.ts` (modified)
- `src/lib/rate-limit.test.ts` (modified)
- `src/proxy.ts` (modified)
- `docs/deployment.md` (modified)
- `prisma/seed.cjs` (comment only)

### Change Log

- 2026-08-03: Implemented pre-launch create-account flow (domain, API, UI, rate limit, docs).
- 2026-08-03: Code review patches — P2002 mapping, post-register signIn recovery, 400 field mapping, double-submit guard, File List + sprint comment.

**Ultimate context engine analysis completed — comprehensive developer guide created.**
