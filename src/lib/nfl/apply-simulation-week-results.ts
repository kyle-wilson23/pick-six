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
 * Finalize fixture games for `(nflSeasonYear, weekNumber)` with deterministic scores, then
 * run the production `finalizeNflWeek` pipeline (score + reveal when the week is fully final).
 *
 * Safety: only games that carry at least one `test_fixture`-sourced odds line are candidates —
 * real synced games sharing the same global `(year, week)` are never force-finalized.
 *
 * Not league-scoped — callers must gate on `isTestLeague` before invoking (Story 8.4 AC7).
 */
export async function applySimulationWeekResults(
  prisma: PrismaClient,
  params: { nflSeasonYear: number; weekNumber: number },
  now: Date = new Date(),
): Promise<ApplySimulationWeekResultsResult> {
  const { nflSeasonYear, weekNumber } = params;

  const candidates = await prisma.nflGame.findMany({
    where: {
      nflSeasonYear,
      weekNumber,
      oddsLines: {
        some: {
          oddsSnapshotRun: {
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
        await tx.nflGame.update({
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

  const finalized = await finalizeNflWeek(prisma, { nflSeasonYear, weekNumber });
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
