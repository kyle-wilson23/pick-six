# Story 2.5: Participant league home, roster, and rules page

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a participant,
I want to see league name, season, roster, and full rules reference,
so that I understand mechanics without asking the admin (**FR6**, **FR7**).

## Acceptance Criteria

1. **Given** an authenticated user with a **`LeagueMembership`** for league **L** (**ADMIN** or **MEMBER**)  
   **When** they open the **league home** route for **L** (see Tasks)  
   **Then** they see **league name**, **current NFL season year** (via **`getCurrentNflSeasonYear()`** and the **`Season`** row for **L**), **`Season.firstCompetitionWeek`**, **`Season.preSeasonInitializedAt`** (friendly copy: initialized vs not yet—same semantics as Story **2.3**), and **participant roster** (**FR6**).

2. **Given** the roster on league home  
   **When** it renders  
   **Then** it lists **every** `LeagueMembership` for **L** with a stable sort (**`User.name`** asc, then **`User.email`** asc as tie-break), each row showing at least **display name** **`user.name ?? user.email`** and **membership role** (**`ADMIN`** / **`MEMBER`**) so admins are visible on the roster (supports **FR6** and aligns with **FR12** / Story **2.6** trajectory).

3. **Given** the same user  
   **When** they open the **rules** route for **L**  
   **Then** the page is readable on **mobile and desktop** (UX parity: **`Stack`** spacing, comfortable line length, semantic headings) and explains at least: **standard win = 1 point**, **win picking against the jailed team = 2 points**, **jailed team** definition (weekly, biggest favorite by moneyline snapshot), **tie-breakers** (spread, then seeded random with audit—high level), **no duplicate team** per participant per season, **weekly deadline** (5 minutes before first kickoff of the week, typically Thursday ~8:10 PM Eastern—wording consistent with **PRD**), and **Tuesday standings / pick visibility** in one sentence (peer picks hidden until after MNF processing / Tuesday reveal—no need for Epic **5** implementation detail) (**FR7**).

4. **Given** a user with **no** membership in **L**  
   **When** they request league home or rules for **L**  
   **Then** the app responds with **`notFound()`** (match **`invites`** / **`settings`** posture—no membership enumeration).

5. **Given** an authenticated user with **one or more** league memberships (any role)  
   **When** they open the **joined-leagues index** route (see Tasks)  
   **Then** they see **all** leagues they belong to, each linking to **league home**, with enough context to disambiguate (**league name**, **role**, **current season** summary fields as for AC1). **Empty state:** copy that they have no leagues yet + path to **`/leagues/new`** (reuse **`CreateLeagueLinkButton`** or equivalent).

6. **Given** **`GET /api/leagues/joined`** (name as implemented; must not collide with existing **`GET /api/leagues`**)  
   **When** the caller is unauthenticated  
   **Then** the response is **401** with **`{ error: { code: "UNAUTHENTICATED", message } }`**.

7. **Given** **`GET /api/leagues/joined`**  
   **When** the caller is authenticated  
   **Then** JSON is **camelCase** and returns **all** leagues the user is a member of (**ADMIN** or **MEMBER**), each including **league id**, **name**, **role**, and **currentSeason** object mirroring the fields needed for AC1/AC5 (or **`null`** current season if missing—same handling strategy as **`list-administered-leagues`**).

8. **Given** **`Season.firstCompetitionWeek` > 1**  
   **When** league home (and joined-league row copy if shown) presents season context  
   **Then** participant-facing text states that **competition starts NFL Week N** (prepares for Story **2.7** full immutability story; field already on **`Season`**).

## Tasks / Subtasks

