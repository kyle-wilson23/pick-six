---
title: 'European decimal odds'
type: 'feature'
created: '2026-09-03'
status: 'done'
baseline_commit: '019d8a720fe8937c7bbaf883bf1c32e1201ad99f'
context:
  - '{project-root}/docs/nfl-odds-integration.md'
  - '{project-root}/docs/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Odds API and every in-app moneyline surface use American integers (`-150`, `+130`). We want European decimal odds for new fetches and for every place a moneyline is shown or entered.

**Approach:** Request `oddsFormat=decimal` going-forward, persist new lines as decimal, leave existing American snapshot/audit numbers in place, display-convert leftovers, and normalize before jailed ranking so mixed-format weeks stay correct.

## Boundaries & Constraints

**Always:**
- Snapshot and live-display fetches share The Odds API client and use `oddsFormat=decimal`.
- New writes (provider, admin manual, sim fixtures) persist European decimal moneylines.
- Do not migrate or rewrite existing snapshot rows or jailed `auditJson` numbers.
- Every surface that shows a moneyline (picks matchups, jailed callout + aria, admin verification, admin ML inputs) shows or accepts decimal; leftover American values convert at read/display time.
- Spreads stay home-relative point values; do not store spread juice `price`.
- Jailed “biggest favorite” is the **lowest decimal** moneyline after normalizing leftovers. Equal ML still prefers home. Do not recompute already-persisted jailed teams solely because display format changed.
- Secrets stay server-only.

**Ask First:**
- In-place rewrite of historical American rows
- Showing American and decimal side-by-side
- Changing jailed definition beyond format normalization

**Never:**
- Leave American `+/-` formatters on participant or admin verification display
- Rank jailed teams with American sign / raw `Math.min` on mixed values
- Add moneyline numbers to email or CSV (they do not show ML today)
- Change schedule/results Odds endpoints (no `oddsFormat`)
- Put `ODDS_API_KEY` in the client

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| New provider line | h2h `price` `1.91` / `2.10` | Stored + shown as `1.91` / `2.10` | Missing h2h → null ML |
| Leftover American | Stored `-150` / `130` | Display `1.67` / `2.30` (2 dp); jailed uses normalized decimals | N/A |
| Jailed all-decimal | Favorites `1.25` vs `1.50` | Jailed = `1.25` side (`MONEYLINE`) | Null ML/spread skipped |
| Jailed mixed week | `-400` leftover + `1.25` new | Both eligible; lowest normalized decimal wins | Do not drop decimal games as “both positive” |
| Equal decimal ML | `2.00` / `2.00` | Favorite side = home | N/A |
| Admin save | PATCH `1.91` / `2.10` | Persisted as decimal | Reject `<= -100` or `>= 100` with 400 + `{ error: { code, message } }` |
| Live overlay | Current-week live fetch | Decimal on picks; jailed still from snapshot | Provider fail → snapshot (display-convert if American) |
| Null ML | No line | UI `–`; ineligible for jailed | N/A |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` -- both odds-line models store ML as `Int?` `*MoneylineAmerican`
- `src/lib/integrations/the-odds-api/client.ts` -- `oddsFormat=american`
- `src/lib/integrations/the-odds-api/extract-lines.ts` -- h2h `price` → `*MoneylineAmerican`
- `src/lib/nfl/live-display-odds.ts` -- live overlay via same client
- `src/lib/nfl/snapshot-nfl-week-odds.ts` -- snapshot + manual upsert
- `src/lib/domain/jailed.ts` -- American `Math.min`; skips `hm >= 0 && am >= 0`
- `src/lib/domain/derive-fixture-odds-line.ts` -- sim American ranges
- `src/app/api/admin/nfl/games/[gameId]/odds-line/route.ts` -- PATCH `.int()`
- `src/app/(app)/leagues/[leagueId]/settings/nfl-odds-admin-panel.tsx` -- integer ML inputs
- `src/components/picks/MatchupCard.tsx` / `JailedTeamCallout.tsx` / `src/components/admin/AdminJailedVerification.tsx` -- American `+/-` formatters
- `src/lib/admin/get-jailed-verification.ts` -- audit keys `*MoneylineAmerican`
- `docs/nfl-odds-integration.md` -- `format american`

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/domain/odds-format.ts` -- add `isAmericanMoneyline`, `americanToDecimal`, `normalizeMoneylineToDecimal`, `formatDecimalMoneyline` (2 dp, no `+`)
- [x] `prisma/schema.prisma` -- widen both ML columns to `Decimal?` `@db.Decimal(10, 3)`; keep names; comment leftover American ints remain until overwritten
- [x] `src/lib/integrations/the-odds-api/client.ts` -- `oddsFormat=decimal`
- [x] `src/lib/integrations/the-odds-api/extract-lines.ts` -- persist h2h `price` as decimal; keep spread `point`
- [x] `src/lib/domain/jailed.ts` -- normalize before favorite-side and week min; drop both-positive skip; skip only null/unnormalizable
- [x] `src/lib/domain/derive-fixture-odds-line.ts` -- emit decimal lines (lower = favorite)
- [x] `src/app/api/admin/nfl/games/[gameId]/odds-line/route.ts` -- accept decimal ML; reject American-looking values
- [x] `src/app/(app)/leagues/[leagueId]/settings/nfl-odds-admin-panel.tsx` -- decimal ML fields/labels
- [x] `MatchupCard.tsx` + `JailedTeamCallout.tsx` + `AdminJailedVerification.tsx` -- shared `formatDecimalMoneyline` (convert leftovers)
- [x] Colocated tests -- cover the I/O matrix (`odds-format`, `jailed`, extract, fixtures, admin PATCH)
- [x] `docs/nfl-odds-integration.md` -- decimal fetch + mixed-era leftover rows

