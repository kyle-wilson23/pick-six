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
]);

export function proxy(request: NextRequest) {
  if (request.method !== "POST") {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;
  if (!RATE_LIMITED_POST_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  if (!checkSignInRateLimit(rateLimitClientKey(request))) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests" } },
      { status: 429 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/auth/callback/credentials", "/api/signup/invite"],
};
