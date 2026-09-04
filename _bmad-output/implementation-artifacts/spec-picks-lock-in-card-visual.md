---
title: 'Align picks lock-in card with jailed callout'
type: 'feature'
created: '2026-09-04'
status: 'done'
baseline_commit: '10707e5d5a9b64cf0eeccdc3db0f8f1ea55abdf4'
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-design-specification.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** On the picks page, the "Picks lock in" card sits beside the jailed-team callout but is shorter, uses a plain paper fill, and buries the headline in caption-weight type on the same line as the Eastern time.

**Approach:** Restyle the lock-in card as a sibling of `JailedTeamCallout`: same card chrome with the success palette, matching title typography stacked above supporting text, and equal height in the desktop side-by-side row.

## Boundaries & Constraints

**Always:**
- Match the jailed callout's card structure: MUI `Paper` (`elevation={0}`), `p: 1.5`, `borderRadius: 2`, background `{palette}.main` at ~10% (`…1A`), 1px border `{palette}.main` at ~30% (`…4D`). Use `success` instead of `warning`.
- Headline ("Picks lock in" / "Picks closed") uses the same size and weight as "Jailed this week": `Typography variant="body2"` + `fontWeight={700}`, color `success.main`, on its own line above all other copy in the card.
- On `md+` when both cards render, they share equal height. Stretch via the existing `alignItems="stretch"` row plus `height: "100%"` on the card surfaces — not a hardcoded pixel height.
- Keep Story 3.7 countdown behavior: tick cadence, `getCountdownVariant` labels, and urgency color/weight/size/pulse on the **remaining-time** line only.
- Theme tokens only (works in light and dark). Flex layouts use `Stack`.

**Ask First:**
- Changing countdown urgency bands, tick intervals, or remaining-time copy.
- Restyling `JailedTeamCallout` or `PickStatusBanner` (those are reference patterns, not in scope).

**Never:**
- Do not use `PickStatusBanner`'s 4px left-border treatment for this card — that pattern is for full-width status banners, not this sibling pair.
- Do not hardcode hex colors or add a clock icon.
- Do not change deadline math, server authority, or when the countdown renders (`null` / invalid ISO still returns `null`).
- Do not restyle the picks loading skeleton (it does not include this row).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Desktop pair | `md+`, both countdown and jailed visible | Cards sit in one row (`flex: 1` each) at the same height; lock-in surface fills the row height | N/A |
| Mobile stack | `xs`, both visible | Cards stack full-width at natural content height; lock-in does not force extra empty height | N/A |
| Open window | Deadline in the future | Title "Picks lock in" (`body2` / 700 / `success.main`); Eastern time (if parseable) and remaining-time line below | N/A |
| Closed window | Deadline passed | Title "Picks closed"; remaining-time line still "Deadline passed" with existing `passed` urgency styles | N/A |
| Success chrome | Countdown renders | Green ~10% fill + 1px ~30% `success.main` border, same radii/padding as jailed | N/A |
| Countdown only | Jailed omitted (`jailedTeamId` null) | Lock-in card still uses success chrome and title hierarchy; height is natural content height | N/A |
| Invalid deadline | Unparseable `pickDeadlineUtc` | Component renders nothing (existing) | Silent omit |

</frozen-after-approval>

## Code Map

- `src/components/picks/DeadlineCountdown.tsx` -- lock-in card to restyle and restructure
- `src/app/(app)/leagues/[leagueId]/picks/page.tsx` -- deadline/jailed row (`alignItems="stretch"`, `flex: 1` wrappers); may need wrappers to pass height through to the Paper
- `src/components/picks/JailedTeamCallout.tsx` -- sibling visual reference (warning `Paper`); optional `height: "100%"` only if needed for stretch
- `src/components/picks/PickStatusBanner.tsx` -- success token reference only; do not copy its left-border banner treatment
- `_bmad-output/planning-artifacts/ux-design-specification.md` -- Color System (`success.main`), JailedTeamCallout visual treatment, DeadlineCountdown urgency table
- `src/lib/picks/countdown.ts` -- remaining-time labels/urgency; do not change

