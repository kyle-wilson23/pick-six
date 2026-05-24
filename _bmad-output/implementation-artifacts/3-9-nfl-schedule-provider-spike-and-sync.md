# Story 3.9: NFL schedule provider — spike, choice, and `NflGame` sync

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created -->

## Story

As the **system**,
I want an **evaluated and implemented** path to **populate or refresh** regular-season **`NflGame`** rows from a **schedule-first** third-party API (not the odds-only feed),
so that we are **not permanently dependent on seed JSON** for matchups and kickoffs (**follow-up from Story 3.2** and **`docs/nfl-odds-integration.md`**) and **`Pick`/deadline** flows always target **real games** for the active season.

## Acceptance Criteria

1. **Compare at least two credible schedule providers**

   **Given** Story **3.1** **`Team`** / **`NflGame`** shape and Story **3.2** split-provider decision documented in **`docs/nfl-odds-integration.md`**

   **When** evaluation completes

   **Then** at least **two** credible schedule providers (e.g. **API-Sports**, **SportsDataIO**, or others justified in writing) are **compared** on:

   - **cost/limits** with **preference for zero recurring cost** (free tier / MVP-scale usage),
   - **NFL regular-season coverage**,
   - **kickoff time quality (UTC)**,
   - **week indexing vs our `weekNumber` 1–18**,
   - **mapping to `Team`** (abbreviation / name alignment with `prisma/data/nfl-teams.json` and existing **`canonicalTeamDisplayName`** patterns in `src/lib/integrations/the-odds-api/team-names.ts` where reuse makes sense),
   - **operational fit** (self-serve vs sales).

2. **Select one provider and document**

   **Given** the comparison

   **When** a choice is made

   **Then** **one** provider is **selected** and **documented** in **`docs/nfl-odds-integration.md`** (or a **sibling doc** linked from it—only split if the doc becomes unwieldy) with:

   - **fallback** if the vendor changes or tier is insufficient,
   - and if the choice is **paid**, the doc **explains why** no acceptable **free** option worked (**product priority:** free of recurring cost — `epics.md` Story 3.9).

