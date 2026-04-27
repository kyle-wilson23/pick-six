# Story 3.5: Deadline enforcement (server authority)

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As the **system**,

I want **pick deadlines computed from real schedule data and compared in UTC using Eastern business rules**,

So that **participants cannot submit or change picks after the lock (FR27)** with **no early lockouts and no late accepts (NFR24)**, and **FR26** is satisfied: **5 minutes before the first game of the week** or the **Thursday 8:10 PM `America/New_York`** default—**whichever instant is earlier** (stricter).

## Acceptance Criteria

1. **Server authority**  
   **Given** an authenticated **participant** `POST` to `POST /api/leagues/[leagueId]/picks` (Story 3.4) for a `nflWeekNumber` in league competition with valid body  
   **When** the server’s **current instant** ( evaluated once per request—see Dev Notes) is **strictly after** the computed **pick deadline** for that `(nfl_season_year, nfl_week_number)`  
   **Then** the server **rejects** the mutation with **`403`** and JSON `{ "error": { "code": "PICK_DEADLINE_PASSED", "message": "…" } }` (**project-context §7**; architecture example’s `PICK_DEADLINE_PASSED` is informational—use **403** for *not allowed* after week lock).  
   **And** the same check runs for **update** and **create** (changing a pick after the deadline is blocked).

2. **Deadline definition (PRD FR26, aligned with `epics.md` Story 3.5)**  
   - Let **`firstKickoff`** = **minimum** `NflGame.kickoffAt` for all games in `(nflSeasonYear, weekNumber == nflWeekNumber)`.  
   - **`lockByFirstGame`** = `firstKickoff` **minus 5 minutes** (store/compare as **UTC** `Date` / `timestamptz` semantics).  
   - **`lockByThursdayDefault`** = **8:10 PM** (`20:10`) in **`LEAGUE_BUSINESS_TIMEZONE`** (`America/New_York` per `src/lib/league/league-rules.ts`) on the **Thursday** that is the **inclusive “on or before”** the **Eastern calendar date** of `firstKickoff` (walk backward from that local date to the Thursday, same NFL week as typical TNF/Sunday slates; see Dev Notes for the exact construction).  
   - **`pickDeadline`** = **min**(`lockByFirstGame`, `lockByThursdayDefault`) in absolute **UTC** time.  
   **When** any game row is **missing** `kickoffAt` (should not happen) or there are **no** games, reuse existing **`GAMES_NOT_LOADED` / validation** from the picks route; deadline logic must not return a **wrong** lock time.

