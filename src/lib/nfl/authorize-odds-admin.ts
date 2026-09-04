import { LeagueMembershipRole } from "@prisma/client";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isSuperuserEmail } from "@/lib/auth/is-superuser";
import { prisma } from "@/lib/db";

export type NflOddsOpsAuthDecision = "allow" | "unauthenticated" | "forbidden";

/** Pure gate used by {@link assertAuthorizedForNflOddsOps}. */
export function resolveNflOddsOpsAuthorization(args: {
  bearerAuthorized: boolean;
  userId: string | undefined;
  isSuperuser: boolean;
  hasAnyLeagueAdminMembership: boolean;
}): NflOddsOpsAuthDecision {
  if (args.bearerAuthorized) {
    return "allow";
  }
  if (!args.userId) {
    return "unauthenticated";
  }
  if (args.isSuperuser || args.hasAnyLeagueAdminMembership) {
    return "allow";
  }
  return "forbidden";
}

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
  const bearerAuthorized = Boolean(secret && authHeader === `Bearer ${secret}`);

  let isSuperuser = false;
  let hasAnyLeagueAdminMembership = false;
  if (!bearerAuthorized && userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    isSuperuser = isSuperuserEmail(user?.email);
    if (!isSuperuser) {
      const anyAdmin = await prisma.leagueMembership.findFirst({
        where: { userId, role: LeagueMembershipRole.ADMIN },
        select: { id: true },
      });
      hasAnyLeagueAdminMembership = Boolean(anyAdmin);
    }
  }

  const decision = resolveNflOddsOpsAuthorization({
    bearerAuthorized,
    userId,
    isSuperuser,
    hasAnyLeagueAdminMembership,
  });
  if (decision === "allow") {
    return null;
  }
  if (decision === "unauthenticated") {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 },
    );
  }
  return NextResponse.json(
    { error: { code: "FORBIDDEN", message: "League admin access required" } },
    { status: 403 },
  );
}
