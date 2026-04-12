import { createHash } from "node:crypto";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { checkSignInRateLimit } from "@/lib/rate-limit";

function rateLimitClientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const fromForwarded = forwarded?.split(",")[0]?.trim();
  if (fromForwarded) {
    return fromForwarded;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  if (cf) {
    return cf;
  }
  // Avoid a single global bucket when proxy headers are missing (common in local dev): partition by UA.
  const ua = request.headers.get("user-agent") ?? "";
  return `local:${createHash("sha256").update(ua).digest("hex").slice(0, 16)}`;
}

/** Same sliding window as credential sign-in (NFR12). */
const RATE_LIMITED_POST_PATHS = new Set([
  "/api/auth/callback/credentials",
  "/api/signup/invite",
  "/api/leagues",
]);

const LEAGUE_INVITATIONS_POST = /^\/api\/leagues\/[^/]+\/invitations\/?$/;

function shouldRateLimitPost(pathname: string): boolean {
  if (RATE_LIMITED_POST_PATHS.has(pathname)) {
    return true;
  }
  return LEAGUE_INVITATIONS_POST.test(pathname);
}

/**
 * Sets `x-pathname` for matched routes (see `config.matcher`). `src/app/(app)/layout.tsx`
 * uses it for post-login `callbackUrl`. When adding authenticated pages under `(app)` whose
 * URL is not under `/dashboard` or `/leagues`, extend `matcher` accordingly.
 */
export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  if (request.method === "POST" && shouldRateLimitPost(pathname)) {
    if (!checkSignInRateLimit(rateLimitClientKey(request))) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        { status: 429 },
      );
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/api/auth/callback/credentials",
    "/api/signup/invite",
    "/api/leagues",
    "/api/leagues/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/leagues",
    "/leagues/:path*",
  ],
};
