# Epic 1 retrospective — Identity, sessions, and app shell

**Project:** pick-six  
**Epic:** 1 (done)  
**Facilitator:** Scrum Master (BMAD-style)  
**Date:** 2026-04-11  

## Scope we closed

Stories **1.1** → **1.6** are **done**: Next.js + MUI foundation, database/user model, email/password auth and sessions, rolling persistence, invite signup, protected routes with CSRF baseline.

## What went well

- **Clear sequencing** — Foundation (1.1) before auth/data (1.2–1.3) reduced rework; later stories built on stable patterns.
- **Explicit NFR hooks** — Rate limiting (proxy), CSRF baseline, and safe `callbackUrl` handling were spelled out in stories and landed as concrete modules/tests (e.g. 1.6).
- **Review loop** — Story 1.6 shows a healthy **review → changes requested → fixes → done** cycle; keeps quality bar explicit.
- **Colocated testing norm** — Pure helpers tested (e.g. callback URL, CSRF assertions) without over-mocking the framework.

## What to improve next epic

- **Earlier cross-story integration checks** — After1.3/1.4, a short “auth + invite + redirect” checklist could catch edge cases before 1.5/1.6 pile on.
- **Document the single guard strategy** — Epic 1 settled on layout vs proxy patterns; Epic 2 should **reference** that decision so new routes don’t sprout duplicate guards.
- **Story sizing** — 1.6 bundled routing, CSRF, and proxy/matcher concerns; for Epic 2, consider splitting when a story touches **both** product behavior and security baselines.

## Risks carrying into Epic 2

- **League/domain models** will add authorization dimensions (admin vs participant); session-only checks from Epic 1 remain necessary but not sufficient.
- **Email flows** from1.5 will compose with **2.x** invitations; watch for duplicate token semantics or conflicting “source of truth” for invites.

## Action items (for Epic 2 / process)

| # | Action | Owner | When |
|---|--------|-------|------|
| A1 | Start **2-1-create-league-and-season** via `create-story` / dev workflow; move **epic-2** to in-progress when the story file exists | SM / Dev | Next |
| A2 | In first Epic 2 story notes, **link** to Epic 1 auth/proxy/CSRF modules as non-negotiable patterns | Dev | 2-1 kickoff |
| A3 | Optional: add a **one-page “auth & public route map”** in code or minimal doc if route surface grows | Dev | Before 2-4/2-5 |

## Closeout

Epic 1 is **closed** from a delivery perspective; learnings above should inform **create-story** acceptance criteria and **dev-story** task breakdown for **2-1**.
