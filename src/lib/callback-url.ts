/**
 * Safe post-login redirect targets. Rejects open redirects (e.g. protocol-relative
 * URLs, external absolute URLs) and `/login` loops.
 */

const LOGIN_PATH = "/login";

function isLoginPathname(pathname: string): boolean {
  return pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`);
}

/**
 * Returns a path (+ optional query) safe for `router.push` / `redirect` after auth.
 * - Allows same-origin absolute URLs when `sameOrigin` is set (e.g. `window.location.origin` on the client).
 * - Allows path-only URLs starting with a single `/` (not `//`).
 */
export function getSafeCallbackPath(
  raw: string | null | undefined,
  options?: { defaultPath?: string; sameOrigin?: string },
): string {
  const defaultPath = options?.defaultPath ?? "/";
  if (raw == null) {
    return defaultPath;
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return defaultPath;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    return defaultPath;
  }
  if (decoded.length > 2048) {
    return defaultPath;
  }

  const sameOrigin = options?.sameOrigin;

  // Absolute URL with scheme
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(decoded)) {
    try {
      const u = new URL(decoded);
      if (!sameOrigin) {
        return defaultPath;
      }
      if (u.origin !== new URL(sameOrigin).origin) {
        return defaultPath;
      }
      if (isLoginPathname(u.pathname)) {
        return defaultPath;
      }
      return `${u.pathname}${u.search}`;
    } catch {
      return defaultPath;
    }
  }

  // Path-only
  if (decoded.startsWith("/") && !decoded.startsWith("//")) {
    try {
      const u = new URL(decoded, "https://local.invalid");
      if (isLoginPathname(u.pathname)) {
        return defaultPath;
      }
      return `${u.pathname}${u.search}`;
    } catch {
      return defaultPath;
    }
  }

  return defaultPath;
}

/** Builds `/login?callbackUrl=…` using a validated path (e.g. from `x-pathname`). */
export function buildLoginRedirectWithCallback(requestPath: string): string {
  const safe = getSafeCallbackPath(requestPath, { defaultPath: "/dashboard" });
  return `/login?callbackUrl=${encodeURIComponent(safe)}`;
}
