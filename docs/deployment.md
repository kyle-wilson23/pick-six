# Deployment, backups, and critical windows

Canonical production ops guide for Pick Six (Vercel + Neon). Replaces the go-live checklist formerly maintained only in `_bmad-output/implementation-artifacts/deferred-work.md`.

Related: [performance budgets](./performance-budgets.md), [observability ops runbook](./observability-ops-runbook.md), [`.env.example`](../.env.example).

---

## Hosting (NFR53)

| Layer | Choice |
|-------|--------|
| App | **Vercel** (Hobby when eligible) |
| Database | **Neon** Postgres (Free tier for MVP) |
| Email | **Resend** |
| ORM / migrations | **Prisma** via `npm run db:migrate:deploy` |

Secrets are **server-only**. Never put `CRON_SECRET`, `AUTH_SECRET`, API keys, or DB URLs in `NEXT_PUBLIC_*` or client components. Full variable list: [`.env.example`](../.env.example).

---

## Production environment variables

Set in Vercel → **Settings → Environment Variables → Production**. Vercel injects env vars into a function only at build/deploy time, not live into already-running instances — **redeploy after any change** (including `CRON_SECRET`) so the new value actually takes effect.

| Variable | Purpose | Generate / source |
|----------|---------|-------------------|
| `DATABASE_URL` | Pooled Postgres (Neon `-pooler` host) | Neon dashboard → Connect |
| `DIRECT_URL` | Direct Postgres for migrations | Neon dashboard → Connect (non-pooler) |
| `AUTH_SECRET` | Session signing | `openssl rand -base64 32` |
| `AUTH_URL` | Absolute site URL for Auth.js callbacks (post–Epic 9: product hostname from [domain-provider-decision.md](./domain-provider-decision.md) — dual-use web + email domain) | `https://your-app.vercel.app` until custom domain attach |
| `RESEND_API_KEY` | Transactional email | [Resend dashboard](https://resend.com/) → API Keys |
| `RESEND_WEBHOOK_SECRET` | Webhook signature verification | Resend → Webhooks |
| `CRON_SECRET` | Cron route auth (`Authorization: Bearer …`) | `openssl rand -hex 32` — **no trailing newlines** |
| `ODDS_API_KEY` | NFL schedule sync, results sync, odds snapshots | [The Odds API](https://the-odds-api.com/) |
| `GITHUB_TOKEN` | Create user-report GitHub issues (`issues:write`) | GitHub → Settings → Developer settings → PAT |
| `GITHUB_REPORTS_REPO` | `owner/repo` for report issues (public is acceptable) | Existing reports repo |
| `REPORTS_OPERATOR_EMAIL` | Kyle’s inbox when GitHub is down (fallback mail) | Your operator email |

If an older deploy still has `API_SPORTS_KEY` / `API_SPORTS_HOST` in Vercel, remove them — the app no longer reads those variables.

Optional: `WEATHER_API_KEY`, `ODDS_SNAPSHOT_SECRET`, `RESEND_FROM` (local smoke / verified domain override), `ALLOW_TEST_LEAGUES` (ops toggle: unset/`true`/`1` allow test-league creation; `false`/`0` deny — not a secret), `TEST_LEAGUE_EMAIL_MODE` (rehearsal email policy: unset/`send` sends real emails to invited testers with `[TEST]` labeling; `suppress` skips Resend and surfaces would-send in admin UI — not a secret). Set `TEST_LEAGUE_EMAIL_MODE=suppress` on any shared staging/rehearsal deploy where others might create test leagues during ad-hoc dry runs; leave unset for your own controlled rehearsal with real testers. Production cron **never** sends for rehearsal leagues — only admin manual send buttons on `/leagues/[leagueId]/admin`. For the full rehearsal walkthrough (create → invite → simulate weeks → delete), see [rehearsal-runbook.md](./rehearsal-runbook.md).

Cross-check [`.env.example`](../.env.example) whenever this table drifts.

---

## Build and migrate

```bash
npm run build
npm run start   # local prod-like smoke after build
```

**Schema on production / CI** — always use the npm script so `.env` / `.env.local` load via `scripts/prisma-env.cjs`:

```bash
npm run db:migrate:deploy
```

Do **not** run bare `npx prisma migrate deploy` in production workflows (misses `.env.local` loading and `DIRECT_URL` defaults).

Apply migrations **before or as part of** the first deploy that depends on new schema.

**NFL teams after first migrate:** schema alone does not insert the 32 teams. For rehearsal / test-league fixture odds (`Apply odds snapshot`), Production needs:

```bash
# Point DATABASE_URL at Production (Vercel / Neon), then:
npm run db:seed:teams
```

Do **not** run full `npm run db:seed` against Production — that upserts the local-only `dev@example.com` bootstrap user and example invites.

---

## Cron deploy smoke (NFR19–NFR21 adjacent)

Confirm `vercel.json` crons are on the **production** deployment (Vercel → Settings → Cron Jobs). Crons do **not** run on preview branches.

Routes (Hobby: **one cron fire per UTC calendar day**):

| Path | UTC schedule | Eastern window (handler gate) | Purpose |
|------|--------------|-------------------------------|---------|
| `/api/cron/sync-nfl-schedule` | `0 15 * * 1` (Mon) | Mon 10–16 ET | Odds `/events` → canonical `NflGame` |
| `/api/cron/tuesday-email` | `0 23 * * 2` (Tue) | Tue 17–21 ET | Tuesday digest |
| `/api/cron/sync-nfl-results` | `0 16 * * 3` (Wed) | Wed 11–17 ET | Odds `/scores` → finalize scores |
| `/api/cron/wednesday-reminder` | `0 1 * * 4` (Thu UTC) | Wed 19–24 ET | Wednesday reminder |
| `/api/cron/thursday-reminder` | `0 0 * * 5` (Fri UTC) | Thu 17–21 ET | Thursday reminder |

Each handler exports `maxDuration = 300` (Hobby ceiling). Vercel Cron invokes via **GET**; handlers also accept **POST**. Same `Authorization: Bearer $CRON_SECRET` for both. Odds sync crons also need Production `ODDS_API_KEY`.

**Odds `/scores` 3-day lookback:** The results cron uses The Odds API `daysFrom=3`. A missed Wednesday run can leave completed games unfinalized once they fall outside that window — use admin **`POST /api/admin/nfl/sync-results`** (or league admin UI) as override before the lookback slides past. Schedule sync override: **`POST /api/admin/nfl/sync-schedule`**.

```bash
# Expect 401
curl -s https://your-app.vercel.app/api/cron/tuesday-email | jq

# Expect 200 + outside_window (unless inside Eastern window) or send summary
# Expect HTTP 500 when summary has failed > 0 (partial/provider failure)
curl -s -o /tmp/cron.json -w "%{http_code}\n" \
  https://your-app.vercel.app/api/cron/tuesday-email \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
cat /tmp/cron.json | jq

# Odds schedule / results (same auth; outside_window unless Mon/Wed ET windows)
curl -s -o /tmp/cron-schedule.json -w "%{http_code}\n" \
  https://your-app.vercel.app/api/cron/sync-nfl-schedule \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
curl -s -o /tmp/cron-results.json -w "%{http_code}\n" \
  https://your-app.vercel.app/api/cron/sync-nfl-results \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Repeat email smoke for Wednesday and Thursday reminder paths.

### External uptime monitor (ops setup)

Point a free checker (e.g. [cron-job.org](https://cron-job.org/), Better Stack free) at a cron URL with header `Authorization: Bearer $CRON_SECRET`.

| Response | Meaning |
|----------|---------|
| **401** | Missing/wrong secret — misconfigured monitor or env |
| **200** | Success (`failed === 0`) or intentional `outside_window` skip |
| **500** | Job ran but `failed > 0` — alert; check Vercel logs + admin weekly email card |

Schedule the check inside or near the Eastern send window if you want failure alerts; off-window 200 + `outside_window` is normal. This is **ops configuration**, not app code that calls a paid APM.

---

## Critical windows — no planned deploys (NFR21 / NFR51)

| Window (America/New_York) | Why |
|---------------------------|-----|
| **Mon 10 AM–4 PM ET** | Odds schedule sync cron window |
| **Tue 5–7 PM ET** | Tuesday digest / standings reveal window |
| **Wed 11 AM–5 PM ET** | Odds results sync cron window (`daysFrom=3`) |
| **Thu 7–9 PM ET** | Thursday reminder / late-week pick pressure |

**Do not** schedule maintenance or deploys in those windows. Prefer off-season or between games. Mid-season hotfixes are OK **outside** those windows.

---

## Backups (NFR49)

MVP strategy is **automated + restorable**, not custom S3 pipelines:

1. **Neon point-in-time restore (PITR) / history** on the production root branch — primary restore path. Free-tier history windows are **short** (check current Neon Free limits in the dashboard; they change). If the window is too short for season ops, upgrade the Neon plan or add off-platform copies.
2. **Manual Neon snapshot** before risky migrations, season start, or destructive schema work (Free: limited manual snapshots — use deliberately).
3. **Admin CSV export** (Story 7.1) — operational escape hatch for league data; **complements** DB restore, does **not** replace it.
4. **Optional off-platform `pg_dump` / GitHub Action** — recommended before the first real season if Free PITR history is insufficient. Not required to automate in-app for MVP.

---

## Reversible migrations (NFR52)

Prisma is **forward-deploy oriented** — there is no automatic `migrate down`.

Team practice:

- Prefer **expand/contract**: additive columns → dual-write/read → remove old columns in a later migration.
- Before destructive migrate: take a Neon **snapshot**, and when possible run `npm run db:migrate:deploy` against a branch/preview DB first.
- **Rollback** = Neon snapshot / PITR restore, **or** ship a follow-up forward migration that repairs data/schema. Do not claim Prisma reverses migrations automatically.

---

## Email / Resend go-live (post–Epic 9 handoff)

Domain verification, production `from` address replacement, and full production inbox smoke remain **ops stories after Epic 9** — do not treat them as complete when this doc ships.

**Dual-use domain (Story 9.2 — decided):** One product domain serves as both the **public app URL** (Vercel custom domain + `AUTH_URL`) and the **Resend sending-domain** foundation (SPF/DKIM + `RESEND_FROM`). Registrar/DNS: **Cloudflare Registrar + Cloudflare DNS** (fresh purchase). See [`docs/domain-provider-decision.md`](./domain-provider-decision.md) for hostname plan (app host + mail send subdomain) and next DNS steps (web → email → smoke). Email provider remains Resend ([`email-provider-decision.md`](./email-provider-decision.md)).

**Forgot-password (Story 9.3 — implemented):** Password reset mail is sent via the same Resend + React Email stack as invites and digests (no second provider). Reset links use `AUTH_URL` / `getAppBaseUrl()`. Production domain verify and `RESEND_FROM` cutover remain **post–Epic 9** — local smoke may use `onboarding@resend.dev` per [`email-local-smoke-test-runbook.md`](./email-local-smoke-test-runbook.md).

**Self-serve create-account (pre-launch):** Real test-users register at `/create-account` (linked from login). No admin user-creation is required for pre-season hands-on testing. The seed user (`dev@example.com` via `npm run db:seed`) remains **local bootstrap only** for empty databases. League membership still requires an admin invite (`/signup/[token]`).

**Execution is still post–Epic 9** (do not mark these done from the investigation alone):

- `post-epic-9-vercel-production-env-and-cron` — Vercel custom domain + Production `AUTH_URL` (+ env/cron)
- `post-epic-9-resend-domain-and-from-address` — SPF/DKIM + replace placeholder `from` (depends on Story 9.2 decision doc)
- `post-epic-9-production-smoke-test` — real inbox invite + digest + reminders

Track status in [`sprint-status.yaml`](../_bmad-output/implementation-artifacts/sprint-status.yaml). See also Epic 8 retrospective (`epic-8-retro-2026-07-28.md`) for why the gate moved from post–Epic 8 to post–Epic 9.

---

## Pre-production checklist (summary)

- [ ] Epic 9 launch blockers done (scoring isolation, forgot-password, domain decision, carryovers, UI polish)
- [ ] Production env vars set (table above); never `NEXT_PUBLIC_*` for secrets
- [ ] `npm run db:migrate:deploy` against production URLs when schema changed
- [ ] `vercel.json` crons visible on production; `CRON_SECRET` set; redeployed
- [ ] Cron smoke: 401 without secret; 200 / expected window body with secret
- [ ] Neon snapshot before season start (and before risky migrates)
- [ ] External monitor pointed at cron URL with Bearer secret (optional but recommended)
- [ ] Resend domain / `from` / inbox smoke — complete via **post-epic-9-*** items
- [ ] Avoid deploys in Tue 5–7 PM ET and Thu 7–9 PM ET

Success: Epic 9 complete + env + migrate + cron smoke + (when post-epic-9 done) real inbox delivery confirmed.
