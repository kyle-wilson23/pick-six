# Story 2.6: Admin as full participant

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a league admin,
I want to appear on the roster and use the same participant capabilities as every other member (including future weekly picks),
so that I compete fairly (**FR12**, **FR13**).

## Acceptance Criteria

1. **Given** a user who **created** a league (they hold a **`LeagueMembership`** with role **`ADMIN`** for league **L**)  
   **When** league membership is evaluated for **participant**-scoped behavior (roster visibility, joined-leagues listing, and any route intended for “people in this league,” including the canonical **weekly picks** entry point once it exists)  
   **Then** **`ADMIN`** is treated as a **full participant**—never excluded solely because the role is not **`MEMBER`** (**FR13**).

2. **Given** the league roster (Story **2.5**)  
   **When** it is rendered  
   **Then** the creating admin remains listed with role **`ADMIN`** (satisfies **FR12** roster visibility; no duplicate user row required).

3. **Given** **`GET /api/leagues/joined`** (Story **2.5**)  
   **When** the user is an **admin** of one or more leagues  
   **Then** those leagues still appear in the response with **`role`: `"ADMIN"`** (regression: admin leagues are not “admin-only” for listing; participants and admins share the joined list).

4. **Given** a **centralized** authorization helper for participant scope (see Tasks)  
   **When** Epic **3** (and later) add pick APIs and **`/leagues/[leagueId]/...`** participant routes  
   **Then** those routes **must** use **`ADMIN` ∪ `MEMBER`** (both roles) for “in this league as a player,” and **must not** require **`role === MEMBER`** for pick eligibility unless product explicitly adds a separate “spectator” role (out of MVP scope).

5. **Given** no full picks feature yet (**Epic 3**)  
   **When** this story ships  
   **Then** there is a **documented, implemented** participant entry surface (minimal **server** page or redirect target) at the **canonical path** chosen in Tasks—reachable by **`ADMIN`** and **`MEMBER`** with the same membership gate as league home—so “participant pick routes” are not an empty promise in **FR13** (placeholder UI copy is acceptable: e.g. weekly picks coming next).

6. **Given** the **`LeagueMembershipRole`** enum (**`ADMIN` | `MEMBER`**)  
   **When** interpreting “participant”  
   **Then** the app does **not** create a second **`MEMBER`** row for the league creator; a single **`ADMIN`** row is the admin’s playing identity (**FR13** without duplicate memberships).

## Tasks / Subtasks

- [x] **Participant capability helper** — Add **`src/lib/league/participant-membership.ts`** (name as implemented) exporting pure functions, e.g. **`isLeagueParticipantRole(role: LeagueMembershipRole): boolean`** (returns **`true`** for both **`ADMIN`** and **`MEMBER`**) and **`assertLeagueParticipant(membership: { role } | null)`** (or equivalent) documented as the **only** intended check for “may act as a player in this league.” Add **Vitest** coverage for both roles and a guard that **`MEMBER`-only** pick gates would fail if someone mistakenly compares to **`MEMBER`** only (e.g. test table or comment-driven test).

- [x] **Refactor existing gates (light touch)** — Where league home, rules, **`/my-leagues`**, and **`GET /api/leagues/joined`** already treat “any **`LeagueMembership`**” as access, **optionally** route the role check through **`isLeagueParticipantRole`** for consistency and grep-friendly future audits. Do **not** change **admin-only** surfaces (**settings**, **invites**, **pre-season init**, **`GET /api/leagues`** administered list)—those remain **`ADMIN`**-only.

- [x] **Canonical participant / picks entry (minimal)** — Add **`src/app/(app)/leagues/[leagueId]/picks/page.tsx`** (or **`/participant`**, **pick one** and document in Dev Agent Record) that: **`auth()`** → load membership by **`userId` + `leagueId`** → **`notFound()`** if absent → **`isLeagueParticipantRole(membership.role)`** must pass for both roles. Render short placeholder (**MUI `Stack`**) pointing to Epic **3**; link back to league home. Ensures **FR13** “access participant pick routes” has a real URL in-repo.

- [x] **League home navigation** — From **`src/app/(app)/leagues/[leagueId]/page.tsx`**, add a clear **participant** link to the new route for **all** members (admin and non-admin). Keep existing **admin** links to settings/invites as today.

- [x] **Regression** — **`npm run lint`**, **`npm test`**, **`npm run build`**.

## Dev Notes

### Epic context

- **Epic 2** closes the loop: admins are not second-class on the field (**FR13**). **FR12** (admin sees full roster) already overlaps Story **2.5**; this story locks **authorization semantics** before **Epic 3** picks.
- **Story 2.7** (first competition week immutability) and **2.8** (delete league) are **out of scope**—do not change **`Season.firstCompetitionWeek`** behavior beyond using existing helpers.

### Technical requirements

