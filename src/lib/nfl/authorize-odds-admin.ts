import { LeagueMembershipRole } from "@prisma/client";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/db";

/**
 * Returns true if the request carries the `ODDS_SNAPSHOT_SECRET` bearer token
 * (automation/cron callers). Used by admin NFL + scoring route handlers.
 */
export function isOddsAutomationRequest(request: NextRequest): boolean {
  const secret = process.env.ODDS_SNAPSHOT_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Global NFL admin routes (**odds** Story 3.2, **schedule sync** Story 3.9): only **league admins**
 * (any league) or **`Authorization: Bearer ODDS_SNAPSHOT_SECRET`** (automation) (NFR16 pattern).
 */
export async function assertAuthorizedForNflOddsOps(
  request: NextRequest,
  userId: string | undefined,
): Promise<NextResponse | null> {
  const secret = process.env.ODDS_SNAPSHOT_SECRET?.trim();
  const authHeader = request.headers.get("authorization");
  if (secret && authHeader === `Bearer ${secret}`) {
    return null;
  }

  if (!userId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 },
    );
  }

  const anyAdmin = await prisma.leagueMembership.findFirst({
    where: { userId, role: LeagueMembershipRole.ADMIN },
    select: { id: true },
  });

  if (!anyAdmin) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "League admin access required" } },
      { status: 403 },
    );
  }

  return null;
}
