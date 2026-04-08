# Story 1.5: Invitation tokens and signup via invite link

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a new participant,
I want to create my account from an invitation link,
so that only invited people join the league.

## Acceptance Criteria

1. **Given** a **valid** invitation record exists in the database  
   **When** the user opens the signup route with the correct token and submits a valid password (and any required fields)  
   **Then** a **User** is created with a **bcrypt** password hash, **normalized email** matches the invitation, and the invitation is marked **consumed** (single-use) (**FR8**).

2. **Given** an invitation that is **missing**, **expired**, **already used**, or **token mismatch**  
   **When** the user attempts to load the signup page or submit the form  
   **Then** they see a **clear, user-safe message** (e.g. invalid or expired invite) **without revealing** whether an email exists in the system (**no enumeration**).

3. **Given** the product path: **Epic 2 Story 2.2** will create invitations through the **real admin flow**  
   **When** implementing **this** story  
   **Then** invitations for development and QA are creatable via **`npm run db:seed`** and/or a **server-only** admin/dev API or script (document which), until 2.2 ships—**do not** block 1.5 on full league UI.

4. **Given** existing auth from **Stories 1.3–1.4** (Credentials + JWT, `normalizeEmail`, rate-limited credential callback)  
   **When** signup succeeds  
   **Then** the user is **signed in** with the same **HTTP-only** session behavior as login (no new session strategy) unless product explicitly requires “verify email first” (out of scope—default: **auto sign-in** after successful signup).

5. **Verification:** Manual flow documented in Tasks: create invite → open link → register → confirm logged-in state; invalid token paths behave per AC2.

## Tasks / Subtasks

- [x] **Data model** — Add Prisma `Invitation` (or equivalent name) with snake_case columns mapped per project-context: opaque **token hash** (never store raw token), **invited email**, **expires at**, **consumed at** (nullable), timestamps; optional **nullable `league_id` FK** if you add a minimal `League` stub now—**otherwise** omit FK and add migration in 2.x when `League` exists (prefer **no fake League**; nullable email-only invite is OK for 1.5 if epics allow “invitation exists” without league row).
- [x] **Token generation** — For seed/admin path: cryptographically random raw token → URL-safe string → store **hash** only (`crypto` SHA-256 or bcrypt of token—pick one and document); lookup by hash; **constant-time** compare if storing hash of presented token.
- [x] **Route** — `src/app/signup/[token]/page.tsx` (or agreed dynamic segment): load invite by token **server-side** for initial validity (optional: show invited email read-only if valid).
- [x] **Signup mutation** — Server Action or `POST` Route Handler: Zod-validated password policy (min length aligned with login—document); create `User`, set `passwordHash`, mark invitation consumed **transactionally** (`prisma.$transaction`).
- [x] **Auth** — On success: `signIn("credentials", { redirect: false, ... })` then redirect (mirror `login/page.tsx` patterns); handle “already have account” edge with **same generic error** as AC2.
- [x] **Rate limiting** — Extend `src/proxy.ts` (or equivalent) to rate-limit **signup POST** the same way as `/api/auth/callback/credentials` (**NFR12**). **Matcher must list every path that receives the signup POST** for your chosen mechanism: e.g. a dedicated `src/app/api/.../signup/route.ts`, or the **Next.js Server Action** POST target (often the **page URL** for the signup route—confirm in Network tab and match that path pattern).
- [x] **Seed** — Extend `prisma/seed.cjs` to create at least one **unused** invitation with printed **full signup URL** for local testing (base URL from `NEXTAUTH_URL` or documented placeholder).
- [x] **Tests** — Vitest: pure helpers (token hashing, normalization edge) colocated per `.cursor/rules/post-change-testing.mdc`; run `npm test`.
- [x] **Build / lint** — `npm run build` and `npm run lint` pass.
- [x] **Manual QA (AC5)** — Run `npm run db:seed` → copy printed invite URL → open `/signup/[token]` → submit password meeting policy → confirm redirect to app and logged-in session; try wrong token, expired/used invite (after successful signup), and bad password to confirm generic or policy-safe messaging per AC2.

## Dev Notes

