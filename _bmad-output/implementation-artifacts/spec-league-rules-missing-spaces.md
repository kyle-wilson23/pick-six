---
title: 'League rules missing spaces'
type: 'bugfix'
created: '2026-09-04'
status: 'done'
route: 'one-shot'
---

# League rules missing spaces

## Intent

**Problem:** On the league rules page, two sentences rendered without a space after a bolded term: “moneylineamong” and “point spreadin.”

**Approach:** Insert an explicit JSX space after those `</strong>` tags, matching the page’s existing `{' '}` pattern so the words stay separated at render.

## Suggested Review Order

- Explicit space after jailed-team “moneyline” so “among” stays a separate word
  [`page.tsx:111`](../../src/app/(app)/leagues/[leagueId]/rules/page.tsx#L111)

- Explicit space after “point spread” so “in” stays a separate word
  [`page.tsx:131`](../../src/app/(app)/leagues/[leagueId]/rules/page.tsx#L131)
