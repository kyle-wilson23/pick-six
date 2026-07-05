import crypto from "crypto";
import "server-only";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function assertCronRequest(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Cron secret not configured" } },
      { status: 401 },
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!authHeader.startsWith(prefix)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing cron secret" } },
      { status: 401 },
    );
  }

  const provided = authHeader.slice(prefix.length);
  const secretBuf = Buffer.from(secret);
  const providedBuf = Buffer.from(provided);

  if (secretBuf.length !== providedBuf.length) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing cron secret" } },
      { status: 401 },
    );
  }

  if (!crypto.timingSafeEqual(secretBuf, providedBuf)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing cron secret" } },
      { status: 401 },
    );
  }

  return null;
}
