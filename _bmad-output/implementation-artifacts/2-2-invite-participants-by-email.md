# Story 2.2: Invite participants by email

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a league admin,
I want to invite participants by email with signup links,
so that roster fills without manual account creation.

## Acceptance Criteria

1. **Given** an **authenticated** user who is a **league admin** (`LeagueMembership.role === ADMIN`) for **league L**  
   **When** they submit one or more **valid email addresses** to invite for **L**  
   **Then** for each address the system creates an **`Invitation`** row **scoped to `L`** with a **new** high-entropy token (**hashed at rest** per Story 1.5), **`invitedEmail`** normalized like auth (`normalizeEmail`), **`expiresAt`** in the future (document TTL, e.g. 7 or 14 days), and **`consumedAt` null** (**FR2**).

2. **Given** a created invitation  
   **When** the server finishes persisting it  
   **Then** an **email send** is **invoked** with a **signup deep link** to the existing flow: **`{origin}/signup/{rawToken}`** (same shape as seed / Story 1.5) (**FR2**, **FR8** alignment).  
   **MVP:** implement a **server-only** `sendInvitationEmail` (or similar) that **logs the URL in development** and is **ready to swap** for a real provider in Epic 6 — do **not** block on Resend/SendGrid wiring if keys are absent.

3. **Given** an invitee opens a **valid** link and completes **`POST /api/signup/invite`**  
   **When** the invitation row has **`leagueId = L`**  
   **Then** inside the **same transaction** as user create + invite consume, the user receives a **`LeagueMembership`** with **`role: MEMBER`** for **L** (unless already a member — see edge cases).  
   **Given** a **seed** invitation with **`leagueId` null** (legacy dev path)  
   **When** signup succeeds  
   **Then** behavior remains **unchanged** from Story 1.5 (user only, no membership).

4. **Given** callers who are **not** admins of **L**  
   **When** they call the invite API  
   **Then** the server returns **403** with structured JSON error (**NFR16** posture for league mutations).

5. **Given** the invite API  
   **When** input fails Zod validation (bad email shape, empty list, too many addresses — cap documented)  
   **Then** response is **400** with **`{ error: { code, message } }`** per `docs/project-context.md`.

6. **Given** **NFR15** / Story **1.6**  
   **When** the invite endpoint is a cookie-session **mutation**  
   **Then** it uses **`assertCookieSessionMutationOrigin`** (after JSON parse, same ordering convention as **`POST /api/leagues`**) on **`POST`**.

7. **Given** **NFR12**  
   **When** **`POST`** targets the new invite route(s)  
   **Then** **`src/proxy.ts`** applies the **same rate-limit posture** as other sensitive POSTs (extend matching logic if the path is dynamic — exact `Set` match is insufficient for `/api/leagues/:id/invitations`).

8. **Given** the **signup preview** (`getSignupInvitePreview` / `/signup/[token]`)  
   **When** the invitation is league-scoped and valid  
   **Then** the UI shows **league name** (and keeps **anti-enumeration** for invalid tokens — no extra leaks).

## Tasks / Subtasks