3. **No client timezone**  
   The server **never** uses the browser’s time zone for enforcement; it uses **UTC** instants and **Eastern** only where the product rule says “Thursday 8:10 PM” (**docs/project-context.md** #3, **architecture.md** “Dates and times” + anti-pattern “local machine timezone”).

4. **Wire-in point**  
   Replace the no-op **`assertPickMutationAllowed`** in `src/lib/picks/assert-pick-mutation-allowed.ts` with real logic, **or** restructure to a `checkPickDeadline(...)` that returns a result—**but** the picks route must call it **after** `NflGame` rows are available and **include `kickoffAt`** in the query used for the week (current route selects only `home`/`away`; **extend the select**). The check must be **invoked from the same `runPickMutation` / transaction path** used today (so behavior matches “atomic” user expectation).  
   If `assertPickMutationAllowed` stays `void` and `throws`, map to the JSON error in the route; if it returns `RouteErr`, thread through like other validations.

5. **NFR24**  
   - **No false positives:** if `now < pickDeadline`, the pick path **must not** block solely due to the deadline check.  
   - **No false negatives:** if `now > pickDeadline`, the pick path **must** block.  
   Use monotonic instants; document **one** `const now = new Date()` at the start of the handler or transaction (pick one) and use it consistently for the deadline check and any “locked” helper.

6. **Pure + tested domain**  
   - Extract **deadline math** (given `firstKickoff: Date` and the Thursday rule) into **`src/lib/domain/`** (e.g. `pick-deadline.ts`) with **Vitest** table tests: **TNF at 8:20 PM Eastern**, **Sunday-first** week, **first kickoff** already **before** the Thursday 8:10 default (edge case: Thursday lock should still win if earlier).  
   - **No live network** in `npm test`.

7. **Deferred: admin jailed + “locked” week (`deferred-work.md`)**  
   - Introduce a **reusable** predicate used by the pick guard, e.g. `isNflWeekPickWindowClosed({ nflSeasonYear, weekNumber, at: Date, games }): boolean` or `getNflWeekPickDeadlineUtc(...)`.  
   - **Update** `POST /api/admin/nfl/week-jailed` (Story 3.3) to **refuse recompute** (or require `force` + **audit**—minimal path: `409` with a clear `error.code` when the week is **closed**) so **jailed** cannot **silently change** after **deadline**. This closes the “picks lock guard on jailed POST” item in **`_bmad-output/implementation-artifacts/deferred-work.md`**; if scoping is tight, do the **refuse recompute** in **3.5** and leave **`force` + audit** to Epic 4 / a one-line follow-up in `deferred-work.md`.

8. **Docs**  
   - Add a line to **`league-rules.ts`** (or a sibling comment) with the **exact** FR26 paraphrase and pointer to the domain module.  
   - Optionally add **`docs/project-context.md` §3 or §9** a phrase that `POST` picks is deadline-enforced when this story ships (keep **short**).

## Tasks / Subtasks

- [x] **Domain** — `computePickDeadlineUtc` / helpers in `src/lib/domain/pick-deadline.ts` (name as you like) + `pick-deadline.test.ts` (Eastern **Thursday 8:10** + `firstKickoff - 5m`, `min` logic).  
- [x] **Guard** — implement `assertPickMutationAllowed` (or `check...`) with inputs that include **games + now + season year + week**; return typed error for route mapping.  
- [x] **Route** — `picks/route.ts`: extend `NflGame` query to **`kickoffAt`**, run deadline check in **`runPickMutation`** at the right order (after games loaded, with other validation).  
- [x] **Admin** — `week-jailed` POST: if week **locked**, return **4xx** with stable code.  
- [x] **Tests** — `npm test`; fix any lints in touched files.  
- [x] **Deferred doc** — trim/update **`deferred-work.md`** for items moved to done or still open.

### Review Findings

- [x] [Review][Patch] Jailed deadline guard silently passes when any game has null `kickoffAt` — condition `gamesForDeadline.length === games.length` falls through, allowing recompute past the deadline on partially-ingested schedules [`src/lib/nfl/jailed-computation.ts`]
- [x] [Review][Patch] `now` captured before `findMany` in `computeAndPersistNflWeekJailed` — stale timestamp at the moment the deadline check runs; move to immediately before `isNflWeekPickWindowClosedByDeadline` call [`src/lib/nfl/jailed-computation.ts`]
- [x] [Review][Patch] `WEEK_PICK_WINDOW_CLOSED` added to pure domain `JailedErrorCode` in `jailed.ts` — this code is never returned by `resolveJailedTeam`; define it as a local/infrastructure type in `jailed-computation.ts` instead [`src/lib/domain/jailed.ts`]
- [x] [Review][Patch] Missing AC6 test vector: `firstKickoff` before Thursday 8:10 PM Eastern — the `Math.min` branch that returns `lockByFirstGameUtc` is untested; the third spec-required case (first-game lock wins) is absent [`src/lib/domain/pick-deadline.test.ts`]
- [x] [Review][Patch] No unit test for `checkPickMutationDeadline` wrapper — 403/`PICK_DEADLINE_PASSED` mapping and function contract are untested [`src/lib/picks/assert-pick-mutation-allowed.ts`]
- [x] [Review][Defer] `GAMES_NOT_LOADED` message misleading for null-`kickoffAt` case — schedule was ingested but kickoffs are incomplete; message says "not available" which implies no ingestion [`src/app/api/leagues/[leagueId]/picks/route.ts`] — deferred
- [x] [Review][Defer] `checkPickMutationDeadline` returns null for empty games — latent bypass footgun if a future caller omits the route-level guard; documented precondition only [`src/lib/picks/assert-pick-mutation-allowed.ts`] — deferred
- [x] [Review][Defer] `now` not injectable in `computeAndPersistNflWeekJailed` — wall-clock dependency limits unit testability of the deadline enforcement path [`src/lib/nfl/jailed-computation.ts`] — deferred
- [x] [Review][Defer] Thursday 8:10 PM cutoff is a magic literal — not a named constant; scattered across tests and production with no single authoritative source [`src/lib/domain/pick-deadline.ts`] — deferred
- [x] [Review][Defer] `gamesWithKickoff` manually reconstructed rather than type-narrowed — verbose parallel allocation, sheds future Prisma fields [`src/app/api/leagues/[leagueId]/picks/route.ts`] — deferred

## Dev Notes

### Epic cross-story context (Epic 3)

- **3.4** — pick API, `assertPickMutationAllowed` placeholder, transactional upsert, first-competition-week lock. **3.5** adds **time** policy only; **do not** weaken duplicate/jailed validation.  
- **3.6 / 3.7** will surface deadline to UI (countdown, copy)—this story is **server truth**; consider exporting **ISO deadline** in a **later** `GET` if needed, **out of scope** unless trivial.

### PRD / FR touchpoints

- **FR26** — “Thursday ~8:10 PM EST **or** 5 minutes before first game, **whichever earlier**.”  
- **FR27** — no post-deadline submit/change.  
- **NFR24** — zero false **positive/negative** deadline outcomes.

### Architecture compliance

- [Source: `_bmad-output/planning-artifacts/architecture.md` — Dates and times, API errors] `PICK_DEADLINE_PASSED` example, UTC storage, `America/New_York` for league-facing rules, **no** client TZ on server.  
- [Source: `docs/project-context.md`] same-origin / CSRF unchanged; **one** Prisma client; errors JSON shape.

### Technical requirements (concise)

| Area | Direction |
|------|-----------|
| **Time zone** | `LEAGUE_BUSINESS_TIMEZONE` from `src/lib/league/league-rules.ts` — **do not** hardcode a second string. |
| **Date libs** | Prefer **existing** `package.json` deps; if you need a small TZ helper and nothing exists, add **one** well-maintained option (e.g. `date-fns-tz` / `@date-fns/tz` pattern) and **pin** in `package.json` — **no invented versions** in the story. |
| **“Thursday”** | Implement **deterministically**: document in code **one** rule (Eastern local calendar for `firstKickoff` → go to **on-or-before Thursday** for that “week’s” start-of-week interpretation used in your tests). Favor **clarity and tests** over implicit locale behavior. |
| **Comparison** | `Date.getTime()` / numeric compare on UTC instants. |

### Library & framework

- **Next.js** Route Handler unchanged except body/games/deadline.  
- **Vitest** for domain.  
- **Prisma** — read `kickoffAt` on `NflGame` (`schema` already has `kickoffAt` `timestamptz`).

### File structure (expected touchpoints)

```
src/lib/domain/pick-deadline.ts
src/lib/domain/pick-deadline.test.ts
src/lib/picks/assert-pick-mutation-allowed.ts
src/lib/league/league-rules.ts
src/app/api/leagues/[leagueId]/picks/route.ts
src/app/api/admin/nfl/week-jailed/route.ts
_bmad-output/implementation-artifacts/deferred-work.md
```


### Testing requirements

- **Unit** — pure functions: `pickDeadline` for a matrix of `firstKickoff` instants (use **fixed** ISO strings in tests).  
- **Integration** — optional; not required for MVP if domain coverage is strong.  
- **Run** `npm test` after changes (workspace rule).

### Previous story intelligence (3.4)

- [Source: `_bmad-output/implementation-artifacts/3-4-pick-api-with-server-side-validation.md`] `assertPickMutationAllowed` is intentionally empty; `runPickMutation` calls it **with** `seasonId`, `leagueId`, `nflWeekNumber` only — you likely need to **add parameters** (e.g. `games: { kickoffAt: Date }[]`, `at: Date`).  
- **Transaction** comment in route: membership **outside** tx; deadline check should be **inside** with games loaded — **align** the review note that NFR28 scope is *pick data*; deadline check is still part of the same `runPickMutation` design.  
- **Review** items (201/200 race, route tests) are **deferred**; do not block 3.5 on them.  
- **Empty `games`**: already `GAMES_NOT_LOADED` — keep ordering so deadline is not computed on empty set.

### Git intelligence (recent work)

- **3.4** added `POST` picks, domain `picks.ts`, `proxy` rate limit `LEAGUE_PICKS_POST` — follow the same **error shape** and **logging** style.  
- **3.3** jailed: use same **admin auth** + JSON patterns when touching **week-jailed** route.

### Latest tech notes

- Use **`Temporal`** only if already in the project; avoid heavy new time APIs unless justified. Plain `Date` + explicit TZ library is often enough.  
- **Vercel** server default is UTC; still **no** `Date` in local **server** TZ for rules—always explicit Eastern for the Thursday 8:10 rule.

### Project context reference

- [Source: `docs/project-context.md` — #3, #7, #9] Server-authoritative deadlines; error JSON; rate limit on picks `POST` already listed.

### Open questions (resolve in implementation, document choice)

- If product later prefers **409** for “resource in closed week,” keep **`PICK_DEADLINE_PASSED`** stable and document the status change; **3.5** standardizes on **403** above.

## Dev Agent Record

### Agent Model Used

Composer (Cursor) — dev-story 2026-04-26

### Debug Log References

— 

### Completion Notes List

- Implemented FR26 in `src/lib/domain/pick-deadline.ts` with `date-fns` + `date-fns-tz`, `LEAGUE_BUSINESS_TIMEZONE` for Thursday 8:10 and min(firstKickoff−5m, that Thursday) in UTC.
- `checkPickMutationDeadline` in `assert-pick-mutation-allowed.ts` returns 403 `PICK_DEADLINE_PASSED` when `isNflWeekPickWindowClosedByDeadline` (strict `at > deadline`).
- Picks `POST` uses one `const now` at the start of `runPickMutation`, loads `kickoffAt`, rejects null kickoffs with `GAMES_NOT_LOADED`, then deadline check; upsert path unchanged.
- Jailed recompute: `computeAndPersistNflWeekJailed` returns 409 `WEEK_PICK_WINDOW_CLOSED` (typed `JailedErrorCode`) when the pick window is closed; `deferred-work.md` and `league-rules` / `project-context` updated.
- `npm test`, `npm run build`, ESLint on touched files: green.

### File List

- `package.json` — `date-fns`, `date-fns-tz`
- `package-lock.json`
- `src/lib/domain/pick-deadline.ts` (new)
- `src/lib/domain/pick-deadline.test.ts` (new)
- `src/lib/domain/jailed.ts` — `WEEK_PICK_WINDOW_CLOSED` in `JailedErrorCode`
- `src/lib/picks/assert-pick-mutation-allowed.ts`
- `src/lib/nfl/jailed-computation.ts`
- `src/app/api/leagues/[leagueId]/picks/route.ts`
- `src/lib/league/league-rules.ts`
- `docs/project-context.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/3-5-deadline-enforcement-server-authority.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- **2026-04-26** — Story created (BMAD `create-story`): `epics.md` Story 3.5, `sprint-status.yaml`, `project-context.md`, `prd.md` FR26–27 / NFR24, `architecture.md` time rules, `3-4` story artifact, `deferred-work.md`, codebase (`assert-pick-mutation-allowed`, `picks/route.ts`, `NflGame.kickoffAt`, `league-rules.ts`). Status **ready-for-dev**.
- **2026-04-26** — Implemented: domain deadline, pick guard + route, jailed 409 when window closed, docs/deferred-work; `date-fns` + `date-fns-tz`. Status **review** (sprint: **review**).

## Story completion status

**done** — Code review complete; all patches applied and tests passing.
