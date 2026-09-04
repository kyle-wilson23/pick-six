---
title: 'Creator admin superuser (debug observer)'
type: 'feature'
created: '2026-09-04'
status: 'done'
baseline_commit: 'c6a0933a9b221965107bf4511e3fb38c1d8b0069'
context:
  - '{project-root}/docs/project-context.md'
  - '{project-root}/docs/deployment.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The creator cannot inspect production leagues or use league-admin tools without joining as a player (FR13). Membership-based listing and `ADMIN`/`MEMBER` gates make a private debug login impossible.

**Approach:** Designate exactly one account via server-only `SUPERUSER_EMAIL`. That signed-in user can see every league, open every league page, and use every league-admin feature, but is never a participant (no own picks, roster, standings, or league email).

## Boundaries & Constraints

**Always:**
- Match with `normalizeEmail` against `process.env.SUPERUSER_EMAIL`. Unset/blank → nobody is superuser.
- Login is the existing email/password flow. Create the User at `/create-account` with that address and a password only the creator chooses. No seed user, no initial password in env or code. Prefer a dedicated address, not a playing account.
- Superuser is **not** a `LeagueMembershipRole`. Do not synthesize a `leagueMembershipId`.
- League **view**: membership **or** superuser. League **admin** (pages, APIs, nav, NFL/scoring admin routes): `role === ADMIN` **or** superuser. **Participant** (own picks, roster, standings, digest/reminders, submission-status rows): participant role **and not** superuser — even if an ADMIN membership row exists (e.g. they created a league).
- Homepage **and** `/leagues`: superuser sees **all** leagues (admin card/list). Joined card stays membership-only.
- Picks UI may render for viewing; self-submit control is disabled; `POST /api/leagues/[leagueId]/picks` is 403. Admin submit-on-behalf stays allowed.
- Inviting or accepting `SUPERUSER_EMAIL` into a league is rejected.
- Regular members/admins unchanged when env is unset or email does not match.

**Ask First:**
- Supporting more than one superuser email.
- A UI or API to grant/revoke superuser (anything other than the env var).
- Showing the superuser on a roster/standings/email list.
- Letting the superuser submit their own picks.

