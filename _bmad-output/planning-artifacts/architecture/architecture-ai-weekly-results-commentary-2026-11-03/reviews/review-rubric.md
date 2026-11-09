# Rubric review — AI weekly results commentary

**Verdict: fail**

Reviewed `ARCHITECTURE-SPINE.md` only as the artifact under test (feature altitude, scope `SPEC-ai-weekly-results-commentary`, status draft). The spine was not edited. No parent AD-numbered spine was invented. Named versions were checked against `package.json` in this repo. No web lookup.

The checked-claims paradigm, the one-run rule, the ceiling ownership, and the debug split are real invariants and they match CAP-2, CAP-3, and CAP-5. The spine still fails the checklist: two epics can attach history to different people, the screenshot import can key the wrong year, commentary can default on, and a crashed Tuesday send can call the model twice. Environments are a silent dimension.

## Checklist

### Divergence points the next level can hit

Feature altitude has to keep epics and stories from choosing incompatible joins, spend gates, and send behavior. These are fixed well enough that two epics can share them:

- Checked claims, with the app writing every name, number, and the quiet line (AD-1, conventions).
- One commentary row per league, NFL season year, and week, created by a delivering send, skipped by a suppressed test-league send (AD-4, naming convention). That key matches `LeagueWeekEmailConfig` (`leagueId`, `nflSeasonYear`, `weekNumber`).
- Scores mail still sends, proved items stay, the quiet line is only a normal zero, and an abnormal zero omits the section (AD-5).
- One app-built view, re-proved against the database, no credentials in the view (AD-6).
- Vercel AI SDK only, prices in server config, decimal dollars, missing price does not call (AD-7).
- Per-league ceiling, default $1, admin writes only the on/off flag, Kyle writes ceiling and debug (AD-8).
- Local screenshot reader, legend points, CSV rejected, missing year does not block the weekly feature, that spend sits outside the weekly ceiling (AD-9).
- Debug hold on the existing admin email screen, no second model call, no member-page commentary (AD-10).
- Printed comparisons name years and do not say “league history” or “all-time” (AD-11).

These divergence points are open. Epics will pick them differently:

- How a screenshot first name becomes the same league person as a live membership (CAP-4). AD-3 forbids a user account and a first-name join. It does not require the mapping the spec demands.
- Which file is which season, and that the current app season is not imported as book rows (CAP-4, historical cell legend).
- The on/off column’s default (CAP-1: every league starts off).
- When the run row is committed relative to the model call, so a cron retry and the admin send cannot each spend (AD-4’s own prevent).
- Whether Preview, local dev, and Production may hold the model key and spend.

### AD rules that do not prevent what they name

| AD | Holds? | Gap |
| --- | --- | --- |
| AD-1 | Yes | “No figures,” drop-if-unproved, and “model text is never printed” block both named avoids. Predicate catalog can wait because an unknown claim is dropped. |
| AD-2 | Partial | Book rows stay off `Pick`, and the checker is told to read imports plus live seasons. “A later renew adds a completed live season” can be implemented as a copy into book rows, which double-counts a season the checker already reads as live. |
| AD-3 | No | The stated avoids (invented logins, join-on-first-name) are blocked. The rule does not make the join possible: live `Pick` rows belong to `LeagueMembership`, book rows belong to a league person, and the ER link between them is optional. Nothing says existing members get a league person, or that Kyle’s accept step is the name-to-person map. |
| AD-4 | No | One row and “later sends only read” hold after a row exists. The existing Tuesday cron writes `sentAt` only when `sent > 0` and skips a league only then (`send-tuesday-digest.ts`, `api/cron/tuesday-email`). A timeout or crash before the commentary row commits is another first send, so cron and the admin send can each call the model. Preview is in Prevent and absent from the Rule. The preview route renders the digest and does not send (`api/leagues/[leagueId]/email/tuesday-preview`). |
| AD-5 | Partial | Send-anyway, keep proved items, and quiet-line-only-on-normal-zero are enforceable once a row exists. “The week is not attempted again” is the same uncommitted-row hole as AD-4. |
| AD-6 | Yes | Single querier, one view, no secrets, re-proof against the database. |
| AD-7 | Yes | One SDK, config prices, same dollar unit as the ceiling, no call when price is missing. |
| AD-8 | Partial | Admin cannot write ceiling or debug. Each league has its own numbers. The on/off flag has no default. |
| AD-9 | Partial | Local tool, printed grid, accept-then-write, legend points, CSV reject, and missing-file behavior are enforceable. Filename-as-year and “not the current season” are not in the rule. |
| AD-10 | Partial | Debug default, digest omit, screen reads the stored outcome, failure is not the quiet line, and screen audience are enforceable. “While debug is off, the digest shows the record” covers a failure row that AD-5 says must leave the section out. |
| AD-11 | Yes | Named years, banned phrases, existence equals the history the checker read. That history is book rows plus live seasons (AD-2), which matches the spec’s “loaded book” once live seasons are part of the book. |

