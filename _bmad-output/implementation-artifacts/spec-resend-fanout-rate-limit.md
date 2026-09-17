---
title: 'Throttle Resend fan-out and retry per-second 429s'
type: 'bugfix'
created: '2026-09-16'
status: 'done'
baseline_commit: 'e05510c0eb206c24884e82f02f51ba9f9cc146ad'
context:
  - '{project-root}/docs/project-context.md'
  - '{project-root}/docs/email-provider-decision.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A 15-recipient commissioner note (2026 AFM Pickem, 2026-09-16 17:44Z) accepted 10 Resend sends and 429'd the last 5 in 92ms. Resend's default cap is **10 API requests/second** with no burst. `EMAIL_SEND_CONCURRENCY = 4` is enough to exceed that. `sendWithRetry` treats **any** `statusCode === 429` as daily-quota exhaustion, does not retry, and the circuit opens after three consecutive failures. The account had only ~17 sends that day — not a daily cap.

**Approach:** Two layers in the shared send stack. (1) Classify 429s: retry `rate_limit_exceeded` and unlabeled 429s with existing exponential backoff; short-circuit only named daily/monthly quota errors. (2) Space fan-out `emails.send` starts at **≤8/s** so a 15-person send does not 429 in the first place. Keep concurrency at 4. Do **not** switch to Resend's batch API.

## Boundaries & Constraints

**Always:**
- Fix `sendWithRetry` + `mapWithConcurrency`; wire the spacing option into every existing fan-out caller (admin note, Tuesday digest, reminders, invitations). Single-recipient sends (invite one, password reset, bug-report) stay unchanged aside from inheriting smarter 429 retry.
- Quota 429 names that must **not** retry: `daily_quota_exceeded`, `monthly_quota_exceeded`. Log `EMAIL_DAILY_CAP` only for those.
- Rate-limit 429: `name === "rate_limit_exceeded"` **or** `statusCode === 429` without a quota name. Log `send_retry_failed` and retry (default 3 retries, 1s / 2s / 4s). If the error object has numeric `retryAfter` (seconds), wait `max(retryAfter*1000, computedBackoff)`.
- Spacing: export `EMAIL_SEND_MIN_INTERVAL_MS = 125` (8 starts/s). Shared start-slot across workers in one `mapWithConcurrency` call. Pass it from the four fan-out callers. Keep `EMAIL_SEND_CONCURRENCY = 4`.
- Circuit breaker unchanged: it only sees failures **after** `sendWithRetry` throws. A rate-limit 429 that later succeeds must not increment the breaker.
- Colocated tests; `npm test`.

**Ask First:**
- Resend batch API, lowering concurrency, or requesting a higher Resend rate limit.

**Never:**
- Treat unlabeled/bare 429 as daily cap.
- Change proxy/app `RATE_LIMITED` buckets, admin UI, templates, or idempotency key format.
- Sleep between **completed** sends only (must gate **starts**, or 4 workers still burst).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 15-member admin note | All Resend sends succeed under 8/s | 15 sent, 0 failed; no `EMAIL_DAILY_CAP` | N/A |
| Per-second 429 | `{ statusCode: 429, name: "rate_limit_exceeded" }` | Retry with backoff; success does not trip circuit | Log `send_retry_failed` per attempt |
| Unlabeled 429 | `{ statusCode: 429 }` no quota name | Same as rate-limit retry | Same |
| Daily quota | `{ statusCode: 429, name: "daily_quota_exceeded" }` | No retry; throw immediately | `EMAIL_DAILY_CAP`; caller records failure |
| Monthly quota | `name: "monthly_quota_exceeded"` | Same as daily quota | `EMAIL_DAILY_CAP` |
| Transient non-429 | Network / 5xx | Existing retry unchanged | Existing |
| Rate-limit then success | 429 then OK inside `sendWithRetry` | Member counts as sent; breaker success | No `member_send_failed` |
| Persistent rate-limit | 429 until retries exhaust | Member failed; consecutive failure toward circuit | Existing abort after 3 **exhausted** failures |

</frozen-after-approval>

## Code Map

