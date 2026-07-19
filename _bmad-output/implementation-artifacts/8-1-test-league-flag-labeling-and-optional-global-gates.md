# Story 8.1: Test League Flag, Labeling, and Optional Global Gates

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a league admin,
I want to **configure a league as a test/rehearsal league** (or create one as such) with obvious labeling,
so that everyone knows it is practice data and our **real** league can stay on normal rules in the same app if needed.

## Acceptance Criteria

### AC1 — Persist test/rehearsal league metadata (schema)

**Given** the Prisma `League` model today has only `id` / `name` / timestamps

**When** this story ships

**Then** add a boolean on `League`:

```prisma
isTestLeague Boolean @default(false) @map("is_test_league")
```

**And** generate a Prisma migration via `npm run db:migrate` (dev) so existing rows default to `false` (production leagues stay production)

**And** do **not** introduce a `leagueKind` enum in this story — boolean is sufficient for Epic 8 gating; revisit only if a later story needs more than two kinds

**And** JSON/API responses that expose league identity include `isTestLeague` as camelCase (architecture: camelCase JSON, snake_case DB)

---

### AC2 — Create-time test vs production intent

**Given** an authenticated user on `/leagues/new` creating a league via `POST /api/leagues`

**When** they submit the create form

**Then**:

1. Form includes a clear control (prefer MUI `Checkbox` + `FormControlLabel` in a `Stack`) labeled approximately **“Test / rehearsal league”** with helper text that this league is for practice data and is **not** the real season league
2. Zod `createLeagueBodySchema` accepts optional `isTestLeague` boolean (default `false`)
3. Transaction creates the `League` row with the chosen flag (existing Season + ADMIN membership flow unchanged)
4. Response JSON includes `isTestLeague`

**And** **changing** a league from test → production (or production → test) after creation is **not supported** in this story — settings may show the flag as **read-only**; document that the real season should be a **new production league** to avoid mixed rehearsal/production state

**And** do **not** gate FR61 / Story 2.8 delete on `isTestLeague` — production delete remains available for any administered league

---

### AC3 — Optional global env gate (`ALLOW_TEST_LEAGUES`)

**Given** operators may want to disable test-league creation on a bare production deploy

**When** `ALLOW_TEST_LEAGUES` is set to `false` or `0` (case-insensitive trim)

**Then**:

1. `POST /api/leagues` with `isTestLeague: true` returns **403** with a stable error code (e.g. `TEST_LEAGUES_DISABLED`) and a clear message
2. Create form **hides** the test-league checkbox (or disables it with explanation) — pass a server-derived `allowTestLeagues` boolean into the page/form; do **not** put secrets in `NEXT_PUBLIC_*`
3. Creating a normal (`isTestLeague: false`) league still works

**When** the env var is **unset** or set to `true` / `1`

**Then** test-league creation is allowed (permissive default so local + shared rehearsal deploys need no extra config)

**And** document the variable in `.env.example` and `docs/deployment.md` (optional ops toggle; not a secret)

**And** extract parse helper under `src/lib/league/` (e.g. `allow-test-leagues.ts`) with colocated Vitest coverage for truthy/falsy/unset

---

### AC4 — Prominent labeling on main in-app surfaces (UX)

**Given** UX: “Optional **test leagues** must be visually distinct (banner/chip) so participants do not mistake simulated or accelerated weeks for the real season”

**When** `league.isTestLeague === true`

**Then** show clear rehearsal labeling on **at least**:

| Surface | Requirement |
|---------|-------------|
| **Picks** (`/leagues/[leagueId]/picks`) | Persistent banner (not only when `isPreview`) — distinct copy from `PicksPreviewBanner` |
| **Standings** (`/leagues/[leagueId]/standings`) | Same banner pattern |
| **League shell** (`LeagueNavShell`) | Chip or equivalent next to league name (covers all tabs including history/results/admin) |
| **League home** | Visible in H1 area or immediately under title |
| **League lists** (`/leagues`, `/my-leagues`) | Chip or suffix so admins/participants can tell test vs real at a glance |

**And** recommended copy (tweak for tone, keep meaning):

- Banner title: **Test / rehearsal league**
- Banner body: **Practice data only — not your real season standings or picks.**
- Chip label: **Test** or **Rehearsal**

