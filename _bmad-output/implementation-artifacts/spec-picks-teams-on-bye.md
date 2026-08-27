---
title: 'List teams on bye on the Picks page'
type: 'feature'
created: '2026-08-26'
status: 'done'
baseline_commit: 'e523ebfd6ebbafbd13aa5b515920477657417316'
context:
  - '{project-root}/docs/project-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-design-specification.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Picks page only shows scheduled matchups, so teams sitting out that week are invisible. Participants cannot tell who is unavailable or why the slate is short.

**Approach:** Derive bye teams as the `Team` catalog minus home/away participants in that week’s already-resolved games (live → canonical `NflGame`, test → `LeagueSimGame`). List them above the Week N Matchups heading. Hide the section when there are no bye teams.

## Boundaries & Constraints

**Always:**
- Use the **same week games** as the matchup list (`resolveGamesForLeague` / `gamesForWeek` in `buildLeaguePicksWeekView`) so live and test leagues share one derivation
- Catalog = all `Team` rows (the seeded 32 NFL clubs). Bye = id not appearing as `homeTeamId` or `awayTeamId` in those week games
- Odds API (and fixtures) persist **games only** — do not fetch or hardcode a bye calendar
- Follow the picks page’s **target week** (resolved current week or `?weekNumber=`)
- Place the block **above** the existing `Week {n} Matchups` heading
- Header copy **Teams on Bye**, same `Typography variant="h6" component="h2"` as the matchups heading
- Hide the entire section when the bye list is empty (full 16-game card / every club in a matchup)
- Hide when there are **no matchups** (do not treat “schedule not loaded” as 32 byes)
- Hide when the week has **fewer than 13 games** (incomplete slate, not a real NFL/fixture bye week; typical cards are 13–16)
- Informational only: logo + name, **not** pickable, **not** `MatchupCard`
- Sort stably by team name, then abbreviation
- Prefer MUI `Stack` for flex layout; `"use client"` on any MUI + `TeamLogo` subtree

**Ask First:**
- Showing bye teams on email, admin, Results, Opponents, or CSV
- Treating sparse weeks (&lt;13 games) as byes instead of hiding
- Persisting bye rows or calling a third-party bye endpoint

**Never:**
- Changing pick POST validation, jailed rules, or making bye teams selectable
- Client-only derivation that can disagree with the SSR / GET payload
- Rendering the heading with an empty list

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Full card | 16 games, all 32 teams play | Section hidden | N/A |
| Live/test bye week | 13–15 games; N teams absent | Those N teams listed above matchups | N/A |
| Empty week | 0 matchups | Section hidden; existing empty-week copy unchanged | N/A |
| Incomplete slate | 1–12 games loaded | Section hidden (not treated as byes) | N/A |
| Week query | `?weekNumber=` with a bye week | Bye list matches that week’s games, not “current” | N/A |
| Test fixture cycle | Fixture week with 15 games (2 omitted) | Those 2 clubs listed | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/picks/teams-on-bye.ts` -- Pure `teamsOnBye(allTeams, weekGames)` + sort; hide rules (empty games, &lt;13 games, empty remainder)
- `src/lib/domain/picks.ts` -- Existing `teamPlaysInWeek`; reuse as the “in this week’s games” predicate (do not fork)
- `src/lib/picks/picks-week-view-types.ts` -- Add `teamsOnBye: { id; abbreviation; name }[]` on `PicksWeekViewPayload`
- `src/lib/picks/build-league-picks-week-view.ts` -- Load `Team` rows; derive from `gamesForWeek`; attach to payload (GET `/api/leagues/[leagueId]/picks` shares this)
- `src/components/picks/TeamsOnByeSection.tsx` -- Client header + wrapping `TeamLogo` (`sm`) + name; render nothing if `teams.length === 0`
- `src/components/picks/WeekMatchupList.tsx` -- Accept `teamsOnBye`; render section immediately above the matchups `h2` (line ~273)
- `src/app/(app)/leagues/[leagueId]/picks/page.tsx` -- Pass `payload.teamsOnBye` into `WeekMatchupList`
- `src/lib/nfl/resolve-games-for-league.ts` -- Existing live vs test seam (do not fork)
- `prisma/data/nfl-simulation-fixture-schedule.json` -- Test weeks omit clubs by design (wk1/5: 0 byes; wk2: ATL/CAR; wk3: 4; wk4: 6)

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/picks/teams-on-bye.ts` (+ `*.test.ts`) -- Pure derive/sort/hide covering the I/O matrix
- [x] `src/lib/picks/picks-week-view-types.ts` + `build-league-picks-week-view.ts` -- Load catalog; set `teamsOnBye` from `gamesForWeek`
- [x] `src/components/picks/TeamsOnByeSection.tsx` -- `h6`/`h2` **Teams on Bye**; wrapping `Stack` of logo + name; null render when empty
- [x] `src/components/picks/WeekMatchupList.tsx` + picks `page.tsx` -- Prop-wire; section above **Week {n} Matchups**

