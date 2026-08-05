---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments: []
workflowType: 'research'
lastStep: 6
research_type: 'technical'
research_topic: 'league-scoped NFL schedules vs shared canonical schedule'
research_goals: 'Recommend an architecture so (1) real leagues auto-sync the live NFL schedule without admin action, (2) test leagues use a fuller simulated schedule where each test week ideally has ~the same game count as a typical real NFL week (not a sparse ~4-game rehearsal slate), (3) creating a real league after a test league never inherits rehearsal fixtures, (4) schedules are not shared across leagues—or an alternative that still guarantees isolation—with tradeoffs for this brownfield Prisma/NflGame codebase; constraint: The Odds API remains the provider for building the live weekly schedule and for scoring after a week has concluded'
user_name: 'Kyle'
date: '2026-08-04'
web_research_enabled: true
source_verification: true
---

# Research Report: technical

**Date:** 2026-08-04
**Author:** Kyle
**Research Type:** technical

---

## Research Overview

This research evaluates **league-scoped vs shared-canonical NFL schedule architectures** for pick-six’s brownfield Prisma/`NflGame` model under four product constraints: real leagues auto-sync live Odds-backed schedules, test leagues get full-volume simulated weeks (~13–16 games), real leagues never inherit rehearsal fixtures, and schedules remain isolated where sharing would cause harm. The Odds API remains the sole provider for live schedule build and post-week scoring.

**Headline finding:** do not put rehearsal and live schedules in one mutable global `NflGame` table. Prefer a **hybrid**: keep a **canonical Odds-backed live slate** shared by real leagues, and put test-league fixtures in a **separate league-scoped sim store** (new table), with a single `resolveGamesForLeague` read facade. Full executive summary, roadmap, and citations are in **Research Synthesis** below.

**Methodology:** scoped confirmation → stack / integration / architecture / implementation analysis with web-verified multi-tenant and sports-API sources, cross-checked against pick-six schema and `src/lib/nfl/**` behavior (including today’s 4-game fixture JSON and global rehearsal cleanup).

---

## Technical Research Scope Confirmation

**Research Topic:** league-scoped NFL schedules vs shared canonical schedule
**Research Goals:** Recommend an architecture so (1) real leagues auto-sync the live NFL schedule without admin action, (2) test leagues use a fuller simulated schedule where each test week ideally has ~the same game count as a typical real NFL week (not a sparse ~4-game rehearsal slate), (3) creating a real league after a test league never inherits rehearsal fixtures, (4) schedules are not shared across leagues—or an alternative that still guarantees isolation—with tradeoffs for this brownfield Prisma/NflGame codebase; constraint: The Odds API remains the provider for building the live weekly schedule and for scoring after a week has concluded

**Clarification (goal 2):** “Fuller simulated schedule” means test-league weeks should approximate typical real NFL weekly volume (often ~13–16 games depending on bye weeks), not a thin 4-game rehearsal slate week over week.

**Clarification (provider constraint):** Live/production schedule bootstrap and post-week results/scoring continue to use **The Odds API** (events/scores path already in the codebase). Test-league simulated schedules are a separate authority and must not compete for the same mutable game rows as Odds-backed live sync.

**Technical Research Scope:**

- Architecture Analysis - design patterns, frameworks, system architecture
- Implementation Approaches - development methodologies, coding patterns
- Technology Stack - languages, frameworks, tools, platforms
- Integration Patterns - APIs, protocols, interoperability
- Performance Considerations - scalability, optimization, patterns

**Research Methodology:**

- Current web data with rigorous source verification
- Multi-source validation for critical technical claims
- Confidence level framework for uncertain information
- Comprehensive technical coverage with architecture-specific insights

**Scope Confirmed:** 2026-08-04

---

## Technology Stack Analysis

### Programming Languages

Pick-six and comparable NFL pick’em systems are overwhelmingly **TypeScript/JavaScript** on the server and client, with occasional Python backends in older/self-hosted apps. For this decision (schedule tenancy), language choice is secondary to data-model and sync ownership; TypeScript + Zod validation remains the fit because schedule upserts, status transitions, and isolation invariants are rule-heavy and benefit from typed domain helpers.

_Popular Languages: TypeScript/JavaScript (Next.js pick’em apps); Python (Flask/Django pick’em OSS)_
_Emerging Languages: Not material for this problem — tenancy is a schema/sync concern_
_Language Evolution: Domain logic migrating into typed `src/lib/**` helpers rather than route handlers_
_Performance Characteristics: Negligible for schedule row counts (hundreds of games/season); bottleneck is sync I/O and unique-key collisions, not language runtime_
_Source: https://github.com/paul-macfarlane/picksleagues ; https://github.com/holgardk/Football5 ; https://www.decrevel.dev/blog/building-the-picks-project_

### Development Frameworks and Libraries

**Brownfield stack (pick-six):** Next.js 16 App Router, React 19, Prisma 7 + `pg`, PostgreSQL, NextAuth, Zod, Vitest, Vercel-oriented cron/email patterns.

Open-source pick’em peers converge on the same shape: **Next.js + Postgres ORM + cron/job sync from ESPN or similar**, with **Games as a shared/global table** and **Picks/leagues as tenant-scoped**. That is the status quo pick-six already has (`NflGame` global; `League` / `Pick` / `Season` league-scoped) — and it is exactly what makes rehearsal fixtures collide with live sync when both write the same natural key `(season, week, home, away)`.

_Major Frameworks: Next.js App Router + Prisma Client for schedule sync and league UX_
_Micro-frameworks / libraries: Zod for provider payload validation; date-fns/tz for kickoff/week resolution; Vitest for pure mappers/sync helpers_
_Evolution Trends: Background sync via Vercel cron or Inngest-style jobs; ESPN/`scores` APIs as schedule authority for real leagues_
_Ecosystem Maturity: Prisma multi-tenant patterns are well documented; sports-provider clients remain custom_
_Source: pick-six `package.json`; https://github.com/paul-macfarlane/picksleagues ; https://bahrtech.net/en/blog/multi-tenant-saas-postgres-prisma_

### Database and Storage Technologies

Industry default for early/mid-scale SaaS (and for pick-six) is **shared PostgreSQL schema with row-level tenancy** (`tenantId` / `leagueId` on tenant-owned tables), optionally hardened with **Postgres RLS**. Schema-per-tenant and DB-per-tenant are overkill here: leagues need schedule isolation for product correctness, not compliance silos.

Critical nuance for schedules: **not every table should be league-scoped**. Reference data (`Team`) and optionally a **canonical live NFL slate** can remain global; **what a league “sees” and mutates** (picks, simulation clock, rehearsal fixtures) must not share mutable rows with other leagues. Sources agree: put `tenantId` on every table that *belongs* to a tenant; do not force tenancy onto pure reference catalogs.