- [x] **Schema** — Add **`league_id`** to **`invitations`** (**nullable** FK → `leagues`, `onDelete: Cascade`) so existing **seed** invites stay valid. Add index on **`(league_id, invited_email)`** if helpful for de-dup queries. Migration committed.
- [x] **Invite creation rules** — **Normalize** emails; **reject** duplicates that are **already** `LeagueMembership` for that league (**409** or **400** with clear admin-facing code, e.g. `ALREADY_MEMBER` — admin context, enumeration NFR less critical than public signup). For **pending** invites (same league + email, not consumed), define behavior: **revoke/expire** previous row(s) or **reject** — **pick one** and document (recommend: supersede old pending with new token).
- [x] **POST `/api/leagues/[leagueId]/invitations`** — Route Handler: parse body → **CSRF** → **`auth()`** → load membership → **ADMIN** check → Zod (`emails`: string array, max count, each email valid); transactional creates; call **`sendInvitationEmail`** per invite; return summary JSON (e.g. created ids or count — avoid echoing raw tokens).
- [x] **Email helper** — `src/lib/email/` or `src/lib/invitations/` server module: build absolute URL from **`NEXTAUTH_URL` / `AUTH_URL`** (same as seed); subject/body minimal text; **`console.info`** in dev when no provider.
- [x] **Signup transaction** — Update **`POST /api/signup/invite`**: if `invitation.leagueId` set, **`leagueMembership.create`** (or **`upsert`**) **`MEMBER`**; handle **unique** `(userId, leagueId)` if user somehow exists — align with product (MVP: keep **1.5** rule “existing email → generic invalid” **or** document exception for league invites only if you intentionally expand scope).
- [x] **Preview** — Extend **`getSignupInvitePreview`** to **`include`** `league` when `leagueId` present; adjust **`SignupInvitePreview`** union; update **`/signup/[token]/page.tsx`** copy to show league name via **MUI** **`Stack`**.
- [x] **Admin UI (minimal)** — New page under **`src/app/(app)/leagues/[leagueId]/invites/page.tsx`** (or equivalent): **MUI** form — multi-line emails or chip input; submit → POST; surface errors; link from **`/leagues/new` success** and/or **dashboard** if a league list entry exists (otherwise deep link is enough for MVP). Use **`Stack`** for layout.
- [x] **Proxy** — Extend **`proxy`** POST rate limiting to match **`/api/leagues/*/invitations`** (regex or `startsWith` + segment checks); extend **`config.matcher`** if the route is not already covered by **`/leagues/:path*`** for pathname header (API paths may need **`/api/leagues/:path*`** in matcher).
- [x] **Tests** — Vitest: Zod schema for invite body; pure helper for “supersede pending” if extracted; **`normalizeEmail`** consistency optional. Keep colocated per `.cursor/rules/post-change-testing.mdc`.
- [x] **Regression** — `npm run lint`, `npm test`, `npm run build`; manual: admin invites → email log URL → signup → **`league_memberships`** row **`MEMBER`**; seed invite without league still works.

## Dev Notes

### Epic context

- **Epic 2:** League creation (**2.1** ✅) → **invites (this story)** → pre-season init (**2.3**), admin list (**2.4**), participant views (**2.5**), admin-as-participant (**2.6**), first-week behavior (**2.7**), delete league (**2.8**).
- **FR2:** Invitation records + signup links; **FR8:** signup flow already exists — **extend**, do not replace.
- **Depends on:** **2.1** (`League`, `Season`, `LeagueMembership`, **`ADMIN`** creator). **Epic 1** signup + token hashing.

### Technical requirements

| Area | Requirement |
|------|-------------|
| API | REST under **`src/app/api/leagues/[leagueId]/invitations/route.ts`** (or equivalent); **camelCase** JSON; plural kebab parent path [Source: `architecture.md`]. |
| DB | **snake_case** columns; **`invitations.league_id`** nullable for legacy seed [Source: `project-context.md`]. |
| Auth | **`auth()`** + **membership role** check on **`leagueId`**. |
| Tokens | **`crypto.randomBytes(32).toString("base64url")`** → **`hashInviteToken`** before persist [Source: `src/lib/invitations.ts`, seed]. |
| Errors | **`{ error: { code, message } }`** [Source: `docs/project-context.md`]. |

### Architecture compliance

- Single Prisma client **`@/lib/db`**; **transactions** for signup + membership + consume (**NFR28**).
- No email API keys in client; no `NEXT_PUBLIC` secrets.
- **CSRF** on admin invite **POST** per **NFR15**.

### Library & framework requirements

| Package | Version (repo) | Notes |
|---------|----------------|-------|
| `next` | `16.2.2` | Dynamic Route Handler segment `[leagueId]`. |
| `next-auth` | `^5.0.0-beta.30` | `auth()` for admin identity. |
| `@prisma/client` | `6.19.0` | Additive migration. |
| `zod` | `^4.3.6` | Invite batch schema. |
| `@mui/material` | `^7.3.9` | **Stack** for invite UI. |

### File structure requirements

```
prisma/schema.prisma              # Invitation.leagueId FK + migration
src/app/api/leagues/[leagueId]/invitations/route.ts
src/lib/invitations.ts            # extend types/helpers as needed
src/lib/email/send-invitation-email.ts   # or colocate — server-only
src/app/api/signup/invite/route.ts       # membership on consume
src/app/signup/[token]/page.tsx          # league name display
src/app/(app)/leagues/[leagueId]/invites/page.tsx
src/proxy.ts                      # rate limit + matcher for API path
```

### Testing requirements

- Unit-test **Zod** invite payload and any pure **normalize/dedup** helpers.
- Manual **E2E** path: create league → invite → signup → membership.

### Previous story intelligence (2.1)