### Epic context

- **Epic 1** — **1.5** delivers **FR8** (invitation signup). **1.6** adds protected routes + CSRF baseline; signup page may stay public.
- **Depends on:** **1.2** User model, **1.3** credentials auth, **1.4** JWT session constants — see `_bmad-output/implementation-artifacts/1-4-rolling-session-persistence.md`.
- **Downstream:** **Story 2.2** replaces manual/seed invite creation with admin email flow; schema should **not** paint the team into a corner—reserve fields or migrations as needed.

### Technical requirements

| Area | Requirement |
|------|-------------|
| Product | **FR8** — account from invitation link only for MVP league join narrative. |
| Security | **NFR10** bcrypt/argon2 for passwords; **NFR13** never log raw tokens or passwords; **NFR12** rate limit auth-adjacent endpoints. |
| Session / CSRF | Signup is a **state-changing POST** under the same **Auth.js + App Router** cookie session model as login—follow the **same patterns** the app already uses for login mutations (no new CSRF strategy unless you introduce one globally). **Story 1.6** adds the broader **CSRF baseline** and protected-route hardening; do not block 1.5 on 1.6, but stay consistent with login. |
| Privacy | Invalid/expired/used invites: **one** user-visible outcome class (no “email not found” vs “wrong token”). |
| API | Zod on boundary; JSON errors per `docs/project-context.md` shape. |
| DB | **NFR28** transactional signup + invite consume. |

### Architecture compliance

- **Auth.js v5** + **Prisma adapter** — Keep **JWT** session strategy for Credentials; no database session switch ([Source: `src/lib/auth.ts`, `architecture.md` — Authentication & security]).
- **Single Prisma client** — `src/lib/db.ts` only.
- **Email** — `normalizeEmail` from `@/lib/normalize-email` for all lookups and storage consistency with login.
- **Next.js 16** — App Router, Route Handlers under `src/app/api/**/route.ts` ([Source: `package.json`, `docs/project-context.md`]).
- **League / first competition week** — Not required for minimal invite row in 1.5; **Story 2.2** attaches league context when present.
- **CSRF / cookies** — Align signup POST behavior with **login** (same origin, session cookie rules). Broader CSRF policy and route guards land in **1.6**; signup page may stay **public** per Epic context.

### Library & framework requirements

| Package | Version (pinned) | Notes |
|---------|-------------------|--------|
| `next-auth` | `^5.0.0-beta.30` | `signIn` after signup; same Credentials provider. |
| `@prisma/client` | `6.19.0` | New model + migration. |
| `bcryptjs` | `^3.0.3` | Password hashing (same as authorize path). |
| `zod` | `^4.3.6` | Signup body validation. |

### File structure requirements

```
prisma/schema.prisma          # Invitation model (+ migration)
prisma/seed.cjs               # Sample invitation + URL
src/app/signup/[token]/page.tsx
src/app/api/...               # or server actions under signup flow only
src/lib/invitations.ts        # optional — token hash, validation helpers + tests
src/proxy.ts                  # extend matcher: signup POST path(s) per Route Handler vs Server Action (see Tasks → Rate limiting)
```

### Testing requirements

- **Vitest** — Pure functions: token hashing, “invite valid” predicate; keep **fast**, no full Next harness required for MVP.
- **Manual** — Required: happy path + expired + reuse + wrong token.

### Previous story intelligence (1.4)

**Artifact:** `_bmad-output/implementation-artifacts/1-4-rolling-session-persistence.md` (done).

- **JWT + Credentials** — `strategy: "jwt"` in `src/lib/auth.ts`; Prisma `Session` rows unused.
- **Session** — `src/lib/session-constants.ts` — do not change rolling behavior for 1.5.
- **Rate limit** — `src/proxy.ts` only matches credential callback today; **add** the real signup POST path(s)—depends whether signup is a **Route Handler** or **Server Action** (see Tasks → Rate limiting).
- **Login UX** — `src/app/login/page.tsx` uses MUI **Stack**, client `signIn`, `zod` for form—mirror patterns for signup **Stack** layout per user rules.

### Git intelligence

