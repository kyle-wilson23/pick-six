# Observability ops runbook (Hybrid MVP)

Authoritative scope: [observability-scope-decision.md](./observability-scope-decision.md)

This runbook covers the **Hybrid observability MVP** shipped in Story 7.2: structured JSON logs, a read-only admin weekly email status card, manual ops spot-checks, and a log-only Resend webhook. It does **not** include automated paging or a general error log viewer.

## Structured logs (NFR45)

All email, cron, and webhook events emit **one JSON object per line** via `logEvent()` in `src/lib/logging/log-event.ts`. Vercel captures these in **Project → Logs**.

**Filter examples:**

| Goal | Vercel log search |
|------|-------------------|
| Cron job summaries | `"domain":"cron"` |
| Email send failures | `"domain":"email"` and `"level":"error"` |
| Outside-window skips (Hobby drift) | `"code":"CRON_OUTSIDE_WINDOW"` |
| Resend webhook events | `"domain":"webhook"` |

Each log line includes at minimum: `level`, `timestamp` (ISO 8601 UTC), `domain`, `message`. Cron routes also set `route` and `action`; failures may include `leagueId`, `weekNumber`, and `code`.

## Weekly spot-check (NFR47 + manual NFR46)

After each automation window, confirm sends succeeded per league:

| When | What to check |
|------|----------------|
| **Tue ~6 PM ET** | Admin card → Tuesday digest shows **Sent**; Vercel logs → `action:"job_complete"` for `/api/cron/tuesday-email` |
| **Wed evening (19:00–24:00 ET)** | Admin card → Wednesday reminder **Sent** or **Skipped** (all picks in); logs → `wednesday-reminder` job_complete |
| **Thu pre-deadline (~5–8 PM ET)** | Admin card → Thursday reminder **Sent** or **Skipped**; logs → `thursday-reminder` job_complete |

**Admin card location:** `/leagues/{leagueId}/admin` → right column → **Email automation status** (below Reminder Emails).

**If a row shows "Not sent" (warning):**

1. Check Vercel logs for `CRON_OUTSIDE_WINDOW` — Vercel Hobby cron can drift ±1 hour and skip the Eastern window entirely.
2. Use existing manual controls above the card: **Weekly Email** composer or **Reminder Emails** send buttons.
3. Check Resend dashboard for bounces/complaints if sends were attempted but members report non-delivery.

## NFR46 honest gap — no automated pager at MVP

Story 7.2 **does not** implement Slack, PagerDuty, or email-on-failure alerts. Operational response is:

- Kyle (deployer) spot-checks Vercel logs after cron windows during the season.
- League admins use the in-app status card for per-league confirmation.
- Resend dashboard covers bounce/complaint visibility without per-recipient admin UI.

**Resolved by Story 7.4:** non-200 cron responses when `failed > 0` (enables free external uptime monitors), Resend circuit breaker (`EMAIL_CIRCUIT_OPEN`), `maxDuration = 300` on cron routes. Scoring/deadline structured logging remains post-launch.

## Resend webhook setup (NFR32 log-only)

1. In [Resend dashboard → Webhooks](https://resend.com/docs/dashboard/webhooks/introduction), create an endpoint:
   - **URL:** `https://<your-vercel-domain>/api/webhooks/resend`
   - **Events:** at minimum `email.delivered`, `email.bounced`, `email.complained`
2. Copy the **signing secret** into Vercel env (Production + Preview):
   ```
   RESEND_WEBHOOK_SECRET="<signing secret from Resend>"
   ```
3. Redeploy after setting the secret.
4. Verified events appear in Vercel logs with `"domain":"webhook"`. **No admin UI** for per-recipient delivery status at MVP.

**Local dev:** webhook is optional. Without `RESEND_WEBHOOK_SECRET`, the route returns 500 if hit — acceptable for local-only work. Use ngrok or Resend CLI to test signature verification locally.

**Manual smoke (invalid signature → 401):**

```bash
curl -X POST http://localhost:3000/api/webhooks/resend \
  -H "Content-Type: application/json" \
  -H "svix-id: test" \
  -H "svix-timestamp: $(date +%s)" \
  -H "svix-signature: v1,invalid" \
  -d '{"type":"email.delivered","data":{}}'
```

Expected: `401` with `{ "error": { "code": "UNAUTHORIZED", ... } }`.

## Story 7.4 cron hardening (resolved)

| Item | Status |
|------|--------|
| Cron HTTP **500** when `failed > 0` | **Resolved by 7.4** — same JSON body; 200 for success / `outside_window` |
| Resend circuit breaker | **Resolved by 7.4** — after 3 consecutive provider failures, abort remaining; `code: EMAIL_CIRCUIT_OPEN` |
| `maxDuration = 300` on cron routes | **Resolved by 7.4** — route-segment export |
| External uptime monitor | **Documented** in [deployment.md](./deployment.md) — ops configures cron-job.org / Better Stack |
| Scoring / pick-deadline structured logging | Still **post-launch** |

## Related docs

- [observability-scope-decision.md](./observability-scope-decision.md) — binding scope record
- [email-provider-decision.md](./email-provider-decision.md) — Resend setup, cron drift context
- [email-local-smoke-test-runbook.md](./email-local-smoke-test-runbook.md) — Epic 6 manual email verification
