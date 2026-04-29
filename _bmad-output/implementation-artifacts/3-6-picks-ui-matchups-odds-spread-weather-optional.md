# Story 3.6: Picks UI — matchups, odds, spread, weather (optional)

Status: done

## Story

As a **participant** (including league admin in their participant role),
I want to see the current week's NFL matchups with moneyline odds, point spreads, and optional weather on the picks page,
so that I can make an informed pick without leaving the app (**FR14, FR15**, UX weather requirement).

## Acceptance Criteria

1. **Matchup display (FR14, FR15)**
   **Given** an authenticated league member on `/leagues/[leagueId]/picks`
   **When** the page loads for the active competition week
   **Then** all NFL matchups for that week are shown with away team and home team names, moneyline odds (American format), and point spread (home team perspective)
   **And** matchups are sorted by ascending kickoff time
   **And** game kickoff time is displayed per matchup in `America/New_York` (e.g., "Thu 8:20 PM ET")
   **And** the week number is clearly labeled (e.g., "Week 3 Matchups")

2. **Odds display**
   **Given** odds have been snapshotted for the week (via `POST /api/admin/nfl/snapshot-odds` or manual entry)
   **When** the picks page loads
   **Then** moneyline is shown in American format (e.g., -350, +280) for each team in the matchup
   **And** the point spread is shown from the home team's perspective (e.g., -6.5 means home is favored by 6.5)
   **And** if odds are not yet available for a game, that game still renders with placeholder "–" values (no crash)

3. **Weather (optional, fail-soft)**
   **Given** a free-tier weather API is configured via `WEATHER_API_KEY` (server-only)
   **When** weather data is successfully fetched for the home team's city/stadium
   **Then** current conditions are shown on the matchup card (temperature °F, brief condition, wind mph)
   **And** if `WEATHER_API_KEY` is absent, the API call fails, or a quota limit is hit, weather is silently omitted — no error surface to the user, no crash

