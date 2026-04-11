# Story 2.1: Create league and season

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a league admin,
I want to create a league with a name and tie it to the current NFL season,
so that all picks and weeks are scoped correctly.

## Acceptance Criteria

1. **Given** an **authenticated** user  
   **When** they submit a valid **create-league** request (UI and/or API)  
   **Then** a **`League`** and associated **`Season`** row exist in PostgreSQL via Prisma (**FR1**).

2. **Given** the creating user  
   **When** the league is created  
   **Then** they have **league admin** authority **and** **participant** eligibility via **one** `league_memberships` row with role **`ADMIN`** (no separate `MEMBER` row for the creator). Downstream **FR12**/**FR13** roster paths must treat `ADMIN` as a full participant so the creator appears without a follow-up story.

3. **Given** MVP product rules (scoring, jailed team, deadlines, etc.) are **not** user-configurable yet  
   **When** code reads league/season defaults  
   **Then** hardcoded or config-driven rule constants are **documented** in one place (e.g. `src/lib/domain/league-rules.ts` or `src/lib/league/constants.ts`) so **FR1** “configurations” are traceable without a rules engine.

4. **Given** a create-league payload  
   **When** it is processed by the server  
   **Then** input is validated with **Zod** at the API boundary and failures return **`{ "error": { "code", "message" } }`** with appropriate HTTP status (400 validation, 401 unauthenticated) per `docs/project-context.md`.

5. **Given** **Story 2.7** (first NFL competition week) must be satisfied in the **same** create flow per `epics.md`  
   **When** the admin creates a league  
   **Then** they set **`firstCompetitionWeek`** as an integer **`1`–`18`** (default **`1`** if omitted in API for backward-friendly defaults) persisted on **`League` or `Season`** (pick one model and document); this field is the **single source of truth** for when competition starts for this league.

6. **Given** **NFR15** and **Story 1.6** baselines  
   **When** create-league is implemented as a custom **`POST`** Route Handler  
   **Then** the handler uses **`assertCookieSessionMutationOrigin`** (or the project’s chosen equivalent) from `src/lib/cookie-session-mutation-csrf.ts` after parsing the body, and **NFR12** rate-limit posture is considered for new sensitive POST paths (extend `src/proxy.ts` matcher if this route should be covered—align with team convention).

7. **Given** league **names** must be unique (**FR1**)  
   **When** a duplicate name is submitted  
   **Then** the API returns a **409** (or 400 with a clear validation code—**pick one** and document) without leaking other tenants’ data.

## Tasks / Subtasks

- [x] **Prisma schema** — Add `League`, `Season` (or equivalent), and **`LeagueMembership`** (or `league_memberships`) with `userId`, `leagueId`, **role** enum (`ADMIN` | `MEMBER` minimum). Map tables/columns **`snake_case`**; PKs **`cuid()`** consistent with `User`. Include **`first_competition_week`** (int,1–18, default 1) on the chosen model. Add **unique** constraint for league **name** (global MVP). Run migration via `npm run db:migrate`.
- [x] **Domain/constants** — Add a small module for MVP rule constants + season labeling helper (e.g. current NFL season year/label strategy—document if year is hardcoded env or derived).
- [x] **POST `/api/leagues`** — Route Handler: `auth()` →401 if no session; Zod body (`name` string trimmed, length bounds; `firstCompetitionWeek` optional with default 1); transactional create: `League` + `Season` + membership for `session.user.id` as **ADMIN**; map Prisma unique violation to structured error; JSON success body per architecture (**direct** resource JSON is fine, e.g. `{ id, name, … }`).
- [x] **CSRF / origin** — Call **`assertCookieSessionMutationOrigin(request)`** at the top of the POST handler after reading method; document in handler comment.
- [x] **UI (minimal)** — Under `src/app/(app)/…`, add a **create league** page (e.g. `/leagues/new`) using **MUI** with **`Stack`** for layout: name field, first-competition-week selector (1–18, default 1), submit → POST `/api/leagues`, surface API errors. Link from `/dashboard` or a leagues index placeholder for discoverability.
- [x] **Proxy matcher** — If the new page lives under `(app)` paths not yet matched, extend **`src/proxy.ts`** `matcher` and document the coupling (see **Epic 1 retro**: `x-pathname` / protected paths).
- [x] **Tests** — Vitest: Zod schema (or pure normalization) for create-league body; optional pure helper for “default season label/year” if non-trivial. Keep tests colocated per `.cursor/rules/post-change-testing.mdc`.
- [x] **Regression** — `npm run lint`, `npm test`, `npm run build`.

## Dev Notes

### Epic context

- **Epic 2 goal:** Leagues, invites, initialization, admin list/settings, participant views, rules—**this story** establishes **data + API + minimal UI** for **FR1** and seeds **FR12/FR13** for the creator.
- **Depends on:** Epic 1 complete (Auth.js **`auth()`**, JWT session with **`session.user.id`**, protected `(app)` shell, CSRF helper).
- **Downstream:** **2.2** will attach **`Invitation.leagueId`** (or equivalent)—**do not** break existing `Invitation` rows; migration must be **additive**. **2.3–2.6** consume league/season. **`first_competition_week`** is **persisted in 2.1** on `Season`; **Story 2.7** (still backlog in sprint tracking) covers **behavior** tied to that field—e.g. immutability after competition starts, mid-season creation UX—not re-doing the column. **Epic 3** must read **`firstCompetitionWeek`** when computing “current” competition week—document field name in schema comments.

### Technical requirements

| Area | Requirement |
|------|-------------|
| API | REST **`/api/leagues`** plural kebab path; **camelCase** JSON [Source: `architecture.md` — REST / Route Handlers]. |
| DB | **snake_case** columns, plural table names **`leagues`**, **`seasons`**, **`league_memberships`** [Source: `architecture.md` — Database]. |
| Auth | Resolve user via **`auth()`** from `@/lib/auth`; mutations are **server-authoritative**. |
| Multi-tenancy | Later: every mutation checks **`leagueId` + membership**; this story only creates the admin membership. |
| Errors | Consistent **`{ error: { code, message } }`** [Source: `docs/project-context.md`]. |
| Time | Store **UTC** `DateTime`; league-facing deadline/week rules remain **America/New_York** in later epics. |

### Architecture compliance

- Single Prisma client **`@/lib/db`** only.
- Prefer **transaction** (`prisma.$transaction`) for league + season + membership (**NFR28**).
- No secrets in client; no `NEXT_PUBLIC` for DB.

### Library & framework requirements

| Package | Version (repo) | Notes |
|---------|----------------|-------|
| `next` | `16.2.2` | App Router Route Handlers under `src/app/api/leagues/route.ts`. |
| `next-auth` | `^5.0.0-beta.30` | `auth()` in Route Handler. |
| `@prisma/client` | `6.19.0` | Migrations committed. |
| `zod` | `^4.3.6` | Use current v4 APIs (`safeParse`, etc.). |
| `@mui/material` | `^7.3.9` | **Stack** for flex layouts. |

### File structure requirements

```
prisma/schema.prisma # League, Season, LeagueMembership + migration
src/app/api/leagues/route.ts         # POST (create); GET list can be deferred to Story 2.4
src/app/(app)/leagues/new/page.tsx # or equivalent path under protected group
src/lib/...                          # Zod schemas, league rule constants (exact filenames up to implementer)
src/proxy.ts                         # matcher if new protected paths need x-pathname
```

Align with architecture tree: `app/(app)/leagues/`, `app/api/leagues/` [Source: `architecture.md` — Project Structure].

### Testing requirements

- Unit-test **Zod** boundary and any **pure** helpers (week bounds1–18, name trim/length).
- Manual: logged-in user creates league; verify rows in Prisma Studio; duplicate name rejected.

### Previous epic intelligence (Epic 1)

**Artifact:** `_bmad-output/implementation-artifacts/epic-1-retro-2026-04-11.md` and stories **1.5–1.6**.

- Reuse **JSON error** patterns from `src/app/api/signup/invite/route.ts` (shape differs slightly there for anti-enumeration—**admin** create can use explicit validation codes).
- **CSRF / same-origin:** follow `cookie-session-mutation-csrf.ts` for new mutating handlers.
- **Proxy + `(app)` layout:** extend matcher when adding routes under the protected group so **`x-pathname`** and redirects stay correct.
- **Invitations:** retro calls out **`league_id` on invitations** for **2.2**—schema planning should not paint into a corner.

### Git intelligence

- Recent patterns: **`cache(auth)`**, colocated **Vitest**, **`normalizeEmail`** for auth—league **name** normalization is product-defined (trim; case rules optional—document).

### Latest tech information

- **Zod 4** — use project’s existing major version; verify `.safeParse` / issue shape vs Zod 3 docs.
- **Prisma 6** — follow existing `directUrl` / Neon pattern in `schema.prisma`.

### Project context reference

- `docs/project-context.md` — JSON/DB naming, error shape, **first NFL week** reminder.
- `_bmad-output/planning-artifacts/epics.md` — Epic 2, Stories **2.1** and **2.7** (competition week).
- `_bmad-output/planning-artifacts/architecture.md` — REST paths, Prisma, authorization layers.

### Scope boundaries (avoid creep)

- **Do not** implement email invites (**2.2**), full admin list (**2.4**), or rules page (**2.5**) in this story—only create path + minimal UI.
- **Immutability** of `firstCompetitionWeek` after competition starts is spelled out in **Story 2.7**; for **2.1**, persist and validate; optional admin edit **before** any picks can wait for **2.4** if not needed day one.

## Change Log

- **2026-04-11** — Code review closure: AC2 clarified (single `ADMIN` row = admin + participant); epic note added that **2.7** is behavioral on top of 2.1’s `first_competition_week`; create-league page copy aligned with week-1 default; story and sprint marked **done**.
- **2026-04-11** — Implemented Prisma `leagues` / `seasons` / `league_memberships`, POST `/api/leagues`, `/leagues/new` UI, proxy matcher + rate limit for `/api/leagues`, Vitest for Zod + season year helper. Duplicate league name → **409** `DUPLICATE_LEAGUE_NAME`. `first_competition_week` lives on **`Season`** (documented in schema).

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

_(none)_

### Completion Notes List

- **`Season.first_competition_week`** is the single source of truth for competition start week (1–18); `Season.nfl_season_year` ties the row to the NFL season label, with `getCurrentNflSeasonYear()` + optional `NFL_SEASON_YEAR` env.
- **CSRF / origin:** `assertCookieSessionMutationOrigin` runs **after** JSON parse per story AC6; **401** unauthenticated, **400** validation, **409** duplicate name, **403** from origin helper.
- **Creator** is a single `league_memberships` row with `ADMIN` (participant semantics for later FR12/FR13).
- **Regression:** `npm test`, `npm run lint`, `npm run build` passed.

### File List

- `prisma/schema.prisma`
- `prisma/migrations/20260411232203_add_leagues_seasons_memberships/migration.sql`
- `src/lib/league/league-rules.ts`
- `src/lib/league/nfl-season.ts`
- `src/lib/league/nfl-season.test.ts`
- `src/lib/league/create-league-body.ts`
- `src/lib/league/create-league-body.test.ts`
- `src/app/api/leagues/route.ts`
- `src/app/(app)/leagues/new/page.tsx`
- `src/app/(app)/leagues/new/create-league-form.tsx`
- `src/components/leagues/create-league-link-button.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/layout.tsx`
- `src/proxy.ts`
- `_bmad-output/implementation-artifacts/2-1-create-league-and-season.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
