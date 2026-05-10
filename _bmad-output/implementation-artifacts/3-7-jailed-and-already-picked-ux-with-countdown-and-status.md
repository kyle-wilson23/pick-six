# Story 3.7: Jailed and "already picked" UX with countdown and status

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **participant** (including admin in their participant role) on the **picks page** for the active competition week,
I want **clearly-marked jailed and already-picked teams**, an **always-visible deadline countdown**, an **interactive way to submit / change my pick (including the anti-jailed bonus path)**, and a **persistent confirmation of my current pick**,
so that I **avoid invalid selections, never wonder whether my pick saved, and feel constant time awareness as Thursday approaches** (**FR16–FR25**, **NFR4**, **NFR6**, **NFR8**, **NFR37–NFR44**).

## Acceptance Criteria

1. **Persistent pick status banner (FR22)**
   **Given** an authenticated league participant on `/leagues/[leagueId]/picks` for the active competition week
   **When** the page is loaded (and after every successful pick mutation while the page is mounted)
   **Then** a **persistent banner above the matchup list** shows the current week's saved pick: team logo (`md`), team name, and point intent ("**1 point**" for a standard pick, "**2 points**" for an anti-jailed pick)
   **And** when no pick has been saved yet, the banner is replaced with a neutral "**No pick yet for Week N**" state (or the banner is omitted) so the user always knows status at a glance
   **And** when the pick window for the active week is **closed** (after the server-authoritative deadline), the banner switches to a **locked** treatment (info color + lock icon + copy "Your pick is locked in: **{Team}**") to communicate that no further changes are accepted
   **And** the banner uses the UX-spec color tokens (`success.main` at ~15% bg + 4px left border for submitted; `info.main` at ~15% bg + lock icon for locked) per **UX § Component Strategy → PickStatusBanner**