Composite uniqueness must include the tenant key when games become league-owned (`@@unique([leagueId, nflSeasonYear, weekNumber, homeTeamId, awayTeamId])`). Leaving the current global unique key while mixing live + simulated rows is the root failure mode for goal (3).

_Relational Databases: PostgreSQL + Prisma shared-schema multi-tenancy (recommended default)_
_NoSQL Databases: Not indicated — schedule/odds/picks are relational with FKs_
_In-Memory Databases: Optional cache for live odds display only; not schedule authority_
_Data Warehousing: N/A at current scale_
_Source: https://bahrtech.net/en/blog/multi-tenant-saas-postgres-prisma ; https://alexmayhew.dev/blog/multi-tenancy-prisma-rls ; https://osamahabib.com/blog/multi-tenant-saas-nextjs-prisma-postgresql ; https://iurii.rogulia.fi/blog/multi-tenant-saas-schema_

### Development Tools and Platforms

Schedule architecture work should stay in the existing toolchain: Prisma Migrate for expand/contract schema changes, Vitest for mapper/sync isolation tests, and cron/admin routes for sync. Background jobs are repeatedly called out as the **highest-risk cross-tenant bug surface** — global schedule sync that upserts without league context is the exact anti-pattern to design against.

_IDE and Editors: Unchanged (Cursor/VS Code)_
_Version Control: Git; schema changes via Prisma migrations_
_Build Systems: Next.js / npm scripts (`db:migrate`, `test`)_
_Testing Frameworks: Vitest colocated with `src/lib/nfl/**` and integration mappers — assert isolation invariants (real league create does not see test fixtures)_
_Source: https://bahrtech.net/en/blog/multi-tenant-saas-postgres-prisma (background-job tenant iteration); pick-six post-change testing norms_

### Cloud Infrastructure and Deployment

Peers deploy on **Vercel + managed Postgres** with cron-driven schedule/score sync. That favors **one global sync job writing a canonical live slate**, then **per-league projection or fan-out** — not N identical provider pulls per league (credit/rate-limit waste). Test leagues should **not** consume live sync as their schedule authority; they need a separate generator that targets **full weekly volume**.

**Volume target (goal 2):** NFL regular season is 18 weeks / 272 games (32 teams × 17 games, one bye each). Weekly game count is `(32 − teams_on_bye) / 2` → typically **13–16 games** (e.g. 2025 byes: 2–6 teams off in bye weeks → 13–15 games; weeks with no byes → 16). Test weeks should aim at that band, not ~4.

_Major Cloud Providers: Vercel + managed Postgres (Neon/Supabase-class) in peer apps_
_Container Technologies: Optional for self-host; not required for Vercel path_
_Serverless Platforms: Cron routes and short sync handlers; keep sync idempotent_
_CDN and Edge Computing: Irrelevant to schedule authority_
_Source: https://media.nfl.com/football-information/2025/2025-nfl-schedule-announced ; https://www.espn.com/nfl/story/_/id/45944807/nfl-bye-weeks-every-team-2025 ; https://en.wikipedia.org/wiki/NFL_regular_season ; https://www.decrevel.dev/blog/building-the-picks-project_

### Technology Adoption Trends

| Pattern | Adoption signal | Fit for pick-six |
| --- | --- | --- |
| Shared schema + `leagueId` on tenant data | Strong default in Prisma/Postgres SaaS guides | High — already used for Season/Pick/Membership |
| Global canonical sports schedule + league picks | Dominant in pick’em OSS | Medium — works for **real** leagues only; breaks when test leagues mutate the same `NflGame` rows |
| Full league-scoped game copies | Less common in pick’em OSS; common when tenants need divergent schedules | High for **test vs real isolation** and goal (3)/(4) |
| Schema/DB-per-league | Rare; ops-heavy | Low — unnecessary for family/office leagues |
| Postgres RLS as safety net | Growing recommendation alongside Prisma | Optional later; explicit `leagueId` params + tests are enough short-term |

_Migration Patterns: Shared-schema tenancy is cheap to extend; retrofitting isolation onto a previously global mutable table is the painful case (current `NflGame`)_
_Emerging Technologies: Job frameworks (Inngest) for sync orchestration; not required to decide the model_
_Legacy Technology: Single global games table as sole schedule store — fine until rehearsal + live coexist_
_Community Trends: Explicit tenant parameters on every data-access function; job loops iterate tenants intentionally_
_Source: https://sequere.com/multi-tenant-saas-data-model ; https://ruchitsuthar.com/blog/software-architecture/multi-tenant-saas-architecture/ ; https://alexmayhew.dev/blog/multi-tenancy-prisma-rls_

### Stack implications for the architecture decision (preview)

Confidence **high** that the viable Prisma designs collapse to two families:

1. **League-scoped `NflGame` (or `LeagueGame`)** — every league owns its rows; real leagues populated by live sync fan-out/bootstrap; test leagues populated by a full-slate simulator (~13–16 games/week).
2. **Hybrid canonical + projection** — global immutable/live `NflGame` for production sync; league-scoped overlay or separate rehearsal store for test leagues so real leagues never join rehearsal rows.

Both satisfy isolation; neither is “share one mutable schedule table across real and test.” Peer pick’em stacks usually pick (2) implicitly by having no rehearsal mode — pick-six’s `isTestLeague` + simulation clock is the forcing function for an explicit choice.

**Confidence notes:** Multi-tenant shared-schema guidance is consistent across recent Prisma/Postgres sources (high). Peer pick’em “global games” pattern is observed in multiple OSS projects but rarely documents rehearsal isolation (medium). NFL weekly volume 13–16 is arithmetic from published 32-team / bye structure (high).

---

## Integration Patterns Analysis

### API Design Patterns

