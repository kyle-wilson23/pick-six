# Story 3.3: Jailed team identification and tie-breakers

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the system,
I want to **compute the jailed team** for an NFL week from the **week’s effective odds** using **PRD-ordered** tie-breaks (**moneyline → spread → seeded random**),
so that **automation, validation, and admin verification** are **correct and auditable** (**FR50–FR52**, **NFR23**) and all consumers read a **single persisted result** per **`(nflSeasonYear, weekNumber)`** (not recomputed ad hoc with risk of drift).

## Acceptance Criteria

1. **Given** **`NflGame`** rows for a week and **effective** odds from **`getEffectiveOddsLinesForWeek`** (Story **3.2**; **partial** weeks may omit some games)  
   **When** **jailed resolution** runs for **`nflSeasonYear` + `weekNumber`**  
   **Then** the **jailed** franchise is the **biggest favorite** by **American moneyline** among **favorites** in games that have **complete** home/away ML (see **Dev Notes → Algorithm**), then **FR51** spread tie-break, then **FR52** **seeded** random with **seed persisted** for audit. If **no** game yields a **valid** favorite line, resolution **fails** with a **logged**, **actionable** error (**NFR45**).

2. **Given** at least one **valid** favorite line exists for the week  
   **When** the **primary** (moneyline) step finds **one** clear winner  
   **Then** **`resolvedBy`** (or equivalent metadata) records **`MONEYLINE`** and **no** random seed is required.

3. **Given** **two or more** teams **tied** on the **primary** moneyline comparison  
   **When** the **spread** tie-break runs  
   **Then** the team with the **largest** absolute **in-game point spread in the favorite’s favor** wins; **`resolvedBy`** = **`SPREAD`**.

4. **Given** teams **still** tied after spread  
   **When** the **final** tie-break runs  
   **Then** one team is chosen **at random** using a **deterministic** process from a **stored** `randomSeed` (e.g. `crypto.randomBytes` → hex, or documented alternative) and **`resolvedBy`** = **`RANDOM`**, and **FR52** / **`docs/project-context.md`** (audit) are satisfied for **jailed** randomness.

5. **Given** a completed computation  
   **When** a **client** (admin, future **pick** API, or **3.6** UI) needs the jailed team for that week  
   **Then** the app serves **the persisted** result (and sufficient **audit** fields for **Story 4.4** jailed **verification** view — at minimum **odds and spread** values used, **tie level**, **seed** if random, **timestamps**).

6. **Given** the **league** rules text on **`/leagues/[leagueId]/rules`** (and any similar copy)  
   **When** this story is complete  
   **Then** user-facing **tie-break order** **matches the PRD** (**moneyline** → **spread** → **seeded random**). *(Today’s **Tie-breakers** section states **spread first**; **update** to align with **FR50–FR52**.)*

7. **Given** `Season.firstCompetitionWeek` (Story **2.7**)  
   **When** a league is **not** in competition for a calendar NFL week  
   **Then** **global** jailed resolution for that **`(nflSeasonYear, weekNumber)`** may still be computed (same NFL data for all leagues); **league gating** of **picks** remains **3.4+**. Do **not** conflate “league active week” with “whether jailed row exists in DB.”

8. **Pure / testable core**  
   **Given** a **static** set of per-game team ids + ML + spread  
   **When** unit tests run  
   **Then** all tie paths and edge cases (see **Testing**) are covered **without** Prisma in **`src/lib/domain/jailed.ts`** (or equivalent), per **`epics.md`**.

## Tasks / Subtasks

- [x] **Domain — `lib/domain/jailed.ts`** (AC1,3,4,8)  
  - [x] Input type: per-game home/away team ids, `homeMoneylineAmerican`, `awayMoneylineAmerican`, `homeSpreadPoints` (from **`EffectiveOddsLineRow`** + **`NflGame`**).  
  - [x] Output: `jailedTeamId`, `resolvedBy: 'MONEYLINE' | 'SPREAD' | 'RANDOM'`, `randomSeed?`, and an **audit** struct (candidates, compared values) for **4.4**.  
  - [x] **Vitest** for: single favorite; two-way ML tie + spread break; two-way full tie + random (mock seed); missing/null ML handling.

- [x] **Persistence** (AC1,5)  
  - [x] Add a **global** week row (e.g. `NflWeekJailedTeam` or name aligned with schema conventions) with **`@@unique([nflSeasonYear, weekNumber])`**, `jailedTeamId`, `resolvedBy`, `randomSeed?`, `auditJson` or normalized columns, `computedAt`, optional `nflGameOddsLineSourceNote`.  
  - [x] Migration with **`@map` snake_case**; FK to **`Team`**.

