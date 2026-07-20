/**
 * POST `/api/leagues/[leagueId]/simulation/advance-week` — advance test-league simulation clock (Story 8.2).
 *
 * - **CSRF / same-origin:** body parsed first, then `assertCookieSessionMutationOrigin`, then `auth()` (NFR15),
 *   matching `pre-season-init`.
 * - **Idempotency:** conditional `updateMany` on `(id, simulatedCurrentWeek: fromWeek)` — stale/double-click
 *   clients get **409** `SIMULATION_WEEK_STALE`.
 * - **Rate limiting:** intentionally **not** added to `src/proxy.ts` `shouldRateLimitPost` — admin-gated,
 *   low abuse surface, same documented exception as `first-competition-week` PATCH.
 */

import { LeagueMembershipRole } from "@prisma/client";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { assertCookieSessionMutationOrigin } from "@/lib/cookie-session-mutation-csrf";
import { prisma } from "@/lib/db";
import { advanceSimulationWeekBodySchema } from "@/lib/league/advance-simulation-week-body";
import {
  finalSimulationWeek,
  isSimulationComplete,
} from "@/lib/league/simulation-week";
import { resolveCurrentSeasonForLeague } from "@/lib/league/resolve-current-season";

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

  const parsed = advanceSimulationWeekBodySchema.safeParse(bodyRead.value);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: first?.message ?? "Invalid request body",
        },
      },
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
  const { fromWeek } = parsed.data;

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
          message: "Simulation week advancement is only available for test / rehearsal leagues",
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

  if (season.simulationWeekCount == null) {
    return NextResponse.json(
      {
        error: {
          code: "SIMULATION_NOT_CONFIGURED",
          message: "This test league has no simulation week count configured",
        },
      },
      { status: 409 },
    );
  }

  if (
    isSimulationComplete({
      firstCompetitionWeek: season.firstCompetitionWeek,
      simulationWeekCount: season.simulationWeekCount,
      simulatedCurrentWeek: season.simulatedCurrentWeek,
    })
  ) {
    return NextResponse.json(
      {
        error: {
          code: "SIMULATION_COMPLETE",
          message: "Simulation is already on the final configured week",
        },
      },
      { status: 409 },
    );
  }

  if (fromWeek !== season.simulatedCurrentWeek) {
    return NextResponse.json(
      {
        error: {
          code: "SIMULATION_WEEK_STALE",
          message: "Simulation week has already changed; refresh and try again",
        },
        simulatedCurrentWeek: season.simulatedCurrentWeek,
      },
      { status: 409 },
    );
  }

  try {
    const result = await prisma.season.updateMany({
      where: { id: season.id, simulatedCurrentWeek: fromWeek },
      data: { simulatedCurrentWeek: fromWeek + 1 },
    });

    if (result.count === 0) {
      const current = await prisma.season.findUnique({
        where: { id: season.id },
        select: { simulatedCurrentWeek: true },
      });
      return NextResponse.json(
        {
          error: {
            code: "SIMULATION_WEEK_STALE",
            message: "Simulation week has already changed; refresh and try again",
          },
          simulatedCurrentWeek: current?.simulatedCurrentWeek ?? null,
        },
        { status: 409 },
      );
    }

    // Derive the response from values already known to be correct for *this* update
    // (rather than re-reading the row) — avoids a race where a concurrent advance between
    // the updateMany above and a follow-up read could report a state this caller didn't cause.
    const simulatedCurrentWeek = fromWeek + 1;
    const simulationWeekCount = season.simulationWeekCount;
    const isComplete =
      simulatedCurrentWeek === finalSimulationWeek(season.firstCompetitionWeek, simulationWeekCount);

    return NextResponse.json({
      simulatedCurrentWeek,
      simulationWeekCount,
      isComplete,
    });
  } catch (e) {
    console.error("POST /api/leagues/[leagueId]/simulation/advance-week failed", e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
