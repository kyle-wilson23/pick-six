---
title: 'Profile picture list thumbnails (in-app)'
type: 'feature'
created: '2026-08-09'
status: 'done'
baseline_commit: '412c2f1f9296d469e56596be24b76a485d8dc653'
context:
  - '{project-root}/docs/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-profile-picture-uploads.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Profile photos persist on `User.image` and show on `/profile`, but in-app list surfaces still show name-only rows, and the nav account avatar often stays on initials even after a successful upload (session/JWT image not reliably reaching the shell).

**Approach:** Thread nullable `imageUrl` beside `displayName` through standings, results, opponents’ picks, roster, and admin submission cards; render shared `UserAvatar` (`size="list"`) left of the name. Harden nav so the photo appears from session after upload/replace/remove (and after re-login when `User.image` is set).

## Boundaries & Constraints

**Always:**
- Reuse `UserAvatar` + `userInitials` — photo when `imageUrl` is a non-empty string; same initials fallback when null/missing.
- List thumbs use `size="list"`; nav keeps `size="nav"`.
- Extend existing Prisma `user` selects with `image` and map to `imageUrl: string | null` on row/DTO types (do not invent a parallel field or fetch blobs server-side).
- Name cell layout: `Stack` row, avatar then name text (mirror `UserNavMenu`); do not introduce new card chrome solely for the avatar.
- Roster hub is a Server Component — extract a small `"use client"` identity cell (or shared helper component) before using `UserAvatar`.
- Nav must show the photo when JWT/session has `image`, and must refresh after Profile upload/replace/remove without requiring a full re-login. Prefer client `useSession()` for the live nav src when available, with the layout SSR prop as initial/fallback.
- Preserve pick-visibility rules; only add public avatar URLs already stored on `User.image`.

**Ask First:**
- Tuesday digest (or any email) avatar thumbs — separate Priority item; do not implement here.
- Changing Blob hosts / `next/image` for avatars (MUI `Avatar` `src` is fine today).

**Never:**
- Store image bytes in list payloads or Postgres beyond the existing URL string.
- Redesign standings/results/roster layouts beyond name-cell thumbnails.
- Rewrite PRD / planning docs for this pass.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| List + photo | Member has `User.image` URL | All five surfaces show thumb left of name | N/A |
| List + null | Member never uploaded | Initials avatar + name (same initials rules) | N/A |
| Nav after upload | Upload/replace succeeds; session refresh | Nav `UserAvatar` shows new photo | If session refresh fails, surface a clear Profile error (do not silently leave nav stale) |
| Nav after remove | Remove succeeds | Nav reverts to initials | Same refresh error handling |
| Nav re-login | `User.image` set; user signs in | Nav shows photo without visiting Profile | N/A |
| Broken URL | Non-null URL fails to load | MUI Avatar falls back to initials children | No crash |

</frozen-after-approval>

## Code Map

- `src/components/user/UserAvatar.tsx` -- shared sizes; list = 28px
- `src/components/layout/UserNavMenu.tsx` + `LeagueNavShell.tsx` + `src/app/(app)/layout.tsx` -- nav wiring; harden live session image
- `src/app/(app)/profile/profile-client.tsx` -- `refreshSessionAndPage` / `update()` after avatar mutations
- `src/lib/auth.ts` -- JWT `picture` ↔ session `image` on login + `trigger === "update"`
- `src/lib/scoring/get-league-standings.ts` + `StandingsTable.tsx` -- standings rows
- `src/lib/scoring/get-league-peer-pick-history.ts` + `LeagueResultsTable.tsx` -- results rows
- `src/lib/picks/get-league-week-peer-picks.ts` + `OpponentsPicksTable.tsx` -- opponents’ picks
- `src/lib/league/list-league-roster.ts` + `src/app/(app)/leagues/[leagueId]/page.tsx` -- roster (needs client cell)
- `src/lib/admin/build-submission-status.ts` + `AdminSubmissionCard.tsx` + `AdminDashboardClient.tsx` -- admin cards
- Colocated `*.test.ts(x)` for loaders/tables that assert row shape

## Tasks & Acceptance

