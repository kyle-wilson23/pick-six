---
title: 'In-app bug / feedback report (GitHub Issues + Resend receipt)'
type: 'feature'
created: '2026-08-30'
status: 'done'
baseline_commit: '0d4d67bda143a6ef2533813b5ee7f5046c0eb5d7'
context:
  - '{project-root}/docs/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Logged-in users cannot report a bug or send feedback in-app. Kyle has no GitHub Issues triage list from the product, and a hardcoded email in the client is forbidden.

**Approach:** **Report a problem** in the desktop account menu and mobile **More** menu opens a first-party dialog. Pick Six API creates a GitHub issue in the configured reports repo (public is acceptable), emails the reporter a receipt (existing Resend chrome), and optionally puts a screenshot on Vercel Blob. If GitHub is down, Kyle still gets a clearly labeled fallback email. No Pick Six ticket table.

## Boundaries & Constraints

**Always:**
- Authenticated only. User id, name, and email come from session/DB — never from the client.
- `GITHUB_TOKEN`, `GITHUB_REPORTS_REPO` (`owner/repo`; **public repo is acceptable**), `REPORTS_OPERATOR_EMAIL`, Blob, and Resend stay server-only. Never `NEXT_PUBLIC_*`. Issue bodies (name, email, trail) will be visible on a public repo — accepted.
- Menu item is **second-last**, immediately above **Log out**, in `UserNavMenu` (md+) and `MobileBottomNav` More (including `/home`). Opens a **Dialog**, not a new route.
- Required non-empty description; optional screenshot (file input, no crop). Auto-attach `userAgent`, `innerWidth`×`innerHeight`, and `mobile` if width `< 900`.
- League: path `/leagues/{id}` if the user is a member; else membership with latest `lastVisitedAt`; omit if none.
- Visit trail: last 15 pathnames in this tab (strip query/hash; collapse consecutive dupes).
- Screenshot → Blob `reports/` prefix, `access: "public"`, markdown image on the issue (same public-link trade as avatars).
- Receipt uses `EmailLayout`. Copy: we received it; no reply expected.
- **F1b:** GitHub fail → email operator with an unmistakable **GitHub is down / issue was not opened** banner + full payload; still send receipt. If GitHub **and** operator mail fail → 502, do not claim success. **F2b:** Blob fail → deliver without image; tell the user. **F3a:** receipt fail → still 200 (no duplicate-issue retry). **F4a:** empty description → 400, no send.
- CSRF `assertCookieSessionMutationOrigin`; errors `{ error: { code, message } }`; dedicated proxy rate limit on `POST /api/reports`.

**Ask First:**
- Labels/assignees that assume extra repo setup.
- Persisting reports in Postgres or any in-app ticket list.
- Third-party widgets or sending users to github.com.

**Never:**
- Hardcode operator email, GitHub token, or repo in the client.
- Store reports in Pick Six’s database.
- Public feedback boards, vendor chrome, extra user accounts, or auto-captured screenshots/consoles.
- Queue-and-lie success. Fail the submit only when neither GitHub nor operator fallback delivered.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy | Authed; description; GitHub+Resend OK | GitHub issue (fields below); receipt; `{ ok: true }` | N/A |
| Empty description | Whitespace-only | No GitHub/Blob/mail | 400 `VALIDATION_ERROR` |
| F2b Blob fail | File present; `put` fails; GitHub OK | Issue without image; `{ ok: true, screenshotOmitted: true }` | UI: sent without screenshot |
| F1b GitHub down | Issues API errors; operator mail OK | No issue; operator mail says issue was **not** opened; receipt | `{ ok: true, githubFallback: true }` |
| Total fail | GitHub fail **and** operator mail fail | Nothing persisted | 502 `DELIVERY_FAILED` |
| F3a receipt fail | GitHub or F1b OK; receipt throws | Delivery already done | 200; log receipt failure |
| Unauthed / rate limit | No session / over bucket | No delivery | 401 `UNAUTHENTICATED` / 429 `RATE_LIMITED` |
| No league | Never visited; not on a league route | League omitted | N/A |
| Missing GitHub env | Token or repo unset | Same as F1b | Operator mail also impossible → 500 `CONFIG_ERROR` |

</frozen-after-approval>

## Code Map

- `src/components/layout/UserNavMenu.tsx` -- Desktop account menu
- `src/components/layout/MobileBottomNav.tsx` -- Mobile More (including `/home`)
- `src/components/league/LeagueNavShell.tsx` -- Both menus; lift dialog open state
- `src/lib/league/record-league-visit.ts` -- `lastVisitedAt` for last-viewed league
- `src/app/api/profile/avatar/route.ts` / `src/lib/avatar.ts` -- CSRF + sniff + 5MB Blob `put` (reuse; `reports/` prefix; no crop)
- `src/lib/email/templates/EmailLayout.tsx` / `send-with-retry.ts` -- Receipt chrome + send
- `src/lib/cookie-session-mutation-csrf.ts` -- Origin check
- `src/proxy.ts` / `src/lib/rate-limit.ts` -- Copy avatar dedicated-bucket matcher
- `.env.example` / `docs/deployment.md` -- New server env vars

## Tasks & Acceptance

