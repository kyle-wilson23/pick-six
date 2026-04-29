---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/planning-artifacts/product-brief-pick-six-2026-01-05.md
  - docs/project-context.md
workflow: create-epics-and-stories
completed: '2026-04-04'
author: Kyle
---

# pick-six - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for pick-six, decomposing the requirements from the PRD, UX design specification, architecture decision document, and project context into implementable stories.

## Requirements Inventory

### Functional Requirements

```
FR1: League admins can create new leagues with unique names and configurations
FR2: League admins can invite participants to leagues via email with signup links
FR3: League admins can initialize leagues for pre-season preparation before NFL season starts
FR4: League admins can view list of all leagues they administer
FR5: League admins can access league settings and configuration details
FR6: Participants can view league information including name, season, and participant roster
FR7: Participants can access a league rules reference page explaining all scoring rules, jailed team mechanics, tie-breaker logic, deadline policies, and game rules
FR8: New users can create accounts via invitation signup links
FR9: Users can log in with email and password authentication
FR10: Users can remain logged in for extended periods (session persistence)
FR11: Users can log out of their account
FR12: League admins can view complete list of participants in their league
FR13: League admins participate as full league members with their own picks and points
FR14: Participants can view current week's NFL matchups with moneyline odds
FR15: Participants can view point spread information for all current week matchups
FR16: Participants can view which NFL teams they have previously picked during the current season
FR17: Participants can see visual indication of teams they are not allowed to pick (previously selected teams)
FR18: Participants can see visual indication of the jailed team for the current week
FR19: Participants can select one NFL team as their pick for the current week
FR20: Participants can select to pick against the jailed team for 2-point bonus opportunity
FR21: Participants can modify their pick unlimited times before the weekly deadline
FR22: Participants can see confirmation of their submitted pick including team name and point value
FR23: Participants can see clear countdown to weekly pick deadline
FR24: Participants receive real-time validation preventing selection of previously picked teams
FR25: Participants receive real-time validation preventing direct selection of jailed team (unless picking against)
FR26: The system enforces pick deadline (Thursday ~8:10 PM EST or 5 minutes before first game, whichever earlier)
FR27: Participants cannot submit or modify picks after the weekly deadline has passed
FR28: League admins can view real-time pick submission status for all participants (submitted vs. not submitted)
FR29: League admins can submit picks on behalf of any participant at any time
FR30: League admins can modify any participant's pick at any time (including post-deadline)
FR31: Admin override operations apply the same validation rules (no duplicates, jailed team restrictions)
FR32: The system logs all admin override actions with timestamps in an audit trail
FR33: League admins can view audit trail of all admin override actions for transparency
FR34: League admins can verify weekly jailed team calculation and see tie-breaker logic applied if needed
FR35: The system sends automated Tuesday 6:00 PM reminder emails to all league participants
FR36: Tuesday reminder emails include current standings, jailed team identification, and pick submission link
FR37: The system sends mid-week reminder emails (Wednesday evening) to participants who haven't submitted picks
FR38: The system sends final deadline reminder emails (Thursday, 1 hour before deadline) to participants who haven't submitted picks
FR39: All reminder emails include direct authentication links to pick submission interface
FR40: Email content is personalized based on participant status (pick submitted vs. outstanding)
FR41: The system automatically processes game results after games complete
FR42: The system calculates participant points based on pick outcomes (1 point standard, 2 points anti-jailed)
FR43: The system updates leaderboard after Monday Night Football completion each week
FR44: Participants can view live leaderboard showing all participants' points and rankings
FR45: Leaderboard displays updated standings every Tuesday after MNF processing
FR46: Participants can view their personal pick history (all weeks, teams selected, outcomes)
FR47: Participants can view all participants' picks after Tuesday standings reveal (full transparency)
FR48: Participant picks remain hidden from other participants until Tuesday standings reveal
FR49: League admins can view all participant picks at any time (real-time visibility)
FR50: The system automatically identifies the jailed team each week (team with worst/biggest favorite moneyline odds)
FR51: If multiple teams are tied for worst odds, the system applies tie-breaker logic: largest point spread
FR52: If teams are still tied after point spread tie-breaker, the system randomly selects jailed team with logged seed for auditability
FR53: The system enforces no duplicate team selection rule throughout the season (each team can be picked only once per participant)
FR54: The system enforces anti-jailed bonus rule (picking against jailed team earns 2 points instead of 1)
FR55: League admins can export complete league state to CSV format at any time
FR56: CSV export includes participant list, week-by-week picks for all weeks, and point totals
FR57: CSV export provides complete league snapshot suitable for external spreadsheet management if needed
FR58: The system supports complete 18-week NFL regular season tracking
FR59: The system maintains season-long state including all participant picks, outcomes, and point totals
FR60: The system provides weekly cycle orchestration (Tuesday emails → deadline enforcement → scoring → repeat)
FR61: League admins can permanently delete a league they administer; the action removes that league and its dependent application data from the system, is available from league settings or options, and is protected by deliberate confirmation so it cannot be completed accidentally
```

### NonFunctional Requirements