- Recent commits: auth completion, session persistence + Vitest, Prisma users, scaffold—extend **same** conventions (ESLint, colocated tests).

### Latest tech information

- **Auth.js** — Use project’s pinned `next-auth` / `@auth/core` behavior for `signIn` after user creation; avoid duplicate user creation paths that bypass adapter expectations.
- **OWASP** — Store **hashed** invite tokens; prefer **256-bit** random raw tokens before hashing.

### Project context reference

- `docs/project-context.md` — server-only secrets, one Prisma client, camelCase JSON / snake_case DB, consistent error JSON.
- `_bmad-output/planning-artifacts/epics.md` — Story 1.5 (Epic 1).
- `_bmad-output/planning-artifacts/architecture.md` — Auth, Prisma, REST+Zod.

### Story completion status

- **review** — Code-review remediation applied 2026-04-07; ready for final sign-off to **done**.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- **Invitation model** — `Invitation` table with `token_hash` (SHA-256 hex of raw URL token), `invited_email`, `expires_at`, `consumed_at`; no `league_id` until Epic 2.
- **Token storage** — Raw token is only ever `base64url` from `crypto.randomBytes(32)` in seed; DB stores `hashInviteToken()` = SHA-256 hex; signup `POST /api/signup/invite` hashes the presented token and loads by hash.
- **Password policy** — Invite signup requires **8+ characters** plus digit and special char (`SIGNUP_PASSWORD_REGEX`); login form still uses min 1 for the field—documented in code. Invalid invite / duplicate email / consumed invite: same generic `INVITE_INVALID` JSON + UI (no enumeration). Password-only validation failures return **`PASSWORD_POLICY`** with the policy message (no email hints).
- **Sign-in after signup** — If `POST /api/signup/invite` succeeds but `signIn("credentials")` fails, the UI shows a **recovery** message with link to `/login` (not the invalid-invite copy).
- **Dev invites** — **`npm run db:seed`** creates a fresh unused invitation for `invited@example.com` and prints the full signup URL (base from `NEXTAUTH_URL` → `AUTH_URL` → `http://localhost:3000`). No separate admin API in this story.
- **Rate limit** — `src/proxy.ts` matcher includes `POST /api/signup/invite` alongside credential callback; same `checkSignInRateLimit` bucket semantics. When proxy IP headers are absent, keys fall back to a **per User-Agent hash** (`local:<hex>`) instead of a single global `unknown` bucket.

### File List