- [x] **Shared query helper** — Add **`listJoinedLeaguesWithCurrentSeason(userId, nflSeasonYear?)`** under **`src/lib/league/`** that loads all **`LeagueMembership`** rows for the user, includes **`league`**, resolves **`Season`** for **`getCurrentNflSeasonYear()`** (reuse **`resolveCurrentSeasonForLeague`** / **`leagueId_nflSeasonYear`** pattern from Stories **2.3–2.4**). Sort leagues deterministically (e.g. **`league.name`** asc). Add Vitest for mapping/sort if non-trivial.
- [x] **Roster helper (optional colocation)** — Either inline in the league home page server component or extract **`listLeagueRoster(leagueId)`** in **`src/lib/league/`** that returns memberships + user fields for AC2; unit-test sort if extracted.
- [x] **`GET /api/leagues/joined`** — New route **`src/app/api/leagues/joined/route.ts`** (or **`src/app/api/me/leagues/route.ts`**—pick one, document in Dev Agent Record). **`auth()`** → **200** **`{ leagues: [...] }`** per AC7; **401** per AC6. **GET** — no CSRF helper.
- [x] **Joined leagues index** — New **`src/app/(app)/my-leagues/page.tsx`**: **`auth()`** → **`notFound()`** if no **`session.user.id`** (parity with **`/leagues`** list). Load **`listJoinedLeaguesWithCurrentSeason`**, render **MUI `Stack`** list; each row links to **`/leagues/[leagueId]`**. Empty state per AC5.
- [x] **League home** — New **`src/app/(app)/leagues/[leagueId]/page.tsx`**: membership required; **`notFound()`** if none. Show AC1 summary + AC2 roster + internal nav links to **`./rules`**. If **`role === ADMIN`**, show secondary actions (client **`Button component={Link}`** wrappers per **`next-rsc-client-boundaries`**) to **`/leagues/[leagueId]/settings`** and **`/leagues/[leagueId]/invites`**.
- [x] **Rules page** — New **`src/app/(app)/leagues/[leagueId]/rules/page.tsx`**: same membership gate as home; AC3 static content (MVP hardcoded copy—**no** configurable rule engine per **`docs/project-context.md`**). Use semantic headings (**`h1`**, **`h2`**) for **NFR41**.
- [x] **Dashboard entry** — Update **`src/app/(app)/dashboard/page.tsx`**: add navigation to **`/my-leagues`**. Adjust **`MyLeaguesLinkButton`** (or split components): e.g. **"Your leagues"** → **`/my-leagues`**; add **"Leagues you administer"** → **`/leagues`** (**new** small client button component) so admins retain fast access to Story **2.4** list without extra clicks.
- [x] **Regression** — **`npm run lint`**, **`npm test`**, **`npm run build`**.

## Dev Notes

### Epic context

- **Epic 2:** Stories **2.1–2.4** shipped create, invites, pre-season init, **admin** list/settings. **This story** is **participant-first** (**FR6**, **FR7**). **2.6** formalizes admin as full participant in pick flows; **2.7** adds immutability rules for **`firstCompetitionWeek`**—surface the field now per AC8. **2.8** is destructive delete—**do not** implement here.

### Technical requirements

| Area | Requirement |
|------|-------------|
| API | New **read** handler; **camelCase** JSON; errors **`{ error: { code, message } }`**. Do **not** change **`GET /api/leagues`** semantics (admin-only list). |
| DB | **`League`**, **`Season`**, **`LeagueMembership`**, **`User`** per **`prisma/schema.prisma`**. |
| Auth | **`auth()`** from **`@/lib/auth`**; authorize by **membership existence**, not admin role, for home/rules/joined list. |
| UI | **MUI**; **`Stack`** for flex layout [Source: `docs/project-context.md`]. |
| Routing | **`/leagues/[leagueId]`** is the **canonical league hub** for anyone in the league; **`/leagues`** remains **administered-leagues** list (Story **2.4**). |

### Architecture compliance

- No secrets on client; single Prisma client **`@/lib/db`**.
- **Next.js 16:** **`await params`** on **`[leagueId]`** pages.
- **Pick privacy:** This story does **not** expose participant picks (no pick queries).

### Library & framework requirements

| Package | Version (repo) | Notes |
|---------|----------------|-------|
| `next` | `16.2.2` | App Router, Route Handlers. |
| `next-auth` | `^5.0.0-beta.30` | `auth()`. |
| `@prisma/client` | `6.19.0` | Read paths. |
| `@mui/material` | `^7.3.9` | **Stack**, **Typography**, **Paper**/lists. |

### File structure requirements

```
src/app/api/leagues/joined/route.ts          # GET (or chosen path)
src/app/(app)/my-leagues/page.tsx
src/app/(app)/leagues/[leagueId]/page.tsx    # league home (new)
src/app/(app)/leagues/[leagueId]/rules/page.tsx
src/lib/league/list-joined-leagues.ts        # name as implemented
src/lib/league/list-joined-leagues.test.ts   # if warranted
src/components/leagues/my-leagues-link-button.tsx  # update href/label
src/components/leagues/admin-leagues-link-button.tsx # new (or equivalent)
src/app/(app)/dashboard/page.tsx
```