```
NFR1: Initial page load must complete within 3 seconds on standard broadband connection
NFR2: Subsequent page navigation must complete within 1 second (SPA routing)
NFR3: Time to Interactive (TTI) must be within 4 seconds for primary user workflows
NFR4: Pick selection feedback must display within 200 milliseconds
NFR5: Form submissions must complete within 1 second (excluding network latency)
NFR6: Client-side validation feedback must be immediate (synchronous)
NFR7: Mobile pick workflow must be completable within 60-90 seconds on typical mobile connections
NFR8: Touch interactions must respond within 100 milliseconds
NFR9: All production traffic must be served over HTTPS
NFR10: User passwords must be hashed and salted before storage
NFR11: Session cookies must be HTTP-only and secure
NFR12: Failed login attempts must be rate-limited to prevent brute force attacks
NFR13: User authentication credentials must never be logged or transmitted in plain text
NFR14: Admin audit trails must be tamper-evident and include timestamps
NFR15: CSRF protection must be implemented for all state-changing operations
NFR16: Admin override capabilities must be restricted to authenticated league administrators only
NFR17: Participant picks must remain inaccessible to other participants until Tuesday standings reveal
NFR18: Admin access to participant picks must be logged in audit trail
NFR19: System must maintain 99.5% uptime across full NFL season (18 weeks)
NFR20: Critical period availability (Tuesday evening email send, game day deadlines) must be 100%
NFR21: Planned maintenance must not occur during critical periods (Tuesday 5-7pm, Thursday 7-9pm)
NFR22: Scoring calculations must have zero errors (100% accuracy)
NFR23: Jailed team identification must be 100% accurate based on odds data
NFR24: Pick deadline enforcement must have zero false positives (no early lockouts) and zero false negatives (no late submissions accepted)
NFR25: All participant picks and historical data must be preserved without loss throughout season
NFR26: System must provide graceful degradation if NFL odds API fails (admin manual override capability)
NFR27: Email delivery failures must be logged and retried automatically
NFR28: Database transactions must be atomic to prevent partial state updates
NFR29: Odds data must be fetched and cached Tuesday before 6:00 PM email without fail
NFR30: API failures must not block weekly email sending (fallback to admin manual entry)
NFR31: Odds data must remain consistent for entire week after Tuesday cache (no mid-week refreshes)
NFR32: Email delivery confirmations must be tracked and logged
NFR33: Failed email sends must retry with exponential backoff
NFR34: Weekly reminder emails must be delivered to all participants by 6:00 PM Tuesday
NFR35: Game results must be processed and scores updated within 1 hour of game completion
NFR36: Monday Night Football results must process and trigger Tuesday standings update by 6:00 AM Tuesday
NFR37: All interactive elements must be keyboard navigable
NFR38: Text and interactive elements must maintain 4.5:1 color contrast ratio
NFR39: Form inputs must have clearly associated labels
NFR40: Focus indicators must be visible for keyboard navigation
NFR41: Semantic HTML structure must be used (proper heading hierarchy, landmark regions)
NFR42: Key interactive elements must have appropriate ARIA labels
NFR43: Validation errors and success messages must be announced to screen readers
NFR44: Pick submission workflow must have logical tab order
NFR45: All system errors must be logged with context (timestamp, user, action attempted)
NFR46: Critical failures (deadline enforcement, scoring, email delivery) must generate immediate alerts
NFR47: Admin must have visibility into system health and recent errors
NFR48: Complete league state must be exportable to CSV format at any time (admin fail-safe)
NFR49: Database backups must be automated and restorable
NFR50: Audit trail of admin actions must be complete and preserved
NFR51: Updates must be deployable during off-season or between games without data loss
NFR52: Database migrations must be reversible in case of deployment issues
NFR53: System must support deployment to standard web hosting platforms (Vercel, Netlify)
```

### Additional Requirements

**From architecture (`_bmad-output/planning-artifacts/architecture.md`):**

- Initialize the app with official `create-next-app@latest` (TypeScript, App Router, ESLint); add MUI after scaffold; first implementation priority per architecture handoff.
- PostgreSQL on Neon; Prisma ORM with migrations; pooled/serverless-safe connection; single Prisma client singleton from `src/lib/db.ts`.
- Auth.js (NextAuth evolution) with email/password; HTTP-only cookies; role checks in application layer with `leagueId` + membership on mutations.
- REST JSON APIs via Next.js Route Handlers; Zod at API boundary; consistent error JSON shape; dates stored UTC, business rules in `America/New_York`.
- Vercel deployment target; Vercel Cron for scheduled jobs with idempotent handlers; `CRON_SECRET` or documented verification; Hobby cron limits (≤1/day per job, ±1h precision)—use daily “is it time in Eastern?” dispatcher or documented fallback.
- Server-only calls for odds, results, weather, email; no API keys in client.
- Pick visibility enforced in server queries (FR48–FR49); admin overrides + jailed random tie-break audited.
- Naming: camelCase JSON; snake_case DB tables/columns; REST plural kebab paths per architecture patterns.

**From UX (`_bmad-output/planning-artifacts/ux-design-specification.md`):**

- Full feature parity on mobile and desktop; touch targets ≥44px; rolling ~30-day session behavior.
- Persistent pick-status confirmation (green banner / clear state); deadline countdown with progressive urgency.
- Admin can edit Tuesday email body before automated send (week-over-week).
- Weather per matchup (home team, conditions) via free-tier API when available; unobtrusive for casual users.
- **Pre-season preview:** In July/August (or any time before picks open), signed-in users should still be able to **see NFL regular season Week 1** matchups with **live/early odds and weather** where APIs allow—so third-party integrations can be validated before the season. See **Stories 3.1–3.2, 3.6**.
- **Mid-season league start:** At **league creation**, admins can set the **first NFL week** when competition begins (e.g. Week 1 or Week 8 if deployment is late). See **Story 2.7**; Epic 3+ must respect this for “current week” and picks.
- **Team logos:** UX `TeamLogo` currently specifies abbreviation-in-circle; **Story 3.8** implements real logos (see Epic 3).
- **Pre-season rehearsal / simulation mode:** Run a multi-week league dry run with invited users before the real NFL season—non-real-time week advancement, simulated odds and results, controlled email behavior. Prefer **test leagues** (per-league flag) plus optional global toggles; **deletable** when done. **Epic 8** (no additional numbered FR beyond **FR1–FR61**; rehearsal is a delivery wrapper).
- Email deep links to pick flow; no-tutorial-first-use for core screens.

**From project context (`docs/project-context.md`):**

- Non-negotiables: secrets server-only; one Prisma client; server-authoritative deadlines and rules; pick privacy; audit for overrides and random tie-breaks; MUI Stack for flex layouts.

### FR Coverage Map

| FR | Epic | Notes |
|----|------|-------|
| FR1–FR7, FR61 | Epic 2 | League creation, invites, initialization, admin list/settings, participant info + rules, **admin delete league** (Story 2.8) |
| FR8–FR11 | Epic 1 | Invitation signup, login, logout, session persistence |
| FR12–FR13 | Epic 2 | Roster visibility, admin as full participant |
| FR14–FR27 | Epic 3 | Matchups, odds, picks, validation, deadline, UX for picks |
| FR28–FR34 | Epic 4 | Admin dashboard, overrides, audit, jailed verification |
| FR35–FR40, FR60 | Epic 6 | Email automation, reminders, personalization, weekly rhythm |
| FR41–FR49 | Epic 5 | Scoring, leaderboard, history, reveal rules |
| FR50–FR54 | Epic 3 + Epic 5 | Jailed identification and pick rules (Epic 3); point calculation for anti-jailed (Epic 5) |
| FR55–FR57 | Epic 7 | CSV export |
| FR58–FR59 | Epic 3 | Season/week state (with Epic 5 for outcomes) |
| Team logos (UX `TeamLogo`; extends visual treatment for FR14–FR18) | Epic 3 — Story 3.8 | Discovery + implementation: static licensed assets, provider logo URLs, or API—compliance documented |
| Rehearsal / simulation mode (pre-season dry run; product) | Epic 8 | Test/rehearsal **leagues** (primary), optional env toggles, **delete** when finished—see stories |
| First NFL week / mid-season start (product) | Epic 2 — Story 2.7 | League begins at Week *N* (1–18); prior weeks skipped for competition |

## Epic List

### Epic 1: Sign up, sign in, and secure sessions

