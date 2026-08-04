---
title: 'League rules page user-facing copy'
type: 'chore'
created: '2026-08-03'
status: 'done'
route: 'one-shot'
baseline_commit: 'c885ad3da737f9516de204086acc9db3d712e3b1'
---

# League rules page user-facing copy

## Intent

**Problem:** The league rules page still read like an internal MVP note (“fixed for the MVP,” admin customization caveats, server/audit jargon), which is wrong for participants looking up how the league works.

**Approach:** Rewrite the rules page copy for a participant audience—clear scoring, jail, deadline, and visibility language—with no “MVP” references, while keeping the same product facts.

## Suggested Review Order

- Intro no longer mentions MVP; states rules are shared and fixed in-app
  [`page.tsx:59`](../../src/app/(app)/leagues/[leagueId]/rules/page.tsx#L59)

- Scoring: 1 vs 2 points when beating the jailed team’s opponent
  [`page.tsx:92`](../../src/app/(app)/leagues/[leagueId]/rules/page.tsx#L92)

- Jailed team + locked weekly odds snapshot (same for everyone)
  [`page.tsx:111`](../../src/app/(app)/leagues/[leagueId]/rules/page.tsx#L111)

- Jail-selection ties: moneyline → spread → seeded random
  [`page.tsx:125`](../../src/app/(app)/leagues/[leagueId]/rules/page.tsx#L125)

- Deadline and Tuesday peer-pick visibility wording
  [`page.tsx:168`](../../src/app/(app)/leagues/[leagueId]/rules/page.tsx#L168)
