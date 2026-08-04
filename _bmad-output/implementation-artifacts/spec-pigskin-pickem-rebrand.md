---
title: 'Pigskin Pick''Em user-facing rebrand'
type: 'feature'
created: '2026-08-03'
status: 'done'
baseline_commit: '5582f7392fe498d3b0e7793c7545bd7e2833a6dd'
context:
  - '{project-root}/docs/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The live product still shows "Pick Six" / "PICK SIX" in the nav, auth copy, browser title, and transactional email, while the product should present as **Pigskin Pick'Em**.

**Approach:** Rename all user-facing brand strings to Pigskin Pick'Em (sentence case in copy/subjects/metadata/email header/From display name; all-caps **PIGSKIN PICK'EM** for the shared logo mark). Reuse that mark in the nav and centered above auth forms (login, create account, forgot/reset password, accept invite), slightly larger on auth than in the nav. Do not rename the repo or project folders.

## Boundaries & Constraints

**Always:**
- Display name in prose/subjects/metadata/email brand header/From: `Pigskin Pick'Em`
- Logo mark (nav + auth): `PIGSKIN PICK'EM` (all caps), same visual language as current nav (primary color, bold, letter-spacing)
- Auth logo centered above the page form/content, slightly larger than nav
- Update code default `RESEND_FROM` display name and `.env.example` comment; update tests that assert old strings
- Keep repo name / folder paths as `pick-six`

**Ask First:**
- Changing production Vercel `RESEND_FROM` (ops, not code) — note in verification; do not edit remote env
- Introducing a new image/SVG asset instead of text logo

**Never:**
- Rename git remote, package name, or project directories
- Rewrite planning docs, README, runbooks, or BMAD artifacts for this change
- Change colors, theme, or layout beyond brand text + auth logo placement
- Soften or omit any listed auth screen

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Nav brand | Authenticated app shell | Logo reads `PIGSKIN PICK'EM`, links to `/home` | N/A |
| Document title | Any page | Browser tab title `Pigskin Pick'Em` | N/A |
| Auth screens | login, create-account, forgot-password, reset-password, signup/[token] | Same logo mark centered above form/content, larger than nav | N/A |
| Email header | Any template via EmailLayout | Brand header `Pigskin Pick'Em` | N/A |
| Invite subject | Send invitation | Subject contains `on Pigskin Pick'Em` | N/A |
| Reset subject/body | Password reset email | Subject/preview/body say Pigskin Pick'Em | N/A |
| Default From | `RESEND_FROM` unset | `Pigskin Pick'Em <noreply@yourdomain.com>` | Env override still wins |
| Create-account copy | Create account page | Copy says Pigskin Pick'Em (not Pick Six) | N/A |

</frozen-after-approval>

## Code Map

- `src/components/league/LeagueNavShell.tsx` -- nav text logo `PICK SIX`
- `src/app/layout.tsx` -- `metadata.title`
- `src/app/login/login-client.tsx` -- login form shell
- `src/app/create-account/create-account-client.tsx` -- create account + Pick Six copy
- `src/app/forgot-password/forgot-password-client.tsx` -- forgot password shell
- `src/app/reset-password/[token]/reset-password-client.tsx` -- reset password shell
- `src/app/signup/[token]/page.tsx` -- accept-invite / signup-via-invite shell (Server Component)
- `src/lib/email/templates/EmailLayout.tsx` -- default `brandLabel`
- `src/lib/email/templates/PasswordResetEmail.tsx` -- Pick Six in preview/body
- `src/lib/email/send-invitation-email.ts` -- invite subject
- `src/lib/email/send-password-reset-email.ts` -- reset subject
- `src/lib/email/resend-from.ts` -- DEFAULT_FROM display name
- `.env.example` -- commented RESEND_FROM example
- `src/lib/email/resend-from.test.ts` -- asserts From strings
- `src/lib/email/test-league-labeling.test.ts` -- sample subjects with Pick Six
- `src/components/brand/AppBrandLogo.tsx` -- **create**: shared text mark (`size: "nav" | "auth"`)

## Tasks & Acceptance

