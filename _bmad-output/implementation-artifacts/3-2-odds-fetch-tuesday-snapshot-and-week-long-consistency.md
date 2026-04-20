# Story 3.2: Odds fetch, Tuesday snapshot, and week-long consistency

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the system,
I want **moneyline and point-spread lines** fetched **server-side**, **snapshotted** on the **Tuesday** cadence (manual trigger acceptable until Epic 6 cron), and **served consistently** for all reads until the next snapshot,
so that **jailed-team logic** and **participant-facing odds** stay **stable within the week** (**NFR29–NFR31**), **degrade gracefully** when upstream data fails (**NFR26**, **NFR30**), and **pre-season smoke tests** can validate integrations against **NFL Week 1** before picks officially open (**`epics.md`**, Stories **3.6** preview).

**Product preference — data source:** Prefer a **free-tier or low-cost third-party sports/odds API** (or combination only if necessary) that can supply **both** **(a)** per-game **moneyline and spread** and **(b)** **regular-season schedule** data (matchups, kickoff instants, weeks **1–18**) to populate or refresh **`NflGame`** (Story **3.1**). **Spike, document, and implement** the chosen approach here: **single provider** vs **separate schedule + odds sources**, with **cost, limits, and compliance** noted. If no acceptable **single** free-tier provider covers both, **document why** and wire the **minimal** second integration—without silently duplicating paid dependencies.

**Bonus (non-blocking):** If a candidate API also exposes **per-team thumbnail or logo image URLs** (or small badge assets), treat that as a **nice-to-have** during the spike—note availability, licensing/hotlinking terms, and stable IDs—so **Story 3.8** (full logo treatment) can reuse or ignore them. **No requirement** to wire images into the UI in **3.2**.

## Acceptance Criteria

