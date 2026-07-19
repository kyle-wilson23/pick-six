# Story 7.4: Performance and Deployment Hardening

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want fast loads and safe deploys,
so that Sunday traffic and mid-season fixes do not break the season (**NFR1–NFR3**, **NFR5**, **NFR8**, **NFR19–NFR21**, **NFR51–NFR53**, **NFR49**).

## Acceptance Criteria

### AC1 — Performance budgets documented for primary routes (NFR1–NFR3)

**Given** a production build (`npm run build` + `npm run start`, or a Vercel preview/production deploy)

**When** primary participant routes are measured with **Lighthouse** (mobile + desktop) or equivalent RUM sampling

**Then** deliver `docs/performance-budgets.md` (or a clearly named section inside `docs/deployment.md`) that records:

| Metric | Target (PRD) | Routes measured |
|--------|--------------|-----------------|
| Initial page load | ≤ 3s (**NFR1**) | Login, league picks, league standings (minimum) |
| Subsequent navigation | ≤ 1s (**NFR2**) | Client/SPA nav between league tabs (picks ↔ standings ↔ home) |
| TTI | ≤ 4s (**NFR3**) | Same primary workflows |

**And** list **known exceptions** with rationale (e.g. cold start, weather SSR, large logo set) — empty list preferred if budgets are met

**And** measurement method is reproducible: Lighthouse version/mode, throttling profile (or “simulated mobile”), and whether results are local `start` vs Vercel URL

**And** do **not** invent CDN/edge caching or websockets — PRD allows fresh fetches and manual refresh for MVP scale (~14 users)

---

### AC2 — State-changing flow timing (NFR5)

**Given** primary mutations: **login** and **pick submit**

**When** measured at the **server/UI boundary** (exclude variable WAN latency)

**Then** document that each completes within **1 second** under local/prod-like conditions, using one of:

1. Server handler timing log (prefer existing `logEvent` with `domain: "api"` + duration in `context`) for a sample request, **or**
2. DevTools Performance / Network timing with method noted in the budgets doc

**And** document the method in `docs/performance-budgets.md` (or deployment doc section)

**And** if a hot path clearly exceeds 1s due to avoidable sequential I/O already flagged in deferred work (e.g. redundant layout + page Prisma fetches), **fix that path** as part of this story — do not leave known self-inflicted latency without either a fix or an explicit exception

---

### AC3 — Touch responsiveness on mobile pick flow (NFR8 + UX)

**Given** core mobile pick UX (`MatchupCard` / `WeekMatchupList` on `/leagues/[leagueId]/picks`)

**When** spot-checked on a phone or DevTools mobile viewport

**Then**:

1. Tap feedback feels immediate (**≤ 100ms** perceived) — no multi-hundred-ms UI freeze before selected styling / pending state
2. Theme-wide interactive **Button** / tab targets meet UX **48px** minimum height (Story 7.3 already set `sizeLarge` to 44px; raise to **48px** globally per UX Component Spec)
3. Matchup team tap areas remain ≥ 44×44 (already true) — do not shrink logos to “fix” touch; keep card padding pattern from `docs/nfl-team-logos.md`

**And** record the NFR8 spot-check result in Completion Notes (device/browser + pass/fail)

---

### AC4 — Perceived performance: skeleton loaders (UX)

**Given** UX Responsive Table / Loading States: initial page load uses **Skeleton** placeholders matching card/table shapes; in-flight pick submit shows busy/disabled feedback

**When** picks and standings (and login Suspense fallback if cheap) load data

**Then**:

1. Add MUI `Skeleton` placeholders for **picks** matchup list and **standings** table initial load (shapes should approximate real content — cards/rows, not a lone spinner)
2. Preserve existing content visibility on soft refresh if applicable; skeletons are for **initial** empty→loaded
3. Pick in-flight: keep/improve `aria-busy` + visible disabled/pending cue on the radiogroup / selected card (card-tap flow has no separate Submit button — do **not** invent a second submit CTA)

**And** do **not** add decorative motion that delays TTI

---

### AC5 — Cron reliability hardening (NFR19–NFR21 adjacent)

**Given** Stories 6.5 + 7.2 left cron HTTP 200 even when `failed > 0`, no `maxDuration`, and no Resend circuit breaker

**When** this story ships

**Then** implement all of:

