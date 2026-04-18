# Story 3.1: NFL schedule, teams, and 18-week season model

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the system,
I want **regular-season weeks, games, and teams** modeled in the database and populated for the active NFL season year,
so that **picks attach to real matchups** (**FR58**, **FR59**) and **Week 1** is addressable for **pre-season preview** work (**Stories 3.2, 3.6**), while **league competition start** respects **`Season.firstCompetitionWeek`** (**Stories 2.1, 2.7**).

## Acceptance Criteria

1. **Given** **`Team`** and **`NflGame`** (or equivalent names) Prisma models exist for the **NFL regular season**  
   **When** migrations apply  
   **Then** each game row is scoped to **`nflSeasonYear`** + **`weekNumber`** where **`weekNumber` is in `1..18`** (enforce in app/Zod; DB check optional)  
   **And** each game references **home** and **away** teams via FKs; kickoff is stored as **UTC** (`DateTime` `@db.Timestamptz`) for future deadline math (**Epic 3.5**)

2. **Given** **`getCurrentNflSeasonYear()`** (**`src/lib/league/nfl-season.ts`**) defines the deployment’s active season label  
   **When** **seed** and/or **sync** runs for that year  
   **Then** **Week 1** regular-season games exist in the database for that **`nflSeasonYear`** so off-season UIs can target Week 1 (**`epics.md`**, pre-season preview)