Users and league admins can accept invitations, create accounts, sign in, stay signed in across weeks, and sign out—establishing identity for all league features.

**FRs covered:** FR8, FR9, FR10, FR11

### Epic 2: Create the league, invite players, and publish rules

League admins can create and initialize a league, invite participants by email, and everyone can see league info, roster, and a rules reference—without yet needing weekly scoring. **Story 2.7:** leagues can be configured at creation to **start competition at NFL Week N** (including mid-season) if deployment slips. **Story 2.8:** admins can **permanently delete** a league they run, with UX that prevents accidents (**FR61**).

**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR12, FR13, FR61; **Story 2.7** (first competition week—product extension of FR1/FR3 scope)

### Epic 3: Study matchups and submit validated weekly picks

Participants (including admin as player) see weekly odds, jailed team, and their season pick constraints; submit and change picks before the server-enforced deadline; system enforces jailed and duplicate-team rules. Includes **real NFL team logos** (Story 3.8) once discovery on assets vs provider is complete. **Pre-season:** Week 1 odds and weather can be fetched and shown before the season for API validation (Stories 3.2, 3.6).

**FRs covered:** FR14–FR27, FR50–FR53, FR58, FR59 (plus FR54 validation path; FR54 scoring in Epic 5); **Story 3.8** covers UX team-logo enhancement aligned with FR14–FR18 presentation

### Epic 4: Admin oversight, overrides, and auditability

League admins monitor submission status, submit or change any participant’s pick when needed (including after deadline), with full audit trail and jailed-team verification tools.

**FRs covered:** FR28, FR29, FR30, FR31, FR32, FR33, FR34, FR49

### Epic 5: Game results, scoring, standings, and pick transparency

The system ingests results, awards points (including anti-jailed), updates standings after MNF, shows leaderboard and personal history, and enforces Tuesday reveal vs admin visibility.

**FRs covered:** FR41–FR48, FR54

### Epic 6: Automated emails and weekly orchestration

Tuesday league emails, mid-week and deadline reminders, personalized content, deep links, and reliable scheduled jobs tie the weekly cycle together.

**FRs covered:** FR35–FR40, FR60

### Epic 7: Export, observability, and production readiness

Admins can export full league CSV; the app meets accessibility, security, logging, and deployment expectations for a real season.

**FRs covered:** FR55–FR57; **NFRs** addressed as listed per story

### Epic 8: Pre-season rehearsal league (simulation / testing mode)

League admins can run a **multi-week dry run** with real invited users **before** the NFL season: weeks advance on demand (not wall-clock), odds and game outcomes are **simulated or fixture-driven**, and email/cron behavior is **explicitly controlled** so end-to-end flows can be validated in production-like conditions without waiting for real games.

**Configuration model:** Prefer **per-league** **test / rehearsal leagues** (create a league as a test league, or set a league-level flag)—easy to distinguish from a real season league. Optional **deployment or env toggles** can gate test features globally if desired. **Test leagues can be deleted** when the dry run is over (cleanup story).

**FRs covered:** None new in PRD; **reuses** core FR behavior in a controlled context. **Depends on:** Epics 1–7 being complete or near-complete (implement last).

---

## Epic 1: Sign up, sign in, and secure sessions

**Goal:** Invitation-based signup and email/password authentication with secure, persistent sessions—unblocking league and pick features.

### Story 1.1: Initialize Next.js app with MUI shell

As a developer,
I want the repository scaffolded with Next.js App Router, TypeScript, ESLint, and MUI theming per architecture,
So that all features build on a consistent, deployable foundation.

**Acceptance Criteria:**

**Given** a clean repo ready for application code
**When** the project is initialized with `create-next-app@latest` (TypeScript, App Router, ESLint) and MUI is added with the project dark theme (emerald/gold accent, Inter) using **Stack** for flex layouts
**Then** `pnpm dev` (or npm/yarn) starts the app and a root layout renders without errors
**And** `src/` structure matches architecture (`src/app`, `src/components`, `src/lib` placeholders as needed) and **NFR53** (Vercel-compatible Next app) is satisfied at scaffold level

---

### Story 1.2: Database client and User model

As a developer,
I want Neon PostgreSQL connected via Prisma with a singleton client and initial User model,
So that credentials and profiles persist safely.

**Acceptance Criteria:**

**Given** `.env.example` documents `DATABASE_URL` (no secrets committed)
**When** Prisma is configured for Neon (pooled/serverless-safe connection per docs) and migrations run
**Then** a `User` (or equivalent) model exists with fields needed for email identity
**And** exactly one Prisma client is exported from `src/lib/db.ts` (singleton) per project context **NFR28** (atomic transactions available for later stories)

---

### Story 1.3: Email/password login and logout with secure sessions

As a user,
I want to log in with email and password and log out,
So that my account stays protected while remaining convenient week to week.

**Acceptance Criteria:**

**Given** Auth.js is configured with credentials provider and Prisma adapter (or equivalent per architecture)
**When** a user submits valid credentials on the login page
**Then** an HTTP-only, secure session cookie is established (**NFR9–NFR11**, **NFR10** hashed password)
**And** logout clears the session (**FR11**)
**And** failed logins are rate-limited (**NFR12**) and credentials are never logged (**NFR13**)

---

### Story 1.4: Rolling session persistence

As a returning participant,
I want to stay logged in across weeks when I keep using the app,
So that Tuesday email → app flows feel frictionless.

**Acceptance Criteria:**

**Given** a logged-in user
**When** they use the app within the rolling activity window (align to UX ~30-day policy; document exact `maxAge`/`updateAge` in code)
**Then** they are not prompted to log in unnecessarily (**FR10**)

---

### Story 1.5: Invitation tokens and signup via invite link

As a new participant,
I want to create my account from an invitation link,
So that only invited people join the league.

**Acceptance Criteria:**

**Given** a valid invitation token exists in the database (created in Epic 2; for this story, seed or admin-only API to create test invites)
**When** the user opens `/signup/[token]` (or equivalent) and completes registration
**Then** the account is created and linked to the invitation (**FR8**)
**And** expired or invalid tokens show a clear error without revealing whether an email exists
**And** **implementation order:** validate with **seeded** or **admin-only** invite creation until **Story 2.2** ships; for production-path QA, complete **Story 2.2** (invitation records + signup links) so invites are created through the real admin flow

---

### Story 1.6: Protected app routes and CSRF baseline

As a user,
I want authenticated routes protected from anonymous access,
So that league data stays private.

**Acceptance Criteria:**

**Given** middleware or layout guards for `(app)` routes
**When** an unauthenticated user hits a protected page
**Then** they are redirected to login with return URL where appropriate
**And** state-changing forms use CSRF protection per **NFR15** (Auth.js/session patterns or explicit tokens as implemented)

---

## Epic 2: Create the league, invite players, and publish rules