**And** reuse the existing client Alert pattern from `PicksPreviewBanner` (`Alert severity="info"` + `Stack` + Typography) — extract a shared `TestLeagueBanner` under `src/components/league/` (not under `picks/`)

**And** do **not** confuse with pre-season **Preview – picks not yet open** — both may appear together on picks; keep them separate components

**And** a11y: banner text is readable by screen readers (prefer MUI `Alert`); Chip has a meaningful `label` (not icon-only); follow Story 7.3 patterns (no decorative-only distinction)

**And** MUI leaf with theme `sx` callbacks → `"use client"` per project RSC rules

---

### AC5 — Email labeling when messages are sent

**Given** invite / Tuesday digest / Wed–Thu reminder emails already include `leagueName` in subject and H1

**When** the league is a test/rehearsal league and an email is sent (or previewed)

**Then**:

1. Subject includes a clear prefix, e.g. `[TEST]` before or inside the existing bracket pattern — examples:
   - Invite: `[TEST] You're invited to join {leagueName} on Pick Six`
   - Tuesday: `[TEST][{leagueName}] Week {n} — Tuesday Update` (or equivalent unambiguous form)
2. HTML body includes a short rehearsal notice near the top (plain text sentence is enough — no need for a full marketing banner component)

**And** thread `isTestLeague` from league row through email data loaders (`get-tuesday-digest-data`, `get-reminder-data`, invitation send path) — do not parse league name for the word “test”

**And** admin Tuesday **preview** route/UI should show the same subject/body labeling so admins see what participants get

---

### AC6 — Data separation foundation for later Epic 8 stories

**Given** Stories 8.2–8.5 will add simulation clock, fixtures, and email policy

**When** this story ships

**Then**:

1. Provide a small pure helper (e.g. `isTestLeagueLeague(league: { isTestLeague: boolean })` or just rely on the field) and ensure **all league loaders used by shell/lists/emails** select `isTestLeague`
2. Document in Dev Notes / Completion Notes: **every Epic 8 simulation behavior MUST no-op or 403 for `isTestLeague === false`** — never apply rehearsal rules globally
3. Isolation remains by `leagueId` (existing multi-tenancy); a separate Neon staging DB is **optional** and **not required**

**And** do **not** implement week advancement, fixture odds, simulated results, or rehearsal email policy in this story

---

### AC7 — Settings read-only visibility

**Given** `/leagues/[leagueId]/settings` already shows read-only league name and season metadata

**When** the league is a test league (or not)

**Then** show a read-only row such as **League type: Test / rehearsal** vs **Production (real season)**

**And** no toggle control to flip the flag post-create

---

## Tasks / Subtasks

