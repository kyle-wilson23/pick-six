# Accessibility checklist — Story 7.3 (WCAG 2.1 Level A / NFR37–NFR44)

Core flows: **login**, **picks**, **standings** (+ league shell chrome).

## Automated

- [x] `buildTeamPickAriaLabel` unit tests (`src/lib/picks/team-pick-aria-label.test.ts`)
- [x] `StandingsTable` axe smoke (`wcag2a`) + current-user semantics (`StandingsTable.test.tsx`)
- [x] `npm test` / lint on touched files

## Manual — keyboard-only

- [ ] `/login`: Tab reaches email → password → Login → “Back to home”; submit with empty fields focuses error alert; valid login proceeds
- [ ] After login, open a league: first Tab shows **Skip to main content**; Enter moves focus to `#main-content`
- [ ] Desktop: Tab through league nav tabs; active tab has `aria-current="page"`; Enter opens tab
- [ ] Mobile viewport: bottom nav actions are Tab/Enter operable
- [ ] `/picks`: Tab order is status/deadline/jailed context → matchup radios → (if present) 2 PTS chip; arrow keys move within radiogroup; Enter/Space selects; jailed/picked sides announce state in name
- [ ] `/standings`: table reachable; current user row announced as current (You)

## Manual — screen reader spot-check (VoiceOver + Safari recommended)

- [ ] Login validation / auth failure: alert announced; fields marked invalid with helper text
- [ ] Picks: team radio names include jailed / already picked week N / selected / locked as applicable
- [ ] Standings: “League standings” table name; current row includes “(You)”

## Manual — contrast / non-color

- [ ] Body text and labels on `#121212` / `#1E1E1E` meet ≥4.5:1 (DevTools contrast)
- [ ] Deadline urgency readable from text (“Picks lock in” + countdown label), not color alone
- [ ] Selected pick visible via styling **and** `aria-checked`; standings current user via `aria-current` + “(You)”

## Known Level A exceptions

_(none)_
