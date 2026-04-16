# Story 2.4: Admin league list and settings

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a league admin,
I want to see leagues I administer and open settings,
so that I can confirm configuration (**FR4**, **FR5**).

## Acceptance Criteria

1. **Given** an authenticated user who has **`LeagueMembership.role === ADMIN`** for one or more leagues  
   **When** they open the **admin leagues list** surface (see Tasks for route)  
   **Then** they see **every** league they administer (**FR4**), each with enough context to disambiguate (at minimum **league name** and a link into **settings** and existing flows such as **invites**).

2. **Given** the same user has **zero** admin memberships  
   **When** they open that surface  
   **Then** they see an **empty state** with a clear path to **`/leagues/new`** (reuse **`CreateLeagueLinkButton`** or equivalent **MUI `Stack`** layout).

3. **Given** an authenticated user who is **`ADMIN`** for league **L**  
   **When** they open **league settings / detail** for **L**  
   **Then** they see a **read-only configuration summary** (**FR5**) including at least: **league name**, **league id** (for support/debug), **current NFL season year** (from **`getCurrentNflSeasonYear()`**), **`Season.firstCompetitionWeek`**, **`Season.preSeasonInitializedAt`** (present as ISO or friendly copy; **`null`** = not yet initialized per Story **2.3**), and **timestamps** useful for admins (**`League.createdAt`** or **`Season.updatedAt`**—pick one or both and stay consistent).

4. **Given** a user who is **not** an **`ADMIN`** for **L** (including **non-member**)  
   **When** they request the **settings** route for **L**  
   **Then** the app does **not** reveal admin configuration: use the same posture as **`/leagues/[leagueId]/invites`** (**`notFound()`** when no membership; **`notFound()`** when member but role is **`MEMBER`** only).

5. **Given** **`GET /api/leagues`** (or the chosen single read API added in this story)  
   **When** the caller is unauthenticated  
   **Then** the response is **401** with **`{ error: { code: "UNAUTHENTICATED", message } }`**.

6. **Given** **`GET /api/leagues`**  
   **When** the caller is authenticated  
   **Then** the JSON is **camelCase** and lists **only** leagues where the user’s membership role is **`ADMIN`**, each row including the fields needed to render AC1 and AC3 (league id/name plus current-season summary fields). **Do not** return leagues where the user is only a **member**.

7. **Given** implementation touches **behavioral** listing or serialization rules in **`src/lib/league/**`**  
   **When** tests are warranted  
   **Then** add or extend **colocated Vitest** (e.g. mapping/sort stability) per **`.cursor/rules/post-change-testing.mdc`**.

## Tasks / Subtasks

- [x] **Shared query helper** — Add something like **`listAdministeredLeaguesWithCurrentSeason(userId)`** under **`src/lib/league/`** that: loads **`LeagueMembership`** where **`role === ADMIN`**, includes **`league`**, left-joins or fetches **`Season`** for **`getCurrentNflSeasonYear()`** (reuse **`resolveCurrentSeasonForLeague`** / **`leagueId_nflSeasonYear`** pattern from Story **2.3**). Sort deterministically (e.g. **`league.name`** asc). Unit-test edge cases (no season row → represent as missing in API/page with clear handling).
- [x] **`GET /api/leagues`** — **`auth()`** → on success return **200** **`{ leagues: [...] }`** per AC6; **401** per AC5. No CSRF helper required for **GET**. Keep errors aligned with **`POST /api/leagues`** style.
- [x] **Admin list page** — New **`src/app/(app)/leagues/page.tsx`** (or **`/leagues/admin`** if you need to reserve **`/leagues` for Story 2.5**—**prefer** **`/leagues`** for admins now if it does not conflict with participant navigation; document choice in Dev Agent Record). **MUI `Stack`**: heading, list/cards, **`Button component={Link}`** in a **client** wrapper where needed per **`next-rsc-client-boundaries`**. Link each row to **`/leagues/[id]/settings`** and **`/leagues/[id]/invites`**.
- [x] **Settings page** — **`src/app/(app)/leagues/[leagueId]/settings/page.tsx`**: **`auth()`**, load membership, **`notFound`** if not **ADMIN**, load league + current season fields for AC3. Read-only summary; no mutations in this story.
- [x] **Dashboard entry** — From **`src/app/(app)/dashboard/page.tsx`**, add navigation to the list page (text link or button consistent with existing **`CreateLeagueLinkButton`**).
- [x] **Regression** — **`npm run lint`**, **`npm test`**, **`npm run build`**.

## Dev Notes

### Epic context

- **Epic 2:** **2.1–2.3** shipped create, invites, pre-season init. **This story** delivers **FR4/FR5** surfaces and a canonical **read** API for **admin-scoped** leagues. **2.5** will add **participant** league home/roster/rules (**FR6/FR7**). **2.8** will add **destructive delete** from settings (**FR61**)—**do not** implement delete here; it is acceptable to leave a single sentence in the UI that settings will later include dangerous actions, or stay silent.
- **FR4 vs FR6:** List and settings here are **admin-first**; avoid showing **non-admin** leagues on **`GET /api/leagues`** to prevent accidental data leaks to future client consumers.

### Technical requirements