- [x] Task 1: Schema + migration (AC: #1)
  - [x] Add `isTestLeague` to `League` in `prisma/schema.prisma`
  - [x] Create migration with `@default(false)` for existing rows
  - [x] Confirm `npm run db:migrate` / `db:migrate:deploy` path from `docs/deployment.md`
- [x] Task 2: Env gate helper + docs (AC: #3)
  - [x] `src/lib/league/allow-test-leagues.ts` + `*.test.ts`
  - [x] `.env.example` + `docs/deployment.md` optional var row
- [x] Task 3: Create API + form (AC: #2, #3)
  - [x] Extend `create-league-body.ts` + tests
  - [x] Persist flag in `POST /api/leagues` transaction; enforce env gate → 403
  - [x] Update `create-league-form.tsx` + `/leagues/new` page props for `allowTestLeagues`
  - [x] Include `isTestLeague` in create response + GET admin list serializers if lists show the chip
- [x] Task 4: Propagate flag through loaders (AC: #4, #6, #7)
  - [x] Extend `getLeagueAccess` league select
  - [x] Extend `list-administered-leagues` / `list-joined-leagues` types + queries + tests
  - [x] Pass `isTestLeague` into `LeagueNavShell` from layout
  - [x] Settings read-only league type row
- [x] Task 5: UI labeling (AC: #4)
  - [x] Add `TestLeagueBanner` (+ optional `TestLeagueChip`) under `src/components/league/`
  - [x] Wire picks + standings pages; home; `/leagues` + `/my-leagues` lists
  - [x] Keep distinct from `PicksPreviewBanner`
- [x] Task 6: Email labeling (AC: #5)
  - [x] Thread `isTestLeague` in digest/reminder/invite data + senders
  - [x] Subject prefix + body notice; preview parity
  - [x] Update any email template tests if present
- [x] Task 7: Closeout
  - [x] `npm test` for touched helpers
  - [x] Manual smoke: create test league (gate on/off), confirm banners/chip/lists/emails; create production league with no labels
  - [x] Note deferred-work disposition (none required in-scope; see Dev Notes)

### Review Findings

- [x] [Review][Decision→Patch] Mobile viewport has zero rehearsal indication on shell-only tabs — AC4 requires the `LeagueNavShell` chip to "cover all tabs including history/results/admin," but `LeagueNavShell.tsx` only rendered the `AppBar` (which holds `TestLeagueChip`) when `isDesktop` is true; on mobile, only `BottomNavigation` rendered (icons/labels, no chip). **Resolved:** added a slim sticky mobile header strip (league name + `TestLeagueChip`) rendered whenever `!isDesktop && isTestLeague`, above the page content on every tab — `src/components/league/LeagueNavShell.tsx`.
- [x] [Review][Patch] Unsanitized league name flowed into a raw response header and a regex-replacement string in the Tuesday preview route [src/app/api/leagues/[leagueId]/email/tuesday-preview/route.ts] — **Fixed:** added `sanitizeHeaderValue` (strips CR/LF/NUL and non-Latin-1 chars) before setting `X-Email-Subject`, and switched the `<body>` splice to a replacer **function** so literal `$`-sequences in the league name can't be reinterpreted by `String.prototype.replace`.
- [x] [Review][Patch] Digest/reminder loader tests never asserted the `isTestLeague: true` pass-through [src/lib/email/get-tuesday-digest-data.test.ts, src/lib/email/get-reminder-data.test.ts] — **Fixed:** added a `true`-case test to each, mirroring the list-mapper test coverage pattern.
- [x] [Review][Patch] `POST /api/signup/invite/accept` response omitted `isTestLeague` [src/app/api/signup/invite/accept/route.ts] — **Fixed:** threaded `isTestLeague` through `acceptLeagueInvitation` (`src/lib/accept-league-invitation.ts`) and included it in the route's JSON response, consistent with the other league-identity-exposing endpoints.
- [x] [Review][Defer] No direct route-handler test for the new `POST /api/leagues` `TEST_LEAGUES_DISABLED` 403 path [src/app/api/leagues/route.ts:112-122] — deferred, pre-existing (no `route.ts` in this codebase has a colocated integration test; consistent with the project's existing test-strategy of unit-testing pure helpers/loaders only, not Route Handlers directly)

## Dev Notes

### What this story is (and is NOT)

| **Is** | **Is NOT** |
|--------|------------|
| League-level `isTestLeague` flag + migration | Simulated week clock / admin week advance (**8.2**) |
| Create-time checkbox + optional env disable | Fixture/seed odds or jailed overrides (**8.3**) |
| Prominent banner/chip labeling (UX) | Simulated game results / scoring / reveal (**8.4**) |
| Email subject/body rehearsal markers | Email suppress / simulate-send / cron rehearsal policy (**8.5**) |
| Read-only settings visibility + docs | Rehearsal runbook (**8.6**) |
| Foundation so later stories can gate by league | Delete/cleanup of test leagues (**8.7** — reuse Story 2.8) |
| | Post-epic-8 Vercel/Resend/prod smoke ops items |
| | Separate Neon staging as a hard requirement |
| | Flipping test ↔ production after create |

### Locked product decisions (do not re-litigate in implementation)

1. **Field name:** `isTestLeague` boolean — not `leagueKind` enum.
2. **Immutability:** Create-time only; no post-create flip. Real season = new production league.
3. **Env semantics:** Unset/`true`/`1` → allow test creation; `false`/`0` → deny + hide UI. Permissive default.
4. **Delete:** Story 2.8 already deletes any administered league; do not require test flag for FR61.
5. **Isolation:** By `leagueId` + flag; staging DB optional.

### Reuse — do NOT reinvent

| Need | Reuse |
|------|--------|
| Create league flow | `POST /api/leagues`, `createLeagueBodySchema`, `CreateLeagueForm`, CSRF `assertCookieSessionMutationOrigin`, `$transaction` League+Season+ADMIN |
| League shell data | `getLeagueAccess` (`React.cache`) — extend select; pass boolean into `LeagueNavShell` |
| Banner UI pattern | Mirror `PicksPreviewBanner` → new shared `TestLeagueBanner` in `components/league/` |
| List rows | `list-administered-leagues.ts`, `list-joined-leagues.ts` + pages `/leagues`, `/my-leagues` |
| Email subjects/bodies | `send-invitation-email.ts`, `send-tuesday-digest.ts`, `send-reminder.ts` + templates under `src/lib/email/templates/` |
| Settings surface | `/leagues/[leagueId]/settings/page.tsx` read-only `<dl>` pattern |
| Env parse style | Local `process.env.X?.trim()` helpers (see `getCurrentNflSeasonYear` / NFL_SEASON_YEAR) — no new feature-flag framework |
| Delete (out of scope) | Already implemented — Story 2.8 / `DeleteLeagueDialog` |
| Migrations | `npm run db:migrate` / `db:migrate:deploy` via `scripts/prisma-env.cjs` |
| Logging | Only if useful (`logEvent`); do not invent a parallel logger |
| Layout flex | MUI **`Stack`** preferred over `Box` for flex |

### UX requirements (required front-end consultation)

[Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Test / rehearsal leagues]

- Test leagues **must be visually distinct** (banner/chip).
- Do not rely on league **name** alone (name is immutable after create; users may omit “test” from the name).
- Keep admin dual-role nav intact — labeling is informational, not a separate admin portal.
- Preview labeling for pre-season picks (`PicksPreviewBanner`) is a **different** concept — never overload it for rehearsal.

### Architecture / project-context compliance

- Multi-tenancy: leagues isolated by `leagueId`; test flag is **per league**, not global simulation mode.
- Prisma singleton `@/lib/db`; snake_case `@map` columns; camelCase API JSON.
- Errors: `{ error: { code, message } }` with 400/401/403/409 as appropriate.
- Secrets server-only; `ALLOW_TEST_LEAGUES` is **not** a secret but still read only on the server for the gate; expose allow/deny to the client as a boolean prop from RSC.
- Prefer RSC pages; `"use client"` for form checkbox + MUI banner/chip leaves.
- Colocated Vitest for pure helpers (`allow-test-leagues`, Zod body).

[Source: `_bmad-output/planning-artifacts/architecture.md` — Test / rehearsal leagues; Naming; Structure]  
[Source: `docs/project-context.md` — non-negotiables; planning supplements]

### File structure (expected touch list)

**Create**

- `src/lib/league/allow-test-leagues.ts` (+ `.test.ts`)
- `src/components/league/TestLeagueBanner.tsx` (and optional `TestLeagueChip.tsx`)
- `prisma/migrations/<timestamp>_add_league_is_test_league/migration.sql` (via migrate)

**Modify (representative — adjust if structure differs slightly)**

- `prisma/schema.prisma` — `League.isTestLeague`
- `src/lib/league/create-league-body.ts` (+ test)
- `src/app/api/leagues/route.ts` — persist + gate + serialize
- `src/app/(app)/leagues/new/page.tsx` + `create-league-form.tsx`
- `src/lib/league/get-league-access.ts`
- `src/lib/league/list-administered-leagues.ts` (+ test)
- `src/lib/league/list-joined-leagues.ts` (+ test)
- `src/app/(app)/leagues/[leagueId]/layout.tsx` → `LeagueNavShell`
- `src/components/league/LeagueNavShell.tsx`
- `src/app/(app)/leagues/[leagueId]/picks/page.tsx`
- `src/app/(app)/leagues/[leagueId]/standings/page.tsx`
- `src/app/(app)/leagues/[leagueId]/page.tsx` (home)
- `src/app/(app)/leagues/[leagueId]/settings/page.tsx`
- `src/app/(app)/leagues/page.tsx`, `src/app/(app)/my-leagues/page.tsx`
- Email loaders/senders/templates (invite, Tuesday, reminders) + preview path
- `.env.example`, `docs/deployment.md`

**Do not** invent parallel create/delete stacks or a global “simulation mode” env that changes all leagues.

### Previous story intelligence

**Epic 7 closeout / Story 7.4**

- Keep explicit **Is / Is NOT** and **Reuse** tables (team agreement from Epic 7 retro).
- Env documentation belongs in `docs/deployment.md` (created in 7.4).
- `getLeagueAccess` already dedupes layout/page membership fetches — extend it rather than adding a second Prisma round-trip in layout.
- Testing: Vitest for pure helpers; manual QA notes OK for banner smoke; no Playwright required for this story.
- Epic 8 has **no** pre-epic spike blocker — start with 8.1.

**Story 2.1 (create) + 2.8 (delete)**

- Create: Zod body, CSRF-after-JSON-parse, unique name → 409 `DUPLICATE_LEAGUE_NAME`.
- Delete: already production-ready for any league; 8.7 reuses UX — out of scope here.
- Settings: admin-gated; good home for read-only league type.

**Git pattern (recent):** focused feat commits + colocated tests + docs (`docs/deployment.md`, deferred-work updates at closeout).

### Deferred-work disposition for this story

Consulted `_bmad-output/implementation-artifacts/deferred-work.md` while planning.

| Item | Disposition |
|------|-------------|
| Authenticated Lighthouse re-measure (picks/standings) | **Out of scope** — during/after Epic 8 rehearsal (needs sim season) |
| Real pick-submit NFR5 timing sample | **Out of scope** — later rehearsal |
| Circuit-breaker e2e under outage | **Out of scope** — Story **8.5** |
| Post-epic-8 Vercel env / Resend domain / prod smoke | **Out of scope** — post-Epic 8 sprint items |
| CSV formula-injection, weather cache nits, TOCTOU, etc. | **Out of scope** — unrelated hardening |
| UX test-league banner/chip requirement | **In scope** — AC4 (from UX spec, not a deferred code-review item) |
| Strong “must-do in 8.1” deferred code items | **None found** |

Optional stretch (not required): include `isTestLeague` in CSV export league metadata (Story 7.1) — only if trivial; otherwise leave for 8.6/8.7 safety-net polish.

### Testing requirements

1. **Unit:** `allowTestLeagues()` / env parse — unset, true, false, `0`, whitespace
2. **Unit:** `createLeagueBodySchema` — default false; explicit true/false; reject non-boolean if using strict boolean (prefer `z.boolean().optional().default(false)`; avoid `z.coerce.boolean()` traps)
3. **Unit:** list mappers / serializers if they gain the new field
4. **Manual:**  
   - Create test league → banners + chip + lists + settings row  
   - Create production league → no rehearsal chrome  
   - Set `ALLOW_TEST_LEAGUES=false` → checkbox hidden + API 403 on true  
   - Send or preview Tuesday email for test league → `[TEST]` in subject + body notice  
5. Run **`npm test`** after adding/changing tests

### Latest technical notes

- Prisma: `Boolean @default(false)` + migrate is safe for small MVP tables; existing leagues become production (`false`) automatically.
- Prefer additive migration only (expand); no destructive rename.
- No new npm dependencies expected for this story.

### Project context reference

- Read `docs/project-context.md` before implementing — especially secrets, Prisma singleton, camelCase JSON, Stack-for-flex, colocated tests.
- Planning supplements already call out Epic 8 test/rehearsal leagues; this story is the schema + labeling foundation.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 8; Story 8.1]
- [Source: `_bmad-output/planning-artifacts/prd.md` — Rehearsal / test leagues planning supplement]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Test / rehearsal leagues cross-cutting]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Test / rehearsal leagues]
- [Source: `docs/project-context.md`]
- [Source: `docs/deployment.md` — env documentation home]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`]
- [Source: `_bmad-output/implementation-artifacts/epic-7-retro-2026-07-19.md` — Epic 8 sequence]
- [Source: `_bmad-output/implementation-artifacts/2-1-create-league-and-season.md` — create patterns]
- [Source: `_bmad-output/implementation-artifacts/2-8-admin-delete-league-production.md` — delete boundary]
- [Source: `_bmad-output/implementation-artifacts/7-4-performance-and-deployment-hardening.md` — getLeagueAccess, deployment docs]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

- Prisma client regenerated via `npm run db:generate` after migration so `isTestLeague` typed selects compile.
- Pre-existing `tsc` noise in `participant-membership.test.ts` / `resolve-current-season.test.ts` unrelated to this story.

### Implementation Plan

1. Additive `League.isTestLeague` + migrate (default false).
2. `allowTestLeagues()` env gate + docs; Zod create body; POST persist + 403 `TEST_LEAGUES_DISABLED`.
3. Propagate flag through `getLeagueAccess` + list mappers; shell chip; banners; settings read-only type.
4. Thread flag into invite/Tuesday/reminder emails + Tuesday preview subject banner.
5. Colocated Vitest; full `npm test` green (395).

### Completion Notes List

- **AC1–AC7 satisfied.** Schema migration `20260719195353_add_league_is_test_league`; create-time checkbox; optional `ALLOW_TEST_LEAGUES` gate; UI banners/chips; email `[TEST]` subjects + body notice; settings read-only league type; `isTestLeagueLeague()` helper for later Epic 8 gates.
- **Epic 8 foundation note:** every later simulation behavior MUST no-op or 403 when `isTestLeague === false` — never apply rehearsal rules globally. Isolation remains by `leagueId`.
- **Deferred-work disposition:** none in-scope for 8.1 (see Dev Notes table). CSV export `isTestLeague` left for later polish.
- **Manual happy-path:** see Completion communication / user message for in-browser steps.

### File List

**Create**

- `prisma/migrations/20260719195353_add_league_is_test_league/migration.sql`
- `src/lib/league/allow-test-leagues.ts`
- `src/lib/league/allow-test-leagues.test.ts`
- `src/lib/league/is-test-league.ts`
- `src/lib/league/is-test-league.test.ts`
- `src/lib/email/test-league-labeling.ts`
- `src/lib/email/test-league-labeling.test.ts`
- `src/components/league/TestLeagueBanner.tsx`
- `src/components/league/TestLeagueChip.tsx`

**Modify**

- `prisma/schema.prisma`
- `.env.example`
- `docs/deployment.md`
- `src/lib/league/create-league-body.ts`
- `src/lib/league/create-league-body.test.ts`
- `src/lib/league/get-league-access.ts`
- `src/lib/league/list-administered-leagues.ts`
- `src/lib/league/list-administered-leagues.test.ts`
- `src/lib/league/list-joined-leagues.ts`
- `src/lib/league/list-joined-leagues.test.ts`
- `src/app/api/leagues/route.ts`
- `src/app/api/leagues/joined/route.ts`
- `src/app/api/leagues/[leagueId]/invitations/route.ts`
- `src/app/api/leagues/[leagueId]/email/tuesday-preview/route.ts`
- `src/app/(app)/leagues/new/page.tsx`
- `src/app/(app)/leagues/new/create-league-form.tsx`
- `src/app/(app)/leagues/page.tsx`
- `src/app/(app)/my-leagues/page.tsx`
- `src/app/(app)/leagues/[leagueId]/layout.tsx`
- `src/app/(app)/leagues/[leagueId]/page.tsx`
- `src/app/(app)/leagues/[leagueId]/picks/page.tsx`
- `src/app/(app)/leagues/[leagueId]/standings/page.tsx`
- `src/app/(app)/leagues/[leagueId]/settings/page.tsx`
- `src/components/league/LeagueNavShell.tsx`
- `src/lib/email/get-tuesday-digest-data.ts`
- `src/lib/email/get-tuesday-digest-data.test.ts`
- `src/lib/email/get-reminder-data.ts`
- `src/lib/email/get-reminder-data.test.ts`
- `src/lib/email/send-invitation-email.ts`
- `src/lib/email/send-tuesday-digest.ts`
- `src/lib/email/send-reminder.ts`
- `src/lib/email/templates/InvitationEmail.tsx`
- `src/lib/email/templates/TuesdayDigestEmail.tsx`
- `src/lib/email/templates/ReminderEmail.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/8-1-test-league-flag-labeling-and-optional-global-gates.md`

### Change Log

- 2026-07-19: Implemented Story 8.1 — test league flag, create gate, UI/email labeling; status → review.

---

**Status:** done  
**Completion note:** Implementation complete 2026-07-19 — code review complete same day; 1 decision-needed + 3 patch findings resolved (mobile shell rehearsal indicator, tuesday-preview header/regex sanitization, digest/reminder true-path test coverage, invite/accept response field), 1 deferred (pre-existing route-test-coverage gap), 12 dismissed as noise/false-positive. `npm test` green (397).
