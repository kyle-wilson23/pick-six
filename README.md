# Pick Six 🏈

**Pick Six** is a web app for running custom NFL pick’em leagues: automated weekly ops (reminders, jailed team, deadlines, scoring), live odds for picks, and a rule engine for mechanics generic fantasy sites do not support.

This is a **personal project** where I am **experimenting with [BMAD](https://github.com/brendan-mccaffrey/bmad)** 🧪 (structured product and solutioning workflows) alongside **Next.js** and **MUI**.

## App (local dev)

The Next.js app lives under `src/` (App Router). Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Production build: `npm run build` then `npm run start`. Lint: `npm run lint`.

If you use **pnpm** or **yarn**, use the same scripts after install with your preferred client.

## Where things stand

- **Done ✅** Product brief, PRD, UX spec and mockups, **system architecture**, **epics & user stories**, and **Story 1.1**: Next.js + MUI dark shell (emerald / gold accent, Inter).
- **Next 🚀** Epic 1 continued (database, auth, …); implementation readiness assessment: `_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-04.md`.

Stack direction from planning: **Next.js / React**, **MUI**, plus backend/data/email/odds choices documented in the architecture artifact.

## Docs 📚

Planning outputs live under [`_bmad-output/planning-artifacts/`](_bmad-output/planning-artifacts/) — start with [`prd.md`](_bmad-output/planning-artifacts/prd.md) for scope and requirements.
