/**
 * POST `/api/leagues/[leagueId]/simulation/apply-odds-snapshot` — apply fixture odds + jailed
 * for a test league's current simulated week (Story 8.3).
 *
 * - **CSRF / same-origin:** body parsed first, then `assertCookieSessionMutationOrigin`, then `auth()` (NFR15),
 *   matching `pre-season-init` / `advance-week`.
 * - **Idempotency-in-effect:** safe to click repeatedly for the same week — no optimistic-lock guard;
 *   AC1 determinism reproduces the same lines/jailed result (extra `OddsSnapshotRun` history rows only).
 * - **Rate limiting:** intentionally **not** added to `src/proxy.ts` `shouldRateLimitPost` — admin-gated,
 *   low abuse surface, same documented exception as `advance-week` / `first-competition-week` PATCH.
 */

import { LeagueMembershipRole } from "@prisma/client";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { assertCookieSessionMutationOrigin } from "@/lib/cookie-session-mutation-csrf";
import { prisma } from "@/lib/db";
import { resolveCurrentSeasonForLeague } from "@/lib/league/resolve-current-season";
import { applySimulationOddsSnapshot } from "@/lib/nfl/apply-simulation-odds-snapshot";

async function readJsonObject(request: NextRequest): Promise<{ ok: true; value: unknown } | { ok: false }> {
  const text = await request.text();
  if (!text.trim()) {
    return { ok: true, value: {} };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ leagueId: string }> },
) {
  const bodyRead = await readJsonObject(request);
  if (!bodyRead.ok) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  // Empty `{}` is valid — no request fields required (targets current simulated week).
  if (
    typeof bodyRead.value !== "object" ||
    bodyRead.value === null ||
    Array.isArray(bodyRead.value)
  ) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Request body must be a JSON object" } },
      { status: 400 },
    );
  }

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

  const membership = await prisma.leagueMembership.findUnique({
    where: {
      userId_leagueId: { userId: session.user.id, leagueId },
    },
    include: {
      league: { select: { isTestLeague: true } },
    },
  });

  if (!membership || membership.role !== LeagueMembershipRole.ADMIN) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Admin access required for this league" } },
      { status: 403 },
    );
  }

  if (!membership.league.isTestLeague) {
    return NextResponse.json(
      {
        error: {
          code: "NOT_TEST_LEAGUE",
          message: "Applying fixture odds is only available for test / rehearsal leagues",
        },
      },
      { status: 403 },
    );
  }

  const season = await resolveCurrentSeasonForLeague(prisma.season, leagueId);
  if (!season) {
    return NextResponse.json(
      {
        error: {
          code: "SEASON_NOT_FOUND",
          message: "No season exists for this league and the current NFL season year",
        },
      },
      { status: 404 },
    );
  }

  if (season.simulatedCurrentWeek == null) {
    return NextResponse.json(
      {
        error: {
          code: "SIMULATION_NOT_STARTED",
          message: "Mark the league ready for season to start the simulation clock",
        },
      },
      { status: 409 },
    );
  }

  try {
    const result = await applySimulationOddsSnapshot(
      prisma,
      {
        nflSeasonYear: season.nflSeasonYear,
        weekNumber: season.simulatedCurrentWeek,
      },
      { via: "admin", userId: session.user.id },
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: { code: result.code, message: result.message } },
        { status: result.httpStatus },
      );
    }

    return NextResponse.json({
      nflSeasonYear: result.nflSeasonYear,
      weekNumber: result.weekNumber,
      gamesInWeek: result.gamesInWeek,
      oddsSnapshotRunId: result.oddsSnapshotRunId,
      jailedTeamId: result.jailedTeamId,
      jailedTeamAbbreviation: result.jailedTeamAbbreviation,
      resolvedBy: result.resolvedBy,
    });
  } catch (e) {
    console.error("POST /api/leagues/[leagueId]/simulation/apply-odds-snapshot failed", e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