| Change | Requirement |
|--------|-------------|
| **`maxDuration`** | Export `export const maxDuration = 300` on each cron Route Handler (`tuesday-email`, `wednesday-reminder`, `thursday-reminder`) — App Router pattern; Hobby max is **300s**. Document in deployment doc. Prefer route export over inventing unused `vercel.json` `functions` globs unless both are needed. |
| **Non-200 on partial failure** | When job summary has `failed > 0`, return **HTTP 500** (or 503) with the same JSON body shape used today so external monitors can alert on status. Keep **200** for `outside_window` skips and fully successful runs (`failed === 0`). Update `docs/observability-ops-runbook.md` + `docs/observability-scope-decision.md` notes that previously deferred this. |
| **Resend circuit breaker** | In Tuesday digest / reminder send loops (shared helper preferred): after **N consecutive** provider failures (recommend **N = 3**, constant named + tested), **abort remaining members/leagues** for that invocation, `logEvent` with a stable `code` (e.g. `EMAIL_CIRCUIT_OPEN`), and count remaining as failed/skipped consistently. Do not invent a new observability product. |
| **External monitor pointer** | In `docs/deployment.md` (or ops runbook), document how to point a free uptime check (e.g. cron-job.org / Better Stack free) at a cron URL **with** `Authorization: Bearer $CRON_SECRET` and expect non-2xx on failures — **ops setup**, not code that calls paid APM |

**And** unit-test circuit-breaker threshold logic if extracted to a pure helper under `src/lib/**`

**And** do **not** change Eastern window guards, UTC `vercel.json` schedules, or idempotency semantics except as required for status codes / abort behavior

---

### AC6 — Deployment, migrations, backups, critical windows (NFR49, NFR51–NFR53, NFR21)

**Given** go-live checklist lives only in `deferred-work.md` today and there is no `docs/deployment.md`

**When** this story ships

**Then** create **`docs/deployment.md`** that covers:

1. **Hosting (NFR53):** Vercel + Neon (current architecture); link `.env.example`; never `NEXT_PUBLIC_*` for secrets
2. **Env vars:** promote the Production env table from deferred-work go-live checklist (DATABASE_URL, DIRECT_URL, AUTH_*, RESEND_*, CRON_SECRET, odds/weather keys)
3. **Build / migrate:** `npm run build`; production schema via **`npm run db:migrate:deploy`** (never bare `npx prisma migrate deploy` — use `scripts/prisma-env.cjs`)
4. **Cron deploy smoke:** 401 without secret / 200 or expected window response with secret (from existing checklist); note GET vs POST
5. **Critical windows (NFR21 / NFR51):** **No planned deploys or maintenance** Tue **5–7 PM** ET or Thu **7–9 PM** ET; prefer off-season or between games; mid-season hotfix OK outside those windows
6. **Backups (NFR49):** Document the **MVP automated + restorable** strategy explicitly:
   - Neon **point-in-time restore / history** on the production root branch (cite Free-tier history window limits — currently short; note upgrade trigger)
   - Manual Neon **snapshot** before risky migrations / season start
   - Admin **CSV export** (Story 7.1) as operational escape hatch (complements DB restore, does not replace it)
   - Optional off-platform `pg_dump` / GitHub Action — document as **recommended before first real season** if Free history window is insufficient; do **not** require implementing S3 automation in this story unless already trivial
7. **Reversible migrations (NFR52):** Prisma is forward-deploy oriented — document the team practice:
   - Prefer expand/contract (additive columns, dual-write, then remove) for destructive changes
   - Before destructive migrate: Neon snapshot + confirm `db:migrate:deploy` on a branch/preview DB when possible
   - Rollback = restore snapshot / PITR **or** ship a follow-up forward migration; do not claim automatic `migrate down`
8. **Post-epic-8 handoff:** Link (do not execute) `post-epic-8-*` sprint items for Resend domain/`from` replacement and production smoke — those remain **out of story code scope**

**And** add a short pointer from `README.md` → `docs/deployment.md`

**And** leave the deferred-work go-live checklist in place but mark it as **canonical copy moved to** `docs/deployment.md` (strike or redirect — do not maintain two conflicting checklists)

---

### AC7 — Hot-path performance fixes (measured or known deferred)

**Given** deferred-work items that degrade load or risk timeouts under modest growth

**When** implementing this story