### Deferred

Nothing under Deferred is itself a fork:

- Unknown predicates are dropped, so the catalog can land later.
- Sentence wording is free only past the proof, the fixed quiet line, and AD-11.
- Renew is unbuilt, and the spine already says completed live seasons persist and imported people stay off invite lists (they have no membership). The leftover risk is the verb “adds” in AD-2, not the deferral.
- Model id and prices have a home and a missing-price behavior.
- The vision model id cannot change the grid the checker stores.
- Admin-screen layout cannot change who calls the model.

The CAP-4 and environment gaps are not deferred. They are absent.

### Named tech

Checked against `package.json` (repo pins, no web browse):

| Name | Spine | Repo | Result |
| --- | --- | --- | --- |
| Next.js | 16.2.2 | `next` 16.2.2 | Matches |
| React | 19.2.4 | `react` 19.2.4 | Matches |
| Prisma | 7.8.0 | `prisma` and `@prisma/client` ^7.8.0 | Matches |
| Zod | 4.3.6 | `zod` ^4.3.6 | Matches |
| MUI | 7.3.9 | `@mui/material` ^7.3.9 | Matches |
| Neon Postgres | existing project | Unversioned in the spine | No version claim to check |
| Vercel | existing project | Unversioned in the spine | No version claim to check |
| Vercel AI SDK (`ai`) | 7.0.165 | Not a dependency | Currency not verified. The pin is specific, and it does not look like a placeholder. Not browsed, per the review instruction. |

### Brownfield

The spine ratifies the codebase on the claims it makes:

- Next.js, React, Prisma, Zod, and MUI pins match the app.
- Primary keys are `cuid` and columns are `snake_case` (`prisma/schema.prisma`).
- Tuesday digest, cron (`/api/cron/tuesday-email`), and admin send (`/api/leagues/[leagueId]/email/tuesday-send`) already exist. The commentary key is the digest’s league-week key.
- Suppressed test-league sends set `sentAt` and do not call Resend. AD-4’s “does not create a run and does not spend” fits that path and does not treat `sentAt` as “mail was delivered.”
- Auth, host, and database stay put. The new entities (league person, book row, commentary run) hang off `League` and optionally `LeagueMembership`, which matches “no invented user for a screenshot-only person.”
- The admin email screen exists (`src/components/admin/`). Putting debug review there extends that screen.

`_bmad-output/planning-artifacts/architecture.md` is a narrative architecture document. It is not an AD-numbered spine. This feature spine does not invent inherited AD ids. That is correct. It also does not contradict that document’s stack (Next.js, Prisma, Vercel, Tuesday email).

### Spec coverage (CAP-1 through CAP-5)

| Capability | Covered? | Where it falls short |
| --- | --- | --- |
| CAP-1 On/off | Partial | Admin-only flag, off means no row and no spend (AD-4, AD-8). “Every league starts off” is not a rule. |
| CAP-2 Tuesday commentary | Yes | AD-1, AD-4, AD-5, AD-6, AD-7, AD-10, AD-11, and the quiet-line convention. Abnormal zero omits the section, which is tighter than the spec’s success line and matches the adopted failure rule. |
| CAP-3 Dollar ceiling | Yes | Default $1, per league, Kyle replaces it, admin cannot, stop at 3 or the ceiling (AD-7, AD-8). |
| CAP-4 Screenshot backfill | No | Legend colors, print-then-accept, CSV reject, and missing year are in AD-9. The spec’s mapping gate, filename-as-year, and “not the current season” are not rules. |
| CAP-5 Debug review | Yes | AD-8 and AD-10. The run still happens on a delivering send because of AD-4, even though the capability map does not list AD-4 on this row. |

### Parent spine

One `ARCHITECTURE-SPINE.md` exists under `_bmad-output`. No parent AD-numbered spine was found and none was invented. Absence of an Inherited Invariants section is correct.

### Dimensions this altitude owns

| Dimension | State |
| --- | --- |
| Paradigm and claim proof | Decided (AD-1, AD-6) |
| Boundaries (runner, checker, digest, local tool) | Decided (diagram, seed) |
| Shared identity and history | Incomplete (AD-2, AD-3, AD-9) |
| State of the run row | Decided as write-once, incomplete on commit timing |
| Stack | Decided; `ai` version unverified |
| Deployment | Decided: same Vercel app; cron and admin send stay the triggers; local tool stays on Kyle’s machine |
| Environments | Silent. Production, Preview, and local are not decided, deferred, or asked. |
| Infra / provider | Decided at the seam: existing Neon, existing Vercel, AI SDK only, key and prices in server env. Concrete model id is deferred on purpose. |
| Operations | Partial. AD-5 covers a finished failure. Retry, the cron `maxDuration` of 300s, logging, and preview-env spend are silent. |

## Findings

### F1 — Critical — League person never becomes a shared key

