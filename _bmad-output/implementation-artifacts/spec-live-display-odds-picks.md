---
title: 'Live display odds on picks (jailed stays Tuesday-locked)'
type: 'feature'
created: '2026-08-03'
status: 'done'
baseline_commit: '5904bd4d21a0841be3ee73bdd8e1f23e5c9f519c'
context:
  - '{project-root}/docs/project-context.md'
  - '{project-root}/docs/nfl-odds-integration.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Picks page odds come only from the Tuesday (or last completed) DB snapshot, so moneyline/spread go stale even though real-world lines move during the week. Participants still need the jailed team to stay fixed once set on Tuesday.

**Approach:** For the **current** competition week only, overlay **display** moneyline/spread from The Odds API on picks page loads, behind a short server TTL cache (default **30 minutes**, coalesce in-flight). Keep `NflWeekJailedTeam` as the sole jailed source; never recompute or overwrite jailed from this path. Past weeks and failures keep using persisted effective odds.

## Boundaries & Constraints

**Always:**
- Jailed team for a week is read only from `NflWeekJailedTeam`; this feature must not call `computeAndPersistNflWeekJailed` or `POST .../week-jailed`.
- Live fetch is **display-only**: do not create `OddsSnapshotRun` / `NflGameOddsLine` rows from the picks refresh path (so mid-week jailed recompute still sees Tuesday/admin snapshot lines).
- Live overlay applies only when the requested week equals the league’s **current** active week (not explicit past weeks, not preview-of-future beyond current).
- Skip provider fetch for **test leagues** (use DB/fixture effective odds).
- Secrets stay server-only; degrade gracefully if `ODDS_API_KEY` missing or provider fails → show DB effective odds.
- Mirror weather’s in-memory TTL + in-flight coalesce pattern; TTL default 30 minutes.

**Ask First:**
- Changing TTL outside 15–60 minutes.
- Persisting live lines into snapshot tables (would risk jailed recompute drift).
- Live odds on admin week-odds, emails, or non-picks surfaces.

**Never:**
- WebSockets / client-side Odds API calls / exposing `ODDS_API_KEY`.
- Changing jailed identification rules or unlocking jailed mid-week via odds movement.
- Per-request uncached provider calls under normal SSR traffic.
- Broad rewrite of snapshot/admin odds tooling beyond what’s needed for display overlay.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Current week, cache miss, API OK | Picks view for active week; TTL expired/empty | Matchup ML/spread from fresh provider map; `jailedTeamId` unchanged from DB | N/A |
| Current week, within TTL | Second load within 30m | Same overlay lines; **no** second provider HTTP | N/A |
| Provider fail / no key | Current week; API error or missing key | ML/spread from `getEffectiveOddsLinesForWeek`; jailed unchanged | Log/soft-fail; never blank the page solely for odds refresh |
| Past week via `?weekNumber=` | Explicit week ≠ current | DB effective odds only; no provider call | N/A |
| Test league | `isTestLeague` | DB/fixture odds only; no provider call | N/A |
| Partial provider match | API returns subset of games | Overlay matched games; unmatched keep DB effective lines | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/picks/build-league-picks-week-view.ts` -- SSR/API picks payload; today calls `getEffectiveOddsLinesForWeek` then attaches jailed from DB
- `src/lib/nfl/effective-odds.ts` -- persisted snapshot merge (fallback + jailed input authority)
- `src/lib/integrations/the-odds-api/client.ts` -- `fetchAmericanFootballNflOdds`
- `src/lib/integrations/the-odds-api/` -- match events → games, extract ML/spread (reuse)
- `src/lib/integrations/weather/client.ts` -- TTL + inflight pattern to mirror
- `src/lib/nfl/snapshot-nfl-week-odds.ts` -- Tuesday/admin persist path (**do not** call from picks load)
- `src/lib/nfl/jailed-computation.ts` -- jailed upsert (**must not** run on picks load)
- `src/app/(app)/leagues/[leagueId]/picks/page.tsx` -- picks page entry (no Odds API today)
- `docs/nfl-odds-integration.md` -- document display refresh vs Tuesday snapshot (NFR31 display carve-out)

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/nfl/live-display-odds.ts` (or equivalent under `src/lib/nfl/` / `the-odds-api/`) -- Add TTL-cached (30m) + inflight-coalesced helper that fetches provider odds, maps onto week `NflGame`s via existing match/extract helpers, returns per-game display lines; no DB writes; export test-clear helper like weather
- [x] `src/lib/picks/build-league-picks-week-view.ts` -- For non-test league + current week only, merge live display lines over effective odds; keep jailed from `nflWeekJailedTeam` only; on live miss/fail keep effective odds
- [x] `src/lib/nfl/live-display-odds.test.ts` (and/or builder unit tests) -- Cover I/O matrix: TTL reuse, fail-soft fallback, skip past week / test league, partial match, never invokes jailed persist
- [x] `docs/nfl-odds-integration.md` -- Note: jailed/Tuesday snapshot still authoritative for locked week identity; picks **display** may refresh mid-week with server TTL; credits ~2 per cache miss