- `prisma/schema.prisma`
- `prisma/migrations/20260407120000_add_invitations/migration.sql`
- `prisma/seed.cjs`
- `src/lib/invitations.ts`
- `src/lib/invitations.test.ts`
- `src/lib/rate-limit.ts`
- `src/app/api/signup/invite/route.ts`
- `src/app/signup/[token]/page.tsx`
- `src/app/signup/[token]/signup-form.tsx`
- `src/proxy.ts`
- `README.md`
- `_bmad-output/implementation-artifacts/1-5-invitation-tokens-and-signup-via-invite-link.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-04-07: Implemented invitation signup (Prisma `Invitation`, SHA-256 token hash, `/signup/[token]` + `POST /api/signup/invite`, transactional consume, credentials sign-in, proxy rate limit, seed URL, Vitest for `hashInviteToken`). Status → **review**.
- 2026-04-07: Senior Developer Review (AI) — findings recorded; status → **in-progress** pending follow-ups.
- 2026-04-07: Remediation — sign-in recovery UI, `PASSWORD_POLICY` API code, token max length, `isInvitationUsable` + tests, proxy rate-limit key fallback, README invite note, AC5 manual task; status → **review**.

## Senior Developer Review (AI)

**Reviewer:** Kyle (via code-review workflow)  
**Date:** 2026-04-07  
**Outcome:** **Changes requested** (see below; **remediation applied** 2026-04-07 — see end of section)

### Summary

| Severity | Count |
|----------|-------|
| High | 2 |
| Medium | 5 |
| Low | 3 |

**Git vs File List:** No discrepancy — staged changes match the Dev Agent Record File List.

**Verification:** `npm test`, `npm run lint`, and `npm run build` all pass. Next.js build lists **Proxy (Middleware)** — `src/proxy.ts` is active for rate limiting.

### Findings

**High**

1. **Post-signup `signIn` failure leaves a bad UX and misleading copy** — `signup-form.tsx` calls `POST /api/signup/invite` then `signIn("credentials", …)`. If the API succeeds but `signIn` fails (misconfiguration, transient auth error, adapter issue), the user sees the same generic “invalid or expired” message even though the **User** row already exists and the invite is **consumed**. That violates the spirit of AC4 (clear success path) and can strand a real user. Prefer a distinct server-or-client outcome (e.g. “Account created — sign in” + redirect to `/login`) or ensure sign-in cannot fail silently after a successful transaction without recovery.

2. **AC5 “manual flow documented in Tasks” is only partially met** — AC5 asks for the manual QA path to be documented **in Tasks**. The Tasks section does not list the explicit steps (seed invite → open URL → register → confirm session; invalid/expired/wrong token). The behavior is implied elsewhere but not in Tasks as written.

**Medium**

3. **Boundary validation vs generic error** — `POST` maps **all** `bodySchema` failures (including password policy) to the same `INVITE_INVALID` response as bad invites. That matches anti-enumeration goals but means a bypass of client-side Zod yields a confusing message; document as intentional or return a separate client-safe code for “password rules” only (still no email hints).

4. **Rate limit key `unknown`** — When `x-forwarded-for` and `x-real-ip` are absent, every request shares the `"unknown"` bucket in `proxy.ts`, so one client can throttle others in misconfigured or local environments.

5. **Unbounded token string in API** — `token: z.string().min(1)` allows extremely large payloads (hash CPU + memory). A reasonable `max()` improves abuse resistance.

6. **Test coverage vs story breadth** — Colocated tests cover `hashInviteToken` and regex only. The transactional invite-consume + user-create path and route handler behavior are not covered (acceptable for MVP per project norms, but the story’s “Tests” task is thinner than it could be).

7. **AC3 documentation surface** — Dev path is seed-only (documented in Completion Notes). Consider a one-line pointer in `README` or Tasks (“invites: `npm run db:seed`”) so “document which” is discoverable outside the story file.

**Low**

8. **“Constant-time compare” in story vs implementation** — Lookup is by hashed token unique index (appropriate for high-entropy tokens). A short comment explaining why `timingSafeEqual` is unnecessary here would align docs and code.

9. **Observability** — The route’s broad `catch` returns 400 for all failures, which hides server/DB errors from clients (good) but makes ops triage harder without structured logging elsewhere.

10. **Password policy vs AC wording** — Signup requires digit + special character, stricter than “min length aligned with login.” Acceptable product choice; ensure product/UX is intentional.

### Checklist (workflow validation)

See `_bmad/bmm/workflows/4-implementation/code-review/checklist.md` — AC cross-check, security pass, file list validated, tests mapped; outcome **Changes requested**.

### Remediation (2026-04-07)

| Finding | Action |
|--------|--------|
| H1 Post-`signIn` failure UX | `signup-form.tsx`: warning alert + link to `/login` when API OK but `signIn` returns error. |
| H2 AC5 manual steps in Tasks | Added **Manual QA (AC5)** task with explicit steps. |
| M3 Password vs invite error | `POST` returns `PASSWORD_POLICY` when Zod failures are **only** on `password`; client maps to policy message. |
| M4 Rate limit `unknown` | `proxy.ts`: `cf-connecting-ip`, then UA-hash fallback `local:<hex>`. |
| M5 Unbounded token | `INVITE_TOKEN_MAX_LENGTH` + `inviteSignupBodySchema`. |
| M6 Tests | `isInvitationUsable` + schema token-length tests in `invitations.test.ts`. |
| M7 README / AC3 | `README.md` — dev invites via `npm run db:seed`. |
| L8 Constant-time note | Comment on `hashInviteToken` + indexed lookup. |
| L9 Observability | `INVITE_BAD` vs other errors: `console.error` for unexpected failures in route `catch`. |
| L10 Password vs login | Unchanged (intentional stricter signup policy); documented in Completion Notes. |