3. **Given** a league **`Season`** row with **`firstCompetitionWeek`** (**1–18**)  
   **When** domain helpers resolve **“is this NFL week in competition for this season?”**  
   **Then** weeks **strictly before** **`firstCompetitionWeek`** are **out of scope** for that league’s competition (no phantom picks)—**Epic 3** must use this when exposing “current pick week” and enforcing picks (**`docs/project-context.md`** #8)

4. **Given** the need for **unambiguous pick targets** (**FR59**)  
   **When** the schema is complete for this story  
   **Then** a **`Pick`** (name up to you) model exists with FKs to **`Season`**, **`LeagueMembership`**, **`Team`**, and a **`nflWeekNumber`** (or FK to a week entity if you introduce one), with **`@@unique([leagueMembershipId, nflWeekNumber])`** (or equivalent) so **one saved pick per member per week** is representable—**`POST` pick API remains Story 3.4**; this story only establishes **persistence + relations**

5. **Given** **`Season.firstCompetitionWeekLockedAt`** (**Story 2.7**)  
   **When** **`Pick`** rows are first persisted (**Story 3.4+**) or deadline authority lands (**3.5**)  
   **Then** writers set **`firstCompetitionWeekLockedAt`** per **2.7 AC3**—**3.1** documents the hook points; **implement the writers in the stories that first create picks / enforce deadlines** (do not leave silent gaps)

6. **Given** **league delete** (**Story 2.8**, **FR61**)  
   **When** a **`League`** is deleted  
   **Then** all **`Pick`** / **`Season`**-scoped schedule-dependent rows **cascade** per **`schema.prisma`** header rules—**global **`Team`** / **`NflGame`** rows** must **not** disappear when one league is deleted (no `League` FK on those tables)

## Tasks / Subtasks

- [x] **Schema** — Add **`Team`**, **`NflGame`**, and **`Pick`** (minimal fields for AC4; extend in 3.4/3.5 as needed). Use **`@map` snake_case** columns, **`cuid()`** ids consistent with existing models. Decide **`onDelete`** explicitly: **`Pick` → `Season` / `LeagueMembership`:** `Cascade`**; **`Pick` → `Team`:** `Restrict`** (teams are canonical). **`NflGame` → `Team`:** `Restrict`**. Add indexes for **`(nflSeasonYear, weekNumber)`** reads.
- [x] **Pure helpers** — Add **`src/lib/nfl/`** (or **`src/lib/domain/schedule/`**) helpers, e.g. **`isNflRegularSeasonWeek(n: number): boolean`**, **`isWeekInLeagueCompetition(season: { firstCompetitionWeek: number }, nflWeekNumber: number): boolean`**, **`assertNflRegularSeasonWeek`** for Zod **`refine`**. Co-locate **Vitest**.
- [x] **Seed or sync** — Extend **`prisma/seed.cjs`** (and/or add a **`scripts/`** importable JSON) to insert **all 32 teams** and **regular-season games for Week 1** at minimum for **`getCurrentNflSeasonYear()`**; document how to **expand to full 18 weeks** (more seed data vs future provider sync in a later story). **Do not** put API keys in seed; static data is fine for MVP.
- [x] **Prisma relation to existing `Season`** — **`Pick.seasonId` → `Season`** so picks are league-scoped through **`Season.leagueId`**. **`NflGame`** remains **NFL-global** (keyed by **`nflSeasonYear`**, not **`Season.id`**), unless you justify otherwise in Dev Notes.
- [x] **Regression** — **`npm run lint`**, **`npm test`**, **`npm run build`**, **`npm run db:migrate`** (committed migration).

## Dev Notes

### Epic context

- **Epic 3 goal:** weekly pick experience: odds, jailed logic, validation, deadlines (**`epics.md`**). **3.1** is the **data foundation**; **3.2** attaches odds snapshots; **3.3** jailed computation; **3.4** pick mutation API; **3.5** deadline authority; **3.6+** UI.
- **Pre-season:** Week 1 must exist in DB for preview/smoke tests before picks open.

### Technical requirements

| Area | Requirement |
|------|-------------|
| **Time** | Store kickoffs **UTC**; document **America/New_York** for display/deadline rules in later stories [Source: `docs/project-context.md`] |
| **Season year** | Align with **`getCurrentNflSeasonYear()`** and **`NFL_SEASON_YEAR`** env for tests [Source: `src/lib/league/nfl-season.ts`] |
| **League week** | **`Season.firstCompetitionWeek`** is the **SSoT** for when competition starts; never assume all leagues start at NFL Week 1 [Source: `docs/project-context.md` #8, Story **2.7**] |
| **Errors** | Any **admin seed/sync Route Handler** (if added) uses **`{ error: { code, message } }`** and **Zod** on input [Source: `docs/project-context.md`] |
| **CSRF** | If you add **cookie-authenticated mutating** routes for schedule import, follow **`assertCookieSessionMutationOrigin`** order like **`pre-season-init`** |

### Architecture compliance

- Single Prisma client **`@/lib/db`**; **snake_case** DB; **camelCase** JSON.
- Domain logic in **`src/lib/domain`** or **`src/lib/nfl`**—testable, no React imports.
- **Referential actions:** **`schema.prisma`** header documents **Cascade** for league-scoped children; **do not** cascade-delete global NFL tables when a league is deleted.

### Library & framework requirements

| Package | Version (repo) | Notes |
|---------|----------------|-------|
| `next` | `16.2.2` | App Router; optional Route Handlers for sync |
| `@prisma/client` | `^7.7.0` | Migrations committed |
| `zod` | `^4.x` | Week **`1..18`** validation |
| `vitest` | (project) | **`npm test`** |

### File structure requirements

```
prisma/schema.prisma
prisma/migrations/.../migration.sql
prisma/seed.cjs                        # extend
src/lib/nfl/...ts                      # or src/lib/domain/schedule/...
src/lib/league/resolve-current-season.ts  # consume season + week helpers as needed later
```

### Testing requirements

- Unit: **week bounds** (`1–18`), **`isWeekInLeagueCompetition`** across **`firstCompetitionWeek`** edges (e.g. 1 vs 8).
- Optional: thin Prisma integration test if repo pattern exists—otherwise rely on seed + manual **`db:studio`** verification.

### Previous story intelligence (2.7 / Epic 2)

**Artifact:** `_bmad-output/implementation-artifacts/2-7-first-nfl-competition-week-at-league-creation-mid-season-start.md`.

- **`Season.firstCompetitionWeek`** and **`firstCompetitionWeekLockedAt`** already on **`Season`**; **3.1** must not regress **PATCH first-competition-week** or rules copy.
- **Lock writers** are **explicitly deferred** to **3.4 / 3.5** but **must be listed in those stories’ tasks** so **2.7 AC3** is satisfied when picks/deadlines exist.

### Git intelligence

- Recent work: **Epic 2** completion, **league delete**, **`proxy` rate limits**, **`onDelete: Cascade`** documentation in **`schema.prisma`**—extend the same **cascade discipline** for new **`Pick`** rows.

### Latest tech information

- **Dynamic `params`:** `await params` in RSC and route handlers (**Next 16**).

### Project context reference

- `docs/project-context.md` — server time authority, JSON errors, **`firstCompetitionWeek`** not always 1.
- `_bmad-output/planning-artifacts/epics.md` — **Story 3.1** AC; **FR58**, **FR59**; Epic 3 pre-season notes.

### Scope boundaries (avoid creep)

- **Do not** implement odds fetch (**3.2**), jailed algorithm (**3.3**), **pick POST/PATCH** (**3.4**), or deadline enforcement (**3.5**).
- **Do not** build full **picks UI** (**3.6+**).
- **External live schedule API** integration is optional for 3.1; **static seed** for Week 1 (and expandable) satisfies this story if documented. **Story 3.2** investigates using the **odds provider** (or another source) to load/maintain **full schedule** data—see **`epics.md`** Story 3.2 and **`docs/project-context.md`**.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- **`Pick` uniqueness:** `@@unique([leagueMembershipId, seasonId, nflWeekNumber])` (not only `leagueMembershipId` + `nflWeekNumber`) so the same membership can have distinct rows across different `Season`/NFL years without colliding.
- **`firstCompetitionWeekLockedAt` writers:** still deferred to **Stories 3.4 / 3.5** per AC5; no silent gap — those stories must set the lock when first persisting picks / enforcing deadlines.

### File List

- `prisma/schema.prisma` — `Team`, `NflGame`, `Pick`; cascade header note for global NFL tables
- `prisma/migrations/20260418215042_nfl_teams_games_picks/migration.sql`
- `prisma/data/nfl-teams.json`, `prisma/data/nfl-week1-games.json`
- `prisma/seed.cjs` — `getNflSeasonYearForSeed` + `seedNflSchedule`
- `src/lib/nfl/nfl-regular-season.ts`, `src/lib/nfl/nfl-regular-season.test.ts`

## Change Log

- **2026-04-18** — Code review complete; status **done** (`sprint-status.yaml`).
- **2026-04-18** — Linked **Story 3.2** as owner of odds-vs-schedule provider investigation (`epics.md`, `docs/project-context.md`, `architecture.md`).
- **2026-04-18** — Implemented schema, helpers, seed, migration; status **review**.
- **2026-04-18** — Story authored from **`epics.md`**, **`sprint-status.yaml`**, **`prisma/schema.prisma`**, **`docs/project-context.md`**, Story **2.7** handoff. Status **ready-for-dev**.