## Tasks & Acceptance

**Execution:**
- [x] `src/components/picks/DeadlineCountdown.tsx` -- switch outer `Stack` to success-palette `Paper` matching jailed chrome; split headline onto its own `body2`/`fontWeight={700}`/`success.main` line; keep Eastern time as caption under the title; keep remaining-time urgency `sx`; fill parent height (`height: "100%"`, center content vertically if stretched)
- [x] `src/app/(app)/leagues/[leagueId]/picks/page.tsx` -- ensure the `md` row stretch reaches both card surfaces (e.g. wrapper `height: "100%"` / child fill) so the lock-in card matches the jailed card
- [x] `src/components/picks/JailedTeamCallout.tsx` -- add `height: "100%"` on the `Paper` only if the row still fails to equalize without it; no other visual changes

**Acceptance Criteria:**
- Given the picks page on a desktop (`md+`) viewport with both cards visible, when the row renders, then the lock-in card is the same height as the jailed card beside it.
- Given the lock-in card is visible, when a user compares it to the jailed callout, then it uses the same card recipe (Paper, padding, radius, tinted fill, 1px tinted border) with `success` instead of `warning`.
- Given the lock-in card is visible, when reading the card, then "Picks lock in" (or "Picks closed") matches "Jailed this week" in font size and weight and sits above the Eastern time and remaining-time lines.
- Given remaining time is under 4 hours (or any other urgency band), when the card renders, then the remaining-time line still uses Story 3.7 urgency styles; the green card chrome and title color do not replace those bands.

## Spec Change Log

## Design Notes

Jailed callout is the sibling pattern to copy structurally:

```tsx
<Paper elevation={0} sx={{
  p: 1.5, borderRadius: 2, height: "100%",
  bgcolor: (t) => `${t.palette.success.main}1A`,
  border: (t) => `1px solid ${t.palette.success.main}4D`,
}}>
```

Do **not** copy `PickStatusBanner`'s `success.main` at ~15% (`…26`) plus 4px left border — UX spec reserves that for the pick-status banner.

Title pairing: jailed uses `variant="body2" color="warning.main" fontWeight={700}`. Lock-in title uses the same except `success.main`.

Content inside a stretched card should be vertically centered (`justifyContent: "center"`) so extra height does not look like empty padding at the bottom.

## Verification

**Commands:**
- No new unit tests — this is visual chrome/typography/layout, not countdown logic (`countdown.test.ts` stays unchanged).

**Manual checks:**
- Open `/leagues/[leagueId]/picks` at desktop width with jailed + countdown: equal card heights, green lock-in chrome, title hierarchy.
- Same page at mobile width: stacked cards, natural heights, title still above supporting text.
- Confirm remaining-time color still shifts for elevated/critical/passed; title stays `success.main`.
- Light and dark color modes both show a green-tinted card (theme tokens, not hardcoded hex).

## Suggested Review Order

**Success card chrome and title**

- Jailed-card recipe with `success` tokens; not the banner left-border.
  [`DeadlineCountdown.tsx:101`](../../src/components/picks/DeadlineCountdown.tsx#L101)

- Headline matches jailed title: `body2` / 700, stacked above supporting copy.
  [`DeadlineCountdown.tsx:116`](../../src/components/picks/DeadlineCountdown.tsx#L116)

- Remaining-time urgency bands and pulse are unchanged.
  [`DeadlineCountdown.tsx:124`](../../src/components/picks/DeadlineCountdown.tsx#L124)

**Equal-height row**

- Existing `md` row stretch; Papers fill it — do not set wrapper `height: 100%`.
  [`page.tsx:121`](../../src/app/(app)/leagues/[leagueId]/picks/page.tsx#L121)

- Jailed surface only adds `height: "100%"` so the pair can equalize.
  [`JailedTeamCallout.tsx:27`](../../src/components/picks/JailedTeamCallout.tsx#L27)
