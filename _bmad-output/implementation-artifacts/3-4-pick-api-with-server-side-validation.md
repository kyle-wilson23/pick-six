# Story 3.4: Pick API with server-side validation

Status: review

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a **participant** (league `ADMIN` or `MEMBER` per Story 2.6 / FR13),

I want my **weekly pick** (`teamId` + **optional anti-jailed bonus** intent) **validated and persisted on the server**,

So that **season-long duplicate picks, jailed-team mistakes, and bogus anti-jailed claims** cannot be bypassed in the client (**FR19**, **FR20**, **FR24**, **FR25**, **FR53**; **FR54** *validation path*; **NFR28**).

## Acceptance Criteria

1. **Given** an authenticated user with a **league membership** in **participant** role (`isLeagueParticipantRole`) for `leagueId`  
   **And** a **current season** row exists for that league’s `nfl_season_year` (see `resolveCurrentSeasonForLeague`)  
   **And** the season is **eligible for competition** (e.g. `preSeasonInitializedAt` set per **FR3** / Story 2.3)  
   **And** the target **`nflWeekNumber`** is a **valid regular-season week** in **league competition** (≥ `firstCompetitionWeek`, ≤ 18 per `isWeekInLeagueCompetition` in `src/lib/nfl/nfl-regular-season.ts`)  
   **And** a persisted **`NflWeekJailedTeam`** row exists for `(season.nflSeasonYear, nflWeekNumber)` (Story 3.3) with `jailedTeamId` **defining the week’s jailed favorite**  
   **When** the client `POST`s a pick with **`teamId`**, **`nflWeekNumber`**, and optional **`antiJailedBonus`** (or equivalent camelCase name, default `false`)  
   **Then** the server **persists** exactly one `Pick` per `(leagueMembershipId, seasonId, nflWeekNumber)` (upsert) and returns **201** on create / **200** on update (choose one policy and document; **idempotent** repeat of same body should succeed).

2. **Jailed / anti-jailed (server mirror of FR24–FR25, FR20)**  
   - **Direct pick of the jailed team** (`teamId === jailedTeamId`) is **always rejected** (400 with stable `error.code`).  
   - **`antiJailedBonus === true`** is **only** valid if `teamId` is the **opponent of `jailedTeamId` in the same `NflGame` that week** (verify via `NflGame` for `nfl_season_year` + `week_number` where `{ home, away }` includes both teams). Reject with 400 if the flag is set but the matchup does not match.  
   - **`antiJailedBonus === false`**: `teamId` may still be the **opponent of the jailed team** (normal 1-point underdog pick); do **not** require the flag for picking the opponent.  
   - **Scoring** (1 vs 2 points) remains **Epic 5**; this story only **stores** the boolean so scoring can trust the claim later (**FR54**).

3. **Duplicate team across the season (FR53)**  
   **When** a pick would reuse a `teamId` that the **same** `leagueMembershipId` + `seasonId` already used in a **different** `nfl_week_number`  
   **Then** the API **rejects** (409 recommended) with a clear code (e.g. `DUPLICATE_TEAM`).

4. **Team / week integrity**  
   - **`teamId`** must appear as **home or away** on some `NflGame` for `season.nflSeasonYear` and `nflWeekNumber`.  
   - Reject unknown team / wrong week with 400.  
   - **Do not** trust client for “current week” only—**always** validate `nflWeekNumber` against the rules above (prevents tampering across weeks).

5. **No early deadline enforcement in this story**  
   - **Deadlines** (FR26–FR27, **NFR24**) are **Story 3.5**. This route **may** call a small placeholder like `assertPickMutationAllowed` that is a **no-op** or only checks feature flags, but **do not** duplicate full deadline logic here—**3.5** will add the real check to this same handler or a shared guard.  
   - Document the handoff in Dev Notes so **3.5** is a small, testable follow-on.