- [x] **Orchestration** (AC1,5)  
  - [x] Service: load **`NflGame`** for week + **effective odds** map → call domain function → **upsert** result.  
  - [x] **Idempotent** re-run: same inputs → same result; if odds **change** after first compute (late manual patch), either **recompute** on demand or **block** recompute (choose one behavior, document — prefer **admin-triggered recompute** with explicit log).

- [x] **API** (AC5)  
  - [x] Expose at least: **admin** (or system) **POST** to compute + **GET** to read jailed + audit for `(nflSeasonYear, weekNumber)` — follow **`authorize-odds-admin`** or **league admin** session patterns from **3.2**; **no** new “super admin” role.  
  - [x] JSON errors **`{ error: { code, message } }`**.

- [x] **Copy fix** (AC6)  
  - [x] Update **`src/app/(app)/leagues/[leagueId]/rules/page.tsx`** (and any duplicate rules strings) for correct tie-break order.

- [x] **Regression** — `npm test`, `npm run lint`, `npm run build`, migrate.

### Review Findings

_From code review (2026-04-25). 0 decisions needed, 12 patches, 3 deferred, 6 dismissed as noise. **All 12 patches applied 2026-04-25** — `npm test` 110/110 ✓, `npm run lint` ✓, `npm run build` ✓._

- [x] [Review][Patch] Spread magnitude must be **signed relative to the chosen favorite**, not `Math.abs(homeSpreadPoints)` — when ML and spread disagree on the favorite the SPREAD tie-break ranks the wrong game and `audit.candidates[].spreadMagnitudeInFavoriteFavor` is misleading [`src/lib/domain/jailed.ts:80`] → field renamed to `spreadInFavoriteFavor` (signed); covered by new test `uses signed spread magnitude so SPREAD tie-break demotes ML/spread disagreement`
- [x] [Review][Patch] Filter out games with **no real favorite** (both moneylines ≥ 0) before adding to candidates — Algorithm step 3 explicitly says "Do not compare underdog moneylines to favorites" and `rules/page.tsx` copy promises "biggest favorite … among favorites" [`src/lib/domain/jailed.ts:70-87`] → guard added; covered by new tests `excludes games with no real favorite …` and `returns NO_COMPLETE_MONEYLINES when every game has only positive moneylines`
- [x] [Review][Patch] Extend `JailedCandidateAudit` with `homeTeamId`, `awayTeamId`, `homeMoneylineAmerican`, `awayMoneylineAmerican`, and signed `homeSpreadPoints` per AC5 / Story 4.4 ("at minimum odds and spread values used") — currently the underdog ML and the raw home spread are not persisted, so a verifier can't reproduce the favorite-side determination from the row alone [`src/lib/domain/jailed.ts:18-24`, `src/lib/nfl/jailed-computation.ts:87-93`] → audit shape extended; covered by new test `persists the full per-game odds in audit candidates …`
- [x] [Review][Patch] Replace `localeCompare` in the random tie-break with a byte-wise comparator (`a < b ? -1 : a > b ? 1 : 0`) — `localeCompare` results depend on the host's ICU build/locale, undermining FR52 reproducibility [`src/lib/domain/jailed.ts:138-140`]
- [x] [Review][Patch] Use `console.warn` (not `console.error`) for 4xx-class jailed errors (`NO_GAMES_FOR_WEEK`, `NO_COMPLETE_MONEYLINES`); keep `console.error` only for `JAILED_RESOLUTION_INCONSISTENT` (5xx) — current behavior pollutes alerting [`src/lib/nfl/jailed-computation.ts:74`]
- [x] [Review][Patch] Add actor + action context to the NFR45 error log (e.g. `actorUserId`, `action: "compute_jailed"`, `via: "admin-session" | "automation"`) — NFR45 requires "timestamp, user, action attempted" [`src/lib/nfl/jailed-computation.ts:74`, `src/app/api/admin/nfl/week-jailed/route.ts` POST] → added `JailedComputeActor` parameter; route plumbs `{ via: "admin", userId } | { via: "automation" }`
- [x] [Review][Patch] Add an explicit log line on **recompute** (when the upsert hits an existing row) so the spec's "admin-triggered recompute with explicit log" obligation is met — today only failures are logged [`src/lib/nfl/jailed-computation.ts:95`] → `console.info("[jailed] recompute", …)` with previous + new jailed team / resolvedBy / computedAt
- [x] [Review][Patch] Add a DB `CHECK` constraint on `nfl_week_jailed_teams` enforcing `(resolved_by = 'RANDOM') = (random_seed IS NOT NULL)` — the model comment promises this but the schema does not enforce it; migration is not yet deployed so the file can be edited in place [`prisma/migrations/20260425200000_nfl_week_jailed_team/migration.sql`]
- [x] [Review][Patch] Consolidate `weekParamsSchema` and `postBodySchema` into a single Zod schema (they are byte-identical) [`src/app/api/admin/nfl/week-jailed/route.ts:18-26`] → unified to `weekIdentifierSchema`
- [x] [Review][Patch] Have `readJsonObject` `console.warn` the parse error before returning `{ ok: false }` so malformed automation payloads leave a debuggable breadcrumb [`src/app/api/admin/nfl/week-jailed/route.ts:28-35`]
- [x] [Review][Patch] Extract the duplicated `oddsLineSourceNote` literal into a module-level constant used in both `create` and `update` of the upsert [`src/lib/nfl/jailed-computation.ts:106,113`] → `ODDS_LINE_SOURCE_NOTE` const
- [x] [Review][Patch] Add domain tests for the now-fixed paths: empty/missing seed → `JAILED_RESOLUTION_INCONSISTENT`; both-positive ML game excluded from candidates; ML-tie + spreads pointing opposite directions; `homeSpreadPoints === 0` pick'em [`src/lib/domain/jailed.test.ts`] → six new tests added (jailed.test.ts now 13 tests, all passing)
- [x] [Review][Defer] Add a **picks-lock guard** (or explicit `force=true` flag) on POST so jailed cannot be silently rewritten after picks lock for the week — deferred to Story 3.4/3.5 once the picks-lock model exists; current "admin recompute by design" is per spec but becomes unsafe once 3.4 lands [`src/app/api/admin/nfl/week-jailed/route.ts` POST, `src/lib/nfl/jailed-computation.ts` upsert]
- [x] [Review][Defer] Wrap `getEffectiveOddsLinesForWeek` + `nflGame.findMany` + `randomBytes` + `upsert` in a `prisma.$transaction` with row-level lock so concurrent admin POSTs cannot race on the random tie-break — low practical risk for an admin-only endpoint, but worth a follow-up; needs a refactor of `getEffectiveOddsLinesForWeek` to accept a transaction client [`src/lib/nfl/jailed-computation.ts`]
- [x] [Review][Defer] Record per-stage survivors (`afterMoneyline`, `afterSpread`) in `audit` so verifiers don't have to re-run the algorithm to see which candidates reached SPREAD/RANDOM — full candidate set + algorithm is reproducible today, so this is an audit-clarity nice-to-have [`src/lib/domain/jailed.ts:166-190`]