**Execution:**
- [x] `UserNavMenu.tsx` (+ profile refresh path if needed) -- show photo from `useSession().user.image` when set, falling back to `userImageUrl` prop; ensure avatar upload/remove does not swallow a failed `update()` without user-visible feedback -- fix nav staleness
- [x] `get-league-standings.ts` + `StandingsTable.tsx` (+ tests) -- select/map `imageUrl`; render list `UserAvatar` + name -- standings
- [x] `get-league-peer-pick-history.ts` + `LeagueResultsTable.tsx` (+ tests if present) -- same `imageUrl` plumbing -- results
- [x] `get-league-week-peer-picks.ts` + `OpponentsPicksTable.tsx` (+ tests if present) -- same -- opponents’ picks
- [x] `list-league-roster.ts` + new small client identity cell + league hub `page.tsx` -- same -- roster
- [x] `build-submission-status.ts` + `AdminSubmissionCard.tsx` + dashboard wiring (+ tests) -- same -- admin cards
- [x] `npm test` for touched helpers/components -- lock row shape + initials/photo rendering where tests exist
- [x] `UserIdentityCell.tsx` -- shared list identity cell used by all five surfaces

**Acceptance Criteria:**
- Given a member with `User.image` set, when viewing standings, results, opponents’ picks, roster, and admin submission status, then a list-size photo thumb appears left of their display name
- Given a member with null `User.image`, when viewing those surfaces, then initials avatar appears (same rules as Profile/nav) left of the name
- Given a successful Profile photo upload or replace, when the session refresh completes, then the nav account avatar shows the new photo without re-login
- Given a successful Profile photo remove, when the session refresh completes, then the nav avatar shows initials
- Given `User.image` already set, when the user signs in fresh, then the nav avatar shows the photo
- Given `npm test` for touched files, when run, then tests pass

## Spec Change Log

## Verification

**Commands:**
- `npm test` -- expected: pass (including updated loader/table tests)
- `npx tsc --noEmit` -- expected: no new errors in touched files

**Manual checks:**
- Upload on Profile → nav photo updates; hard refresh still shows photo
- Remove photo → nav initials; list rows for that user show initials
- Spot-check all five list surfaces for a user with a photo and one without

## Suggested Review Order

**Shared identity cell**

- List-size avatar + name; decorative `alt=""`; title for truncated names
  [`UserIdentityCell.tsx:18`](../../src/components/user/UserIdentityCell.tsx#L18)

**Nav harden**

- Live `useSession` image with SSR prop fallback (`undefined` vs `null`)
  [`UserNavMenu.tsx:32`](../../src/components/layout/UserNavMenu.tsx#L32)

- Surface failed `session.update()` after avatar save so nav is not silently stale
  [`profile-client.tsx:105`](../../src/app/(app)/profile/profile-client.tsx#L105)

**Data plumbing (`User.image` → `imageUrl`)**

- Standings select + map
  [`get-league-standings.ts:47`](../../src/lib/scoring/get-league-standings.ts#L47)

- Results / peer history
  [`get-league-peer-pick-history.ts:103`](../../src/lib/scoring/get-league-peer-pick-history.ts#L103)

- Opponents’ picks merge
  [`get-league-week-peer-picks.ts:41`](../../src/lib/picks/get-league-week-peer-picks.ts#L41)

- Roster list
  [`list-league-roster.ts:45`](../../src/lib/league/list-league-roster.ts#L45)

- Admin submission status
  [`build-submission-status.ts:56`](../../src/lib/admin/build-submission-status.ts#L56)

**UI binding**

- Standings name cell
  [`StandingsTable.tsx:88`](../../src/components/standings/StandingsTable.tsx#L88)

- Results name cell
  [`LeagueResultsTable.tsx:157`](../../src/components/results/LeagueResultsTable.tsx#L157)

- Opponents’ picks name cell
  [`OpponentsPicksTable.tsx:50`](../../src/components/picks/OpponentsPicksTable.tsx#L50)

- League hub roster (server page → client cell)
  [`page.tsx:101`](../../src/app/(app)/leagues/[leagueId]/page.tsx#L101)

- Admin cards + overflow-safe row
  [`AdminSubmissionCard.tsx:63`](../../src/components/admin/AdminSubmissionCard.tsx#L63)

**Tests**

- Loader `imageUrl` mapping (standings)
  [`get-league-standings.test.ts:162`](../../src/lib/scoring/get-league-standings.test.ts#L162)

- Opponents row shape
  [`get-league-week-peer-picks.test.ts:99`](../../src/lib/picks/get-league-week-peer-picks.test.ts#L99)
