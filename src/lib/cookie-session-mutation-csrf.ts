/**
 * CSRF baseline (NFR15) for cookie-backed sessions in this app:
 *
 * - **Auth.js** (`/api/auth/*`): rely on Auth.js CSRF for applicable auth routes (see Auth.js docs).
 * - **Server Actions**: Next.js applies built-in protections for Actions invoked from the framework.
 * - **Custom Route Handlers** that mutate state with the session cookie: prefer this module’s
 *   `assertCookieSessionMutationOrigin`, or validate a CSRF token from
 *   `GET /api/auth/csrf` per Auth.js if you need non-Action POST from raw `fetch`.
 *
 * Pick **one** pattern per handler; do not mix inconsistently within a single route.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * For custom POST/PUT/PATCH/DELETE Route Handlers: verify the request likely came from this app.
 *
 * - If **`Origin`** is present and not the literal `"null"`, it must equal the request URL’s origin
 *   (strict). Browsers send `Origin: null` for privacy-stripped navigations (e.g. `form` +
 *   `rel="noreferrer"` + `target="_blank"`); treat that as missing and fall through.
 * - Else if **`Referer`** is present, its origin must match (strict).
 * - Else if **`Sec-Fetch-Site`** is `same-origin` or `same-site`, allow — some same-site navigations
 *   omit `Origin`/`Referer` on POST; `same-site` is broader than same-origin (Schemeful Same Site).
 *   If you host **untrusted** subdomains that can drive credentialed requests to this API, prefer
 *   **`GET /api/auth/csrf`** validation instead of relying on this fallback alone.
 */
export function assertCookieSessionMutationOrigin(request: NextRequest): NextResponse | null {
  if (!MUTATING.has(request.method)) {
    return null;
  }

  const expectedOrigin = request.nextUrl.origin;
  const origin = request.headers.get("origin");
  if (origin && origin !== "null") {
    if (origin !== expectedOrigin) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Invalid origin" } },
        { status: 403 },
      );
    }
    return null;
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      if (new URL(referer).origin !== expectedOrigin) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "Invalid referer" } },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Invalid referer" } },
        { status: 403 },
      );
    }
    return null;
  }

  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite === "same-origin" || secFetchSite === "same-site") {
    return null;
  }

  return NextResponse.json(
    { error: { code: "FORBIDDEN", message: "Missing origin verification" } },
    { status: 403 },
  );
}