**Never:**
- `NEXT_PUBLIC_SUPERUSER_EMAIL` or sending this env to the client.
- Adding `SUPERUSER` to the Prisma role enum.
- Treating superuser as a player so they can “just pick.”
- Skipping CSRF, Zod, or audit on admin mutations they are allowed to perform.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Home / `/leagues` as superuser | Session email matches env; 0 memberships | Admin list shows every league; joined list empty | N/A |
| Open any league | Superuser, no membership | Hub + admin/settings/invites load; nav shows admin tabs | Unknown league id → existing `notFound()` |
| Self pick | Superuser `POST .../picks` | 403 `{ error: { code, message } }` | No pick row written |
| On-behalf pick | Superuser `POST .../admin/picks` | Same success path as league admin | Existing validation/audit |
| NFL admin API | Superuser, no ADMIN memberships | `assertAuthorizedForNflOddsOps` allows (session still required) | Unauthenticated still 401 |
| Invite superuser email | Admin invites that address | 4xx, no invitation (or no accept) | Existing JSON error shape |
| Env unset | Any user | Behavior identical to today | N/A |
| Case/whitespace | Env `Kyle@X.com `, user `kyle@x.com` | Treated as superuser | N/A |
| Non-superuser member | No env match | Unchanged listing, gates, picks | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/normalize-email.ts` -- compare env vs session email
- `src/lib/league/allow-test-leagues.ts` -- injectable-env helper pattern to copy
- `src/lib/league/get-league-access.ts` -- today null without membership; widen with `isAdmin` / `isParticipant` / `isSuperuser`
- `src/lib/league/participant-membership.ts` -- player check; do not use alone for “may open league”
- `src/lib/league/list-administered-leagues.ts` / `list-joined-leagues.ts` -- home + `/leagues` + `GET /api/leagues`
- `src/app/(app)/home/page.tsx` / `src/app/(app)/leagues/page.tsx` -- list wiring
- `src/app/(app)/leagues/[leagueId]/layout.tsx` -- participant-only `notFound()`; `isAdmin` for nav
- `src/app/(app)/leagues/[leagueId]/{admin,settings,picks,...}/page.tsx` -- repeat the same gates
- `src/lib/picks/build-league-picks-week-view.ts` -- 403 without membership; needs superuser viewer path (no current-pick slot)
- `src/app/api/leagues/[leagueId]/picks/route.ts` -- self-submit
- `src/app/api/leagues/[leagueId]/**/route.ts` -- inline `role === ADMIN`
- `src/lib/nfl/authorize-odds-admin.ts` -- any-league ADMIN or bearer
- `src/lib/league/delete-league-authorization.ts` -- pure delete gate
- `src/lib/accept-league-invitation.ts` / `src/app/api/leagues/[leagueId]/invitations/route.ts` -- invite/accept
- `src/lib/league/list-league-roster.ts` / `src/lib/scoring/get-league-standings.ts` / `src/lib/email/get-tuesday-digest-data.ts` / `src/lib/email/get-reminder-data.ts` / `src/lib/admin/build-submission-status.ts` -- membership-as-player lists
- `.env.example` / `docs/deployment.md` -- env contract

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/auth/is-superuser.ts` (+ `is-superuser.test.ts`) -- `isSuperuserEmail(email, env?)` via `normalizeEmail`; blank env → false -- single designation
- [x] `src/lib/league/get-league-access.ts` (+ tests) -- pass session email; if superuser and league exists, return access with `membership: null` allowed; set `isAdmin` / `isParticipant` / `isSuperuser` -- do not mint membership ids
- [x] `src/lib/league/require-league-admin.ts` (name as implemented) -- shared page/API helper: superuser or ADMIN membership; 401/403/`notFound()` per existing layer -- stop copying `role === ADMIN`
- [x] `src/lib/league/list-administered-leagues.ts` (+ tests) -- superuser → all leagues (name sort ok when `lastVisitedAt` missing) -- homepage + `/leagues`
- [x] `src/app/(app)/home/page.tsx` / `leagues/page.tsx` / `leagues/[leagueId]/layout.tsx` and sibling pages -- view if member or superuser; admin UI if `isAdmin`; nav `isAdmin` true for superuser -- navigation without playing
- [x] `src/lib/picks/build-league-picks-week-view.ts` + picks page -- superuser viewer (matchups, no interactive self-pick) -- inspect without participating
- [x] `src/app/api/leagues/[leagueId]/picks/route.ts` -- 403 self-submit when superuser -- server authority
- [x] League-scoped admin `route.ts` files under `src/app/api/leagues/[leagueId]/` + `src/lib/nfl/authorize-odds-admin.ts` + `src/lib/league/delete-league-authorization.ts` + `src/app/api/admin/**` -- use shared admin helper (pass email into NFL helper) -- full admin writes
- [x] Invite create/accept + `src/lib/accept-league-invitation.ts` -- reject superuser email -- cannot join as player
- [x] Roster, standings, digest/reminder recipients, submission-status, peer-pick membership queries -- exclude superuser emails -- not on player surfaces
- [x] `.env.example` + `docs/deployment.md` -- document `SUPERUSER_EMAIL` as server-only singleton -- ops
- [x] Colocated tests for I/O matrix helpers (superuser email, access flags, delete auth, NFL auth, administered list) -- lock gates

**Acceptance Criteria:**
- Given `SUPERUSER_EMAIL` matches the session, when they open `/home` and `/leagues`, then every league appears on the admin list and they can open hub, picks (view), standings, results, history, rules, admin, settings, and invites.
- Given that session, when they `POST` their own pick, then the API returns 403 and no pick is stored; when they use admin on-behalf / other admin mutations, then those succeed as for a league admin (same CSRF/Zod/audit).
- Given an admin invites `SUPERUSER_EMAIL`, when create or accept runs, then it fails and no participant membership is used as a player.
- Given `SUPERUSER_EMAIL` is unset, when a normal admin or member uses the app, then listing, picks, and admin gates match current behavior.