**Acceptance Criteria:**
- Given a week with 13–15 resolved games, when a participant opens Picks (live or test), then teams not in those games appear under **Teams on Bye** above the matchups heading.
- Given a week where all catalog teams are in matchups, when the page renders, then **Teams on Bye** is absent.
- Given no games or fewer than 13 games for the target week, when the page renders, then **Teams on Bye** is absent.
- Given `?weekNumber=` for another week, when that week has byes, then the list matches that week.
- Given the bye list is visible, when a participant taps a bye team, then no draft/select/submit occurs.

## Spec Change Log

## Design Notes

The Odds API `/events` (and sim fixtures) only emit games. Bye = set-difference against `Team`, using the hybrid schedule seam already used for matchups — not a second provider path. Pick validation already rejects bye teams via `teamPlaysInWeek` (`TEAM_NOT_IN_WEEK`); leave that unchanged.

NFL regular-season cards are `(32 − byes) / 2` games → **13–16**. Fixture JSON is authored in that band. Hiding below 13 games avoids listing ~20 “byes” when a week is only partially synced (or a test week not yet snapshotted). Persisted `NflGame` rows survive mid-season incomplete `/events` feeds (orphan-delete is already gated).

```ts
// games.length < 13 || games.length === 0 → []
// else catalog.filter(t => !teamPlaysInWeek(t.id, games)).sort(name, abbr)
```

`TeamLogo` `size="sm"` + full name; do not pass `disabled`/`jailed`/`pickedWeekTag` (not a pick control). Compact row pattern: `OpponentsPicksTable` PickCell (`Stack direction="row"` + logo + label).

## Verification

**Commands:**
- `npm test` -- new `teams-on-bye` tests plus existing picks/schedule tests pass

**Manual checks (if no CLI):**
- Test league after odds snapshot: fixture week 1 (16 games) → no section; week 2 (15 games) → ATL and CAR above matchups
- Same header size/weight as **Week N Matchups**; section gone when navigating to a full-card week

## Suggested Review Order

**Derivation**

- Catalog minus this week's games; empty when the slate is under 13 games
  [`teams-on-bye.ts:13`](../../src/lib/picks/teams-on-bye.ts#L13)

- Reuse the existing “plays this week” predicate instead of a second matcher
  [`picks.ts:22`](../../src/lib/domain/picks.ts#L22)

- Bye list uses the same kickoff-filtered games as the matchup cards
  [`build-league-picks-week-view.ts:232`](../../src/lib/picks/build-league-picks-week-view.ts#L232)

- Attach `teamsOnBye` on the shared picks payload (SSR + GET)
  [`build-league-picks-week-view.ts:269`](../../src/lib/picks/build-league-picks-week-view.ts#L269)

**Picks UI**

- Read-only `h6`/`h2` region with wrapping logo + name rows
  [`TeamsOnByeSection.tsx:25`](../../src/components/picks/TeamsOnByeSection.tsx#L25)

- Render above **Week N Matchups** only when matchups exist
  [`WeekMatchupList.tsx:278`](../../src/components/picks/WeekMatchupList.tsx#L278)

- Pass server-derived byes; no client recompute
  [`page.tsx:145`](../../src/app/(app)/leagues/[leagueId]/picks/page.tsx#L145)

**Types and tests**

- Required payload field so GET JSON matches the page
  [`picks-week-view-types.ts:51`](../../src/lib/picks/picks-week-view-types.ts#L51)

- I/O matrix: full card, 13–15 byes, empty/incomplete, week isolation
  [`teams-on-bye.test.ts:53`](../../src/lib/picks/teams-on-bye.test.ts#L53)
