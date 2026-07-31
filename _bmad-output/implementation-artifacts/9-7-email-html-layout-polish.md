# Story 9.7: Email HTML layout polish

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a participant receiving league emails,
I want **clear, readable email layout**,
so that the primary action (make my picks) is obvious on mobile and desktop clients.

**Launch-hardening context:** Epic 9 closes pre-season blockers. Stories 9.1–9.6 handled scoring isolation, domain prep, forgot-password, measurement drills, app shell, and in-app interaction polish. **9.5–9.7** are the UI polish tranche owned in `deferred-work.md` launch-risk triage. This story is the **email HTML** slice—the last Epic 9 backlog item. **Do not** soft-pedal Kyle’s source requirements (full layout pass on all controlled mail; “make my picks” must read as a primary CTA, not tiny body text).

**Out of scope:** Resend domain / `from` / DMARC / SPF-DKIM cutover (`post-epic-9-resend-domain-and-from-address`). Production env/cron/inbox smoke (`post-epic-9-*`). App shell / hub / links / pick glow (**9.5–9.6** — done). Cron/idempotency/circuit-breaker logic. `password_reset_tokens` retention/cleanup cron (ops park). Changing email **content rules** (who receives what, FR35–FR40 personalization) or deep-link URLs.

## Source requirements (Kyle — verbatim; do not soften)

1. Make the layout of **all emails that are received prettier**. Full pass on the full layout if we have control over that.
2. In particular, the font size of the **"make my picks" link is really small** and should be called out more.

## Acceptance Criteria

### AC1 — Full layout pass on all member-facing templates

**Given** the transactional email templates we control  
**When** this story ships  
**Then** a **full layout pass** improves typography, spacing, and hierarchy across **all** of:
- `InvitationEmail` (invite / signup)
- `TuesdayDigestEmail` (Tuesday digest)
- `ReminderEmail` (Wednesday + Thursday reminders)
- `PasswordResetEmail` (forgot-password — member-facing mail added in 9.3)
**And** templates share a consistent visual system (shared layout/styles module — do **not** copy-paste divergent one-offs per template)
**And** existing content contracts remain intact: standings + jailed + picks link (FR36); Wed/Thu copy + picks link; invite signup URL; reset URL + expiry copy; test-league body notice when `isTestLeague`

### AC2 — Primary CTA emphasis (“make my picks” / equivalents)

**Given** today every template renders `<Button href={…}>` with **no** custom styles (React Email defaults → tiny / body-like)  
**When** this story ships  
**Then** the primary deep-link CTA is visually emphasized as a **primary button**—**not** small body-sized text  
**And** picks CTAs specifically:
- Tuesday / Wednesday: **"Make your picks"** (existing copy OK; do not shrink)
- Thursday: **"Submit your pick now"** (equivalent primary action)
**And** invite **"Accept invitation"** and reset **"Reset password"** use the **same** primary-button treatment (full pass includes them)
**And** button treatment includes explicit padding, larger font size, brand emerald fill (`#2ECC71`), white label text, comfortable tap target (aim ≥44px height), and enough surrounding whitespace that the CTA cannot be missed when scanning

### AC3 — Plaintext URL fallback (password reset + all primary CTAs)

**Given** deferred-work: password-reset email has Button CTA only (clients that strip buttons leave no link)  
**When** this story ships  
**Then** `PasswordResetEmail` includes a **plaintext URL fallback** under the button (same `resetUrl`)  
**And** invite / digest / reminder primary CTAs likewise include a short plaintext fallback link (or “Or paste this link: …” + URL) so button-stripping clients still work  
**And** fallback text is secondary (smaller / muted) relative to the primary button—does not compete with CTA hierarchy

### AC4 — Verified in real client or Resend / admin preview

**Given** presentational React Email templates are validated visually (architecture: no required unit tests for template TSX alone)  
**When** this story ships  
**Then** changes are verified against **at least one** of: admin Tuesday preview (`GET …/email/tuesday-preview` / AdminEmailComposer preview), Resend dashboard preview, or a real inbox client  
**And** completion notes record **which** verification path was used and that the picks CTA reads as a primary button (not tiny text)

## Tasks / Subtasks

