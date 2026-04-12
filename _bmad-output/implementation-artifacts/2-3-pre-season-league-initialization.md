# Story 2.3: Pre-season league initialization

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a league admin,
I want to mark the league ready for the upcoming season,
so that weekly operations can activate at the right time (**FR3**).

## Acceptance Criteria

1. **Given** a **`League`** with a **`Season`** row for the **current NFL season year** (same resolution as **`getCurrentNflSeasonYear()`** / Story **2.1**)  
   **When** the season row has **not** yet been marked initialized  
   **Then** the product treats the league as still in **pre-season setup** from an **initialization** perspective (invites and roster may continue; **pick submission and weekly automation** in Epic **3+** must treat “not initialized” as **not eligible** once those gates exist—see Dev Notes contract).

2. **Given** an **authenticated** user who is **`LeagueMembership.role === ADMIN`** for **league L**  
   **When** they call the **server** initialization mutation for **L**  
   **Then** the **current-season** **`Season`** row for **L** is updated so initialization is **recorded** (recommended: nullable **`preSeasonInitializedAt`** `@db.Timestamptz` set to **`now()`**; **document** field on **`Season`** in `schema.prisma` comments as the **FR3** flag).  
   **And** the operation is **idempotent**: if already initialized, the API returns **success** without clearing or shifting the timestamp (unless product later defines “re-open setup”—**out of scope** for MVP).

3. **Given** callers who are **not** admins of **L**  
   **When** they call the initialization API  
   **Then** the server returns **403** with **`{ error: { code, message } }`** (same **NFR16** posture as Story **2.2**).

4. **Given** **NFR15** / Story **1.6**  
   **When** the route is a cookie-session **mutation**  
   **Then** it uses **`assertCookieSessionMutationOrigin`** **after** JSON parse, **before** `auth()`, matching **`POST /api/leagues`** and **`POST .../invitations`** ordering.

5. **Given** **NFR12**  
   **When** **`POST`** targets the new route  
   **Then** **`src/proxy.ts`** applies the **same rate-limit posture** as other sensitive league **`POST`**s (extend **`shouldRateLimitPost`** with a regex parallel to **`LEAGUE_INVITATIONS_POST`**; **`config.matcher`** already includes **`/api/leagues/:path*`**).

6. **Given** a league **without** a matching **`Season`** for the resolved NFL year (data anomaly)  
   **When** an admin initializes  
   **Then** the API returns **404** (or **409** with a clear code—**pick one** and document) without creating orphan state.

7. **Given** an **admin** completing initialization from the app  
   **When** they use the minimal UI (see Tasks)  
   **Then** they see **clear confirmation** of **ready for season** state and **cannot** accidentally invoke twice in a harmful way (second submit is harmless per AC2).

## Tasks / Subtasks

- [x] **Schema** — Add **`pre_season_initialized_at`** (nullable **`DateTime`** UTC) on **`Season`**; migration committed. Comment ties field to **FR3** / Story **2.3**.
- [x] **POST `/api/leagues/[leagueId]/pre-season-init`** (or equivalent kebab path) — Parse JSON (allow **`{}`**); CSRF → **`auth()`** → load **`ADMIN`** membership → resolve **`Season`** by **`leagueId` + `getCurrentNflSeasonYear()`** → **`update`** set timestamp if null; return **`200`** with **camelCase** JSON (e.g. **`{ seasonId, preSeasonInitializedAt }`**).
- [x] **Pure helper (optional)** — If resolution logic is non-trivial, extract **`resolveCurrentSeasonForLeague(leagueId)`** under **`src/lib/league/`** with colocated Vitest.
- [x] **Admin UI** — Extend **`/leagues/[leagueId]/invites`** (or adjacent admin surface) with **MUI** **`Stack`**: show **pending vs ready** from **GET** data or **server page props**. Prefer **server component** fetch via Prisma for MVP **or** small **GET** route only if needed—**avoid** duplicating list endpoints planned for **2.4**; loading the **single** season row for this league+year is enough.
- [x] **Participant visibility** — If participants can open the invites URL, **hide** or **disable** the initialize control unless **`ADMIN`** (reuse session/membership check patterns from invite page).
- [x] **Proxy** — Register new **`POST`** path in **`shouldRateLimitPost`**.
- [x] **Tests** — Vitest for any extracted resolver; optional trivial Zod if request body validated.
- [x] **Regression** — `npm run lint`, `npm test`, `npm run build`; manual: create league → initialize → DB column set → second POST idempotent.

## Dev Notes

### Epic context

- **Epic 2:** **2.1** ✅ league/season + **`first_competition_week`**; **2.2** ✅ invites; **this story** = explicit **FR3** lifecycle flag; **2.4** list/settings can surface the same field; **2.5** participant copy may mention readiness; **2.7** remains **behavioral** rules on **`first_competition_week`** (do not conflate with initialization).
- **FR3:** Pre-season **initialization** is satisfied by a **durable, admin-driven** transition—not merely “league exists.”

### Downstream contract (Epic 3+)

