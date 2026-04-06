import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { checkSignInRateLimit } from "@/lib/rate-limit";

export function proxy(request: NextRequest) {
  if (request.method !== "POST") {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;
  if (pathname !== "/api/auth/callback/credentials") {
    return NextResponse.next();
  }

  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (!checkSignInRateLimit(ip)) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests" } },
      { status: 429 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/auth/callback/credentials"],
};