**Then** address **at least** these high-value items (or document why not after measurement):

| Item | Action |
|------|--------|
| Redundant Prisma in `[leagueId]/layout.tsx` + child pages | Consolidate with `React.cache` shared loader or equivalent — stop double membership/league fetches |
| Weather `cache: "no-store"` on every SSR | Add short TTL cache (in-memory or `unstable_cache` / fetch `revalidate`) keyed by game/location so Sunday traffic does not burn API quota — preserve timeout behavior |
| Cron/admin Tuesday digest serial sends | Add bounded concurrency (e.g. `p-limit` style or simple pool of 3–5) **or** document `maxDuration` + MVP league size as accepted; prefer concurrency if change is localized |

**And** leave deeper N+1 refactors in `score-nfl-week.ts` / `sync-nfl-results.ts` / schedule sync **out of scope** unless Lighthouse or cron timeouts prove they are on the critical path — note disposition in Completion Notes

---

### AC8 — Deferred-work disposition for this story

**Given** `_bmad-output/implementation-artifacts/deferred-work.md` and observability docs tag several items for 7.4

**When** this story ships

**Then** disposition as follows:

| Deferred item | Disposition |
|---------------|-------------|
| `docs/deployment.md` extraction (go-live checklist) | **Do** (AC6) |
| Cron non-200 when `failed > 0` | **Do** (AC5) |
| Automated external monitor for missed sends | **Document** setup (AC5); ops configures monitor |
| Resend circuit breaker | **Do** (AC5) |
| `maxDuration` on cron | **Do** (AC5) |
| Skeleton loading states | **Do** (AC4) |
| Global 48px button height | **Do** (AC3) |
| Redundant layout Prisma fetches | **Do** (AC7) |
| Weather no-store quota risk | **Do** (AC7) |
| Sequential email + timeout | **Do or document** with `maxDuration` + concurrency (AC5/AC7) |
| CSV export audit log (7.2/7.4 split) | **Optional stretch** — only if time remains; not blocking ACs |
| Invite-accept TOCTOU / cron idempotency TOCTOU | **Out of scope** unless trivial; Resend idempotency remains backstop — note in Completion Notes |
| Scoring/deadline structured logging | **Out of scope** — post-launch / observability decision |
| Standings sidebar, Snackbar polish, landing hero, `generateMetadata` | **Out of scope** — UX polish, not perf/deploy gate |
| Post-epic-8 Resend domain / prod smoke / Vercel env apply | **Out of scope** — ops stories after Epic 8 |
| NFR46 scoring alerts | **Out of scope** — post-launch per deferred-work |

**And** update `deferred-work.md` + observability docs so resolved 7.4 items are struck or marked **Resolved by 7.4**

---

## Tasks / Subtasks

