# Pick Six 🏈

**Pick Six** is a web app for running custom NFL pick’em leagues: automated weekly ops (reminders, jailed team, deadlines, scoring), live odds for picks, and a rule engine for mechanics generic fantasy sites do not support.

This is a **personal project** where I am **experimenting with [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD)** 🧪 ([documentation](https://docs.bmad-method.org/)) for structured product and solutioning workflows, alongside **Next.js** and **MUI**.

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

   - **Invitation links (dev / QA):** Until the admin invite flow exists (Epic 2), create test invitations with **`npm run db:seed`** — the script prints a full signup URL for a seeded invite email.

3. **Run locally**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

**Other scripts:** production build `npm run build`, then `npm run start`; lint `npm run lint`; unit tests `npm test` (watch: `npm run test:watch`). If you use **pnpm** or **yarn**, use the same script names after install.

## Where things stand

- **Done ✅** Planning (brief, PRD, UX, architecture, epics) and a **Next.js + MUI** shell (dark theme, emerald / gold, Inter).
- **Done ✅** **Data:** Prisma + Postgres (Neon-ready URLs), `User` model & migrations, singleton `src/lib/db.ts`, `db:*` scripts — set `.env.local` and migrate per **Database** above.
- **Done ✅** **Epic 1 — Foundations:** email/password login and logout with secure sessions, rolling session persistence, invitation tokens and signup via invite link, protected app routes, and CSRF baseline for cookie-backed mutations.
- **Next 🚀** **Epic 2 — League setup:** create league and season, invite participants by email, pre-season initialization, admin league list/settings, participant league home, and related stories (see sprint status and PRD).

**Stack 📦** Next.js / React, MUI; email, odds, and backend choices live in the architecture doc.

## Docs 📚

Planning outputs live under [`_bmad-output/planning-artifacts/`](_bmad-output/planning-artifacts/) — start with [`prd.md`](_bmad-output/planning-artifacts/prd.md) for scope and requirements.

**BMAD in this repo:** workflows under [`_bmad/`](_bmad/), Cursor rules under [`.cursor/rules/bmad/`](.cursor/rules/bmad/). Install or upgrade the bundled method with `npx bmad-method install` (Node 20+); see [How to install BMAD](https://docs.bmad-method.org/how-to/install-bmad/).
