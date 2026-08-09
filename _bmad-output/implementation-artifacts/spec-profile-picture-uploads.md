---
title: 'Profile picture uploads'
type: 'feature'
created: '2026-08-09'
status: 'done'
baseline_commit: 'ebd73b337c9d80f714ecac25eaecebca621af639'
context:
  - '{project-root}/docs/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-user-first-last-name-profile.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Users only appear as initials in the nav account menu. There is no way to upload a personal profile picture.

**Approach:** Add profile-picture upload/edit/remove at the top of `/profile` (Vercel Blob, crop+zoom on choose/replace). Persist the public URL on existing `User.image`. Show the photo in the nav menu Avatar, or the same initials treatment when null.

## Boundaries & Constraints

**Always:**
- Use **Vercel Blob** for binary storage; persist the public blob URL on **`User.image`** (nullable string already on the model — no parallel column).
- Profile form surfaces avatar controls **above** email/name fields: upload (null → photo), edit/replace (crop+zoom), remove (photo → null).
- **Crop + zoom** editor runs client-side on upload and on edit/replace; produce a square image before upload. Default/null state and remove do not open the cropper.
- Accept **JPEG / PNG / WebP**; reject other types. Max upload size **5MB** (pre-crop source file).
- Null/missing `image` renders the **same initials Avatar** treatment used in the nav menu today (shared helper/component).
- When `image` is set, nav menu Avatar uses it (`src`); session/JWT must carry and **refresh** `image` after upload/replace/remove (same `session.update()` + DB re-read pattern as name/email — never trust client-supplied image URL on update).
- Upload/replace/remove APIs: authenticated, CSRF origin check, Zod/content validation, structured JSON errors; rate-limit mutators in `src/proxy.ts`.
- On replace/remove, delete the previous blob when safely possible (best-effort; DB URL must still clear on remove).
- Allow Blob host(s) in Next image config if `next/image` is used.
- Document `BLOB_READ_WRITE_TOKEN` in `.env.example`.

**Ask First:**
- Raising max size above 5MB or adding GIF/animated formats.
- Paid image CDN / non-Blob storage.
- Expanding this pass to list-surface or email thumbnails (deferred to Priority Items / deferred-work).

