/**
 * GET `/api/leagues/[leagueId]/admin/submission-status` — admin pick submission dashboard (Story 4.1).
 *
 * Read-only; no CSRF. Admin league membership required.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { buildSubmissionStatus } from "@/lib/admin/build-submission-status";
import { auth } from "@/lib/auth";
import { forbiddenAdminJson, requireLeagueAdminAccess } from "@/lib/league/require-league-admin";

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

  const access = await requireLeagueAdminAccess(session.user.id, leagueId);
  if (!access) {
    return forbiddenAdminJson();
  }

  try {
    const payload = await buildSubmissionStatus({
      leagueId,
      viewerUserId: session.user.id,
    });
    return NextResponse.json(payload);
  } catch (e) {
    console.error("GET /api/leagues/[leagueId]/admin/submission-status failed", e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