**Artifact:** `_bmad-output/implementation-artifacts/2-1-create-league-and-season.md`.

- **`Season.first_competition_week`** lives on **`Season`**; invitations attach to **`League`** (all seasons in MVP are per-league; if multi-season later, invitations may need **`seasonId`** — **out of scope**; document assumption **current** season year for the league).
- **Creator** = single **`ADMIN`** membership; invitees = **`MEMBER`** only.
- Reuse **CSRF** + **JSON error** patterns from **`POST /api/leagues`**.
- **409** pattern exists for duplicate league **name** — use analogous codes for invite conflicts.

### Git intelligence

- Follow **Epic 1** patterns: **`normalizeEmail`**, generic **`INVITE_INVALID`** on public signup, **rate limits** in **`proxy`**.

### Latest tech information

- **Next.js 16** App Router dynamic API routes: `route.ts` under `[leagueId]`.
- **Zod 4** — use existing project **`safeParse`** style.

### Project context reference

- `docs/project-context.md` — JSON errors, **Stack** for MUI flex, multi-tenancy.
- `_bmad-output/planning-artifacts/epics.md` — Epic 2 Story **2.2**; **UX** invitation narrative (show what they are joining).
- `_bmad-output/planning-artifacts/architecture.md` — REST, server-only email.

### Scope boundaries (avoid creep)

- **Do not** implement full **transactional email provider** integration (**Epic 6.1**) unless already trivial — **stub/log** satisfies AC for MVP.
- **Do not** implement **Tuesday campaign** emails (**Epic 6**).
- **Do not** implement **participant league home / roster** (**2.4**–**2.5**) beyond minimal invite page + signup preview.
- **Existing user** invited again: **default** keep Story **1.5** behavior (**generic invalid** on signup) unless product explicitly expands — if so, document as follow-up (login + accept invite).

## Change Log

- **2026-04-12** — Story authored from `epics.md`, sprint status, codebase review (`Invitation`, signup, `League` schema). Status **ready-for-dev**.
- **2026-04-12** — Implemented league-scoped invitations, admin POST API, signup membership, invite UI, proxy rate limit, tests. Status **review**.
- **2026-04-12** — Code review follow-ups: partial unique index + supersede consumes pending rows, per-email advisory lock, signup error logging, story **done**.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

_(none)_

### Completion Notes List

- **Invitation TTL:** New rows use **14 days** from creation (`INVITATION_TTL_MS` on the route module).
- **Pending invite supersede:** For the same `leagueId` + normalized `invitedEmail`, any row with `consumedAt: null` is marked **consumed** (`consumedAt` and `expiresAt` set to request time) before inserting a new invitation, matching the DB partial unique index on pending rows.
- **Concurrency:** `pg_advisory_xact_lock(hashtext(leagueId), hashtext(email))` per invite inside the create transaction.
- **DB:** Migration `20260412140000_invitations_one_pending_per_league_email` dedupes legacy pending rows and adds `invitations_league_id_invited_email_pending_key`.
- **ALREADY_MEMBER:** `409` with `ALREADY_MEMBER` if any invitee email already has a `LeagueMembership` for that league.
- **MVP email:** `sendInvitationEmail` logs full signup URL via `console.info` (same base URL resolution as seed).
- **Regression:** `npm run lint`, `npm test`, `npm run build` passed locally. Apply Prisma migrations (including `20260412120000_invitation_league_id` and `20260412140000_invitations_one_pending_per_league_email`) before running the app.

### File List

- `prisma/schema.prisma`
- `prisma/migrations/20260412120000_invitation_league_id/migration.sql`
- `prisma/migrations/20260412140000_invitations_one_pending_per_league_email/migration.sql`
- `src/lib/email/app-base-url.ts`
- `src/lib/email/send-invitation-email.ts`
- `src/lib/league/create-invitations-body.ts`
- `src/lib/league/create-invitations-body.test.ts`
- `src/lib/invitations.ts`
- `src/app/api/leagues/[leagueId]/invitations/route.ts`
- `src/app/api/signup/invite/route.ts`
- `src/app/signup/[token]/page.tsx`
- `src/app/(app)/leagues/[leagueId]/invites/page.tsx`
- `src/app/(app)/leagues/[leagueId]/invites/invite-participants-form.tsx`
- `src/app/(app)/leagues/new/create-league-form.tsx`
- `src/proxy.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/2-2-invite-participants-by-email.md`
