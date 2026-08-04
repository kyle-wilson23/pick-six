---
title: 'Admin Invites nav link (desktop + mobile More)'
type: 'feature'
created: '2026-08-03'
status: 'done'
baseline_commit: 'ec21baa0e0fa488f30973b7a17750debaf21ec27'
context:
  - '{project-root}/docs/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** After league creation (or leaving the Invites page), admins have no persistent UI path back to `/leagues/[leagueId]/invites` to mark the league ready/active or continue inviting — only the post-create redirect and the admin leagues list row action.

**Approach:** Add an admin-only **Invites** league nav item after **Admin** on desktop, and in the mobile **More** menu directly under **Admin**, linking to the existing invites page.

## Boundaries & Constraints

**Always:**
- Invites tab is admin-only (same visibility gate as Admin / Settings via `getLeagueNavTabs(isAdmin)`).
- Desktop order for admin tabs: `… Rules · Admin · Invites · Settings`.
- Mobile More order for admins: `Rules · Admin · Invites · Settings` (then Profile / Log out as today).
- Invites stays in the mobile More overflow (not the primary bottom bar).
- Active-tab matching treats `/leagues/[leagueId]/invites` as the Invites tab.
- Pathname-based admin chrome fallback (before `SyncAppNavLeague` hydrates) must treat the invites route like admin/settings so admin tabs still render on deep link.

**Ask First:**
- Changing invites page access control (page is currently membership-visible; mutations are admin-only) — out of this change unless product asks.
- Adding Invites to league hub quick actions or other surfaces beyond global league nav.

**Never:**
- Show Invites to non-admins in nav.
- Put Invites in the primary mobile bottom bar.
- Redesign nav chrome, rename the invites page, or change invite/create-league flows.
- Add a second “invite” entry elsewhere as a substitute for this nav link.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Admin desktop | `isAdmin === true` | Tabs include Invites immediately after Admin | N/A |
| Non-admin desktop | `isAdmin === false` | No Invites (or Admin/Settings) tab | N/A |
| Admin mobile More | `isAdmin === true` | More menu includes Invites under Admin | N/A |
| Active route | pathname `/leagues/{id}/invites` | Active tab key `invites`; More highlighted on mobile | N/A |
| Deep link before context | on `/invites`, `league == null` | Admin tabs still shown (path fallback includes invites) | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/league/league-nav-tabs.ts` -- Tab definitions, admin tab list order, `MOBILE_MORE_MENU_TAB_KEYS`, `getActiveLeagueTab`
- `src/lib/league/league-nav-tabs.test.ts` -- Order, More menu keys, active-tab cases for `/invites`
- `src/components/league/LeagueNavShell.tsx` -- Desktop tabs; `TAB_ICONS`; pathname `isAdmin` fallback for admin/settings
- `src/components/layout/MobileBottomNav.tsx` -- More menu from `getMobileMoreMenuTabs`; `TAB_ICONS`
- `src/app/(app)/leagues/[leagueId]/invites/page.tsx` -- Existing target page (no change expected)

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/league/league-nav-tabs.ts` -- Add `LEAGUE_INVITES_TAB` (`key: "invites"`, label `Invites`, `/invites`); insert after Admin and before Settings in `getLeagueNavTabs(true)`; add `"invites"` to `MOBILE_MORE_MENU_TAB_KEYS`; update JSDoc that currently lists invites as unmatched
- [x] `src/lib/league/league-nav-tabs.test.ts` -- Expect admin desktop keys `… admin, invites, settings`; More keys `rules, admin, invites, settings`; resolve `/leagues/abc/invites` → `"invites"` (remove from null cases)
- [x] `src/components/league/LeagueNavShell.tsx` -- Add invites icon (e.g. `MailOutline` or `PersonAdd`); extend path-based `isAdmin` fallback with `pathLeagueTab === "invites"`
- [x] `src/components/layout/MobileBottomNav.tsx` -- Add matching invites icon in `TAB_ICONS`

**Acceptance Criteria:**
- Given an admin viewing a league on desktop, when the league nav renders, then **Invites** appears immediately after **Admin** and navigates to `/leagues/{leagueId}/invites`.
- Given a non-admin participant, when league nav renders, then **Invites** is not present.
- Given an admin on mobile, when they open **More**, then **Invites** appears directly under **Admin**.
- Given pathname `/leagues/{id}/invites`, when active tab is computed, then the Invites item (and mobile More) shows as active.
- Given a cold load of `/invites` before nav league context hydrates, when chrome renders, then admin tabs including Invites still appear.

## Spec Change Log

## Verification

**Commands:**
- `npm test -- src/lib/league/league-nav-tabs.test.ts` -- expected: all tests pass

**Manual checks (if no CLI):**
- As admin: desktop tab order Admin → Invites → Settings; click Invites lands on invite participants page.
- As admin on narrow viewport: More menu order Rules → Admin → Invites → Settings.
- As non-admin: no Invites in desktop tabs or More.

## Suggested Review Order

**Tab model**

- Admin-only Invites tab definition and placement after Admin.
  [`league-nav-tabs.ts:48`](../../src/lib/league/league-nav-tabs.ts#L48)

- Admin tab list inserts Invites before Settings.
  [`league-nav-tabs.ts:66`](../../src/lib/league/league-nav-tabs.ts#L66)

- Invites stays in mobile More overflow with admin/settings.
  [`league-nav-tabs.ts:79`](../../src/lib/league/league-nav-tabs.ts#L79)

**Chrome wiring**

- Path fallback treats invites like admin/settings before context hydrates.
  [`LeagueNavShell.tsx:93`](../../src/components/league/LeagueNavShell.tsx#L93)

- Non-admins on membership-visible `/invites` do not get admin tab active state.
  [`LeagueNavShell.tsx:103`](../../src/components/league/LeagueNavShell.tsx#L103)

- More highlights only when the active tab is actually in the menu.
  [`MobileBottomNav.tsx:69`](../../src/components/layout/MobileBottomNav.tsx#L69)

**Tests**

- Order, More keys, and `/invites` active-tab resolution covered.
  [`league-nav-tabs.test.ts:27`](../../src/lib/league/league-nav-tabs.test.ts#L27)
