---
title: 'Edit recipients for on-demand admin note'
type: 'feature'
created: '2026-09-16'
status: 'done'
baseline_commit: '6415ecf872834b04f97557ba5340b4ff71bd908d'
context:
  - '{project-root}/docs/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-admin-on-demand-email.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Send Now on Message participants always emails every player member, including the commissioner. Admins need to drop themselves and optionally others before an immediate send (not the weekly digest).

**Approach:** Add **Edit recipients** (left of Save & Preview / Send Now). A modal lists eligible participants with checkboxes (all on by default). Done keeps the set. That set is who Send Now emails. Under the note field, show **All users selected** or **N users selected**.

## Boundaries & Constraints

**Always:**
- Eligible rows = `leaguePlayerMembershipWhere` (ADMIN + MEMBER, superuser email already out) **minus the acting session user**. Pass `{ membershipId, displayName }[]` from admin page SSR via `listLeagueRoster` — not `buildSubmissionStatus` (empty when there is no active week). Do not send emails in the modal payload.
- Default: every eligible membership selected. **Edit recipients** is `outlined` secondary, first in the button row (`xs` column = top). Enabled even when the note is empty; disabled only while Sending. Existing Save & Preview / Send Now rules unchanged, plus Send Now disabled when **0** are selected.
- Modal: MUI `Dialog` + `DialogTitle` / `DialogContent` / `DialogActions`. One named checkbox per eligible user (`displayName`). Local toggles; **Done** (and dialog close/Escape/backdrop) commits the checkbox state and closes. No Cancel. Empty eligible list: empty dialog, Done still closes.
- Card subtext (body2, text.secondary) between the note field and the buttons: **All users selected** when every eligible user is checked; otherwise **N users selected** (N = checked count, including `0 users selected`). Exact phrasing.
- POST `{ note, recipientMembershipIds }`. Server intersects ids with the eligible set (league player members except actor + superuser). Result empty → 400 `VALIDATION_ERROR`, no Resend. Ignore unknown ids. Suppress `wouldSendCount` = filtered set size. Preview unchanged (no recipient ids).
- Client state only (reload resets to all eligible). `{ error: { code, message } }`. Tests: schema, send filter, card/modal/subtext/POST body.

**Ask First:**
- Select-all / clear-all controls, persisting the set, or changing digest/reminder recipients.
- Showing emails in the modal, or emailing the acting admin / superuser.

**Never:**
- Trust client ids without intersecting the eligible set.
- `LeagueWeekEmailConfig`, digest/reminder templates, `ALREADY_SENT` / `force`.
- New fetch-on-open roster API unless SSR cannot supply the list.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Default send | Eligible ≥1; all checked; valid note | Resend only eligible (not actor/superuser) | N/A |
| Subset | 2 of 5 checked; POST those membershipIds | Those 2 only | N/A |
| Deselect some | Any unchecked | Subtext `N users selected`; send uses that N | N/A |
| Zero selected | All unchecked | Subtext `0 users selected`; Send Now disabled | If POST anyway: 400, no Resend |
| Unknown ids | Extra/foreign membershipIds | Intersect; send remainder | Empty remainder: 400 |
| Actor is member | Admin has a membership | Actor omitted from modal and send | N/A |
| Superuser sender | No membership / excluded email | List is other player members; all selected | N/A |
| Solo admin | Eligible list empty | Empty modal; `0 users selected`; Send Now disabled | N/A |
| Preview | Subset selected | Preview HTML only; no recipient filter | N/A |
| Suppress | Test league + suppress | `wouldSendCount` = selected eligible count | Info Alert unchanged |

</frozen-after-approval>

## Code Map

