# NFL odds and schedule integration (Story 3.2)

**Investigation:** April 2026 (web + vendor docs). **Pricing and tiers change** — confirm on each vendor’s site before contracts or capacity planning.

## What we optimized for

| Priority | Rationale |
|----------|-----------|
| **Betting lines for jailed + UX** | NFL **moneyline** and **point spread** from a real odds feed, server-only. |
| **MVP cost** | Prefer **self-serve** signup with a **documented free or low** tier; avoid enterprise sales for v1. |
| **Weekly snapshot, not live trading** | One snapshot per week per sport (later: Tuesday cron) — **low API churn** vs per-request UI refresh. |
| **Schedule honesty** | `NflGame` is a **full-season relational model** (weeks 1–18, kickoffs, team FKs). That is **not** the same as “whatever games the odds API happens to list this week.” |

## Options investigated

| Option | Type | Self-serve / indie-friendly | NFL ML + spread | Full `NflGame` schedule (1–18, kickoffs) | Assessment |
|--------|------|------------------------------|-----------------|-------------------------------------------|------------|
| **[The Odds API](https://the-odds-api.com/)** | Odds aggregator | **Strong** — [500 credits/mo on free tier](https://the-odds-api.com/) (Apr 2026); paid tiers from **~$30/mo** upward | **Yes** — `americanfootball_nfl`, markets `h2h` + `spreads`, e.g. [v4 docs](https://the-odds-api.com/liveapi/guides/v4/) | **Matchups per event** (`home_team`, `away_team`, `commence_time`), but **not** a guaranteed **full 18-week** authoritative schedule product — listings follow **posted lines**, NFL **week** is inferred | **Best fit for MVP odds:** clear docs, JSON, long-running product. **Quota:** each **market × region** costs credits (e.g. `h2h` + `spreads` × `us` ≈ **2 credits per snapshot call** — still tiny vs 500/mo for weekly NFL). |
| **[SportsDataIO](https://sportsdata.io/developers)** | Full NFL data + [separate odds stack](https://sportsdata.io/live-odds-api) | **Weak for indie** — **no public list price**; [developer trial](https://sportsdata.io/developers) / sales-led production | **Yes** (odds products) | **Strong** — schedule, teams, scores, timeframes; aligns with “one vendor” dream | **Best long-term “enterprise single pane”** if budget allows. **Not chosen for MVP** due to **cost/opaque pricing** and **sales friction** vs our current stage. **Revisit** when we need **live schedule sync + odds** under one contract. |
| **[API-Sports](https://api-sports.io/)** (NFL) | Stats / fixtures / injuries | **Strong** — published tiers (e.g. **100 requests/day** on free plan cited in vendor materials; verify live) | **Not a betting-odds API** — NFL offering is **games, standings, stats, injuries**, not bookmaker lines like The Odds API | **Yes** — fixtures/games suitable for **schedule upsert** research | **Wrong tool for odds.** **Candidate later** for **schedule-only** integration if we outgrow `prisma/data` JSON. **Pair with** an odds API, not replace it. |
| **[SportsGameOdds](https://sportsgameodds.com/)** | Odds (broad coverage) | Free tier + docs; **paid floors often higher** than The Odds API for comparable hobby usage (verify [pricing](https://sportsgameodds.com/pricing)) | **Yes** — many books, props, spreads, moneylines | Event/odds-centric; not our Prisma schedule shape | **Strong** if we need **80+ books**, **props**, or **consensus/sharp** analysis. **Overkill** for “Tuesday snapshot ML + spread” MVP **unless** we outgrow The Odds API **quality or limits**. |
| **OpticOdds, Sportradar, Genius Sports** | Enterprise official / trading feeds | **No** meaningful hobby self-serve; **contact sales** ([e.g. Sportradar dev](https://developer.sportradar.com/)) | Yes | Yes (varies by product) | **Out of scope** for **max free tier / low cost** MVP. Appropriate if we become a **regulated book** or need **official league data** contracts. |

### Sources used

- Vendor homepages and **pricing** pages: The Odds API, SportsDataIO, API-Sports, SportsGameOdds.  
- The Odds API **v4 guide** (quota rules, markets).  
- Third-party **roundup articles** (e.g. odds API comparisons) only as **pointers**, not as source of truth for pricing.

## Recommendation (after comparison — not “first thing we tried”)

**Retain [The Odds API](https://the-odds-api.com/) for MVP NFL odds** because it scores best on **documented free tier + self-serve + ML/spread + implementation cost**, while alternatives either:

- **Do not provide bookmaker odds** in the same way (API-Sports), or  
- **Add enterprise/sales cost** without MVP necessity (SportsDataIO full stack, Sportradar/OpticOdds), or  
- **Add product breadth** (SportsGameOdds) we do not need until we want props/multi-book **sharp** workflows.

**Schedule (`NflGame`)** stays **seed / JSON** (`prisma/data`, `prisma/seed.cjs`) until **Epic 3 Story 3.9** (*NFL schedule provider — spike, choice, and `NflGame` sync*) delivers an evaluated **schedule-first** API and **idempotent upsert**, with **zero recurring cost** as the **priority** when choosing a vendor (paid only if documented as unavoidable). Until then, follow-up candidates remain **API-Sports**, **SportsDataIO**, etc. — **orthogonal** to the odds vendor choice.

### Clarification: The Odds API *does* include matchups

Each event includes **`home_team`**, **`away_team`**, and **`commence_time`** (see `src/lib/integrations/the-odds-api/fixtures/nfl-odds-sample.json` and the [v4 docs](https://the-odds-api.com/liveapi/guides/v4/)). That is enough to know **who plays whom** and **when**, for **every event returned**.

The gap is not “no matchup fields” — it is **schedule authority and completeness** for *this* app:

1. **Betting-centric listing** — The feed reflects **games the books are offering** (and when). Early in the week or in certain windows, a **full NFL week** may be **partially** represented vs “all regular-season games we model in `nfl_games`.”
2. **No first-class NFL week key** — You infer **regular-season week** from kickoff (and league calendar rules), not from a dedicated `week: 7` field.
3. **Stable `NflGame` rows** — Picks and deadlines assume **our** persisted games (team FKs, `week_number`, kickoff). Story 3.2 **matches** odds events **onto** those rows; it does **not** replace them with the odds API as the only source of truth.

A **future** enhancement could **upsert** `NflGame` from The Odds API (or combine API + seed). That was **out of scope** for 3.2; seed/JSON remains the explicit **canonical** schedule for MVP.

## When to re-open vendor choice

| Trigger | Action |
|---------|--------|
| The Odds API **free tier removed**, **quota cut**, or **repeated production failures** at snapshot | Compare **SportsGameOdds** vs **paid The Odds API** tier; spike **one** alternative with fixtures. |
| Product needs **props**, **multi-book consensus**, or **sharp** lines | Compare **SportsGameOdds** (breadth) vs upgraded **The Odds API** plan. |
| Business will pay for **one vendor** for **schedule + odds + scores** | Budgeted evaluation of **SportsDataIO** (or similar) with **sales quote** and trial. |
| Only **schedule** automation needed | Spike **API-Sports** (or league-appropriate feed), **keep** The Odds API for lines unless combined vendor wins on **total cost of ownership**. |

## Current integration (summary)

| Topic | Decision |
|-------|----------|
| **Odds (moneyline + spread)** | **[The Odds API](https://the-odds-api.com/)** (`americanfootball_nfl`, markets `h2h` + `spreads`, region `us`, format `american`). Server-only via `ODDS_API_KEY`. |
| **Schedule (`NflGame`)** | **Seed / JSON** from Story 3.1. **Not** fully driven by the odds API. **Follow-up:** story to evaluate **schedule-first** provider + **upsert** weeks 1–18 when seed is insufficient. |
| **Split vs single provider** | **Split** for MVP: **The Odds API** (lines) + **static/seed** schedule unless/until a **paid** unified option is justified. |
| **Compliance** | Follow each vendor’s **terms of use**; no keys in client bundles (`docs/project-context.md`). |
| **Fallback** | Failed snapshot → structured error + logs; **manual** odds PATCH / league admin UI. Mapping changes live in `src/lib/integrations/the-odds-api/`. |
| **Team logos (bonus / 3.8)** | Not from this odds integration; evaluate static assets or image-capable providers later. |

## Mapping

- **Teams:** Provider uses full team names (`home_team` / `away_team`). We match to `Team.name` from `prisma/data/nfl-teams.json` after optional alias normalization (`canonicalTeamDisplayName` in `src/lib/integrations/the-odds-api/team-names.ts`).
- **Games:** We match provider events to `NflGame` rows by **away @ home** team names for the requested `nfl_season_year` + `week_number` (orientation must match the API).
- **Spread:** Stored as **`home_spread_points`** (negative = home favored), taken from the home team’s `spreads` outcome `point` in the first bookmaker.

## Snapshot semantics (“mid-week”)

- **In-season:** Odds for a given `NflGame` are read from the **latest completed** `NflGameOddsLine` for that game (across snapshot runs). The app **does not** call the provider on routine page loads.
- **New provider data** appears only after an explicit **snapshot** (`POST /api/admin/nfl/snapshot-odds`) or a **manual** line save. Epic 6 will cron the snapshot on the Tuesday cadence.

### Partial week coverage (AC4)

A snapshot **can succeed** (`200` + `COMPLETED` run) when the provider only matched **some** of the week’s `NflGame` rows (`matchedGames < totalGamesInWeek`). That is **intentional**: incomplete provider coverage should not block lines for games that *did* match. The server logs **`odds_snapshot_partial`** so operators can follow up.

**Operational expectation:** use **`GET /api/admin/nfl/week-odds`** (or the settings **Load lines** button) to see which games still lack lines, then **`PATCH`** manual lines per game as needed. **True failures** — upstream HTTP errors, **zero** matched games, or **no** `nfl_games` rows for that week — return **error responses** with structured `{ error: { code, message } }` and logged details; those are **not** silent success.

## League `first_competition_week` (Story 2.7)

- Snapshot triggers and “load week” helpers are **global NFL** (by `nfl_season_year` + `week_number`). They **do not** skip weeks below a league’s `first_competition_week` — that field gates **league competition and picks**, not whether global Week 1 lines can be fetched in July for smoke tests.
- There is **no** API enforcement of “only snapshot weeks this league will play”; the settings panel shows **`first_competition_week`** for context. **Operational** discipline (which weeks to run) is up to admins and automation, not a hard rule on these routes.

## Environment variables

See `.env.example`: `ODDS_API_KEY`, optional `ODDS_SNAPSHOT_SECRET` for `Authorization: Bearer` automation (bypasses browser CSRF checks; still server-only). Optional **`ODDS_API_DEBUG_LOG_RESPONSE=true`** logs the **full** raw odds JSON body from The Odds API (verbose; use only when debugging).

---

## Setup (The Odds API in this app)

### 1. Obtain an API key

1. Open [https://the-odds-api.com/](https://the-odds-api.com/) and create an account.
2. Subscribe to a plan that includes an API key (the **free tier** includes monthly credits — check current limits on their site).
3. Copy the key from your account dashboard. **Never** commit it; treat it like a password.

### 2. Configure the server

1. Copy `.env.example` to `.env.local` if you have not already (Next.js loads `.env.local` for `npm run dev`).
2. Set:

   ```bash
   ODDS_API_KEY="paste_your_key_here"
   ```

3. **Optional — automation / curl without browser CSRF:**

   ```bash
   ODDS_SNAPSHOT_SECRET="a_long_random_string"
   ```

   Generate e.g. `openssl rand -base64 32`. Used as `Authorization: Bearer <secret>` on `POST`/`PATCH` admin odds routes (see below).

4. Restart **`npm run dev`** after changing env vars so Route Handlers pick up new values.

### 3. Database schema and seed prerequisites

1. Apply migrations so **`odds_snapshot_runs`** and **`nfl_game_odds_lines`** exist:

   ```bash
   npm run db:migrate
   ```

   (Use `db:migrate:deploy` in CI/production.)

2. Seed **teams** and **Week 1** games for the active season year:

   ```bash
   npm run db:seed
   ```

   - **`NFL_SEASON_YEAR`** (optional in `.env` / `.env.local`) pins the season label used by seed (mirrors `getCurrentNflSeasonYear()`). If unset, the seed uses the **current UTC calendar year**.
   - Out of the box, **`prisma/seed.cjs` only creates `NflGame` rows for `weekNumber: 1`**. Snapshotting **`weekNumber: 2`…`18`** returns **no games** until you add more rows (JSON + seed) or ship **Story 3.9** schedule sync.

### 4. Access control (who can call the APIs)

- **League admin:** any user with **`LeagueMembershipRole.ADMIN`** on **at least one** league may use the UI and session-based `fetch` to admin odds routes.
- **Automation:** requests with `Authorization: Bearer <ODDS_SNAPSHOT_SECRET>` (when the env var is set) are authorized without a session and **skip** the same-origin CSRF check (for scripts/cron).

### 5. Where it lives in the app (Story 3.2)

| Piece | Location |
|-------|----------|
| Provider HTTP client + Zod | `src/lib/integrations/the-odds-api/` |
| Snapshot + manual line persistence | `src/lib/nfl/snapshot-nfl-week-odds.ts`, `src/lib/nfl/effective-odds.ts` |
| **POST** snapshot | `POST /api/admin/nfl/snapshot-odds` — body `{ "nflSeasonYear": number, "weekNumber": 1–18 }` |
| **GET** lines for a week | `GET /api/admin/nfl/week-odds?nflSeasonYear=&weekNumber=` |
| **PATCH** manual line | `PATCH /api/admin/nfl/games/[gameId]/odds-line` — body `{ "homeMoneylineAmerican": number \| null, "awayMoneylineAmerican": number \| null, "homeSpreadPoints": number \| null }` |
| Admin UI | League **Settings** (admin only) — **NFL odds (global)** panel: `src/app/(app)/leagues/[leagueId]/settings/nfl-odds-admin-panel.tsx` |

### 6. Automated tests (no live API)

```bash
npm test
```

Uses recorded JSON under `src/lib/integrations/the-odds-api/fixtures/` — **no** `ODDS_API_KEY` required for CI.

---

## Manual testing (concise)

**Prereqs:** `ODDS_API_KEY` set, DB migrated, `npm run db:seed` run, dev server up, logged-in user is **league admin** for some league.

1. **Open** `/leagues/[leagueId]/settings` as that admin.
2. In **NFL odds (global)**, set **NFL season year** to match your seeded data (usually **`NFL_SEASON_YEAR`** or current year) and **NFL week** to **`1`** (only week seeded by default).
3. Click **Run snapshot (API)** — expect success JSON in the UI message or an error explaining quota/upstream/no match.
4. Click **Load lines** — confirm moneyline and spread appear for each Week 1 game (or use **Save manual line** if the provider returned no match).
5. **Optional — curl (requires `ODDS_SNAPSHOT_SECRET` in env):**

   ```bash
   curl -sS -X POST "http://localhost:3000/api/admin/nfl/snapshot-odds" \
     -H "Authorization: Bearer YOUR_ODDS_SNAPSHOT_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"nflSeasonYear":2026,"weekNumber":1}'
   ```

6. **If snapshot fails with “no matching odds”:** the API’s listed games may not match **`nfl-week1-games.json`** matchups for that period — use **Save manual line** on a row to verify persistence, or adjust seed/API season alignment.

**Quota reminder:** each snapshot calls The Odds API with **`h2h` and `spreads`** (multiple markets consume **multiple credits** per request — see [their v4 usage docs](https://the-odds-api.com/liveapi/guides/v4/)). Avoid hammering **Run snapshot** in a loop during manual QA.
