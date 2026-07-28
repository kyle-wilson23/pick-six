# Performance budgets (NFR1–NFR3, NFR5)

Lab measurements for Pick Six primary routes. Companion to [deployment.md](./deployment.md).

## Measurement method (reproducible)

| Setting | Value |
|---------|--------|
| Date | **2026-07-28** (authenticated picks/standings + pick-submit; login numbers retained from 2026-07-12 / 2026-07-19) |
| App | `npm run build` then `npm run start` (local production server on `127.0.0.1:3010` / `localhost:3010`) |
| Tool | [Lighthouse](https://github.com/GoogleChrome/lighthouse) **12.8.2** CLI |
| Modes | **Mobile** (`--form-factor=mobile`, simulated throttling) and **Desktop** (`--preset=desktop`, simulated throttling) |
| Chrome | Headless (`--headless --no-sandbox --disable-gpu`) |
| Scope | Performance category only |
| Auth | Session cookie after seed login (`dev@example.com` / `devpassword123`); passed via Lighthouse `--extra-headers` `Cookie` |

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

**Authenticated routes (picks / standings):** Sign in first (seed user `dev@example.com` / `devpassword123` after `npm run db:seed`), then run the same Lighthouse commands against `/leagues/<leagueId>/picks` and `/leagues/<leagueId>/standings` with a session `Cookie` header (Chrome user-data-dir after manual login, or Auth.js credentials callback → cookie jar). Unauthenticated runs redirect to `/login` and are **not** a valid stand-in for those pages.

**Lab vs field:** Simulated mobile throttling is conservative vs a good local Wi‑Fi phone. Vercel cold starts and Neon wake can add latency in production — see exceptions below.

---

## Budgets vs results

| Metric | Target (PRD) | Routes | Lab result (this run) |
|--------|--------------|--------|------------------------|
| Initial page load (≈ LCP) | ≤ **3s** (**NFR1**) | Login, league picks, league standings | **Login** mobile 2.34s ✅ / desktop 0.67s ✅ · **Picks** mobile **3.39s** ⚠️ / desktop 0.82s ✅ · **Standings** mobile **3.01s** ⚠️ / desktop 0.67s ✅ — see Known exceptions for mobile LCP |
| Subsequent navigation | ≤ **1s** (**NFR2**) | Client nav between league tabs (picks ↔ standings ↔ home) | Soft RSC navigation after shell load; spot-check with Chrome DevTools Performance (Interaction → next paint). Expected **≪ 1s** once JS/CSS cached — no full document reload |
| TTI | ≤ **4s** (**NFR3**) | Same primary workflows | **Login** mobile 3.36s ✅ / desktop 0.67s ✅ · **Picks** mobile 3.78s ✅ / desktop 0.82s ✅ · **Standings** mobile 3.12s ✅ / desktop 0.67s ✅ |

### Login — Lighthouse 12.8.2 detail (local `start`, 2026-07-12)

| Form factor | Perf score | FCP | LCP | TTI | TBT | Speed Index |
|-------------|------------|-----|-----|-----|-----|-------------|
| Mobile (simulated) | 97 | 0.77s | **2.34s** | **3.36s** | 138ms | 0.77s |
| Desktop (simulated) | 100 | 0.21s | **0.67s** | **0.67s** | 0ms | 0.21s |

Server TTFB for `GET /login` (curl `time_starttransfer`, warm local): ~**19ms** (excludes WAN).

### Picks — Lighthouse 12.8.2 detail (authenticated, local `start`, 2026-07-28)

League: Willy League (`/leagues/cmoz5x3rx0003pa9kd1qqvul6/picks`), seed admin session, warm route hit before lab run. Final URL confirmed **not** `/login`.

| Form factor | Perf score | FCP | LCP | TTI | TBT | Speed Index |
|-------------|------------|-----|-----|-----|-----|-------------|
| Mobile (simulated) | 91 | 0.93s | **3.39s** ⚠️ | **3.78s** ✅ | 79ms | 1.22s |
| Desktop (simulated) | 99 | 0.26s | **0.82s** ✅ | **0.82s** ✅ | 0ms | 0.41s |

### Standings — Lighthouse 12.8.2 detail (authenticated, local `start`, 2026-07-28)

Same league `/standings`, authenticated, warm. Final URL confirmed **not** `/login`.

| Form factor | Perf score | FCP | LCP | TTI | TBT | Speed Index |
|-------------|------------|-----|-----|-----|-----|-------------|
| Mobile (simulated) | 95 | 0.76s | **3.01s** ⚠️ | **3.12s** ✅ | 48ms | 0.76s |
| Desktop (simulated) | 100 | 0.21s | **0.67s** ✅ | **0.67s** ✅ | 0ms | 0.30s |

---

## State-changing flows — NFR5 (≤ 1s at server/UI boundary)

**Method:** Prefer structured `logEvent` with `domain: "api"` and `context.durationMs` (excludes client WAN). Fallback: Chrome DevTools Network timing for the same requests.

| Flow | Where timed | How to read |
|------|-------------|-------------|
| **Login** | Credentials `authorize` in `src/lib/auth.ts` | Log: `action: "login"`, `context.durationMs` — covers DB user lookup + bcrypt compare (server boundary) |
| **Pick submit** | `POST /api/leagues/[leagueId]/picks` | Log: `action: "pick_submit"`, `context.durationMs` — covers CSRF/auth/membership + Prisma transaction |

**Measured samples — login (2026-07-19, local `npm run start` on port 3010, real Neon DB, seed user `dev@example.com`):**

| Flow | Sample | `durationMs` |
|------|--------|--------------|
| Login (`authorize`) | 1st request (cold Neon connection) | **2096ms** ⚠️ exceeds 1s |
| Login (`authorize`) | 2nd request (warm connection) | **727ms** ✅ |

**Measured samples — pick submit (2026-07-28, local `npm run start` on port 3010, Willy League initialized season, week 1 still open, success path `message: "pick submit completed"`):**

| Flow | Sample | `durationMs` |
|------|--------|--------------|
| Pick submit | 1st successful save this session | **453ms** ✅ |
| Pick submit | 2nd successful save (warm) | **425ms** ✅ |

**Cold-start exception (NFR5):** The first `authorize()` call after idle exceeded the 1s target (2096ms) — almost entirely a cold Neon connection-pool handshake (bcrypt cost factor is constant across both samples). This is the same class of cold-start latency already called out in Known Exceptions below; warm requests (727ms) are within budget. Pick-submit warm samples (425–453ms) are within budget. No code fix applied — first-request-after-idle latency is a Neon/Vercel cold-start characteristic, not a regression in app code.

Reproduce: sign in or submit a pick while watching Vercel/local logs for the JSON `durationMs` field.

---

## Known exceptions

| Exception | Rationale |
|-----------|-----------|
| **Vercel / Neon cold start** | First request after idle can exceed lab LCP on Hobby; subsequent warm requests should track lab. Not CDN caching — accepted for MVP ~14 users. |
| **Picks SSR + weather** | First render may call OpenWeatherMap for outdoor games; Story 7.4 adds a **10-minute in-memory TTL** so Sunday traffic does not re-hit the API every navigation. Cold miss can still add up to ~3s provider timeout (fail-soft → null). |
| **Large local logo set** | NFL logos are local `next/image` assets — fine for MVP; first visit may pay decode cost already reflected in LCP. |
| **Unauthenticated Lighthouse on picks/standings** | Redirects to login — do not treat as picks/standings budget evidence. |
| ~~**Authenticated picks/standings Lighthouse accepted as unmeasured for now**~~ | **Resolved by Story 9.4 (2026-07-28)** — authenticated Lighthouse 12.8.2 recorded above. **Desktop** LCP/TTI meet NFR1/NFR3. **Mobile** TTI meets NFR3; **mobile LCP** is slightly over 3s (picks 3.39s, standings 3.01s) under simulated throttling. |
| **Mobile LCP slightly over NFR1 on picks/standings (Owner: Kyle)** | Re-accepted for first real season: lab mobile throttling is conservative; desktop and all TTI budgets pass; MVP ~14 users on warm paths. Revisit if field reports slow first paint on phones (Story 9.5 loading polish / weather cold-miss may help picks). |
| ~~**Pick-submit NFR5 sample accepted as unmeasured for now**~~ | **Resolved by Story 9.4 (2026-07-28)** — success-path samples 453ms / 425ms recorded above (warm Neon). |

Empty preferred when budgets are met on warm, authenticated runs.

---

## Out of scope (by design)

- No inventing CDN/edge caching or websockets for live scores (PRD: fresh fetches + manual refresh).
- No paid RUM product required for MVP; this doc + optional Vercel Analytics later.