## Design Notes

Capability flags belong on league access, not a fake membership:

```ts
isSuperuser  // env email match
isAdmin      // ADMIN membership || isSuperuser
isParticipant // isLeagueParticipantRole(role) && !isSuperuser
```

`buildLeaguePicksWeekView` today requires a membership id for “current pick.” Superuser viewer: same slate/odds/jailed, `currentPick: null`, not interactive.

## Verification

**Commands:**
- `npm test` -- all existing tests plus new superuser tests pass
- `npx tsc --noEmit` -- `LeagueAccess.membership` nullability does not leak unsound `membership.id` use

**Manual checks (if no CLI):**
- With `SUPERUSER_EMAIL` set to a non-member test user: `/home` lists all leagues; open a league admin page; confirm picks submit is disabled/403; confirm a normal member account still picks.

## Suggested Review Order

**Capability model**

- Env email match is the only designation; blank env means nobody is superuser.
  [`is-superuser.ts:17`](../../src/lib/auth/is-superuser.ts#L17)

- Flags live on access: view without membership, admin without playing, never a participant.
  [`get-league-access.ts:41`](../../src/lib/league/get-league-access.ts#L41)

**Listing and navigation**

- Superuser admin list is every league, not ADMIN memberships.
  [`list-administered-leagues.ts:70`](../../src/lib/league/list-administered-leagues.ts#L70)

- League layout opens on access (member or superuser) and shows admin nav from `isAdmin`.
  [`layout.tsx:21`](../../src/app/(app)/leagues/[leagueId]/layout.tsx#L21)

**Admin writes vs participant**

- Shared helper: superuser or ADMIN membership; used by league admin APIs.
  [`require-league-admin.ts:22`](../../src/lib/league/require-league-admin.ts#L22)

- Self-picks stay membership-only; superuser viewer has no pick slot.
  [`picks/route.ts:215`](../../src/app/api/leagues/[leagueId]/picks/route.ts#L215)

- Picks page disables submit when the viewer is not a participant.
  [`picks/page.tsx:147`](../../src/app/(app)/leagues/[leagueId]/picks/page.tsx#L147)

- History loads “My Picks” only for real participants (leftover ADMIN row ignored).
  [`history/page.tsx:30`](../../src/app/(app)/leagues/[leagueId]/history/page.tsx#L30)

- On-behalf cannot write onto a superuser leftover membership.
  [`submit-pick-on-behalf.ts:80`](../../src/lib/admin/submit-pick-on-behalf.ts#L80)

- NFL odds/scoring admin allows session superuser without any ADMIN row.
  [`authorize-odds-admin.ts:11`](../../src/lib/nfl/authorize-odds-admin.ts#L11)

**Not a player**

- Prisma `where` excludes the configured email from roster, standings, email, export.
  [`player-membership-where.ts:9`](../../src/lib/league/player-membership-where.ts#L9)

- Invite create uses generic `FORBIDDEN` (does not name the privileged mailbox).
  [`invitations/route.ts:83`](../../src/app/api/leagues/[leagueId]/invitations/route.ts#L83)

- Accept/signup also reject the superuser address.
  [`accept-league-invitation.ts:48`](../../src/lib/accept-league-invitation.ts#L48)

- Reminder `submittedCount` is player memberships with a pick, not raw pick rows.
  [`get-reminder-data.ts:172`](../../src/lib/email/get-reminder-data.ts#L172)

**Audit without membership**

- `adminMembershipId` optional; `adminUserId` records who acted when there is no membership.
  [`schema.prisma:409`](../../prisma/schema.prisma#L409)

**Ops**

- Server-only env; create the User at `/create-account`, then set and redeploy.
  [`.env.example:83`](../../.env.example#L83)
