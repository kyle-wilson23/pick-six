# Review — versions and reality checks

- **Artifact:** `ARCHITECTURE-SPINE.md` (AI weekly results commentary, updated 2026-11-08)
- **Lens:** Every committed version and named technology was checked against the web, this repo, or a live starter — not asserted from memory. Greenfield starter defaults apply only if the spine leans on a starter.
- **Reviewed:** 2026-11-08
- **Verdict:** Pass with findings

The stack table is a brownfield snapshot. Next.js, React, Zod, and the Prisma client/CLI match `package.json` and `package-lock.json`. The new `ai` pin matches the npm registry today. Two rows were copied from dependency-range floors and were not checked against the lockfile resolution.

`node_modules` is not present, so “installed” means the versions `package-lock.json` resolves. Those resolutions satisfy the ranges in `package.json`. This review did not re-fetch Next, React, Prisma, Zod, or MUI from the registry. The only registry check was `ai`, which is not in the repo yet.

## Stack check

| Spine | `package.json` | Lockfile resolution | Result |
| --- | --- | --- | --- |
| Next.js 16.2.2 | `next` `16.2.2` (exact); `eslint-config-next` `16.2.2` | `next` 16.2.2 | Match |
| React 19.2.4 | `react` and `react-dom` `19.2.4` (exact) | both 19.2.4 | Match |
| Prisma 7.8.0 | `@prisma/client` `^7.8.0`, `prisma` `^7.8.0` | both 7.8.0 | Match for client and CLI. See finding 2 for the adapter. |
| Zod 4.3.6 | `zod` `^4.3.6` | 4.3.6 | Match. The caret allows a later 4.x; the lockfile is still this patch. |
| Vercel AI SDK (`ai`) 7.0.165 | not a dependency | not in the lockfile | Registry check below. |
| MUI 7.3.9 | `@mui/material` `^7.3.9`, `@mui/material-nextjs` `^7.3.9`, `@mui/icons-material` `^7.3.11` | `@mui/material` **7.3.11**, `@mui/material-nextjs` 7.3.9, `@mui/icons-material` **7.3.11** | Declared floor only. See finding 1. |
| Neon Postgres, existing project | Prisma `provider = "postgresql"`; `.env.example` documents Neon pooled `DATABASE_URL` and direct `DIRECT_URL` | — | Fits the repo. No new database. |
| Vercel, existing project | `vercel.json` crons, including `/api/cron/tuesday-email`; `@vercel/blob` | — | Fits the repo. `.vercel` is gitignored, so the linked project id is not in the tree. |

The April 2026 parent architecture (`planning-artifacts/architecture.md`) names Next.js, React, MUI, Prisma, Zod, Neon, and Vercel and does not pin these versions. The spine numbers match the current manifest, not that older write-up. The feature memlog records an npm check only for `ai` (2026-11-08). The other rows are justified by the repo, which is the right check for a brownfield app.

## `ai` package

`npm view ai version` on 2026-11-08 returned **7.0.165**. That version is in the registry and was published `2026-11-07T19:27:05.448Z`. Major 7 is the current latest, not a stale major. The package is correctly absent from `package.json` and `package-lock.json`.

The spine does not name an SDK function. The memlog’s same-day note that structured output is `generateText` plus `Output.object` with a Zod schema was not re-read from the SDK docs in this review.

## Greenfield starter

Does not apply. The spine keeps the host, database, Tuesday digest, and auth the app already ships. It does not adopt `create-next-app` defaults. No starter scaffold was checked.

## Findings

### 1. Medium — MUI 7.3.9 is the range floor, not the locked install

The stack row says MUI 7.3.9. That number is the lower bound of `@mui/material` `^7.3.9` and the locked version of `@mui/material-nextjs` only.

`package-lock.json` resolves the packages people mean by MUI to a newer patch:

- `@mui/material` 7.3.11
- `@mui/icons-material` 7.3.11, which `package.json` already declares as `^7.3.11`

The locked icons package peer-depends on `@mui/material` `^7.3.11`. An exact install of 7.3.9, taken from the spine, would sit below that peer. The row was not checked against the lockfile.

**Guard:** Set the MUI row to the locked `@mui/material` version, 7.3.11, or say “7.3.x as locked” and name `@mui/material` versus `@mui/material-nextjs`.

### 2. Low — Prisma 7.8.0 does not cover the driver adapter the app imports

`@prisma/client` and `prisma` are 7.8.0 in the lockfile, matching the spine and satisfying `^7.8.0`.

The database client in `src/lib/db.ts` constructs `PrismaPg` from `@prisma/adapter-pg`. That package is `^7.7.0` in `package.json` and **7.7.0** in the lockfile. The single Prisma version in the table was not checked against the adapter the running client uses.

**Guard:** Keep 7.8.0 for the client and CLI, and note `@prisma/adapter-pg` 7.7.0 beside it.

## What was not flagged

- Next.js 16.2.2, React 19.2.4, and Zod 4.3.6 match both the manifest and the lockfile.
- `ai` 7.0.165 is the current npm latest. Major 7 exists.
- Neon Postgres and Vercel are the app’s existing database and host: PostgreSQL in the Prisma schema, Neon connection instructions in `.env.example`, and Vercel cron plus Blob already in the repo. This review did not open the Neon or Vercel dashboards.
- Product rules AD-1 through AD-11 are decisions recorded with Kyle. They are not library versions, and this lens does not re-litigate them.