| Area | Requirement |
|------|-------------|
| API | **`src/app/api/leagues/route.ts`**: add **`GET`** alongside existing **`POST`** [Source: `architecture.md` — Route Handlers, plural **`/api/leagues`**]. |
| DB | Reuse **`League`**, **`Season`**, **`LeagueMembership`** as in **`prisma/schema.prisma`**; **snake_case** columns, **camelCase** JSON. |
| Auth | **`auth()`** from **`@/lib/auth`**; **`LeagueMembershipRole.ADMIN`** checks match **`invitations`** / **`pre-season-init`**. |
| Errors | **`{ error: { code, message } }`** for **401**; **GET** does not use **`assertCookieSessionMutationOrigin`**. |
| UI | **MUI**; **`Stack`** for flex layout [Source: `docs/project-context.md`]. |

### Architecture compliance

- No new **`NEXT_PUBLIC_*`** secrets; no Prisma client sprawl—use **`@/lib/db`**.
- **Next.js 16:** **`params`** on pages is a **`Promise`**—**`await params`** in **`settings`** page.

### Library & framework requirements

| Package | Version (repo) | Notes |
|---------|----------------|-------|
| `next` | `16.2.2` | App Router, Route Handlers. |
| `next-auth` | `^5.0.0-beta.30` | `auth()`. |
| `@prisma/client` | `6.19.0` | Read paths only in this story. |
| `@mui/material` | `^7.3.9` | **Stack**, **Typography**, lists/cards. |

### File structure requirements

```
src/app/api/leagues/route.ts # add GET
src/app/(app)/leagues/page.tsx                  # admin list (new)
src/app/(app)/leagues/[leagueId]/settings/page.tsx
src/lib/league/list-administered-leagues.ts     # name as implemented
src/lib/league/list-administered-leagues.test.ts  # if non-trivial
src/app/(app)/dashboard/page.tsx                # link to list
```

### Testing requirements

- Prefer tests for **sort order**, **admin-only filter**, and **missing current-season row** behavior if encoded in **`src/lib/league/**`**.  
- Manual: user with two admin leagues sees both; **member-only** user gets **notFound** on **`/leagues/{id}/settings`**; **`GET /api/leagues`** **401** when logged out.

### Previous story intelligence (2.3)

**Artifact:** `_bmad-output/implementation-artifacts/2-3-pre-season-league-initialization.md`.

- Reuse **`resolveCurrentSeasonForLeague`** (`src/lib/league/resolve-current-season.ts`) or the same **`leagueId_nflSeasonYear`** query pattern for **`getCurrentNflSeasonYear()`**.  
- **Invites** page (`src/app/(app)/leagues/[leagueId]/invites/page.tsx`) is the template for **membership + role** gating and **season** reads.  
- **Create flow** (`create-league-form.tsx`) redirects to **`/leagues/{id}/invites`**—after this story, optionally redirect to **`settings`** or **list** (**out of scope** unless you adjust UX minimally; default **leave** redirect as-is to avoid churn).

### Git intelligence

- Recent epic **2** work added **REST** league routes, **`proxy.ts`** rate limits on **POST**s, and **server** invite pages. **GET `/api/leagues`** does not require **POST** CSRF ordering.

### Latest tech information

- **`context.params`**: **`Promise`** in **Next 15+** / **16** route handlers and pages—always **`await`**.

### Project context reference

- `docs/project-context.md` — JSON errors, **Stack**, multi-tenant rules.  
- `_bmad-output/planning-artifacts/epics.md` — Epic **2**, Story **2.4**; **FR4**, **FR5**.

### Scope boundaries (avoid creep)

- **Do not** implement **participant** league home or **rules** page (**2.5**).  
- **Do not** implement **editable** settings or **first competition week** changes (**2.7** immutability is separate).  
- **Do not** implement **delete league** (**2.8** / **FR61**).  
- **Do not** add **CSRF** checks to **GET**.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- Implemented **`listAdministeredLeaguesWithCurrentSeason`** with Prisma `orderBy` league name asc, nested **`seasons`** slice for **`getCurrentNflSeasonYear()`**, and **`toAdministeredLeagueRows`** for mapping plus Vitest coverage (missing season → `null`).
- Added **`GET /api/leagues`** returning **`{ leagues }`** camelCase; **401** matches **POST** error shape.
- Admin list at **`/leagues`** (preferred over **`/leagues/admin`** so Story **2.5** can add participant home under a different path later); row actions in **`AdminLeagueRowActions`** (client **`Button component={Link}`**).
- Settings at **`/leagues/[leagueId]/settings`**: **`notFound`** for no membership or **`MEMBER`** only; read-only summary with **`League.createdAt`** and **`Season.updatedAt`** when present.
- Dashboard **`MyLeaguesLinkButton`** → **`/leagues`**. **`npm run lint`**, **`npm test`**, **`npm run build`** passed.
- Code review: admin list **`/leagues`** uses **`notFound()`** when **`session.user.id`** is missing (parity with settings/invites; avoids blank page).

### File List

- `src/lib/league/list-administered-leagues.ts`
- `src/lib/league/list-administered-leagues.test.ts`
- `src/app/api/leagues/route.ts`
- `src/app/(app)/leagues/page.tsx`
- `src/app/(app)/leagues/[leagueId]/settings/page.tsx`
- `src/components/leagues/admin-league-row-actions.tsx`
- `src/components/leagues/my-leagues-link-button.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/2-4-admin-league-list-and-settings.md`

## Change Log

- **2026-04-15** — Story authored from `epics.md`, `sprint-status.yaml`, Prisma schema, Stories **2.1–2.3** implementation paths. Status **ready-for-dev**.
- **2026-04-15** — Implemented Story **2.4** (admin list, settings, **`GET /api/leagues`**). Status **review**.
- **2026-04-15** — Post-review: **`/leagues`** missing user id → **`notFound()`**; story marked **done**.
