# Story 2.7: First NFL competition week at league creation (mid-season start)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a league admin,
I want to set **when** our league’s competition begins in the NFL regular season **at creation time** (default **Week 1**, or **Week N** if we deploy late),
so that we can **start mid-season** instead of waiting until next year if we miss the September launch—and **lock** that decision once real competition has started.

## Acceptance Criteria

1. **Given** **`Season.firstCompetitionWeek`** is already persisted (**Story 2.1**, 1–18, default 1)  
   **When** competition has **not** been locked for that season (see Tasks for **`firstCompetitionWeekLockedAt`**)  
   **Then** a **league admin** can **change** `firstCompetitionWeek` via an authenticated **mutating API** + **settings UI** (not only at create-league time), with **Zod** validation **1–18**, **CSRF / same-origin** posture matching **`pre-season-init`**, and **403** for non-admins (**FR1**, **FR3** alignment).

2. **Given** **`Season.firstCompetitionWeekLockedAt` IS NOT NULL** (competition start is frozen for that season row)  
   **When** an admin attempts to change `firstCompetitionWeek`  
   **Then** the API returns **409** with structured error **`{ error: { code, message } }`** (e.g. code `FIRST_COMPETITION_WEEK_LOCKED`) and the UI shows a **read-only** explanation—no silent no-op.

3. **Given** the product definition from **`epics.md`**: competition is treated as **started** when **either** the **first pick** for that season exists **or** the **weekly pick deadline** has passed for the league’s **`firstCompetitionWeek`** (NFL calendar—**Epic 3**)  
   **When** those conditions become true in later epics  
   **Then** the app must set **`firstCompetitionWeekLockedAt`** (non-null) so **this story’s** PATCH handler and settings UI enforce immutability—**Story 2.7** ships the **column + enforcement + documentation**; **Epic 3** wires the **writers** (pick save, deadline job) in the stories that introduce **`Pick`** and deadline authority (explicit handoff in Dev Notes).

4. **Given** no **`Pick`** model or deadline jobs exist yet in the repo **at the time 2.7 ships**  
   **When** the new lock timestamp remains **NULL** for all seasons  
   **Then** admins can still adjust `firstCompetitionWeek` from settings (**matches** “before any pick, admin may still adjust”); **regression:** create-league flow and existing **`GET`** list payloads remain valid.

5. **Given** a participant opens **league rules** (**Story 2.5**)  
   **When** **`firstCompetitionWeek` > 1** for the current season row  
   **Then** the rules page states clearly that **competition starts NFL Week N** (and that earlier NFL weeks are **out of scope** for picks/points for this league)—static scoring copy stays as today.

6. **Given** **`describeSeasonForParticipant`** / league home (**Story 2.5–2.6**)  
   **When** **`firstCompetitionWeek` > 1**  
   **Then** participant-facing copy still reflects mid-season start (verify or tighten wording if the new lock field is surfaced read-only anywhere appropriate—e.g. admin settings summary line).

## Tasks / Subtasks

- [x] **Schema** — Add **`firstCompetitionWeekLockedAt`** (`DateTime?`, **`@db.Timestamptz`**, **`@map("first_competition_week_locked_at")`**) on **`Season`**. Comment: set by **Epic 3** when pick/deadline rules say competition started; **never** set in **2.7** except tests/fixtures. Run **`npm run db:migrate`**.

- [x] **Pure helpers** — Add **`src/lib/league/first-competition-week.ts`** (exact name up to you) exporting at least:
  - **`isFirstCompetitionWeekEditable(season: { firstCompetitionWeekLockedAt: Date | null }): boolean`**
  - Optional: **`firstCompetitionWeekLockedReason()`** for UI copy  
  Colocate **Vitest** for the pure predicate.

- [x] **Zod** — Add **`patchFirstCompetitionWeekBodySchema`** (or reuse/extend patterns from **`create-league-body.ts`**) for **`{ firstCompetitionWeek: number }`** with **1–18** (coerce if aligned with create-league).

