/**
 * Rolling JWT session limits for Auth.js (Story 1.4, **FR10**).
 *
 * UX — rolling ~30-day activity-based timeout:
 * `_bmad-output/planning-artifacts/ux-design-specification.md` — **Session Management** (~lines 164–166),
 * **Section 6 — Rolling Activity-Based Sessions** (~lines 321–323).
 *
 * Auth.js `AuthConfig.session` — `maxAge` / `updateAge`:
 * https://authjs.dev/reference/core#session-2
 *
 * Semantics (JWT strategy, pinned `next-auth@5` / `@auth/core` — confirm in
 * `node_modules/@auth/core/src/lib/actions/session.ts` JWT vs database branches):
 * - **`maxAge`** — Seconds added to “now” when the session token is (re)issued. In the **JWT**
 *   branch, each session handling recomputes expiry with `fromDate(sessionMaxAge)` and re-encodes
 *   the token, so **active** use keeps the user signed in by sliding expiry forward (aligned with
 *   FR10 / UX week-to-week use). After **~`maxAge` of wall-clock time without a valid session**
 *   (e.g. cookie expired or JWT `exp` passed), the user must sign in again.
 * - **`updateAge`** — Minimum interval between **database** session row updates; the **database**
 *   branch uses it to throttle writes (see `sessionUpdateAge` in `session.ts`). The **JWT** branch
 *   does **not** read `updateAge`. We still set {@link SESSION_UPDATE_AGE_SECONDS} to Auth.js’s
 *   default (24h) for config parity and if the strategy ever switches.
 */
/** 30 days — exact value: 2,592,000 seconds */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** 24 hours — exact value: 86,400 seconds */
export const SESSION_UPDATE_AGE_SECONDS = 24 * 60 * 60;

/**
 * Effective `maxAge` for `NextAuth` config. Production always uses {@link SESSION_MAX_AGE_SECONDS}.
 * In development only, optional `SESSION_MAX_AGE_DEV_SECONDS` (see `.env.example`) can shorten the
 * window for stale-session testing without changing production behavior.
 */
export function getSessionMaxAgeSeconds(): number {
  if (process.env.NODE_ENV === "development") {
    const raw = process.env.SESSION_MAX_AGE_DEV_SECONDS;
    if (raw !== undefined && raw !== "") {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) {
        return Math.floor(n);
      }
    }
  }
  return SESSION_MAX_AGE_SECONDS;
}
