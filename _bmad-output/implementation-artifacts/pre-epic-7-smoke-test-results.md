# Pre-Epic 7 Manual Email Flow — Smoke Test Results

**Date:** 2026-07-05 (automated AC7/AC9); manual AC3–AC6 verified 2026-07-05  
**Tester:** Kyle Wilson  
**Environment:** `localhost:3000`, Resend sandbox (`Pick Six <onboarding@resend.dev>` via `RESEND_FROM`), recipient `j.wilson.kyle@gmail.com`

## Summary

| AC | Flow | Status | Notes |
|----|------|--------|-------|
| AC3 | Invitation email | **PASS** | Delivered to Resend account inbox; accept-invite flow for existing user (sign out → sign in → join league) |
| AC4 | Tuesday digest preview + send + idempotency | **PASS** | Preview HTML, Send Now, re-send without force → 409 `ALREADY_SENT` |
| AC5 | Wed/Thu reminders | **PASS** | Outstanding members only; timestamps recorded; buttons disabled when all submitted |
| AC6 | Email deep links | **PASS** | Logged-in direct to picks; logged-out login → callbackUrl → picks |
| AC7 | Cron curl smoke | **PASS** | 401 without secret; 200 + `outside_window` with Bearer (see below) |
| AC9 | Tests + lint | **PASS** | 339 tests pass; lint clean (2026-07-05) |

**Overall: ALL PASS** — Epic 7 email-flow pre-condition satisfied.

## AC3 — Invitation email

- Admin invite sent to `j.wilson.kyle@gmail.com`
- Email received; Resend dashboard delivery confirmed
- Existing-account path: wrong-session warning → sign out and sign in → **Join league** (not new signup)
- Server logs: `[email] invitation sent`

## AC4 — Tuesday digest

- Preview opened rendered HTML in new tab (standings, picks CTA)
- Send Now: members received digest; admin UI **Sent at [timestamp]**
- Second Send Now (no force): 409 + force-resend message in UI

## AC5 — Wed/Thu reminders

- ≥1 member left without pick before send
- Wednesday + Thursday reminders sent to outstanding members only
- `wednesdayReminderSentAt` / `thursdayReminderSentAt` recorded
- After all submitted: reminder buttons disabled with **All members have submitted picks**

## AC6 — Deep links

- Picks URL from email used `http://localhost:3000/...`
- Logged in: landed on picks page directly
- Incognito: login → redirected to picks via `callbackUrl`

## AC7 — Cron curl results

Dev server: `npm run dev` on `http://localhost:3000`. `CRON_SECRET` from `.env.local`.

| Route | No auth | Expected | Result |
|-------|---------|----------|--------|
| `/api/cron/tuesday-email` | GET | 401 `UNAUTHORIZED` | **PASS** |
| `/api/cron/wednesday-reminder` | GET | 401 `UNAUTHORIZED` | **PASS** |
| `/api/cron/thursday-reminder` | GET | 401 `UNAUTHORIZED` | **PASS** |

| Route | Bearer `$CRON_SECRET` | Expected (outside ET window) | Result |
|-------|----------------------|------------------------------|--------|
| `/api/cron/tuesday-email` | GET | 200 `{ status: "skipped", reason: "outside_window" }` | **PASS** |
| `/api/cron/wednesday-reminder` | GET | 200 `{ status: "skipped", reason: "outside_window" }` | **PASS** |
| `/api/cron/thursday-reminder` | GET | 200 `{ status: "skipped", reason: "outside_window" }` | **PASS** |

In-window cron send: not tested (admin manual sends verified same underlying functions per runbook).

## Resend message IDs

Message IDs not captured in Resend dashboard during run; delivery confirmed visually in inbox and dashboard send list.

| Send type | Message ID | Delivered |
|-----------|------------|-----------|
| Invitation | (not recorded) | Yes |
| Tuesday digest | (not recorded) | Yes |
| Wednesday reminder | (not recorded) | Yes |
| Thursday reminder | (not recorded) | Yes |

## Bugs found and fixed (during smoke test)

| Issue | Severity | Resolution |
|-------|----------|------------|
| Invite signup 400 for existing Resend-account email | Blocking | Added `POST /api/signup/invite/accept`, preview `already_registered` state, wrong-account sign-out flow |
| Sign in to accept loop when logged in as admin | Blocking | `WrongAccountForInvite` + sign-out before login |
| Hydration mismatch on invite login links | Low | Server-computed `buildInviteLoginHref()` passed as props |

Non-blocking items remain in `deferred-work.md` (TOCTOU, stale outstandingCount, prod domain, etc.).

## AC9 — Quality gates

```
npm test  → 53 files, 339 tests passed (2026-07-05)
npm run lint → clean
```