4. **Off-season / pre-competition preview (AC per epics.md Story 3.6)**
   **Given** a signed-in league member where either the season is not yet initialized (`preSeasonInitializedAt` is null) or the current calendar date is before any game in the league's competition window
   **When** they navigate to `/leagues/[leagueId]/picks`
   **Then** the page shows Week 1 matchups (or the league's `firstCompetitionWeek` week if Week 1 is before the competition window) with whatever odds and weather data is available
   **And** a clear **preview banner** communicates "Preview – picks not yet open" (or equivalent copy) so users understand this is not a live submission window
   **And** pick submission UI is absent (no submit button — pick actions come in Story 3.7)

5. **Responsive parity (UX)**
   **Given** the picks page
   **When** viewed on mobile (≤767px) or desktop (≥1024px)
   **Then** matchup cards are readable and usable on both — single-column stacked on mobile, with all essential information visible without horizontal scrolling
   **And** MUI `Stack` is used for all flex layouts per project convention

6. **No API keys in client**
   **Given** any weather or odds integration key
   **Then** it lives exclusively in server-side code and environment variables; no `NEXT_PUBLIC_*` exposure

## Tasks / Subtasks

- [x] **Week resolver** — create `src/lib/nfl/resolve-picks-week.ts` with `resolvePicksWeekNumber(season, gamesForYear): number | null`: returns active competition week (nearest future/current week) or falls back to preview week for off-season (AC: #4)
  - [x] Pure function with Vitest table tests covering: pre-season (no initialized season), in-season (active week), post-season (all games past), mid-season start (firstCompetitionWeek > 1)

- [x] **Weather integration** (fail-soft) — create `src/lib/integrations/weather/client.ts` + `src/lib/integrations/weather/stadium-locations.ts`
  - [x] Static map of NFL team abbreviations → stadium latitude/longitude (all 32 teams)
  - [x] `fetchWeatherForTeam(abbreviation: string): Promise<WeatherData | null>` — calls OpenWeatherMap `/data/2.5/weather` with `units=imperial`; returns `null` on any failure (missing key, network, quota, unmapped team)
  - [x] Env var: `WEATHER_API_KEY` (server-only — no `NEXT_PUBLIC_`)
  - [x] No unit tests that hit live network — either skip weather tests or use a simple fixture

- [x] **GET endpoint for week view data** — add `GET` handler to `src/app/api/leagues/[leagueId]/picks/route.ts`
  - [x] Auth: session required; must be a league participant (same membership check as POST)
  - [x] Query param: `weekNumber` (optional; defaults to resolved active/preview week)
  - [x] Returns: `{ weekNumber, isPreview, matchups: [...], pickDeadlineUtc }` where each matchup includes `gameId`, `homeTeam`, `awayTeam`, `kickoffAt`, `homeMoneylineAmerican`, `awayMoneylineAmerican`, `homeSpreadPoints`, optional `weather`
  - [x] Weather fetched server-side, fail-soft (null per matchup if unavailable)
  - [x] Jailed team included in response (`jailedTeamId` | null) so Story 3.7 can use same endpoint without adding a new fetch

- [x] **Server component — replace placeholder** in `src/app/(app)/leagues/[leagueId]/picks/page.tsx`
  - [x] Load season, resolve week, call `getEffectiveOddsLinesForWeek()`, optionally fetch weather server-side
  - [x] Compute `pickDeadlineUtc` using `computePickDeadlineUtc` from `src/lib/domain/pick-deadline.ts` (already implemented in 3.5) — needed for Story 3.7's countdown; pass it as a prop now so 3.7 can use it
  - [x] Render preview banner if `isPreview` (AC: #4)
  - [x] Pass matchup data to `WeekMatchupList` client component

- [x] **MatchupCard component** — create `src/components/picks/MatchupCard.tsx`
  - [x] Display-only for 3.6 (no click handlers / pick submission — those are 3.7)
  - [x] Layout per UX spec: header row (kickoff time, weather badge), teams row (away | @ | home), odds row per team, spread row
  - [x] `TeamLogo` stub: abbreviation-in-colored-circle fallback (real logos in Story 3.8)
  - [x] Use MUI `Card`, `Stack`, `Typography`, `Chip` — no Box flex unless Stack is insufficient
  - [x] Handles missing odds gracefully (show "–")
  - [x] Handles missing weather gracefully (hide weather badge)
  - [x] Responsive: single-column on mobile

- [x] **WeekMatchupList component** — create `src/components/picks/WeekMatchupList.tsx`
  - [x] Lists all matchups sorted by kickoff time
  - [x] Passes each down to `MatchupCard`
  - [x] Empty-state message if no games loaded for the week

- [x] **TeamLogo component** — create `src/components/picks/TeamLogo.tsx`
  - [x] For 3.6: abbreviation-in-colored-circle (placeholder per UX spec; Story 3.8 upgrades to real logos)
  - [x] Props: `abbreviation`, `size` (sm/md/lg), `disabled?` (for 3.7 grayed states)
  - [x] Meaningful `aria-label` with team name for NFR42

- [x] **Preview banner** — inline or `src/components/picks/PicksPreviewBanner.tsx`
  - [x] MUI `Alert` severity `info` with message explaining picks are not yet open
  - [x] Visible only when `isPreview === true`

- [x] **Run `npm test`** — existing tests must pass; add tests for `resolvePicksWeekNumber`

### Review Findings

- [x] [Review][Patch] WeekMatchupList missing 3.7 prop passthrough — `jailedTeamId`, `pickDeadlineUtc`, `onTeamSelect`, `selectedTeamId`, `pickedTeamIds` accepted/defined at MatchupCard but never threaded through WeekMatchupList; page.tsx also never forwards `payload.jailedTeamId`; Story 3.7 wiring will require WeekMatchupList refactoring [src/components/picks/WeekMatchupList.tsx, src/app/(app)/leagues/[leagueId]/picks/page.tsx]
- [x] [Review][Patch] Non-404 errors silently become `notFound()` in page.tsx — 403 FORBIDDEN and other failure codes fall through the same unconditional `notFound()` branch, masking server errors as a missing-page [src/app/(app)/leagues/[leagueId]/picks/page.tsx:56-61]
- [x] [Review][Patch] Page lacks try/catch around `buildLeaguePicksWeekView` — unhandled DB or integration errors escape to Next.js error boundary with no graceful fallback; API route has coverage, page does not [src/app/(app)/leagues/[leagueId]/picks/page.tsx]
- [x] [Review][Patch] Weather fetch has no timeout — missing `AbortSignal.timeout()` means a stalled OpenWeatherMap response blocks the entire SSR render indefinitely [src/lib/integrations/weather/client.ts:39]
- [x] [Review][Patch] null `kickoffAt` in `gamesForWeek` causes runtime TypeError — `gamesForWeek` query has no null filter but `.toISOString()` is called unconditionally in matchup mapping [src/lib/picks/build-league-picks-week-view.ts:149]
- [x] [Review][Patch] `parseInt` silently accepts trailing non-digits — "1abc" parses as week 1; add full-numeric regex guard before parseInt [src/lib/picks/week-query-param.ts:11]
- [x] [Review][Patch] Weather chip field order inverted vs. spec — renders `condition · tempF · wind` but AC3 specifies `tempF · condition · wind` [src/components/picks/MatchupCard.tsx]
- [x] [Review][Patch] Unused `import type { Prisma }` in route.ts — added in GET handler diff but never referenced in that handler [src/app/api/leagues/[leagueId]/picks/route.ts]
- [x] [Review][Patch] `formatAmericanMl` defined inside component body — pure stateless function re-allocated on every render; move to module scope [src/components/picks/MatchupCard.tsx]
- [x] [Review][Patch] Negative-zero spread display — `fmtSpread.format(-homeSpreadPts)` when `homeSpreadPts === 0` renders "-0" due to `signDisplay: "always"`; guard the zero case [src/components/picks/MatchupCard.tsx:41]
- [x] [Review][Defer] Keyboard/a11y for clickable team selection [src/components/picks/MatchupCard.tsx] — deferred, pre-existing; display-only in 3.6 per spec, click handlers land in Story 3.7 which must add role/tabIndex/onKeyDown
- [x] [Review][Defer] Weather caching — no-store on every SSR render drains free-tier quota [src/lib/integrations/weather/client.ts] — deferred, pre-existing; spec open questions explicitly defer caching to performance testing
- [x] [Review][Defer] Domed stadium weather display — weather shown for fully-enclosed stadiums (LV, MIN, LAC/LAR, IND, DET, HOU) is misleading [src/lib/integrations/weather/stadium-locations.ts] — deferred, pre-existing; product decision, noted in Story 3.10 planning

## Dev Notes

### Epic 3 cross-story context

| Story | Relationship |
|-------|-------------|
| **3.4** | `POST /api/leagues/[leagueId]/picks` — pick submission API (already shipped). The `GET` handler added in 3.6 is a new read path on the same route file. |
| **3.5** | `checkPickMutationDeadline`, `computePickDeadlineUtc` — deadline math already in `src/lib/domain/pick-deadline.ts`. 3.6 uses `computePickDeadlineUtc` to surface the deadline instant to the UI; Story 3.7 uses it for the countdown and lock state. |
| **3.7** | Jailed UX, pick selection clicks, countdown, confirmation banner — **do not build** in 3.6. The 3.6 GET endpoint and components should be designed to make 3.7 easy: include `jailedTeamId` and `pickDeadlineUtc` in GET response, accept a `selectedTeamId` prop in `MatchupCard` (pass `null` for now). |
| **3.8** | `TeamLogo` real assets. 3.6 ships the abbreviation-in-circle placeholder; 3.8 upgrades the same component. Keep `TeamLogo` in `src/components/picks/`. |
| **3.9** | NFL schedule sync. Until 3.9 ships, only Week 1 is seeded. Preview and in-season behavior both depend on `NflGame` rows existing. |

### Determining the active/preview week

The picks page must show a week even when the season is off or the competition window hasn't started. Here is the resolution order (implement in `resolvePicksWeekNumber`):

```
1. No season row or not initialized → return firstCompetitionWeek (default 1) as PREVIEW
2. Season initialized, has NflGame rows:
   a. Find the lowest weekNumber where ANY game.kickoffAt > now (i.e., still in the future)
      → if found AND >= firstCompetitionWeek → that is the active competition week (not preview)
   b. If all games' kickoffs are in the past (off-season end or no future data):
      → return the last weekNumber with games (season complete) or firstCompetitionWeek (fallback)
   c. If found week < firstCompetitionWeek → use firstCompetitionWeek as PREVIEW (mid-season start)
3. No NflGame rows for the season year → return firstCompetitionWeek as PREVIEW
```

`isPreview = true` when the resolved week is before the first competition week, or when the season is not yet initialized, or when no games exist.

### Existing utilities to reuse (do NOT reinvent)

| Need | Existing code | Path |
|------|--------------|------|
| Moneyline + spread for a week | `getEffectiveOddsLinesForWeek()` | `src/lib/nfl/effective-odds.ts` |
| Deadline UTC | `computePickDeadlineUtc(firstKickoff)` | `src/lib/domain/pick-deadline.ts` |
| Deadline check (for guard) | `isNflWeekPickWindowClosedByDeadline()` | `src/lib/domain/pick-deadline.ts` |
| Season resolution | `resolveCurrentSeasonForLeague()` | `src/lib/league/resolve-current-season.ts` |
| Week in competition? | `isWeekInLeagueCompetition(season, week)` | `src/lib/nfl/nfl-regular-season.ts` |
| Business timezone const | `LEAGUE_BUSINESS_TIMEZONE` | `src/lib/league/league-rules.ts` |
| Prisma singleton | `prisma` | `src/lib/db.ts` |
| Auth | `auth()` | `src/lib/auth.ts` |
| Participant membership check | `isLeagueParticipantRole()` | `src/lib/league/participant-membership.ts` |
| CSRF guard | `assertCookieSessionMutationOrigin()` | `src/lib/cookie-session-mutation-csrf.ts` |

### Architecture compliance

| Requirement | Implementation |
|------------|---------------|
| Secrets server-only | `WEATHER_API_KEY` in server code and `.env.example`; never `NEXT_PUBLIC_` |
| One Prisma client | `import { prisma } from "@/lib/db"` only |
| MUI Stack for flex | Replace any `Box` with `Stack` when the purpose is flex row/column layout |
| Error JSON shape | `{ "error": { "code": "...", "message": "..." } }` with appropriate HTTP status |
| Dates in UTC storage, Eastern for display | Use `formatInTimeZone(kickoffAt, LEAGUE_BUSINESS_TIMEZONE, "...")` for UI time display |
| Server Components by default | Page is RSC; only interactive children use `"use client"` |
| `notFound()` for missing resources | Route handler returns 404 for missing league/season; page redirects unauthenticated users |

[Source: `docs/project-context.md` — non-negotiables 1, 2, 6; `_bmad-output/planning-artifacts/architecture.md` — Frontend architecture, API patterns, Dates and times]

### API design — GET picks week view

```
GET /api/leagues/[leagueId]/picks?weekNumber=3

Response 200:
{
  "weekNumber": 3,
  "isPreview": false,
  "pickDeadlineUtc": "2026-09-18T00:10:00.000Z",  // or null if no games
  "jailedTeamId": "clxyz...",                        // or null if not computed yet
  "matchups": [
    {
      "gameId": "clxyz...",
      "kickoffAt": "2026-09-18T00:20:00.000Z",
      "homeTeam": { "id": "...", "abbreviation": "BUF", "name": "Buffalo Bills" },
      "awayTeam": { "id": "...", "abbreviation": "NYJ", "name": "New York Jets" },
      "homeMoneylineAmerican": -280,
      "awayMoneylineAmerican": 230,
      "homeSpreadPoints": -6.5,
      "weather": {
        "tempF": 58,
        "condition": "Partly Cloudy",
        "windMph": 12
      }
    }
  ]
}
```

Errors:
- `401 UNAUTHENTICATED` — no session
- `403 FORBIDDEN` — not a league participant
- `404 SEASON_NOT_FOUND` — no season for league + current year
- `400 GAMES_NOT_LOADED` — no games for the requested week (week supplied explicitly with no data)

### Weather integration

**Provider:** [OpenWeatherMap](https://openweathermap.org/api/one-call-3) — free tier allows 1,000 calls/day on One Call API 3.0 (or current free plan — confirm exact limit at implementation time).

**Endpoint:**
```
GET https://api.openweathermap.org/data/2.5/weather
  ?lat={lat}&lon={lon}&appid={WEATHER_API_KEY}&units=imperial
```

**Env var:** `WEATHER_API_KEY` (server-only; add to `.env.example` with placeholder comment)

**Stadium locations map** (`src/lib/integrations/weather/stadium-locations.ts`):
- Static record: `Record<string, { lat: number; lon: number }>` keyed by team abbreviation
- All 32 NFL teams should be covered; use approximate stadium coordinates (Google Maps for each)
- Example: `BUF: { lat: 42.7738, lon: -78.7870 }` (Highmark Stadium)

**Failure modes to handle silently:**
- `WEATHER_API_KEY` not set → return `null`, skip API call
- Network error or non-200 response → return `null`, log structured warning (not error)
- Team abbreviation not in stadium map → return `null`
- Response parsing failure → return `null`

**No weather in `npm test`** — weather integration tests are not required for MVP; unit-test the resolver and matchup rendering with `weather = null`.

### Component structure

```
src/components/picks/
  TeamLogo.tsx          — abbreviation-in-circle placeholder (3.8 upgrades)
  MatchupCard.tsx       — display-only card for one game (3.7 adds click handlers)
  WeekMatchupList.tsx   — list of MatchupCard, sorted by kickoffAt
  PicksPreviewBanner.tsx — info banner for off-season preview mode
```

```
src/lib/nfl/
  resolve-picks-week.ts     — pure week resolver + Vitest tests (co-located)
```

```
src/lib/integrations/weather/
  client.ts             — fetchWeatherForTeam(), fail-soft
  stadium-locations.ts  — static team abbreviation → lat/lon map
```

### MatchupCard design detail

Per UX spec (Component Strategy — MatchupCard section):

```
┌─────────────────────────────────────┐
│ Thu 8:20 PM ET    ☁ 58°F 12mph W   │  ← header row
├─────────────────────────────────────┤
│ [BUF]  Bills  +230  @  -280  Chiefs [KC] │  ← teams + moneyline
│        -6.5 spread (home Chiefs)    │  ← spread
└─────────────────────────────────────┘
```

Actual responsive layout using MUI `Stack`:
- Header: `Stack direction="row" justifyContent="space-between"` — kickoff time (left), weather chip (right)
- Teams: `Stack direction="row" alignItems="center" spacing={1}` — away side | "@" divider | home side
- Each team side: `Stack spacing={0.5}` — `TeamLogo` → team name → moneyline
- Spread row: secondary `Typography` below teams

**State variants (display-only for 3.6):**
- Default: all teams selectable-looking (3.7 adds click)
- No odds: show "–" placeholders
- No weather: hide weather badge
- Preview mode: card visually unchanged, but page banner communicates not-pickable

**3.7 hook points** (prep but don't implement):
- `MatchupCard` accepts `onTeamSelect?: (teamId: string) => void` prop (pass `undefined` in 3.6)
- `MatchupCard` accepts `selectedTeamId?: string | null` prop (pass `undefined` in 3.6)
- `MatchupCard` accepts `jailedTeamId?: string | null` prop (pass through from GET response; visual blocking implemented in 3.7)
- `MatchupCard` accepts `pickedTeamIds?: string[]` prop (season pick history; 3.7 grays out already-picked teams)

### Kickoff time display

Use `date-fns-tz` (already in `package.json`) to display kickoff in Eastern:

```typescript
import { formatInTimeZone } from "date-fns-tz";
import { LEAGUE_BUSINESS_TIMEZONE } from "@/lib/league/league-rules";

formatInTimeZone(kickoffAt, LEAGUE_BUSINESS_TIMEZONE, "EEE h:mm a 'ET'")
// → "Thu 8:20 PM ET"
```

### Spread display convention

`homeSpreadPoints` is negative when home team is favored (e.g., -6.5 = home favored by 6.5). Display as:
- Home side: `-6.5` (negative = favored)
- Away side: `+6.5` (positive = underdog)

Format: always show sign (`+` for positive, `-` is implicit in the number). Use `Intl.NumberFormat` or a helper with `{ signDisplay: "always" }`.

### Project structure compliance

New files belong in:
- `src/components/picks/` — per architecture structure map (FR14–FR27 lives here)
- `src/lib/nfl/` — existing domain for NFL schedule/odds logic
- `src/lib/integrations/weather/` — parallel to existing `src/lib/integrations/the-odds-api/`
- `src/app/api/leagues/[leagueId]/picks/route.ts` — extend existing route (add GET handler)
- `src/app/(app)/leagues/[leagueId]/picks/page.tsx` — existing placeholder to replace

### Story 3.5 intelligence (previous story)

- **Date library in use:** `date-fns` + `date-fns-tz` — already in `package.json`. Use these for all time manipulation. Do not add a new library.
- **`LEAGUE_BUSINESS_TIMEZONE`** is the canonical TZ constant — never hardcode `"America/New_York"` again.
- **Error JSON shape** established: `{ "error": { "code": "SOME_CODE", "message": "…" } }` with appropriate HTTP status — follow exactly in the new GET handler.
- **Picks route patterns:** CSRF check, membership guard, then data access — follow same pattern in GET handler. Note: GET requests do not require CSRF origin check (state-changing mutation protection only); membership check still applies.

### Story 3.4 intelligence (two stories back)

- **Pick API** at `POST /api/leagues/[leagueId]/picks` is complete — do not modify except to add the GET handler.
- **`postPickBodySchema`** is defined in `src/lib/picks/post-pick-body.ts` — no changes needed.
- **`runPickMutation`** in the route is the transaction pattern — GET response does not need a transaction (read-only, eventual consistency acceptable).

### Git intelligence (recent commits)

- **Story 3-5** (`1bf525c`): Added `date-fns`/`date-fns-tz`, `computePickDeadlineUtc`, `checkPickMutationDeadline` — all reusable in 3.6.
- **Story 3-4** (`fb819b6`): Picks POST, `runPickMutation` transaction pattern, CSRF guard pattern — follow for GET handler.
- **Story 3-3** (`ceda6eb`): Jailed computation; `src/lib/domain/jailed.ts` — GET endpoint should return `jailedTeamId` so 3.7 doesn't need another fetch.
- **Story 3-2** (`18f8c0f`): `getEffectiveOddsLinesForWeek()`, `OddsSnapshotRun`, `NflGameOddsLine` — this is how odds are read; use as-is.

### Data model summary (relevant subset)

```
NflGame: id, nflSeasonYear, weekNumber, homeTeamId, awayTeamId, kickoffAt
Team: id, abbreviation, name
NflGameOddsLine: nflGameId, homeMoneylineAmerican?, awayMoneylineAmerican?, homeSpreadPoints?
NflWeekJailedTeam: nflSeasonYear, weekNumber, jailedTeamId
Season: id, leagueId, nflSeasonYear, firstCompetitionWeek, preSeasonInitializedAt, firstCompetitionWeekLockedAt
```

[Source: `prisma/schema.prisma`]

### Rate limiting

The GET handler reads data, not a high-risk mutator. No rate limit entry is required for this story. However, if a rate limit is added later, follow the pattern in `src/proxy.ts` and `src/lib/rate-limit.ts`.

[Source: `docs/project-context.md` — §9, noting existing rate-limited paths]

### Testing requirements

**Must run:** `npm test` — all existing tests must pass.

**Add tests for:**
- `resolvePicksWeekNumber` in `src/lib/nfl/resolve-picks-week.test.ts` — table tests:
  - Pre-season (no season row) → preview, firstCompetitionWeek
  - Season initialized, future games exist → active week returned
  - Season initialized, all games past → last week (post-season)
  - Season initialized, future week < firstCompetitionWeek → preview with firstCompetitionWeek
  - Empty games list → preview fallback

**Optional (not blocking):**
- `MatchupCard` rendering — Vitest/JSX tests for odds display, missing odds "–", week header

**No live network in tests** — weather integration does not have automated tests at MVP level (too many network deps); unit-test the resolver and component rendering with mocked/null weather instead.

[Source: `.cursor/rules/post-change-testing.mdc`; `docs/project-context.md` — Testing/quality section]

### Deferred items (do not build in 3.6)

- Pick selection clicks and state management (Story 3.7)
- Jailed team visual blocking / anti-jailed bonus path (Story 3.7)
- Already-picked team graying with "PICKED WK X" tag (Story 3.7)
- Deadline countdown timer (Story 3.7)
- Pick submission confirmation banner (Story 3.7)
- Real NFL team logos (Story 3.8)
- NFL schedule sync beyond Week 1 seed (Story 3.9)
- Admin pick override UI (Story 4.2)

### Open questions

- **Weather provider:** OpenWeatherMap free tier is suggested (1,000 calls/day). At ~32 teams × ~16 games per week × 1 page load, a single server-side fetch per week snapshot is extremely low usage. Confirm the free tier is sufficient at implementation. If OpenWeatherMap changes tier limits, any provider returning `{ temp_f, condition, wind_mph }` for lat/lon works — the integration is isolated behind the `fetchWeatherForTeam` function.
- **Weather freshness:** Weather is fetched server-side on each page load (no caching in MVP). This is fine for ~14 concurrent users; add per-request caching (`next/cache` or in-memory TTL) only if performance testing reveals a problem.
- **Pre-season preview week override:** If no `NflGame` rows exist for Week 1 (only the default seed provides Week 1), the preview page renders an empty state ("No game schedule loaded yet"). This is acceptable for MVP — Week 1 seed is explicitly seeded by `npm run db:seed`.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- Implemented `resolvePicksWeekNumber` + `computePicksUiIsPreview` with Vitest coverage; server-only `buildLeaguePicksWeekView` shared by `GET /api/leagues/[leagueId]/picks` and the picks RSC page.
- OpenWeatherMap fail-soft weather via `WEATHER_API_KEY` + `NFL_STADIUM_BY_TEAM_ABBR` (32 teams); types split to `picks-week-view-types.ts` so client components do not import Prisma/server modules.
- Picks UI: `PicksPreviewBanner`, `WeekMatchupList`, `MatchupCard`, `TeamLogo`; kickoffs use `formatInTimeZone` + `LEAGUE_BUSINESS_TIMEZONE`; `pickDeadlineUtc` and `jailedTeamId` on API + passed into `WeekMatchupList` for Story 3.7.
- `npm test`, `npm run lint`, and `npm run build` pass.

### File List

- `src/lib/nfl/resolve-picks-week.ts`
- `src/lib/nfl/resolve-picks-week.test.ts`
- `src/lib/picks/build-league-picks-week-view.ts`
- `src/lib/picks/picks-week-view-types.ts`
- `src/lib/picks/week-query-param.ts`
- `src/lib/integrations/weather/client.ts`
- `src/lib/integrations/weather/stadium-locations.ts`
- `src/app/api/leagues/[leagueId]/picks/route.ts`
- `src/app/(app)/leagues/[leagueId]/picks/page.tsx`
- `src/components/picks/MatchupCard.tsx`
- `src/components/picks/WeekMatchupList.tsx`
- `src/components/picks/TeamLogo.tsx`
- `src/components/picks/PicksPreviewBanner.tsx`
- `.env.example`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- **2026-04-28** — Story created (`create-story` workflow): `epics.md` Story 3.6, `sprint-status.yaml`, `project-context.md`, `prd.md` FR14–15, `architecture.md` patterns, `ux-design-specification.md` MatchupCard/design system, stories 3-4 + 3-5 artifacts, codebase analysis (effective-odds, picks route, picks page placeholder, schema, nfl-regular-season, resolve-current-season, pick-deadline, league-rules, nfl-odds-integration.md). Status **ready-for-dev**.
- **2026-04-28** — Implementation complete (dev-story): picks week resolver + preview flag, weather client + stadium map, GET picks week JSON, picks page UI with preview banner and matchup cards; tests + lint + build green. Status **review**.