1. **Given** a **server-only** configuration for the chosen provider(s) (e.g. **`ODDS_API_KEY`** / schedule key names TBD in implementation) documented in **`.env.example`**  
   **When** the app runs in any environment  
   **Then** **no** odds or schedule secrets appear in client bundles, **`NEXT_PUBLIC_*`**, or logged responses (**`docs/project-context.md`** #1, **architecture.md** server-only integrations).

2. **Given** **`NflGame`** and **`Team`** from Story **3.1**  
   **When** a **Tuesday snapshot** (or equivalent named operation) runs for **`nflSeasonYear` + `weekNumber`**  
   **Then** **moneyline** (both sides or equivalent normalized representation) and **point spread** (or documented MVP subset if provider differs) are **persisted** in PostgreSQL and tied **unambiguously** to **`NflGame`** rows (or a child table keyed by `nfl_game_id`) so **Story 3.3** can read stable numbers (**FR14**, **FR15** inputs; **NFR23** depends on accurate snapshot).

3. **Given** a successful snapshot for an active competition week  
   **When** any server read path serves odds for that week  
   **Then** values come from the **latest completed snapshot** for that week and **do not** silently refresh mid-week from the provider (**NFR31**). (Clarify in code/docs what “mid-week” means: no automatic re-fetch for **in-season** weekly lines between snapshots unless admin explicitly triggers a correction path.)

4. **Given** the upstream API **fails** or returns partial data  
   **When** snapshot or fetch runs  
   **Then** the system **does not** pretend success: errors are **structured/logged** (**NFR45**), and an **admin manual entry or correction path** exists per **NFR26**, **NFR30** (minimal UI or seed/script acceptable at MVP if gated to admins and documented—exact UX can deepen in **3.6**).

5. **Given** **off-season** or **pre-kickoff** (e.g. July–August) or **leagues not yet in their pick window**  
   **When** an **admin-triggered** or **documented on-demand** fetch runs for **NFL regular season Week 1**  
   **Then** the integration can still **fetch and persist or serve** Week **1** lines (early or live as the provider exposes) so third-party behavior is **validated before** picks open; **in-season Tuesday snapshot rules** remain as defined once the weekly competition cadence applies (**`epics.md`** Story **3.2**).

6. **Given** the maintenance goal to avoid duplicate work across schedule and odds  
   **When** this story is complete  
   **Then** **`docs/` or `_bmad-output/planning-artifacts/architecture.md`** (whichever the project uses for integration decisions) contains a **short decision record**: evaluated provider(s), **free-tier constraints**, whether **one** API covers **schedule + odds**, **mapping** from API identifiers → **`Team.abbreviation`** / **`NflGame`**, **fallback** if the provider drops a tier or changes fields, and (if applicable) whether the provider offers **team thumbnail/logo asset URLs** and any **compliance** notes for downstream **Story 3.8**. **Implement** schedule refresh **here** if the spike concludes a single provider should own **`NflGame`** updates; **defer** only if the write-up proves a hard split, with a concrete follow-up story ID or backlog pointer.

7. **Given** **Story 2.7** **`Season.firstCompetitionWeek`**  
   **When** determining which NFL week is “active” for a **league**  
   **Then** snapshot triggers and “current week” helpers **respect** that league’s competition window (no requirement to snapshot weeks the league will never play—**document** behavior for global NFL data vs league-scoped views).

## Tasks / Subtasks

- [x] **Spike — provider fit (free tier + dual use)** — Evaluate **at least one** **free or low-cost** API that could supply **both** odds (moneyline + spread) **and** full **regular-season schedule**; record limits, auth, allowed use, and whether **`NflGame`** can be maintained from it. **Bonus:** note if the API includes **team thumbnails/logos** and terms of use. Compare to split providers if needed (AC6).
- [x] **Schema** — Add persisted odds fields and/or snapshot tables with **`@map` snake_case**, FK to **`NflGame`**, indexes for **`(nfl_season_year, week_number)`** reads; consider optional **`odds_snapshot_run`** metadata (timestamp, source, status) for audit. Migration committed.
- [x] **`src/lib/integrations/`** — Adapter module(s): fetch raw payload → map to domain types → validate with **Zod**; **no** secrets in client; unit tests with **fixtures** (recorded JSON), not live keys in CI.
- [x] **Snapshot command path** — **Route Handler** or **`scripts/`** entry (document which) to run Tuesday snapshot **manually**; idempotent where possible; logs success/failure (**NFR45**). Epic **6** will cron this later.
- [x] **Admin fallback** — Minimal path to **enter or patch** odds for a week/game when API fails (AC4); protect with **session + any league admin** or **`Authorization: Bearer ODDS_SNAPSHOT_SECRET`** (automation), per **`src/lib/nfl/authorize-odds-admin.ts`** — there is **no** separate app-wide “super admin” role for these routes (**NFR16** pattern from existing routes).
- [x] **Schedule refresh (AC6)** — Outcome **documented**: **split** provider — **The Odds API** for lines + **seed / JSON** for **`NflGame`**; automated schedule **upsert** **not** implemented in 3.2. **Follow-up:** Story **3.9** and **`docs/nfl-odds-integration.md`** (see *Current integration* and *When to re-open vendor choice*).
- [x] **Regression** — **`npm run lint`**, **`npm test`**, **`npm run build`**, migrate.

## Dev Notes

### Epic context

- **3.1** provides **`Team`**, **`NflGame`**, **`Pick`** skeleton. **3.2** adds **odds persistence + fetch**; **3.3** consumes moneyline for jailed; **3.4+** picks/deadlines.
- **Pre-season / Week 1:** supports integration validation before September (**UX + epics**).

### Local setup and manual QA

- **Setup (API key, migrate, seed, routes, UI):** see **`docs/nfl-odds-integration.md`** sections **Setup (The Odds API in this app)** and **Manual testing (concise)**.

### Technical requirements

| Area | Requirement |
|------|-------------|
| **Secrets** | Env vars only on server; document in **`.env.example`** [Source: **`docs/project-context.md`**] |
| **JSON errors** | Route handlers return **`{ error: { code, message } }`** [Source: **`docs/project-context.md`**] |
| **Time** | Kickoffs already **UTC** on **`NflGame`**; snapshot timestamps **UTC**; business “Tuesday” defined in **`America/New_York`** for later cron alignment [Source: **`docs/project-context.md`**] |
| **DB** | **camelCase** Prisma / **snake_case** DB; single Prisma client **`@/lib/db`** |
| **Integrations folder** | **`src/lib/integrations/*`** or **`src/lib/nfl/`** adapters per **architecture.md** — pick one pattern and stay consistent |

### Architecture compliance

- **Free / low-cost odds APIs** explicitly allowed in **architecture.md** (implementation-time vendor choice).
- **Story 3.2** owns **schedule vs odds same-provider** decision [Source: **`architecture.md`**, **`docs/project-context.md`** “NFL schedule + odds”].
- **Vercel Hobby cron** not required in this story; **manual** snapshot satisfies AC until **6.5**.

### Library & framework requirements

| Package | Notes |
|---------|--------|
| `zod` | Validate API payloads and admin PATCH bodies |
| `vitest` | Fixture-based tests for mapping + snapshot idempotency |
| `next` | Route Handlers for snapshot trigger + admin patch |

### File structure (guidance)

```
src/lib/integrations/the-odds-api/  # provider client, Zod, fixtures
src/lib/nfl/                      # snapshot persistence, matching, effective reads
src/app/api/admin/nfl/            # snapshot-odds, week-odds, games/[gameId]/odds-line
prisma/schema.prisma
prisma/migrations/...
.env.example
```

### Testing requirements

- Unit: mapping from provider JSON → DB fields; edge cases: missing team, postponed game, partial week.
- No live network in default **`npm test`**; use recorded fixtures or mocks.

### Previous story intelligence (3.1)

**Artifact:** `_bmad-output/implementation-artifacts/3-1-nfl-schedule-teams-and-18-week-season-model.md`.

- **`NflGame`** is **global** ( **`nflSeasonYear`**, **`weekNumber`** ); odds attach to **games**, not **`Season.id`**.
- **`Pick`** uniqueness: **`@@unique([leagueMembershipId, seasonId, nflWeekNumber])`** — do not break.
- **`firstCompetitionWeekLockedAt`** writers still **3.4 / 3.5**.

### Project context reference

- **`docs/project-context.md`** — secrets, JSON shape, **Story 3.2** owns schedule/odds provider investigation.
- **`_bmad-output/planning-artifacts/epics.md`** — Story **3.2** AC; **NFR26–NFR31**.

### Scope boundaries

- **Do not** implement full **jailed** algorithm (**3.3**).
- **Do not** implement **pick POST** (**3.4**) or **deadline** enforcement (**3.5**).
- **Do not** build full **picks UI** (**3.6**); optional minimal admin form for odds fallback is in scope for **AC4**.
- **Do not** implement **`TeamLogo`** / production logo pipeline (**3.8**) here—only **document** provider-offered thumbnails if discovered (**bonus** above).

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- Implemented **The Odds API** integration (`src/lib/integrations/the-odds-api/`) with Zod validation, recorded JSON fixtures, and Vitest coverage for mapping and extraction.
- Added **`OddsSnapshotRun`** + **`NflGameOddsLine`** (migration `20260418223319_odds_snapshot_and_nfl_game_lines`); effective reads use **latest completed line per game** via `getEffectiveOddsLinesForWeek` so partial snapshots and manual one-game patches compose.
- **AC4 / partial weeks:** A snapshot run can **`COMPLETED`** with `matchedGames < totalGamesInWeek` when the provider matches only some games; the API returns **200** and logs **`odds_snapshot_partial`**. That is **not** treated as full upstream success for the whole week — operators should **GET week-odds** and use **manual PATCH** for remaining games. **Hard failures** (no lines, upstream error, no DB games) return **4xx/5xx** with structured errors and logged JSON (**NFR45**).
- **AC7:** Snapshot and week-odds APIs are **global** (`nflSeasonYear` + `weekNumber`). They **do not** enforce `Season.firstCompetitionWeek` per league; that field gates **league competition and picks**, not whether global Week 1 lines can be fetched for smoke tests. Settings UI surfaces **`firstCompetitionWeek`** for context only — **operational** discipline which weeks to snapshot, not a DB constraint.
- **POST `/api/admin/nfl/snapshot-odds`**, **GET `/api/admin/nfl/week-odds`**, **PATCH `/api/admin/nfl/games/[gameId]/odds-line`**; auth = **any league admin** session or **`Authorization: Bearer ODDS_SNAPSHOT_SECRET`** (automation bypasses CSRF). **`ODDS_API_KEY`** required for provider snapshots.
- League **settings** page: **`NflOddsAdminPanel`** for snapshot + manual lines. Decision record: **`docs/nfl-odds-integration.md`**; **`docs/project-context.md`** updated to point to it. **Schedule refresh** deferred with backlog note in that doc (split provider: odds API + seed schedule).

### File List

- `prisma/schema.prisma`
- `prisma/migrations/20260418223319_odds_snapshot_and_nfl_game_lines/migration.sql`
- `.env.example`
- `docs/nfl-odds-integration.md`
- `docs/project-context.md`
- `src/lib/integrations/the-odds-api/client.ts`
- `src/lib/integrations/the-odds-api/extract-lines.ts`
- `src/lib/integrations/the-odds-api/schemas.ts`
- `src/lib/integrations/the-odds-api/team-names.ts`
- `src/lib/integrations/the-odds-api/fixtures/nfl-odds-sample.json`
- `src/lib/integrations/the-odds-api/extract-lines.test.ts`
- `src/lib/integrations/the-odds-api/schemas.test.ts`
- `src/lib/nfl/match-the-odds-events.ts`
- `src/lib/nfl/match-the-odds-events.test.ts`
- `src/lib/nfl/effective-odds.ts`
- `src/lib/nfl/effective-odds.test.ts`
- `src/lib/nfl/snapshot-nfl-week-odds.ts`
- `src/lib/nfl/authorize-odds-admin.ts`
- `src/app/api/admin/nfl/snapshot-odds/route.ts`
- `src/app/api/admin/nfl/week-odds/route.ts`
- `src/app/api/admin/nfl/games/[gameId]/odds-line/route.ts`
- `src/app/(app)/leagues/[leagueId]/settings/page.tsx`
- `src/app/(app)/leagues/[leagueId]/settings/nfl-odds-admin-panel.tsx`

## Change Log

- **2026-04-18** — Story created from **`epics.md`** Story **3.2**, **`sprint-status.yaml`**, **`architecture.md`**, **`docs/project-context.md`**, Story **3.1** handoff. Emphasis: **free/low-cost API preference** for **both** odds and **schedule/matchups**. Status **ready-for-dev**.
- **2026-04-18** — Documented **bonus** preference: third-party **team thumbnail/logo URLs** in provider spike and decision record; implementation deferred to **Story 3.8** unless trivial to persist.
- **2026-04-18** — Implemented odds snapshot + manual admin path; schema, integration, API routes, settings UI, tests, and **`docs/nfl-odds-integration.md`**. Status **review**.
- **2026-04-19** — Story doc: aligned **schedule task** with **deferred** 3.9 outcome; **auth** wording (league admin + bearer, no app super-admin); **file paths**; **AC4** partial snapshot and **AC7** global-vs-league notes; **`effective-odds`** unit tests; **`docs/nfl-odds-integration.md`** partial-week subsection.
- **2026-04-20** — Marked **done** in **`sprint-status.yaml`** after review.