**Acceptance Criteria:**
- Given a new snapshot or live overlay with decimal h2h prices, when picks render, then matchups, jailed callout, and aria labels show two-decimal European odds and spreads are unchanged.
- Given leftover American snapshot or jailed audit numbers, when a user views picks or admin verification, then those numbers render as decimal (not `+130` / `-150`).
- Given mixed American leftovers and new decimal lines, when jailed is computed, then every complete line is eligible and the lowest normalized decimal favorite wins (then spread, then seeded random).
- Given admin PATCH `1.91` / `2.10`, when saved, then the line persists; given `-150` or `130`, when PATCH, then `400` with structured `{ error: { code, message } }`.
- Given email or CSV generation, when content is built, then no moneyline numbers are added.

## Design Notes

American → decimal: `a > 0 → a/100 + 1`; `a < 0 → 100/|a| + 1`. Detect American as `n <= -100 || n >= 100`.

Example: `-150` → `1.67`; `+130` → `2.30`; leftover `-400` (`1.25`) vs new `1.25` is a moneyline tie, then spread.

Keep Prisma/TS `*MoneylineAmerican` names and jailed audit JSON keys so historical rows stay readable. Always normalize at the domain/UI boundary. Do not persist a new jailed row for a past week unless that week’s existing compute path would have.

## Verification

**Commands:**
- `npx prisma migrate dev` -- expected: ML columns widened; existing integer values intact
- `npm test` -- expected: pass, including I/O-matrix cases

**Manual checks (if no CLI):**
- Picks: decimal ML on cards + jailed callout; leftover American week also decimal
- Admin settings: accept `1.91`, reject `-150`
- Admin jailed verification: decimal winning/candidate MLs

## Suggested Review Order

**Format helpers (entry point)**

- Mixed-era detect, convert, display, and admin reject live here
  [`odds-format.ts:2`](../../src/lib/domain/odds-format.ts#L2)

- Two-decimal display converts leftover American first
  [`odds-format.ts:39`](../../src/lib/domain/odds-format.ts#L39)

**Provider ingest**

- Snapshot and live overlay both pick up this one query param
  [`client.ts:50`](../../src/lib/integrations/the-odds-api/client.ts#L50)

- h2h `price` stored as-is; spread still uses `point` only
  [`extract-lines.ts:18`](../../src/lib/integrations/the-odds-api/extract-lines.ts#L18)

**Schema**

- Widen ML columns so leftover American integers still fit
  [`schema.prisma:221`](../../prisma/schema.prisma#L221)

- No data rewrite; INT → DECIMAL only
  [`migration.sql:4`](../../prisma/migrations/20260903210000_odds_moneyline_decimal/migration.sql#L4)

**Jailed ranking**

- Normalize both sides, then lowest decimal is the favorite
  [`jailed.ts:101`](../../src/lib/domain/jailed.ts#L101)

- Prisma Decimal unwrap so domain still sees numbers
  [`effective-odds.ts:9`](../../src/lib/nfl/effective-odds.ts#L9)

**Admin write path**

- PATCH accepts `1.91` and rejects `-150` / `130`
  [`parse-odds-line-patch.ts:11`](../../src/lib/nfl/parse-odds-line-patch.ts#L11)

- Leftover rows show converted decimal; labels say decimal
  [`nfl-odds-admin-panel.tsx:11`](../../src/app/(app)/leagues/[leagueId]/settings/nfl-odds-admin-panel.tsx#L11)

**Display**

- Picks cards and aria labels share the formatter
  [`MatchupCard.tsx:287`](../../src/components/picks/MatchupCard.tsx#L287)

- Jailed callout and admin verification convert leftovers
  [`JailedTeamCallout.tsx:44`](../../src/components/picks/JailedTeamCallout.tsx#L44)

**Sim fixtures**

- New rehearsal lines emit decimal favorites/dogs
  [`derive-fixture-odds-line.ts:17`](../../src/lib/domain/derive-fixture-odds-line.ts#L17)

**Tests and docs**

- I/O matrix coverage for convert, jailed mix, and PATCH
  [`odds-format.test.ts:1`](../../src/lib/domain/odds-format.test.ts#L1)

- Ops note: decimal fetch, leftover American rows stay
  [`nfl-odds-integration.md:95`](../../docs/nfl-odds-integration.md#L95)