- **`Season.preSeasonInitializedAt === null`** → league **must not** be treated as eligible for **production pick submission**, **Tuesday snapshot**, or **deadline enforcement** for that season (when those features exist).  
- **`non-null`** → eligible **subject to** NFL calendar + **`first_competition_week`** (Story **2.7**) and real schedule data.  
- **Story 2.3** implements persistence + API + admin UX + documents this contract; **Epic 3** stories wire the checks.

### Technical requirements

| Area | Requirement |
|------|-------------|
| API | REST under **`src/app/api/leagues/[leagueId]/…/route.ts`**; **camelCase** JSON; plural kebab **`/api/leagues`** prefix [Source: `architecture.md`]. |
| DB | **snake_case** column **`pre_season_initialized_at`**; keep **single Prisma client** [Source: `docs/project-context.md`]. |
| Auth | **`auth()`** + **`ADMIN`** on **`leagueId`**. |
| Time | Store **UTC**; display copy may mention Eastern when tied to season deadlines later [Source: `docs/project-context.md`]. |
| Errors | **`{ error: { code, message } }`** for **400/401/403/404/409** as applicable. |

### Architecture compliance

- **Transactions:** Single-row **`update`** is fine; use **`$transaction`** only if combined with other writes later (**NFR28**).
- **No secrets** in client; no new **`NEXT_PUBLIC_*`**.

### Library & framework requirements

| Package | Version (repo) | Notes |
|---------|----------------|-------|
| `next` | `16.2.2` | Dynamic Route Handler `[leagueId]`. |
| `next-auth` | `^5.0.0-beta.30` | `auth()`. |
| `@prisma/client` | `6.19.0` | Additive migration. |
| `@mui/material` | `^7.3.9` | **Stack** for layout. |

### File structure requirements

```
prisma/schema.prisma
prisma/migrations/*/migration.sql    # pre_season_initialized_at on seasons
src/app/api/leagues/[leagueId]/pre-season-init/route.ts   # or chosen kebab segment
src/app/(app)/leagues/[leagueId]/invites/page.tsx         # extend, or new setup section
src/lib/league/nfl-season.ts         # reuse getCurrentNflSeasonYear
src/proxy.ts
```

### Testing requirements

- Unit-test **season resolution** if extracted; keep colocated per `.cursor/rules/post-change-testing.mdc`.
- Manual: idempotent **POST**, **403** as non-admin, **401** unauthenticated.

### Previous story intelligence (2.2)

**Artifact:** `_bmad-output/implementation-artifacts/2-2-invite-participants-by-email.md`.

- Reuse **CSRF ordering**: parse JSON → **`assertCookieSessionMutationOrigin`** → **`auth()`** → membership **ADMIN** check.
- Reuse **`userId_leagueId`** unique lookup for membership.
- Extend **`proxy`** with another **`RegExp`** for the new path; matcher already covers **`/api/leagues/:path*`**.
- **Invite page** is a natural home for “**Mark league ready**” after invites—keeps setup flow cohesive.

### Git intelligence

- Follow established **JSON error** codes and **Prisma** patterns from **`POST /api/leagues`** and **`invitations`**.

### Latest tech information

- **Next.js 16** App Router: `context.params` is a **Promise**—`await context.params` like Story **2.2**.

### Project context reference

- `docs/project-context.md` — errors, **Stack**, season week reminders.
- `_bmad-output/planning-artifacts/epics.md` — Epic **2**, Story **2.3**; **FR3**.

### Scope boundaries (avoid creep)

- **Do not** implement **pick** gates or **cron** in this story—only persist the flag and document Epic **3** enforcement.
- **Do not** implement full **league settings** / **admin list** (**2.4**) beyond minimal status display.
- **Do not** change **`first_competition_week`** semantics (**2.7**).
- **Do not** add **email** notifications for initialization (**Epic 6**).

## Change Log

- **2026-04-12** — Story authored from `epics.md`, `sprint-status.yaml`, Prisma `League`/`Season` model, Stories **2.1–2.2** patterns. Status **ready-for-dev**.
- **2026-04-12** — Implemented: `Season.pre_season_initialized_at`, `POST /api/leagues/[leagueId]/pre-season-init` (AC6: **404** + `SEASON_NOT_FOUND` when no season row), invites UI + proxy rate limit, tests. Status **review**.

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Cursor agent)

### Debug Log References

_(none)_

### Completion Notes List

- **AC6:** Missing current-year `Season` → **404** `SEASON_NOT_FOUND` (no DB writes).
- **Idempotency:** `updateMany` only when `preSeasonInitializedAt` is null; response always returns current timestamp from DB.
- **Invites page:** Server loads membership + season row; non-admins see readiness copy only; admins get **Mark league ready for season**; duplicate submit is harmless.

### File List

- `prisma/schema.prisma`
- `prisma/migrations/20260412190000_season_pre_season_initialized_at/migration.sql`
- `src/app/api/leagues/[leagueId]/pre-season-init/route.ts`
- `src/app/(app)/leagues/[leagueId]/invites/page.tsx`
- `src/app/(app)/leagues/[leagueId]/invites/mark-league-ready-section.tsx`
- `src/lib/league/resolve-current-season.ts`
- `src/lib/league/resolve-current-season.test.ts`
- `src/lib/league/pre-season-init-body.ts`
- `src/lib/league/pre-season-init-body.test.ts`
- `src/proxy.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/2-3-pre-season-league-initialization.md`
