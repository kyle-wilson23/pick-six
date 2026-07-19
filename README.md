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

   - **Invitation links (dev / QA):** You can invite via the app; for a quick test user, **`npm run db:seed`** still prints a full signup URL for a seeded invite email.

3. **Run locally**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

**Other scripts:** production build `npm run build`, then `npm run start`; lint `npm run lint`; unit tests `npm test` (watch: `npm run test:watch`). If you use **pnpm** or **yarn**, use the same script names after install.

## Where things stand

- **Done ✅** Planning (brief, PRD, UX, architecture, epics) and a **Next.js + MUI** shell (dark theme, emerald / gold, Inter).
- **Done ✅** **Data:** Prisma + Postgres (Neon-ready URLs), `User` model & migrations, singleton `src/lib/db.ts`, `db:*` scripts — set `.env.local` and migrate per **Database** above.
- **Done ✅** **Epic 1 — Foundations:** email/password auth, rolling sessions, invite signup, protected routes, CSRF baseline for cookie-backed mutations.
- **Done ✅** **Epic 2 — League setup:** create league/season, email invites, pre-season init, admin league list/settings, participant home (roster + rules), admin as participant, first competition week (incl. mid-season), production-ready league delete.

- **Done ✅** **Epic 3 — Weekly picks:** NFL schedule sync, live odds snapshot, jailed team logic, pick API with deadline enforcement, picks UI (matchup cards with odds/spread/weather/roof), and kickoff-time weather forecasts.
- **Done ✅** **Epic 4 — Admin picks tools:** submission status dashboard, submit/change picks on behalf of participants (incl. post-deadline overrides), audit trail, jailed team verification.
- **Done ✅** **Epic 5 — Scoring & standings:** game results ingest, weekly points (1 vs 2 / anti-jailed), MNF finalize + Tuesday standings, live leaderboard, personal pick history, Tuesday reveal vs peer visibility.
- **Done ✅** **Epic 6 — Email & ops:** Resend transactional email, Tuesday league digest + admin preview, Wed/Thu reminders, deep links to picks, Vercel cron orchestration, UX spec alignment (league nav shell, responsive layouts).

**Next 🚀** **Epic 7 — Polish & hardening:** admin CSV export, structured logging/health signals, WCAG 2.1 Level A baseline, performance and deployment hardening.

**Stack 📦** Next.js / React, MUI; email, odds, and backend choices live in the architecture doc.

## Docs 📚

**Production deploy / backups / critical windows:** [`docs/deployment.md`](docs/deployment.md).  
**Performance budgets:** [`docs/performance-budgets.md`](docs/performance-budgets.md).

Planning outputs live under [`_bmad-output/planning-artifacts/`](_bmad-output/planning-artifacts/) — start with [`prd.md`](_bmad-output/planning-artifacts/prd.md) for scope and requirements.

Sprint and story status: [`_bmad-output/implementation-artifacts/sprint-status.yaml`](_bmad-output/implementation-artifacts/sprint-status.yaml) (per-story notes in the same folder).

**BMAD in this repo (v6):** Install and config live under [`_bmad/`](_bmad/) (manifest, `core` / `bmm` module settings, skill index).

Install or upgrade with `npx bmad-method install` (Node 20+). Docs: [How to install BMAD](https://docs.bmad-method.org/how-to/install-bmad/), [Upgrade to v6](https://docs.bmad-method.org/how-to/upgrade-to-v6/).
