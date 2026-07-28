# Story 9.3: Forgot-password flow

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user who forgot their password,
I want a **secure reset via email**,
so that invited participants can recover access before / during the real season without admin intervention.

**Source requirement (Kyle — do not soften):** "We're missing a forgot password flow. Can Resend help us support this?"

**Answer encoded in this story:** **Yes.** Use the **existing Resend + React Email stack** for reset mail. Do **not** add a second email provider. Do **not** block implementation on production domain SPF/DKIM cutover (that remains `post-epic-9-resend-domain-and-from-address`; local/sandbox smoke uses `RESEND_FROM=Pick Six <onboarding@resend.dev>` as today). Document the Resend choice briefly in Dev Agent Record / deployment notes so the AC “evaluates and documents whether Resend…” is satisfied by shipping on Resend with a one-line rationale (existing stack, already chosen in `docs/email-provider-decision.md`).

## Acceptance Criteria

### AC1 — Request → email → set new password

**Given** a registered user with a known email and a `passwordHash`  
**When** they submit that email on the forgot-password request form  
**Then** the system creates a **time-limited, single-use** reset token (raw token only in the email URL; **hash** stored in DB)  
**And** they receive a reset email containing an absolute link built with `getAppBaseUrl()` (same pattern as invites)  
**And** opening a valid link shows a form to set a new password  
**And** submitting a valid new password updates `User.passwordHash` (bcrypt cost **12**, same as signup), consumes the token, and the user can sign in with the new password  
**And** expired / already-consumed / unknown tokens show a clear recovery error (request a new link) **without** revealing whether an account exists for some other email

### AC2 — Resend is the send path

**Given** transactional email already uses Resend  
**When** reset mail is implemented  
**Then** send via existing helpers (`resend` client, `getResendFrom()`, `sendWithRetry`, `getAppBaseUrl()`, structured `logEvent`) — **prefer Resend unless a blocking reason is recorded**  
**And** record in completion notes / a short note in `docs/deployment.md` (Email section or forgot-password bullet) that reset mail uses Resend (no second provider)  
**And** do **not** re-open Resend vs Postmark/SendGrid  
**And** production domain verify / `RESEND_FROM` cutover remains **post-epic-9** (placeholder/`onboarding@resend.dev` OK for local smoke)

### AC3 — Rate limit + anti-enumeration

**Given** forgot-password and reset-confirm are public mutators  
**When** requests are made  
**Then** POSTs are rate-limited in `src/proxy.ts` + `src/lib/rate-limit.ts` (extend matcher + sliding window; dedicated namespace(s) preferred — do not silently share only the sign-in bucket without documenting why)  
**And** the **request** endpoint always returns the **same success UX** whether or not the email is registered (and whether or not the user has a `passwordHash`) — no “email not found”  
**And** timing/response shape must not trivially leak existence (same HTTP status + message; avoid branching UI copy)  
**And** never log raw tokens, passwords, or full reset URLs with tokens in structured logs (log action + user id / hashed token prefix at most)

### AC4 — Docs / env

**Given** the flow may introduce routes/templates but likely **no new secrets** (reuse `RESEND_API_KEY`, `RESEND_FROM`, `AUTH_URL` / `NEXTAUTH_URL`)  
**When** the story completes  
**Then** `.env.example` notes the reset flow’s dependency on Resend + `AUTH_URL` for absolute links (comment is enough if no new vars)  
**And** `docs/deployment.md` mentions forgot-password as implemented via Resend (and that domain/`from` cutover is still post-epic-9)  
**And** if a new secret **is** introduced, document it in both places

## Tasks / Subtasks