**Goal:** One league can be created, initialized for pre-season, populated via invitations, and browsed by participants—including rules reference. Admins can set **which NFL week competition starts** (default Week 1, or mid-season) at creation so a late launch can still join the current season.

### Story 2.1: Create league and season

As a league admin,
I want to create a league with a name and tie it to the current NFL season,
So that all picks and weeks are scoped correctly.

**Acceptance Criteria:**

**Given** an authenticated user designated as admin (first creator = admin, or role flag per schema)
**When** they submit the create-league form
**Then** a `League` and `Season` exist with MVP-hardcoded rules documented in code or config (**FR1**)
**And** API validates input with Zod and returns structured errors
**And** create-league flow **includes or chains to** first competition week configuration per **Story 2.7** (field can live on `Season` or `League`)

---

### Story 2.2: Invite participants by email

As a league admin,
I want to invite participants by email with signup links,
So that roster fills without manual account creation.

**Acceptance Criteria:**

**Given** a league admin and a league
**When** they enter email address(es) for invitation
**Then** invitation records + tokens are created and email sending is invoked (provider wired in Epic 6 minimal stub or console in dev) (**FR2**)
**And** links resolve to Epic 1 signup flow (**FR8**)

---

### Story 2.3: Pre-season league initialization

As a league admin,
I want to mark the league ready for the upcoming season,
So that weekly operations activate at the right time.

**Acceptance Criteria:**

**Given** a league in pre-season state
**When** admin completes initialization (explicit action or status transition)
**Then** league is eligible for weekly week/pick flows when season starts (**FR3**)

---

### Story 2.4: Admin league list and settings

As a league admin,
I want to see leagues I administer and open settings,
So that I can confirm configuration.

**Acceptance Criteria:**

**Given** an admin with one or more leagues
**When** they visit the leagues list
**Then** they see all administered leagues (**FR4**)
**And** settings/detail view shows configuration summary (**FR5**)

---

### Story 2.5: Participant league home, roster, and rules page

As a participant,
I want to see league name, season, roster, and full rules reference,
So that I understand mechanics without asking the admin.

**Acceptance Criteria:**

**Given** a league member
**When** they open league info and rules pages
**Then** they see name, season, participants (**FR6**)
**And** rules page covers scoring, jailed team, tie-breakers, deadlines (**FR7**)
**And** content is readable on mobile and desktop (UX parity)

---

### Story 2.6: Admin as full participant

As a league admin,
I want to appear on the roster and use the same participant flows as everyone else,
So that I compete fairly (**FR13**).

**Acceptance Criteria:**

**Given** the creating admin is a member of the league
**When** membership is loaded for the league
**Then** the admin is included in participant lists and can access participant pick routes (**FR12**, **FR13**)

---

### Story 2.7: First NFL competition week at league creation (mid-season start)

As a league admin,
I want to set **when** our league’s competition begins in the NFL regular season **at creation time** (default **Week 1**, or **Week N** if we deploy late),
So that we can **start mid-season** instead of waiting until next year if we miss the September launch.

**Acceptance Criteria:**

**Given** league creation (or a required step in the same flow before invitations go out)
**When** the admin selects **first NFL regular season week** for this league (`1`–`18`, validated)
**Then** the value is stored on the **league or season** record and is the **single source of truth** for when pick submission and weekly scoring apply (**FR1**, **FR3** alignment)
**And** weeks **before** that number are **out of scope** for this league: no required picks, no phantom losses—the “current” pick week in **Epic 3** never precedes this setting once the NFL calendar has reached that week
**And** participant-facing copy (league home, rules) states **competition starts NFL Week N** when **N > 1**
**And** **Immutability:** after the league has **started competition** (define explicitly: e.g. first pick submitted or first week deadline passed), the admin **cannot** change first week without a documented support/migration path; before any pick, admin may still adjust if product allows (document chosen rule)
**And** downstream epics (**schedule, odds snapshot, picks, scoring, standings**) use this field when determining **which NFL week** the league is on—no hard-coded assumption that all leagues always start at Week 1

---

### Story 2.8: Admin delete league (production)

As a league admin,
I want to permanently delete a league I administer from the league settings or options area,
So that I can remove a mistaken or obsolete league without contacting support (**FR61**).

**Acceptance Criteria:**

**Given** an authenticated user who is a **league admin** for the league  
**When** they open **league settings or league options** (same general surface as **FR5** / **Story 2.4**)  
**Then** they can start a **Delete league** flow  
**And** the primary control is a **destructive (red)** button or equivalent clearly labeled for irreversible deletion

**And** confirming opens a **dialog** that explains the consequence (permanent loss of league data for members), shows the **league name**, and includes a **text field** where the admin must type the exact word **`delete`** (lowercase) before the **confirm** control is enabled

**And** until the text matches exactly, **Confirm** (or primary destructive action) stays **disabled** or no-ops

**And** on success, the league and **dependent rows** (memberships, season linkage, invitations, picks, audit rows, and other league-scoped data defined in schema) are removed via **documented cascade** or **transactional delete**; **user accounts** that belong to other leagues remain intact

**And** only **league admins** can invoke the server endpoint; others receive **403**; unauthenticated callers receive **401**

**And** the implementation is suitable for **production leagues** (not limited to test/rehearsal); **Epic 8 Story 8.7** remains the rehearsal-focused cleanup story—reuse delete/cascade patterns where sensible but do not require a league to be a test league for **FR61**

**And** optional but recommended: append an **audit log** entry (or structured application log) recording league id, actor user id, and timestamp for accountability

---

## Epic 3: Study matchups and submit validated weekly picks

**Goal:** Complete weekly pick experience with odds snapshot, jailed logic, validation, deadline enforcement, and season long constraints. **Pre-season:** Week 1 odds and weather remain fetchable/displayable in the off-season so APIs can be validated before the season (see 3.1–3.2, 3.6). **Schedule automation:** Story **3.9** adds evaluated **live schedule sync** so **`NflGame`** is not seed-only long term.

### Story 3.1: NFL schedule, teams, and 18-week season model

As the system,
I want regular-season weeks, games, and teams modeled in the database,
So that picks attach to real matchups (**FR58**).

**Acceptance Criteria:**

**Given** Prisma models for teams, games, and season weeks (18 weeks)
**When** seed data or sync populates the current season schedule
**Then** each pick references a team and week unambiguously (**FR59**)
**And** **Week 1** regular-season games are identifiable in data as soon as the schedule exists, so **off-season** UIs can target Week 1 for preview (see 3.2, 3.6)
**And** **League start week (Story 2.7):** “active” competition week for a league is never before its configured **first NFL week**; schedule and week pointers respect **`firstCompetitionWeek`** (or equivalent) when advancing weeks and enforcing picks (**FR58**)

---