**Never:**
- Store image bytes in Postgres or as large data-URLs in `User.image`.
- Skip crop/zoom on upload/replace (replace must re-open editor).
- Implement standings/results/roster/admin/email avatar thumbs in this pass (tracked separately).
- Rewrite planning docs / PRD for this feature.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Upload happy | Authed; valid ≤5MB image; crop confirm | Blob stored; `User.image` set; session refresh; nav shows photo | N/A |
| Edit/replace | Existing photo; new crop confirm | New blob URL saved; old blob deleted best-effort; nav updates | N/A |
| Remove | Existing photo; user removes | `User.image` null; nav reverts to initials | N/A |
| Default null | Never uploaded | Initials avatar on Profile + nav | N/A |
| Too large | Source file >5MB | Rejected before/at upload | Clear size error; no DB change |
| Bad type | e.g. PDF/GIF | Rejected | Clear type error |
| Unauthenticated | No session | 401 / login redirect | No blob write |
| CSRF fail | Bad/missing origin | 403 | No blob write |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` -- `User.image` already exists; no schema change unless docs/comments clarify usage
- `src/app/(app)/profile/page.tsx` + `profile-client.tsx` -- load/pass `image`; avatar UI at top of form
- `src/app/api/profile/route.ts` + `src/lib/profile.ts` -- keep JSON profile fields; avatar uses separate upload routes
- `src/app/api/profile/avatar/route.ts` (new) -- POST multipart upload + DELETE remove; Blob + DB
- `src/lib/avatar.ts` (new) + tests -- initials helper, mime/size limits, shared types
- `src/components/user/UserAvatar.tsx` (new) -- shared MUI Avatar: `src` or initials; size variants
- `src/lib/auth.ts` + `src/types/next-auth.d.ts` -- JWT/session include + refresh `image`
- `src/app/(app)/layout.tsx` + `LeagueNavShell.tsx` + `UserNavMenu.tsx` -- pass `image` into nav Avatar
- `src/proxy.ts` -- rate-limit avatar POST/DELETE
- `next.config.ts` -- Blob `images.remotePatterns` if needed
- `package.json` -- `@vercel/blob` + client crop library (e.g. `react-easy-crop`)
- `.env.example` -- `BLOB_READ_WRITE_TOKEN`

## Tasks & Acceptance

**Execution:**
- [x] `package.json` + `.env.example` + `next.config.ts` -- add `@vercel/blob`, crop dep, Blob env + image host allowlist -- storage/runtime baseline
- [x] `src/lib/avatar.ts` (+ `avatar.test.ts`) -- initials (match current nav rules), mime allowlist, 5MB limit helpers -- pure rules
- [x] `src/components/user/UserAvatar.tsx` -- shared Avatar (`imageUrl` + `displayName` + size) -- one visual language
- [x] `src/app/api/profile/avatar/route.ts` -- POST (multipart → validate → client-cropped file → Blob put → set `User.image`, delete prior) + DELETE (null image, delete blob); CSRF; JSON errors -- mutators
- [x] `src/proxy.ts` -- rate-limit avatar mutators -- abuse guard
- [x] `src/lib/auth.ts` + types -- session/JWT `image` on login and on `trigger === "update"` DB re-read -- nav freshness
- [x] `src/app/(app)/profile/page.tsx` + `profile-client.tsx` -- top-of-form avatar: preview, Upload/Change (crop+zoom modal), Remove; call avatar API then `session.update()` + `router.refresh()` -- primary UX
- [x] `UserNavMenu.tsx` + layout/shell wiring -- photo or initials -- nav parity
- [x] Colocated helper tests for matrix (size/type/initials) -- lock edge cases

**Acceptance Criteria:**
- Given Profile with no photo, when viewing the form and nav, then the initials avatar matches today’s nav initials rules
- Given Profile, when the user uploads via crop+zoom and confirms, then Blob + `User.image` update, session refreshes, and nav shows the photo
- Given an existing photo, when the user edits (crop+zoom) or removes, then the photo updates or reverts to initials on Profile and nav
- Given file >5MB or disallowed type, when uploading, then the API/UI rejects with a clear error and does not change `User.image`
- Given `npm test` for touched helpers, when run, then tests pass

## Spec Change Log

## Design Notes

**Reuse `User.image`:** Auth.js already returns `image` from `authorize`; wire JWT/session callbacks the same way as `name`/`email` on `update` (DB reload by `token.id`).

**Crop UX:** Modal/dialog: image + zoom slider + square mask → canvas export (e.g. JPEG/WebP ~reasonable quality) → `FormData` POST. Keep server validation of mime + byte size even after client crop.

**Follow-ons (not this pass):** List-surface and Tuesday digest thumbs are in `PRIORITIES.md` and `deferred-work.md`.

## Verification

**Commands:**
- `npm test` -- expected: pass, including new avatar helper tests
- `npx tsc --noEmit` -- expected: no new type errors in touched files

**Manual checks:**
- Profile: upload → crop → save → nav photo; replace; remove → initials
- Confirm `BLOB_READ_WRITE_TOKEN` set in local `.env.local` before manual upload works

## Suggested Review Order

**Upload API**

- Entry point: multipart POST, CSRF, sniff, Blob put, DB update, orphan cleanup
  [`route.ts:32`](../../src/app/api/profile/avatar/route.ts#L32)

- Early Content-Length / file.size reject before buffering the body
  [`route.ts:46`](../../src/app/api/profile/avatar/route.ts#L46)

- Compensating Blob delete if Prisma update fails after put
  [`route.ts:139`](../../src/app/api/profile/avatar/route.ts#L139)

**Profile UX**

- Avatar block above form fields with upload/change/remove
  [`profile-client.tsx:359`](../../src/app/(app)/profile/profile-client.tsx#L359)

- Crop+zoom dialog → JPEG blob → FormData POST
  [`AvatarCropDialog.tsx:71`](../../src/components/user/AvatarCropDialog.tsx#L71)

**Session + nav**

- JWT/session `picture` on login, update, and one-time hydrate
  [`auth.ts:99`](../../src/lib/auth.ts#L99)

- Shared Avatar (photo or initials) in account menu
  [`UserNavMenu.tsx:61`](../../src/components/layout/UserNavMenu.tsx#L61)

**Guards + helpers**

- Proxy rate limit for avatar POST/DELETE (trailing slash too)
  [`proxy.ts:97`](../../src/proxy.ts#L97)

- Initials + mime/size rules shared by UI and API
  [`avatar.ts:24`](../../src/lib/avatar.ts#L24)

- Shared `UserAvatar` sizes for profile/nav/future lists
  [`UserAvatar.tsx:22`](../../src/components/user/UserAvatar.tsx#L22)

**Config / tests**

- Blob env documented for local/prod
  [`.env.example:21`](../../.env.example#L21)

- Colocated helper coverage for initials/size/type
  [`avatar.test.ts:1`](../../src/lib/avatar.test.ts#L1)
