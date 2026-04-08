/**
 * Sign-in rate limit: **same client IP** (from `x-forwarded-for` / `x-real-ip`), sliding window.
 * Default: 10 POSTs per 15 minutes to `/api/auth/callback/credentials` and `/api/signup/invite` (NFR12).
 *
 * **Production / multi-instance:** This in-memory store is per instance only. For horizontal scale,
 * use a shared store (e.g. Upstash Redis + `@upstash/ratelimit`) and wire env vars; until then,
 * document the limitation in deployment notes. Enforced from `src/proxy.ts` (Next.js 16 `proxy`).
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

const buckets = new Map<string, number[]>();

export function checkSignInRateLimit(clientKey: string): boolean {
  const now = Date.now();
  const start = now - WINDOW_MS;
  const timestamps = (buckets.get(clientKey) ?? []).filter((t) => t > start);
  if (timestamps.length >= MAX_ATTEMPTS) {
    return false;
  }
  timestamps.push(now);
  buckets.set(clientKey, timestamps);
  return true;
}
