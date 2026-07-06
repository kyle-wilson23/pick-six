# Local Email Flow Smoke Test Runbook

Manual verification of Epic 6 email flows in **local development** before Epic 7 observability work begins. This runbook supports story `pre-epic-7-manual-email-flow-smoke-test`.

**Scope:** Local dev only (`localhost:3000`). Production deploy, domain verification, and Vercel cron are tracked separately in `deferred-work.md` § [Pre-production go-live: Vercel operational checklist](../_bmad-output/implementation-artifacts/deferred-work.md#pre-production-go-live-vercel-operational-checklist-epic-6--operational-not-code) and sprint-status `post-epic-8-*`.

**Provider reference:** [email-provider-decision.md](./email-provider-decision.md)

---

## Prerequisites

### Environment variables (`.env.local`)

Copy from `.env.example` and set at minimum:

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` / `DIRECT_URL` | Yes | Postgres (Neon or local Docker) |
| `AUTH_SECRET` | Yes | Session signing |
| `AUTH_URL` | Yes | **`http://localhost:3000`** — email deep links must point here during smoke test |
| `RESEND_API_KEY` | Yes | Resend API key from [resend.com](https://resend.com/) → API Keys |
| `RESEND_FROM` | Recommended | **`Pick Six <onboarding@resend.dev>`** for sandbox sends without a verified domain |
| `CRON_SECRET` | For AC7 curl | Generate: `openssl rand -hex 32` |

Example local block:

```bash
AUTH_URL="http://localhost:3000"
RESEND_API_KEY="re_xxxxxxxx"
RESEND_FROM="Pick Six <onboarding@resend.dev>"
CRON_SECRET="your-local-cron-secret"
```

When `RESEND_FROM` is **unset**, senders fall back to `Pick Six <noreply@yourdomain.com>` (production placeholder — **will fail** on Resend free tier without domain verification). Always set `RESEND_FROM` for local smoke tests.

### Resend sandbox constraints (free tier, no verified domain)

- **Sender:** Use `Pick Six <onboarding@resend.dev>` via `RESEND_FROM`.
- **Recipients:** Only the **email on your Resend account** or addresses on a **verified domain**. For smoke test, invite members using your Resend account email.
- **Limits:** 100 emails/day, 3,000/month. Keep the test league small (≤6 members × 4 email types per full cycle ≈ 24 sends).

See [email-provider-decision.md](./email-provider-decision.md) § Free tier limits.

### Dev server

```bash
npm install
npm run db:migrate    # or db:migrate:deploy if DB already exists
npm run db:seed       # creates dev@example.com seed user
npm run dev           # http://localhost:3000
```

**Seed login:** `dev@example.com` / `devpassword123` (from `prisma/seed.cjs`). Seed does **not** create a league — create one in the UI (steps below).

---

## Test league setup

### 1. Create a league

1. Sign in as `dev@example.com`.
2. Navigate to create-league flow (dashboard → create league).
3. Name it e.g. **Email Smoke Test League** and complete creation.

### 2. Pre-season initialization (Story 2.3)

1. Open `/leagues/{leagueId}/admin`.
2. Run **pre-season initialization** (required before email controls appear).
3. Confirm admin email section is **not** showing "No active week for email".

**Troubleshooting:** Email controls require `preSeasonInitializedAt != null` and a resolvable active week via `resolvePicksWeekNumber`. Seed provides Week 1 games for the current `nflSeasonYear`.

### 3. Add members with deliverable emails

1. As league admin, invite at least one participant using **your Resend account email** (the inbox you can check).
2. Complete signup via the invite link (or use a second browser/incognito for the invited user).
3. Optionally invite 1–2 more addresses you control — stay under the 100/day cap.

### 4. Prepare reminder test state

Before Wed/Thu reminder tests, ensure **at least one member has NOT submitted a pick** for the active week. Leave one account without a pick; others may submit picks normally.

**Jailed team (optional):** Tuesday digest shows a placeholder if no `NflWeekJailedTeam` row exists for the week — acceptable for smoke test. Run admin jailed computation first if you want full template content.

---

## Flow checklists

Record pass/fail in `_bmad-output/implementation-artifacts/pre-epic-7-smoke-test-results.md`.

### AC3 — Invitation email (Story 6.1)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Admin invites participant (Resend-account email) | Invite succeeds in UI |
| 2 | Check inbox | Email arrives with league name + signup CTA |
| 3 | Open signup link | If **no account** for that email: signup form. If **account already exists** (common when smoke-testing with your Resend login email): page shows **Sign in to accept** or **Join {league}** when already signed in |
| 4 | Complete join | New user: submit password → auto sign-in. Existing user: sign in → **Join {league}** (consumes invite + adds membership) |
| 5 | Resend dashboard | Delivery logged with message ID |
| 6 | Terminal / server logs | `[email] invitation sent` with `to` and `leagueName` |

### AC4 — Tuesday digest preview and send (Story 6.2)

**Route:** `/leagues/{leagueId}/admin` → Email section (`AdminEmailComposer`)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Click **Preview** | New tab opens rendered HTML: standings, jailed team (or placeholder), picks CTA, optional admin note |
| 2 | (Optional) Save admin note | Persists via PUT `/api/leagues/{id}/email/tuesday-config` |
| 3 | Click **Send Now** | Each member receives digest; UI shows **Sent at [timestamp]** |
| 4 | DB / API | `league_week_email_configs.sentAt` set for active week |
| 5 | Resend dashboard | One message per member |
| 6 | Server logs | `[email] tuesday digest sent` with `sent` / `failed` counts |
| 7 | Click **Send Now** again (no force) | API **409** `ALREADY_SENT`; UI shows force-resend message |

**Force resend (optional):** Admin send with `?force=true` bypasses idempotency — use only if re-testing delivery.

### AC5 — Wednesday and Thursday reminders (Story 6.3)

**Route:** Same admin page → `AdminReminderControls`

| Step | Action | Expected |
|------|--------|----------|
| 1 | Confirm ≥1 outstanding pick | Reminder buttons enabled |
| 2 | **Send Wednesday Reminder** | Only outstanding members receive email; personalized copy per recipient |
| 3 | UI / DB | `wednesdayReminderSentAt` recorded |
| 4 | **Send Thursday Reminder** (outstanding still exist) | Only outstanding members receive final reminder |
| 5 | UI / DB | `thursdayReminderSentAt` recorded |
| 6 | All members submit picks | Buttons disabled; message **All members have submitted picks** |
| 7 | Server logs | `[email] wednesday reminder sent` / `[email] thursday reminder sent` |

**Note:** Refresh the admin page before reminder tests if pick status changed in another session (stale `outstandingCount` is a known deferred item).

### AC6 — Email deep links (Story 6.4)

Pick URL format in emails: `{AUTH_URL}/leagues/{leagueId}/picks`

| Step | Action | Expected |
|------|--------|----------|
| 1 | Copy picks link from any sent email | URL uses `http://localhost:3000/...` |
| 2 | Open while **signed in** | Lands directly on picks page (no login form) |
| 3 | Open in **incognito** / signed out | Redirect to `/login?callbackUrl=...`; after login → picks page |
| 4 | (Optional) Mobile spot-check | Tap-to-picks under ~90 seconds (NFR7) |

### AC7 — Cron routes (Story 6.5) — curl smoke

Cron routes mirror admin send logic but are gated by Eastern time windows. For local smoke, verifying **401 without secret** and **200 + outside_window with secret** is sufficient. Full in-window send verification can use admin **Send Now** (same underlying `sendTuesdayDigest` / `sendReminder` functions).

**Windows (Eastern Time):**

| Route | Window |
|-------|--------|
| `/api/cron/tuesday-email` | Tue 17:00–21:00 |
| `/api/cron/wednesday-reminder` | Wed 19:00–24:00 |
| `/api/cron/thursday-reminder` | Thu 19:00–24:00 |

Export secret (do not commit):

```bash
export CRON_SECRET="your-local-cron-secret"
export BASE="http://localhost:3000"
```

**Expect 401 — no Authorization header:**

```bash
curl -s "$BASE/api/cron/tuesday-email" | jq
curl -s "$BASE/api/cron/wednesday-reminder" | jq
curl -s "$BASE/api/cron/thursday-reminder" | jq
# Expected: { "error": { "code": "UNAUTHORIZED", ... } } with HTTP 401
```

**Expect 200 + outside_window — with Bearer token (most hours):**

```bash
curl -s "$BASE/api/cron/tuesday-email" \
  -H "Authorization: Bearer $CRON_SECRET" | jq

curl -s "$BASE/api/cron/wednesday-reminder" \
  -H "Authorization: Bearer $CRON_SECRET" | jq

curl -s "$BASE/api/cron/thursday-reminder" \
  -H "Authorization: Bearer $CRON_SECRET" | jq
# Expected (outside window): { "status": "skipped", "reason": "outside_window" }
```

**In-window send (optional):** Run the matching curl during the correct ET window. Response should include counters such as `{ processed, sent, skipped*, failed }`. Server logs use `[cron]` prefix.

**Equivalence note:** Admin manual sends exercise the same send functions as cron; cron adds league iteration + window guards + `CRON_SECRET` auth.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Email not delivered; Resend error about domain | Wrong `from` | Set `RESEND_FROM=Pick Six <onboarding@resend.dev>` |
| Resend rejects recipient | Sandbox restriction | Send only to Resend account email or verified domain |
| Daily send cap hit | Free tier 100/day | Wait 24h or reduce test league size |
| Admin shows "No active week for email" | Pre-season not initialized | Run pre-season init on admin dashboard |
| Tuesday send 409 `ALREADY_SENT` | Idempotency guard | Expected on re-send; use force only if intentional |
| Cron 401 with secret set | Wrong/missing `CRON_SECRET` | Match `.env.local` value; restart dev server after env change |
| Cron `outside_window` | Outside ET schedule | Expected; admin send is primary verification path |
| Deep links go to wrong host | `AUTH_URL` unset/wrong | Set `AUTH_URL=http://localhost:3000`; restart dev server |
| `[email] ... send failed` in logs | API key, rate limit, or invalid `from`/`to` | Check Resend dashboard + server log error payload |

---

## API reference (admin email routes)

| Flow | Method | Route |
|------|--------|-------|
| Tuesday config | GET/PUT | `/api/leagues/[leagueId]/email/tuesday-config` |
| Tuesday preview | GET | `/api/leagues/[leagueId]/email/tuesday-preview` |
| Tuesday send | POST | `/api/leagues/[leagueId]/email/tuesday-send` |
| Wednesday reminder | POST | `/api/leagues/[leagueId]/email/wednesday-reminder` |
| Thursday reminder | POST | `/api/leagues/[leagueId]/email/thursday-reminder` |

Mutating admin routes require admin role + CSRF (handled by the admin UI).

---

## Quality gates (before marking story done)

```bash
npm test
npm run lint
```

All tests must pass (333+ baseline). Record results in `pre-epic-7-smoke-test-results.md` and mark sprint-status `pre-epic-7-manual-email-flow-smoke-test: done` only when **every AC3–AC7 checklist row passes**.

---

## Related docs

- [email-provider-decision.md](./email-provider-decision.md) — Resend setup, SDK, cron strategy
- [deferred-work.md § Pre-production go-live](../_bmad-output/implementation-artifacts/deferred-work.md#pre-production-go-live-vercel-operational-checklist-epic-6--operational-not-code) — production-only steps (Vercel env, domain verification, production cron)