3. **Idempotent `NflGame` upsert**

   **Given** the chosen API’s fixture shape

   **When** sync runs for the **current `nflSeasonYear`** (full **1–18** weeks or a clearly documented phased rollout, e.g. “weeks 1–18 in one run” vs “on-demand per week”—justify in Dev Notes)

   **Then** **`nfl_games`** rows are **upserted** idempotently (safe to run twice without duplicate games or broken FKs)

   **And** upserts **do not** violate **`Pick`** uniqueness or orphan picks: changing **`kickoffAt`** must remain compatible with existing **`POST /api/leagues/[leagueId]/picks`** deadline logic (server-authoritative UTC + Eastern rules — `docs/project-context.md` #3)

   **And** **`Team`** FKs remain valid (`onDelete: Restrict` on `nfl_games` — `prisma/schema.prisma`); unknown teams **fail loudly** in logs with structured context (**NFR45**), not silent bad IDs.

4. **Secrets server-only**

   **Given** `docs/project-context.md` non-negotiable **#1**

   **Then** schedule provider keys live **only** in server env (e.g. `.env.example` documents new vars **without** values)

   **And** **no** `NEXT_PUBLIC_*` for provider keys.

5. **Operator entry point**

   **Given** operators need to refresh schedule without a deploy

   **When** they trigger sync

   **Then** a **manual or admin-triggered** path exists: **Route Handler** under `src/app/api/**/route.ts` and/or **`scripts/`** CLI — consistent JSON errors `{ error: { code, message } }`, structured logs on failure (**NFR45**)

   **And** auth pattern aligns with existing admin/automation conventions (compare **`POST /api/admin/nfl/snapshot-odds`** + optional **`Authorization: Bearer`** secret pattern from **`docs/nfl-odds-integration.md`** §147–150 — reuse **do not** reinvent unless this route needs a distinct secret name; document choice).

6. **Tests without live network in default `npm test`**

   **Given** CI must stay deterministic

   **When** **`npm test`** runs

   **Then** **Vitest** covers **mapping / normalization / upsert key logic** using **fixtures** (no live HTTP in default test run)

   **And** optional live integration test, if any, is **skipped by default** or lives outside the default suite (document in Dev Notes).

---

## Tasks / Subtasks

- [x] **Spike & decision record** (AC: #1–2)
  - [x] Compare ≥2 providers; capture matrix in **`docs/nfl-odds-integration.md`** (or sibling + link)
  - [x] Record selected provider, env vars, rate limits, fallback narrative (**paid requires justification**)

- [x] **Integration module** (AC: #3–4)
  - [x] Add **`src/lib/integrations/<provider>/`** — HTTP client, Zod schemas, fixture JSON (mirror **`src/lib/integrations/the-odds-api/`** patterns: `client.ts`, `schemas.ts`, `fixtures/`)
  - [x] Map API teams → **`Team.id`** via abbreviation/name normalization; document ambiguity cases

- [x] **Sync orchestration + Prisma upsert** (AC: #3)
  - [x] Implement idempotent upsert in **`src/lib/nfl/`** (new module e.g. `sync-nfl-schedule.ts` — name TBD) using singleton **`prisma`** from **`src/lib/db.ts`**
  - [x] Define match key: likely **`(nflSeasonYear, weekNumber, homeTeamId, awayTeamId)`** or provider game id stored if schema extended — **justify** to avoid duplicate rows on re-run

- [x] **Trigger surface** (AC: #5)
  - [x] **`POST`/`GET`** admin route or **`scripts/sync-nfl-schedule.mjs`** (or TS via **`tsx`**) with documented usage
  - [x] Align auth/rate-limit story with existing admin NFL routes; update **`src/proxy.ts`** if new high-risk mutator needs sliding window (**project-context.md** sensitive routes)

- [x] **Tests** (AC: #6)
  - [x] Co-located **`*.test.ts`** for mapping and upsert-key logic with fixtures

- [x] **`npm test`** green; **`npm run lint`** / **`npm run build`** as usual before merge

### Review Findings

- [x] [Review][Decision] Allowlist vs blocklist for stage filtering — `includeRegularSeasonRow` uses a string-match blocklist; unknown provider stage strings (e.g. "Pro Bowl", "Hall of Fame") would silently pass as regular season. Consider switching to an allowlist (only pass when stage matches "Regular Season" or is absent). [`src/lib/integrations/api-sports-nfl/map-schedule.ts`]
- [x] [Review][Decision] `kickoffUtcFromGameDate` noon-UTC injection for date-only rows — when only `date` is present (no `timestamp` or `time`), returns `T12:00:00.000Z`, a fabricated kickoff that passes the null-guard and is upserted silently. This would produce an incorrect deadline lock (NFR24). Options: (a) fail-loud — return `null`, surface as `missing_kickoff` error; (b) document noon-UTC as explicit sentinel and add downstream filtering. [`src/lib/integrations/api-sports-nfl/map-schedule.ts`]
- [x] [Review][Patch] Provider `errors` field passed with HTTP 200 as status to `ApiSportsNflError` — when the response is `200 OK` but has application-level errors, `providerErrorsToApiSportsError(err, res.status)` receives `200`; the route may reflect wrong status. [`src/lib/integrations/api-sports-nfl/client.ts`]
- [x] [Review][Patch] Missing fetch timeout on provider HTTP call — a stalled API-Sports connection holds the request open indefinitely; add `AbortSignal.timeout(...)` or equivalent. [`src/lib/integrations/api-sports-nfl/client.ts`]
- [x] [Review][Patch] Network-level `TypeError` from `fetch()` not wrapped as `ApiSportsNflError` — DNS/connection failures propagate as non-`ApiSportsNflError`, bypass the catch in `syncNflScheduleFromApiSports`, and become unstructured 500s. [`src/lib/integrations/api-sports-nfl/client.ts`]
- [x] [Review][Patch] Wrong 404 status when no regular-season games found — 404 implies the resource doesn't exist; a sync that finds zero games is an unprocessable state (422) or at minimum warrants a distinct code. [`src/lib/nfl/sync-nfl-schedule.ts`]
- [x] [Review][Patch] Silent duplicate natural-key overwrite in `deduped` map — if two provider rows share the same `(season, week, home, away)`, the second silently replaces the first with no error surfaced. [`src/lib/integrations/api-sports-nfl/map-schedule.ts`]
- [x] [Review][Patch] `NFL_SEASON_YEAR` non-integer not validated in script — `Number("abc")` is `NaN`; `JSON.stringify` converts it to `null`; server returns an opaque 400 with no useful diagnostic. [`scripts/sync-nfl-schedule.mjs`]
- [x] [Review][Patch] `next: { revalidate: 0 }` couples integration client to Next.js fetch API — should be removable without affecting server-side behavior; breaks portability of `src/lib/integrations/`. [`src/lib/integrations/api-sports-nfl/client.ts`]
- [x] [Review][Patch] `sync-nfl-schedule.ts` has zero unit tests; upsert `update` block scope (`kickoffAt` only) not asserted — if the update payload were accidentally widened, `NflGameOddsLine` FKs would orphan with no test catching it. (AC6, AC3) [`src/lib/nfl/sync-nfl-schedule.ts`]
- [x] [Review][Patch] Script `fetch()` network rejection unhandled — unhandled promise rejection exits without printing any diagnostic. [`scripts/sync-nfl-schedule.mjs`]
- [x] [Review][Patch] Prisma DB errors (`findMany`, `$transaction`) not caught in `syncNflScheduleFromApiSports` — non-`ApiSportsNflError` DB errors re-throw and produce an unstructured Next.js 500. [`src/lib/nfl/sync-nfl-schedule.ts`]
- [x] [Review][Patch] `kickoffUtcFromGameDate` date+time and date-only fallback branches have zero test coverage — two of three normalization paths unvalidated against AC6 UTC-quality requirement. [`src/lib/integrations/api-sports-nfl/map-schedule.test.ts`]
- [x] [Review][Patch] Fixture `results: 2` but `response` has 3 entries — fixture misrepresents a valid provider response; will mislead any future contributor and break if schema ever enforces `results === response.length`. [`src/lib/integrations/api-sports-nfl/fixtures/games-regular-season-sample.json`]
- [x] [Review][Defer] Serial `for-await` upserts inside `$transaction` — N sequential DB round-trips for up to 280+ games; `Promise.all` or batch upsert would improve throughput. [`src/lib/nfl/sync-nfl-schedule.ts`] — deferred, pre-existing pattern; admin-only low-frequency operation
- [x] [Review][Defer] Overly permissive Zod schemas — all team/date fields optional; validation errors surface only at mapping layer with less precise messages. [`src/lib/integrations/api-sports-nfl/schemas.ts`] — deferred, consistent with existing `the-odds-api` integration pattern
- [x] [Review][Defer] Rename migration (`20260511022811`) only truncates index name — already applied to DB; no functional change but adds migration noise. [`prisma/migrations/20260511022811_2026_first_games_migration/migration.sql`] — deferred, already applied
- [x] [Review][Defer] All 32 teams loaded from DB on every sync call — minor; `findMany` is fast at this scale but unnecessary if team table grows. [`src/lib/nfl/sync-nfl-schedule.ts`] — deferred, negligible at current scale

---

## Dev Notes

### Architecture compliance

- **Route Handlers + Zod** at API boundary; **camelCase** JSON / **snake_case** DB per **`docs/project-context.md`** #6.
- **Single Prisma client** from **`src/lib/db.ts`**.
- **Global NFL data** (`Team`, `NflGame`) is **not** league-scoped — sync affects **all leagues** using that season year; **`Season.first_competition_week`** still gates **competition** via app logic (**Story 2.7**), not this sync.
- **`docs/nfl-odds-integration.md`** already positions **The Odds API** for lines and **seed/JSON** for schedule until 3.9 — **update** that “schedule” section after implementation so ops knows the new source of truth.

### Schema / data hazards

- **`NflGame`**: `nflSeasonYear`, `weekNumber`, `homeTeamId`, `awayTeamId`, `kickoffAt` (**UTC `Timestamptz`**). Deadline story (**3.5**) derives lock from **first kickoff of week** — incorrect **`kickoffAt`** breaks fairness (**NFR24**).
- **`Pick`** references **`team_id`** + **`nfl_week_number`**, not **`nfl_game_id`** — schedule sync must **not** imply picks attach to games by FK; verify week boundaries stay consistent when games list changes (edge case: provider adds flex game — document behavior).
- **Odds lines** attach to **`nfl_game_id`** — if game rows are **replaced** vs **updated**, ensure **`NflGameOddsLine`** rows do not orphan (prefer **stable `NflGame.id`** via upsert-on-natural-key or explicit migration note).

### File / placement hints

| Area | Likely location |
|------|-----------------|
| Provider client + Zod | `src/lib/integrations/<schedule-provider>/` |
| Sync orchestration | `src/lib/nfl/sync-*.ts` (name TBD) |
| API trigger | `src/app/api/admin/nfl/.../route.ts` (follow existing admin nfl routes) |
| Fixtures for tests | `src/lib/integrations/<schedule-provider>/fixtures/` |
| Ops doc | `docs/nfl-odds-integration.md` (+ link from README if needed — **only if requested**) |

### Testing standards

- **Vitest** co-located tests; **no live network** in default **`npm test`** (**architecture.md**, **`docs/project-context.md`** Testing).
- Prefer testing **pure** mapping functions and **upsert key** construction; mock Prisma only if needed for orchestration tests.

---

### Project Structure Notes

- Align with existing **`the-odds-api`** integration layout for consistency.
- Do **not** move **`Pick`** deadline logic into the integration layer — sync only maintains **`NflGame`**; **`src/lib`** deadline helpers stay authoritative.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 3.9]
- [Source: `docs/nfl-odds-integration.md` — schedule gap, API-Sports mention, odds vs schedule split]
- [Source: `docs/project-context.md` — secrets, Prisma singleton, deadlines, JSON errors]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — integrations server-only, `src/lib/nfl/`, Route Handlers]
- [Source: `prisma/schema.prisma` — `NflGame`, `Team`, relations]

---

## Previous story intelligence (3.8)

- **Story 3.8** delivered **static logos** under **`public/nfl-logos/`**, **`resolveNflLogoSrc`**, and **`TeamLogo`** updates (`_bmad-output/implementation-artifacts/3-8-nfl-team-logos-discovery-and-implementation.md`). **No direct dependency** for 3.9 except shared **`Team.abbreviation`** alignment when mapping provider team identifiers.
- Pattern: **discover → document in `docs/` → implement with **tests** for pure helpers** and **fail-soft** UX where appropriate. Schedule sync is **server/Ops** — prefer **loud, structured failures** over silent partial schedule.

---

## Git intelligence (recent commits)

Recent epic 3 work touched **`feat(picks): Story 3.8 NFL team logos`**, **`3.7` UX**, **`3.6` weather**, **`3.5` deadline**, **`3.4` pick API**. Conventions: **`feat(picks): Story X-Y …`** commit style; picks surfaces use **MUI** + server-backed data. 3.9 is **integration/backend-heavy** — commits might be **`feat(nfl):`** or **`feat(admin):`** — match whichever prefix dominates **`git log`** at implementation time.

---

## Latest tech information (working assumptions — verify at implementation)

- Provider **free tiers and endpoints change** — re-verify pricing/docs before committing to paid keys (`docs/nfl-odds-integration.md` already warns).
- **API-Sports** (RapidAPI / api-sports.io) NFL endpoints commonly expose **fixture id**, **teams**, **timezone-aware kickoff** — confirm **UTC** handling in vendor docs when implementing **`kickoffAt`**.

---

## Project context reference

Must honor: **`docs/project-context.md`** (secrets, single Prisma client, server-authoritative deadlines, rate limits on sensitive **`POST`** routes, **no** configurable rules engine in MVP).

---

## Story completion status

**review** — Implementation complete; `npm test`, `lint`, and `build` passed locally (2026-05-10).

---

## Change Log

- 2026-05-10: Story 3.9 — API-Sports NFL schedule integration, Prisma natural key on `NflGame`, `POST /api/admin/nfl/sync-schedule`, docs + fixtures + Vitest.

---

## Dev Agent Record

### Agent Model Used

Cursor agent

### Implementation Plan

- **Phased rollout:** One **`/games`** call loads the full season; mapping keeps **regular season weeks 1–18** only (pre/postseason filtered). Matches AC “full 1–18 weeks in one run.”
- **Upsert key:** `@@unique([nflSeasonYear, weekNumber, homeTeamId, awayTeamId])` — stable `NflGame.id` for `NflGameOddsLine`; `update` only `kickoffAt`.
- **Auth:** Reused **`ODDS_SNAPSHOT_SECRET`** + `assertAuthorizedForNflOddsOps` with **`POST /api/admin/nfl/sync-schedule`** (no new secret name).
- **Proxy:** No **`src/proxy.ts`** change — route not in credential-style rate-limit list (matches other admin NFL mutators).

### Debug Log References

_(none)_

### Completion Notes List

- Compared **API-Sports** vs **SportsDataIO** in `docs/nfl-odds-integration.md`; selected **API-Sports** for self-serve free tier / schedule fit.
- Added `src/lib/integrations/api-sports-nfl/` (client, schemas, `map-schedule`, fixtures) and `src/lib/nfl/sync-nfl-schedule.ts`.
- Migration `20260510120000_nfl_games_natural_key_unique` adds composite unique for schedules upsert.
- Optional live network tests: **not** added; default `npm test` is fixture-only per AC6.

### File List

- `prisma/schema.prisma`
- `prisma/migrations/20260510120000_nfl_games_natural_key_unique/migration.sql`
- `src/lib/integrations/api-sports-nfl/client.ts`
- `src/lib/integrations/api-sports-nfl/schemas.ts`
- `src/lib/integrations/api-sports-nfl/map-schedule.ts`
- `src/lib/integrations/api-sports-nfl/schemas.test.ts`
- `src/lib/integrations/api-sports-nfl/map-schedule.test.ts`
- `src/lib/integrations/api-sports-nfl/fixtures/games-regular-season-sample.json`
- `src/lib/nfl/sync-nfl-schedule.ts`
- `src/lib/nfl/authorize-odds-admin.ts`
- `src/app/api/admin/nfl/sync-schedule/route.ts`
- `scripts/sync-nfl-schedule.mjs`
- `.env.example`
- `docs/nfl-odds-integration.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`