### Story 3.2: Odds fetch, Tuesday snapshot, and week-long consistency

As the system,
I want moneyline (and spread) odds cached for the week after Tuesday snapshot,
So that jailed team and displays are stable (**NFR29–NFR31**, **NFR26**).

**Acceptance Criteria:**

**Given** a configured odds provider (server-only key)
**When** the Tuesday snapshot job runs (manual trigger OK before Epic 6 cron)
**Then** odds for the active week are stored and used for all reads until next snapshot (**FR31**)
**And** if the API fails, admin can enter or correct odds per **NFR26**, **NFR30** (documented path)
**And** **Off-season / pre-kickoff (e.g. July–August, league created before the season):** the integration still supports **fetching and storing or serving** odds for **NFL regular season Week 1** (early lines or live as the provider exposes them)—via **admin-triggered fetch**, optional **scheduled** refresh, or documented **on-demand** path—so third-party odds can be **validated before** picks officially open; in-season **Tuesday snapshot** rules remain unchanged once the league week is live
**And** **Schedule vs odds (maintenance):** this story **investigates** whether the **same** third-party integration can supply **both** (a) moneyline/spread odds and (b) **NFL regular-season schedule** data (matchups, kickoff instants, weeks 1–18) to populate or refresh `NflGame` (see Story 3.1). **Document the decision**—single provider vs separate schedule source—and **implement** the chosen approach here (or explicitly defer schedule sync to a follow-up only if the spike proves it must be split).

---

### Story 3.3: Jailed team identification and tie-breakers

As the system,
I want to compute jailed team from moneyline, then spread, then seeded random,
So that results are fair and auditable (**FR50–FR52**).

**Acceptance Criteria:**

**Given** week odds snapshot
**When** jailed computation runs
**Then** the jailed team follows PRD order; random tie-break logs seed for audit (**FR52**, **NFR23**)
**And** pure logic lives in `lib/domain/jailed.ts` (or equivalent) for tests

---

### Story 3.4: Pick API with server-side validation

As a participant,
I want my pick validated on the server,
So that rules cannot be bypassed (**FR53**, **FR54** validation, **FR24–FR25** server mirror).

**Acceptance Criteria:**

**Given** a member and current week before deadline
**When** `POST` pick with team and optional anti-jailed flag
**Then** server rejects duplicate teams, invalid jailed picks, and enforces anti-jailed semantics (**FR19**, **FR20**, **FR53**, **FR54**)
**And** responses use consistent JSON errors; mutations are transactional (**NFR28**)

---

### Story 3.5: Deadline enforcement (server authority)

As the system,
I want deadlines computed in UTC with Eastern business rules,
So that lock times are fair and precise (**FR26**, **FR27**, **NFR24**).

**Acceptance Criteria:**

**Given** week’s first kickoff (or configured rule)
**When** current time is past deadline (5 minutes before first game, Eastern)
**Then** API rejects new pick or change (**FR27**)
**And** no early lockout before defined instant (**NFR24** false positives)

---

### Story 3.6: Picks UI — matchups, odds, spread, weather (optional)

As a participant,
I want to see matchups with moneyline, spread, and optional weather,
So that I can decide without leaving the app (**FR14**, **FR15**, UX weather).

**Acceptance Criteria:**

**Given** an authenticated league member on the picks page
**When** the page loads for the active week
**Then** all matchups show moneyline and spread (**FR14**, **FR15**)
**And** weather/home team displays when API available; fails soft if quota exceeded
**And** UI meets responsive parity (UX)
**And** **Off-season / before the league’s pick window:** signed-in users can still open a **Week 1 preview** (or equivalent route) that **fetches and displays** current **Week 1** moneyline, spread, and **weather** for each matchup—same integrations as in-season—so APIs can be smoke-tested **before September**; if pick submission is not yet allowed, the UI clearly indicates **preview / not pickable yet** (or hides pick actions) while still showing live data

---

### Story 3.7: Jailed and “already picked” UX with countdown and status

As a participant,
I want jailed team and unavailable teams clearly marked, plus countdown and confirmation,
So that I avoid mistakes and trust my submission (**FR16–FR23**, **FR18**, **FR17**).

**Acceptance Criteria:**

**Given** the picks screen
**When** I view and change selections before deadline
**Then** previously picked teams are indicated unselectable (**FR16**, **FR17**, **FR24**)
**And** jailed team is prominent; direct pick blocked unless anti-jailed path (**FR18**, **FR25**)
**And** deadline countdown is visible (**FR23**)
**And** persistent confirmation shows current pick and point intent (1 vs 2) (**FR22**)
**And** client validation is immediate (**NFR4**, **NFR6**) and I can change picks freely before deadline (**FR21**)

---

### Story 3.8: NFL team logos — discovery and implementation

As a participant,
I want real team logos on matchups, pick status, and related surfaces,
So that the UI matches the UX spec’s visual hierarchy and feels familiar—without relying on text abbreviations alone.

**Acceptance Criteria:**

**Given** the need for compliant NFL team marks (official marks are licensed; implementation must respect terms)
**When** discovery is complete
**Then** the chosen approach is documented: e.g. **static assets** in `public/` (SVG/PNG) keyed by team id; **logo URLs** from the odds/sports data provider if license allows; or a **third-party** sports imagery API— including fallback when a logo fails to load
**And** `TeamLogo` (and any email-safe variants if required) renders real logos for **sm** / **md** / **lg** per UX, with **abbreviation + colored circle** as fallback (same states: default, disabled, jailed desaturation)
**And** images use `next/image` (or equivalent) with dimensions and caching appropriate for **NFR1–NFR3**; each logo has meaningful **alt text** (team name) for **NFR42**
**And** no API keys or hotlinking rules are violated; if only static assets are viable, repo documents update process for new seasons/teams

---

### Story 3.9: NFL schedule provider — spike, choice, and `NflGame` sync

As the system,
I want an **evaluated and implemented** path to **populate or refresh** regular-season **`NflGame`** rows from a **schedule-first** third-party API (not the odds-only feed),
So that we are not permanently dependent on **seed JSON** for matchups and kickoffs (**follow-up from Story 3.2** and **`docs/nfl-odds-integration.md`**) and **`Pick`/deadline** flows always target **real games** for the active season.

**Acceptance Criteria:**

