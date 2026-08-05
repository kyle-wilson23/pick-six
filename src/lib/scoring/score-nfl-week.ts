import type { PrismaClient } from "@prisma/client";

import { getGameWinner, scorePickOutcome } from "@/lib/domain/scoring";

export type ScoreNflWeekResult =
  | { ok: true; scored: number; skipped: number }
  | { ok: false; code: string; message: string; httpStatus: number };

/**
 * Score picks for a season week whose games are FINAL.
 *
 * When `opts.leagueId` is provided, only picks belonging to seasons for that league
 * are scored (`season: { nflSeasonYear, leagueId }`). When omitted, picks for
 * **non-test** leagues for the NFL year+week are scored (production admin multi-league
 * path — Story 5.2) so canonical winners never overwrite test-league picks.
 *
 * Test leagues score against that league’s `LeagueSimGame` FINAL rows (hybrid Option B).
 *
 * Idempotent — re-running updates outcomes and refreshes scoredAt.
 */
export async function scoreNflWeek(
  prisma: PrismaClient,
  opts: { nflSeasonYear: number; weekNumber: number; leagueId?: string },
): Promise<ScoreNflWeekResult> {
  try {
    let finalGames: Array<{
      homeTeamId: string;
      awayTeamId: string;
      homeScore: number | null;
      awayScore: number | null;
    }>;

    if (opts.leagueId !== undefined) {
      const league = await prisma.league.findUnique({
        where: { id: opts.leagueId },
        select: { isTestLeague: true },
      });
      if (league?.isTestLeague) {
        finalGames = await prisma.leagueSimGame.findMany({
          where: {
            leagueId: opts.leagueId,
            nflSeasonYear: opts.nflSeasonYear,
            weekNumber: opts.weekNumber,
            status: "FINAL",
          },
          select: {
            homeTeamId: true,
            awayTeamId: true,
            homeScore: true,
            awayScore: true,
          },
        });
      } else {
        finalGames = await prisma.nflGame.findMany({
          where: {
            nflSeasonYear: opts.nflSeasonYear,
            weekNumber: opts.weekNumber,
            status: "FINAL",
          },
          select: {
            homeTeamId: true,
            awayTeamId: true,
            homeScore: true,
            awayScore: true,
          },
        });
      }
    } else {
      finalGames = await prisma.nflGame.findMany({
        where: {
          nflSeasonYear: opts.nflSeasonYear,
          weekNumber: opts.weekNumber,
          status: "FINAL",
        },
        select: {
          homeTeamId: true,
          awayTeamId: true,
          homeScore: true,
          awayScore: true,
        },
      });
    }

    const winnerByTeamId = new Map<string, ReturnType<typeof getGameWinner>>();

    for (const game of finalGames) {
      if (game.homeScore == null || game.awayScore == null) {
        continue;
      }
      const result = getGameWinner({
        homeTeamId: game.homeTeamId,
        awayTeamId: game.awayTeamId,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
      });
      winnerByTeamId.set(game.homeTeamId, result);
      winnerByTeamId.set(game.awayTeamId, result);
    }

    const picks = await prisma.pick.findMany({
      where: {
        nflWeekNumber: opts.weekNumber,
        season: {
          nflSeasonYear: opts.nflSeasonYear,
          // Use !== undefined (not truthy) so "" cannot silently fall through to unscoped scoring.
          ...(opts.leagueId !== undefined
            ? { leagueId: opts.leagueId }
            : { league: { isTestLeague: false } }),
        },
      },
      select: { id: true, teamId: true, antiJailedBonus: true },
    });

    const { scored, skipped } = await prisma.$transaction(async (tx) => {
      let scored = 0;
      let skipped = 0;

      for (const pick of picks) {
        const gameResult = winnerByTeamId.get(pick.teamId);
        if (!gameResult) {
          skipped++;
          continue;
        }
        const { outcome, pointsEarned } = scorePickOutcome(pick, gameResult);
        await tx.pick.update({
          where: { id: pick.id },
          data: { outcome, pointsEarned, scoredAt: new Date() },
        });
        scored++;
      }

      return { scored, skipped };
    });

    return { ok: true, scored, skipped };
  } catch (err) {
    return {
      ok: false,
      code: "SCORING_ERROR",
      message: err instanceof Error ? err.message : String(err),
      httpStatus: 500,
    };
  }
}
