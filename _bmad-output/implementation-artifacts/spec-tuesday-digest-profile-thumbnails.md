---
title: 'Tuesday digest profile picture thumbnails'
type: 'feature'
created: '2026-08-09'
status: 'done'
baseline_commit: '4ad4ed084d24576f21546e3cf23bd6947c57453f'
context:
  - '{project-root}/docs/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-profile-picture-list-thumbnails.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** In-app standings show profile picture list thumbs when `User.image` is set, but Tuesday digest emails still render name-only standings rows — recipients lose that identity cue in the weekly email.

**Approach:** Pass nullable `imageUrl` through digest send + admin preview into `TuesdayDigestEmail` standings rows; render a small email-safe thumb left of the name when set, with initials fallback when missing or broken.

## Boundaries & Constraints

**Always:**
- Reuse existing `StandingsEntry.imageUrl` from `getLeagueStandings` / `getTuesdayDigestData` — do not add a second fetch or parallel field.
- Thread `imageUrl: string | null` through send + tuesday-preview props maps (today both strip it).
- Email HTML only: use `@react-email` `Img` (or plain `<img>`) + inline styles; reuse `userInitials` from `@/lib/avatar` for the null/missing fallback. Do **not** use MUI `UserAvatar` in email templates.
- Name cell: thumb (~28px, matching list size) left of display name; keep Rank | Name | Points table structure.
- Prefer email-client-safe layout (nested table / inline styles). Square thumbs are OK — do not require perfect circles in Outlook.
- Treat `User.image` Blob URLs as already-absolute public `src` values (same as in-app).

**Ask First:**
- Embedding images as CID/base64 attachments instead of remote Blob URLs.
- Changing reminder emails or non-digest templates in this pass.

**Never:**
- Redesign digest layout beyond the standings Name cell.
- Port app dark mode / MUI chrome into email.
- Rewrite PRD / planning docs for this pass.
- Store or re-upload avatar bytes for email delivery.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Photo set | Standings row `imageUrl` non-empty URL | Digest Name cell shows ~28px `<img src=…>` left of display name | N/A |
| Photo null | `imageUrl` null / empty | Initials (same `userInitials` rules) left of name — no broken img | N/A |
| Mixed rows | Some members with photos, some without | Each row follows its own imageUrl | N/A |
| Admin preview | Preview render with same standings data | Preview HTML matches send: thumbs + initials | N/A |
| Remote img blocked | Client blocks remote images | Name + initials still readable; no layout crash | Graceful degrade |

</frozen-after-approval>

## Code Map

- `src/lib/scoring/get-league-standings.ts` -- already maps `imageUrl`; no change expected
- `src/lib/email/get-tuesday-digest-data.ts` -- returns `StandingsEntry[]` including `imageUrl`
- `src/lib/email/send-tuesday-digest.ts` -- standings props map currently omits `imageUrl`
- `src/app/api/leagues/[leagueId]/email/tuesday-preview/route.ts` -- same omit in preview render
- `src/lib/email/templates/TuesdayDigestEmail.tsx` -- Name cell is text-only today
- `src/lib/email/templates/email-styles.ts` -- add compact avatar/name cell styles if needed
- `src/lib/avatar.ts` -- `userInitials` for email fallback
- `src/lib/email/templates/email-templates.test.tsx` -- assert img src / initials in rendered HTML
- `src/lib/email/send-tuesday-digest.test.ts` -- update if props mapping is asserted

## Tasks & Acceptance

**Execution:**
- [x] `TuesdayDigestEmail.tsx` (+ `email-styles.ts` if needed) -- widen standings prop with `imageUrl`; Name cell thumb or initials -- email-safe identity
- [x] `send-tuesday-digest.ts` + `tuesday-preview/route.ts` -- include `imageUrl` in standings maps -- parity send/preview
- [x] `email-templates.test.tsx` (+ send test if needed) -- cover photo row (`src=` URL) and null-row initials -- lock I/O matrix
- [x] `npm test` -- verify email template/send suites

**Acceptance Criteria:**
- Given a standings member with `imageUrl` set, when Tuesday digest HTML is rendered (send or admin preview), then a ~28px image appears left of their display name with that URL as `src`
- Given a standings member with null/empty `imageUrl`, when digest HTML is rendered, then initials appear left of the name and no empty/broken avatar image tag is emitted for that row
- Given mixed standings, when digest HTML is rendered, then each row independently shows photo or initials
- Given existing Rank/Points columns and CTA/jailed/admin-note sections, when this change ships, then those remain unchanged in structure and copy

## Spec Change Log

## Design Notes

Email clients fetch remote `src` directly (not Next/`remotePatterns`). Prefer:

```tsx
// Name cell sketch — nested table or inline img + text
{imageUrl ? <Img src={imageUrl} width={28} height={28} alt="" /> : <span>{userInitials(displayName)}</span>}
{" "}
{displayName}
```

Do not use `next/image` or client MUI in this template.

## Verification

**Commands:**
- `npm test` -- email template + send suites pass; new assertions green

**Manual checks (if no CLI):**
- Admin Tuesday digest preview for a league with at least one member who has uploaded a profile photo — Name cell shows thumb; members without photos show initials

## Suggested Review Order

**Email Name cell**

- http(s) guard + initials `alt` for blocked/broken remote images
  [`TuesdayDigestEmail.tsx:45`](../../src/lib/email/templates/TuesdayDigestEmail.tsx#L45)

- Nested identity table left of display name in standings rows
  [`TuesdayDigestEmail.tsx:122`](../../src/lib/email/templates/TuesdayDigestEmail.tsx#L122)

- Compact 28px avatar/initials inline styles for email clients
  [`email-styles.ts:154`](../../src/lib/email/templates/email-styles.ts#L154)

**Props plumbing**

- Include `imageUrl` on digest send standings map
  [`send-tuesday-digest.ts:148`](../../src/lib/email/send-tuesday-digest.ts#L148)

- Same map for admin preview parity
  [`tuesday-preview/route.ts:86`](../../src/app/api/leagues/[leagueId]/email/tuesday-preview/route.ts#L86)

**Tests**

- Photo, null, blank, and non-http URL cases in rendered HTML
  [`email-templates.test.tsx:45`](../../src/lib/email/templates/email-templates.test.tsx#L45)