**Execution:**
- [x] `src/components/brand/AppBrandLogo.tsx` -- Create shared text logo (`PIGSKIN PICK'EM`); `size="nav"` matches current nav Typography; `size="auth"` slightly larger; optional `href` (nav links `/home`, auth may omit link or link home) -- single source of truth for the mark
- [x] `src/components/league/LeagueNavShell.tsx` -- Replace inline `PICK SIX` Typography with `AppBrandLogo size="nav"` -- keep home link behavior
- [x] `src/app/layout.tsx` -- Set `metadata.title` to `Pigskin Pick'Em`
- [x] Auth clients + signup invite page -- Insert centered `AppBrandLogo size="auth"` as first child of outer main Stack (above h1/form); update create-account copy to Pigskin Pick'Em
- [x] Email senders + templates + `resend-from.ts` + `.env.example` -- Replace Pick Six with Pigskin Pick'Em in brandLabel default, subjects, reset preview/body, DEFAULT_FROM, example env
- [x] `src/lib/email/resend-from.test.ts` + `test-league-labeling.test.ts` -- Update expected strings

**Acceptance Criteria:**
- Given the app shell, when a user views the nav, then the logo reads `PIGSKIN PICK'EM` and still navigates to `/home`
- Given any of login / create-account / forgot-password / reset-password / signup invite, when the page loads, then the same logo appears centered above the form/content and is visually larger than the nav mark
- Given create-account, when reading the subtitle, then it references Pigskin Pick'Em not Pick Six
- Given the document head, when viewing any page, then the title is Pigskin Pick'Em
- Given EmailLayout-rendered mail, when rendered, then the header brand is Pigskin Pick'Em
- Given invitation and password-reset sends, when subjects/bodies are built, then they use Pigskin Pick'Em
- Given unset `RESEND_FROM`, when `getResendFrom()` runs, then the display name is Pigskin Pick'Em
- Given `npm test` for email From/subject helpers, when run, then they pass with the new strings
- Given a repo-wide search under `src/` for user-facing `Pick Six` / `PICK SIX`, when complete, then no remaining UI/email strings (comments-only theme note may remain or be updated for consistency)

## Spec Change Log

## Design Notes

Auth shells share: outer `Stack component="main"` centered (`minHeight: 100vh`, `spacing={3}`). Place logo as the first child of that Stack, above the `h1`.

Suggested sizes (match existing nav, bump auth slightly):
- nav: `variant="h6"`, `fontWeight={800}`, `letterSpacing={1}`, `color="primary.main"`
- auth: same styles with `variant="h5"` (or ~1.1–1.25× nav fontSize)

Email header stays sentence-case `Pigskin Pick'Em` (readable in inbox); only the in-app mark is all-caps.

`AppBrandLogo` should be `"use client"` if it uses `component={Link}` / theme `sx` callbacks; prefer serializable `sx` tokens (`"primary.main"`) so signup server page can import it safely when using Next Link via a client wrapper, or pass `href` only from client parents and use plain Typography without Link on the server invite page.

## Verification

**Commands:**
- `npm test` -- expected: all tests pass, including updated email string assertions
- `rg -n "Pick Six|PICK SIX" src` -- expected: no user-facing hits (allow theme comment only if left intentionally)

**Manual checks:**
- Spot-check login + one invite page: logo centered above form, larger than nav
- After deploy: update Vercel `RESEND_FROM` display name to `"Pigskin Pick'Em" <…>` (ops note; out of code scope)

## Suggested Review Order

**Shared brand mark**

- Single source for all-caps logo; nav h6 vs auth h5
  [`AppBrandLogo.tsx:25`](../../src/components/brand/AppBrandLogo.tsx#L25)

- Nav wires mark with `/home` link
  [`LeagueNavShell.tsx:136`](../../src/components/league/LeagueNavShell.tsx#L136)

**Auth surfaces**

- Logo above login form
  [`login-client.tsx:152`](../../src/app/login/login-client.tsx#L152)

- Logo + create-account copy rename
  [`create-account-client.tsx:193`](../../src/app/create-account/create-account-client.tsx#L193)

- Accept-invite page (server) uses same client mark
  [`page.tsx:61`](../../src/app/signup/[token]/page.tsx#L61)

**Email + metadata**

- Email header default brand
  [`EmailLayout.tsx:33`](../../src/lib/email/templates/EmailLayout.tsx#L33)

- RFC-quoted From display name default
  [`resend-from.ts:3`](../../src/lib/email/resend-from.ts#L3)

- Browser tab title
  [`layout.tsx:14`](../../src/app/layout.tsx#L14)