2. **Always-visible deadline countdown with progressive urgency (FR23)**
   **Given** the picks page for an active competition week (i.e. `payload.pickDeadlineUtc != null` and `isPreview === false`)
   **When** the page is rendered and while it remains mounted
   **Then** a **countdown timer** showing remaining time to the server-authoritative `pickDeadlineUtc` (format `Xd Xh Xm` while > 1h; `Xm Xs` when ≤ 1h) is visible above the matchup list
   **And** the countdown **ticks** at least once per minute (preferably once per second when ≤ 1h) without re-fetching the page
   **And** the countdown **urgency** progresses per **UX § DeadlineCountdown**:
   - `> 48h`: `text.secondary`, body weight 500, calm
   - `24h–48h` and `< 24h`: `warning.main`, weight 600, slightly larger
   - `< 4h`: `error.main`, weight 700, larger; optional subtle pulse
   - `passed (now > deadline)`: `text.disabled`, "Deadline passed" static text + UI auto-locks (see AC #6)
   **And** when `pickDeadlineUtc` is `null` (no games loaded or pure preview mode), the countdown is **not rendered** — never display a misleading countdown for a week with no schedule

3. **Jailed team callout + visual blocking (FR18, FR25)**
   **Given** the picks page where `payload.jailedTeamId != null`
   **When** the page is rendered
   **Then** a **JailedTeamCallout** card appears above the matchup list with: lock-style icon, the jailed team's logo, name, brief explanation ("Biggest favorite this week — cannot be picked directly. Pick **against** for a 2-point bonus."), styled with the warning palette (`warning.main` border at ~30% opacity, `warning.main` background at ~10% opacity, 16px radius)
   **And** within each `MatchupCard`, the **jailed team's side** receives the documented jailed visual treatment per **UX § Color System → Jailed Team Visual Treatment**: 2px `warning.main` outer border on the matchup card containing the jailed team, "JAILED" overline tag overlay on its logo, ~50% logo desaturation, dimmed name (`text.disabled`)
   **And** clicking / activating the jailed team **does not select it**; instead it shows an inline, dismissible error message ("**{Team}** is the jailed team this week — pick against them for the 2-point bonus or choose another game.") — no network call is issued
   **And** when `jailedTeamId` is `null` (jailed not yet computed for a preview / unconfigured week), the callout is omitted and no jailed visual treatment is applied to any team

4. **Anti-jailed bonus opt-in path (FR20)**
   **Given** the matchup containing the jailed team where `payload.jailedTeamId != null`
   **When** the user views the **opponent of the jailed team**
   **Then** that team side displays a gold "**2 PTS**" affordance (`accent.gold` chip / badge per **UX § Color System → Accent Color**) communicating the bonus opportunity
   **And** the user can pick that opponent in two ways:
   - **Click the team logo / row directly** → standard 1-point pick (`antiJailedBonus: false`)
   - **Click the gold "2 PTS" affordance** → 2-point anti-jailed pick (`antiJailedBonus: true`)
   **And** the chosen point intent is reflected immediately in the persistent banner (AC #1)
   **And** if the user later picks a different team or re-clicks the opponent's normal area, the bonus is cleared (`antiJailedBonus: false`); the bonus is **never auto-set** without explicit user action
   **And** the gold affordance is **not** shown on any team that is not the jailed team's opponent for that week

5. **Already-picked team visual + blocking (FR16, FR17, FR24)**
   **Given** the picks page where the participant has saved picks in **other** weeks of the same season
   **When** the matchup list renders
   **Then** any team that the participant **already picked in another week** appears in the documented "already-picked" visual state per **UX § Color System → Already-Picked Team Visual Treatment**: ~70% logo grayscale/desaturation, dimmed name (`text.disabled`), small "**PICKED WK X**" overline tag overlaid on the logo (where `X` is the other week's number)
   **And** clicking / activating that team **does not select it**; an inline error message appears ("You already picked **{Team}** in **Week X** — each team can be used only once per season.") — no network call is issued
   **And** the participant's **current week's** saved team (if any) is **not** rendered as already-picked on its own card — it is rendered as **selected** (AC #6) so the user can change it freely

6. **Selection, change, and submission flow (FR19, FR21, FR22, NFR4, NFR6)**
   **Given** the picks page with a non-locked, non-preview active competition week
   **When** the user clicks a valid (non-jailed, non-already-picked) team
   **Then** the client immediately reflects the selection visually (within ≤ 200 ms — `NFR4`) by applying the **selected** treatment to that team's matchup card per **UX § Component Strategy → MatchupCard "Selected" state** (2px `primary.main` border, `background.elevated` background)
   **And** the client `POST`s to `/api/leagues/[leagueId]/picks` with `{ teamId, nflWeekNumber, antiJailedBonus }` (camelCase) using same-origin fetch with `credentials: "include"` so the session cookie + CSRF origin check pass (see Dev Notes — CSRF)
   **And** on `200` / `201` the persistent banner (AC #1) is updated and an `aria-live="polite"` region announces "Pick saved: **{Team}**, {1|2} point[s]" (`NFR43`)
   **And** on a `400` / `403` / `409` response the inline error region surfaces the server's `error.message` exactly (project context §7) and the previous `selectedTeamId` is restored — no silent failure
   **And** the user can **change** picks unlimited times before the deadline (`FR21`) without a confirmation prompt (UX explicitly forbids confirmation friction for non-destructive changes)
   **And** any **client-side validation that could be bypassed** (jailed, duplicate, deadline) is **not authoritative** — the server is the single source of truth (`docs/project-context.md` non-negotiable #3); the client only **prevents** obvious mistakes pre-submission per `NFR6`

7. **Deadline-passed lock (FR27, NFR24)**
   **Given** an active competition week where `now > pickDeadlineUtc` (computed against the **server-supplied** deadline ISO string; never the user's machine TZ for the rule itself, just for ticking display)
   **When** the deadline passes either during page load or while the user is mounted on the page
   **Then** the matchup list switches to **non-interactive**: clicks no longer call `onTeamSelect`, the selected card retains its visual highlight, and all other cards lose hover / pointer affordances (`cursor: default`, `aria-disabled="true"` on team rows)
   **And** the persistent banner switches to the **locked** treatment (AC #1)
   **And** any subsequent server `POST` (e.g. a stale in-flight request) is rejected with **403 `PICK_DEADLINE_PASSED`** by the existing server guard (Story 3.5) — the client surfaces that message verbatim and does **not** roll back the saved pick
   **And** if `pickDeadlineUtc` is `null` (preview / no games), the lock state is **not** entered automatically — preview behavior (AC #8) governs

8. **Preview mode (off-season / pre-competition) — no submission**
   **Given** `payload.isPreview === true` (handled by Story 3.6's `PicksPreviewBanner`)
   **When** the picks page renders
   **Then** all matchup cards are **non-interactive** (no `onTeamSelect`, `cursor: default`, no selected/jailed/picked visual states applied other than the descriptive jailed callout if `jailedTeamId` happens to be present), and **no** `PickStatusBanner` / `DeadlineCountdown` / `JailedTeamCallout` is rendered as if competition were active
   **And** the existing `PicksPreviewBanner` continues to render exactly as Story 3.6 ships it (no regressions)

9. **Accessibility (NFR37–NFR44)**
   **Given** the matchup list with interactive team selection
   **When** rendered
   **Then** the list has `role="radiogroup"` with an `aria-label` (e.g. "Pick a team for Week N"); each selectable team side has `role="radio"`, correct `aria-checked` reflecting `selectedTeamId`, `aria-disabled="true"` on jailed/already-picked sides, and a meaningful `aria-label` (e.g. "Buffalo Bills, moneyline +180")
   **And** keyboard navigation works: **Tab** moves into the radiogroup, **Arrow keys** move focus between selectable team sides skipping disabled ones, **Space / Enter** selects the focused team (and triggers the same submission path as click)
   **And** focus indicators are visible per UX (2px emerald outline with 2px offset) on dark backgrounds
   **And** the inline submission status / error region uses `role="status"` + `aria-live="polite"` for success and `role="alert"` for failures (`NFR43`)
   **And** all touch targets within the matchup card meet ≥ 44×44 px (`NFR8` / UX § Touch Target Sizing)

10. **No regressions / pick privacy (FR48–FR49 baseline)**
    **Given** this story extends an authenticated participant view
    **When** the GET endpoint payload is fetched and rendered
    **Then** the only pick data returned for non-admin participants is the **current user's own** current-week pick and their own **other-week picked teams** for "already picked" UX — **never** other participants' picks (Story 5.6 / NFR17)
    **And** existing Story 3.6 behavior is preserved: matchup ordering by kickoff, weather chip, odds display, preview banner, week labeling, and the GET 401/403/404/400 error semantics

## Tasks / Subtasks

- [x] **Extend GET payload with current user's pick context** (AC: #1, #5, #6) — modify `src/lib/picks/build-league-picks-week-view.ts`
  - [x] After membership/season resolution, query `prisma.pick.findUnique({ where: { leagueMembershipId_seasonId_nflWeekNumber } })` for the **current** week → `currentPick: { teamId, antiJailedBonus, updatedAt: ISO } | null`
  - [x] Query `prisma.pick.findMany({ where: { leagueMembershipId, seasonId, nflWeekNumber: { not: targetWeek } }, select: { teamId: true, nflWeekNumber: true } })` → `seasonPickedTeams: { teamId, weekNumber }[]` (used for "PICKED WK X" tag)
  - [x] Add both fields to `PicksWeekViewPayload` in `src/lib/picks/picks-week-view-types.ts`
  - [x] Co-located test: factored mapping into `src/lib/picks/map-current-pick.ts` (`mapCurrentPick`, `mapSeasonPickedTeams`) with `map-current-pick.test.ts` covering null/empty (no membership picks), present current-week pick, populated other-week picks, ordering preservation, and ISO date conversion. The builder's caller-scoped queries by `leagueMembershipId` also enforce that admins receive only their own pick data (project context #4 / NFR17).
  - [x] **No** breaking changes to the `200` shape — purely additive fields

- [x] **`PickStatusBanner` client component** (AC: #1, #7) — create `src/components/picks/PickStatusBanner.tsx`
  - [x] Props: `{ teamName: string | null, teamAbbreviation: string | null, antiJailedBonus: boolean, isLocked: boolean, weekNumber: number }`
  - [x] Renders nothing when `teamName == null && !isLocked` (allow caller to render an inline "No pick yet" alternative)
  - [x] Submitted state: styled `Paper` with `success.main` at 15% bg + 4px left `success.main` border, `TeamLogo size="md"`, copy "Your pick is submitted: **{Team}** — **{1|2} point[s]**"
  - [x] Locked state: same shape with `info.main` palette and 🔒 unicode glyph (avoids adding `@mui/icons-material` solely for one icon — see Open Questions; lock glyph is `aria-hidden`)
  - [x] **MUI Stack** for internal flex layout (project rule)
  - [x] `role="status"` + `aria-live="polite"` on the wrapper so screen readers announce updates after a successful POST

- [x] **`DeadlineCountdown` client component** (AC: #2, #7) — create `src/components/picks/DeadlineCountdown.tsx`
  - [x] Props: `{ pickDeadlineUtc: string }` (parent renders `null` instead when unavailable)
  - [x] Uses `useEffect` + `setInterval` to tick (1 s when remaining ≤ 1h, otherwise 30 s); cleanup on unmount
  - [x] Pure helper `getCountdownVariant(remainingMs: number): { label: string, urgency: "calm" | "elevated" | "critical" | "passed" }` extracted to `src/lib/picks/countdown.ts` with co-located Vitest tests covering each band per AC #2
  - [x] Render via `Typography` with `sx` mapping `urgency` → color/size/weight per UX § DeadlineCountdown
  - [x] Format: `Xd Xh Xm` when remaining > 1h; `Xm Xs` when ≤ 1h; "Deadline passed" when `≤ 0`
  - [x] Optional CSS pulse on `< 4h` via `keyframes` from `@mui/system` (animation is purely cosmetic; does not block interactivity)

- [x] **`JailedTeamCallout` client component** (AC: #3) — create `src/components/picks/JailedTeamCallout.tsx`
  - [x] Props: `{ team: { id: string, abbreviation: string, name: string }, moneylineAmerican: number | null }` (parent renders `null` when `jailedTeamId == null` or team not found in the week's matchups)
  - [x] Layout (MUI Stack direction row): `TeamLogo size="md" jailed` + name + odds + brief explanation copy
  - [x] Visual: `Paper` with `warning.main` border at 30% opacity, `warning.main` background at 10% opacity, theme `borderRadius` (16px)
  - [x] Single informational state — **not** interactive, no click handlers, no `role="button"`

- [x] **`MatchupCard` interactive states** (AC: #3, #4, #5, #6, #7, #9) — modify `src/components/picks/MatchupCard.tsx`
  - [x] Apply **jailed visual** when either side's id === `jailedTeamId`: 2px `warning.main` border on the **card**, "JAILED" overline tag overlaid on the jailed team's `TeamLogo`, ~50% desaturation on that logo (`TeamLogo`'s new `jailed?` prop), dimmed team name
  - [x] Apply **already-picked visual** when a team's `id` appears in `pickedTeamIds` (`Set<string>` derived from `seasonPickedTeams`): `TeamLogo disabled` (~70% gray + 50% opacity), "**PICKED WK X**" overline tag (via `pickedWeekTag` prop), dimmed team name; `pickedWeekByTeamId: Record<string, number>` passes the right week
  - [x] Apply **selected visual** when a team's `id === selectedTeamId`: 2px `primary.main` border on the card, `action.selected` card background; jailed border wins visual precedence on the card itself
  - [x] Click behavior:
    - Selectable team → `onTeamSelect(teamId, { kind: "select", antiJailedBonus: false })`
    - Jailed team → `onTeamSelect(teamId, { kind: "blocked", reason: "JAILED_TEAM_PICK" })` (parent surfaces the inline error; no POST)
    - Already-picked team → `onTeamSelect(teamId, { kind: "blocked", reason: "DUPLICATE_TEAM", pickedInWeek: N })`
    - Locked → `onTeamSelect(teamId, { kind: "blocked", reason: "LOCKED" })` (no POST)
    - Preview → `onTeamSelect` is not wired; cards are non-interactive
  - [x] **Anti-jailed "2 PTS" gold affordance** (AC #4): when a team side is the **jailed team's opponent** (controller computes via `getOpponentOfJailedInWeek` from `src/lib/domain/picks.ts`), a small `Chip` with `bgcolor: theme.palette.accent.gold`, label "**2 PTS**", click handler dispatches `{ kind: "select", antiJailedBonus: true }`. Below the team name / odds row.
  - [x] Accessibility: each clickable team side has `role="radio"`, `aria-checked`, `aria-disabled` for jailed/already-picked/locked, `tabIndex={0}` (or `-1` when disabled), `aria-label="<Team Name>, moneyline <ML>"`. `Space`/`Enter` triggers the same activation as click; arrow keys managed at the radiogroup level (`WeekMatchupList`).

- [x] **`WeekMatchupList` becomes the interactive controller** (AC: #5, #6, #7, #9) — modify `src/components/picks/WeekMatchupList.tsx`
  - [x] Added new props from extended GET payload: `currentPick`, `seasonPickedTeams`, `weekNumber`, `leagueId`, `pickDeadlineUtc`, `jailedTeamId`, `isPreview`
  - [x] Internal `useState<LocalSelection | null>` initialized from `currentPick` (drives the persistent banner)
  - [x] Internal `useState<StatusMessage | null>` for the inline status / error message
  - [x] Internal `useState<boolean>` for `isLocked` synced from `pickDeadlineUtc` + a `useEffect` that uses `getCountdownVariant`'s `passed` urgency to flip it once the deadline passes during the session (1s ticks within the final hour, 30s outside; the **server** is still authoritative via 403 `PICK_DEADLINE_PASSED`)
  - [x] `onTeamSelect(teamId, ev)`:
    - `ev.kind === "blocked"` with `reason === "JAILED_TEAM_PICK"` → inline error: "{Team} is the jailed team this week — pick against them for the 2-point bonus or choose another game."; **no fetch**
    - `reason === "DUPLICATE_TEAM"` → "You already picked {Team} in Week {pickedInWeek} — each team can be used only once per season."; **no fetch**
    - `reason === "LOCKED"` → "The pick window for this week has closed."
    - `ev.kind === "select"` → optimistic update of `selection`; same-origin `fetch` `POST /api/leagues/${leagueId}/picks` with `credentials: "include"`, `Content-Type: application/json`, body `{ teamId, nflWeekNumber: weekNumber, antiJailedBonus }`; on `!res.ok` restore `previous` selection and surface `error.message`; on success update banner + announce "Pick saved: {Team}, {N} point[s]"
  - [x] `radiogroup` ARIA + arrow key handler (Up/Down/Left/Right navigates focus between selectable cards skipping `aria-disabled` ones)
  - [x] Renders `PickStatusBanner` above the list when `!isPreview`; renders an inline `role="status" aria-live="polite"` region for success and `role="alert" aria-live="assertive"` for errors directly below the banner
  - [x] Passes derived `pickedWeekByTeamId: Record<string, number>` and `pickedTeamIdsSet: Set<string>` (built from `seasonPickedTeams`) to each `MatchupCard`

- [x] **`TeamLogo` jailed visual variant** (AC: #3) — modify `src/components/picks/TeamLogo.tsx`
  - [x] Added optional prop `jailed?: boolean` that renders the avatar with `filter: "grayscale(50%) saturate(0.5)"` and overlays a small "JAILED" overline tag in `warning.main` (positioned via a relative `Box` wrapper — used purely for absolute-overlay containment, not flex layout)
  - [x] `disabled` prop now applies a stronger `grayscale(70%) saturate(0.5)` filter + 50% opacity (UX § Already-Picked Team Visual)
  - [x] Added optional `pickedWeekTag?: number` so the "PICKED WK X" overline is drawn from inside `TeamLogo` when paired with `disabled`
  - [x] Backwards-compatible: existing call sites without the new props continue to render unchanged

- [x] **Picks page wiring** (AC: #1, #2, #3, #8) — modify `src/app/(app)/leagues/[leagueId]/picks/page.tsx`
  - [x] Forwards new payload fields (`currentPick`, `seasonPickedTeams`, `pickDeadlineUtc`, `jailedTeamId`, `isPreview`) into `WeekMatchupList`
  - [x] Renders `<DeadlineCountdown pickDeadlineUtc={...} />` between the page heading and the matchup list when `!isPreview && pickDeadlineUtc != null`; renders `<JailedTeamCallout ... />` when the jailed team is found in `payload.matchups`
  - [x] When `isPreview`: renders only `PicksPreviewBanner` + the non-interactive `WeekMatchupList` — does **not** render countdown / status banner / jailed callout (AC #8)
  - [x] Passes `leagueId` and `weekNumber` to `WeekMatchupList` (fetch URL = `/api/leagues/${leagueId}/picks`)
  - [x] **Preserved** all Story 3.6 behavior: error handling (`notFound()` on `!ok` and on thrown exceptions), search-param week handling, RSC structure, header / breadcrumb

- [x] **Pure helpers + tests** (AC: #2, #3, #5, #6, #7) — create `src/lib/picks/countdown.ts`, `src/lib/picks/matchup-card-state.ts`
  - [x] `getCountdownVariant(remainingMs: number)` — returns `{ label, urgency }` per AC #2 bands; co-located `countdown.test.ts` (14 tests) covering each band, label formats, and edge cases (NaN/Infinity)
  - [x] `isPickWindowClosedByDeadline(pickDeadlineUtc: string | null, now: Date): boolean` — small wrapper used by the client lock detection; co-located test
  - [x] `computeMatchupSideState({ teamId, jailedTeamId, pickedTeamIds, selectedTeamId, isLocked })`: pure discriminator returning `"default" | "selected" | "jailed" | "alreadyPicked" | "locked"`; co-located `matchup-card-state.test.ts` (8 tests) covering precedence (jailed > alreadyPicked > selected > default; locked overlays default only — selected stays selected, jailed/alreadyPicked retain visual identity)

- [x] **Run the test + lint + build loop**
  - [x] `npm test` — 172 tests pass (31 files)
  - [x] `npm run lint` — clean
  - [x] `npm run build` — successful

## Dev Notes

### Epic 3 cross-story context

| Story | Relationship to 3.7 |
|-------|---------------------|
| **3.1** | Provides `Team`, `NflGame`, `Season` shape — read-only. |
| **3.2** | Provides effective odds via `getEffectiveOddsLinesForWeek()` — already surfaced through 3.6's GET payload (no change needed in 3.7). |
| **3.3** | Provides persisted `NflWeekJailedTeam` — already surfaced as `payload.jailedTeamId` in 3.6's GET payload. **3.7 consumes** it for jailed visual + callout. |
| **3.4** | `POST /api/leagues/[leagueId]/picks` **already implements** Zod body, CSRF (`assertCookieSessionMutationOrigin`), session check, participant check, jailed/duplicate/anti-jailed validation, transactional upsert. **3.7 only consumes** this POST — no route handler changes. |
| **3.5** | `checkPickMutationDeadline` server guard returns `403 PICK_DEADLINE_PASSED`. **3.7 surfaces** that error verbatim and locks UI when `now > pickDeadlineUtc`. The server remains authority. |
| **3.6** | Built `MatchupCard`, `WeekMatchupList`, `TeamLogo`, `PicksPreviewBanner`, the GET endpoint, and `buildLeaguePicksWeekView`. **3.7 extends** `MatchupCard` with interactive states, **extends** `WeekMatchupList` to be the interactive controller, **extends** the GET payload with `currentPick` + `seasonPickedTeams`, and **adds** `PickStatusBanner` / `DeadlineCountdown` / `JailedTeamCallout`. |
| **3.8** | Real team logos — not in scope; `TeamLogo` placeholder remains. |
| **3.9** | NFL schedule sync — not in scope; only Week 1 seed exists today. Document any test seeding helpers used (`prisma/seed.ts`) but do not depend on additional seed data. |
| **4.2** | Admin "submit on behalf of participant" — out of scope for 3.7. The participant POST path is the only one used here. |
| **5.6** | Tuesday reveal of peer picks — **not in scope**. 3.7 must fetch only the current user's pick data and never expose other participants' picks (NFR17). |

### Existing utilities to reuse (do NOT reinvent)

| Need | Existing code | Path |
|------|--------------|------|
| Build week view payload | `buildLeaguePicksWeekView` | `src/lib/picks/build-league-picks-week-view.ts` |
| Resolve current season | `resolveCurrentSeasonForLeague` | `src/lib/league/resolve-current-season.ts` |
| Membership / participant check | `isLeagueParticipantRole` | `src/lib/league/participant-membership.ts` |
| Compute deadline UTC (server only — already returned in payload) | `computePickDeadlineUtc` | `src/lib/domain/pick-deadline.ts` |
| **Find opponent of jailed team** (use for the "2 PTS" affordance and to label which side is anti-jailed-eligible) | `getOpponentOfJailedInWeek` | `src/lib/domain/picks.ts` |
| Active competition window check (already done by builder) | `isWeekInLeagueCompetition` | `src/lib/nfl/nfl-regular-season.ts` |
| Business timezone constant for any Eastern formatting | `LEAGUE_BUSINESS_TIMEZONE` | `src/lib/league/league-rules.ts` |
| Eastern formatting | `formatInTimeZone` (date-fns-tz) | already in `package.json` per Story 3.5 |
| One Prisma client | `prisma` singleton | `src/lib/db.ts` |
| Auth | `auth()` | `src/lib/auth.ts` |
| CSRF guard for POST (already enforced by route handler) | `assertCookieSessionMutationOrigin` | `src/lib/cookie-session-mutation-csrf.ts` |
| Theme tokens (`accent.gold`, `warning.main`, `success.main`, `info.main`, `primary.main`) | MUI theme | `src/theme/create-app-theme.ts` + `src/theme/mui-augmentation.d.ts` |
| Existing client fetch pattern (state, error parsing, ApiError typing) | `DeleteLeagueDialog`, `InviteParticipantsForm` | `src/app/(app)/leagues/[leagueId]/settings/delete-league-dialog.tsx`, `src/app/(app)/leagues/[leagueId]/invites/invite-participants-form.tsx` |

### Architecture compliance

| Requirement | Implementation in 3.7 |
|-------------|----------------------|
| **Server-authoritative rules** (project context #3) | All validation (jailed, duplicate, anti-jailed, deadline) is mirrored client-side **only as UX hints**. The actual `POST /api/leagues/[leagueId]/picks` handler is the single source of truth — already shipped in 3.4 + 3.5. Client never short-circuits server checks. |
| **Pick visibility** (project context #4, FR48–FR49) | The extended GET payload returns **only the current user's** pick data (`currentPick`, `seasonPickedTeams`). Do **not** add fields exposing other members' picks; that is Story 5.6's reveal logic. |
| **One Prisma client** | Use `prisma` from `@/lib/db`. No new Prisma instance. |
| **MUI Stack for flex layouts** (`.cursor/rules` workspace rule, project context UI table) | All new components use `Stack` for flex; `Box` only when truly a single non-flex container. |
| **camelCase JSON / snake_case DB** | New payload fields stay camelCase; **no schema changes** required for this story. |
| **Error JSON shape** | Existing POST already returns `{ "error": { "code": "...", "message": "..." } }`. The client surfaces `error.message` exactly. |
| **Dates in UTC; Eastern only for business display** | `pickDeadlineUtc` is an ISO UTC string; any display formatting uses `formatInTimeZone(..., LEAGUE_BUSINESS_TIMEZONE, "...")`. The countdown's *remaining* duration is purely arithmetic (`deadline - now`) and TZ-independent. |
| **Server Components by default** | Page (`page.tsx`) stays an RSC; only the new `WeekMatchupList` controller, `PickStatusBanner`, `DeadlineCountdown`, `JailedTeamCallout` are client (`"use client"`). |
| **Sensitive routes rate-limited in `src/proxy.ts`** | `LEAGUE_PICKS_POST` is **already** rate-limited per `src/proxy.ts` (Story 3.4). No proxy.ts changes required. |
| **Secrets server-only** | No new integrations or env vars. Weather and odds keys remain isolated server-side; the client just consumes the JSON payload. |
| **Hooks rules / RSC boundary** (`.cursor/rules/next-rsc-client-boundaries.mdc`) | The page is RSC; do not pass functions or `Link` from RSC into client MUI children. The interactive list is its own client island. |

[Source: `docs/project-context.md` non-negotiables 1, 2, 3, 4, 6, 7, 9; `_bmad-output/planning-artifacts/architecture.md` — Frontend architecture, API & communication patterns, Dates and times]

### CSRF / fetch contract for the client POST

The existing `POST /api/leagues/[leagueId]/picks` handler:

1. Reads JSON body → Zod parses (`postPickBodySchema`)
2. `assertCookieSessionMutationOrigin(request)` — requires the `Origin` header (or `Referer` / `Sec-Fetch-Site: same-origin|same-site`) to match the request URL
3. `auth()` session check
4. Membership → transactional upsert with full validation

**Client implication:** plain same-origin `fetch("/api/leagues/${leagueId}/picks", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId, nflWeekNumber, antiJailedBonus }) })` is sufficient — browsers send `Origin` and `Sec-Fetch-Site: same-origin` for same-origin POSTs automatically. **No** need to call `/api/auth/csrf` from the picks UI. Use the same idiom as `DeleteLeagueDialog` and `InviteParticipantsForm`.

[Source: `src/lib/cookie-session-mutation-csrf.ts`; existing client examples cited above]

### Library & framework requirements (no new deps)

- **MUI** — `Card`, `Chip`, `Alert`, `Paper`, `Stack`, `Typography`, `Box` (only when needed), `Avatar` (already used by `TeamLogo`). For a lock icon, prefer `@mui/icons-material/Lock` if installed; otherwise inline SVG / unicode glyph (do **not** add `@mui/icons-material` solely for this story unless not already present — confirm at implementation by inspecting `package.json`).
- **date-fns / date-fns-tz** — already in `package.json` per Story 3.5. Use `parseISO` + arithmetic for the countdown; use `formatInTimeZone(..., LEAGUE_BUSINESS_TIMEZONE, ...)` for any human-readable Eastern output (e.g. "Locks Thu 8:10 PM ET").
- **Vitest** — co-located unit tests for pure helpers per workspace rule `.cursor/rules/post-change-testing.mdc`.
- **No new runtime dependencies** are required to satisfy this story. Do **not** add a date-picker, a state-management library, or any animation framework — the spec is achievable with hooks + MUI + CSS.

### File structure (expected touchpoints)

**New files:**

```
src/components/picks/PickStatusBanner.tsx
src/components/picks/DeadlineCountdown.tsx
src/components/picks/JailedTeamCallout.tsx
src/lib/picks/countdown.ts
src/lib/picks/countdown.test.ts
src/lib/picks/matchup-card-state.ts
src/lib/picks/matchup-card-state.test.ts
```

**Modified files:**

```
src/lib/picks/build-league-picks-week-view.ts        # add currentPick + seasonPickedTeams
src/lib/picks/picks-week-view-types.ts               # extend payload type
src/components/picks/MatchupCard.tsx                 # interactive states + anti-jailed chip + a11y
src/components/picks/WeekMatchupList.tsx             # becomes the interactive controller
src/components/picks/TeamLogo.tsx                    # jailed visual + pickedWeekTag
src/app/(app)/leagues/[leagueId]/picks/page.tsx      # wire countdown / status banner / jailed callout
```

**No changes expected:**

```
src/app/api/leagues/[leagueId]/picks/route.ts        # POST + GET already shipped (3.4 + 3.5 + 3.6)
src/proxy.ts                                         # rate limit already covers POST picks
prisma/schema.prisma                                 # no schema changes — currentPick + seasonPickedTeams are pure read paths
```

### MatchupCard visual state precedence

When multiple states could apply to a team side, the precedence is:

1. **Locked (week-level)** — overrides all interactive affordances; cards are non-interactive but selected pick keeps its highlight
2. **Jailed** — `warning.main` border on the **card**, JAILED tag + 50% desaturation on the **jailed team's logo** only; the opponent side remains selectable and shows the gold "2 PTS" affordance
3. **Already picked** — `text.disabled` + 70% grayscale + "PICKED WK X" tag on that team's side; opponent side still selectable
4. **Selected** — `primary.main` 2px border + `background.elevated` background on the **card** containing the user's current-week pick
5. **Default** — neutral

The `computeMatchupSideState` pure helper (per task list) encodes this precedence so each team side can be styled deterministically.

### Anti-jailed bonus UX clarification

Per **FR20 + UX § 3 + Story 3.4 server validation** (`validateJailedLineupAndBonus`):

- Picking **any team** is fine (1 point intent) **except** the jailed team itself.
- Picking the **jailed team's opponent** is the only matchup where the user can additionally claim the **2-point anti-jailed bonus** (`antiJailedBonus: true`).
- The bonus is **opt-in only** — the UI must **never** auto-set the flag, even when the user picks the opponent. This matches the server rule that `antiJailedBonus: true` requires the team be the opponent (else 400 `ANTI_JAILED_BONUS_INVALID`) but does **not** require the flag for picking the opponent normally.
- The "2 PTS" gold affordance is the **only** way to set the flag from the UI. Clicking the team logo / row directly picks at 1 point (`antiJailedBonus: false`); clicking the gold chip picks at 2 points.

### Pick visibility / privacy guardrail

The extended GET payload **must not** include any other participant's pick data. Concretely:

- `currentPick` is filtered by `leagueMembershipId = current user's membership id`.
- `seasonPickedTeams` is filtered by the same `leagueMembershipId`.
- Even when the caller is a league **admin**, this view returns the **admin's own participant pick data only**. Admin-wide pick visibility is Story 4.2 / 4.3 / 5.6 territory.

This preserves NFR17 (Tuesday reveal model) at the data-layer boundary, not just the UI.

### Previous story intelligence (Story 3.6 learnings)

From `_bmad-output/implementation-artifacts/3-6-picks-ui-matchups-odds-spread-weather-optional.md` Review Findings:

- `WeekMatchupList` already accepts the prop bag for 3.7 (`pickDeadlineUtc`, `jailedTeamId`, `onTeamSelect`, `selectedTeamId`, `pickedTeamIds`) but most are **not yet threaded through** end-to-end — 3.7 will complete the wiring including page → list → card.
- `MatchupCard.tsx` Review noted "**Keyboard/a11y for clickable team selection deferred to Story 3.7 — must add `role` / `tabIndex` / `onKeyDown`**". This story explicitly delivers that (AC #9).
- `MatchupCard.tsx` Review noted "**`formatAmericanMl` defined inside component body — pure stateless function re-allocated on every render; move to module scope**" (already fixed in 3.6 — keep that fix; do not regress).
- `page.tsx` Review noted "**Non-404 errors silently become `notFound()`** and **page lacks try/catch around `buildLeaguePicksWeekView`**" — both already patched. Do not re-introduce silent error swallowing when adding new fields to the page.
- `weather` chip ordering and `parseInt` strict-numeric guard were patched — leave them alone.
- The page is **RSC**, the list and cards are **client components** (`"use client"` already in place). 3.7 keeps that boundary; the page only forwards new payload fields.

### Previous story intelligence (Story 3.5 — deadline math)

From `_bmad-output/implementation-artifacts/3-5-deadline-enforcement-server-authority.md`:

- Deadline = **min**(`firstKickoffUtc - 5min`, **Thursday 8:10 PM** `LEAGUE_BUSINESS_TIMEZONE`) — **server-computed**.
- The deadline is already serialized in the GET payload as `pickDeadlineUtc: string | null`. **The client must not recompute** the deadline; it consumes the ISO string and ticks against `Date.now()`.
- The server returns **403 `PICK_DEADLINE_PASSED`** for any post-deadline POST. The UI must surface the message verbatim.
- The server also rejects with **400 `JAILED_TEAM_PICK`**, **400 `TEAM_NOT_IN_WEEK`**, **400 `ANTI_JAILED_BONUS_INVALID`**, **409 `DUPLICATE_TEAM`**, **400 `WEEK_NOT_IN_COMPETITION`**, **400 `JAILED_NOT_COMPUTED`**, **400 `SEASON_NOT_READY`**, **404 `SEASON_NOT_FOUND`**, **401 `UNAUTHENTICATED`**, **403 `FORBIDDEN`**, **500 `INTERNAL_ERROR`**. The client surfaces `error.message` for any non-2xx and rolls back optimistic state.

### Previous story intelligence (Story 3.4 — POST contract)

From `src/app/api/leagues/[leagueId]/picks/route.ts` and `src/lib/picks/post-pick-body.ts`:

- Body schema: `{ teamId: string (≥1 char), nflWeekNumber: 1–18 (Zod-validated), antiJailedBonus?: boolean (default false) }`
- Success: `200` (update) or `201` (create), body `{ pick: { id, teamId, nflWeekNumber, antiJailedBonus, createdAt, updatedAt } }`. The client should treat **both 200 and 201 as success** for UX (banner update is identical) — do not branch on the status code in the UI.
- The transaction also sets `Season.firstCompetitionWeekLockedAt` on the **first ever pick** for the season — irrelevant to 3.7 UX but worth knowing.

### Git intelligence (recent commits relevant to 3.7)

- **Story 3-6** — `MatchupCard`, `WeekMatchupList`, `TeamLogo`, `PicksPreviewBanner`, `buildLeaguePicksWeekView`, GET `/api/leagues/[leagueId]/picks`, weather integration. **3.7 extends** the same files; do **not** create parallel components.
- **Story 3-5** — `computePickDeadlineUtc` + `checkPickMutationDeadline`. Already wired into POST. **3.7 reads** `pickDeadlineUtc` from the GET payload only.
- **Story 3-4** — POST handler + domain validation. **3.7 calls** this POST as the only mutation path.
- **Story 3-3** — Jailed computation + persisted `NflWeekJailedTeam` row. **3.7 reads** `jailedTeamId` from the GET payload only.

### Latest tech notes

- **React 19 / Next 15 (App Router) — `"use client"` boundaries**: This story stays within the existing pattern: the page is RSC and forwards payload fields as plain serializable props (strings, numbers, plain objects). The interactive list (`WeekMatchupList`) is the client island. **Do not** import `next/link` or pass `Link` references from the RSC page into the client list — see `.cursor/rules/next-rsc-client-boundaries.mdc`.
- **MUI `sx` + theme.palette.accent.gold**: theme augmentation is already in place (`src/theme/mui-augmentation.d.ts`) — `theme.palette.accent.gold` is type-safe; reuse the pattern from `src/components/gold-accent-chip.tsx`.

### Project context reference

- [Source: `docs/project-context.md`] — non-negotiables 1 (server-only secrets — N/A here, no new integrations), 2 (one Prisma client), 3 (server-authoritative deadlines and rules), 4 (pick visibility — own pick only), 6 (camelCase JSON / snake_case DB), 7 (error shape), 9 (rate limits already in place for picks POST). Stack table: MUI **Stack** for flex.
- [Source: `_bmad-output/planning-artifacts/epics.md` Story 3.7] BDD: previously-picked teams unselectable; jailed prominent + direct-pick blocked; deadline countdown visible; persistent confirmation; client validation immediate; pick changes free before deadline.
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md`] §§ Color System (jailed / already-picked / submitted / locked treatments), Component Strategy (MatchupCard / PickStatusBanner / DeadlineCountdown / JailedTeamCallout / TeamLogo / WeatherBadge), Validation principles, Touch Target Sizing, Accessibility / Focus Indicators.

### Testing requirements

**Must run:** `npm test`, `npm run lint`, `npm run build` — all green.

**Add tests for (pure logic — no live network, no DOM mocking required for the helpers):**

- `src/lib/picks/countdown.test.ts` — `getCountdownVariant` covering each band: > 48h calm; 24–48h elevated; 1–24h elevated; < 4h critical; ≤ 0 passed; label formatting (`Xd Xh Xm`, `Xm Xs`, "Deadline passed").
- `src/lib/picks/matchup-card-state.test.ts` — `computeMatchupSideState` covering: default; selected; jailed (precedence over selected); alreadyPicked (precedence over selected, deferred to jailed); locked overlay (selected stays highlighted, others lose interactive affordance); both teams jailed-eligible vs neither.
- `src/lib/picks/build-league-picks-week-view.test.ts` (new or extended) — integration-light test using Prisma test setup if available, OR factor out a pure mapping helper that takes Prisma rows and returns the new payload fields, and unit-test the mapping.

**Optional component tests (acceptable to defer per Story 3.6 precedent):**

- `MatchupCard` rendering with `jailedTeamId === homeTeam.id` shows JAILED tag + warning border.
- `MatchupCard` rendering with team in `pickedTeamIds` shows PICKED WK X tag + grayscale.
- `PickStatusBanner` renders submitted vs locked variant correctly.

**No live network in tests.** Do **not** mock `fetch` for the GET / POST roundtrip in this story; the controller's fetch behavior is best validated manually + by existing route tests for the POST.

[Source: `.cursor/rules/post-change-testing.mdc`; `docs/project-context.md` Testing/quality]

### Deferred items (do NOT build in 3.7)

- Real NFL team logo images (Story **3.8**)
- Live NFL schedule sync beyond Week 1 seed (Story **3.9**)
- Kickoff-time weather forecast upgrade (Story **3.10**)
- Admin "submit on behalf of participant" UI (Story **4.2**)
- Admin pick-status dashboard (Story **4.1**)
- Tuesday reveal of peer picks / leaderboard (Stories **5.4** / **5.6**)
- Personal pick history view (Story **5.5**)
- Email deep links from Tuesday email to picks page (Story **6.4**)
- WebSocket or push-driven live updates (out of MVP scope per `docs/project-context.md` "What not to build")

### Open questions (saved; resolve at implementation if blocking)

- **"No pick yet" affordance:** Should the persistent banner render a subtle "**No pick yet for Week N**" placeholder (info palette) or simply be absent until the first pick? UX spec § PickStatusBanner says "Not rendered" for the no-pick state. **Recommended:** match UX spec exactly — render nothing when there is no pick, but render an inline microcopy below the deadline countdown ("Make a pick before the deadline.") so the page doesn't feel empty. Implementer's call within this constraint.
- **Lock icon source:** Confirm `@mui/icons-material` is in `package.json`. If not, prefer a unicode glyph (🔒) wrapped in a `Typography` with appropriate `aria-hidden` over adding the icon library purely for a single icon.
- **Optimistic update vs await-then-commit:** AC #6 specifies optimistic update + rollback on failure. If implementer prefers a tiny "Saving…" affordance instead of optimistic with rollback, that is acceptable so long as the < 200 ms feedback budget (NFR4) is met visually (e.g., the selected card immediately gets the selected border, the team name picks up a "Saving…" suffix, then settles to the final state on response). Document the chosen pattern in the dev record.
- **Lock detection precision:** The countdown effect ticks at 30 s when remaining > 1h and 1 s when ≤ 1h; lock detection follows the same cadence. A worst-case ~30 s delay between server lock and UI lock is acceptable because the **server** rejects late POSTs with 403 `PICK_DEADLINE_PASSED` regardless. Do **not** poll the GET endpoint just to detect lock — the server-side guard is the safety net.

### Project structure compliance

New files belong in:

- `src/components/picks/` — per Story 3.6 precedent (FR14–FR27 surfaces live here)
- `src/lib/picks/` — pure helpers (countdown, state computation) co-located with existing picks helpers (`week-query-param.ts`, `assert-pick-mutation-allowed.ts`, `picks-week-view-types.ts`, `build-league-picks-week-view.ts`)

No domain logic moves to `src/lib/domain/` for this story; the pure validation lives there already (Stories 3.3–3.5) and the new helpers are presentation logic, not business rules. Keep `src/lib/domain/` reserved for server-authoritative business rules per `docs/project-context.md` File organization.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md`#Story 3.7]
- [Source: `_bmad-output/planning-artifacts/prd.md`#FR16–FR25, NFR4, NFR6, NFR8, NFR17, NFR24, NFR37–NFR44]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md`#Component Strategy → MatchupCard, PickStatusBanner, DeadlineCountdown, JailedTeamCallout, TeamLogo; Color System → Jailed Team Visual Treatment, Already-Picked Team Visual Treatment; Accessibility Considerations]
- [Source: `_bmad-output/planning-artifacts/architecture.md`#Frontend architecture, API & communication patterns, Dates and times]
- [Source: `docs/project-context.md`#Non-negotiables 2, 3, 4, 6, 7, 9; UI; File organization]
- [Source: `src/app/api/leagues/[leagueId]/picks/route.ts` — POST + GET handlers (3.4 / 3.5 / 3.6)]
- [Source: `src/lib/picks/build-league-picks-week-view.ts` — view builder to extend]
- [Source: `src/lib/picks/picks-week-view-types.ts` — payload type to extend]
- [Source: `src/lib/domain/picks.ts` — `getOpponentOfJailedInWeek`, `validateJailedLineupAndBonus` (server-side reference; do not re-implement on client)]
- [Source: `src/lib/domain/pick-deadline.ts` — `computePickDeadlineUtc` (server only)]
- [Source: `src/components/picks/MatchupCard.tsx`, `WeekMatchupList.tsx`, `TeamLogo.tsx`, `PicksPreviewBanner.tsx` — existing components to extend]
- [Source: `src/theme/create-app-theme.ts`, `src/theme/mui-augmentation.d.ts` — palette tokens including `accent.gold`]
- [Source: `src/lib/cookie-session-mutation-csrf.ts` — CSRF baseline for the POST]
- [Source: `src/app/(app)/leagues/[leagueId]/settings/delete-league-dialog.tsx`, `src/app/(app)/leagues/[leagueId]/invites/invite-participants-form.tsx` — client fetch + ApiError parsing pattern to mirror]
- [Source: `_bmad-output/implementation-artifacts/3-6-picks-ui-matchups-odds-spread-weather-optional.md` — Review Findings + 3.7 hook points]
- [Source: `_bmad-output/implementation-artifacts/3-5-deadline-enforcement-server-authority.md` — deadline math and error contract]
- [Source: `_bmad-output/implementation-artifacts/3-4-pick-api-with-server-side-validation.md` — POST contract + body schema]
- [Source: `.cursor/rules/post-change-testing.mdc`, `.cursor/rules/next-rsc-client-boundaries.mdc`]

## Dev Agent Record

### Agent Model Used

claude-opus-4-7-thinking-xhigh (Cursor — Sonnet 4.7 Opus tier with extended thinking)

### Debug Log References

- `npm test` → 31 files / 172 tests pass (1.47s).
- `npm run lint` → clean.
- `npm run build` → successful (`/leagues/[leagueId]/picks` still rendered as a dynamic Server Component; route table unchanged from Story 3.6 + the staged `route.ts` import).

### Completion Notes List

- Extended the GET payload (`PicksWeekViewPayload`) with two purely **additive** fields: `currentPick: { teamId, antiJailedBonus, updatedAt } | null` and `seasonPickedTeams: { teamId, weekNumber }[]`. Both are queried with `leagueMembershipId = current user's membership id` so admins receive only their own pick context (project-context #4 / NFR17). No schema changes; no breaking changes for existing GET consumers.
- Factored a tiny `mapCurrentPick` / `mapSeasonPickedTeams` mapper into `src/lib/picks/map-current-pick.ts` so the camelCase JSON conversion is co-located unit-tested without a Prisma test harness — the builder simply imports the mappers.
- Added two pure presentation helpers in `src/lib/picks/`:
  - `countdown.ts` — `getCountdownVariant(remainingMs)` (calm > 48h, elevated 4h–48h, critical < 4h, passed ≤ 0; Xd Xh Xm above 1h, Xm Xs at-or-below 1h, "Deadline passed" at zero) + `isPickWindowClosedByDeadline(pickDeadlineUtc, now)` (server is the safety net; `now > deadline` is strictly closed).
  - `matchup-card-state.ts` — `computeMatchupSideState` precedence: jailed > alreadyPicked > selected > default; `locked` overlays default only (selected/jailed/alreadyPicked retain their visual identity; the controller strips interactivity).
- New client components:
  - `PickStatusBanner` (success palette + 4px left border / info palette + lock glyph for locked) using `role="status" aria-live="polite"`. Used a 🔒 unicode glyph instead of installing `@mui/icons-material` (per Open Questions in Dev Notes).
  - `DeadlineCountdown` ticks 1s ≤ 1h, 30s otherwise; uses `keyframes` from `@mui/system` for a subtle pulse on `critical`.
  - `JailedTeamCallout` is information-only (no click handlers, no `role="button"`).
- `TeamLogo` extended (backwards-compatible) with `jailed?: boolean` (50% desaturation + warning "JAILED" overline) and `pickedWeekTag?: number` (overlays "PICKED WK X" when paired with `disabled`).
- `MatchupCard` is now fully interactive: each team side has `role="radio"`, `aria-checked`, `aria-disabled`, keyboard `Space/Enter` activation; the card border swaps to `warning.main` (jailed) or `primary.main` (selected). The gold "2 PTS" `Chip` is rendered only on the jailed-team's opponent and dispatches `antiJailedBonus: true`. Touch targets are ≥ 44 px (`minHeight: 44`).
- `WeekMatchupList` is the interactive controller: maintains optimistic selection (rolls back on `!res.ok`), inline status messages with `role="status"` / `role="alert"`, arrow-key roving focus across the radiogroup, and a deadline-driven `isLocked` flip. POST is plain same-origin `fetch` with `credentials: "include"` (the existing `assertCookieSessionMutationOrigin` guard accepts the browser-supplied `Origin` / `Sec-Fetch-Site` headers — no separate CSRF call needed; matches `DeleteLeagueDialog` and `InviteParticipantsForm`).
- Picks page (RSC) renders the new `DeadlineCountdown` and `JailedTeamCallout` only when `!isPreview` and the relevant data is present; preview mode keeps the Story 3.6 behavior (banner + non-interactive list) per AC #8.
- **Architecture compliance:** server still authoritative for jailed/duplicate/anti-jailed/deadline (POST handler unchanged); no new dependencies; one Prisma client; camelCase JSON; UTC `pickDeadlineUtc` with Eastern-TZ display via `formatInTimeZone(LEAGUE_BUSINESS_TIMEZONE)`; rate-limited POST already covered by Story 3.4 in `src/proxy.ts`.
- **Pick privacy:** GET payload extension is filtered by `leagueMembershipId` at the **query** layer; admins receive their own pick context only. No path exposes other participants' picks (Story 5.6 territory).

### File List

**New files:**

```
src/components/picks/PickStatusBanner.tsx
src/components/picks/DeadlineCountdown.tsx
src/components/picks/JailedTeamCallout.tsx
src/lib/picks/countdown.ts
src/lib/picks/countdown.test.ts
src/lib/picks/matchup-card-state.ts
src/lib/picks/matchup-card-state.test.ts
src/lib/picks/map-current-pick.ts
src/lib/picks/map-current-pick.test.ts
```

**Modified files:**

```
src/lib/picks/build-league-picks-week-view.ts
src/lib/picks/picks-week-view-types.ts
src/components/picks/MatchupCard.tsx
src/components/picks/WeekMatchupList.tsx
src/components/picks/TeamLogo.tsx
src/app/(app)/leagues/[leagueId]/picks/page.tsx
_bmad-output/implementation-artifacts/sprint-status.yaml
_bmad-output/implementation-artifacts/3-7-jailed-and-already-picked-ux-with-countdown-and-status.md
```

### Review Findings

Code review (BMAD adversarial layers: blind / edge-case / acceptance vs story 3.7 + sprint-status). **3** `patch`, **2** `defer`, **5+** dismissed as noise or spec-aligned.

**decision-needed**

_(none)_

**patch**

- [x] [Review][Patch] Duplicate POSTs while a pick save is in flight — `submitting` toggles but `handleTeamSelect` does not return early when `submitting === true`, so rapid clicks/spam can issue parallel `POST`s and interleave optimistic rollbacks [`WeekMatchupList.tsx` ~137–194] — **fixed 2026-05-09:** ignore `select` while `submitting`
- [x] [Review][Patch] `DeadlineCountdown` `useEffect` lists `now` in its dependency array while the interval callback updates `now`, so in the final hour the effect tears down and recreates the interval on every tick (`src/components/picks/DeadlineCountdown.tsx` ~44–57) — **fixed 2026-05-09:** chained `setTimeout` with `[deadlineMs]` only; recomputes 1s vs 30s after each tick
- [x] [Review][Patch] Module header in `computeMatchupSideState` documents precedence (**selected** first) that contradicts the actual evaluation order (jailed → alreadyPicked → selected → locked) and the story’s MatchupCard precedence table — fix the comment to avoid misleading future edits [`src/lib/picks/matchup-card-state.ts` ~1–11] — **fixed 2026-05-09:** JSDoc aligned to implementation

**defer**

- [x] [Review][Defer] Prisma `7.7.x` → `7.8.x` bump and `prisma/seed.cjs` session reminder — useful but out of scope for Story 3.7 UX; track as tooling hygiene [`package.json`, `prisma/seed.cjs`] — deferred, scope churn
- [x] [Review][Defer] Gold `2 PTS` `Chip` (`size="small"`) may fall short of NFR8 / 44×44 px touch target — verify with design tokens and pad or switch variant when polishing a11y [`MatchupCard.tsx` ~227–255] — deferred, UX polish

**Dismissed (record only)**

- Focus ring uses `primary.main`; theme documents primary as emerald (`create-app-theme.ts`) — matches UX intent for AC #9.
- Preview mode omits `JailedTeamCallout` — aligns with the stricter clause in AC #8 (“no `JailedTeamCallout` … as if competition were active”).
- `seasonPickedTeams` query excludes `targetWeek` — current-week pick cannot be mislabeled “already picked” via payload.
- `403` + `PICK_DEADLINE_PASSED` + `setSelection(previous)` — for typical single-flight flows, `previous` is the last client state before the failed optimistic attempt and matches the persisted pick; full “stale parallel POST” hardening can wait unless reproduced.
- `import type { Prisma }` on picks route — supports `Prisma.TransactionClient`; not dead code.

## Change Log

- **2026-05-09** — **Review patches applied** (batch option 0): `WeekMatchupList` ignores overlapping `select` while `submitting`; `DeadlineCountdown` uses chained timeouts tied to `deadlineMs` only; `matchup-card-state` JSDoc corrected. `npm test` — 172 passed.
- **2026-05-09** — **`bmad-code-review`** on uncommitted diff (~21 files, **+2028 / −256** vs `HEAD`). Findings recorded under **Review Findings**; story status **review → in-progress**; sprint `3-7` synced to **in-progress** (open patch items). 0 `decision-needed`, 3 `patch`, 2 `defer`, remainder dismissed.
- **2026-05-09** — Story implemented (`dev-story` workflow): added `currentPick` + `seasonPickedTeams` to `PicksWeekViewPayload` (queried per-membership for own-pick-only privacy); created `PickStatusBanner`, `DeadlineCountdown`, `JailedTeamCallout` client components; extended `TeamLogo` with `jailed?` / `pickedWeekTag?`; rewired `MatchupCard` for `role="radio"` interactive states + a11y + anti-jailed gold "2 PTS" chip; promoted `WeekMatchupList` into the interactive controller (optimistic POST + rollback, arrow-key radiogroup, inline status / error region, deadline-driven lock); wired the picks page to render countdown + jailed callout when not in preview; added pure helpers `countdown.ts` (`getCountdownVariant`, `isPickWindowClosedByDeadline`) and `matchup-card-state.ts` (`computeMatchupSideState`) with co-located Vitest tests. **172 tests pass**, lint clean, build successful. Status **review**.
- **2026-05-09** — Story created (`create-story` workflow): `epics.md` Story 3.7, `sprint-status.yaml`, `project-context.md`, `prd.md` FR16–FR25 / NFR4 / NFR6 / NFR8 / NFR17 / NFR24 / NFR37–NFR44, `architecture.md` patterns, `ux-design-specification.md` (Component Strategy, Color System, Accessibility), Stories 3-4 / 3-5 / 3-6 artifacts, codebase analysis (picks route GET+POST, `build-league-picks-week-view`, `MatchupCard`, `WeekMatchupList`, `TeamLogo`, `PicksPreviewBanner`, `pick-deadline`, `picks` domain, theme tokens, CSRF helper, existing client fetch patterns). Status **ready-for-dev**.