- [x] Task 1 — Shared email chrome + CTA styles (AC: #1, #2)
  - [x] Add shared module under `src/lib/email/templates/` (e.g. `email-styles.ts` and/or `EmailLayout.tsx`) exporting: body/container padding, heading/text sizes, section spacing, **primaryButton** style object, muted link/fallback style, optional brand header
  - [x] Brand tokens for email (inline hex OK — email clients do not use MUI theme): primary CTA `#2ECC71`, contrast `#FFFFFF`, body text dark on light canvas (recommend light email background `#f4f4f5` / white `#ffffff` card — **do not** force app dark `#121212` canvas; dark-mode email is fragile across clients)
  - [x] Prefer React Email primitives (`Html`, `Head`/`Preview`, `Body`, `Container`, `Section`, `Heading`, `Text`, `Button`, `Link`, `Hr` as needed) + **inline `style` objects** — match existing codebase (no new Tailwind-in-email dependency unless already adopted; project app is MUI, not Tailwind)
  - [x] **Anti-patterns:** raw `display:flex` / CSS Grid / external stylesheets; unstyled default `<Button>`; reinventing send/data helpers
- [x] Task 2 — Polish `TuesdayDigestEmail` (AC: #1, #2, #3)
  - [x] Apply shared layout; improve standings table readability (padding, borders/header weight, font sizes)
  - [x] Emphasize **"Make your picks"** primary button + plaintext `picksUrl` fallback
  - [x] Hierarchy: header → standings → jailed → **CTA** prominently → optional admin note (if CTA currently buried after a long note, move CTA **above** admin note so the action is not pushed below the fold)
  - [x] Keep `isTestLeague` notice; keep `Preview` optional but recommended if easy
- [x] Task 3 — Polish `ReminderEmail` (AC: #1, #2, #3)
  - [x] Shared layout; keep Wed/Thu copy + `<Preview>` preheader (6.3 regression — do not drop Preview)
  - [x] Primary button for **"Make your picks"** / **"Submit your pick now"** + plaintext fallback
- [x] Task 4 — Polish `InvitationEmail` + `PasswordResetEmail` (AC: #1, #2, #3)
  - [x] Shared layout + primary button styling
  - [x] **Required:** plaintext URL under reset button; same pattern for invite signup URL
  - [x] Keep reset expiry/once copy and “ignore if you didn’t request” text
- [x] Task 5 — Verify + deferred-work closure (AC: #4)
  - [x] Verify via local browser `render()` of Tuesday digest + password reset (accepted as AC4 path in code review); note path in Dev Agent Record
  - [x] Update `deferred-work.md`: mark email HTML / password-reset plaintext CTA as **Resolved (9.7)**; leave token-cleanup ops park; leave Resend domain post-epic-9
  - [x] Optional: colocated Vitest that `render()` HTML for each template contains the CTA label and the href (and plaintext fallback URL) — cheap regression; not a substitute for AC4 visual check
  - [x] `npm test` if any tests added/changed
  - [x] Do **not** change `from` address, Resend domain, or cron routes

### Review Findings

- [x] [Review][Decision] AC4 verification path — **Accepted (Kyle):** local `render()` HTML opened in browser counts as AC4 for this story; Completion Notes already match.
- [x] [Review][Decision] Out-of-scope working-tree files — **Keep with 9.7 changeset (Kyle):** include `AdminReminderControls.tsx` + `create-app-theme.ts` in File List / commit.
- [x] [Review][Patch] Align Task 5 wording with accepted AC4 path (local browser `render()`, not admin preview claim)
- [x] [Review][Patch] Restore Outlook-friendly standings table padding + align [`TuesdayDigestEmail.tsx:65`]
- [x] [Review][Patch] Add explicit border on primary button for Outlook link chrome [`email-styles.ts:primaryButtonStyle`]
- [x] [Review][Patch] Assert Thursday reminder plaintext fallback in tests [`email-templates.test.tsx`]
- [x] [Review][Patch] Remove unrelated “create account” TODO from sprint-status [`sprint-status.yaml`]
- [x] [Review][Patch] Fix stale `last_updated` comment (still says create-story → ready-for-dev) [`sprint-status.yaml`]
- [x] [Review][Patch] Harden standings row React key (rank+name collision) [`TuesdayDigestEmail.tsx:75`]
- [x] [Review][Patch] Add `AdminReminderControls.tsx` + `create-app-theme.ts` to File List
- [x] [Review][Defer] EmailLayout missing `<Head>` charset/viewport — deferred, pre-existing / not AC-required
- [x] [Review][Defer] Container `borderRadius` without MSO/VML Outlook fallback — deferred, pre-existing email-client limit
- [x] [Review][Defer] PrimaryCta empty/whitespace `href` guard — deferred, callers always pass constructed URLs
- [x] [Review][Defer] Jailed team empty-string (vs null) label edge — deferred, pre-existing data contract
- [x] [Review][Defer] Multipart `text/plain` MIME alongside HTML — deferred, out of scope (send path unchanged; AC3 is inline URL fallback)

## Dev Notes

### Locked product decisions (prevent thrash)

| Topic | Decision |
|-------|----------|
| Scope of “all emails” | All **four** React Email templates we control (invite, Tuesday, reminder, password reset) |
| CTA weight | Primary **button** with emerald fill + padding + larger type — not a text link and not unstyled React Email Button |
| Copy | Keep existing CTA labels; emphasis is visual |
| Shared system | Required — shared styles/layout module |
| Email canvas | Light body + white container (email-safe); brand emerald for CTAs — do **not** port full dark app chrome into HTML email |
| Plaintext fallback | Required on password reset; apply to all primary CTAs |
| CTA placement (digest) | Prefer CTA **above** optional admin note so action isn’t buried |
| Verification | At least one real preview path (admin Tuesday preview is enough if digest CTA looks correct; spot-check reminder/invite/reset via `render` locally or Resend) |
| Out of scope | Resend domain/`from`/DMARC; cron; token table cleanup; app UI |

### Current codebase ground truth (MUST reuse)

| Area | Path | Today |
|------|------|-------|
| Tuesday template | `src/lib/email/templates/TuesdayDigestEmail.tsx` | Minimal styles; unstyled `<Button>Make your picks</Button>` at bottom after admin note |
| Reminder template | `src/lib/email/templates/ReminderEmail.tsx` | Has `<Preview>`; unstyled Button; Wed/Thu labels |
| Invite template | `src/lib/email/templates/InvitationEmail.tsx` | Bare layout; unstyled Accept invitation |
| Reset template | `src/lib/email/templates/PasswordResetEmail.tsx` | Bare layout; Button only — **no plaintext URL** |
| Digest data / URL | `src/lib/email/get-tuesday-digest-data.ts` | `picksUrl` = `${getAppBaseUrl()}/leagues/${id}/picks` |
| Reminder data / URL | `src/lib/email/get-reminder-data.ts` | Same picks URL pattern |
| Send paths | `send-tuesday-digest.ts`, `send-reminder.ts`, `send-invitation-email.ts`, `send-password-reset-email.ts` | `createElement(Template, props)` — **do not change contracts** |
| Admin preview | `src/app/api/leagues/[leagueId]/email/tuesday-preview/route.ts` + `AdminEmailComposer.tsx` | `render(TuesdayDigestEmail)` → HTML — use for AC4 |
| Test labeling | `src/lib/email/test-league-labeling.ts` | Keep `[TEST]` subject + body notice behavior |
| Packages | `package.json` | `@react-email/components` ^1.0.12, `react-email` ^6.6.6, `resend` ^6.17.1 — **do not upgrade** unless required for a bug fix |

### Suggested primary button style (non-binding; must meet AC)

```ts
export const primaryButtonStyle = {
  backgroundColor: "#2ECC71",
  borderRadius: "8px",
  color: "#FFFFFF",
  display: "inline-block",
  fontSize: "16px",
  fontWeight: 700,
  lineHeight: "100%",
  padding: "14px 24px",
  textDecoration: "none",
  textAlign: "center" as const,
};
```

Pair with a muted plaintext fallback, e.g. `Text` + `Link` at ~14px / `#555` under the button.

### Architecture compliance

- Templates live in `src/lib/email/templates/*.tsx`; shared helpers beside them or under `src/lib/email/`.
- Server-only Resend keys stay server-side (`RESEND_API_KEY` never `NEXT_PUBLIC_*`).
- Presentational templates: visual verification preferred; optional `render()` smoke tests OK.
- Do not invent a second email stack (no MJML, no Handlebars).
- Epic 6 content/send/cron behavior stays; this story is HTML/CSS hierarchy only.

### UX compliance (email engagement)

From `ux-design-specification.md` (no dedicated email-HTML section — apply engagement + brand guidance):

**MUST**
- Treat email as the **primary engagement channel**; deep link must land on picks (already wired — polish visibility only).
- Primary action language / emerald CTA spirit: brand primary `#2ECC71` for the action button (app uses “Make Your Pick” / emerald CTAs).
- Clear visual hierarchy; one obvious next action per email.
- Mobile-friendly: readable type, padded container (~600px max width typical), large tap target on CTA.

**AVOID**
- Tiny body-sized CTA links (Kyle’s explicit complaint).
- Porting permanent dark app canvas into HTML email without client testing.
- Flex/grid/external CSS that breaks Outlook/Gmail.
- Scope creep into Resend domain ops or in-app UI.

### Deferred-work disposition (consulted while planning)

| Item | Disposition for 9.7 |
|------|---------------------|
| UI polish email HTML / password-reset CTA (launch triage) | **This story** — full layout + CTA emphasis |
| Password-reset Button-only / no plaintext URL (9.3 review) | **This story** — plaintext fallback on reset (+ all primary CTAs) |
| Password-reset token table cleanup / retention | **Park** — ops; not layout |
| UI polish hub / links / pick glow | **Resolved (9.6)** — do not reopen |
| Resend domain / `from` / DMARC | **Park** — `post-epic-9-resend-domain-and-from-address` |
| Email circuit-breaker / cron TOCTOU / Hobby drift | **Resolved or Accept** elsewhere — do not reopen |
| Deep-link auth edge cases (6.4 review) | **Out of scope** — not HTML layout |

### Previous story intelligence

**Story 9.6 (done):** Closed in-app hub CTAs, theme link color+underline, pick glow, retractable hide. Explicitly left **email HTML / make-my-picks CTA** to **9.7**. Pattern to echo: CTAs need **real visual weight** (`contained`-equivalent)—emails need the React Email equivalent (styled primary `Button`). App theme changes do **not** apply to email HTML.

**Story 9.3 (done):** Added `PasswordResetEmail` mirroring invite structure; deferred plaintext URL fallback to 9.7.

**Story 6.2 / 6.3 (done):** Established React Email templates, digest preview route, reminder Preview preheader. Client-compat guidance: inline styles + React Email primitives; avoid flex/grid. Reuse send/`render` paths—only restyle templates.

**Story 6.4 (done):** Deep links already point at `/leagues/{id}/picks`; do not change URL construction.

**Git recent pattern:** `feat(ui): Story 9.6 …`, `feat(app-shell): Story 9.5 …`. Prefer `feat(email): Story 9.7 — email HTML layout + primary CTA polish`.

### Latest tech notes (React Email)

- `@react-email/components` `Button` is an `<a>` styled as a button; **without** `style`/`className` it looks like a small link — always set padding + background + fontSize.
- Prefer **inline style objects** for this repo (existing pattern). If considering Tailwind wrapper: only with `pixelBasedPreset`; avoid `sm:`/`md:` breakpoints (poor client support). Not required for this story.
- Outlook padding quirks: React Email `Button` includes known workarounds — keep using `Button`, don’t replace with bare `<a>` unless necessary.
- Keep HTML payload lean (Gmail clips large messages); no heavy images required for this polish.

### Testing requirements

1. Manual / preview (required for AC4): Tuesday admin preview — confirm emerald primary CTA size/weight; hierarchy; plaintext fallback visible.
2. Spot-check reminder + invite + reset via local `render()` or a test send to own inbox if Resend sandbox available.
3. Optional Vitest: `render(createElement(Template, fixtureProps))` asserts CTA label + href substring present for each template (and plaintext URL for reset).
4. Existing data/send tests must still pass — do not break prop contracts.
5. `npm test` after any test additions.
6. Prefer not mocking Next.js; template `render()` tests are pure enough.

### Project Structure Notes

**Update (expected):**
- `src/lib/email/templates/email-styles.ts` and/or `EmailLayout.tsx` (new shared chrome)
- `src/lib/email/templates/TuesdayDigestEmail.tsx`
- `src/lib/email/templates/ReminderEmail.tsx`
- `src/lib/email/templates/InvitationEmail.tsx`
- `src/lib/email/templates/PasswordResetEmail.tsx`
- Optional: `src/lib/email/templates/*.test.tsx` (render smoke)
- `_bmad-output/implementation-artifacts/deferred-work.md` — resolve 9.7-owned email HTML / plaintext CTA rows

**Do not create:** new email provider, new cron routes, MJML pipeline, dark-mode email theme system, in-app MUI changes for this story.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 9; Story 9.7 Source requirements + ACs]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR35–FR40, FR2; mobile-friendly email templates with clear CTAs; NFR27/32–34 delivery (context)]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Email as primary engagement channel; deep links; emerald primary `#2ECC71` for CTAs]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — `src/lib/email/` + React Email / Resend; server-only secrets]
- [Source: `docs/project-context.md` — Epic 9 polish; Vitest colocated tests; no client email keys]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — email HTML / password-reset CTA owned by 9.7]
- [Source: `_bmad-output/implementation-artifacts/9-6-league-hub-and-picks-interaction-polish.md` — defers email to 9.7; CTA weight lesson]
- [Source: `_bmad-output/implementation-artifacts/6-2-tuesday-6-00-pm-league-email-content-and-admin-preview.md` — template + preview patterns]
- [Source: `_bmad-output/implementation-artifacts/6-3-wednesday-and-thursday-reminders.md` — ReminderEmail + Preview]
- [Source: `docs/email-local-smoke-test-runbook.md` — local preview/send paths]
- [Source: `src/lib/email/templates/*.tsx`]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