Checklist: missed divergence; AD-3 does not prevent the split it has to prevent; CAP-4 uncovered.

CAP-4 runs only after every screenshot first name is mapped to a current member or a past member who still counts. AD-3 says book rows and live seasons join on a league person, and that a person with a login points at a membership. The ER diagram makes that link optional. Live picks in this repo belong to `LeagueMembership`, not to a person row that does not exist yet. AD-9 writes “league persons and book rows” after Kyle accepts a printed grid of name, week, fill, and team. Accepting the grid is not the mapping.

Two epics can both follow the text. The backfill epic creates one new league person per distinct first name. The checker epic joins `Pick` through membership and finds no league person on current members. History and this week never meet, or the same first name becomes two people.

Disposition: discuss. The rule has to say who creates the league person for an existing membership, that the accept step is the name-to-person map, and that book rows attach only to those mapped persons.

### F2 — High — Import file identity is unspecified

Checklist: missed divergence; CAP-4 and the cell legend uncovered; AD-9 does not prevent a second history.

The spec and `historical-cell-legend.md` say the filename is the season year and that none of the files is the current season in the app. AD-9 specifies the grid, the colors, the CSV reject, and the missing-file behavior. It does not say where the year comes from, and it does not reject the current season.

One epic can take the year from the filename and refuse the current season. Another can ask for a year and write this season’s screenshot into book rows. The checker then reads those weeks twice: once as book rows and once as the live season (AD-2).

Disposition: autofix into AD-9. The legend already states both facts.

### F3 — High — Commentary can ship turned on

Checklist: CAP-1 success criterion missing; AD-8 incomplete.

CAP-1: every league starts off. While off, the digest has no commentary and the league adds no spend. AD-4 defines the off behavior. AD-8 gives each league a flag and never sets the default. A migration that defaults the column to on spends on every league the first Tuesday after deploy. Nothing in Deferred or the conventions table closes this.

Disposition: autofix. State the column default as off, including leagues that already exist.

### F4 — High — Environments are silent, and the one-run rule loses to the current retry

Checklist: silent dimension (environments, and the operational envelope around them); AD-4 and AD-5 do not prevent the double call they name.

Deployment is decided in one sentence: the weekly path ships with the existing Vercel app, and the local tool does not. Environments are not decided, deferred, or an open question. There is no model key in the repo today, so “server env” does not inherit a production-only convention. Preview and `next dev` can spend against a real or copied database.

On operations, the Tuesday cron skips a league only when `sentAt` is already set, and it sets `sentAt` only after at least one recipient send. The route budget is 300 seconds. AD-4 creates the commentary record on “the first send that will deliver mail” and tells later sends to read it. AD-5 says the week is not attempted again. Neither rule says the row is committed before the model call, or that a killed invocation is already a stored abnormal stop. Two sends that both observe “no row yet” each call the model. The preview route is the same hole from the other side: Prevent names it, and the Rule never says a non-delivering render only reads a stored row.

Disposition: discuss the environment split (where the key is allowed to exist). Autofix the run-row rule: the delivering send writes the row before the call, a second observer reads that row, and preview never calls the runner.

### F5 — Medium — Debug-off failure copy conflicts, and the AI SDK pin is unchecked

Checklist: AD-10 vs AD-5; named tech unverified.

AD-5 leaves the commentary section out when zero items were confirmed and the stop was abnormal. AD-10 says that while debug is off, the digest shows the record. A digest epic can print a failure into the Tuesday mail and call that “showing the record.” The admin screen’s “failure is not the quiet line” rule does not apply to that path.

`ai` 7.0.165 is not in `package.json`. This review did not browse. The other stack pins match the repo. Treat 7.0.165 as unverified until someone checks the registry. It does not look invented.

Disposition: autofix AD-10 so a debug-off digest follows AD-5 (proved items, or the quiet line, or no section). Discuss the SDK pin; do not treat it as a known-bad version.

## Also noted (low)

- The capability map lists CAP-5 under AD-8 and AD-10 only. The run still spending while debug is on comes from AD-4. The rules together cover CAP-5.
- “Kyle’s path” has no surface. Both writers still share the same columns, and the admin path is forbidden from those columns, so this can stay a story choice.
- AD-2’s “renew adds a completed live season” should mean the season remains on the live-season side of the one history. A copy into book rows double-counts. Deferred renew text (“completed live seasons already persist”) points the right way if the verb is tightened.
- Claim field shape is intentionally thin. Shared `src/lib/commentary/` plus “unknown predicate is dropped” is enough at this altitude.

## What held

Checked claims, one stored run per digest week, scores send anyway, the dollar ceiling and who may change it, debug review on the admin email screen, named years, snake_case/cuid, and the existing Next.js / Prisma / Tuesday-digest host are fit to build on. Deferred items do not open a second architecture. The failure is the missing identity and import rules, the missing off default, and the unspoken environment and retry contract.