**Given** Story **3.1** **`Team`** / **`NflGame`** shape and Story **3.2** split-provider decision  
**When** this story completes  
**Then** at least **two** credible schedule providers (e.g. **API-Sports**, **SportsDataIO**, or others justified in writing) are **compared** on: **cost/limits** with **preference for zero recurring cost** (free tier / MVP-scale usage), **NFL regular-season coverage**, **kickoff time quality (UTC)**, **week indexing vs our `weekNumber` 1–18**, **mapping to `Team`**, and **operational fit** (self-serve vs sales)  
**And** **one** provider is **selected** and **documented** in **`docs/nfl-odds-integration.md`** (or a sibling doc) with **fallback** if the vendor changes or tier is insufficient — and if the choice is **paid**, the doc **explains why** no acceptable **free** option worked  
**And** an **idempotent** sync **upserts** **`NflGame`** for the **current `nflSeasonYear`** (full **1–18** or clearly documented phased rollout) without breaking **`Pick`** uniqueness or FKs  
**And** secrets are **server-only** (`docs/project-context.md` #1); **no** `NEXT_PUBLIC_*` for keys  
**And** a **manual or admin-triggered** sync path exists (Route Handler and/or **`scripts/`**), with structured errors and logs on failure (**NFR45**)  
**And** **Vitest** covers mapping/fixtures **without** live network in default **`npm test`**

**Priority:** Schedule **high** in Epic 3 delivery order (after **3.2** is stable; may proceed in parallel with **3.3** where dependencies allow). **Cost:** **Free of recurring cost** is a product priority; prefer **free-tier** providers and batch sync patterns before paid subscriptions.

---

### Story 3.10: Kickoff-time weather forecast (upgrade from current conditions)

As a **participant**,
I want the weather badge on each matchup card to reflect **forecast conditions at kickoff time** rather than conditions at page-load time,
So that I have accurate strategic context for games days before they are played.

**Acceptance Criteria:**

**Given** Story **3.6** weather integration (`fetchWeatherForTeam`, `WEATHER_API_KEY`) and Story **3.9** real UTC `kickoffAt` per `NflGame`  
**When** the picks page loads  
**Then** each matchup's weather chip reflects **forecast conditions at the game's `kickoffAt`** (temperature, condition, wind), not current conditions at the moment of the page request

**And** if `kickoffAt` is **outside the provider's forecast horizon** (e.g. game is 8+ days away and provider only forecasts 5 days), the weather chip is **silently omitted** — no error surface, no stale current-conditions fallback shown as a forecast

**And** if `WEATHER_API_KEY` is absent, the API call fails, or a quota limit is hit, weather is still silently omitted — same fail-soft behavior as Story 3.6

**And** the provider selection is evaluated and documented (free-tier preference): **OWM `/data/2.5/forecast`** (3h steps, 5 days, free) vs **OWM One Call 3.0** (hourly, 8 days, free tier w/ credit card) vs alternatives; choice recorded in `docs/` alongside the odds/schedule provider decisions

**And** secrets are **server-only**; no `NEXT_PUBLIC_*` for weather keys

**And** `npm test` covers the forecast-path logic with a fixture (no live network)

**Blocked by:** Story **3.9** (real UTC `kickoffAt` for all weeks — seed-only Week 1 games are a limited pilot but not adequate for full 18-week forecast accuracy).

**Code surface area (small):** rename `fetchWeatherForTeam(abbr)` → `fetchWeatherForGame(abbr, kickoffAt)` in `src/lib/integrations/weather/client.ts`; update one call site in `src/lib/picks/build-league-picks-week-view.ts`. `WeatherData` shape unchanged.

---

## Epic 4: Admin oversight, overrides, and auditability

**Goal:** Admins supervise the week, intervene when needed, and every override is visible and logged.

### Story 4.1: Pick submission status dashboard

As a league admin,
I want to see who has submitted a pick for the current week,
So that I can nudge or override as needed (**FR28**).

**Acceptance Criteria:**

**Given** an admin viewing the league admin dashboard
**When** the current week is active
**Then** each participant shows submitted vs not submitted in near real-time (refresh acceptable)

---

### Story 4.2: Submit or change pick on behalf (including post-deadline)

As a league admin,
I want to place or change any participant’s pick any time,
So that edge cases are handled fairly (**FR29**, **FR30**).

**Acceptance Criteria:**

**Given** an authenticated league admin
**When** they submit an override pick via admin API
**Then** the same validation rules apply as normal picks unless business rules explicitly allow admin bypass for data entry (**FR31**—document behavior if admin must fix impossible states)
**And** only admins can call this route (**NFR16**)

---

### Story 4.3: Audit trail for overrides and admin pick visibility

As the system,
I want every admin pick change logged immutably,
So that disputes are resolvable (**FR32**, **FR33**, **NFR14**, **NFR18**, **NFR50**).

**Acceptance Criteria:**

**Given** an admin override
**When** it succeeds
**Then** an `audit_log_entries` row records actor, target user, week, before/after, timestamp
**And** admin can list audit entries for the league (**FR33**)
**And** admin viewing others’ picks is allowed anytime (**FR49**) and pick data never leaks to non-admins via API (**NFR17**—full enforcement with Epic 5 reveal rules)

---

### Story 4.4: Jailed team verification view

As a league admin,
I want to see how jailed team was determined this week,
So that I can confirm automation (**FR34**).

**Acceptance Criteria:**

**Given** computed jailed result for the week
**When** admin opens verification UI
**Then** they see odds, spread tie-break, and random seed if used (**FR34**)

---

## Epic 5: Game results, scoring, standings, and pick transparency

**Goal:** Automatic scoring, MNF-aware standings updates, leaderboard, history, and Tuesday reveal rules.

### Story 5.1: Ingest game results and finalize games

As the system,
I want game outcomes recorded after completion,
So that picks can be scored (**FR41**, **NFR35**).

**Acceptance Criteria:**

**Given** a results provider or import path
**When** a game ends
**Then** winner/loser (or tie rules) are stored within the ~1 hour target (**NFR35**)

---

### Story 5.2: Calculate weekly points (1 vs 2 anti-jailed)

As the system,
I want points awarded per PRD rules,
So that standings reflect performance (**FR42**, **FR54**).

**Acceptance Criteria:**

**Given** finalized games and submitted picks
**When** scoring job runs for the week
**Then** standard wins = 1, anti-jailed wins = 2, losses/forgot = per PRD (**FR42**, **FR54**)
**And** calculations are covered by tests for edge cases (**NFR22**)

---

### Story 5.3: MNF completion and Tuesday standings update

As a participant,
I want standings to update after Monday Night Football for the prior week,
So that Tuesday email and UI show correct rankings (**FR43**, **FR45**, **NFR36**).

**Acceptance Criteria:**

**Given** MNF concludes
**When** Tuesday processing runs (by 6:00 AM Eastern per **NFR36**—or documented MVP time)
**Then** leaderboard reflects prior week results (**FR43**, **FR45**)

---

### Story 5.4: Live leaderboard

As a participant,
I want to see points and ranks for everyone,
So that I know where I stand (**FR44**).

**Acceptance Criteria:**

**Given** scored season-to-date totals
**When** I open standings
**Then** I see ordered leaderboard with points (**FR44**)

---

### Story 5.5: Personal pick history

As a participant,
I want my weekly picks and outcomes listed,
So that I can track my season (**FR46**).

**Acceptance Criteria:**

**Given** historical picks and results
**When** I view my history
**Then** I see each week, team chosen, win/loss, points (**FR46**)

---

### Story 5.6: Tuesday reveal vs peer visibility

As a participant,
I want other players’ picks hidden until after Tuesday reveal,
So that the game stays fair—while admins always see truth (**FR47**, **FR48**, **FR49**, **NFR17**).

**Acceptance Criteria:**

**Given** a non-admin participant querying others’ picks for a week
**When** before Tuesday reveal window for that week
**Then** peer picks are not returned or displayed (**FR48**, **NFR17**)
**And** after reveal, all participants’ picks are visible (**FR47**)
**And** admin always receives full pick data in admin views (**FR49**)

---

## Epic 6: Automated emails and weekly orchestration

**Goal:** Reliable Tuesday league email plus mid-week and deadline reminders, personalized by pick status, with deep links and idempotent cron.

### Story 6.1: Transactional email integration

As the system,
I want a transactional email provider with retries and logging,
So that delivery is observable (**NFR27**, **NFR32**, **NFR33**).

**Acceptance Criteria:**

**Given** API keys in server env only
**When** an email send fails transiently
**Then** retries use backoff and outcomes are logged (**NFR27**, **NFR33**)

---

### Story 6.2: Tuesday 6:00 PM league email content and admin preview

As a league admin,
I want participants to receive standings, jailed team, and pick link after I can optionally adjust the message,
So that automation stays flexible (UX + **FR35**, **FR36**).

**Acceptance Criteria:**

**Given** Tuesday snapshot and standings inputs
**When** the send window triggers (per scheduler Epic 6.4)
**Then** all active participants receive email by 6:00 PM Eastern target (**NFR34**)
**And** content includes standings, jailed team, deep link (**FR36**)
**And** admin can edit optional body text before send for that week (UX)

---

### Story 6.3: Wednesday and Thursday reminders

As a forgetful participant,
I want reminders if I have not picked,
So that I do not miss the week (**FR37**, **FR38**, **FR40**).

**Acceptance Criteria:**

**Given** participants without a pick for the open week
**When** Wednesday evening and 1 hour before deadline jobs run
**Then** only outstanding users receive reminders (**FR37**, **FR38**, **FR40**)

---

### Story 6.4: Email deep links to picks

As a participant,
I want one tap from email to the pick screen,
So that the workflow stays under 60–90 seconds on mobile (**FR39**, **NFR7**).

**Acceptance Criteria:**

**Given** reminder emails
**When** the user follows the link
**Then** they land on auth (if needed) and the correct league/week pick route (**FR39**)

---

### Story 6.5: Cron routes, secrets, and idempotent weekly orchestration

As the system,
I want scheduled jobs that safely drive the weekly cycle,
So that email → deadline → scoring cadence repeats (**FR60**, architecture cron rules).

**Acceptance Criteria:**

**Given** `vercel.json` (or host config) and `/api/cron/*` routes
**When** cron fires (possibly daily dispatcher checking Eastern window on Hobby)
**Then** handlers verify `CRON_SECRET` or platform signature; jobs are idempotent if run twice
**And** critical failures surface to logs/alerts (**NFR46**)

---

## Epic 7: Export, observability, and production readiness

**Goal:** Operational safety net and measurable quality bar for launch.

### Story 7.1: Admin CSV export of full league snapshot

As a league admin,
I want a CSV of roster, all weekly picks, and totals,
So that I have an escape hatch if something goes wrong (**FR55**, **FR56**, **FR57**, **NFR48**).

**Acceptance Criteria:**

**Given** an admin
**When** they request export
**Then** downloaded CSV matches PRD fields and complete season data (**FR55–FR57**)

---

### Story 7.2: Structured logging and admin-visible health signals

As a league admin,
I want errors and critical job failures visible somewhere trustworthy,
So that I trust automation (**NFR45–NFR47**, **NFR46**).

**Acceptance Criteria:**

**Given** application and cron routes
**When** errors occur
**Then** structured logs include timestamp, route, and non-sensitive context (**NFR45**)
**And** admin UI or linked dashboard shows recent failures (**NFR47**) at MVP scope (e.g., last email job status)

---

### Story 7.3: Accessibility baseline (WCAG 2.1 Level A) for core flows

As a participant using assistive tech,
I want login and pick flows to be keyboard-accessible and labeled,
So that I can play too (**NFR37–NFR44**).

**Acceptance Criteria:**

**Given** login, picks, and standings pages
**When** audited with keyboard and screen reader spot-checks
**Then** focus order, labels, landmarks, and live regions for validation meet Level A targets (**NFR37–NFR44**)

---

### Story 7.4: Performance and deployment hardening

As a user,
I want fast loads and safe deploys,
So that Sunday traffic and mid-season fixes do not break the season (**NFR1–NFR3**, **NFR5**, **NFR8**, **NFR19–NFR21**, **NFR51–NFR53**, **NFR49**).

**Acceptance Criteria:**

**Given** production build
**When** primary routes are measured (Lighthouse or RUM sampling)
**Then** documented budgets align with **NFR1–NFR3** for MVP (with known exceptions listed)
**And** primary state-changing flows (e.g. login, pick submit) meet **NFR5** completion-time budgets on the server/UI boundary, excluding variable network latency (document measurement method)
**And** touch interactions on core mobile pick flows meet **NFR8** responsiveness in manual or instrumented spot-checks
**And** hosting is Vercel (or equivalent) per **NFR53**; migrations are reversible **NFR52**; backup strategy documented **NFR49**; no planned deploys in critical windows **NFR21**

---

## Epic 8: Pre-season rehearsal league (simulation / testing mode)

**Goal:** Validate the full product with real people and real integrations (auth, email, mobile) **without** depending on the live NFL calendar or live odds APIs—ideal final gate before season start.

**Configuration:** The primary control is **league-level**: create or mark a league as a **test / rehearsal league** so simulation rules (fixtures, manual week advance, etc.) apply only to that league. **Turning off** rehearsal behavior for operators means either **deleting** the test league (see Story 8.7) or using a separate deploy; “production” leagues stay on the normal NFL clock. Optional **global** env flags (e.g. enable test-league creation on a staging host only) are supplementary.

### Story 8.1: Test league flag, labeling, and optional global gates

As a league admin,
I want to **configure a league as a test/rehearsal league** (or create one as such) with obvious labeling,
So that everyone knows it is practice data and our **real** league can stay on normal rules in the same app if needed.

**Acceptance Criteria:**

**Given** league metadata such as `isTestLeague` / `leagueKind: REHEARSAL` (exact field TBD in schema)
**When** a league is a test/rehearsal league
**Then** Epic 8 behaviors (simulated time, fixtures, etc.) apply **only** to that league’s rows—not to other leagues in the tenant (**data separation by league**)
**And** prominent **banner or copy** appears on main surfaces (picks, standings, emails if sent) indicating test/rehearsal
**And** at league creation (or settings, if allowed), the admin can set **test vs production** intent; document whether **changing** a league from test → production is supported (default: **create a new production league** for the real season to avoid mixed state)
**And** optional **deployment/env** toggles are documented (e.g. `ALLOW_TEST_LEAGUES=true`) so test features can be disabled entirely on a bare production deploy if desired
**And** separate Neon branch/database for a **staging** environment remains an optional ops choice, not required if test leagues are isolated by `leagueId`

---

### Story 8.2: Shortened simulated season and admin-driven week advancement

As a league admin,
I want to run **N weeks** (e.g. 4–6) that are **not** tied to real NFL wall time,
So that we can exercise pick → deadline → scoring → reveal repeatedly in an afternoon or over a few days.

**Acceptance Criteria:**

**Given** a **test/rehearsal** league with a configured **simulation week count**
**When** the admin triggers **advance simulation week** (and related transitions, e.g. “open picks,” “lock deadline,” “finalize week” as needed by existing domain model)
**Then** the app moves to the next simulated week **without** waiting for real Tuesday/Thursday/MNF
**And** participants see the correct week context for picks and standings after each advance
**And** behavior is **idempotent** or confirm-gated so accidental double-clicks do not skip weeks

---

### Story 8.3: Simulated odds and jailed team for rehearsal

As the system,
I want **fixture or seeded odds** (no live odds API required) for rehearsal weeks,
So that jailed-team logic and pick validation match production rules using controlled inputs.

**Acceptance Criteria:**

**Given** a **test/rehearsal** league
**When** odds are loaded for a simulation week
**Then** data comes from **JSON fixtures**, admin upload, or deterministic seed—not the production odds provider (**NFR26** pattern: explicit fallback path)
**And** **jailed team** is computed with the **same algorithm** as production (FR50–FR52) from the simulated snapshot
**And** Tuesday snapshot semantics can be **simulated** via admin action (“apply weekly odds snapshot”) if the real cron is not used

---

### Story 8.4: Simulated game results and scoring / reveal cycle

As a league admin,
I want to **enter or import outcomes** for rehearsal games,
So that scoring, leaderboard updates, and Tuesday-style reveal behave like a real week.

**Acceptance Criteria:**

**Given** locked picks for a simulation week
**When** the admin records winners (per game or per week, per UX) or runs a scripted outcome
**Then** **FR41–FR48** behaviors execute in rehearsal: points (**FR42**, **FR54**), standings, personal history, reveal rules (**FR47**, **FR48**)—using **simulation clock** driven by admin steps instead of MNF wall time (**NFR36** simulated)
**And** admin can always see picks (**FR49**) as in production

---

### Story 8.5: Email and scheduled jobs in rehearsal

As a league admin,
I want **explicit control** over whether rehearsal sends **real emails** and how **cron** interacts with simulation,
So that we can test deliverability with a small group or avoid spamming during dry runs.

**Acceptance Criteria:**

**Given** a **test/rehearsal** league (and optional global email policy)
**When** configuring the league or deployment
**Then** at least one policy is supported and documented: e.g. **send real emails** to invited testers; **suppress** outbound and surface “would-send” in admin UI; or **route** to a test domain
**And** Tuesday/mid-week/deadline **emails** (FR35–FR40) either fire on **admin-triggered “simulate send”** or respect a **rehearsal schedule** that is decoupled from production cron
**And** documentation lists env vars and safe defaults for a shared staging/rehearsal deploy

---

### Story 8.6: Rehearsal runbook for invited participants

As a league admin,
I want a **short runbook** (in-repo or internal doc),
So that invited testers know how many weeks we’re running, that data is fake, and how to report issues.

**Acceptance Criteria:**

**Given** Epic 8 features exist
**When** we prepare a pre-season dry run
**Then** a **runbook** covers: creating a **test league**, inviting users, advancing weeks, simulating outcomes, **deleting** the test league when finished, and starting fresh for the real season
**And** optional **checklist** maps core user journeys (pick, reminder, standings, admin override) for sign-off before NFL season

---

### Story 8.7: Delete test league and data cleanup

As a league admin (or system operator),
I want to **delete a test/rehearsal league** when we are done with the dry run,
So that leftover simulated data does not clutter the app and we can start clean for the real NFL season.

**Acceptance Criteria:**

**Given** a league marked as test/rehearsal
**When** the admin chooses **delete league** (with a **confirmation** step that names the league and warns irreversibility)
**Then** the league and **dependent data** (picks, weeks, invitations scoped to that league, etc.) are removed per a documented **cascade** or transactional delete strategy (**NFR25** does not require keeping test data forever—document retention exception for test leagues)
**And** **user accounts** that are also members of other leagues (or will join the real league) remain usable; only membership and data for **this** league are removed
**And** if full delete is deferred post-MVP, document an interim **archive/hide** path and track follow-up

---

## Workflow validation summary (Step 4)

- **FR coverage:** FR1–FR61 each appear in the FR Coverage Map and in at least one story acceptance path; scoring FR54 appears in Epic 3 (validation) and Epic 5 (points). **Team logos** are tracked in the coverage map (UX extension; **Story 3.8**). **Epic 8** is a **post-MVP rehearsal** capability (not a numbered FR); it exercises existing FRs under simulation. **Story 8.7** covers **deleting** test leagues; **Story 2.8** covers **FR61** (production admin delete).
- **NFR spot-check:** **NFR5** and **NFR8** are explicitly in **Story 7.4** acceptance criteria; other NFRs are cited per story inventory and ACs.
- **Starter template:** Story 1.1 matches architecture requirement for `create-next-app` as first implementation slice.
- **Incremental DB:** Models and tables are introduced in the first story that needs them (Users in 1.2; league/season in 2.1; schedule in 3.1; etc.).
- **Epic independence:** Later epics depend on earlier ones only as stacked product value (auth before league; league before picks; picks before full scoring reveal orchestration; email after core data paths)—no forward epic required for a prior epic’s *internal* completeness. **Epic 8** intentionally depends on core epics being built first (rehearsal wraps the real system).
- **Story order:** Stories within each epic depend only on earlier numbered stories in the same epic or completed prior epics.

---

**Confirm the Requirements are complete and correct to [C] continue:** _(Satisfied in-session: document complete.)_

**Select an Option:** [A] Advanced Elicitation [P] Party Mode [C] Continue _(N/A — workflow artifacts written.)_

**All validations complete!** [C] Complete Workflow _(Done.)_
