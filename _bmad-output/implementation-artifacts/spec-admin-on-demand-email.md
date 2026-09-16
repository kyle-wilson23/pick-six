---
title: 'League admin on-demand participant note email'
type: 'feature'
created: '2026-09-16'
status: 'draft'
context:
  - '{project-root}/docs/project-context.md'
  - '{project-root}/docs/email-provider-decision.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** League admins can only email participants through Tuesday digest / reminder windows. They cannot send a one-off note outside those jobs.

**Approach:** Add a right-column admin card **under** Email automation status: a **Note for participants** field and **Send Now** (disabled until the note has non-whitespace text). Send immediately to all current members via Resend using existing EmailLayout chrome — not the digest/reminder templates.

## Boundaries & Constraints

**Always:**
- League admin only. CSRF `assertCookieSessionMutationOrigin`; `{ error: { code, message } }`.
- Recipients = `leaguePlayerMembershipWhere` (ADMIN + MEMBER; exclude `SUPERUSER_EMAIL`). No picker. Works with **no active week**.
- Note required, max **2000** chars, request-scoped only (do not write `LeagueWeekEmailConfig`). Repeats allowed; each send uses a **new** Resend idempotency UUID.
- Subject auto: `[LeagueName] A note from your commissioner` via `formatEmailSubject`. Body: league heading, “Note from your commissioner”, pre-wrap note, `PrimaryCta` **Open league** → `/leagues/{id}`. Honor `[TEST]` / body notice and `TEST_LEAGUE_EMAIL_MODE=suppress` (same JSON/UI as digest).
- Card: `Paper` `p: 2` `borderRadius: 2` like `AdminEmailComposer`. Send Now `contained` `primary`. Helper: sends immediately to all current participants; not the weekly digest. Alerts match the composer (success / partial / fail / suppress).
- Dedicated proxy rate limit on the new POST (~8 / 15 min per client). Reuse `sendWithRetry`, concurrency 4, per-call breaker. Partial Resend failure (including daily 429) returns `sent`/`failed` — HTTP 429 only if the **proxy** bucket trips.

**Ask First:**
- Recipient subsets, subject field, preview, confirm dialog, or persisting notes in Postgres.
- Changing digest/reminder copy, cron, or `LeagueWeekEmailConfig`.

**Never:**
- Reuse `sendTuesdayDigest` / `sendReminder` or `ALREADY_SENT` / `force=true`.
- Render the note as HTML/markdown; `NEXT_PUBLIC_*` email secrets; cron for this send.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy | Admin; trimmed note 1–2000; ≥1 member | Resend each member; `{ sent, failed, sentAt, suppressed: false }` | N/A |
| Empty note | Missing / whitespace | No Resend | 400 `VALIDATION_ERROR`; Send Now disabled |
| Too long | Note > 2000 | No Resend | 400 `VALIDATION_ERROR` |
| No members | Valid note; empty set | No Resend | 200 `{ sent: 0, failed: 0 }`; UI: no members |
| Suppress | Test league + `TEST_LEAGUE_EMAIL_MODE=suppress` | No Resend; `suppressed`, `wouldSendCount` | Info Alert like digest |
| Unauthed / non-admin / CSRF | No session / not admin / bad origin | No Resend | 401 / 403 |
| Rate limited | Over dedicated bucket | No Resend | 429 `RATE_LIMITED` |
| Partial / daily cap | Some Resend fails or 429 mid-loop | `sent`/`failed` counts | Warning Alert |

</frozen-after-approval>

## Code Map

- `src/app/(app)/leagues/[leagueId]/admin/page.tsx` -- Mount card under `AdminWeeklyEmailStatus`
- `src/components/admin/AdminEmailComposer.tsx` -- Paper, Send Now, alert copy to mirror
- `src/lib/email/templates/EmailLayout.tsx` / `TuesdayDigestEmail.tsx` -- Chrome, pre-wrap note, CTA
- `src/lib/email/send-tuesday-digest.ts` -- Fan-out/suppress/retry/breaker pattern (do not call)
- `src/lib/league/player-membership-where.ts` -- Recipient filter
- `src/app/api/leagues/[leagueId]/email/tuesday-send/route.ts` -- CSRF + admin auth skeleton
- `src/proxy.ts` / `src/lib/rate-limit.ts` / `rate-limit.test.ts` -- Dedicated POST matcher
- `src/lib/email/test-league-labeling.ts` / `test-league-email-mode.ts` / `send-with-retry.ts` -- Existing send stack

## Tasks & Acceptance

**Execution:**
- [ ] `src/lib/email/templates/AdminNoteEmail.tsx` (+ `email-templates.test.tsx`) -- Layout, heading, pre-wrap note, Open league CTA, test-league notice
- [ ] `src/lib/email/send-admin-note.ts` (+ `send-admin-note.test.ts`) -- League + members; suppress; fan-out; UUID keys; sent/failed/suppressed
- [ ] `src/app/api/leagues/[leagueId]/email/admin-note/route.ts` -- POST CSRF/admin; Zod `note` 1–2000; I/O statuses
- [ ] `src/lib/rate-limit.ts` + `src/proxy.ts` + `rate-limit.test.ts` -- Dedicated bucket; match `POST /api/leagues/:id/email/admin-note`
- [ ] `src/components/admin/AdminOnDemandEmailCard.tsx` (+ `.test.tsx`) -- Note field; Send Now disabled until trim nonempty; alerts
- [ ] `src/app/(app)/leagues/[leagueId]/admin/page.tsx` -- Render immediately under `AdminWeeklyEmailStatus`

**Acceptance Criteria:**
- Given a league admin on `/leagues/{id}/admin`, when the page loads, then a note card sits under Email automation status with the weekly email card’s Paper treatment.
- Given the note is empty or whitespace, when they view the card, then Send Now is disabled.
- Given a non-empty note, when they click Send Now, then each current member gets one EmailLayout message containing the typed note, and the weekly digest is unchanged.
- Given a test league with `TEST_LEAGUE_EMAIL_MODE=suppress`, when they send, then Resend is not called and the UI shows the existing would-send info copy.
- Given a non-admin or unauthenticated caller, when they POST the new route, then they get 401/403 and no send.

## Spec Change Log

## Design Notes

Do **not** hang this off `LeagueWeekEmailConfig` — `sentAt` / `bodyText` belong to the Tuesday digest. Ad-hoc notes are request-scoped. Idempotency keys must include a per-send UUID so a second click can deliver (digest keys are week+member and would drop a repeat inside 24h).

```tsx
<EmailLayout preview={`A note from your ${leagueName} commissioner`}>
  <Heading>{leagueName}</Heading>
  <Heading as="h2">Note from your commissioner</Heading>
  <Text style={{ ...textStyle, whiteSpace: "pre-wrap" }}>{note}</Text>
  <PrimaryCta href={leagueUrl} label="Open league" />
</EmailLayout>
```

## Verification

**Commands:**
- `npm test` -- new template/send/card/rate-limit tests pass; existing email tests still pass

**Manual checks (if no CLI):**
- Admin page: card under Email automation status; Send Now disabled until text; inbox shows brand chrome + note + Open league (or suppress Alert in rehearsal).
