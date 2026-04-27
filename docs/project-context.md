---
project_name: pick-six
user_name: Kyle
date: '2026-04-04'
source_of_truth: '_bmad-output/planning-artifacts/architecture.md'
epics_and_stories: '_bmad-output/planning-artifacts/epics.md'
---

# Project context for AI agents

Read **`_bmad-output/planning-artifacts/architecture.md`** for full decisions. This file is the **short list** of rules that are easy to get wrong.

## Stack (target)

| Layer | Choice |
|-------|--------|
| Framework | Next.js (App Router), TypeScript |
| UI | **MUI** — use **`Stack`** for flex layouts (not `Box`) unless a single `Box` is clearly enough |
| Data | **PostgreSQL** on **Neon**, **Prisma** (migrations, `schema.prisma`) |
| Auth | **Auth.js** — sessions/credentials per architecture doc |
| API | **Route Handlers** under `src/app/api/**/route.ts`, **Zod** on inputs |
| Host | **Vercel** (Hobby when eligible); **max free tier** is a product goal |

Pin versions in `package.json` at implementation time; do not invent version numbers here.

## Non-negotiables

1. **Secrets and integrations stay server-only.** No API keys, odds keys, email keys, or `CRON_SECRET` in client components or `NEXT_PUBLIC_*` (except values that are truly public).

2. **One Prisma client.** Export a singleton from `src/lib/db.ts` (or equivalent); do not `new PrismaClient()` all over the codebase.

3. **League rules and deadlines are server-authoritative.** Compare deadlines using **UTC** in storage and **America/New_York** (or documented league TZ) for business rules — never the user’s local machine timezone on the server.

4. **Pick visibility (FR48–FR49).** Participants must not see other participants’ picks until the Tuesday standings reveal; **admins** can see all. Enforce in **queries and server-rendered data**, not only in the UI.

5. **Admin overrides and jailed/random tie-breaks are audited.** Mutations that change picks or scores log to the audit trail (see PRD).

6. **JSON and DB naming:** **camelCase** in API JSON; **snake_case** table/column names in PostgreSQL / Prisma (`@map` when needed).

7. **Errors:** Use a consistent JSON shape, e.g. `{ "error": { "code": "SOME_CODE", "message": "…" } }`, with appropriate HTTP status (400/401/403/404/409/500).

8. **League season start is not always Week 1.** Persist **first NFL competition week** (1–18) on league/season when configured at creation (`epics.md` Story 2.7). Schedule, “current week,” picks, and scoring must respect it—never assume every league starts at Week 1.

9. **Sensitive routes: rate limit in `src/proxy.ts`.** Sign-in and selected league **POST** paths use the sliding-window helper in `src/lib/rate-limit.ts` — including **`POST /api/leagues/[leagueId]/picks`** (Story 3.4); **`DELETE /api/leagues/[leagueId]`** (league delete, FR61) is limited separately (**5 / 15 min** per client key). Add new patterns there when introducing high-risk mutators. **Production / multi-instance:** buckets are in-memory per instance until a shared store (e.g. Redis) is wired (see `rate-limit.ts`).

## Planning supplements (see `epics.md`)

Detailed **user stories and acceptance criteria** live in **`_bmad-output/planning-artifacts/epics.md`**. It extends PRD scope with: **mid-season league start** (Story 2.7), **pre-season Week 1 odds/weather preview** for API validation (Stories 3.1–3.2, 3.6), **real team logos** (Story 3.8), **admin delete production league** (**FR61**, Story 2.8), **test/rehearsal leagues** and deletion (Epic 8), and **simulation mode** for pre-season dry runs. Prefer epics for implementation ordering; keep PRD FRs/NFRs as the requirement baseline.

## Cron / scheduling (Vercel Hobby)

Hobby cron is **limited** (at most once per day per job; imprecise timing). Handlers must be **idempotent**. Prefer the patterns in the architecture doc (per-weekday UTC crons, **daily** “is it time in Eastern?” job, or external free cron + shared secret). Do not assume sub-minute or hourly Vercel cron on Hobby.

## What not to build (MVP)

- No WebSockets / live push for core flows (manual refresh is OK).
- No paid auth vendors (Clerk, etc.) unless explicitly decided later.
- No configurable rule engine (rules are hardcoded for MVP per PRD).

## File organization (when `src/` exists)

- **`src/app/`** — routes, layouts, `page.tsx`, API `route.ts`
- **`src/components/`** — UI by area (`picks/`, `admin/`, …)
- **`src/lib/`** — `db.ts`, auth helpers, `integrations/`, **`domain/`** (pure logic: picks, jailed, scoring)
- **`prisma/`** — schema and migrations

Keep domain logic in **`lib/domain`** testable; Route Handlers orchestrate I/O.

## Testing / quality

- TypeScript **strict** when enabled; ESLint clean for new code.
- **Vitest:** `npm test` (watch: `npm run test:watch`). Prefer co-located `*.test.ts` / `*.test.tsx` (or `__tests__/`) per architecture doc — especially for `lib/domain` and pure helpers.

## Docs and planning

Product requirements: **`_bmad-output/planning-artifacts/prd.md`**. UX: **`_bmad-output/planning-artifacts/ux-design-specification.md`**. Architecture decisions: **`_bmad-output/planning-artifacts/architecture.md`**. **Epics and stories:** **`_bmad-output/planning-artifacts/epics.md`**.

When in doubt, align with the architecture doc and PRD — do not introduce a second pattern. For story-level scope and ordering, use **`epics.md`**.

**NFL schedule + odds:** Provider and mapping choices are recorded in **`docs/nfl-odds-integration.md`** (The Odds API for moneyline/spread snapshots; `NflGame` schedule remains seed/JSON until a follow-up). See **`epics.md`** Story 3.2 for acceptance criteria.