### Testing requirements

- Prefer tests for **joined-leagues** mapping, **sort stability**, and **admin + member** both appearing in **`GET /api/leagues/joined`**.  
- Manual: **member-only** user sees **`/my-leagues`** and can open home + rules; non-member **`notFound`** on **`/leagues/[id]`**; **`GET`** joined **401** when logged out.

### Previous story intelligence (2.4)

**Artifact:** `_bmad-output/implementation-artifacts/2-4-admin-league-list-and-settings.md`.

- Reuse **`listAdministeredLeaguesWithCurrentSeason`** patterns from **`src/lib/league/list-administered-leagues.ts`**—**extend**, do not duplicate season join logic unnecessarily; factor shared **“league + current season row”** typing if it reduces drift.  
- **`settings`** uses **`notFound()`** for non-**ADMIN**; participant pages use **`notFound()`** only when **no** membership.  
- **Invites** page: **`src/app/(app)/leagues/[leagueId]/invites/page.tsx`** — template for **`auth()`**, **`params`**, Prisma **`findUnique`** on membership.

### Git intelligence

- Recent work: Story **2.4** added **`GET /api/leagues`**, **`list-administered-leagues`**, admin **`/leagues`** page, **`settings`** summary.

### Latest tech information

- **`params`**: **`Promise`** in App Router — always **`await`** in pages and route handlers that receive dynamic segments.

### Project context reference

- `docs/project-context.md` — **Stack**, JSON errors, **`firstCompetitionWeek`** awareness.  
- `_bmad-output/planning-artifacts/epics.md` — Epic **2**, Story **2.5**; **FR6**, **FR7**.  
- `_bmad-output/planning-artifacts/prd.md` — deadline and jailed-team product wording.

### Scope boundaries (avoid creep)

- **Do not** implement picks UI, odds, or jailed computation (**Epic 3**).  
- **Do not** implement editable league settings or **delete league** (**2.8**).  
- **Do not** add CSRF to **GET** endpoints.  
- **Do not** replace **`GET /api/leagues`** with a combined endpoint—keep **admin-only** vs **joined** separation for clear authorization.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

_(none)_

### Completion Notes List

- Implemented **`GET /api/leagues/joined`** (kept path under **`/api/leagues/joined`** so it does not collide with admin **`GET /api/leagues`**); response mirrors administered list **`currentSeason`** shape plus **`role`**.
- **`listJoinedLeaguesWithCurrentSeason`** reuses **`toAdministeredLeagueRows`** for season mapping; **`describeSeasonForParticipant`** centralizes AC1/AC8 copy for league home and **`/my-leagues`**.
- **`listLeagueRoster`** sorts in memory with **`compareLeagueRosterMembers`** (tested) for stable AC2 ordering.
- Extended **`src/proxy.ts`** matcher with **`/my-leagues`** for **`callbackUrl`** parity after login.

### File List

- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/leagues/[leagueId]/page.tsx`
- `src/app/(app)/leagues/[leagueId]/rules/page.tsx`
- `src/app/(app)/my-leagues/page.tsx`
- `src/app/api/leagues/joined/route.ts`
- `src/components/leagues/admin-leagues-link-button.tsx`
- `src/components/leagues/my-leagues-link-button.tsx`
- `src/lib/league/list-joined-leagues.ts`
- `src/lib/league/list-joined-leagues.test.ts`
- `src/lib/league/list-league-roster.ts`
- `src/lib/league/list-league-roster.test.ts`
- `src/proxy.ts`

## Change Log

- **2026-04-15** — Story authored from `epics.md`, `sprint-status.yaml`, Prisma schema, Story **2.4** patterns. Status **ready-for-dev**.
- **2026-04-15** — Implemented participant league home, roster, rules, **`/my-leagues`**, **`GET /api/leagues/joined`**, dashboard nav split; tests + lint + build green. Status **review**.
- **2026-04-15** — Code review + participant UX copy (missing season, empty roster). Status **done**.
