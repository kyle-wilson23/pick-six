---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-pick-six-2026-01-05.md
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
workflowType: 'architecture'
project_name: 'pick-six'
user_name: 'Kyle'
date: '2026-03-30'
lastStep: 8
status: 'complete'
completedAt: '2026-04-04'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

The PRD defines **61 functional requirements (FR1–FR61)** grouped into eight capability areas that map directly to system boundaries:

- **League management (FR1–FR7, FR61):** Multi-league creation and admin views, invitations, pre-season initialization, league info for participants, a rules reference page, and **admin-initiated permanent league deletion** with server-side authorization and data removal.
- **User management & authentication (FR8–FR13):** Invitation-based signup, email/password login, extended sessions, logout, roster visibility, admin as full participant.
- **Pick submission & management (FR14–FR27):** Weekly matchups with moneyline and spread, season pick history, jailed-team and duplicate-team UX, single pick per week, anti-jailed 2-point path, unlimited changes before deadline, countdown, server-side deadline enforcement, real-time validation.
- **Admin operations & overrides (FR28–FR34):** Submission status dashboard, submit/modify on behalf of users (including post-deadline), same validation rules, audit trail and visibility, jailed-team verification with tie-breaker transparency.
- **Email notifications (FR35–FR40):** Tuesday 6:00 PM league email, Wed/Thu reminders for missing picks, deep links, personalization by pick status.
- **Scoring, results & leaderboard (FR41–FR49):** Post-game processing, 1- vs 2-point scoring, Tuesday updates after MNF, standings and history, pick privacy until Tuesday reveal, admin always-on visibility.
- **Jailed team & rules (FR50–FR54):** Automated jailed identification, odds then spread then seeded random tie-break, no duplicate teams, anti-jailed bonus.
- **Data export & season (FR55–FR60):** Admin CSV export of full league snapshot, 18-week season, weekly orchestration. (**FR61** is grouped under league management above.)

Architecturally, this implies distinct **domains**: identity and sessions, multi-tenant league and membership, weekly game/odds snapshots, pick lifecycle and locking, scoring and standings, outbound email with schedules, audit logging, and export.

**Non-Functional Requirements:**

The PRD lists **53 NFRs** that constrain architecture:

- **Performance (NFR1–NFR8):** Initial load &lt;3s, route transitions &lt;1s, TTI &lt;4s, snappy pick UI, mobile 60–90s workflows.
- **Security (NFR9–NFR18):** HTTPS, hashed passwords, secure HTTP-only cookies, auth rate limits, no credential logging, CSRF on mutations, tamper-evident audit logs, strict admin-only overrides, pick privacy until reveal.
- **Reliability (NFR19–NFR28):** High uptime; critical windows for Tuesday email and deadlines; zero scoring/deadline mistakes; graceful degradation when odds API fails; email retries; atomic DB transactions.
- **Integration (NFR29–NFR36):** Tuesday odds cache before email; email delivery tracking and retries; results within ~1 hour of games; MNF → Tuesday morning processing for standings.
- **Accessibility (NFR37–NFR44):** WCAG 2.1 Level A baseline, keyboard, contrast, labels, focus, semantic HTML, key ARIA and announcements.
- **Operations (NFR45–NFR53):** Structured logging and alerting, admin visibility into health, backups, reversible migrations, deployability to typical Next.js hosts.

**Scale & Complexity:**

- **Primary domain:** Full-stack web application (browser clients, server APIs, background or scheduled jobs, external integrations).
- **Complexity level:** **Medium** — single-region, ~14 concurrent users at peak, but **high correctness** burden (deadlines, scoring, jailed logic, privacy windows) and **multi-tenancy from day one** per PRD.
- **Estimated architectural components (logical):** Auth/session service; league and membership; NFL schedule/odds/results integration layer; weekly snapshot and jailed-team engine; pick and deadline service; scoring and standings; email pipeline; audit and export; admin tooling APIs; responsive web UI with shared and admin-specific surfaces.

### Technical Constraints & Dependencies

- **Stack direction:** README and PRD assume **Next.js + React**; README names **MUI** and a custom dark theme for UI.
- **Integrations:** At least one **NFL odds** provider (server-side fetch and cache), **transactional email**, optional **weather** per UX spec, and **game results** (source TBD in architecture).
- **Runtime constraints:** No websockets required for MVP (manual refresh acceptable); odds **static for the week** after Tuesday snapshot; picks hidden from peers until Tuesday reveal.
- **Deployment:** Must fit **Vercel/Netlify-class** hosting per NFR53; scheduled work may need platform cron or an external scheduler.
- **Epics/stories:** See **`_bmad-output/planning-artifacts/epics.md`** for user stories and acceptance criteria (solutioning 2026). PRD defines **61 FRs (FR1–FR61)**; epics add operational and UX-adjacent requirements (mid-season start, pre-season preview, logos, rehearsal leagues).

