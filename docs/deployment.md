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

Set in Vercel → **Settings → Environment Variables → Production**. Redeploy after any change (vars are available at runtime; cron/`CRON_SECRET` changes require a redeploy so production picks them up).

| Variable | Purpose | Generate / source |
|----------|---------|-------------------|
| `DATABASE_URL` | Pooled Postgres (Neon `-pooler` host) | Neon dashboard → Connect |
| `DIRECT_URL` | Direct Postgres for migrations | Neon dashboard → Connect (non-pooler) |
| `AUTH_SECRET` | Session signing | `openssl rand -base64 32` |
| `AUTH_URL` | Absolute site URL for Auth.js callbacks | `https://your-app.vercel.app` |
| `RESEND_API_KEY` | Transactional email | [Resend dashboard](https://resend.com/) → API Keys |
| `RESEND_WEBHOOK_SECRET` | Webhook signature verification | Resend → Webhooks |
| `CRON_SECRET` | Cron route auth (`Authorization: Bearer …`) | `openssl rand -hex 32` — **no trailing newlines** |
| `ODDS_API_KEY` | Odds snapshots | [The Odds API](https://the-odds-api.com/) |
| `API_SPORTS_KEY` | NFL schedule sync | [API-Sports](https://api-sports.io/) |

Optional: `WEATHER_API_KEY`, `ODDS_SNAPSHOT_SECRET`, `RESEND_FROM` (local smoke / verified domain override), `API_SPORTS_HOST`.

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

---

## Cron deploy smoke (NFR19–NFR21 adjacent)

Confirm `vercel.json` crons are on the **production** deployment (Vercel → Settings → Cron Jobs). Crons do **not** run on preview branches.

Routes: `/api/cron/tuesday-email`, `/api/cron/wednesday-reminder`, `/api/cron/thursday-reminder`.

Each handler exports `maxDuration = 300` (Hobby ceiling). Vercel Cron invokes via **GET**; handlers also accept **POST**. Same `Authorization: Bearer $CRON_SECRET` for both.

```bash
# Expect 401
curl -s https://your-app.vercel.app/api/cron/tuesday-email | jq

# Expect 200 + outside_window (unless inside Eastern window) or send summary
# Expect HTTP 500 when summary has failed > 0 (partial/provider failure)
curl -s -o /tmp/cron.json -w "%{http_code}\n" \
  https://your-app.vercel.app/api/cron/tuesday-email \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
cat /tmp/cron.json | jq
```

Repeat for Wednesday and Thursday reminder paths.

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
| **Tue 5–7 PM ET** | Tuesday digest / standings reveal window |
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

## Email / Resend go-live (post–Epic 8 handoff)

Domain verification, production `from` address replacement, and full production inbox smoke remain **ops stories after Epic 8** — do not treat them as complete when this doc ships:

- `post-epic-8-vercel-production-env-and-cron` — apply Production env + confirm crons
- `post-epic-8-resend-domain-and-from-address` — SPF/DKIM + replace placeholder `from`
- `post-epic-8-production-smoke-test` — real inbox invite + digest + reminders

Track status in [`sprint-status.yaml`](../_bmad-output/implementation-artifacts/sprint-status.yaml).

---

## Pre-production checklist (summary)

- [ ] Production env vars set (table above); never `NEXT_PUBLIC_*` for secrets
- [ ] `npm run db:migrate:deploy` against production URLs when schema changed
- [ ] `vercel.json` crons visible on production; `CRON_SECRET` set; redeployed
- [ ] Cron smoke: 401 without secret; 200 / expected window body with secret
- [ ] Neon snapshot before season start (and before risky migrates)
- [ ] External monitor pointed at cron URL with Bearer secret (optional but recommended)
- [ ] Resend domain / `from` / inbox smoke — complete via **post-epic-8-*** items
- [ ] Avoid deploys in Tue 5–7 PM ET and Thu 7–9 PM ET

Success: env + migrate + cron smoke + (when post-epic-8 done) real inbox delivery confirmed.