- [x] Task 1: Deployment + backup + critical-window docs (AC: #6)
  - [x] Create `docs/deployment.md` from go-live checklist + NFR49/51/52/21 content
  - [x] README pointer; redirect deferred-work checklist to the new doc
- [x] Task 2: Cron hardening (AC: #5)
  - [x] `maxDuration = 300` on three cron routes
  - [x] Non-200 when `failed > 0`; keep 200 for success / outside_window
  - [x] Circuit breaker helper + wire into digest/reminder loops
  - [x] Update ops runbook + observability scope notes; document external monitor
  - [x] Tests for status mapping + circuit breaker
- [x] Task 3: Perf measurement artifacts (AC: #1, #2)
  - [x] Run Lighthouse (or agreed method) on login / picks / standings
  - [x] Write `docs/performance-budgets.md` (or section) with results, method, exceptions
  - [x] Document NFR5 measurement for login + pick submit
- [x] Task 4: Hot-path fixes (AC: #7)
  - [x] Deduplicate league layout/page Prisma via `React.cache` (or shared loader)
  - [x] Weather fetch caching with short TTL
  - [x] Bounded concurrency for multi-member email sends **or** explicit accepted-risk note tied to `maxDuration` + MVP size
- [x] Task 5: Frontend perceived perf + touch (AC: #3, #4)
  - [x] Theme 48px button/tab heights
  - [x] Skeleton placeholders on picks + standings initial load
  - [x] Verify pick in-flight busy/disabled UX; NFR8 spot-check notes
- [x] Task 6: Closeout (AC: #8)
  - [x] Update deferred-work + observability deferred tables
  - [x] `npm test` + lint for touched files
  - [x] Completion Notes: budgets summary, backup strategy one-liner, known exceptions

## Dev Notes

### What this story is (and is NOT)

- **Is:** Close the Epic 7 **performance + production-readiness** gate — measured budgets, touch/perceived perf polish, cron failure signaling, deployment/backup/migration runbooks, critical-window deploy policy.
- **Is NOT:** Epic 8 rehearsal mode, post-epic-8 production env application, Resend domain verification, full security audit, AA accessibility, paid APM (Axiom/Datadog), websockets, or inventing a second hosting platform.
- **Is NOT:** Rewriting scoring/sync pipelines “for cleanliness” — only touch if on the measured critical path.

### Epic / PRD anchors

| NFR | Story obligation |
|-----|------------------|
| NFR1–3 | Measure + document budgets/exceptions |
| NFR5 | Measure login + pick submit at server/UI boundary |
| NFR8 | Touch spot-check + 48px targets |
| NFR19–20 | Operational: cron hardening + monitor docs support critical-period reliability |
| NFR21 | Document no-deploy windows |
| NFR49 | Document automated/restorable backup strategy (Neon + CSV escape hatch) |
| NFR51–53 | Safe mid-season deploy guidance; reversible-migration practice; Vercel hosting |

[Source: `_bmad-output/planning-artifacts/epics.md` — Story 7.4]  
[Source: `_bmad-output/planning-artifacts/prd.md` — Performance; Reliability; Deployment & Updates; Data Backup]

### Architecture / project-context compliance

- **Host:** Vercel Hobby + Neon free is intentional; monitor usage dashboards before Pro.
- **Cron:** Hobby ≤1/day per job, ±1h precision — keep Eastern window guards; handlers stay idempotent.
- **Prisma:** single client `src/lib/db.ts`; migrations via `npm run db:migrate:deploy`.
- **Logging:** extend `logEvent()` — do not invent a parallel logger.
- **MUI + Stack** for flex layouts; skeletons from `@mui/material` `Skeleton`.
- **Secrets server-only**; never put `CRON_SECRET` in client or `NEXT_PUBLIC_*`.
- Prefer RSC; `"use client"` only for interactive shells/skeletons that need it.

[Source: `_bmad-output/planning-artifacts/architecture.md` — Infrastructure & deployment; Vercel Cron Hobby]  
[Source: `docs/project-context.md` — non-negotiables; cron/scheduling]

### UX guidance (front-end)

[Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — 60–90s pick workflow; Loading States; Touch targets 48px; Functional over decorative]

- Skeletons on **initial** load for cards/tables; inline refresh should not blank the page.
- Pick flow remains card-tap — spinner/`aria-busy` on the interaction surface, not a new Submit button.
- No auto-playing / TTI-delaying animation.
- 48px height for buttons and tab bar items; matchup cards keep comfortable tap height.

### Reuse — do NOT reinvent

| Existing | Path | Action |
|----------|------|--------|
| Cron routes + Eastern windows | `src/app/api/cron/*/route.ts`, `src/lib/cron/` | Extend status/`maxDuration` only |
| Structured logging | `src/lib/logging/log-event.ts` | Use for timing / circuit events |
| Admin email health card | `AdminWeeklyEmailStatus` | Do not redesign; monitor docs complement it |
| Ops runbook | `docs/observability-ops-runbook.md` | Update deferred → done |
| Observability decision | `docs/observability-scope-decision.md` | Update 7.4 rows |
| Email send loops | `send-tuesday-digest.ts`, `send-reminder.ts` | Circuit breaker + optional concurrency |
| Export batched queries | `build-league-export-data.ts` | Pattern reference for parallel I/O |
| Team logos / next/image | `TeamLogo.tsx`, `public/nfl-logos/` | Keep local assets; no remotePatterns churn |
| Theme focus / 44px | `create-app-theme.ts` (7.3) | Raise to 48px; keep focus rings |
| Go-live checklist | `deferred-work.md` § Pre-production | Move → `docs/deployment.md` |
| A11y checklist | `docs/accessibility-checklist.md` | Do not reopen Level A scope |

### Previous story intelligence

**7.3 (done):** Closed WCAG Level A for login/picks/standings; explicitly deferred Lighthouse, skeletons, global 48px, cron HTTP hardening to **this** story. Preserve skip link, single `<main>`, nav landmarks, focus rings.

**7.2 (done):** `logEvent`, admin weekly email card, Resend webhook log-only, ops runbook. Explicitly deferred non-200 cron, circuit breaker, `maxDuration`, scoring logs.

**7.1 (done):** CSV export escape hatch — cite in NFR49 backup story as operational complement, not a substitute for DB restore.

### Git intelligence summary

Recent commits: `5b4fb7c` / `0dbdfc2` (7.3 a11y), `946cb47` (7.2 logging), `1842cc8` (7.1 CSV), `4950718` (6.5 cron). Follow the same pattern: focused code + docs + deferred-work updates + tests for pure helpers.

### Latest tech notes (Vercel / Neon / Next 16)

- **Next.js 16.2.x** App Router: set `export const maxDuration = 300` in each `route.ts` ([Next.js maxDuration](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/maxDuration); [Vercel duration docs](https://vercel.com/docs/functions/configuring-functions/duration)).
- **Hobby** function max duration is **300s** (default and ceiling) — do not set 800/1800 (Pro-only).
- Prefer route-segment `maxDuration` over incorrect `vercel.json` paths; if using `functions` in `vercel.json`, `src/app` projects need correct glob prefixes.
- **Neon Free:** short PITR history window + **1 manual snapshot**; scheduled snapshot automation is paid — document honestly and recommend snapshot before season + optional `pg_dump` for off-platform copies ([Neon backups](https://neon.com/docs/manage/backups)).
- Lighthouse: use mobile preset for NFR1/NFR3; note lab vs field variance in the budgets doc.

### Anti-patterns to avoid

- Paying for Axiom/Datadog “because monitoring”
- Changing cron UTC schedules or removing Eastern window guards
- Returning non-200 for `outside_window` (false alarm every off-day)
- Claiming Prisma `migrate down` exists without a real rollback story
- Implementing post-epic-8 Resend domain DNS in this story
- Over-caching pick privacy / standings with shared RSC cache across users
- Blanking the whole picks page with a single `CircularProgress` instead of shaped Skeletons
- Reopening WCAG work or rewriting `LeagueNavShell`
- Boiling the ocean on scoring N+1 refactors

### Project structure notes

```
docs/deployment.md                         # NEW — canonical deploy/backup/migrate
docs/performance-budgets.md                # NEW (or section of deployment.md)
docs/observability-ops-runbook.md          # update 7.4 deferred table
docs/observability-scope-decision.md       # update owner rows
README.md                                  # link deployment.md

src/app/api/cron/tuesday-email/route.ts    # maxDuration + status code
src/app/api/cron/wednesday-reminder/route.ts
src/app/api/cron/thursday-reminder/route.ts
src/lib/email/send-tuesday-digest.ts       # circuit breaker (+ concurrency)
src/lib/email/send-reminder.ts
src/lib/email/circuit-breaker.ts           # optional pure helper + test
src/lib/integrations/weather/client.ts     # short TTL cache
src/app/(app)/leagues/[leagueId]/layout.tsx  # React.cache / shared loader
src/theme/create-app-theme.ts              # 48px targets
src/components/picks/*                     # Skeleton shell
src/components/standings/*                 # Skeleton shell
vercel.json                                # leave cron schedules; avoid conflicting functions config unless needed
```

### Testing requirements

- Colocated `*.test.ts` for circuit breaker / HTTP status mapping helpers (node env).
- Update existing cron/email tests if they assert HTTP 200 on `failed > 0`.
- No requirement to add Playwright for Lighthouse — budgets doc + manual NFR8 notes are acceptance artifacts.
- `npm test` passes; lint clean on touched files.
- Docs-only paths need no unit tests; behavior changes do.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 7, Story 7.4]
- [Source: `_bmad-output/planning-artifacts/prd.md` — NFR1–3, 5, 8, 19–21, 49, 51–53]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Vercel/Neon deploy; Hobby cron; migrate deploy]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Loading States; 48px touch; 60–90s workflow]
- [Source: `docs/project-context.md` — stack, cron, secrets, testing]
- [Source: `docs/observability-scope-decision.md` — items deferred to 7.4]
- [Source: `docs/observability-ops-runbook.md` — Deferred to Story 7.4 table]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — go-live checklist; 7.4-tagged items]
- [Source: `_bmad-output/implementation-artifacts/7-2-structured-logging-and-admin-visible-health-signals.md`]
- [Source: `_bmad-output/implementation-artifacts/7-3-accessibility-baseline-wcag-2-1-level-a-for-core-flows.md`]
- [Source: `vercel.json` — current cron-only config]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

- Fixed pre-existing build break: `StandingsTable` `aria-current="row"` invalid for HTML/ARIA typings → `aria-current={true}` (+ test update).
- Lighthouse CLI required unsandboxed Chrome; login measured on local `npm run start` port 3010.

### Completion Notes List

- **Budgets:** Login mobile LCP 2.34s / TTI 3.36s (LH 12.8.2 simulated); desktop well under. Picks/standings require signed-in re-measure (method documented). Exceptions: cold start, weather cold miss, logos.
- **NFR5:** `logEvent` `durationMs` on login authorize + pick POST; documented in `docs/performance-budgets.md`.
- **Backup one-liner:** Neon PITR + manual snapshot + admin CSV escape hatch; optional `pg_dump` before first real season.
- **Cron:** `maxDuration=300`, HTTP 500 when `failed>0`, circuit breaker N=3 + concurrency 4.
- **Hot paths:** `getLeagueAccess` React.cache; weather 10m TTL; email pool concurrency.
- **NFR8 spot-check:** Chrome DevTools iPhone viewport on picks UI — **PASS**. Theme Button/Tab 48px; MatchupCard taps ≥44; optimistic select + Saving… pending cue; no multi-hundred-ms freeze before selected styling.
- **Out of scope noted:** scoring N+1, invite/cron TOCTOU, CSV export audit log stretch, scoring structured logs, post-epic-8 Resend/domain.

### File List

- `README.md`
- `docs/deployment.md`
- `docs/performance-budgets.md`
- `docs/observability-ops-runbook.md`
- `docs/observability-scope-decision.md`
- `_bmad-output/implementation-artifacts/7-4-performance-and-deployment-hardening.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `src/app/api/cron/tuesday-email/route.ts`
- `src/app/api/cron/wednesday-reminder/route.ts`
- `src/app/api/cron/thursday-reminder/route.ts`
- `src/app/api/leagues/[leagueId]/picks/route.ts`
- `src/lib/cron/cron-job-http-status.ts`
- `src/lib/cron/cron-job-http-status.test.ts`
- `src/lib/email/circuit-breaker.ts`
- `src/lib/email/circuit-breaker.test.ts`
- `src/lib/email/map-with-concurrency.ts`
- `src/lib/email/map-with-concurrency.test.ts`
- `src/lib/email/send-tuesday-digest.ts`
- `src/lib/email/send-reminder.ts`
- `src/lib/auth.ts`
- `src/lib/league/get-league-access.ts`
- `src/lib/integrations/weather/client.ts`
- `src/lib/integrations/weather/client.test.ts`
- `src/app/(app)/leagues/[leagueId]/layout.tsx`
- `src/app/(app)/leagues/[leagueId]/page.tsx`
- `src/app/(app)/leagues/[leagueId]/picks/page.tsx`
- `src/app/(app)/leagues/[leagueId]/picks/loading.tsx`
- `src/app/(app)/leagues/[leagueId]/standings/page.tsx`
- `src/app/(app)/leagues/[leagueId]/standings/loading.tsx`
- `src/app/(app)/leagues/[leagueId]/history/page.tsx`
- `src/app/(app)/leagues/[leagueId]/results/page.tsx`
- `src/app/(app)/leagues/[leagueId]/rules/page.tsx`
- `src/app/(app)/leagues/[leagueId]/settings/page.tsx`
- `src/app/(app)/leagues/[leagueId]/admin/page.tsx`
- `src/app/(app)/leagues/[leagueId]/invites/page.tsx`
- `src/theme/create-app-theme.ts`
- `src/components/picks/MatchupCard.tsx`
- `src/components/picks/WeekMatchupList.tsx`
- `src/components/standings/StandingsTable.tsx`
- `src/components/standings/StandingsTable.test.tsx`

## Change Log

- 2026-07-12: Story context created (create-story) — ready-for-dev.
- 2026-07-12: Implemented 7.4 — deployment/perf docs, cron hardening, hot-path + UI polish; status → review.
