/**
 * GET `/api/leagues/[leagueId]/admin/audit-log` — admin override audit trail (Story 4.3).
 *
 * Read-only; no CSRF. Admin league membership required. No mutation endpoints for audit entries.
 */

import { LeagueMembershipRole } from "@prisma/client";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getAuditLog } from "@/lib/admin/get-audit-log";
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

  if (!membership || membership.role !== LeagueMembershipRole.ADMIN) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Admin role required" } },
      { status: 403 },
    );
  }

  try {
    const entries = await getAuditLog({ leagueId });
    return NextResponse.json({ entries });
  } catch (e) {
    console.error("GET /api/leagues/[leagueId]/admin/audit-log failed", e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