- `src/components/admin/AdminOnDemandEmailCard.tsx` (+ `.test.tsx`) -- Button, subtext, modal, POST `recipientMembershipIds`; fireEvent + ThemeProvider
- `src/app/(app)/leagues/[leagueId]/admin/page.tsx` -- `listLeagueRoster`; pass eligible `{ membershipId, displayName }` (drop `session.user.id`)
- `src/lib/league/list-league-roster.ts` -- Name-sorted roster; already excludes superuser
- `src/lib/email/admin-note.ts` (+ `.test.ts`) -- Zod `recipientMembershipIds: z.array(z.string().min(1))`
- `src/lib/email/send-admin-note.ts` (+ `.test.ts`) -- `actorUserId` + ids; intersect eligible; empty → throw or sentinel the route maps to 400
- `src/app/api/leagues/[leagueId]/email/admin-note/route.ts` -- Pass ids + `session.user.id`
- `src/components/admin/AdminPickOverrideDialog.tsx` -- Dialog chrome to copy (not pick logic)
- `src/lib/league/player-membership-where.ts` -- Eligible membership filter

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/email/admin-note.ts` (+ `.test.ts`) -- Require `recipientMembershipIds` string array on JSON parse; keep note 1–2000
- [x] `src/lib/email/send-admin-note.ts` (+ `.test.ts`) -- Filter to eligible ∩ requested; I/O matrix (subset, unknown ids, actor excluded, empty → no send); `wouldSendCount` from filtered set
- [x] `src/app/api/leagues/[leagueId]/email/admin-note/route.ts` -- Forward ids + actor; 400 when filtered set empty
- [x] `src/app/(app)/leagues/[leagueId]/admin/page.tsx` -- SSR roster; pass eligible recipients (no emails)
- [x] `src/components/admin/AdminOnDemandEmailCard.tsx` (+ `.test.tsx`) -- Edit recipients leftmost; Dialog checkboxes default-on; Done/close commit; subtext; Send Now needs note + ≥1 selected; POST includes ids

**Acceptance Criteria:**
- Given the Message participants card, when it renders, then **Edit recipients** is the leftmost action and the subtext is **All users selected** (or **0 users selected** if nobody is eligible).
- Given the admin opens the modal, when they view rows, then every eligible participant except themselves and the superuser appears, all checked.
- Given they uncheck some names and click Done, when the modal closes, then the card shows **N users selected** and Send Now emails only those N.
- Given zero names are checked, when they view the card, then Send Now is disabled even if the note has text.
- Given a valid subset POST, when the server sends, then unknown ids are dropped, the actor and superuser never receive, and an empty remainder returns 400 without Resend.

## Spec Change Log

## Design Notes

Use **membershipId** (send fan-out + idempotency keys already do). Exclude the actor by `session.user.id` after the roster query so a superuser with no membership still sees everyone else.

Keep checkbox edits in modal state until close so accidental backdrop click after toggling still keeps the last checks (no Cancel = no discard). Reload returns to all eligible selected.

```ts
recipientMembershipIds: z.array(z.string().min(1))
```

## Verification

**Commands:**
- `npm test` -- admin-note parse, send-admin-note filter, AdminOnDemandEmailCard picker/subtext/POST; existing admin-note tests still pass

**Manual checks (if no CLI):**
- Admin page: modal names, default all, Done, subtext, Send Now / suppress count honors the subset; digest card unchanged.

## Suggested Review Order

**Entry — picker on the send card**

- Leftmost Edit recipients, All/N users selected, Send Now needs ≥1 checked
  [`AdminOnDemandEmailCard.tsx:314`](../../src/components/admin/AdminOnDemandEmailCard.tsx#L314)

- Done/Escape/backdrop commit the draft set (no Cancel / no discard)
  [`AdminOnDemandEmailCard.tsx:148`](../../src/components/admin/AdminOnDemandEmailCard.tsx#L148)

- POST body is `{ note, recipientMembershipIds }` from the eligible ∩ checked set
  [`AdminOnDemandEmailCard.tsx:185`](../../src/components/admin/AdminOnDemandEmailCard.tsx#L185)

**Eligible list (SSR, no emails)**

- Roster minus the acting user, names only, works with no active week
  [`page.tsx:77`](../../src/app/(app)/leagues/[leagueId]/admin/page.tsx#L77)

**Server intersect (do not trust client ids)**

- Send schema requires `recipientMembershipIds`; empty remainder is 400
  [`admin-note.ts:12`](../../src/lib/email/admin-note.ts#L12)

- Route forwards session user + ids; maps no-recipients to VALIDATION_ERROR
  [`route.ts:59`](../../src/app/api/leagues/[leagueId]/email/admin-note/route.ts#L59)

- Eligible = player members minus actor minus unknown ids; then Resend
  [`send-admin-note.ts:84`](../../src/lib/email/send-admin-note.ts#L84)

**Tests**

- Schema, subset/unknown/actor/empty, card modal + POST body
  [`AdminOnDemandEmailCard.test.tsx:294`](../../src/components/admin/AdminOnDemandEmailCard.test.tsx#L294)