- [x] **PATCH handler** — Add **`src/app/api/leagues/[leagueId]/first-competition-week/route.ts`** (or equivalent kebab path):
  - Read/parse JSON → Zod → **`assertCookieSessionMutationOrigin`** → **`auth()`** (order consistent with **`pre-season-init`**).
  - **401** unauthenticated; **403** if membership missing or not **`ADMIN`**.
  - **`resolveCurrentSeasonForLeague`** for current NFL year; **404** if no season row.
  - **409** if **`!isFirstCompetitionWeekEditable(season)`**.
  - **`prisma.season.update`** with **`firstCompetitionWeek`** only; return JSON including **`firstCompetitionWeek`**, **`firstCompetitionWeekLockedAt`** (ISO string or null).

- [x] **Rate limiting** — If project convention is to rate-limit all league subresource mutating verbs, extend **`src/proxy.ts`**; if only **POST** is limited today, **PATCH** can stay unrestricted—**document the choice** in the handler comment.

- [x] **Admin settings UI** — Update **`src/app/(app)/leagues/[leagueId]/settings/page.tsx`**:
  - When editable: **MUI `Stack`**, week **Select** 1–18, submit **PATCH**, surface API errors.
  - When locked: read-only **`Typography`** explaining lock; still show current week + locked timestamp if present.
  - Remove or narrow the “Editing will arrive in later stories” copy for this field only.

- [x] **Rules page** — Update **`src/app/(app)/leagues/[leagueId]/rules/page.tsx`**: load **`Season`** for **`getCurrentNflSeasonYear()`** (same pattern as league home); if **`firstCompetitionWeek > 1`**, add a short **“Season start”** section with the AC5 wording.

- [x] **Regression** — **`npm run lint`**, **`npm test`**, **`npm run build`**.

## Dev Notes

### Epic context

- **`Season.firstCompetitionWeek`** is already the **single source of truth** for when picks/scoring apply (**Story 2.1**). **2.7** adds **lifecycle**: admin **edit before lock**, **immutable after lock**, participant **rules copy**, and a **DB flag** Epic 3+ will set.
- **Downstream:** **Epic 3** (**3.1** schedule, **3.4** picks, **3.5** deadlines) **must** consult **`firstCompetitionWeek`** for “current competition week” and **must set `firstCompetitionWeekLockedAt`** when AC3 triggers—avoid hard-coding “all leagues start at NFL Week 1.”

### Technical requirements

| Area | Requirement |
|------|-------------|
| **Field** | **`firstCompetitionWeek`** stays on **`Season`**; lock is **`firstCompetitionWeekLockedAt`** on the same row. |
| **Auth** | Admin-only mutation: **`LeagueMembershipRole.ADMIN`** only (same as **`pre-season-init`**). |
| **Errors** | **`{ error: { code, message } }`**; **409** for locked; **404** missing season. |
| **UI** | **MUI**; **`Stack`** for flex layouts [Source: `docs/project-context.md`]. |

### Architecture compliance

- Single Prisma client **`@/lib/db`**; **snake_case** DB columns; **camelCase** JSON.
- **NFR15:** **`assertCookieSessionMutationOrigin`** on the PATCH handler after body parse.
- Next.js App Router: **`await context.params`** in route handlers; **`await params`** on pages.

### Library & framework requirements

| Package | Version (repo) | Notes |
|---------|----------------|-------|
| `next` | `16.2.2` | Route Handlers under **`src/app/api/...`**. |
| `next-auth` | `^5.0.0-beta.30` | `auth()`. |
| `@prisma/client` | `6.19.0` | Migration committed. |
| `zod` | `^4.x` | Match **`create-league-body`**. |
| `@mui/material` | `^7.x` | Settings + rules sections. |

### File structure requirements

```
prisma/schema.prisma
prisma/migrations/.../migration.sql
src/lib/league/first-competition-week.ts
src/lib/league/first-competition-week.test.ts
src/lib/league/patch-first-competition-week-body.ts   # optional split
src/app/api/leagues/[leagueId]/first-competition-week/route.ts
src/app/(app)/leagues/[leagueId]/settings/page.tsx
src/app/(app)/leagues/[leagueId]/settings/...        # client form if extracted
src/app/(app)/leagues/[leagueId]/rules/page.tsx
src/proxy.ts                                         # optional rate limit
```

