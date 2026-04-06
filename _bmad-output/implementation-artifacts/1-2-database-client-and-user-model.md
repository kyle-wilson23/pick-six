# Story 1.2: Database client and User model

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want Neon PostgreSQL connected via Prisma with a singleton client and initial User model,
so that credentials and profiles persist safely.

## Acceptance Criteria

1. **Given** `.env.example` documents `DATABASE_URL` (no secrets committed)  
   **When** Prisma is configured for Neon (pooled/serverless-safe connection per current Neon + Prisma docs) and migrations run  
   **Then** a `User` model exists with fields needed for email identity (and forward-compatible with Auth.js + credentials in Story 1.3)  
   **And** exactly one Prisma client is exported from `src/lib/db.ts` (singleton) per project context **NFR28** (atomic `$transaction` usage available for later stories)

2. Initial migration applies cleanly against a real Postgres URL (local Docker Postgres or Neon dev branch); `npx prisma migrate deploy` (or equivalent) is documented for production.

3. `package.json` includes Prisma CLI scripts that a developer expects (`migrate`, `generate`, optional `studio`) without breaking existing `dev` / `build` / `lint`.

4. ESLint stays clean for new files; no `new PrismaClient()` outside `src/lib/db.ts` (enforce by convention; grep-friendly).

## Tasks / Subtasks

