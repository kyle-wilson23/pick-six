# Pick Six 🏈

**Pick Six** is a web app for running custom NFL pick’em leagues: automated weekly ops (reminders, jailed team, deadlines, scoring), live odds for picks, and a rule engine for mechanics generic fantasy sites do not support.

This is a **personal project** where I am **experimenting with [BMAD](https://github.com/brendan-mccaffrey/bmad)** 🧪 (structured product and solutioning workflows) alongside **Next.js** and **MUI**.

## Installation

The app lives under `src/` (App Router).

1. **Install dependencies**

   ```bash
   npm install
   ```

   After install, `postinstall` runs `prisma generate` (with the same `.env` / `.env.local` loading as the `db:*` scripts), so the Prisma client is available for `npm run build` without an extra step.

2. **Database (PostgreSQL + Prisma)**

   PostgreSQL is accessed via **Prisma** (`prisma/schema.prisma`). The app uses a singleton client from `src/lib/db.ts`.

   - Copy `.env.example` to `.env.local` and set **`DATABASE_URL`** and **`DIRECT_URL`**.
     - **Neon:** In the Neon dashboard, use the **pooled** connection string (host contains `-pooler`) for `DATABASE_URL`, and the **direct** string for `DIRECT_URL`. See [Neon — Connect from Prisma](https://neon.tech/docs/guides/prisma).
     - **Local Postgres** (e.g. Docker): you can set both variables to the same URL.
   - Apply migrations. Use the npm script so Prisma loads `.env.local` (plain `npx prisma` only loads `.env`):

     ```bash
     npm run db:migrate
     ```

     For production / CI against an existing migration history:

     ```bash
     npm run db:migrate:deploy
     ```

   - Optional: `npm run db:studio` opens Prisma Studio.

3. **Run locally**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

**Other scripts:** production build `npm run build`, then `npm run start`; lint `npm run lint`; unit tests `npm test` (watch: `npm run test:watch`). If you use **pnpm** or **yarn**, use the same script names after install.

## Where things stand

- **Done ✅** Planning (brief, PRD, UX, architecture, epics) and a **Next.js + MUI** shell (dark theme, emerald / gold, Inter).
- **Done ✅** **Data:** Prisma + Postgres (Neon-ready URLs), `User` model & migrations, singleton `src/lib/db.ts`, `db:*` scripts — set `.env.local` and migrate per **Database** above.
- **Next 🚀** Auth, sessions, invites, protected routes. Readiness notes: `_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-04.md`.

**Stack 📦** Next.js / React, MUI; email, odds, and backend choices live in the architecture doc.

## Docs 📚

Planning outputs live under [`_bmad-output/planning-artifacts/`](_bmad-output/planning-artifacts/) — start with [`prd.md`](_bmad-output/planning-artifacts/prd.md) for scope and requirements.