### Testing requirements

- Unit: **editable vs locked** predicate; **Zod** boundary **1–18**.
- Optional: integration test for PATCH with Prisma **test DB** if project adds that pattern later—otherwise manual QA in settings.

### Previous story intelligence (2.6)

**Artifact:** `_bmad-output/implementation-artifacts/2-6-admin-as-full-participant.md`.

- Participant routes use **`isLeagueParticipantRole`**; **settings** remain **`ADMIN`**-only via **`role === ADMIN`** (or equivalent)—do not loosen.
- **Canonical picks path:** **`/leagues/[leagueId]/picks`**—2.7 does not implement picks, but Epic 3 will use **`firstCompetitionWeek`** there.

### Git intelligence

- Recent patterns: **`resolveCurrentSeasonForLeague`**, **`pre-season-init`** POST handler, **`describeSeasonForParticipant`** for mid-season copy on league home / **my-leagues**.

### Latest tech information

- Dynamic **`params`** are **Promises**—always **`await`** in App Router **RSC** and route handlers.

### Project context reference

- `docs/project-context.md` — JSON errors, Stack, server authority for later deadline/pick rules.
- `_bmad-output/planning-artifacts/epics.md` — Story **2.7** (first competition week, mid-season, immutability).

### Scope boundaries (avoid creep)

- **Do not** implement **`Pick`** models, odds, jailed team, or deadline math (**Epic 3**).
- **Do not** implement **FR61** league delete (**Story 2.8**).
- **Do not** change **create-league** defaults beyond ensuring **settings PATCH** stays consistent with **2.1** validation.
- **Support/migration** path to edit after lock is **out of scope**—document as manual DBA/support if ever needed.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

_(none)_

### Completion Notes List

- Added `Season.firstCompetitionWeekLockedAt` with migration; Prisma client regenerated; `migrate deploy` applied successfully against project DB.
- PATCH `/api/leagues/[leagueId]/first-competition-week` mirrors pre-season-init auth/CSRF order; 409 `FIRST_COMPETITION_WEEK_LOCKED` when locked; list/joined/create-league JSON extended with `firstCompetitionWeekLockedAt` for clients.
- Admin settings: client `FirstCompetitionWeekSettings` (MUI Stack + Select); rules page “Season start” when week > 1; `describeSeasonForParticipant` appends lock sentence when timestamp set.
- Rate limit: documented in route file only (proxy still POST-only for league subresources).

### File List

- `prisma/schema.prisma`
- `prisma/migrations/20260418120000_season_first_competition_week_locked_at/migration.sql`
- `src/lib/league/first-competition-week.ts`
- `src/lib/league/first-competition-week.test.ts`
- `src/lib/league/patch-first-competition-week-body.ts`
- `src/lib/league/patch-first-competition-week-body.test.ts`
- `src/lib/league/list-administered-leagues.ts`
- `src/lib/league/list-joined-leagues.ts`
- `src/lib/league/list-administered-leagues.test.ts`
- `src/lib/league/list-joined-leagues.test.ts`
- `src/app/api/leagues/[leagueId]/first-competition-week/route.ts`
- `src/app/api/leagues/route.ts`
- `src/app/api/leagues/joined/route.ts`
- `src/app/(app)/leagues/[leagueId]/settings/page.tsx`
- `src/app/(app)/leagues/[leagueId]/settings/first-competition-week-settings.tsx`
- `src/app/(app)/leagues/[leagueId]/rules/page.tsx`
- `src/app/(app)/leagues/[leagueId]/page.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- **2026-04-18** — Story authored from `epics.md`, `sprint-status.yaml`, Prisma **`Season`**, Stories **2.1** / **2.5** / **2.6** patterns. Status **ready-for-dev**.
- **2026-04-18** — Implemented schema, PATCH API, settings + rules UI, serializers, tests; status **review**.
- **2026-04-18** — Code review passed; status **done**.