- [x] Task 1 — Data model + pure token helpers (AC: #1, #3)
  - [x] Add Prisma model for password-reset tokens (recommended name: `PasswordResetToken`) mirroring Invitation: `tokenHash` (unique), `userId` (FK cascade), `expiresAt`, `consumedAt`, timestamps — **do not** overload `Invitation` or the unused Auth.js `VerificationToken` table
  - [x] Migration + regenerate client
  - [x] Token mint: `randomBytes(32).toString("base64url")` (same as invites); store **only** SHA-256 hex via `hashInviteToken` / shared helper; max length guard like `INVITE_TOKEN_MAX_LENGTH`
  - [x] Pure helpers (colocated tests): hash opaque token, `isPasswordResetUsable`, TTL constant (**1 hour**), Zod body schemas for request (email) and confirm (token + `signupPasswordFieldSchema`)
  - [x] Supersede: on new request for same user, mark prior pending tokens consumed (same spirit as invite re-send)
  - [x] Users with **no** `passwordHash` (theoretical): treat like unknown email — no send, still return generic success
- [x] Task 2 — API routes (AC: #1, #2, #3)
  - [x] `POST /api/auth/forgot-password` — normalize email; always success envelope; if user exists with `passwordHash`, create token + send email (fire-and-forget like invites: log failures, do not leak to client)
  - [x] `POST /api/auth/reset-password` — validate token + password policy; bcrypt hash cost 12; update user + consume token in a transaction; structured errors `{ error: { code, message } }`
  - [x] Wire rate limits in `src/proxy.ts` (`RATE_LIMITED_POST_PATHS` + `config.matcher`) and `src/lib/rate-limit.ts` (new namespace e.g. `password-reset` — suggest ≤5–10 / 15 min per client key; document choice)
  - [x] CSRF: these are **public** token/email flows (like invite signup) — do **not** require cookie-session CSRF; do require rate limits + opaque tokens
- [x] Task 3 — Email template + send helper (AC: #1, #2)
  - [x] `src/lib/email/templates/PasswordResetEmail.tsx` — React Email; clear single CTA button (mirror `InvitationEmail` structure; full layout polish is Story **9.7**)
  - [x] `src/lib/email/send-password-reset-email.ts` — mirror `send-invitation-email.ts` (idempotency key e.g. `password-reset:${rawToken}`, `getResendFrom()`, `sendWithRetry`, `logEvent` domain `email`)
  - [x] Link target: `{getAppBaseUrl()}/reset-password/{rawToken}`
- [x] Task 4 — UI pages (AC: #1, #3) — consult UX patterns below
  - [x] Login: add **Forgot password?** link → `/forgot-password` (MUI `Link` + Next Link; match login a11y)
  - [x] `/forgot-password` — email form; on submit always show success Alert (“If an account exists for that email, we sent a reset link.”); SkipLink + labeled fields + alert focus (mirror `login-client.tsx`)
  - [x] `/reset-password/[token]` — server preview (valid vs invalid token, generic invalid); client form with **new password + confirm** (client match check + server `signupPasswordFieldSchema`); `autoComplete="new-password"`; reuse signup policy message; success → redirect to `/login` with clear success state (e.g. `?reset=1` + success Alert) so user can sign in
  - [x] Pages stay Server Components where Prisma preview is needed; MUI interactive forms in `"use client"` modules (see `.cursor/rules/next-rsc-client-boundaries.mdc`)
  - [x] Match login a11y: SkipLink, labeled TextFields, `aria-invalid` / `aria-describedby`, focus error/success Alert on announce
- [x] Task 5 — Docs + tests (AC: #4)
  - [x] Update `.env.example` + `docs/deployment.md` as in AC4
  - [x] Colocated Vitest for pure helpers + schemas + usability predicate; rate-limit helper if new export
  - [x] Manual smoke: local Resend sandbox per `docs/email-local-smoke-test-runbook.md` — request reset for real Resend-account email → open link → set password → login
  - [x] `npm test` green

## Dev Notes

### What this story is (and is NOT)

| **Is** | **Is NOT** |
|--------|------------|
| End-to-end forgot → email → reset → login | Re-choosing email provider (Resend stays) |
| Resend + React Email for reset mail | Production SPF/DKIM / `RESEND_FROM` cutover (post-epic-9) |
| Rate limits + anti-enumeration UX | Magic-link login / OAuth / Clerk |
| Reuse invite token + password-policy patterns | Story 9.7 full email HTML layout pass |
| Login link + two auth pages | App-shell / home / nav polish (9.5) |
| Docs noting Resend + env | Fixing apex/www Auth cookie Domain (deferred → post-epic-9) |

### Locked design decisions (do not re-litigate)

1. **Resend sends reset mail.** Kyle asked if Resend can help — yes. Existing stack only.
2. **Dedicated `PasswordResetToken` table** — Invitation is league-scoped signup; Auth.js `VerificationToken` is unused with JWT sessions and lacks `consumedAt` / user FK. Mirror Invitation’s hash + TTL + consume pattern.
3. **TTL ≈ 1 hour** (not 14-day invite TTL). Short-lived reset tokens are standard; invites stay long for onboarding.
4. **Password policy = signup policy** — `signupPasswordFieldSchema` / `SIGNUP_PASSWORD_REGEX` from `src/lib/invitations.ts`.
5. **bcryptjs cost 12** — same as `src/app/api/signup/invite/route.ts` and `src/lib/auth.ts`.
6. **Anti-enumeration** — same spirit as Story 1.5 invite invalid UX: generic success on request; generic invalid on bad token.
7. **No production domain gate** — Story 9.2 decided Cloudflare; cutover is post-epic-9. Local smoke with `onboarding@resend.dev` is enough to prove AC2.
8. **JWT sessions after reset** — existing sessions may remain valid until cookie expiry (JWT strategy). Acceptable for MVP; do **not** invent a password-version claim unless trivial. Optional note in completion notes.

### Current code ground truth (reuse — do NOT reinvent)

| Need | Reuse |
|------|--------|
| Password hash/verify | `bcryptjs` cost 12 — signup route + `src/lib/auth.ts` |
| Password policy Zod | `signupPasswordFieldSchema` in `src/lib/invitations.ts` |
| Opaque token hash | `hashInviteToken` / same SHA-256 hex pattern |
| Email normalize | `normalizeEmail` (`src/lib/normalize-email.ts`) |
| Resend send | `send-invitation-email.ts` pattern → new `send-password-reset-email.ts` |
| From / base URL | `getResendFrom()`, `getAppBaseUrl()` |
| Rate limit | Extend `src/lib/rate-limit.ts` + `src/proxy.ts` (`RATE_LIMITED_POST_PATHS` + matcher) |
| Login UX / a11y | `src/app/login/login-client.tsx` (Alert focus, `aria-*`, SkipLink, Stack forms) |
| Error JSON | `{ error: { code, message } }` |
| Safe redirects | `getSafeCallbackPath` if post-login redirect needed |

**Architecture path variance:** architecture sketches `src/app/(auth)/login/` — **actual** tree is `src/app/login/` and `src/app/signup/[token]/`. Put forgot/reset siblings next to login (`src/app/forgot-password/`, `src/app/reset-password/[token]/`), **not** inventing a new `(auth)` group unless you migrate consistently (out of scope).

### Suggested API / UX contracts

**`POST /api/auth/forgot-password`** body: `{ email: string }`  
- Always **200** with `{ ok: true }` (or equivalent non-leaking success) after validation  
- Invalid email format → 400 with field-safe message (format errors OK; existence leaks not OK)

**`POST /api/auth/reset-password`** body: `{ token: string, password: string }`  
- Success → 200; user can login  
- `INVALID_TOKEN` / `EXPIRED_TOKEN` / `VALIDATION_ERROR` / `RATE_LIMITED` as appropriate

**Agreed UX copy (request success):**  
“If an account exists for that email, we’ve sent a password reset link. Check your inbox.”

### UX notes (from `ux-design-specification.md` — no dedicated forgot screens)

Forgot-password screens are **not** specified in UX. Infer from:

- Login / invitation signup: labeled fields, errors below on blur / submit, disabled submit while pending, full-width MUI `Alert` for form-level errors, unmistakable success
- WCAG A: labels, keyboard, focus management to alerts (Story 7.3 login patterns)
- Email CTA: one clear primary button in the reset email (“Reset password”); Story **9.7** owns full member-facing email layout polish later — ship a usable InvitationEmail-class template now
- Active users rarely see login (rolling sessions); this flow is the recovery path when password recall fails — keep friction low and copy calm

### Deferred-work disposition (consulted while planning)

| Item | Disposition for 9.3 |
|------|---------------------|
| **Auth.js cookie / apex vs www** (9.2 review) | **Out of scope** — `post-epic-9-vercel-production-env-and-cron` |
| **DMARC** (9.2) | **Out of scope** — post-epic-9 Resend cutover |
| **Placeholder Resend `from`** | **Leave open** — reset uses same `getResendFrom()`; cutover still post-epic-9 |
| **`auth()` without try/catch on `login/page.tsx`** | **Optional opportunistic** only if already editing that file for the Forgot link; not AC-gated |
| **`callbackUrl` as `string[]` on login** | **Optional opportunistic** — same |
| Epic 7 Lighthouse / circuit-breaker e2e | **Story 9.4** |
| Email HTML full pass | **Story 9.7** (reset template included in “member-facing mail” later) |
| Invite accept thin tests | **Out of scope** |

### Previous story intelligence

**Story 9.2 (done):** Docs-only domain/DNS decision; locked Resend + Cloudflare dual-use; explicitly noted forgot-password is 9.3 and must not invent a second email stack. Pattern: tight is/is-not table, deferred disposition, cite ground-truth code.

**Story 9.1 (done):** Scoring isolation; heavy on tests proving blast radius — for 9.3, prove anti-enumeration + token usability with unit tests; email send via manual smoke.

**Epic 1 invite/auth patterns:** Token hash never store raw; generic invalid UX; rate limit auth POSTs in `proxy.ts`; bcrypt + Auth.js credentials.

**Git recent pattern:** focused `feat(...)` commits; docs for investigations; reuse existing `lib/email` and `lib/invitations` rather than new frameworks.

### Latest technical specifics (reset mail)

- Resend is appropriate for password-reset transactional mail (same API as invites); use **idempotency keys** and short-lived single-use tokens.
- Prefer **15–60 minute** expiry; this story locks **1 hour**.
- Always identical request responses for registered vs unknown emails.
- Production deliverability still depends on post-epic-9 SPF/DKIM — do not claim production inbox readiness in this story.

### Testing requirements

1. Unit: token hash round-trip, `isPasswordResetUsable` (null / consumed / expired / valid), Zod password policy on confirm body, rate-limit helper if added
2. Do **not** require full NextAuth E2E in Vitest; manual Resend sandbox smoke for send path
3. `npm test` after implementation
4. Prefer pure domain helpers under `src/lib/**` over mocking all of Next.js

### Project Structure Notes

**Create (expected):**
- `prisma/schema.prisma` (+ migration) — `PasswordResetToken`
- `src/lib/password-reset.ts` (+ `password-reset.test.ts`) — helpers/schemas
- `src/app/api/auth/forgot-password/route.ts`
- `src/app/api/auth/reset-password/route.ts`
- `src/lib/email/send-password-reset-email.ts`
- `src/lib/email/templates/PasswordResetEmail.tsx`
- `src/app/forgot-password/page.tsx` + client form
- `src/app/reset-password/[token]/page.tsx` + client form

**Update:**
- `src/app/login/login-client.tsx` — Forgot password link
- `src/proxy.ts`, `src/lib/rate-limit.ts`
- `.env.example`, `docs/deployment.md`
- Optionally `deferred-work.md` if you close an opportunistic login hardening item

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 9; Story 9.3]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR8–FR11; NFR10–NFR13, NFR15; email NFRs]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Auth.js; deferred password reset; rate limit in proxy; no paid IDaaS]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — form/error/a11y; no dedicated forgot screens]
- [Source: `docs/project-context.md` — Auth.js; secrets; error shape; Epic 9 forgot-password]
- [Source: `docs/email-provider-decision.md` — Resend chosen]
- [Source: `docs/domain-provider-decision.md` — dual-use domain; cutover post-epic-9]
- [Source: `docs/deployment.md` — env table; Email / Resend go-live]
- [Source: `docs/email-local-smoke-test-runbook.md` — local Resend smoke]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`]
- [Source: `_bmad-output/implementation-artifacts/9-2-domain-provider-investigation.md`]
- [Source: `src/lib/invitations.ts`, `src/lib/email/send-invitation-email.ts`, `src/app/login/login-client.tsx`, `src/proxy.ts`, `src/lib/rate-limit.ts`]

## Dev Agent Record

### Agent Model Used

Composer (dev-story)

### Debug Log References

### Completion Notes List

- **Resend choice:** Reset mail uses existing Resend + React Email stack (same as invites/digests); no second provider. Rationale documented in `docs/deployment.md` and matches `docs/email-provider-decision.md`.
- **Rate limit:** Dedicated `password-reset` namespace — 8 POSTs / 15 min per client key (separate from sign-in bucket).
- **JWT sessions:** Existing sessions remain valid after password reset until cookie expiry (acceptable MVP per story Dev Notes).
- **Migration:** `20260728211407_add_password_reset_tokens` created; run `npm run db:migrate:deploy` before testing against DB.
- **Tests:** 489 Vitest tests pass (`npm test`); 11 new tests in `password-reset.test.ts`, 2 added in `rate-limit.test.ts`.

### File List

- `prisma/schema.prisma` (modified)
- `prisma/migrations/20260728211407_add_password_reset_tokens/migration.sql` (added)
- `src/lib/password-reset.ts` (added)
- `src/lib/password-reset.test.ts` (added)
- `src/lib/password-reset-preview.ts` (added)
- `src/lib/email/templates/PasswordResetEmail.tsx` (added)
- `src/lib/email/send-password-reset-email.ts` (added)
- `src/app/api/auth/forgot-password/route.ts` (added)
- `src/app/api/auth/reset-password/route.ts` (added)
- `src/app/forgot-password/page.tsx` (added)
- `src/app/forgot-password/forgot-password-client.tsx` (added)
- `src/app/reset-password/[token]/page.tsx` (added)
- `src/app/reset-password/[token]/reset-password-form.tsx` (added)
- `src/app/login/login-client.tsx` (modified)
- `src/lib/rate-limit.ts` (modified)
- `src/lib/rate-limit.test.ts` (modified)
- `src/proxy.ts` (modified)
- `.env.example` (modified)
- `docs/deployment.md` (modified)

### Change Log

- 2026-07-28: Story context created (create-story) — status ready-for-dev.
- 2026-07-28: Implemented forgot-password flow — PasswordResetToken model, API routes, Resend email, UI pages, rate limits, docs, tests. Status → review.
- 2026-07-28: Code review — findings appended below.
- 2026-07-28: Code review patches applied (timing pad, atomic consume, login banner, logs, client catches, sibling consume, advisory lock + partial unique index, bcrypt outside tx, preview max length, 500 on unexpected, helper text, rate-limit comments). Status → done.

### Review Findings

- [x] [Review][Patch] Forgot-password timing pad — on unknown/passwordless early success, run comparable dummy DB work before `{ ok: true }` so wall-clock cost does not trivially leak existence (AC3) [`src/app/api/auth/forgot-password/route.ts:47`]
- [x] [Review][Patch] Concurrent reset can bypass single-use — atomic consume via `updateMany` where `consumedAt: null` + count check [`src/app/api/auth/reset-password/route.ts:48`]
- [x] [Review][Patch] Login `?reset=1` success Alert hides sign-in errors — prefer error when present; clear `reset` from URL after announce [`src/app/login/login-client.tsx:145`]
- [x] [Review][Patch] Password-reset email logs include recipient `to` — AC3 allowlist is action + userId / hashed-token prefix at most [`src/lib/email/send-password-reset-email.ts:44`]
- [x] [Review][Patch] Forgot-password client: uncaught fetch network/abort — add `catch` with generic error + announce [`src/app/forgot-password/forgot-password-client.tsx:55`]
- [x] [Review][Patch] Reset-password client: uncaught fetch network/abort — add `catch` with generic error + announce [`src/app/reset-password/[token]/reset-password-form.tsx:81`]
- [x] [Review][Patch] Successful reset leaves sibling unconsumed tokens usable — consume all pending tokens for user in the same transaction [`src/app/api/auth/reset-password/route.ts:64`]
- [x] [Review][Patch] Concurrent forgot-password can mint multiple usable tokens — enforce one pending token per user (partial unique index and/or transactional lock) [`src/app/api/auth/forgot-password/route.ts:55`]
- [x] [Review][Patch] `bcrypt.hash` runs inside open Prisma transaction — hash outside the transaction [`src/app/api/auth/reset-password/route.ts:59`]
- [x] [Review][Patch] Preview hashes oversized raw tokens — guard `PASSWORD_RESET_TOKEN_MAX_LENGTH` before hash/query [`src/lib/password-reset-preview.ts:9`]
- [x] [Review][Patch] Unexpected reset failures return `INVALID_TOKEN` 400 — use 500 + generic server error for non-TOKEN_BAD paths [`src/app/api/auth/reset-password/route.ts:73`]
- [x] [Review][Patch] Reset form helper duplicates password policy text when field error is already the policy message [`src/app/reset-password/[token]/reset-password-form.tsx:116`]
- [x] [Review][Patch] Rate-limit comments disagree with `PASSWORD_RESET_MAX_ATTEMPTS = 8` (claims ≤10) [`src/lib/rate-limit.ts`]
- [x] [Review][Defer] Password-reset email has Button CTA only (no plaintext URL fallback) [`src/lib/email/templates/PasswordResetEmail.tsx`] — deferred, Story 9.7 email layout polish
- [x] [Review][Defer] No expiry/consumed cleanup job for `password_reset_tokens` [`prisma/schema.prisma`] — deferred, ops maintenance not in 9.3 AC
