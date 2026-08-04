---
title: 'User first/last name + Profile'
type: 'feature'
created: '2026-08-03'
status: 'done'
baseline_commit: '8aa54a0a97e906d7c0c26d5f8d33818f8f5dcc07'
context:
  - '{project-root}/docs/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Accounts only show email in the nav and league lists because users never provide a name at signup; existing users have no self-serve way to set one without a DB backfill.

**Approach:** Require first and last name on create-account and invite signup; store nullable `firstName`/`lastName` and sync Auth.js `name` to `"First Last"`; add a Profile page (nav dropdown) to edit email + names with immediate save; keep email fallback when names are unset.

## Boundaries & Constraints

**Always:**
- Add nullable `first_name` / `last_name` on `User` (Prisma camelCase + `@map`); no data backfill migration
- On create/update when both names present: persist trimmed first/last and set `name` to `"${firstName} ${lastName}"`
- Create-account and invite new-user signup: both name fields required (Zod + UI)
- Display surfaces keep `name ?? email` (or equivalent helper); unset names → email
- Profile at authenticated `/profile`: editable email, first name, last name; immediate save; email uniqueness; CSRF origin check on mutation
- Nav dropdown: show full name when set (else email); add **Profile** menu item above Log out
- After Profile save, refresh JWT session so nav shows updated name/email without re-login
- Update display call sites that already use `name ?? email` so they keep working once `name` is set (standings, results/peer history, roster, admin submissions, audit names, Tuesday digest standings)
- Add `/profile` (+ path variants) to `src/proxy.ts` matcher for `x-pathname` login redirects

**Ask First:**
- Requiring password re-entry or email verification for email changes (explicitly deferred: immediate save only)
- Soft banners / forced Profile completion for users with empty names

**Never:**
- Backfill existing users’ names
- Remove email uniqueness or allow blank first/last on new signup
- Change password from Profile in this change
- Rewrite planning docs / README for this feature

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create account happy | Valid email, password, first, last | User created with first/last + `name`; can sign in; nav shows full name | N/A |
| Invite signup happy | Valid token + password + first + last | Same as create; membership as today | N/A |
| Missing name on signup | Blank first or last | Rejected client + API | Field validation messages |
| Existing user no names | `name`/first/last null | Nav + lists show email | N/A |
| Profile save names | Authenticated; valid first/last | DB + session updated; nav shows full name | Zod 400 |
| Profile save email | New unique email | Email updated; session reflects new email | `EMAIL_IN_USE` / 409 if taken |
| Profile email conflict | Email owned by another user | No change | Clear conflict error |
| Unauthenticated Profile | No session | Redirect to login with callback | N/A |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` -- `User` model (`name` optional today)
- `src/lib/create-account.ts` + `create-account.test.ts` -- register Zod body
- `src/lib/register-user.ts` -- `User.create` (no name today)
- `src/app/api/auth/register/route.ts` -- register handler
- `src/app/create-account/create-account-client.tsx` -- create-account form
- `src/lib/invitations.ts` + `invitations.test.ts` -- `inviteSignupBodySchema`
- `src/app/api/signup/invite/route.ts` -- invite new-user create
- `src/app/signup/[token]/signup-form.tsx` -- invite signup UI
- `src/lib/auth.ts` -- credentials `authorize` returns `name`; JWT/session callbacks
- `src/types/next-auth.d.ts` -- session/JWT types
- `src/app/(app)/layout.tsx` -- `userDisplayName` for nav
- `src/components/layout/UserNavMenu.tsx` -- dropdown (Log out only)
- `src/components/league/LeagueNavShell.tsx` -- wires `UserNavMenu`
- `src/lib/scoring/get-league-standings.ts` -- standings `displayName`
- `src/lib/scoring/get-league-peer-pick-history.ts` -- results rows `displayName`
- `src/lib/league/list-league-roster.ts` -- roster `displayName`
- `src/lib/admin/build-submission-status.ts` -- admin cards
- `src/lib/admin/get-audit-log.ts` -- admin/target names
- `src/lib/email/get-tuesday-digest-data.ts` -- digest standings names
- `src/proxy.ts` -- matcher + rate limits
- `src/lib/cookie-session-mutation-csrf.ts` -- cookie-session mutation CSRF

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma` + migration -- Add nullable `firstName`/`lastName` (`first_name`/`last_name`); no backfill -- schema for optional names
- [x] `src/lib/user-display-name.ts` (+ test) -- Pure helper: trimmed `"First Last"` builder + `displayName(user) => name ?? email` -- single sync/display rule
- [x] `src/lib/create-account.ts` + tests + `register-user.ts` + register route + create-account client -- Require first/last; persist + set `name` -- self-serve signup
- [x] `src/lib/invitations.ts` + tests + invite route + `signup-form.tsx` -- Require first/last on invite create path -- invite parity
- [x] `src/app/(app)/profile/page.tsx` + profile client form + `PATCH` (or POST) `/api/profile` -- Auth-gated edit email/first/last; CSRF; uniqueness; set `name`; refresh session -- self-serve without backfill
- [x] `src/lib/auth.ts` (+ types if needed) -- Ensure JWT/session carry updated `name`/`email` after login and after Profile `session.update` -- nav correctness
- [x] `src/components/layout/UserNavMenu.tsx` + shell wiring -- Add Profile menu item (link `/profile`) above Log out -- nav entry
- [x] `src/proxy.ts` -- Include `/profile` in matcher -- login callback pathname
- [x] Confirm standings/results/roster/admin/digest paths still use `name ?? email` (helper optional); adjust selects only if first/last needed -- display surfaces pick up synced `name`