**Dismissed (logged for completeness, no action):**

- Pick'em ML defaulting to home — Algorithm step 2 explicitly permits "home breaks tie" as the documented deterministic rule (the downstream mis-attribution is the separate signed-magnitude patch above).
- Authorization inconsistency for automation — verified false positive: `assertAuthorizedForNflOddsOps` returns `null` (allowed) early on bearer-secret match, so the subsequent `userId === undefined` path is never reached for automation.
- Duplicate persistence of `randomSeed` / `resolvedBy` in dedicated columns and inside `auditJson` — defensible: columns for indexed query, JSON as a self-contained audit snapshot.
- `deterministicIndexFromSeed` 32-bit + modulo bias — at n ≤ ~16 (NFL games per week) the bias is on the order of `16 / 2^32`, i.e. effectively zero; not worth complicating.
- `gamesWithCompleteLines` redundant with `candidates.length` — keeps useful semantic divergence once the "real favorite" filter (#4 above) lands; consumers may also rely on it.
- GET `404` message suggesting "Run POST to compute it." — admin-gated route; low-impact UX coupling.

## Dev Notes

### Epic context

- **3.1** — schedule + **teams**; **3.2** — **effective** odds; **3.3** — **jailed** from those odds.  
- **3.4+** will enforce **jailed** on **picks**; this story must **not** block on **3.4** for **core** jailed **math** + **persistence**.  
- **4.4** (admin jailed **verification** UI) will **consume** saved **audit** fields; include enough data in this story’s payload.

### Algorithm (normative for implementation)

1. **Scope:** all **`NflGame`** rows for **`(nflSeasonYear, weekNumber)`** with **non-null** moneylines for **both** sides **after** **effective** odds resolution. Games missing lines **do not** contribute a candidate (if **no** valid favorites exist → **error**; log per **NFR45**).  
2. **Favorite per game:** **American** odds: the side with the **smaller** numeric value (e.g. −250 vs +200) is the **favorite**; if **equal** rare edge case, document deterministic rule (e.g. home breaks tie).  
3. **Primary (FR50):** Among **favorites** only, the **jailed** candidate set minimizes **American moneyline** (most **negative** = biggest favorite). **Do not** compare underdog moneylines to favorites.  
4. **Tie (FR51):** If multiple teams share the same **worst** (most negative) ML, take **largest** **|spread|** in **that favorite’s** favor, derived from **`homeSpreadPoints`**: if **home** is favorite, use **|homeSpreadPoints|**; if **away** is favorite, same magnitude from away perspective (see **3.2** field comment: home-centric decimal).  
5. **Tie (FR52):** If still tied, draw **using** a **new** `randomSeed` (persist), then **pick** from sorted `teamId`s (document stable ordering, e.g. **lexicographic** cuid) so the outcome is **reproducible** given the seed.  
6. **Week-level semantics:** Jailed is **NFL-week global**, not **league**-specific — same **snapshot** for every league (matches **3.2** global odds).  

### Technical requirements

| Area | Requirement |
|------|-------------|
| **Secrets** | No new public env for jailed; randomness is server-side. |
| **DB** | **camelCase** Prisma, **snake_case** SQL; one Prisma client | **`src/lib/db.ts`**. |
| **Domain** | **Pure** `lib/domain/*` for **math**; Route Handlers / services do **I/O** [`docs/project-context.md`]. |
| **JSON errors** | **`{ error: { code, message } }`** for API failures. |
| **Audit** | Jailed **random** tie-in matches **admin overrides** spirit: **tamper-evident** trail via stored **seed** + candidate list [**project-context** #5, **NFR14**]. |

### Architecture compliance

- **architecture.md** — **`src/lib/domain/jailed.ts`**, jailed in **Jailed & rules (FR50–FR54)**; keep **Route Handlers** thin.  
- **Prisma `Week` snapshot** language in architecture: implement as **dedicated** global week table keyed by **NFL** season + week, not **`Season.id`**.

### Library & framework requirements

| Package | Notes |
|---------|--------|
| **Vitest** | **Required** for **domain**; fixtures as plain objects, no network. |
| **Zod** | Optional for validating persisted audit JSON / API if exposed. |
| **Prisma** | Migration for new model + relation to `Team`. |

### File structure (guidance)

```
src/lib/domain/jailed.ts
src/lib/domain/jailed.test.ts
src/lib/nfl/jailed-computation.ts   # optional: Prisma + getEffectiveOddsLinesForWeek orchestration
src/app/api/admin/nfl/...          # optional paths: compute-jailed, week-jailed — align with 3.2 admin nfl routes
prisma/schema.prisma
prisma/migrations/...
src/app/(app)/leagues/[leagueId]/rules/page.tsx
```

### Testing requirements

- **Unit:** all **`resolvedBy`** branches; edge cases: **all** games missing odds → error; one game; **TNF/SNF** not special — all games in `NflGame` for week.  
- **No live network** in default **`npm test`**.  
- If orchestration has non-trivial **DB** selection, one **integration**-style test optional; prefer **unit** + **manual** admin API check.

### Previous story intelligence (3.2)

**Artifact:** `_bmad-output/implementation-artifacts/3-2-odds-fetch-tuesday-snapshot-and-week-long-consistency.md`.

- Use **`getEffectiveOddsLinesForWeek`** in **`src/lib/nfl/effective-odds.ts`** — this is the **only** read path for **stable** lines (partial snapshot + per-game **PATCH**).  
- **Moneyline** fields: `homeMoneylineAmerican`, `awayMoneylineAmerican`; spread: `homeSpreadPoints` (**home**-relative **Decimal**).  
- **Global** `nflSeasonYear` + `weekNumber` — **not** `Season` PK; leagues share NFL data.  
- **Admin** auth: **`src/lib/nfl/authorize-odds-admin.ts`** (league **admin** session **or** **`ODDS_SNAPSHOT_SECRET`** for automation) — use same pattern for **compute**-style routes.  
- **File list** in **3.2** is the best map of **odds** code locations.

### Project context reference

- **`docs/project-context.md`** — **domain** in **`lib/domain`**, **server-authoritative** rules, **audit** for **random** jailed.  
- **`_bmad-output/planning-artifacts/prd.md`** — **FR50–FR52**.  
- **`_bmad-output/planning-artifacts/epics.md`** — Story **3.3** AC.  
- **`docs/nfl-odds-integration.md`** — **The Odds API**; field semantics.

### Scope boundaries

- **Do not** implement **pick POST** / **4.4** **UI** (only **data** for verification). **3.4** will **read** jailed for validation.  
- **Do not** change **Tuesday snapshot** fetch semantics (**3.2** / **NFR31**).  
- **Scoring (FR54)** — **Epic 5**; this story is **identification** only.

## Dev Agent Record

### Agent Model Used

Composer (Cursor)

### Debug Log References

— 

### Implementation Plan

1. **Domain** `resolveJailedTeam` — only games with both MLs and spread contribute; favorite = min numeric American line (home wins ties); primary = most negative favorite ML; then max `abs(homeSpreadPoints)`; then SHA-256–seeded index into **lexicographically** sorted `teamId`s.  
2. **Persistence** `NflWeekJailedTeam` with `NflJailedResolutionMethod` enum; `auditJson` includes `v: 1` plus `tieLevel`, `candidates` (per-game favorite ML and spread mag), and primary winner metadata.  
3. **Service** `computeAndPersistNflWeekJailed` — `getEffectiveOddsLinesForWeek` + `randomBytes(32)` → domain → upsert; failures **console.error** (NFR45).  
4. **API** `GET/POST /api/admin/nfl/week-jailed` — same admin/Bearer policy as 3.2; POST overwrites on **admin/automation-triggered recompute** when odds change.  
5. **Rules** copy: moneyline → spread → seeded random.  

### Completion Notes List

- Implemented jailed **pure** module + **Vitest** (MONEYLINE / SPREAD / RANDOM, empty week, no lines, equal-ML home tie).  
- Added **`NflWeekJailedTeam`** + migration; orchestration in **`jailed-computation.ts`**.  
- Exposed **GET** (read persisted + audit) and **POST** (compute/upsert) with **`{ error: { code, message } }`**.  
- Updated **league rules** jailed + tie-break copy (no other duplicate **Tie-breakers** strings in `src/`).  
- Re-run **behavior**: each POST that reaches **RANDOM** uses a new server-generated seed; recompute after line patches replaces the row.  
- **DB:** run **`npx prisma migrate deploy`** (or `migrate dev`) against your environment so **`20260425200000_nfl_week_jailed_team`** applies.  

### File List

- `src/lib/domain/jailed.ts` (new)
- `src/lib/domain/jailed.test.ts` (new)
- `src/lib/nfl/jailed-computation.ts` (new)
- `src/app/api/admin/nfl/week-jailed/route.ts` (new)
- `prisma/schema.prisma` (modified)
- `prisma/migrations/20260425200000_nfl_week_jailed_team/migration.sql` (new)
- `src/app/(app)/leagues/[leagueId]/rules/page.tsx` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

## Change Log

- **2026-04-25** — Story created: **`epics.md`**, **`sprint-status.yaml`**, **`docs/project-context.md`**, **`prd.md`**, **architecture** grep, **3.2** handoff, codebase (`effective-odds`, `schema.prisma`, `rules/page.tsx` tie-break **copy bug**). Status **ready-for-dev**.

- **2026-04-25** — Implementation complete: domain + tests, **`NflWeekJailedTeam`**, migration, `computeAndPersistNflWeekJailed`, **GET/POST** `/api/admin/nfl/week-jailed`, rules copy (moneyline first). Status **review**.

- **2026-04-25** — Code review complete: 12 patches applied (signed spread-in-favorite-favor, real-favorite filter, AC5 audit-shape extension, byte-wise random sort, NFR45 actor/action logging + warn-vs-error split, recompute log, DB CHECK on `random_seed ↔ RANDOM`, Zod schema consolidation, JSON-parse warn, source-note constant, six new domain tests). 3 items deferred to follow-up (picks-lock guard → Story 3.4/3.5; transactional read+resolve+upsert; per-stage survivors in audit) and tracked in `_bmad-output/implementation-artifacts/deferred-work.md`. Regression: `npm test` 110/110, `npm run lint` clean, `npm run build` clean. Status **done**.

## Story completion status

**done** — Code review complete; all in-scope patches applied; deferrals documented.
