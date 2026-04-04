---
project_name: pick-six
user_name: Kyle
date: '2026-04-04'
source_of_truth: '_bmad-output/planning-artifacts/architecture.md'
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
- Prefer co-located tests (`*.test.ts` or `__tests__/`) as in architecture doc once testing is added.

## Docs and planning

Product requirements: **`_bmad-output/planning-artifacts/prd.md`**. UX: **`_bmad-output/planning-artifacts/ux-design-specification.md`**. Architecture decisions: **`_bmad-output/planning-artifacts/architecture.md`**.

When in doubt, align with the architecture doc and PRD — do not introduce a second pattern.