**Acceptance Criteria:**
- Given create-account or invite signup, when first or last is missing, then submission fails with field errors
- Given successful signup with both names, when the user lands in the app shell, then the nav shows `"First Last"` not email
- Given an existing user with null names, when viewing nav/standings/results/roster/admin/digest, then email is shown
- Given Profile, when the user saves valid first/last (and optional new unique email), then DB updates, session refreshes, and nav reflects the new full name/email
- Given Profile email already taken, when saving, then the API returns a conflict and no fields change
- Given unauthenticated access to `/profile`, when requested, then redirect to login with callback to `/profile`
- Given `npm test` for touched Zod/helpers, when run, then tests pass including new name-required cases

## Spec Change Log

## Design Notes

**Name sync:** Treat Auth.js `User.name` as the denormalized full name for all existing `name ?? email` readers. Prefer a tiny helper used at write sites:

```ts
export function fullNameFromParts(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.replace(/\s+/g, " ").trim();
}
```

Do not require changing every SELECT to include `firstName`/`lastName` if `name` is always kept in sync on write.

**JWT refresh:** Credentials + JWT means Profile must call Auth.js client `update()` after a successful PATCH. On `trigger === "update"`, the `jwt` callback **re-reads `name`/`email` from the DB by `token.id`** — never trust client-supplied identity claims in the update payload. Layout can keep reading `session.user.name ?? session.user.email`.

**Invite existing-user accept path:** No name capture required there (account already exists); Profile covers gaps.

**Validation:** Non-empty trimmed strings; reasonable max length (e.g. 50–80 chars each) consistent with other string fields.

## Verification

**Commands:**
- `npm test` -- expected: pass, including create-account / invitations / new helper tests
- `npx prisma migrate status` (or apply local migrate) -- expected: new nullable columns present

**Manual checks:**
- Create account with names → nav shows full name; initials from first+last
- Invite signup with names → same
- Existing nameless user → email in nav; Profile save → nav updates without logout
- Standings + results rows show full name after Profile/signup
- Profile email conflict shows clear error

## Suggested Review Order

**Name sync helper**

- Single write/display rule: parts → `name`, else email
  [`user-display-name.ts:22`](../../src/lib/user-display-name.ts#L22)

**Schema**

- Nullable first/last columns; no backfill
  [`schema.prisma:24`](../../prisma/schema.prisma#L24)

**Signup capture**

- Required first/last on create-account body
  [`create-account.ts:10`](../../src/lib/create-account.ts#L10)

- Persist names + denormalized `name` on register
  [`register-user.ts:37`](../../src/lib/register-user.ts#L37)

- Create-account form fields
  [`create-account-client.tsx:263`](../../src/app/create-account/create-account-client.tsx#L263)

- Invite signup parity (API + form)
  [`invite/route.ts:70`](../../src/app/api/signup/invite/route.ts#L70)

**Profile**

- Authenticated PATCH with CSRF + uniqueness
  [`profile/route.ts:19`](../../src/app/api/profile/route.ts#L19)

- Form saves then triggers JWT refresh
  [`profile-client.tsx:44`](../../src/app/(app)/profile/profile-client.tsx#L44)

**Session safety**

- `update()` re-reads identity from DB (never trust client claims)
  [`auth.ts:100`](../../src/lib/auth.ts#L100)

**Nav + display**

- Profile menu item above Log out
  [`UserNavMenu.tsx:118`](../../src/components/layout/UserNavMenu.tsx#L118)

- Standings (and peers) use shared display helper
  [`get-league-standings.ts:45`](../../src/lib/scoring/get-league-standings.ts#L45)

**Proxy**

- `/profile` in matcher for login callback pathname
  [`proxy.ts:118`](../../src/proxy.ts#L118)
