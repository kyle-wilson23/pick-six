/**
 * GET `/api/leagues/[leagueId]/admin/jailed-verification` — jailed team computation audit (Story 4.4).
 *
 * Read-only; no CSRF. Admin league membership required. No pick data exposed (NFR17).
 */

import { LeagueMembershipRole } from "@prisma/client";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getJailedVerification } from "@/lib/admin/get-jailed-verification";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ leagueId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 },
    );
  }

  const { leagueId } = await context.params;

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  });

  if (!membership) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Admin access required for this league" } },
      { status: 403 },
    );
  }

  if (membership.role !== LeagueMembershipRole.ADMIN) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Admin access required for this league" } },
      { status: 403 },
    );
  }

  try {
    const verification = await getJailedVerification({ leagueId });
    if (verification === null) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "No jailed team computed for the current week",
          },
        },
        { status: 404 },
      );
    }
    return NextResponse.json({ verification });
  } catch (e) {
    console.error("GET /api/leagues/[leagueId]/admin/jailed-verification failed", e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