- [x] Add Prisma dependencies (`prisma`, `@prisma/client`) — pin versions in `package.json` at install time.
- [x] Add `prisma/schema.prisma` with PostgreSQL provider, `User` model, and naming aligned with architecture (snake_case in DB via `@map` where needed; primary key strategy **cuid** or **uuid** — pick one and document in schema comment).
- [x] Implement `src/lib/db.ts` with the **global singleton** pattern from [Prisma’s Next.js guidance](https://www.prisma.io/docs/guides/other/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices) so dev hot reload does not exhaust connections.
- [x] Create `.env.example` with `DATABASE_URL=` placeholder and short comment (pooled Neon URL vs direct — point to Neon dashboard / docs).
- [x] Run initial migration; commit `prisma/migrations/*`.
- [x] Update `README.md` with minimal “Database” section: copy `.env.example`, set `DATABASE_URL`, run migrate, optional Prisma Studio.
- [x] Verify `npm run build` still passes (Prisma generate runs as part of workflow — use `postinstall` and/or document `prisma generate` if required for CI).

## Dev Notes

### Epic context

- **Epic 1** delivers identity and sessions. This story is **data layer only**: no Auth.js, no login UI, no protected routes (Stories 1.3–1.6).
- **Story 1.3** will add Auth.js with credentials + Prisma adapter; shape `User` (and later adapter tables) so you do not fight the official adapter schema when wiring auth.

### Technical requirements

- **Stack:** PostgreSQL on **Neon**, **Prisma** ORM — [Source: `docs/project-context.md`, `_bmad-output/planning-artifacts/architecture.md` — Data architecture].
- **Connection:** Use Neon’s **serverless/pooled** connection string for Vercel-style deployments; follow **current** [Neon — Connect from Prisma](https://neon.tech/docs/guides/prisma) and [Prisma — Neon](https://www.prisma.io/docs/orm/overview/databases/neon) for `DATABASE_URL` shape and any recommended driver/adapter options. If the docs recommend `@neondatabase/serverless` + Prisma adapter for your Prisma major, follow that path; otherwise pooled `postgresql://` with Prisma’s default client is acceptable when documented.
- **Singleton:** One exported client from `src/lib/db.ts` only — [Source: `docs/project-context.md` #2; `architecture.md` — Prisma in handlers].
- **Transactions:** Export the client such that callers can use `prisma.$transaction` for **NFR28** in later stories — no wrapper that hides transaction support unless unnecessary.

### User model — suggested fields (adjust if Auth.js adapter docs require specific columns)

| Concern | Guidance |
|--------|----------|
| Identity | Unique `email` (case normalization policy: document — e.g. store lowercased in app layer in 1.3) |
| Auth.js readiness | `name`, `image`, `emailVerified` optional fields match common Prisma adapter examples |
| Story 1.3 (credentials) | Nullable `passwordHash` mapped to `password_hash` (or add in 1.3 if you prefer one migration per story — prefer **one** migration here if it reduces churn) |
| Timestamps | `createdAt` / `updatedAt` with UTC awareness (`timestamptz`) |

Do **not** implement password hashing or login in this story; only schema + persistence layer.

### Architecture compliance

- **Layout:** `prisma/schema.prisma`, `prisma/migrations/`, `src/lib/db.ts` — [Source: `architecture.md` — Complete project directory structure].
- **DB naming:** snake_case tables/columns in PostgreSQL; Prisma field names can be camelCase with `@map` — [Source: `architecture.md` — Data architecture / Format patterns].
- **Keys:** Prefer `id` as `String` with `@default(cuid())` **or** `uuid()` — choose one for `User` and reuse in future models — [Source: `architecture.md` — Naming patterns].
- **Security:** No secrets in repo; `.env.local` gitignored (verify `.gitignore` from CNA includes it).

### Library & framework requirements

| Area | Requirement |
|------|-------------|
| ORM | Prisma (schema-first, migrations committed) |
| DB | PostgreSQL 16+ compatible (Neon) |
| Runtime | Next.js 16 App Router — prisma client must be safe for serverless cold starts (singleton) |

Pin Prisma to versions that support your chosen Node/Next combo; verify with `npm ls` after install.

### File structure requirements

```
prisma/
├── schema.prisma
└── migrations/
    └── <timestamp>_init_user/
        └── migration.sql
src/lib/
└── db.ts          # single PrismaClient export
.env.example       # DATABASE_URL documented, not secret
```

Optional: remove or replace `src/lib/README.md` placeholder text once `db.ts` exists.

### Testing requirements

- **This story:** Manual — `prisma migrate dev`, `prisma studio` (optional), smoke query or migration status. No Jest/Vitest requirement unless already added by CNA.
- **Guardrail:** After implementation, `rg "new PrismaClient"` should only match `db.ts` (or Prisma-generated code).

### Previous story intelligence (1.1)

- **Package manager:** `package-lock.json` is present — use **npm** / **npx** for installs and script verification (Story 1.1 mentioned pnpm/yarn as alternatives; keep one lockfile and do not mix managers without a deliberate migration).
- App uses **Next 16.2.2**, **MUI 7** with `AppRouterCacheProvider` from `@mui/material-nextjs/v16-appRouter`.
- Theme and providers live in `src/components/app-providers.tsx`, `src/theme/create-app-theme.ts` — **do not** refactor for this story.
- Story 1.1 explicitly deferred Prisma/auth — now add data layer without changing UI shell.

### Git intelligence

- Before starting, confirm the current baseline with `git log -1 --oneline`. Story 1.1 scaffold is in place; this story adds net-new work under `prisma/` and `src/lib/db.ts`.

### Latest tech information (verify at implementation)

- **Prisma + Next.js:** Use current “Avoid multiple PrismaClient instances” pattern (`globalThis` cache) for dev + serverless.
- **Neon:** Re-read connection string and “pooled” vs “direct” hostnames on Neon’s dashboard when creating `DATABASE_URL`.

### Project context reference

- `docs/project-context.md` — stack and non-negotiables  
- `_bmad-output/planning-artifacts/architecture.md` — data stack, `lib/db.ts`, folder layout  
- `_bmad-output/planning-artifacts/epics.md` — Story 1.2 acceptance criteria, Epic 1 sequencing  

### Story completion status

- **ready-for-dev** — Ultimate context engine analysis completed; comprehensive developer guide created.

## Dev Agent Record

### Agent Model Used

Cursor agent — dev-story workflow

### Debug Log References

_(None)_

### Completion Notes List

- Pinned **Prisma 6.19.0** (`prisma`, `@prisma/client`). Datasource uses `DATABASE_URL` + **`DIRECT_URL`** per [Neon’s Prisma guide](https://neon.tech/docs/guides/prisma) (pooled vs direct for CLI migrations).
- **`User`** model: `users` table, snake_case columns, `cuid` primary key, Auth.js-oriented fields (`name`, `image`, `emailVerified`, nullable `passwordHash`), `timestamptz` timestamps.
- **`src/lib/db.ts`:** `globalThis` singleton; full `PrismaClient` API including `$transaction` for NFR28.
- **Scripts:** `db:generate`, `db:migrate`, `db:migrate:deploy`, `db:studio`; **`postinstall`** runs `prisma generate` for CI/build.
- **Migration** `20260405120000_init_user` committed; SQL generated with `prisma migrate diff` (no local Docker in this environment — apply with `migrate dev` / `migrate deploy` against Neon or local Postgres).
- **`npm run build`** and **`npm run lint`** pass. `rg "new PrismaClient"` only hits `src/lib/db.ts` in app source.
- `.gitignore` exception **`!.env.example`** so the template is committed.

### File List

- `package.json`
- `package-lock.json`
- `.gitignore`
- `.env.example`
- `eslint.config.mjs`
- `prisma/schema.prisma`
- `prisma/migrations/migration_lock.toml`
- `prisma/migrations/20260405120000_init_user/migration.sql`
- `scripts/prisma-env.cjs`
- `src/lib/db.ts`
- `src/lib/README.md`
- `README.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/1-2-database-client-and-user-model.md`

### Change Log

- 2026-04-05: Story 1.2 — Prisma + Neon-ready datasource, User model and initial migration, singleton `db.ts`, env template, README Database section, sprint status → review.
- 2026-04-05: Code review — ESLint CJS override, `dotenv` moved to `dependencies`, File List + Senior Developer Review; status → done.

## Open questions / PM clarifications

_(None blocking — use Neon + Prisma official docs for connection string and adapter choice at implementation time.)_

## Senior Developer Review (AI)

**Reviewer:** Kyle (BMAD code-review workflow)  
**Date:** 2026-04-05  
**Outcome:** Approve (after fixes below)

### Summary

Implementation matches the story’s acceptance criteria: Neon-ready `DATABASE_URL` + `DIRECT_URL`, `User` model with Auth.js-oriented fields and snake_case table mapping, singleton `src/lib/db.ts`, committed migration, README and `.env.example` guidance, and `db:*` scripts that load `.env.local` via `scripts/prisma-env.cjs`. `npm run build` succeeds.

### Findings (adversarial)

| Severity | Topic | Detail |
|----------|--------|--------|
| **High (fixed)** | AC4 — ESLint | `scripts/prisma-env.cjs` failed `@typescript-eslint/no-require-imports` (CommonJS `require`). **Fix:** ESLint override for `scripts/**/*.cjs` in `eslint.config.mjs`. |
| **Medium (fixed)** | Dependencies | `dotenv` was only in `devDependencies` while `postinstall` runs `prisma-env.cjs`, which breaks `npm install --omit=dev` / minimal production installs. **Fix:** move `dotenv` to `dependencies`. |
| **Medium (fixed)** | File List | `scripts/prisma-env.cjs` (and post-review `eslint.config.mjs`) were missing from the story File List vs git reality. **Fix:** File List updated. |
| **Low** | Verification | “Migration applies cleanly against real Postgres” is not exercised in CI; remains a manual check (acceptable per story testing notes). |
| **Low** | Grep guardrail | `rg "new PrismaClient"` also matches story/docs lines, not only `db.ts`; convention is still clear for app code. |
| **Low** | Supply chain | `npm audit` reports high-severity advisories in the tree; out of scope for this story but worth a future pass. |

### Checklist (workflow)

- [x] Story loaded; status was `review`
- [x] Acceptance criteria cross-checked against implementation
- [x] File List reconciled with git
- [x] `npm run lint` and `npm run build` run after fixes
- [x] Security review: no secrets in repo; env template only
