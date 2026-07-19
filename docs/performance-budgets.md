# Performance budgets (NFR1–NFR3, NFR5)

Lab measurements for Pick Six primary routes. Companion to [deployment.md](./deployment.md).

## Measurement method (reproducible)

| Setting | Value |
|---------|--------|
| Date | 2026-07-12 |
| App | `npm run build` then `npm run start` (local production server on `127.0.0.1:3010`) |
| Tool | [Lighthouse](https://github.com/GoogleChrome/lighthouse) **12.8.2** CLI |
| Modes | **Mobile** (`--form-factor=mobile`, simulated throttling) and **Desktop** (`--preset=desktop`, simulated throttling) |
| Chrome | Headless (`--headless --no-sandbox --disable-gpu`) |
| Scope | Performance category only |

```bash
npm run build
npm run start -- -p 3010

npx lighthouse@12.8.2 http://127.0.0.1:3010/login \
  --only-categories=performance --form-factor=mobile \
  --throttling-method=simulate --chrome-flags="--headless --no-sandbox --disable-gpu"

npx lighthouse@12.8.2 http://127.0.0.1:3010/login \
  --only-categories=performance --preset=desktop \
  --throttling-method=simulate --chrome-flags="--headless --no-sandbox --disable-gpu"
```

**Authenticated routes (picks / standings):** Sign in first (seed user `dev@example.com` / `devpassword123` after `npm run db:seed`), then run the same Lighthouse commands against `/leagues/<leagueId>/picks` and `/leagues/<leagueId>/standings`. Unauthenticated runs redirect to `/login` and are **not** a valid stand-in for those pages.

**Lab vs field:** Simulated mobile throttling is conservative vs a good local Wi‑Fi phone. Vercel cold starts and Neon wake can add latency in production — see exceptions below.

---

## Budgets vs results

| Metric | Target (PRD) | Routes | Lab result (this run) |
|--------|--------------|--------|------------------------|
| Initial page load (≈ LCP) | ≤ **3s** (**NFR1**) | Login, league picks, league standings | **Login mobile LCP 2.34s** ✅ · Login desktop LCP **0.67s** ✅ · Picks/standings: authenticated Lighthouse run not completed this pass — see Known exceptions |
| Subsequent navigation | ≤ **1s** (**NFR2**) | Client nav between league tabs (picks ↔ standings ↔ home) | Soft RSC navigation after shell load; spot-check with Chrome DevTools Performance (Interaction → next paint). Expected **≪ 1s** once JS/CSS cached — no full document reload |
| TTI | ≤ **4s** (**NFR3**) | Same primary workflows | **Login mobile TTI 3.36s** ✅ · Login desktop TTI **0.67s** ✅ |

### Login — Lighthouse 12.8.2 detail (local `start`)

| Form factor | Perf score | FCP | LCP | TTI | TBT | Speed Index |
|-------------|------------|-----|-----|-----|-----|-------------|
| Mobile (simulated) | 97 | 0.77s | **2.34s** | **3.36s** | 138ms | 0.77s |
| Desktop (simulated) | 100 | 0.21s | **0.67s** | **0.67s** | 0ms | 0.21s |

Server TTFB for `GET /login` (curl `time_starttransfer`, warm local): ~**19ms** (excludes WAN).

---

## State-changing flows — NFR5 (≤ 1s at server/UI boundary)

**Method:** Prefer structured `logEvent` with `domain: "api"` and `context.durationMs` (excludes client WAN). Fallback: Chrome DevTools Network timing for the same requests.

| Flow | Where timed | How to read |
|------|-------------|-------------|
| **Login** | Credentials `authorize` in `src/lib/auth.ts` | Log: `action: "login"`, `context.durationMs` — covers DB user lookup + bcrypt compare (server boundary) |
| **Pick submit** | `POST /api/leagues/[leagueId]/picks` | Log: `action: "pick_submit"`, `context.durationMs` — covers CSRF/auth/membership + Prisma transaction |

**Measured samples (2026-07-19, local `npm run start` on port 3010, real Neon DB, seed user `dev@example.com`):**

| Flow | Sample | `durationMs` |
|------|--------|--------------|
| Login (`authorize`) | 1st request (cold Neon connection) | **2096ms** ⚠️ exceeds 1s |
| Login (`authorize`) | 2nd request (warm connection) | **727ms** ✅ |
| Pick submit | — | not captured this pass (see note below) |

**Note — pick submit not captured:** All seed leagues in this dev environment are pre-season (`preSeasonInitializedAt` is `null`), so a real `POST` returns `SEASON_NOT_READY` before reaching the pick-save transaction — not a representative sample of the full mutation. Getting a genuine sample requires an initialized season (`pre-season-init`) in a real or rehearsal league; deferred to when Epic 8 rehearsal mode or a live season is available rather than mutating this dev league's state for a one-off timing check.

**Cold-start exception (NFR5):** The first `authorize()` call after idle exceeded the 1s target (2096ms) — almost entirely a cold Neon connection-pool handshake (bcrypt cost factor is constant across both samples). This is the same class of cold-start latency already called out in Known Exceptions below; warm requests (727ms) are within budget. No code fix applied — first-request-after-idle latency is a Neon/Vercel cold-start characteristic, not a regression in this story's code.

Reproduce: sign in or submit a pick while watching Vercel/local logs for the JSON `durationMs` field.

---

## Known exceptions

| Exception | Rationale |
|-----------|-----------|
| **Vercel / Neon cold start** | First request after idle can exceed lab LCP on Hobby; subsequent warm requests should track lab. Not CDN caching — accepted for MVP ~14 users. |
| **Picks SSR + weather** | First render may call OpenWeatherMap for outdoor games; Story 7.4 adds a **10-minute in-memory TTL** so Sunday traffic does not re-hit the API every navigation. Cold miss can still add up to ~3s provider timeout (fail-soft → null). |
| **Large local logo set** | NFL logos are local `next/image` assets — fine for MVP; first visit may pay decode cost already reflected in LCP. |
| **Unauthenticated Lighthouse on picks/standings** | Redirects to login — do not treat as picks/standings budget evidence. |
| **Authenticated picks/standings Lighthouse accepted as unmeasured for now** | The 2026-07-19 code-review re-measure pass captured real login `durationMs` samples (see NFR5 above) but stopped short of an authenticated Lighthouse run against picks/standings — doing so needs a live session cookie handed to the Lighthouse CLI. Accepted as a known exception rather than have an automated pass do further credential handling; run the method documented above against `/leagues/<leagueId>/picks` and `/leagues/<leagueId>/standings` whenever this is next revisited (e.g. before first real season). |
| **Pick-submit NFR5 sample accepted as unmeasured for now** | Every seed league in this dev environment is pre-season (`preSeasonInitializedAt` is `null`), so a real `POST` returns `SEASON_NOT_READY` before reaching the pick-save transaction. Accepted as a known exception rather than activate a dev league's season for a one-off timing check; re-measure once a real or rehearsal season is active. |

Empty preferred when budgets are met on warm, authenticated runs. Re-check picks/standings LCP/TTI after sign-in before first real season.

---

## Out of scope (by design)

- No inventing CDN/edge caching or websockets for live scores (PRD: fresh fetches + manual refresh).
- No paid RUM product required for MVP; this doc + optional Vercel Analytics later.