6. **Security & I/O**  
   - **Auth**: session; **401** if no user. **403** if not a league participant (use `isLeagueParticipantRole`, not `role === MEMBER` alone).  
   - **CSRF** (NFR15): follow **`assertCookieSessionMutationOrigin`** the same way as `src/app/api/leagues/[leagueId]/pre-season-init/route.ts` (read body → parse → `assertCookieSessionMutationOrigin` → `auth()` order as established there).  
   - **Rate limiting**: add this **`POST`** path to **`src/proxy.ts`** `shouldRateLimitPost` (or dedicated helper) with **the same** sliding-window family as other league mutators (see `docs/project-context.md` §9).  
   - **Errors** (project context §7): `{ "error": { "code": "SOME_CODE", "message": "…" } }` with 400/401/403/404/409 as appropriate.  
   - **NFR28**: wrap membership resolution + validation + `Pick` **upsert** in **`prisma.$transaction`**.  
   - **JSON** camelCase; DB snake_case with `@map` (existing convention).

7. **Schema**  
   - Add a **non-null boolean** on `Pick` (e.g. `antiJailedBonus` default `false`) with migration. **Do not** infer anti-jailed intent only at scoring time from `teamId`—the product distinguishes **1 vs 2 points** for the *same* opponent pick (**FR20**, **FR54**).  
   - If a better name is chosen, keep it **one place** in Zod + Prisma + API.

8. **Pure / testable rules**  
   - Extract **jailed + duplicate + lineup** checks that do not need the DB into **`src/lib/domain/`** (e.g. `validatePickIntent` or split helpers) with **Vitest** coverage—mirror patterns in `src/lib/domain/jailed.ts` & `jailed.test.ts`.  
   - Route handler stays **orchestration** (load rows, call domain, persist).

9. **Follow-up from 3.3 (deferred-work)**  
   - **`deferred-work.md`**: *picks-lock guard on jailed POST* is **not** fully satisfiable until **deadline + “locked”** semantics exist. After **3.5**, revisit: **POST `/api/admin/nfl/week-jailed`** should refuse recompute (or require `force` + audit) when picks for that week are **locked**—**document** a concrete task in 3.5 or a tiny follow-up so jailed data cannot **silently** change under locked picks. **Do not** block 3.4 on the full jailed recompute lock if deadline types are not merged yet.  
   - (Optional) **Transactional jailed recompute** from 3.3 remains a separate hardening item.

## Tasks / Subtasks

- [x] **Prisma** — add `antiJailedBonus` (or chosen name) to `Pick`; migration; `npm run` migrate in dev.  
- [x] **Domain** — `src/lib/domain/picks.ts` (or similar): pure functions for jailed/opponent/duplicate constraints + tests (`*.test.ts`).  
- [x] **League/season context** — helper(s) to load `Season` + `NflWeekJailedTeam` + games for week; keep NFL data global (same as 3.3), league only scopes **which season / membership**.  
- [x] **Route** — e.g. `POST /api/leagues/[leagueId]/picks` with Zod body (`teamId`, `nflWeekNumber`, `antiJailedBonus` optional), CSRF, auth, participant check, **transactional** upsert, structured errors.  
- [x] **Rate limit** — `src/proxy.ts` matcher for the new path.  
- [x] **Regression** — `npm test` + `npm run lint` (and `build` if schema changed).

### Review Findings

- [x] [Review][Decision] NFR28 compliance: membership lookup outside `prisma.$transaction` — **Decision: B accepted.** Membership check before transaction is an intentional pre-guard pattern (matches `pre-season-init`); TOCTOU window (revoked membership → FK 500 instead of 403) is accepted given low practical risk. Header comment to be corrected (see patch below).
- [x] [Review][Patch] Header comment falsely claims NFR28 compliance — "membership load for writes + pick upsert run in one `prisma.$transaction`" is inaccurate; misleads the Story 3.5 implementer adding deadline logic [src/app/api/leagues/[leagueId]/picks/route.ts:4-6]
- [x] [Review][Patch] No DB unique constraint on `(leagueMembershipId, seasonId, teamId)` — FR53 duplicate-team rule enforced only in application logic; concurrent same-teamId picks in different weeks can both persist unchecked [prisma/schema.prisma + migration]
- [x] [Review][Patch] Empty `games` array not guarded — if game data is not yet ingested for the week but a jailed row exists, every team fails with `TEAM_NOT_IN_WEEK` (misleading; real cause is missing game data) [src/app/api/leagues/[leagueId]/picks/route.ts:192-195]
- [x] [Review][Patch] `request.text()` not wrapped in try/catch in `readJsonObject` — body stream errors throw an unhandled rejection instead of returning `{ ok: false }` [src/app/api/leagues/[leagueId]/picks/route.ts:27]
- [x] [Review][Defer] Concurrent `isCreate` status code race (201 vs 200) [src/app/api/leagues/[leagueId]/picks/route.ts:234-244] — deferred, pre-existing; semantic-only error (pick data is correct); fix requires SERIALIZABLE isolation or upsert side-effect introspection not available in Prisma
- [x] [Review][Defer] No route-layer test for 201/200 and idempotency invariants — spec says "Prisma optional in route tests"; defer to when integration test infrastructure is set up