**Acceptance Criteria:**
- Given a non-test league on its current week with a locked jailed team, when a participant loads picks and the display-odds cache misses, then matchup odds reflect a fresh provider fetch (or mapped subset) while `jailedTeamId` matches the existing `NflWeekJailedTeam` row.
- Given a second picks load within the TTL, when the builder runs, then no additional Odds API HTTP request is made.
- Given provider failure or missing key, when the current-week picks view builds, then odds fall back to `getEffectiveOddsLinesForWeek` and the page still renders.
- Given `?weekNumber=` for a past week (or a test league), when picks view builds, then the provider is not called.
- Given this feature ships, when Tuesday snapshot / jailed admin flows run, then their persist behavior is unchanged (no accidental coupling from picks SSR).

## Spec Change Log

## Design Notes

**Why display-only (no snapshot write):** `computeAndPersistNflWeekJailed` reads `getEffectiveOddsLinesForWeek`. Writing mid-week snapshot runs would let an admin recompute change jailed before deadline. Overlay keeps NFR23/jailed stability while relaxing NFR31 for **UI display only**.

**Current week gate:** Compare requested `targetWeek` to `resolveActiveWeekNumber(...)` (same inputs the builder already uses). Explicit past weeks → DB only.

**Quota:** Free tier ~500 credits/mo; ~2 credits per successful fetch. 30m TTL + inflight coalesce keeps Sunday traffic cheap vs per-SSR calls.

## Verification

**Commands:**
- `npm test` -- expected: new/updated odds display tests pass; existing effective-odds / jailed tests still pass
- `npm run lint` -- expected: clean on touched files

**Manual checks (if no CLI):**
- On current week with `ODDS_API_KEY` set: load picks, confirm lines can differ from a stale Tuesday snapshot while jailed badge/team stays the same; reload within ~30m and confirm no unexpected quota burn (logs/network).
- Browse a past `weekNumber`: odds stay snapshot-based; no provider call.

## Suggested Review Order

**Picks entry + jailed isolation**

- Current-week / non-test gate before any provider call
  [`build-league-picks-week-view.ts:152`](../../src/lib/picks/build-league-picks-week-view.ts#L152)

- Live fetch is display-only; never persists snapshot rows
  [`build-league-picks-week-view.ts:158`](../../src/lib/picks/build-league-picks-week-view.ts#L158)

- Jailed still read only from `NflWeekJailedTeam`
  [`build-league-picks-week-view.ts:187`](../../src/lib/picks/build-league-picks-week-view.ts#L187)

**Live odds helper**

- Pure gate shared by builder + unit tests
  [`live-display-odds.ts:44`](../../src/lib/nfl/live-display-odds.ts#L44)

- 30m TTL + inflight coalesce; complete lines only; no empty-match cache
  [`live-display-odds.ts:66`](../../src/lib/nfl/live-display-odds.ts#L66)

- Fail-soft merge keeps baseline when live is incomplete
  [`live-display-odds.ts:155`](../../src/lib/nfl/live-display-odds.ts#L155)

**Docs**

- Display overlay vs Tuesday jailed authority carve-out
  [`nfl-odds-integration.md:112`](../../docs/nfl-odds-integration.md#L112)

**Tests**

- Gate: test league / past week skipped
  [`live-display-odds.test.ts:40`](../../src/lib/nfl/live-display-odds.test.ts#L40)

- Incomplete lines cannot wipe snapshot odds
  [`live-display-odds.test.ts:166`](../../src/lib/nfl/live-display-odds.test.ts#L166)
