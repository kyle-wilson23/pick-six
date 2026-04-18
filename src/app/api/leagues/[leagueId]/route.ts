/**
 * DELETE `/api/leagues/[leagueId]` — permanently delete a league (FR61, Story 2.8).
 *
 * - **CSRF / same-origin:** `assertCookieSessionMutationOrigin` before `auth()` (NFR15); no body on DELETE.
 * - **Response:** **204 No Content** on success (empty body).
 * - **Idempotency:** second delete (or unknown id) returns **404** `LEAGUE_NOT_FOUND`, not 500.
 * - **Rate limiting:** `src/proxy.ts` applies a stricter sliding window to **DELETE** on this path
 *   (5 / 15 min per client key — see `checkLeagueDeleteRateLimit`); same JSON **429** shape as other limits.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { assertCookieSessionMutationOrigin } from "@/lib/cookie-session-mutation-csrf";
import { prisma } from "@/lib/db";
import { authorizeLeagueDelete } from "@/lib/league/delete-league-authorization";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ leagueId: string }> },
) {
  const forbidden = assertCookieSessionMutationOrigin(request);
  if (forbidden) {
    return forbidden;
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 },
    );
  }

  const { leagueId } = await context.params;

  const [league, membership] = await Promise.all([
    prisma.league.findUnique({ where: { id: leagueId }, select: { id: true } }),
    prisma.leagueMembership.findUnique({
      where: {
        userId_leagueId: { userId: session.user.id, leagueId },
      },
    }),
  ]);

  const decision = authorizeLeagueDelete({
    leagueExists: league !== null,
    membership,
  });

  if (decision.outcome === "league_not_found") {
    return NextResponse.json(
      { error: { code: "LEAGUE_NOT_FOUND", message: "League not found" } },
      { status: 404 },
    );
  }

  if (decision.outcome === "forbidden") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Admin access required for this league" } },
      { status: 403 },
    );
  }

  try {
    const deleted = await prisma.league.deleteMany({ where: { id: leagueId } });
    if (deleted.count === 0) {
      return NextResponse.json(
        { error: { code: "LEAGUE_NOT_FOUND", message: "League not found" } },
        { status: 404 },
      );
    }
  } catch (e) {
    console.error("DELETE /api/leagues/[leagueId] failed", e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 },
    );
  }

  console.info(
    JSON.stringify({
      action: "league_deleted",
      leagueId,
      actorUserId: session.user.id,
      timestamp: new Date().toISOString(),
    }),
  );

  return new NextResponse(null, { status: 204 });
}