## Dev Notes

### Epic cross-story context (Epic 3)

- **3.1** — `Team`, `NflGame`, `Pick` shell; **3.2** — odds; **3.3** — `NflWeekJailedTeam` + `computeAndPersistNflWeekJailed` + `GET/POST /api/admin/nfl/week-jailed`. **3.4** **consumes** jailed row for validation.  
- **3.5** — deadline; **3.6** — UI; **3.7** — client validation UX; **4.2** — admin on-behalf **reuses the same rules** (FR31) — design domain API so an admin service can call the same validation with a **different** `leagueMembershipId` later.

### Architecture compliance

- [Source: `_bmad-output/planning-artifacts/architecture.md` — API & communication patterns] REST Route Handlers, Zod, JSON errors, no secrets to client.  
- [Source: `docs/project-context.md`] Single Prisma client; **Stack** for future UI; server-authoritative rules.  
- [Source: `src/lib/league/participant-membership.ts`] **Never** gate picks with `role === MEMBER` alone.

### Technical requirements (concise)

| Area | Direction |
|------|-----------|
| **Jailed source** | `prisma.nflWeekJailedTeam.findUnique({ where: { nflSeasonYear_weekNumber: { ... } } })` — if **missing**, return **400/409** with a code like `JAILED_NOT_COMPUTED` telling ops to run admin jailed job (3.3). |
| **Opponent check** | Query `NflGame` for the week; find the game that contains `jailedTeamId`; the **allowed anti-jailed** `teamId` is the **other** team. |
| **Duplicate** | `findMany` on `Pick` for `{ leagueMembershipId, seasonId, teamId, nflWeekNumber: { not: targetWeek } }` (or equivalent) with limit 1. |
| **First competition week** | `Season.firstCompetitionWeek` + `firstCompetitionWeekLockedAt` — follow existing helpers; **3.4** may set **lock** when “competition has started” per Story 2.7 — if product says **“first pick saved”** locks the week, **set `firstCompetitionWeekLockedAt` in this transaction on first ever pick for the season** (confirm against `isFirstCompetitionWeekEditable` / rules page promises). *If* locking logic is not yet product-specified, **defer** a dedicated task and add a `TODO` with reference to 2.7. |

**Locking `firstCompetitionWeek` (Story 2.7):** `first-competition-week.ts` says lock is set in Epic 3. Prefer **one clear rule** in this story: e.g. set `firstCompetitionWeekLockedAt` on **first successful pick** for that `seasonId` (if null). Co-locate the helper in `lib/league/` and test.

### Library & framework

- **Zod** — request body; reuse `nflRegularSeasonWeekSchema` from `nfl-regular-season.ts` if applicable.  
- **Vitest** — domain tests required.  
- **Prisma** — transactions.

### File structure (expected touchpoints)

```
src/lib/domain/picks.ts
src/lib/domain/picks.test.ts
src/lib/league/resolve-current-season.ts          # already exists
src/lib/nfl/nfl-regular-season.ts                 # isWeekInLeagueCompetition, week schema
src/lib/league/first-competition-week.ts
src/lib/league/participant-membership.ts
src/app/api/leagues/[leagueId]/picks/route.ts     # new
prisma/schema.prisma
prisma/migrations/...
src/proxy.ts
```

### Testing requirements

- **Unit**: jailed direct pick rejected; anti-jailed success/fail; duplicate team; team not playing week.  
- **No** live network in `npm test`.  
- Prisma **optional** in route tests; prefer **domain-first** coverage.

### Previous story intelligence (3.3)