### Implementation Plan

- Shared `email-styles.ts` tokens + `EmailLayout` / `PrimaryCta` chrome so all four templates share one visual system.
- Restyle templates only; no send/data/cron/`from` changes. Digest CTA moved above admin note.
- Optional `render()` Vitest smoke + browser visual check of rendered HTML.

### Completion Notes List

- Shared light canvas (`#f4f4f5` / white card), Pick Six brand header, emerald `#2ECC71` primary buttons (16px / 700 / `14px 24px` padding), muted “Or paste this link:” fallbacks on all primary CTAs.
- Digest hierarchy: standings → jailed → **Make your picks** → commissioner note. Reminder Preview preheaders preserved. Reset expiry/once + ignore copy preserved.
- **AC4 verification:** Local `render()` HTML opened in browser (Tuesday digest + password reset spot-check) — **accepted as AC4 path** (code review 2026-07-31). Confirmed emerald primary CTA reads as a real button (not tiny body text); plaintext fallback visible; CTA above commissioner note.
- `deferred-work.md`: email HTML / plaintext CTA marked **Resolved (9.7)**; token cleanup remains ops park; Resend domain remains post-epic-9.
- `npm test`: 520 passed (including new `email-templates.test.tsx`).

### File List

- `src/lib/email/templates/email-styles.ts` (new)
- `src/lib/email/templates/EmailLayout.tsx` (new)
- `src/lib/email/templates/TuesdayDigestEmail.tsx`
- `src/lib/email/templates/ReminderEmail.tsx`
- `src/lib/email/templates/InvitationEmail.tsx`
- `src/lib/email/templates/PasswordResetEmail.tsx`
- `src/lib/email/templates/email-templates.test.tsx` (new)
- `src/components/admin/AdminReminderControls.tsx` (unified reminder send feedback UI)
- `src/theme/create-app-theme.ts` (TextField focused ring cleanup)
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/9-7-email-html-layout-polish.md`

## Change Log

- 2026-07-31: Story 9.7 — email HTML layout polish + primary CTA emphasis + plaintext fallbacks across all four templates.
- 2026-07-31: Code review — Outlook table padding/align + button border; Thursday fallback test; sprint-status cleanup; File List includes admin reminder + theme tweaks.

---

**Ultimate context engine analysis completed — comprehensive developer guide created.**
