/**
 * Sliding-window rate limits keyed by **namespace + client** (see `rateLimitClientKey` in `src/proxy.ts`).
 *
 * - **Sign-in** (NFR12): 10 attempts / 15 minutes per namespace `sign-in`.
 * - **Password reset** (Story 9.3): 8 attempts / 15 minutes per namespace `password-reset` — dedicated
 *   bucket for forgot-password + reset-confirm POSTs (separate from sign-in).
 * - **Register** (pre-launch create-account): 6 attempts / 15 minutes per namespace `register` —
 *   dedicated bucket for `POST /api/auth/register` (within 5–8 band; separate from sign-in).
 * - **League delete** (FR61): 5 DELETEs / 15 minutes per namespace `league-delete` — stricter cap for
 *   irreversible destructive actions; enforced only on `DELETE /api/leagues/[leagueId]` (no subpath).
 * - **Avatar** upload/remove: 20 / 15 minutes per namespace `avatar` — `POST`/`DELETE` `/api/profile/avatar`.
 *
 * **Production / multi-instance:** In-memory store is per instance only. For horizontal scale, use a
 * shared store (e.g. Upstash Redis + `@upstash/ratelimit`) and wire env vars; document until then.
 */

const SIGN_IN_WINDOW_MS = 15 * 60 * 1000;
const SIGN_IN_MAX_ATTEMPTS = 10;

const PASSWORD_RESET_WINDOW_MS = 15 * 60 * 1000;
/** Story 9.3 — 8 / 15 min per client (within the 5–10 band; dedicated bucket, not sign-in). */
const PASSWORD_RESET_MAX_ATTEMPTS = 8;

const REGISTER_WINDOW_MS = 15 * 60 * 1000;
/** Pre-launch create-account — 6 / 15 min per client (dedicated bucket; within 5–8 band). */
const REGISTER_MAX_ATTEMPTS = 6;

const LEAGUE_DELETE_WINDOW_MS = 15 * 60 * 1000;
const LEAGUE_DELETE_MAX_ATTEMPTS = 5;

const AVATAR_WINDOW_MS = 15 * 60 * 1000;
/** Profile avatar upload/remove — 20 / 15 min per client. */
const AVATAR_MAX_ATTEMPTS = 20;

const buckets = new Map<string, number[]>();

function checkSlidingWindow(
  namespace: string,
  clientKey: string,
  maxAttempts: number,
  windowMs: number,
): boolean {
  const bucketKey = `${namespace}:${clientKey}`;
  const now = Date.now();
  const start = now - windowMs;
  const timestamps = (buckets.get(bucketKey) ?? []).filter((t) => t > start);
  if (timestamps.length >= maxAttempts) {
    return false;
  }
  timestamps.push(now);
  buckets.set(bucketKey, timestamps);
  return true;
}

export function checkSignInRateLimit(clientKey: string): boolean {
  return checkSlidingWindow(
    "sign-in",
    clientKey,
    SIGN_IN_MAX_ATTEMPTS,
    SIGN_IN_WINDOW_MS,
  );
}

/** `POST /api/auth/forgot-password` and `POST /api/auth/reset-password` (proxy matcher). */
export function checkPasswordResetRateLimit(clientKey: string): boolean {
  return checkSlidingWindow(
    "password-reset",
    clientKey,
    PASSWORD_RESET_MAX_ATTEMPTS,
    PASSWORD_RESET_WINDOW_MS,
  );
}

/** `POST /api/auth/register` (proxy matcher). */
export function checkRegisterRateLimit(clientKey: string): boolean {
  return checkSlidingWindow(
    "register",
    clientKey,
    REGISTER_MAX_ATTEMPTS,
    REGISTER_WINDOW_MS,
  );
}

/** `DELETE /api/leagues/[leagueId]` only (proxy matcher); separate bucket from sign-in. */
export function checkLeagueDeleteRateLimit(clientKey: string): boolean {
  return checkSlidingWindow(
    "league-delete",
    clientKey,
    LEAGUE_DELETE_MAX_ATTEMPTS,
    LEAGUE_DELETE_WINDOW_MS,
  );
}

/** `POST` / `DELETE` `/api/profile/avatar` (proxy matcher). */
export function checkAvatarRateLimit(clientKey: string): boolean {
  return checkSlidingWindow(
    "avatar",
    clientKey,
    AVATAR_MAX_ATTEMPTS,
    AVATAR_WINDOW_MS,
  );
}