### Cross-Cutting Concerns Identified

- **Multi-tenancy:** Leagues, roles (admin vs participant), and data isolation across leagues.
- **League season boundaries:** Store **first NFL competition week** (1–18) on `League` or `Season` when required by product (default 1). All week pointers, pick eligibility, and scoring windows must respect it—no implicit “always Week 1” for every league (`epics.md` Story 2.7).
- **Test / rehearsal leagues:** Optional **league kind** or flag for simulation (fixture odds, admin-driven week advance, decoupled email policy). Isolated by `leagueId`; deletable with cascade rules documented (Epic 8).
- **Pre-season odds/weather:** Server routes should support **Week 1** (or configured preview week) fetch for **integration smoke tests** before the pick window opens—without breaking in-season Tuesday snapshot rules (`epics.md` Epic 3).
- **Team logos:** Prefer **`next/image`** and static assets or licensed URLs; map `teamId` → asset; no NFL API keys in client (Epic 3 Story 3.8).
- **Time and timezones:** Deadline “5 minutes before first kick” and **EST-oriented** copy must be implemented in a **server-authoritative** way with clear storage of instants.
- **Privacy vs transparency:** Participant picks hidden until Tuesday; admin sees all; leaderboard timing aligned with MNF completion.
- **Auditability:** Admin overrides, jailed tie-break randomness (seeded/logged), email send outcomes, and scoring adjustments.
- **Resilience:** Odds API failure path (manual admin correction), email retries, CSV export as operational escape hatch.
- **UX-loaded constraints:** Full mobile/desktop parity, persistent pick-status UI, countdown, WCAG A, rolling long-lived sessions, email as primary acquisition channel; UX adds **weather** and **admin-editable Tuesday email body** before send — both imply extra API surface and workflow state.

## Starter Template Evaluation

### Primary Technology Domain

**Full-stack web application** — Next.js and React with server-side APIs, scheduled or triggered jobs, and external integrations, consistent with the PRD and README.

### Technical Preferences (from README + PRD)

**`docs/project-context.md`** is the short implementer rule list (stack table, non-negotiables, JSON/DB naming) and defers to this document for full decisions. **README** documents high-level product direction:

- **Frontend:** Next.js / React with **Material-UI (MUI)** and a custom dark theme (emerald primary, gold accent, Inter).
- **Backend, database, email, odds, hosting:** summarized in README; detailed choices appear in this architecture document and `docs/project-context.md`.

BMAD config lists user skill level as **intermediate**.

### Starter Options Considered

| Option | Role | Notes |
|--------|------|--------|
| **Official `create-next-app@latest`** | Default Next.js scaffold | Actively maintained; interactive prompts for TypeScript, ESLint, Tailwind, App Router, Turbopack, etc. Aligns with PRD “Next.js best practices.” |
| **Vite + React (`npm create vite@latest`)** | SPA client bundler | Strong dev experience for a **client-only** app; Pick Six still needs a **server** for auth, odds proxying, deadlines, email, and scoring. That implies a **second** codebase or service unless you add a custom Node server — more glue than Next for this product shape. |
| **T3 Stack** | tRPC + Prisma opinionated stack | Strong end-to-end typing; adds opinions (Prisma, tRPC) not yet selected — revisit if those choices are confirmed. |
| **Manual / minimal** | Bare Next or empty repo | Maximum control; slower to standardize linting, structure, and conventions. |

### Why not Vite alone?

The PRD requires **server-authoritative** behavior (pick validation, deadlines, odds fetch/cache, email, scoring). A Vite scaffold is **frontend-first**; you would still need an API and deployment story. **Next.js** keeps UI and Route Handlers (or API routes) in **one** deployable app, which matches the documented stack and NFR53-style hosting. Vite remains a fit if you explicitly split **SPA + separate API**; that is a different architecture than the current PRD/README baseline.

### Selected Starter: create-next-app (official)

**Rationale for Selection:**

- Matches **Next.js + React** in PRD/README and single-deploy full-stack ergonomics.
- Defers **database, auth provider, and email** to explicit decisions rather than baking in T3 opinions.
- **MUI** is added after scaffold (README already commits to MUI; not the default `create-next-app` template).

**Initialization command (version resolves from `@latest` at run time):**