- **Artifact:** `_bmad-output/implementation-artifacts/3-3-jailed-team-identification-and-tie-breakers.md`.  
- Reuse **persisted** `NflWeekJailedTeam` — **not** re-running `resolveJailedTeam` on every pick (avoids drift vs 3.2 snapshot).  
- **Deferred items** in `_bmad-output/implementation-artifacts/deferred-work.md` — jailed recompute lock ties to this story + **3.5**.  
- 3.3 **review** already fixed `localeCompare` / signed spread / audit—no change needed for 3.4 except **consuming** `jailedTeamId`.  
- Admin odds routes use **`readJsonObject`**, `authorize-odds-admin` — **not** the pattern for **participant** pick route (session + CSRF only).

### Git intelligence (recent work)

- Latest epic 3 work: jailed **domain** + `NflWeekJailedTeam` + `GET/POST` `/api/admin/nfl/week-jailed` — follow **error JSON** and **Prisma** patterns from those files.

### Latest tech notes

- **Next.js Route Handlers** (App Router): `params` is `Promise` — `await context.params` (see existing routes).  
- **Auth.js** `auth()` from `@/lib/auth` — same as other league routes.

### Project context reference

- [Source: `docs/project-context.md`] — non-negotiables §1–8; add rate limit in **§9** for new POST.  
- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 3.4] BDD: duplicate, jailed, anti-jailed, transactional errors.

### Open questions (saved for product if implementation hits ambiguity)

- **Exact** HTTP code for “duplicate team” (409 vs 400) — pick one and use consistently.  
- Whether **`PUT /api/.../picks/{week}`** is preferable to `POST` body with `nflWeekNumber` — either is fine if documented.

## Dev Agent Record

### Agent Model Used

Cursor agent (Claude) — bmad-dev-story workflow

### Debug Log References

— 

### Implementation Plan (concise)

- **HTTP policy:** `POST` returns **201** when the pick row is created (first save for that membership + season + week) and **200** when an existing week row is updated; repeating the same body is idempotent.  
- **Transaction:** `prisma.$transaction` runs season + jailed + games + pick count + duplicate check + `pick.upsert` + optional `firstCompetitionWeekLockedAt` in one flow (**NFR28**).  
- **3.5 handoff:** `assertPickMutationAllowed` in `src/lib/picks/assert-pick-mutation-allowed.ts` is a no-op; deadline enforcement is Story 3.5. `deferred-work.md` updated with a 3.5 follow-up to wire this and the jailed recompute lock.

### Completion Notes List

- `Pick.antiJailedBonus` (DB `anti_jailed_bonus`, default false) with migration `20260425210000_pick_anti_jailed_bonus`.  
- Domain: `src/lib/domain/picks.ts` + `picks.test.ts` (jailed, anti-jail, duplicate, week lineup).  
- `POST /api/leagues/[leagueId]/picks`: Zod + CSRF + session + `isLeagueParticipantRole` + jailed row + `NflGame` list + upsert; errors `{ error: { code, message } }`.  
- First competition week lock: on first `Pick` for the season, set `firstCompetitionWeekLockedAt` if still editable (`isFirstPickForSeason` in `first-competition-week.ts`).  
- Rate limit: `LEAGUE_PICKS_POST` in `src/proxy.ts`.  
- `docs/project-context.md` §9 mentions picks `POST`.  
- `npm test`, `npm run lint`, `npm run build` passed.

### File List

- `prisma/schema.prisma`
- `prisma/migrations/20260425210000_pick_anti_jailed_bonus/migration.sql`
- `src/lib/domain/picks.ts`
- `src/lib/domain/picks.test.ts`
- `src/lib/league/first-competition-week.ts`
- `src/lib/league/first-competition-week.test.ts`
- `src/lib/picks/assert-pick-mutation-allowed.ts`
- `src/lib/picks/post-pick-body.ts`
- `src/app/api/leagues/[leagueId]/picks/route.ts`
- `src/proxy.ts`
- `docs/project-context.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`

## Change Log

- **2026-04-25** — Story created from `epics.md` Story 3.4, `sprint-status.yaml`, `project-context.md`, `prd.md` (FR scope), `architecture.md` (API/CSRF/transaction), codebase (`schema.prisma` `Pick`, 3.3 artifact, `participant-membership`, `pre-season-init` route pattern, `deferred-work.md`). Status **ready-for-dev**.
- **2026-04-25** — Implemented pick API, domain validation, `antiJailedBonus`, rate limit, first-week lock on first season pick, tests, lint, build. Status **review**.

## Story completion status

**done** — Code review complete; all patches applied.