- `src/lib/email/send-with-retry.ts` (+ `send-with-retry.test.ts`) -- Today every 429 short-circuits
- `src/lib/email/email-send-error.ts` (+ `email-send-error.test.ts`) -- Add quota vs rate-limit classifiers here (Resend plain-object shape)
- `src/lib/email/map-with-concurrency.ts` (+ `map-with-concurrency.test.ts`) -- Add shared `minIntervalMs` start gating
- `src/lib/email/send-admin-note.ts` -- Fan-out; production incident path
- `src/lib/email/send-tuesday-digest.ts` / `send-reminder.ts` -- Same pool
- `src/app/api/leagues/[leagueId]/invitations/route.ts` -- Same `mapWithConcurrency`
- `src/lib/email/circuit-breaker.ts` -- Do not retune threshold; retry layer must hide recovered 429s

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/email/email-send-error.ts` (+ test) -- `isQuotaExceededError` / `isRateLimitError` (or equivalent) from `statusCode` + `name`
- [x] `src/lib/email/send-with-retry.ts` (+ test) -- Quota: no retry + `EMAIL_DAILY_CAP`. Rate-limit / unlabeled 429: retry like other transients. Optional `retryAfter` seconds. Keep 3 retries / 1s base.
- [x] `src/lib/email/map-with-concurrency.ts` (+ test) -- Optional `minIntervalMs`; serialize start slots so N items need ≥ `(N-1) * minIntervalMs` wall time even at concurrency 4. Export `EMAIL_SEND_MIN_INTERVAL_MS = 125`. Keep concurrency 4.
- [x] Fan-out callers -- Pass `{ shouldAbort, minIntervalMs: EMAIL_SEND_MIN_INTERVAL_MS }` (invites: minInterval only) in `send-admin-note.ts`, `send-tuesday-digest.ts`, `send-reminder.ts`, `invitations/route.ts`

**Acceptance Criteria:**
- Given Resend `{ statusCode: 429, name: "rate_limit_exceeded" }`, when `sendWithRetry` runs, then it retries with backoff and does not log `EMAIL_DAILY_CAP`.
- Given `{ statusCode: 429 }` with no quota `name`, when `sendWithRetry` runs, then it retries the same way.
- Given `{ statusCode: 429, name: "daily_quota_exceeded" }` (or `monthly_quota_exceeded`), when `sendWithRetry` runs, then it throws on the first attempt and logs `EMAIL_DAILY_CAP`.
- Given a rate-limit 429 that succeeds on retry, when a fan-out sender is running, then that member is `sent` and the circuit breaker does not increment.
- Given 15 members and concurrency 4 with `minIntervalMs: 125`, when fan-out starts, then send **starts** are ≥125ms apart (≤8/s).
- Given existing digest/reminder circuit tests (hard provider errors), when they run, then abort-after-3 behavior is unchanged.

## Spec Change Log

## Design Notes

Production misclassified per-second 429s as daily cap (`send-with-retry.ts` `isDailyCapError` = any 429). Resend uses 429 for both `rate_limit_exceeded` (10 req/s) and quota names. Spacing is the preventative; retry is the safety net if a window still clips.

Do not implement batch send in this change — it would change idempotency and per-recipient errors.

## Verification

**Commands:**
- `npm test` -- new classifier / retry / spacing tests pass; digest/reminder/admin-note/invitation tests still pass

**Manual checks (if no CLI):**
- Not required. 15-person AFM send is the production scenario; unit tests above cover it without hitting Resend.

## Suggested Review Order

**429 classification and retry**

- Named quota vs per-second 429 split lives here
  [`email-send-error.ts:17`](../../src/lib/email/email-send-error.ts#L17)

- Unlabeled 429s retry; only quota names short-circuit
  [`send-with-retry.ts:54`](../../src/lib/email/send-with-retry.ts#L54)

- Numeric `retryAfter` seconds vs exponential backoff
  [`send-with-retry.ts:78`](../../src/lib/email/send-with-retry.ts#L78)

**Fan-out start spacing**

- Shared start-slot gate so four workers cannot burst
  [`map-with-concurrency.ts:26`](../../src/lib/email/map-with-concurrency.ts#L26)

- 125ms = 8 starts/s; concurrency stays 4
  [`map-with-concurrency.ts:74`](../../src/lib/email/map-with-concurrency.ts#L74)

**Callers**

- Production incident path: abort + spacing
  [`send-admin-note.ts:196`](../../src/lib/email/send-admin-note.ts#L196)

- Same options on digest and reminder
  [`send-tuesday-digest.ts:206`](../../src/lib/email/send-tuesday-digest.ts#L206)
  [`send-reminder.ts:212`](../../src/lib/email/send-reminder.ts#L212)

- Invites: spacing only, no circuit abort
  [`route.ts:171`](../../src/app/api/leagues/[leagueId]/invitations/route.ts#L171)

**Tests**

- Classifier, retry, spacing, recovered 429
  [`email-send-error.test.ts:35`](../../src/lib/email/email-send-error.test.ts#L35)
  [`send-with-retry.test.ts:56`](../../src/lib/email/send-with-retry.test.ts#L56)
  [`map-with-concurrency.test.ts:59`](../../src/lib/email/map-with-concurrency.test.ts#L59)
  [`send-admin-note.test.ts:307`](../../src/lib/email/send-admin-note.test.ts#L307)