```bash
npx create-next-app@latest
```

Interactive prompts typically cover TypeScript, ESLint, Tailwind CSS, `src/` directory, App Router, import aliases, and (in current release lines) options such as React Compiler and **AGENTS.md**. For non-interactive or CI usage, follow the official CLI reference:

- [CLI: create-next-app](https://nextjs.org/docs/app/api-reference/cli/create-next-app)

**Architectural decisions provided by the starter (typical defaults):**

- **Language:** TypeScript (recommended default).
- **Styling:** Often Tailwind in the default template; **MUI** is layered on afterward (Emotion/cache setup as a follow-on task).
- **Build:** Next.js toolchain (Turbopack for dev per current defaults).
- **Structure:** App Router conventions under `app/` or `src/app/`, Route Handlers for HTTP APIs.
- **Quality:** ESLint baseline.

**Note:** Project initialization with this command should be the **first implementation story** when application source is added to the repository.

## Core Architectural Decisions

### Decision priority snapshot

| Priority | Area | Status |
|----------|------|--------|
| **Critical (blocks implementation)** | Data store, auth model, API surface, deployment target, scheduling strategy for weekly jobs | **Decided** (below) |
| **Important** | Validation library, error shape, UI stack (MUI), observability baseline | **Decided** |
| **Deferred (post-MVP or implementation-time)** | Exact odds/results providers, exact email provider, live scores, advanced analytics | Per PRD out-of-scope list |

### Constraints: max free tier (priority)

**Product owner goal:** stay on **$0 vendor tiers** as long as realistically possible for this league-sized app.

**Implications:**

- Prefer **self-hosted auth** (sessions in your app + Neon) over **paid IDaaS** (e.g. Clerk past free limits).
- Prefer **transactional email** providers with a **generous free tier** (e.g. Resend, SendGrid, Mailgun—compare current free limits at implementation time).
- **Odds and results APIs:** choose providers with a **free tier**, **trial**, or **low fixed cost**, or accept rare manual admin fallback (PRD already allows admin override when APIs fail).
- **Weather (UX):** use a **free-tier** weather API or static/optional display if quotas are tight.
- **Vercel Hobby + Neon free:** sufficient for MVP scale if usage stays within published limits; **monitor** usage dashboards and plan a paid jump only if limits bite.

**Caveat:** “Free forever” depends on vendor terms; re-check pricing when you ship and each season.

### Data architecture

| Decision | Choice | Rationale |
|----------|--------|-------------|
| **Database engine** | **PostgreSQL** | Relational model fits leagues, picks, weeks, audit logs, and transactional integrity (NFR28). |
| **Managed hosting** | **[Neon](https://neon.tech)** | Serverless Postgres, course familiarity, pairs with Vercel; **free tier** available for dev and modest production (limits on storage, compute hours, branches—confirm current [Neon pricing](https://neon.tech/pricing) when provisioning). |
| **App deployment** | **[Vercel](https://vercel.com)** (target) | Natural host for Next.js; **Hobby** is $0 for many personal projects with [documented limits](https://vercel.com/docs/plans/hobby) (bandwidth, invocations, build minutes). **Read current plan terms:** if the project is commercial or needs team billing, you may need Pro—decide against your actual use case. |
| **ORM / migrations** | **[Prisma](https://www.prisma.io)** | Schema-first migrations, generated types, **Prisma Studio** for inspecting data—reduces day-to-day SQL and ops load for a frontend-oriented developer. |
| **Connection strategy** | **Pooled / serverless-safe URL** | Neon exposes connection strings suited to serverless; pair with Prisma using Neon’s current recommended setup (connection pooling or `@neondatabase/serverless` + Prisma adapter—follow Neon + Prisma docs at implementation time). |

**Cost posture (explicit goal: max free tier — see Constraints above):**

- Start on **Neon free** + **Vercel Hobby** (if eligible) + **transactional email** and **odds API** vendors that offer free or low-volume tiers; treat paid upgrades as a conscious milestone (traffic, reliability, or compliance).
- Prize money handled **outside the app** (per PRD) does not require Stripe, which keeps payment scope and cost at zero.

**Deferred / decide at implementation:** exact Neon project sizing, whether to use Neon branching for preview DBs, backup expectations beyond vendor defaults.

### Authentication & security

| Decision | Choice | Rationale |
|----------|--------|-------------|
| **Auth framework** | **[Auth.js](https://authjs.dev)** (evolution of NextAuth.js) for Next.js App Router | Open source, no per-user fee; large community; fits Vercel deployment; supports Prisma adapter. |
| **Session strategy** | **Database sessions or JWT via Auth.js** (finalize during implementation) | PRD wants extended sessions (rolling ~30-day activity in UX); configure `maxAge` / update age to match; HTTP-only cookies (NFR11). |
| **Credential model** | **Email + password** (FR8–FR9) | Invitation flow: token in DB + email link to complete signup; passwords hashed with **bcrypt** or **argon2** (NFR10). |
| **Paid auth vendors** | **Not planned for MVP** (e.g. Clerk, Auth0 paid tiers) | Keeps max free-tier goal; more app code for invitations and password reset, acceptable at this scale. |
| **Authorization** | **Role checks in application layer** (league admin vs participant) backed by DB membership rows | Multi-tenant: enforce `leagueId` + membership on every mutation; admin override routes require admin role + audit log (FR28–FR34, NFR16–NFR18). |
| **API / mutation safety** | **CSRF** for cookie-based session mutations where applicable; **rate limiting** on auth endpoints (NFR12, NFR15) | Use Next.js **`src/proxy.ts`** (Next.js 16+; replaces the deprecated `middleware.ts` convention) or Route Handler wrappers; exact mechanism TBD in implementation (e.g. `@upstash/ratelimit` on free tier or Vercel-native patterns). |

**Explicitly out of scope for cost and PRD:** SSO for enterprises, social login **unless** added later as zero-cost (e.g. optional OAuth providers with Auth.js without new vendor fees).

**Deferred / decide at implementation:** password reset email flow, session storage adapter details (Prisma vs JWT-only tradeoffs for serverless cold starts), whether to add **magic-link** sign-in (still free if email provider is free).

### API & communication patterns

| Decision | Choice | Rationale |
|----------|--------|-------------|
| **Style** | **REST** over **Next.js Route Handlers** (`app/api/.../route.ts`) | Native to App Router; no extra GraphQL server; easy to secure with Auth.js session; Prisma in same process. |
| **Serialization** | **JSON** request/response bodies | Universal; FRs assume web client. |
| **Validation** | **[Zod](https://zod.dev)** (or similar) at API boundary | Shared types with TypeScript; reject bad input before DB; consistent error messages. |
| **Error shape** | **Structured JSON errors** (e.g. `{ code, message, details? }`) with appropriate **HTTP status** (4xx client, 5xx server) | NFR45–NFR47; predictable for UI and future mobile clients. |
| **Versioning** | **No `/v1` prefix for MVP** | Single client; add versioning if a public API appears later. |
| **Internal integration** | **Server-only** calls to odds/results/weather/email from Route Handlers or server actions; **never** expose API keys to the browser | Matches PRD server-side odds fetch and NFR13. |
| **Real-time** | **None for MVP** (no WebSockets) | PRD allows manual refresh; simplifies hosting and cost. |

**Deferred:** OpenAPI/Swagger generation (optional if you want documented endpoints for future agents).

### Frontend architecture

| Decision | Choice | Rationale |
|----------|--------|-------------|
| **UI library** | **MUI** (Material UI) with **Stack** for flex layouts (project convention) | README + UX spec; accessible primitives; consistent with user preference over ad-hoc `Box` layouts. |
| **Rendering** | **Next.js App Router** — default **React Server Components**; **`"use client"`** only where needed (forms, pick selection, timers, interactive widgets) | Keeps bundle smaller; aligns with PRD performance targets. |
| **State** | **Server-first:** load league/week data via server components or server actions; **minimal client global state** (React context or URL/search params only if needed) | PRD does not require Redux; avoids over-engineering. |
| **Forms** | **React Hook Form** + Zod resolver (optional but common MUI pairing) | Validation parity with API; good UX for auth and admin forms. |
| **Styling** | **MUI** theming (dark theme per UX spec); **CSS** for small overrides as needed | `create-next-app` may include Tailwind; **MUI remains source of truth** for layout/components—avoid mixing Tailwind and MUI for the same concerns unless you consciously standardize. |
| **Data fetching** | Server Components + **fetch** to internal API or direct Prisma in server layer; client-side **fetch** for mutations after submit | No separate BFF beyond Next itself. |

### Infrastructure & deployment

| Decision | Choice | Rationale |
|----------|--------|-------------|
| **Hosting** | **Vercel** for Next.js (Hobby when eligible) | Already selected; zero-config deploys; edge/runtime docs match stack. |
| **Database** | **Neon** Postgres (see Data architecture) | Already selected. |
| **Background / scheduled work** | **Vercel Cron** invoking **Route Handlers** (e.g. `/api/cron/weekly-emails`) that enqueue or run jobs | PRD requires Tuesday 6:00 PM and Wed/Thu reminders; **no extra paid scheduler** required. |
| **Vercel Cron on Hobby (free tier)** | Per [Vercel Cron usage](https://vercel.com/docs/cron-jobs/usage-and-pricing): Hobby allows **many** cron jobs but each job **at most once per day**; **hourly** or sub-minute schedules **require Pro**. Scheduling has **±1 hour** precision on Hobby. | **Design:** use **one cron per calendar day-of-week** you need (e.g. Tuesday 6 PM ET, Wednesday evening, Thursday 1h before deadline) expressed in **UTC** in `vercel.json`, and implement **idempotent** job handlers (safe if run twice). **If** precise Tuesday 6:00 PM ET is violated by drift, **mitigate** with: (a) run a **daily** cron that checks “is it time in `America/New_York`?” and sends, or (b) **external free cron** (e.g. cron-job.org) `POST` to a **secret-protected** API route, or (c) upgrade Vercel Pro for tighter schedules—only if needed. |
| **Secrets** | **Vercel environment variables** for `DATABASE_URL`, Auth.js `AUTH_SECRET`, API keys, cron **CRON_SECRET** | Standard practice; never commit secrets. |
| **CI/CD** | **Vercel Git integration** (push to main → preview/production) | Free tier; optional GitHub Actions later for lint/test. |
| **Observability** | **Vercel logs** + structured `console`/JSON logging in Route Handlers (NFR45) | Start free; add Axiom/Datadog only if needed. |

### Decision impact analysis

**Implementation sequence (suggested):**

1. `create-next-app` + MUI + Prisma + Neon + `DATABASE_URL`.
2. Prisma schema for users, leagues, memberships, seasons, weeks, picks, audit.
3. Auth.js + email/password + sessions.
4. Core participant UI (picks, standings) and admin dashboard.
5. Integrations: odds/schedule/results (server-only), email provider.
6. Cron + email jobs + deadline/scoring logic + CSV export.

**Cross-component dependencies:**

- **Cron → email** requires transactional email provider and templates stored or coded in repo.
- **Scoring** depends on **game results** integration and **week** boundaries.
- **Pick privacy until Tuesday** is enforced in **queries** (role-based) and must **not** leak via client props or cached RSC for wrong users.

**Deferred (cost or scope):**

- Vercel Pro (only if Hobby cron precision or limits block production).
- Paid odds API or **manual admin** odds/jailed override per PRD risk section.

## Implementation Patterns & Consistency Rules

### Pattern categories defined

**Critical conflict points addressed:** naming (DB, REST, TypeScript), folder layout, API JSON shape, dates/timezones, auth checks, Prisma usage boundaries, MUI vs Tailwind, errors/logging, and test file placement—areas where different agents often diverge without shared rules.

### Naming patterns

**Database (Prisma / PostgreSQL):**

- **Tables:** `snake_case`, **plural** nouns — `users`, `leagues`, `league_memberships`, `picks`, `audit_log_entries`.
- **Columns:** `snake_case` — `user_id`, `league_id`, `created_at`, `picked_team_id`.
- **Primary keys:** prefer `id` as `cuid()` or `uuid()` per Prisma schema; document one approach and stick to it.
- **Foreign keys:** `{table_singular}_id` — `league_id`, `user_id`.
- **Indexes:** `idx_{table}_{columns}` — e.g. `idx_picks_league_id_week`.

**REST / Route Handlers:**

- **URLs:** **plural** resource segments, **kebab-case** multi-word segments — `/api/leagues`, `/api/leagues/[leagueId]/picks`, `/api/cron/weekly-emails`.
- **Route params:** Next.js dynamic segments `[leagueId]`, `[weekNumber]` — **camelCase** in folder names for multi-word if needed: `[weekId]` not `[week_id]`.
- **Query params:** **camelCase** in URLs — `?seasonYear=2026` (matches JSON convention below).

**TypeScript / React code:**

- **Components:** **PascalCase** — `PickSubmissionForm.tsx`.
- **Files:** match default export name — `PickSubmissionForm.tsx`.
- **Functions/variables:** **camelCase** — `getCurrentWeek`, `leagueId`.
- **Constants:** **SCREAMING_SNAKE** only for true constants — `MAX_PARTICIPANTS`.
- **Hooks:** `use` prefix — `usePickDeadline`.

### Structure patterns

**Project organization (Next.js App Router):**

- **`src/app/`** — routes, layouts, `page.tsx`, Route Handlers under `src/app/api/.../route.ts`.
- **`src/components/`** — shared UI; subfolders by domain optional: `components/picks/`, `components/admin/`.
- **`src/lib/`** — framework-agnostic helpers: `lib/db.ts` (Prisma singleton), `lib/auth.ts`, `lib/validation/`, `lib/nfl/` (odds/schedule adapters).
- **`prisma/`** — `schema.prisma`, migrations.
- **`src/types/`** — shared TypeScript types only when not inferrable from Prisma/Zod.
- **Tests:** **co-located** `*.test.ts` / `*.test.tsx` next to source, or `__tests__/` next to feature—pick **one**; default recommendation: **`__tests__` colocated** under `src/lib/**` and `src/components/**` for unit tests; e2e later in `e2e/` or `tests/e2e/`.

**Forbidden ambiguity:**

- Do **not** create a second `utils/` at root and also `lib/utils`—use **`src/lib`** only.

### Format patterns

**API JSON (REST):**

- **Request/response field names:** **camelCase** in JSON (TypeScript ecosystem default).
- **Success:** return the resource directly or `{ "data": ... }` — **pick one**; recommendation: **direct body** for simple resources, e.g. `GET /api/leagues/[id]` → `{ "id", "name", ... }`; use `{ "data": T }` only if you need pagination wrapper `{ "data": [], "nextCursor" }`.
- **Errors:** consistent shape:

```json
{ "error": { "code": "PICK_DEADLINE_PASSED", "message": "Human-readable message" } }
```

- **HTTP status:** 400 validation, 401 unauthenticated, 403 forbidden (e.g. not league member), 404 not found, 409 conflict (e.g. duplicate pick), 500 unexpected.

**Dates and times:**

- **Store in DB:** **UTC** as `timestamptz` (PostgreSQL).
- **Serialize in JSON:** **ISO 8601** strings — `2026-09-10T22:00:00.000Z`.
- **League-facing rules:** compute display and “deadline” logic in **`America/New_York`** (or configurable per league later); never rely on the client’s local TZ for enforcement.

**Prisma in handlers:**

- Use a **single** exported Prisma client from `src/lib/db.ts` (avoid instantiating `PrismaClient` per request in dev hot reload—use global singleton pattern from Prisma docs).

### Communication patterns

**Events:** No generic event bus for MVP. If you add **domain events** later (e.g. `PickSubmitted`), name them **past tense PascalCase** — `PickSubmitted`.

**Client state:** Prefer **URL state** for week selection (`?week=3`) where possible; use **React context** sparingly for session-scoped UI (e.g. toast provider).

### Process patterns

**Error handling:**

- **Route Handlers:** wrap async logic; map known domain errors to 4xx/409; log unknown errors with request id; never return stack traces to clients.
- **UI:** show MUI `Alert` or snackbar from a single `error.message` or translated `code`.

**Loading:**

- Server Components: use **`loading.tsx`** and Suspense where appropriate.
- Client: **MUI `Skeleton`** or linear progress; name flags `isLoading`, `isSubmitting`.

**Auth:**

- Every mutation that touches a league must **resolve session**, then **load membership + role** and assert **leagueId** matches; admin overrides log to **audit** table in same transaction as pick update.

### Enforcement guidelines

**All AI agents MUST:**

- Use **camelCase** JSON and **snake_case** DB columns via Prisma field mapping if needed (`@map`).
- Put **secret keys and cron endpoints** only in server code or env—never `NEXT_PUBLIC_` except truly public values.
- Use **Stack** (MUI) for flex layouts unless a single `Box` is clearly sufficient—per project UI convention.
- Enforce **pick visibility** in server queries (participants see own pick anytime; others only after Tuesday reveal per FR48–FR49).

**Pattern enforcement:**

- **ESLint + TypeScript** strict mode; run in CI when added.
- **Code review / agent review:** grep for `PrismaClient` outside `lib/db`, and for `NEXT_PUBLIC` on API keys.

### Pattern examples

**Good:**

- `POST /api/leagues/:leagueId/picks` with body `{ "teamId": "...", "pickAgainstJailed": false }` validated by Zod.
- `audit_log_entries` row written when admin overrides a pick.

**Anti-patterns:**

- Returning different error JSON shapes in different routes.
- Passing opponent picks to client components for non-admin users before reveal.
- Using **local machine timezone** in `new Date()` for deadline comparison on the server.

## Project Structure & Boundaries

### Complete project directory structure (target)

Repository root after `create-next-app` + app features (illustrative; file names may vary slightly as implementation lands):

```
pick-six/
├── README.md
├── package.json
├── package-lock.json / pnpm-lock.yaml
├── next.config.ts
├── tsconfig.json
├── eslint.config.mjs
├── .env.example
├── .env.local                    # gitignored — secrets
├── .gitignore
├── vercel.json                   # cron schedules → /api/cron/*
├── public/
│   └── assets/                   # static images, favicon
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── signup/[token]/page.tsx
│   │   ├── (app)/                # authenticated shell
│   │   │   ├── layout.tsx
│   │   │   ├── leagues/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [leagueId]/
│   │   │   │       ├── layout.tsx
│   │   │   │       ├── picks/page.tsx
│   │   │   │       ├── standings/page.tsx
│   │   │   │       ├── rules/page.tsx
│   │   │   │       └── admin/page.tsx
│   │   │   └── settings/page.tsx
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── cron/
│   │       │   ├── tuesday-email/route.ts
│   │       │   ├── reminder-midweek/route.ts
│   │       │   └── reminder-deadline/route.ts
│   │       └── leagues/
│   │           └── [leagueId]/
│   │               ├── picks/route.ts
│   │               ├── export/route.ts
│   │               └── admin/
│   │                   └── override/route.ts
│   ├── components/
│   │   ├── layout/
│   │   ├── picks/
│   │   ├── standings/
│   │   ├── admin/
│   │   └── common/
│   ├── lib/
│   │   ├── db.ts
│   │   ├── auth.ts
│   │   ├── league-context.ts     # server helpers: requireMember, requireAdmin
│   │   ├── validation/
│   │   ├── email/
│   │   ├── integrations/
│   │   │   ├── odds/
│   │   │   ├── results/
│   │   │   └── weather/
│   │   └── domain/
│   │       ├── picks.ts          # pure: validate pick, deadline math
│   │       ├── jailed.ts
│   │       └── scoring.ts
│   ├── proxy.ts                  # Next.js request boundary (auth rate limit, etc.; replaces middleware.ts in Next 16+)
│   └── types/
├── e2e/                          # optional — Playwright later
└── _bmad-output/                 # existing planning artifacts (repo root)
```

`_bmad/` and `_bmad-output/` remain as today; application code lives under **`src/`** once the Next app is generated.

### Architectural boundaries

**API boundaries:**

- **External:** Odds, game results, weather, transactional email — only from **`src/lib/integrations/*`** or Route Handlers calling those modules; **no** direct fetch from client components to those providers.
- **Internal REST:** `/api/leagues/...` for mutations and reads that must not be RSC-cached; align with **Auth.js** session in Route Handlers.
- **Cron:** `/api/cron/*` — **must** verify `CRON_SECRET` header or Vercel cron signature per docs; **no** public unauthenticated cron.

**Component boundaries:**

- **`(app)`** routes consume data via server components or server actions; **client** components only under `components/` for interactivity.
- **Admin** pages live under same league route with **role gate** in layout or page (redirect if not admin).

**Data boundaries:**

- **Prisma** is the **only** persistence API in application code (no raw SQL except rare migrations/RPC).
- **Domain logic** (`lib/domain/*`) stays **pure** where possible (unit-testable); Route Handlers orchestrate I/O + call domain functions.

### Requirements to structure mapping (FR categories)

| FR area | Primary location |
|---------|------------------|
| League management (FR1–FR7, FR61) | `app/(app)/leagues/`, `app/api/leagues/` (including **admin-only** `DELETE` or equivalent for **FR61**), Prisma models `League`, `Season` |
| Auth (FR8–FR13) | `app/(auth)/`, `app/api/auth/`, `lib/auth.ts`, Auth.js config |
| Picks (FR14–FR27) | `app/(app)/leagues/[leagueId]/picks/`, `app/api/leagues/[leagueId]/picks/`, `lib/domain/picks.ts` |
| Admin overrides (FR28–FR34) | `app/(app)/leagues/[leagueId]/admin/`, `app/api/.../admin/`, `audit_log_entries` |
| Email (FR35–FR40) | `lib/email/`, cron routes, templates as TSX or HTML strings |
| Scoring & leaderboard (FR41–FR49) | `lib/domain/scoring.ts`, cron/scheduled jobs, `standings/page.tsx` |
| Jailed & rules (FR50–FR54) | `lib/domain/jailed.ts`, Prisma `Week` snapshot fields |
| Export & season (FR55–FR60) | `app/api/leagues/[leagueId]/export/route.ts` |

### Integration points

- **Browser → Next:** RSC pages and client components; **mutations** → Route Handlers or Server Actions with Zod.
- **Next → Neon:** Prisma via `lib/db.ts`.
- **Next → email provider:** `lib/email/send.ts`.
- **Cron → internal logic:** invoke same services as manual admin actions where possible (single code path).

### Development workflow

- **Local:** `pnpm dev` / `npm run dev`; `.env.local` with Neon dev branch connection string.
- **Deploy:** Vercel build; env vars set in dashboard; Prisma `migrate deploy` in build command or CI step (document in README when implementation starts).

## Architecture Validation Results

### Coherence validation

**Decision compatibility:** Stack is coherent: Next.js App Router + Route Handlers + Prisma + Neon + Vercel + Auth.js is a common, documented combination. **Max free tier** constrains cron precision (Hobby) and may require the documented mitigations (daily dispatcher, external ping, or Pro later)—not a conflict, an explicit tradeoff.

**Pattern consistency:** Naming (camelCase JSON, snake_case DB), error shape, and MUI **Stack** conventions align with core decisions. Prisma singleton and server-only integrations match security NFRs.

**Structure alignment:** Directory tree maps FR categories to `app/`, `app/api/`, and `lib/domain/*`; cron and export routes have explicit homes.

### Requirements coverage validation

**Functional requirements:** All **8 FR categories** are mapped to components in **Requirements to structure mapping**. No FR category lacks a home; invitation and admin-override flows are covered by auth + API + audit.

**Non-functional requirements:** Performance (RSC + client boundaries), security (Auth.js, CSRF/rate limit notes, HTTPS via Vercel), reliability (retries/deferred to providers), accessibility (WCAG A via MUI + patterns), and operations (logging, migrations, CSV export) are addressed architecturally. **NFR20** (100% uptime in critical windows) is an **operational** target—monitoring and provider SLAs matter beyond code structure.

### Implementation readiness validation

**Decision completeness:** Critical choices (data, auth, API, UI, hosting, cron strategy) are documented. **Implementation-time** picks remain: exact odds/results/email vendors, Prisma ID strategy (`cuid` vs `uuid`), Auth.js session adapter details, and `vercel.json` cron expressions in UTC.

**Gap analysis (non-blocking):**

| Priority | Gap | Mitigation |
|----------|-----|------------|
| Important | **Auth.js v5** route path and session API differ slightly from older NextAuth docs | Follow official Auth.js docs at implementation; adjust `app/api/auth/...` path in tree if needed. |
| Important | **Vercel Hobby cron** ±1h precision | Daily “check window” job or external cron + `CRON_SECRET` as documented. |
| Nice | OpenAPI spec | Not required for MVP; add if multiple clients appear. |

### Architecture readiness assessment

**Overall status:** **READY FOR IMPLEMENTATION** (with known vendor choices to finalize during build).

**Confidence:** **Medium–high** — strong fit to PRD; largest execution risks are **third-party APIs** and **scheduler precision**, both called out with mitigations.

**Strengths:** Clear boundaries, frontend-friendly data layer (Prisma), explicit multi-tenant and privacy rules, cost-aware hosting.

**Future enhancement:** Configurable rule engine, multi-league admin UX at scale, live scores (post-MVP per PRD).

## Architecture Completion Summary

### Workflow completion

**Architecture decision workflow:** COMPLETED.

**Date completed:** 2026-04-04.

**Document:** `_bmad-output/planning-artifacts/architecture.md`

### Final deliverables

- **Decision record:** Context, starter, data, auth, API, frontend, infrastructure, constraints (max free tier).
- **Consistency rules:** Naming, formats, errors, dates, enforcement.
- **Structure:** Target tree and FR → directory mapping.
- **Validation:** Coherence, coverage, gaps, readiness.

### Implementation handoff

**For AI agents:** Implement against this document; prefer existing patterns over new ones when in doubt.

**First implementation priority:**

```bash
npx create-next-app@latest
```

Then: add Prisma + Neon `DATABASE_URL`, MUI, Auth.js, and domain modules per **Project Structure & Boundaries**.

**Development sequence:**

1. Initialize Next app and shared tooling (lint, TS strict).
2. Prisma schema + migrations + `lib/db.ts`.
3. Auth.js + invitation/signup paths.
4. League and pick flows (participant + admin).
5. Integrations (odds, results, email) and cron jobs.
6. Scoring, CSV export, hardening.

**Document maintenance:** Update this architecture when major technical decisions change (e.g. new auth provider, move off Vercel Hobby).

---

**Architecture status:** READY FOR IMPLEMENTATION.

**Next BMM phase:** `implementation-readiness` (epics: **`_bmad-output/planning-artifacts/epics.md`**).