**Constraint (confirmed):** Live schedule build and post-week scoring stay on **[The Odds API](https://the-odds-api.com/liveapi/guides/v4/)** — REST JSON, API key query param, sport key `americanfootball_nfl`.

| Concern | Odds API surface | Pick-six integration today |
| --- | --- | --- |
| Weekly / season schedule | `GET /v4/sports/{sport}/events` (docs: typically **quota-free** listing) | `fetchAmericanFootballNflEvents` → map → upsert `NflGame` |
| Post-week scores | `GET /v4/sports/{sport}/scores?daysFrom=1..3` | `fetchAmericanFootballNflScores` → map onto existing games (**max 3-day lookback**) |
| Betting lines | `GET .../odds` (markets × regions consume credits) | Snapshot runs + optional live display overlay |

Architecture implication: Odds is a **pull/REST** provider, not a webhook publisher. Integration design is **server-side poll → ACL map → idempotent write**, not event subscriptions from the vendor.

_RESTful APIs: Primary integration style for The Odds API and peer sports feeds; keep keys server-only_
_GraphQL APIs: Not offered by The Odds API; irrelevant unless switching vendors_
_RPC and gRPC: Not applicable for this vendor boundary_
_Webhook Patterns: Not available from The Odds API; sports vendors often remain poll-based — design around cron/admin triggers_
_Source: https://the-odds-api.com/liveapi/guides/v4/ ; https://www.sportmonks.com/blogs/webhooks-vs-websockets-vs-sse-choosing-the-right-live-football-feed/ ; docs/nfl-odds-integration.md_

### Communication Protocols

Pick-six ↔ Odds: **HTTPS GET + JSON**. App ↔ clients: existing Next.js HTTP routes. No need for WebSocket/gRPC for schedule authority.

Ops cadence fits **Vercel Cron** (or admin `POST`) rather than sub-second live scoring: product needs **weekly slate + finalize after games**, not trading-style tick streams. Vercel cron invokes HTTP GET on configured paths; handlers must stay idempotent under ± drift / retries.

_HTTP/HTTPS Protocols: Sole protocol to The Odds API_
_WebSocket Protocols: Optional later for UX live scores; not schedule authority_
_Message Queue Protocols: Optional fan-out queue if league count grows; not required at small league counts_
_gRPC and Protocol Buffers: N/A_
_Source: https://the-odds-api.com/liveapi/guides/v4/ ; https://vercel.com/docs/cron-jobs_

### Data Formats and Standards

Odds payloads use **JSON** with `home_team` / `away_team` / `commence_time` (and scores arrays when completed). Domain model needs **week 1–18**, `Team` FKs, and stable internal ids — Odds has **no first-class NFL week field**, so week is inferred (ET kickoff buckets) in the ACL.

Natural idempotency key today: `(nflSeasonYear, weekNumber, homeTeamId, awayTeamId)`. Any league-scoped redesign must either:

- keep that key **plus `leagueId`**, or  
- keep a **global canonical** key for Odds-backed rows and a **separate keyspace** for simulated rows.

Test-league full slates (~13–16 games/week) are **not** Odds JSON — they are an internal generator format that should still produce the same domain upsert shape so picks/deadlines code stays one path.

_JSON and XML: JSON from Odds; Zod schemas in `src/lib/integrations/the-odds-api/`_
_Protobuf and MessagePack: Unused_
_CSV and Flat Files: Seed/dev only (`prisma/data`), not production schedule authority_
_Custom Data Formats: Internal “schedule upsert row” DTO after ACL translation_
_Source: https://the-odds-api.com/liveapi/guides/v4/ ; https://dzone.com/articles/data-sync-design ; docs/nfl-odds-integration.md_

### System Interoperability Approaches

Recommended boundary for this brownfield:

```
The Odds API (REST)
    → client (HTTP/auth/errors)
    → mappers (ACL: teams, week inference, status)
    → sync service (idempotent upsert / score finalize)
    → persistence (canonical and/or per-league rows)
    → league UX / picks / scoring (always league-scoped reads)
```

This matches the **anti-corruption layer** pattern: vendor shapes never become Prisma models directly; domain commands are “upsert schedule row” / “finalize score”. Pick-six already has this folder split (`client` / `map-*` / `sync-*`).

**Interoperability rule for goals (1)–(4):** Odds sync must target **only live/production schedule storage**. Test leagues consume a **simulator ACL** with the same domain upsert interface. Creating a real league after a test league must bootstrap from the **Odds-backed live store**, never from rehearsal rows.

_Point-to-Point Integration: Current shape — Next.js server → Odds API (acceptable at this scale)_
_API Gateway Patterns: Unnecessary for a single external vendor_
_Service Mesh / ESB: Overkill_
_Source: https://oneuptime.com/blog/post/2026-01-30-anti-corruption-layer-pattern/view ; https://dev.to/40percentironman/ddd-anti-corruption-layers-for-handling-vendor-data-5690_

### Microservices Integration Patterns

Pick-six is a **modular monolith**, not a microservice fleet. Still apply the useful bits:

| Pattern | Application here |
| --- | --- |
| **API Gateway** | Next.js route handlers as the only public edge; Odds key never client-side |
| **Service discovery** | N/A |
| **Circuit breaker / bulkhead** | Soft-fail results sync and odds display; don’t let one league’s sim path call Odds |
| **Saga** | League create → ensure season → ensure schedule bootstrap; keep steps idempotent |

Avoid N× Odds `/events` pulls per real league. Prefer **one system-scope fetch → write canonical (or fan-out copies)** so quota and latency stay constant as leagues grow.

_Source: https://agnitestudio.com/blog/tenant-aware-background-jobs-saas/ ; https://bahrtech.net/en/blog/multi-tenant-saas-postgres-prisma_

### Event-Driven Integration

Odds does not push schedule/score events. Practical event model inside the app:

1. **System cron / admin trigger** — “sync live schedule from Odds” (global).
2. **Optional domain events / fan-out** — “live slate updated” → refresh each **non-test** league’s projected copy (if using copies).
3. **League create** — subscribe/bootstrap: real → attach/copy from live slate; test → generate full simulated season (~13–16 games/week).
4. **Results cron** — Odds `/scores?daysFrom=3` → finalize **live** games only; test leagues advance via simulation clock, not Odds.

This is **poll-driven ingestion + internal pub/fan-out**, not Kafka-level event sourcing. CQRS-lite already exists conceptually: Odds snapshot lines are write-side authority for jailed teams; live display odds are read-side overlay.

_Publish-Subscribe Patterns: Internal fan-out after one Odds pull (if league-scoped copies)_
_Event Sourcing: Not recommended for NflGame_
_Message Broker Patterns: Optional later; DB transaction + loop is enough initially_
_CQRS Patterns: Snapshot vs live-display odds already split; keep schedule authority similarly split (live vs sim)_
_Source: https://www.sportmonks.com/blogs/football-data-api-stack-rest-vs-graphql-vs-websockets/ ; https://agnitestudio.com/blog/tenant-aware-background-jobs-saas/ ; docs/nfl-odds-integration.md_

### Integration Security Patterns

- **API key** (`ODDS_API_KEY`) server-only; never in client bundles.
- Cron routes: existing secret/auth gates (same class as email crons).
- Tenant safety in jobs: enumerate leagues explicitly; **skip `isTestLeague` for Odds schedule/results writes**; log `leagueId` when touching league-scoped rows.
- Fail closed on missing tenant context for any per-league mutation.

_OAuth 2.0 and JWT: Used for app users (NextAuth), not for Odds_
_API Key Management: Single Odds key; rotate via env/hosting secrets_
_Mutual TLS: Not required by Odds_
_Data Encryption: TLS in transit; Postgres at rest per host_
_Source: https://the-odds-api.com/liveapi/guides/v4/api-error-codes.html ; https://www.multi-tenant-saas.com/tenant-aware-data-routing-query-scoping/tenant-context-injection-strategies/propagating-tenant-context-across-async-jobs/ ; https://clickhouse.com/resources/engineering/multi-tenant-saas-postgres-architecture_

### Integration design implications (for architecture step)

**Confidence high** on these integration invariants:

1. **One Odds pull for schedule, one for scores** — never per-league vendor calls for the same global NFL slate.
2. **ACL stays** — map Odds → domain upsert DTO; keep Zod + team-name canonicalization.
3. **Two schedule authorities** — Odds for real/live; simulator for test (full weekly volume).
4. **Results path** — Odds `/scores` updates only live-authority games; `daysFrom≤3` means finalize cadence must be timely.
5. **Auto-sync without admin** — system cron writes live store, then either (a) all real leagues read the shared live store via isolation-safe projection, or (b) fan-out copies into league-scoped tables for `isTestLeague=false` only.
6. **Orphan delete danger** — current full-slate orphan cleanup on global `NflGame` is exactly how rehearsal fixtures get wiped or how live sync fights sim data; isolation must make that delete scope **live-only**.

**Open integration choice (deferred to architecture step):** shared canonical live `NflGame` + separate sim store vs fully league-scoped copies fed by Odds fan-out — both preserve Odds as provider; they differ in duplication and migration cost.

---

## Architectural Patterns and Design

### System Architecture Patterns

Pick-six is a **modular monolith** (Next.js + Prisma) with global NFL reference/schedule tables and league-scoped competition data. Schema comments already encode the historical rule: *global `Team` / `NflGame` never cascade from `League` delete* — which worked until Epic 8 rehearsal fixtures began **mutating the same global `NflGame` natural key space**.

Current failure mode (brownfield facts):

- Live sync: Odds `/events` upserts + gated orphan-delete on global `NflGame` (`sync-nfl-schedule-from-odds.ts`).
- Test leagues: JSON fixture cycle at **4 games/week** (`prisma/data/nfl-simulation-fixture-schedule.json`) written into the **same** `NflGame` table; cleanup uses `test_fixture` odds provenance (`cleanup-rehearsal-fixtures.ts`) and retains fixtures while any test league exists.
- That violates goals (3)/(4) under concurrent real+test use and fights Odds orphan-delete / shared uniqueness.

Architectural families (mapped to DDD / SaaS storage language):

| Option | Pattern name | Idea |
| --- | --- | --- |
| **A** | League-scoped schedule (siloed schedule rows) | `leagueId` on games (or `LeagueNflGame`); each league owns its slate |
| **B** | Hybrid: canonical live + tenant sim store | Global Odds-backed `NflGame` shared by **real** leagues only; test leagues use separate league-scoped (or tagged) sim games |
| **C** | Status quo + provenance filters | Keep one table; rely on `test_fixture` / source tags and careful queries | ❌ Does not meet isolation goals reliably |

Microsoft/AWS SaaS guidance: **share reference data**; **partition tenant transactional data**. Live NFL schedule is closer to **shared master/reference** for real leagues; rehearsal schedule is **tenant transactional** (divergent lifecycle). Shared Kernel DDD guidance: share only what must stay consistent — **Teams + live slate semantics**, not rehearsal mutations.

_Source: https://deviq.com/domain-driven-design/shared-kernel/ ; https://webstrail.com/designing-master-data-management-for-multi-tenant-architecture/ ; https://github.com/MicrosoftDocs/sql-docs/blob/live/azure-sql/database/saas-tenancy-app-design-patterns.md ; prisma/schema.prisma ; src/lib/nfl/cleanup-rehearsal-fixtures.ts_

### Design Principles and Best Practices

Apply hexagonal/Clean dependency rule lightly (already partially present):

- **Ports:** `ScheduleSyncPort` (Odds), `ScheduleGeneratorPort` (sim), `GameRepository` (read by league + week).
- **Adapters:** existing `the-odds-api/*` ACL; expand sim fixture generator to full weekly volume (~13–16).
- **Invariants in domain helpers:** real leagues never read sim rows; Odds writes never touch sim rows; orphan-delete scoped to live authority only.

SOLID-relevant:

- **SRP:** separate “sync live from Odds” from “ensure test league fixtures”.
- **OCP:** add fuller fixture weeks without changing Odds client.
- **DIP:** picks week resolution depends on a league-aware game query, not raw global `nflGame.findMany({ season, week })`.

ACL ≠ hexagonal, but combine: ACL translates Odds; hexagonal ports keep use-cases free of vendor types.

_Source: https://topictrick.com/blog/clean-vs-hexagonal-architecture ; https://softwareengineering.stackexchange.com/questions/452657/what-is-the-difference-between-hexagonal-architecture-and-anti-corruption-layer ; https://hld.handbook.academy/curriculum/architecture-patterns/hexagonal-clean-architecture/_

### Scalability and Performance Patterns

Schedule cardinality is tiny: ~272 games/season globally; × N leagues if fully copied still small (e.g. 50 leagues ≈ 14k rows). **Duplication cost is not the bottleneck** — correctness and sync fan-out are.

| Concern | Option A (all league-scoped) | Option B (hybrid) |
| --- | --- | --- |
| Odds API calls | 1 pull + fan-out copies to real leagues | 1 pull → write canonical once |
| Row growth | O(leagues × games) | O(games + testLeagues × simGames) |
| Kickoff updates mid-season | Must update every real-league copy | Update once; all real leagues see it |
| Query path | Always filter `leagueId` | Real: global; Test: league-scoped |

Horizontal scale of Vercel functions / Neon is unchanged; prefer **constant Odds cost** (already decided in integration analysis).

_Source: https://docs.aws.amazon.com/pdfs/whitepapers/latest/multi-tenant-saas-storage-strategies/multi-tenant-saas-storage-strategies.pdf ; prior Integration Patterns section_

### Integration and Communication Patterns

Recommended runtime topology:

```
Cron/Admin
  ├─ syncLiveScheduleFromOdds → canonical live store (only)
  ├─ syncLiveResultsFromOdds  → finalize live games (only)
  └─ (unchanged) snapshotOdds → lines on live games

League create / pre-season init
  ├─ isTestLeague=false → ensure access to live store (no copy required in B)
  └─ isTestLeague=true  → generate/ensure league-scoped full-volume sim slate

Picks / reminders / scoring reads
  └─ resolveGamesForLeague(leagueId, week)  // single entry point
```

Auto-sync without admin (goal 1): cron keeps **canonical live** fresh; real leagues read it automatically. No per-league admin schedule button required.

_Source: Integration Patterns Analysis (this doc); https://agnitestudio.com/blog/tenant-aware-background-jobs-saas/_

### Security Architecture Patterns

Isolation here is **product correctness**, not compliance silos. Still:

- Never let Odds sync delete/update rows outside live authority.
- League-scoped reads must pass `leagueId` (and `isTestLeague` branch) at the repository boundary.
- RLS optional later; explicit parameters + tests are enough for current scale (per earlier multi-tenant Prisma guidance).
- Test leagues already excluded from some crons (`get-active-league-ids`) — keep that discipline for Odds schedule/results.

_Source: https://bahrtech.net/en/blog/multi-tenant-saas-postgres-prisma ; https://alexmayhew.dev/blog/multi-tenancy-prisma-rls_

### Data Architecture Patterns

**Recommended leaning (confidence medium-high): Option B — Hybrid canonical live + league-scoped simulation store.**

Why B over A for this brownfield:

1. **Odds sync + odds lines + jailed teams** already key off global `NflGame.id`. Moving *all* real leagues to copies forces fan-out of schedule *and* careful odds FK strategy (duplicate lines per league or keep lines on canonical and join).
2. Real leagues **should** share one live slate — product wants the real NFL schedule, not divergent copies. “Schedules not shared” is satisfied for **test vs real** and for **test vs test** if sim is league-scoped; sharing among real leagues is desirable, not a bug.
3. Schema comment “global NflGame” remains true for live; extend with league-scoped sim table (e.g. `LeagueSimGame` or `NflGame.leagueId` nullable where `NULL = canonical live`).
4. Goal (3): new real league reads `leagueId IS NULL` (canonical) — never sim rows.
5. Goal (2): expand fixture JSON / generator to ~13–16 matchups per week; write only into sim store.
6. Goal (1): cron → canonical; zero admin.

**Nullable `leagueId` on `NflGame` variant of B:**

- `leagueId NULL` + unique `(season, week, home, away)` where leagueId is null (partial unique index) for live.
- `leagueId NOT NULL` + unique `(leagueId, season, week, home, away)` for sim.
- Prisma partial uniques need raw SQL migration — workable but sharper than a separate `LeagueSimGame` model.

**Option A** remains valid if product later requires per-real-league schedule edits; higher migration cost to odds/jailed/global sync.

**Option C** rejected: provenance-based cleanup already shows shared-table entanglement (`cleanup-rehearsal-fixtures`).

Picks note: `Pick` references `teamId` + `nflWeekNumber`, not `nfl_game_id` — schedule storage can change with less pick-table migration pain, but **week views and kickoff deadlines** must query the correct game store.

_Source: https://martinfowler.com/bliki/ArchitectureDecisionRecord.html ; https://data-doctrine.com/blog/master-data-vs-reference-data/ ; https://nilus.be/blog/shared_kernel_in_domain-driven-design_microservices/ ; docs/nfl-odds-integration.md_

### Deployment and Operations Architecture

- **Cron:** system-scope Odds schedule + results (live only); existing email crons iterate real leagues.
- **Admin:** retain manual Odds sync as override; remove need for it on real league create.
- **Migration:** expand-contract — add sim store / nullable leagueId → dual-write/read for test path → stop writing sim into global live keys → delete leftover fixture-only global rows → expand fixture volume.
- **ADR:** capture decision as short ADR (context / decision / alternatives / consequences) under `docs/adr` when implementing — Fowler-style, immutable once accepted.

_Source: https://martinfowler.com/bliki/ArchitectureDecisionRecord.html ; https://vercel.com/docs/cron-jobs_

### Architecture decision preview (to refine in implementation research)

| Goal | Option B (hybrid) | Option A (full league-scope) |
| --- | --- | --- |
| (1) Real auto-sync via Odds | ✅ Cron → canonical | ✅ Cron → fan-out copies |
| (2) Full-volume test weeks | ✅ Sim generator ~13–16 | ✅ Same |
| (3) Real after test isolation | ✅ Real never reads sim | ✅ Separate row sets |
| (4) No harmful sharing | ✅ Real share live (OK); tests isolated | ✅ Strictest; more duplication |
| Brownfield odds/jailed impact | Lower | Higher |
| Odds API cost | Minimal | Minimal if fan-out after one pull |

**Provisional recommendation: Option B (hybrid),** with either a dedicated sim games table or partial-unique nullable `leagueId`, plus fuller fixture schedule data. Treat “schedules not shared across leagues” as **isolation of mutable/rehearsal state**, not as forbidding real leagues from sharing the one true NFL slate.

Confidence: **medium-high** for B given Odds + odds-line FKs; **high** that C fails goals; **medium** that A is better long-term only if per-league live customization appears.

---

## Implementation Approaches and Technology Adoption

### Technology Adoption Strategies

Adopt **strangler-fig + expand/contract**, not a big-bang rewrite of `NflGame`.

1. **Facade first:** introduce `resolveGamesForLeague({ leagueId, nflSeasonYear, weekNumber })` as the single read seam; temporarily implement with today’s global queries + `isTestLeague` branch.
2. **Expand schema:** add league-scoped sim storage (prefer **new table** over nullable `leagueId` on `NflGame` — see below).
3. **Reroute writers:** test fixture ensure/sim results/odds → sim table only; Odds schedule/results/orphan-delete → canonical `NflGame` only (`leagueId` absent / live rows only).
4. **Reroute readers:** facade reads sim table for test leagues, canonical for real.
5. **Eliminate:** stop writing fixtures into global `NflGame`; run cleanup of fixture-only global rows; delete or gut `cleanup-rehearsal-fixtures` global coupling; expand fixture JSON to full weekly volume.

Prefer gradual adoption over big bang: each PR ships behind existing Vitest + a small acceptance matrix (real after test, auto-sync, full week count).

_Source: https://docs.aws.amazon.com/prescriptive-guidance/latest/modernization-decomposing-monoliths/strangler-fig.html ; https://www.prisma.io/dataguide/types/relational/expand-and-contract-pattern ; https://www.prisma.io/docs/v6/orm/prisma-migrate/workflows/customizing-migrations_

### Development Workflows and Tooling

Stay in the existing toolchain:

| Step | Tooling |
| --- | --- |
| Schema | Prisma Migrate (+ customized SQL for any partial indexes if chosen) |
| Domain helpers | `src/lib/nfl/**`, `src/lib/picks/**` |
| Tests | Vitest colocated `*.test.ts` |
| Ops docs | Update `docs/nfl-odds-integration.md` + short ADR |
| Sync | Existing Odds client; add cron for schedule if not already automated |

**Schema choice for sim store (implementation preference):**

| Approach | Pros | Cons |
| --- | --- | --- |
| **New `LeagueSimGame` (or `LeagueNflGame`) table** | Clear FKs; Prisma `@@unique([leagueId, season, week, home, away])` works with `upsert`; Odds code untouched | Dual models; thin shared mapper for kickoff/status fields |
| **Nullable `leagueId` on `NflGame` + partial uniques** | One table | Prisma upsert/`@@unique` friction with partial indexes; NULL uniqueness pitfalls; higher migration risk |

**Recommend new table** for brownfield speed and safer Odds upsert path. Use Postgres partial uniques only if consolidating later.

_Source: https://www.postgresql.org/docs/18/indexes-unique.html ; https://dev.to/philip_mcclarence_2ef9475/five-specific-schema-patterns-unbounded-varchar-nullable-columns-inside-multi-1glp ; https://mvpfactory.io/blog/postgresql-partial-unique-indexes-and-deferred-constraints-for-soft-delete/_

### Testing and Quality Assurance

Before structural moves: add **characterization tests** locking current sync/sim behavior, then TDD the new facade and isolation invariants.

**Must-pass acceptance tests (product goals):**

1. Odds schedule sync upserts/deletes **only** canonical live games (never sim rows).
2. Creating real league after test league: picks week view shows Odds/live slate, **zero** fixture-only matchups.
3. Test league week game count ≈ typical NFL week (**13–16**, not 4) after fixture expansion.
4. Two test leagues can diverge (delete one does not wipe the other’s sim games).
5. Real-league cron path does not require admin schedule sync after live store is populated.
6. Odds `/scores` finalize updates live games; sim weeks still finalize via `applySimulationWeekResults`.

Touchpoints with many `nflGame.findMany` call sites (picks, email, admin, scoring, jailed, odds snapshot) should migrate **through the facade**, not one-off filters — reduces forgotten `where` clauses.

_Source: https://github.com/ThoughtWorksInc/WorkingEffectivelyWithLegacyCode/blob/master/README.md ; https://associationforsoftwaretesting.org/2016/03/10/profiling-legacy-code-using-characterization-tests/ ; pick-six post-change testing rule_

### Deployment and Operations Practices

Phased deploys (each deploy green on `npm test` + migrate):

1. **Expand:** ship empty `LeagueSimGame` (+ FK cascade from `League`).
2. **Dual path:** new test leagues write sim table; optionally copy existing fixture weeks for open test leagues.
3. **Cut read path:** facade prefers sim table for `isTestLeague`.
4. **Stop global fixture writes;** run one-off cleanup of global `test_fixture`-only games.
5. **Automate live sync:** cron → `syncNflScheduleFromOdds` + `syncNflResultsFromOdds` (admin remains override).
6. **Expand fixtures:** replace 6×4 JSON with weeks totaling ~13–16 games (can use a prior real Odds-exported slate sanitized into fixture JSON, or a generated round-robin with byes).
7. **Docs/ADR + runbook** updates.

Observability: keep structured logs (`nfl_schedule_odds_sync_*`, new `league_sim_schedule_*`); alert on sync failures; log game counts per league week after ensure.

_Source: https://dev.to/whoffagents/prisma-migrations-in-production-zero-downtime-deployments-with-expand-contract-2l1p ; docs/nfl-odds-integration.md_

### Team Organization and Skills

Solo/small-team fit: one engineer can own the vertical slice if sequencing stays facade → schema → writers → readers → cleanup. Skills: Prisma migrations, Postgres uniqueness, existing Odds ACL, Vitest. No new platform skill (Kafka, RLS) required for v1 of Option B.

### Cost Optimization and Resource Management

- **Odds API:** still one `/events` + periodic `/scores` + weekly odds snapshot — unchanged by hybrid design; do **not** multiply pulls per league.
- **DB:** sim rows ≈ `testLeagues × simulationWeekCount × ~15` — negligible on Neon.
- **Eng cost:** facade + new table + fixture expansion + call-site migration is the real cost; full Option A (copy live games per real league) costs more ongoing kickoff-update fan-out.

### Risk Assessment and Mitigation

| Risk | Mitigation |
| --- | --- |
| Missed `nflGame.findMany` call site serves wrong slate | Central facade; grep gate in PR; tests for picks/email/scoring paths |
| Partial unique / NULL semantics bugs if single-table | Prefer separate sim table |
| Orphan-delete wipes sim leftovers during transition | Gate delete to `leagueId IS NULL` / canonical-only before any shared-table experiment |
| Fixture expansion quality (implausible matchups) | Seed from a real prior season export; validate team abbreviations against `nfl-teams.json` |
| Mid-season Odds `/events` incomplete | Keep existing ≥200 orphan-delete gate on live sync |
| Odds lines / jailed still global | Keep on canonical `NflGame` for real leagues; sim continues `test_fixture` snapshot source on sim games (or parallel sim odds table keyed to sim game ids) |
| Cascade on league delete | `LeagueSimGame` `onDelete: Cascade` — aligns with schema comment intent for league-scoped data |

### Technical Research Recommendations

#### Implementation Roadmap

| Phase | Deliverable | Exit criteria |
| --- | --- | --- |
| 0 | Facade `resolveGamesForLeague` + characterization tests | All listed call sites can switch without behavior change |
| 1 | `LeagueSimGame` model + migrate | Empty table in prod |
| 2 | Sim writers (`ensureFixture…`, sim results/odds) → new table | Test leagues no longer insert global fixture games |
| 3 | Facade reads sim for test / canonical for real | Goal (3) test green |
| 4 | Global fixture cleanup + simplify `cleanup-rehearsal-fixtures` | No `test_fixture`-only rows in `nfl_games` |
| 5 | Cron auto-sync Odds schedule/results for live store | Goal (1); admin optional |
| 6 | Expand fixture schedule to ~13–16 games/week | Goal (2); structural integrity tests updated |
| 7 | ADR + docs (`nfl-odds-integration.md`) | Decision recorded |

#### Technology Stack Recommendations

- Keep: Next.js, Prisma 7, Postgres, The Odds API, Vitest, Vercel cron.
- Add: league-scoped sim games table; schedule read facade; fuller fixture dataset.
- Avoid for this change: RLS (optional later), per-real-league live copies, new sports vendors.

#### Skill Development Requirements

- Prisma expand/contract migrations
- League-aware data-access discipline for background jobs
- Fixture data curation (full NFL-week shapes)

#### Success Metrics and KPIs

- **Isolation:** 100% of automated isolation tests green; manual: create test league → create real league → real week shows live Odds slate only.
- **Volume:** median games/week in active test leagues ≥ 13 (bye weeks may dip to 13).
- **Ops:** live schedule sync succeeds on cron without admin click; Odds credit burn unchanged (±noise).
- **Regression:** `npm test` green; no increase in schedule mapping 422s.

---

# Hybrid Canonical Live + League-Scoped Simulation: Comprehensive Schedule Architecture Technical Research

## Executive Summary

Pick-six’s schedule problem is not “whether to use The Odds API” — that constraint is settled — but **who owns mutable game rows** when real leagues need one shared live NFL slate and test leagues need a divergent, full-volume rehearsal season. Industry multi-tenant guidance is consistent: **share global reference/master data; isolate tenant-specific transactional data**. Peers that only run real pick’em pools get away with a global `Games` table; Epic 8 rehearsal breaks that assumption by writing into the same natural key space Odds sync upserts and orphan-deletes.

**Recommendation: Option B (hybrid).** Keep global `NflGame` as the **canonical Odds-backed live schedule** (auto-synced by cron; shared by all real leagues). Add a **league-scoped simulation games table** for test leagues, expand fixtures from 4 to ~13–16 games/week, and route all reads through `resolveGamesForLeague`. Reject provenance-only coexistence on one table (Option C). Defer full per-league copies of the live slate (Option A) unless product later needs per-real-league schedule edits.

**Key Technical Findings:**

- Global `NflGame` + `test_fixture` cleanup cannot guarantee goal (3) while Odds orphan-delete and shared uniqueness remain.
- Typical NFL weeks have **13–16 games**; current fixture JSON is **6 weeks × 4 games**.
- Odds integration should stay **one pull → live store**; never N pulls per league.
- Separate sim table beats nullable `leagueId` on `NflGame` for Prisma upsert ergonomics and safer migration.

**Technical Recommendations:**

1. Implement hybrid Option B with a new `LeagueSimGame` (name flexible) + read facade.
2. Automate Odds `/events` + `/scores` sync to canonical live only.
3. Expand simulation fixture data to full weekly volume.
4. Migrate call sites via strangler facade; characterize then cut over.
5. Record an ADR and update `docs/nfl-odds-integration.md`.

## Table of Contents

1. Technical Research Introduction and Methodology
2. Technical Landscape and Architecture Analysis
3. Implementation Approaches and Best Practices
4. Technology Stack Evolution and Current Trends
5. Integration and Interoperability Patterns
6. Performance and Scalability Analysis
7. Security and Compliance Considerations
8. Strategic Technical Recommendations
9. Implementation Roadmap and Risk Assessment
10. Future Technical Outlook and Innovation Opportunities
11. Technical Research Methodology and Source Verification
12. Technical Appendices and Reference Materials

## 1. Technical Research Introduction and Methodology

### Technical Research Significance

Schedule ownership sits at the intersection of **sports data integration** and **multi-tenant isolation**. SaaS literature stresses that reference data (teams, the true NFL slate) should be shared, while tenant-specific state must not collide on shared mutable rows. Pick-six hit that collision when rehearsal fixtures and Odds sync shared `nfl_games`.

_Technical Importance: Correct schedule authority is a prerequisite for picks deadlines, scoring, jailed-team computation, and email week resolution._
_Business Impact: Test leagues that pollute live schedules create false production rehearsals and block trustworthy real-league launch after practice._
_Source: https://mdsanwarhossain.me/blog-multi-tenancy-microservices-architecture.html ; https://redis.io/blog/data-isolation-multi-tenant-saas/_

### Technical Research Methodology

- **Technical Scope:** Prisma schema, Odds ACL, sim fixtures, sync jobs, league read paths
- **Data Sources:** The Odds API docs; Prisma expand/contract; multi-tenant Postgres/Prisma guides; NFL schedule math; pick-six code/docs
- **Analysis Framework:** Goals → options A/B/C → integration invariants → migration phases → risks
- **Time Period:** Current (2026) stack and vendor constraints
- **Technical Depth:** Brownfield-specific recommendation with ADR-ready decision

### Technical Research Goals and Objectives

**Original Technical Goals:** (see frontmatter / scope confirmation)

**Achieved Technical Objectives:**

- Mapped A/B/C options to goals (1)–(4) and Odds constraint
- Confirmed hybrid B as best brownfield fit; C rejected; A reserved
- Specified integration invariants (one Odds pull; live-only orphan delete; sim separate)
- Produced phased implementation roadmap with tests and KPIs
- Clarified that “not shared” means isolating rehearsal, not forbidding real leagues from sharing the live NFL slate

## 2. Technical Landscape and Architecture Analysis

### Current Technical Architecture Patterns

_Dominant Patterns: Modular monolith; global NFL tables; league-scoped Season/Pick/Membership_
_Architectural Evolution: Story 3.9 Odds schedule authority → Epic 8 global rehearsal fixtures → isolation debt_
_Architectural Trade-offs: Sharing live slate among real leagues is desirable; sharing mutable sim+live is not_
_Source: prisma/schema.prisma ; https://deviq.com/domain-driven-design/shared-kernel/ ; Architectural Patterns section above_

### System Design Principles and Best Practices

_Design Principles: ACL at Odds boundary; single read facade; SRP for live sync vs sim generate_
_Best Practice Patterns: Strangler fig + expand/contract; shared reference + tenant transactional split_
_Architectural Quality Attributes: Correctness/isolation first; scale trivial at current cardinality_
_Source: https://topictrick.com/blog/clean-vs-hexagonal-architecture ; https://www.prisma.io/dataguide/types/relational/expand-and-contract-pattern_

## 3. Implementation Approaches and Best Practices

### Current Implementation Methodologies

_Development Approaches: Facade → schema expand → writer cutover → reader cutover → cleanup → fixture expansion → cron_
_Code Organization Patterns: Keep `the-odds-api` ACL; add sim repository; centralize league game resolution_
_Quality Assurance Practices: Characterization tests + isolation acceptance matrix + Vitest_
_Deployment Strategies: Additive migrations; phased deploys; admin Odds sync as override_
_Source: Implementation Approaches section; https://docs.aws.amazon.com/prescriptive-guidance/latest/modernization-decomposing-monoliths/strangler-fig.html_

### Implementation Framework and Tooling

_Development Frameworks: Next.js 16, Prisma 7, Zod, Vitest_
_Tool Ecosystem: Vercel cron, structured JSON logs_
_Build and Deployment Systems: Existing npm test / migrate / deploy path_

## 4. Technology Stack Evolution and Current Trends

### Current Technology Stack Landscape

_Programming Languages: TypeScript_
_Frameworks and Libraries: Next.js + Prisma (aligned with pick’em peers)_
_Database and Storage Technologies: Postgres shared schema; selective league scoping_
_API and Communication Technologies: Odds REST JSON pull; no vendor webhooks_
_Source: Technology Stack Analysis; https://the-odds-api.com/liveapi/guides/v4/_

### Technology Adoption Patterns

_Adoption Trends: Shared-schema tenancy default; RLS optional hardening_
_Migration Patterns: Expand/contract over big-bang table rewrites_
_Emerging Technologies: Job frameworks (Inngest) optional later — not required for decision_

## 5. Integration and Interoperability Patterns

### Current Integration Approaches

_API Design Patterns: Odds `/events` schedule, `/scores` results (`daysFrom`≤3), `/odds` lines_
_Service Integration: System cron → live store; league create → bootstrap live read or sim generate_
_Data Integration: Map to domain upsert DTO; stable natural keys; preserve `NflGame.id` for odds FKs on live rows_
_Source: Integration Patterns Analysis; docs/nfl-odds-integration.md_

### Interoperability Standards and Protocols

_Standards Compliance: Vendor ToS; server-only API keys_
_Protocol Selection: HTTPS JSON sufficient_
_Integration Challenges: Mid-season incomplete `/events` (keep ≥200 orphan-delete gate); week inference without provider week field_

## 6. Performance and Scalability Analysis

### Performance Characteristics and Optimization

_Performance Benchmarks: ~272 live games/season; sim rows grow with test leagues only — negligible_
_Optimization Strategies: One Odds pull; chunked Prisma upserts (already present)_
_Monitoring and Measurement: Log upserted/deleted counts; per-league week game counts after ensure_

### Scalability Patterns and Approaches

_Scalability Patterns: Constant vendor cost; O(testLeagues) sim storage_
_Capacity Planning: No fan-out of Odds calls to real leagues under hybrid B_
_Elasticity: N/A beyond existing serverless/cron limits_

## 7. Security and Compliance Considerations

### Security Best Practices and Frameworks

_Security Frameworks: Explicit `leagueId` on tenant mutations; fail closed in jobs_
_Threat Landscape: Cross-league schedule bleed (product integrity), not primarily compliance silo_
_Secure Development Practices: Facade + tests; Odds key server-only_
_Source: https://bahrtech.net/en/blog/multi-tenant-saas-postgres-prisma_

### Compliance and Regulatory Considerations

_Industry Standards: N/A beyond normal app auth_
_Regulatory Compliance: Not driving silo/DB-per-league_
_Audit and Governance: Keep `test_fixture` vs `the_odds_api` source distinction on snapshot runs_

## 8. Strategic Technical Recommendations

### Technical Strategy and Decision Framework

| Decision | Choice |
| --- | --- |
| Architecture | **Hybrid B** — canonical live `NflGame` + league-scoped sim games |
| Provider | **The Odds API** for live schedule + results + lines |
| Sim volume | **~13–16 games/week** fixture data |
| Read API | **`resolveGamesForLeague`** |
| Migration | **Strangler + expand/contract** |
| Not chosen | Full league-scoped live copies (A); provenance-only (C) |

_Architecture Recommendations: As table above_
_Technology Selection: No new vendor or ORM_
_Implementation Strategy: Phases 0–7 in Implementation Research_
_Source: Architectural Patterns + Implementation sections; https://martinfowler.com/bliki/ArchitectureDecisionRecord.html_

### Competitive Technical Advantage

_Technology Differentiation: Safe rehearsal without contaminating production schedules_
_Innovation Opportunities: Later, export a real Odds slate into fixture templates automatically_
_Strategic Technology Investments: Facade + sim table + fixture curation over new sports APIs_

## 9. Implementation Roadmap and Risk Assessment

### Technical Implementation Framework

_Implementation Phases: 0 facade → 1 sim table → 2 writers → 3 readers → 4 cleanup → 5 cron → 6 full fixtures → 7 ADR/docs_
_Technology Migration Strategy: Dual-path briefly; then eliminate global fixture writes_
_Resource Planning: Solo-capable vertical slice; highest effort is call-site migration through facade_

### Technical Risk Management

_Technical Risks: Missed findMany call sites — mitigate with facade + grep gate_
_Implementation Risks: Sim odds FK design — keep sim odds keyed to sim game ids or parallel snapshot source_
_Business Impact Risks: Partial cutover serving wrong slate — acceptance tests for goal (3) before declaring done_

## 10. Future Technical Outlook and Innovation Opportunities

### Emerging Technology Trends

_Near-term: Cron auto-sync + hybrid isolation (this research)_
_Medium-term: Optional RLS; richer fixture generation from prior-season Odds exports_
_Long-term: Revisit dedicated NFL data vendor only if Odds coverage/quota fails (already documented in nfl-odds-integration)_

### Innovation and Research Opportunities

_Research Opportunities: Deterministic full-slate generator with bye weeks; per-test-league fixture packs_
_Emerging Technology Adoption: Inngest-style job fan-out if league count grows large_
_Innovation Framework: Keep ACL ports so sim and Odds remain swappable writers behind one domain upsert shape_

## 11. Technical Research Methodology and Source Verification

### Comprehensive Technical Source Documentation

_Primary Technical Sources: The Odds API v4 docs; Prisma expand/contract guide; NFL schedule announcements; pick-six schema and nfl lib_
_Secondary Technical Sources: Multi-tenant Prisma/Postgres blogs; DDD shared kernel; strangler fig; characterization testing_
_Technical Web Search Queries: Prisma multi-tenant isolation; shared vs tenant copy; Odds API events/scores; expand-contract; partial unique indexes; strangler fig; NFL games per week_

### Technical Research Quality Assurance

_Technical Source Verification: Multi-source on tenancy defaults; vendor docs for Odds; code inspection for brownfield facts_
_Technical Confidence Levels: High that C fails; medium-high that B fits brownfield; medium that A is only needed for per-real-league edits_
_Technical Limitations: Did not load-test Odds mid-season partial feeds beyond existing ≥200 gate; fixture curation content is an implementation task_
_Methodology Transparency: Collaborative scope refinements (full week volume; Odds constraint) recorded in scope section_

## 12. Technical Appendices and Reference Materials

### Detailed Technical Data Tables

**Option comparison (goals)**

| Goal | A Full league-scope | B Hybrid (recommended) | C Provenance-only |
| --- | --- | --- | --- |
| (1) Real auto-sync | Fan-out copies | Cron → canonical | Fragile |
| (2) Full sim weeks | Yes | Yes | Yes (data only) |
| (3) No inheritance | Yes | Yes | No |
| (4) Isolation | Strictest | Real share live OK; tests isolated | No |
| Brownfield cost | High | Medium | Low / wrong |

**NFL week volume:** games/week = `(32 − teams_on_bye) / 2` → typically 13–16.  
**Current fixtures:** 6 weeks × 4 games (`prisma/data/nfl-simulation-fixture-schedule.json`).

### Technical Resources and References

_Technical Standards: Prisma Migrate; Postgres unique/partial indexes_
_Open Source Projects: picksleagues, Football5 (peer patterns)_
_Research Papers and Publications: Fowler ADR; Feathers characterization tests_
_Technical Communities: Prisma docs; The Odds API guides_

---

## Technical Research Conclusion

### Summary of Key Technical Findings

Live and rehearsal schedules must not share one mutable identity space. Hybrid canonical live (Odds) + league-scoped sim (full-volume fixtures) meets all stated goals with the lowest brownfield risk around odds lines and sync.

### Strategic Technical Impact Assessment

Interpreting “schedules are not shared” as **no harmful cross-league mutable sharing** preserves the correct product behavior that all real leagues see the same NFL schedule while test leagues stay sandboxed.

### Next Steps Technical Recommendations

1. Accept Option B (or explicitly choose A with eyes open on odds fan-out).
2. Write ADR + implementation story from phases 0–7.
3. Ship facade and sim table before expanding fixture JSON.
4. Add cron for Odds schedule/results on the live store.
5. Prove goal (3) with an automated isolation test before closing the work.

---

**Technical Research Completion Date:** 2026-08-04  
**Research Period:** current comprehensive technical analysis  
**Source Verification:** Claims cited to vendor docs, multi-tenant architecture sources, and pick-six brownfield code  
**Technical Confidence Level:** Medium-high overall (high on rejecting shared mutable table; medium-high on hybrid B)

_This document is the authoritative technical reference for league-scoped vs canonical NFL schedule architecture in pick-six and is intended to inform an ADR and implementation stories._

---

<!-- Technical research workflow complete -->