**Execution:**
- [x] `.env.example` + `docs/deployment.md` -- `GITHUB_TOKEN` (issues:write), `GITHUB_REPORTS_REPO`, `REPORTS_OPERATOR_EMAIL`
- [x] `src/lib/reports/visit-trail.ts` -- Last-15 pathname ring + sessionStorage; tests
- [x] `src/components/layout/VisitTrailTracker.tsx` -- `usePathname` recorder in `LeagueNavShell`
- [x] `src/lib/reports/resolve-report-league.ts` -- Path league if member, else latest `lastVisitedAt`; tests
- [x] `src/lib/reports/build-issue-markdown.ts` -- Title + labeled body; tests
- [x] `src/lib/integrations/github/create-issue.ts` -- `POST /repos/{repo}/issues`; throw on non-2xx; no labels
- [x] `src/lib/reports/submit-user-report.ts` -- Blob → GitHub → F1b mail → best-effort receipt; tests for Happy / Empty / F2b / F1b / total fail / F3a
- [x] `src/lib/email/templates/ReportReceiptEmail.tsx` + `ReportFallbackEmail.tsx` + `src/lib/email/send-report-emails.ts` -- Layout chrome; fallback **must** say GitHub is down; `sendWithRetry`
- [x] `src/app/api/reports/route.ts` -- POST multipart: CSRF, `auth()`, description Zod, optional file
- [x] `src/lib/rate-limit.ts` + `src/proxy.ts` -- `checkReportsRateLimit` (10 / 15 min); `/api/reports` matcher
- [x] `src/components/feedback/ReportProblemDialog.tsx` -- Description + optional file; success including screenshot-omitted; 502 retry
- [x] `UserNavMenu.tsx` + `MobileBottomNav.tsx` + `LeagueNavShell.tsx` -- Item second-last, immediately above Log out; `onClick` opens dialog

**Acceptance Criteria:**
- Given an authenticated user on desktop, when they open the account menu, then **Report a problem** is immediately above **Log out** and opens a dialog without navigating away.
- Given an authenticated user on mobile (including `/home`), when they open **More**, then the same item is immediately above **Log out** and opens the same dialog.
- Given a non-empty description and working GitHub, when they submit, then a GitHub issue includes identity, league (or omitted), visit trail, and device fields, and the user gets a Pick Six receipt that does not promise a reply.
- Given GitHub is unavailable and operator mail succeeds, when they submit, then Kyle’s email is unmistakably a GitHub outage, and the user still gets a receipt and success.
- Given Blob upload fails with a screenshot, when they submit, then delivery still happens and the UI says the screenshot was not attached.
- Given only the receipt send fails after GitHub or F1b succeeded, when the response returns, then the user sees success.
- Given empty description, when they submit, then client and API block send.

## Spec Change Log

## Design Notes

Issue markdown sections: Description, optional `![screenshot](blobUrl)`, User (`id`, name, email), League (`id` + name or `(none)`), Visit trail (oldest first), Device (`userAgent`, `WxH`, `mobile`|`desktop`). Title: `[User report] ` + first 70 chars of trimmed description.

Order is fixed: optional Blob, GitHub, operator fallback **only** if GitHub failed, receipt last and best-effort.

## Verification

**Commands:**
- `npm test -- src/lib/reports` -- expected: all pass
- `npx tsc --noEmit` -- expected: clean

**Manual checks (if no CLI):**
- Logged-in: More + account menu open the dialog; submit creates a GitHub issue; inbox gets a receipt.
- Break `GITHUB_TOKEN`: submit still succeeds; operator mail says the issue was not opened.
- Unauthenticated `POST /api/reports` returns 401.

## Suggested Review Order

**Delivery orchestration**

- Degrade order: Blob, GitHub, operator fallback only if GitHub failed, receipt last.
  [`submit-user-report.ts:77`](../../src/lib/reports/submit-user-report.ts#L77)

- GitHub Issues API with a 15s abort; no labels.
  [`create-issue.ts:17`](../../src/lib/integrations/github/create-issue.ts#L17)

- Fallback subject must say GitHub is down; stable Resend idempotency key.
  [`send-report-emails.ts:51`](../../src/lib/email/send-report-emails.ts#L51)

**API surface**

- CSRF then session, then multipart parse; identity never from the client.
  [`route.ts:55`](../../src/app/api/reports/route.ts#L55)

- Merge current pathname onto the visit trail so first-paint reports still locate.
  [`route.ts:139`](../../src/app/api/reports/route.ts#L139)

- Dedicated 10/15 min reports bucket in the request proxy.
  [`proxy.ts:109`](../../src/proxy.ts#L109)

**In-app entry**

- Dialog owned by the shell; More and account menu only open it.
  [`LeagueNavShell.tsx:123`](../../src/components/league/LeagueNavShell.tsx#L123)

- Desktop item is second-last, immediately above Log out.
  [`UserNavMenu.tsx:134`](../../src/components/layout/UserNavMenu.tsx#L134)

- Same placement in mobile More, including `/home`.
  [`MobileBottomNav.tsx:215`](../../src/components/layout/MobileBottomNav.tsx#L215)

- In-flight guard plus fetch catch so a hung/failed POST is visible.
  [`ReportProblemDialog.tsx:56`](../../src/components/feedback/ReportProblemDialog.tsx#L56)

**Context payload**

- Issue markdown: description, identity, league, trail, device, optional Blob image.
  [`build-issue-markdown.ts:45`](../../src/lib/reports/build-issue-markdown.ts#L45)

- Path league if member, else latest `lastVisitedAt`.
  [`resolve-report-league.ts:15`](../../src/lib/reports/resolve-report-league.ts#L15)

**Peripherals**

- Orchestrator matrix tests (empty, F1b, F2b, F3a, total fail).
  [`submit-user-report.test.ts:33`](../../src/lib/reports/submit-user-report.test.ts#L33)

- Server env: token, `owner/repo`, operator inbox; public repo accepted.
  [`.env.example:69`](../../.env.example#L69)

