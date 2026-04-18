/**
 * Sliding-window rate limits keyed by **namespace + client** (see `rateLimitClientKey` in `src/proxy.ts`).
 *
 * - **Sign-in** (NFR12): 10 attempts / 15 minutes per namespace `sign-in`.
 * - **League delete** (FR61): 5 DELETEs / 15 minutes per namespace `league-delete` — stricter cap for
 *   irreversible destructive actions; enforced only on `DELETE /api/leagues/[leagueId]` (no subpath).
 *
 * **Production / multi-instance:** In-memory store is per instance only. For horizontal scale, use a
 * shared store (e.g. Upstash Redis + `@upstash/ratelimit`) and wire env vars; document until then.
 */

const SIGN_IN_WINDOW_MS = 15 * 60 * 1000;
const SIGN_IN_MAX_ATTEMPTS = 10;

const LEAGUE_DELETE_WINDOW_MS = 15 * 60 * 1000;
const LEAGUE_DELETE_MAX_ATTEMPTS = 5;

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

/** `DELETE /api/leagues/[leagueId]` only (proxy matcher); separate bucket from sign-in. */
export function checkLeagueDeleteRateLimit(clientKey: string): boolean {
  return checkSlidingWindow(
    "league-delete",
    clientKey,
    LEAGUE_DELETE_MAX_ATTEMPTS,
    LEAGUE_DELETE_WINDOW_MS,
  );
}