| Area | Requirement |
|------|-------------|
| **Roles** | **`LeagueMembershipRole`**: **`ADMIN`** = administer + play; **`MEMBER`** = play only. **No** `MEMBER` row for admins. |
| **Auth** | **`auth()`** from **`@/lib/auth`**; participant routes: **membership exists** + **`isLeagueParticipantRole`**. |
| **API** | No change to **`GET /api/leagues`** (administered only) unless a bug is found; **joined** list must remain correct for **`ADMIN`**. |
| **UI** | **MUI**; **`Stack`** for flex layout [Source: `docs/project-context.md`]. |

### Architecture compliance

- Single Prisma client **`@/lib/db`**; **camelCase** JSON for APIs; errors **`{ error: { code, message } }`** when adding handlers.
- **Pick visibility** (**FR48–FR49**) is **Epic 3+**; this story **must not** leak peer picks—placeholder page is non-sensitive.
- Next.js **App Router**: **`await params`** on dynamic pages.

### Library & framework requirements

| Package | Version (repo) | Notes |
|---------|----------------|-------|
| `next` | `16.2.2` | Server Components for placeholder page. |
| `next-auth` | `^5.0.0-beta.30` | `auth()`. |
| `@prisma/client` | `6.19.0` | **`LeagueMembership`**, **`LeagueMembershipRole`**. |
| `@mui/material` | `^7.3.9` | **`Stack`**, **`Typography`**, **`Link`**. |

### File structure requirements

```
src/lib/league/participant-membership.ts
src/lib/league/participant-membership.test.ts
src/app/(app)/leagues/[leagueId]/picks/page.tsx   # or chosen canonical path
src/app/(app)/leagues/[leagueId]/page.tsx         # nav link to picks entry
```

### Testing requirements

- Unit tests for **`isLeagueParticipantRole`** (both enums).
- Prefer one test or comment that **future pick APIs** should import this helper—not **`role === MEMBER`**.

### Previous story intelligence (2.5)

**Artifact:** `_bmad-output/implementation-artifacts/2-5-participant-league-home-roster-and-rules-page.md`.

- **Roster** and **`GET /api/leagues/joined`** already include **`ADMIN`**; do not regress sorting or serialization.
- **Authorization pattern:** participant pages use **`findUnique`** on **`userId_leagueId`** and **`notFound()`** if missing—reuse for the new **`/picks`** (or chosen) page.
- **`listJoinedLeaguesWithCurrentSeason`** loads **all** memberships for **`userId`**—admins appear; verify no filter on **`MEMBER`** only.

### Git intelligence

- Recent epic: **2-5** added **`/my-leagues`**, league home, rules, **`GET /api/leagues/joined`**, **`listLeagueRoster`**.

### Latest tech information

- Dynamic route **`params`** are a **`Promise`** in App Router—always **`await`** in **`page.tsx`**.

### Project context reference

- `docs/project-context.md` — **Stack**, JSON errors, server-authoritative rules.
- `_bmad-output/planning-artifacts/epics.md` — Story **2.6**, **FR12**, **FR13**.

### Scope boundaries (avoid creep)

- **Do not** implement odds, pick submission, deadlines, or jailed team (**Epic 3**).
- **Do not** add admin override or audit (**Epic 4**).
- **Do not** add CSRF to **GET** routes.
- **Do not** change invitation consumption to assign **`ADMIN`**—invitees remain **`MEMBER`**.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

_(none)_

### Completion Notes List

- Added **`isLeagueParticipantRole`** and **`assertLeagueParticipant`** in **`src/lib/league/participant-membership.ts`** with Vitest coverage and a guardrail test that **`MEMBER`**-only equality would exclude **`ADMIN`**.
- Participant surfaces (**league home**, **rules**, new **`/leagues/[leagueId]/picks`**) gate on **`isLeagueParticipantRole`** after membership resolution; admin-only routes unchanged.
- **Canonical weekly picks path:** **`/leagues/[leagueId]/picks`** — server placeholder (MUI **`Stack`**) with link back to league home; Epic 3 copy.
- **`listJoinedLeaguesWithCurrentSeason`** doc clarified: do not filter to **`MEMBER`** only; **`GET /api/leagues/joined`** behavior unchanged.
- **`npm run lint`**, **`npm test`**, **`npm run build`** passed.

### File List

- `src/lib/league/participant-membership.ts` (new)
- `src/lib/league/participant-membership.test.ts` (new)
- `src/lib/league/list-joined-leagues.ts` (docstring)
- `src/app/(app)/leagues/[leagueId]/picks/page.tsx` (new)
- `src/app/(app)/leagues/[leagueId]/page.tsx` (participant gate + Weekly picks link)
- `src/app/(app)/leagues/[leagueId]/rules/page.tsx` (participant gate)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (story status)
- `_bmad-output/implementation-artifacts/2-6-admin-as-full-participant.md` (this file)

## Change Log

- **2026-04-16** — Story authored from `epics.md`, `sprint-status.yaml`, Prisma schema, Story **2.5** patterns. Status **ready-for-dev**.
- **2026-04-16** — Implemented participant helper, **`/picks`** placeholder, league home link, light participant gates, tests; status **review**.
- **2026-04-18** — Review complete; status **done**.
