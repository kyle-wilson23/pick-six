---
title: 'Remove repeated matchup spread subtext'
type: 'refactor'
created: '2026-10-01'
status: 'done'
route: 'one-shot'
---

# Remove repeated matchup spread subtext

## Intent

**Problem:** Each matchup card printed the point spread under both teams and then again in a footer (`Spread · Home … · Away … (home perspective)`). The footer restated the same two numbers and used storage jargon.

**Approach:** Delete that footer. Leave the signed spread beside each team's moneyline, and speak that same number in the side's accessible name so screen readers still hear the line.

## Suggested Review Order

**Card copy**

- Each side still shows its signed spread beside the moneyline.
  [`MatchupCard.tsx:287`](../../src/components/picks/MatchupCard.tsx#L287)

- The repeated home/away footer is gone; the team row is the last content.
  [`MatchupCard.tsx:409`](../../src/components/picks/MatchupCard.tsx#L409)

**Accessible name**

- The spoken name includes the same signed spread the side already shows.
  [`team-pick-aria-label.ts:19`](../../src/lib/picks/team-pick-aria-label.ts#L19)

- The card passes that formatted spread into the name.
  [`MatchupCard.tsx:222`](../../src/components/picks/MatchupCard.tsx#L222)

**Tests**

- Posted and missing lines are both covered.
  [`team-pick-aria-label.test.ts:47`](../../src/lib/picks/team-pick-aria-label.test.ts#L47)

- The card shows each side's spread once and no footer.
  [`MatchupCard.test.tsx:40`](../../src/components/picks/MatchupCard.test.tsx#L40)
