import type { PrismaClient } from "@prisma/client";

import { deriveFixtureGameResult } from "@/lib/domain/derive-fixture-game-result";
import { ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE } from "@/lib/nfl/apply-simulation-odds-snapshot";
import { finalizeNflWeek } from "@/lib/scoring/finalize-nfl-week";

export type ApplySimulationWeekResultsSuccess = {
  ok: true;
  nflSeasonYear: number;
  weekNumber: number;
  gamesInWeek: number;
  gamesFinalizedThisRun: number;
  allGamesFinalized: boolean;
  scored: number;
  skipped: number;
};

export type ApplySimulationWeekResultsFailure = {
  ok: false;
  code: string;
  message: string;
  httpStatus: number;
};

export type ApplySimulationWeekResultsResult =
  | ApplySimulationWeekResultsSuccess
  | ApplySimulationWeekResultsFailure;

/**
 * Finalize sim games for `(leagueId, nflSeasonYear, weekNumber)` with deterministic scores, then
 * run the production `finalizeNflWeek` pipeline against that league’s sim slate.
 *
 * Only `LeagueSimGame` rows for this league are candidates — never touches canonical `NflGame`.
 * Pick scoring is league-scoped via required `leagueId`.
 * Fail-closed: refuses missing / non-test leagues (defense in depth vs route gates).
 */
export async function applySimulationWeekResults(
  prisma: PrismaClient,
  params: { nflSeasonYear: number; weekNumber: number; leagueId: string },
  now: Date = new Date(),
): Promise<ApplySimulationWeekResultsResult> {
  const { nflSeasonYear, weekNumber, leagueId } = params;

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { isTestLeague: true },
  });
  if (!league) {
    return {
      ok: false,
      code: "LEAGUE_NOT_FOUND",
      message: "League not found",
      httpStatus: 409,
    };
  }
  if (!league.isTestLeague) {
    return {
      ok: false,
      code: "NOT_TEST_LEAGUE",
      message: "Applying simulation results is only available for test / rehearsal leagues",
      httpStatus: 403,
    };
  }

  const candidates = await prisma.leagueSimGame.findMany({
    where: {
      leagueId,
      nflSeasonYear,
      weekNumber,
      oddsLines: {
        some: {
          leagueSimOddsSnapshotRun: {
            status: "COMPLETED",
            source: ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE,
          },
        },
      },
    },
    select: {
      id: true,
      homeTeamId: true,
      awayTeamId: true,
      status: true,
    },
  });

  if (candidates.length === 0) {
    return {
      ok: false,
      code: "SIMULATION_GAMES_NOT_LOADED",
      message:
        "No fixture games with odds have been applied for this week yet — apply an odds snapshot first.",
      httpStatus: 409,
    };
  }

  const toFinalize = candidates.filter(
    (g) => g.status !== "FINAL" && g.status !== "CANCELLED",
  );

  if (toFinalize.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const game of toFinalize) {
        const scores = deriveFixtureGameResult({
          nflSeasonYear,
          weekNumber,
          homeTeamId: game.homeTeamId,
          awayTeamId: game.awayTeamId,
        });
        await tx.leagueSimGame.update({
          where: { id: game.id },
          data: {
            status: "FINAL",
            homeScore: scores.homeScore,
            awayScore: scores.awayScore,
            finalizedAt: now,
          },
        });
      }
    });
  }

  const finalized = await finalizeNflWeek(prisma, { nflSeasonYear, weekNumber, leagueId });
  if (!finalized.ok) {
    return {
      ok: false,
      code: finalized.code,
      message: finalized.message,
      httpStatus: finalized.httpStatus,
    };
  }

  return {
    ok: true,
    nflSeasonYear,
    weekNumber,
    gamesInWeek: candidates.length,
    gamesFinalizedThisRun: toFinalize.length,
    allGamesFinalized: finalized.allGamesFinalized,
    scored: finalized.scored,
    skipped: finalized.skipped,
  };
}
